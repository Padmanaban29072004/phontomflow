/**
 * InfluxDB Client Service
 * Core service for InfluxDB operations and connection management
 */

import * as Influx from 'influx';
import { logger } from '@/utils/logger';
import { 
  InfluxDBConfig, 
  TimeSeriesPoint, 
  InfluxDBWriteOptions, 
  InfluxDBWriteResult, 
  InfluxDBQueryResult, 
  QueryOptions,
  InfluxDBServiceInterface,
  InfluxDBHealthStatus,
  InfluxDBError,
  RetentionPolicy
} from '@/types/influxdb';
import { getInfluxDBConfig, validateInfluxDBConfig } from '@/config/influxdbConfig';

export class InfluxDBService implements InfluxDBServiceInterface {
  private client: Influx.InfluxDB | null = null;
  private config: InfluxDBConfig;
  private isConnectedFlag: boolean = false;
  private connectionStartTime: number = 0;
  private totalQueries: number = 0;
  private totalWrites: number = 0;
  private queryTimes: number[] = [];
  private writeTimes: number[] = [];
  private lastError: InfluxDBError | null = null;

  constructor(config?: InfluxDBConfig) {
    this.config = config || getInfluxDBConfig();
    this.validateConfiguration();
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  public async connect(): Promise<boolean> {
    try {
      logger.info('Connecting to InfluxDB...', { config: this.sanitizeConfig() });

      const connectionOptions: Influx.IClusterConfig = {
        hosts: [{
          host: this.config.host,
          port: this.config.port,
          protocol: this.config.protocol
        }],
        database: this.config.database,
        username: this.config.username,
        password: this.config.password
      };

      this.client = new Influx.InfluxDB(connectionOptions);
      
      // Test connection
      await this.client.ping(this.config.timeout);
      
      this.isConnectedFlag = true;
      this.connectionStartTime = Date.now();
      
      logger.info('Successfully connected to InfluxDB', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database
      });

      // Initialize database and retention policies
      await this.initializeDatabase();
      
      return true;
    } catch (error) {
      this.handleError('connect', error as Error);
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.client) {
        // InfluxDB client doesn't have explicit disconnect method
        this.client = null;
        this.isConnectedFlag = false;
        logger.info('Disconnected from InfluxDB');
      }
    } catch (error) {
      this.handleError('disconnect', error as Error);
    }
  }

  public isConnected(): boolean {
    return this.isConnectedFlag && this.client !== null;
  }

  // ============================================================================
  // WRITE OPERATIONS
  // ============================================================================

  public async write(points: TimeSeriesPoint[], options?: InfluxDBWriteOptions): Promise<InfluxDBWriteResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isConnected()) {
        throw new Error('InfluxDB client is not connected');
      }

      if (!points || points.length === 0) {
        return {
          success: true,
          pointsWritten: 0,
          errors: [],
          latency: 0
        };
      }

      logger.debug('Writing points to InfluxDB', { 
        pointCount: points.length,
        measurement: points[0]?.measurement 
      });

      const writeOptions: Influx.IWriteOptions = {
        precision: (options?.precision || this.config.precision) as any,
        retentionPolicy: options?.retentionPolicy,
        database: options?.database || this.config.database
      };

      await this.client!.writePoints(points, writeOptions);
      
      const latency = Date.now() - startTime;
      this.totalWrites++;
      this.writeTimes.push(latency);
      
      logger.debug('Successfully wrote points to InfluxDB', {
        pointCount: points.length,
        latency
      });

      return {
        success: true,
        pointsWritten: points.length,
        errors: [],
        latency
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.handleError('write', error as Error);
      
      return {
        success: false,
        pointsWritten: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        latency
      };
    }
  }

  // ============================================================================
  // QUERY OPERATIONS
  // ============================================================================

  public async query(query: string): Promise<InfluxDBQueryResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isConnected()) {
        throw new Error('InfluxDB client is not connected');
      }

      logger.debug('Executing InfluxDB query', { query });

      const result = await this.client!.query(query);
      const latency = Date.now() - startTime;
      
      this.totalQueries++;
      this.queryTimes.push(latency);
      
      logger.debug('Query executed successfully', { latency, resultCount: result.length });

      return {
        success: true,
        data: result as any,
        count: result.length,
        executionTime: latency
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.handleError('query', error as Error);
      
      return {
        success: false,
        data: [],
        count: 0,
        executionTime: latency,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  public async queryTimeSeries(options: QueryOptions): Promise<InfluxDBQueryResult> {
    try {
      const query = this.buildTimeSeriesQuery(options);
      return await this.query(query);
    } catch (error) {
      this.handleError('queryTimeSeries', error as Error);
      return {
        success: false,
        data: [],
        count: 0,
        executionTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ============================================================================
  // RETENTION POLICY MANAGEMENT
  // ============================================================================

  public async createRetentionPolicy(policy: RetentionPolicy): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        throw new Error('InfluxDB client is not connected');
      }

      const query = `
        CREATE RETENTION POLICY "${policy.name}" 
        ON "${this.config.database}" 
        DURATION ${policy.duration} 
        REPLICATION ${policy.replication}
        ${policy.shardDuration ? `SHARD DURATION ${policy.shardDuration}` : ''}
        ${policy.default ? 'DEFAULT' : ''}
      `;

      await this.query(query);
      
      logger.info('Created retention policy', { policy: policy.name });
      return true;
    } catch (error) {
      this.handleError('createRetentionPolicy', error as Error);
      return false;
    }
  }

  public async getRetentionPolicies(): Promise<RetentionPolicy[]> {
    try {
      const query = `SHOW RETENTION POLICIES ON "${this.config.database}"`;
      const result = await this.query(query);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get retention policies');
      }

      return result.data.map((row: any) => ({
        name: row.name,
        duration: row.duration,
        replication: row.replication,
        shardDuration: row.shardDuration,
        default: row.default === 'true',
        description: row.description
      }));
    } catch (error) {
      this.handleError('getRetentionPolicies', error as Error);
      return [];
    }
  }

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }

      await this.client.ping(5000);
      return true;
    } catch (error) {
      this.handleError('healthCheck', error as Error);
      return false;
    }
  }

  public getHealthStatus(): InfluxDBHealthStatus {
    const now = Date.now();
    const uptime = this.connectionStartTime > 0 ? now - this.connectionStartTime : 0;
    
    const avgQueryTime = this.queryTimes.length > 0 
      ? this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length 
      : 0;
    
    const avgWriteTime = this.writeTimes.length > 0 
      ? this.writeTimes.reduce((a, b) => a + b, 0) / this.writeTimes.length 
      : 0;

    return {
      connected: this.isConnected(),
      database: this.config.database,
      version: '1.x', // InfluxDB 1.x doesn't expose version easily
      uptime,
      lastError: this.lastError || undefined,
      connectionPool: {
        active: this.isConnected() ? 1 : 0,
        idle: this.isConnected() ? this.config.poolSize - 1 : 0,
        total: this.config.poolSize
      },
      performance: {
        averageQueryTime: avgQueryTime,
        averageWriteTime: avgWriteTime,
        totalQueries: this.totalQueries,
        totalWrites: this.totalWrites
      }
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private validateConfiguration(): void {
    const errors = validateInfluxDBConfig(this.config);
    if (errors.length > 0) {
      throw new Error(`InfluxDB configuration validation failed: ${errors.join(', ')}`);
    }
  }

  private sanitizeConfig(): Partial<InfluxDBConfig> {
    return {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      protocol: this.config.protocol,
      timeout: this.config.timeout,
      poolSize: this.config.poolSize,
      precision: this.config.precision,
      consistency: this.config.consistency
      // Exclude username and password for security
    };
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Create database if it doesn't exist
      await this.query(`CREATE DATABASE IF NOT EXISTS "${this.config.database}"`);
      
      // Create default retention policies
      const { getAllRetentionPolicies } = await import('@/config/influxdbConfig');
      const policies = getAllRetentionPolicies();
      
      for (const policy of policies) {
        try {
          await this.createRetentionPolicy(policy);
        } catch (error) {
          // Policy might already exist, log and continue
          logger.warn('Failed to create retention policy (might already exist)', {
            policy: policy.name,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      logger.info('Database initialization completed', { database: this.config.database });
    } catch (error) {
      this.handleError('initializeDatabase', error as Error);
    }
  }

  private buildTimeSeriesQuery(options: QueryOptions): string {
    let query = `SELECT `;
    
    // Add fields
    if (options.fields && options.fields.length > 0) {
      query += options.fields.join(', ');
    } else {
      query += '*';
    }
    
    query += ` FROM "${options.measurement}"`;
    
    // Add time range
    if (options.startTime || options.endTime) {
      const conditions: string[] = [];
      
      if (options.startTime) {
        const startTime = typeof options.startTime === 'string' 
          ? options.startTime 
          : new Date(options.startTime).toISOString();
        conditions.push(`time >= '${startTime}'`);
      }
      
      if (options.endTime) {
        const endTime = typeof options.endTime === 'string' 
          ? options.endTime 
          : new Date(options.endTime).toISOString();
        conditions.push(`time <= '${endTime}'`);
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
    }
    
    // Add tag filters
    if (options.tags) {
      const tagConditions = Object.entries(options.tags)
        .map(([key, value]) => `"${key}" = '${value}'`)
        .join(' AND ');
      
      if (tagConditions) {
        query += options.startTime || options.endTime ? ` AND ${tagConditions}` : ` WHERE ${tagConditions}`;
      }
    }
    
    // Add group by
    if (options.groupBy && options.groupBy.length > 0) {
      query += ` GROUP BY ${options.groupBy.join(', ')}`;
    }
    
    // Add aggregation
    if (options.aggregation) {
      // This would need more complex query building for aggregations
      // For now, we'll handle this in the specific query methods
    }
    
    // Add order by
    if (options.orderBy) {
      query += ` ORDER BY time ${options.orderBy}`;
    }
    
    // Add limit
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    
    return query;
  }

  private handleError(operation: string, error: Error): void {
    const influxError: InfluxDBError = {
      code: 'INFLUXDB_ERROR',
      message: error.message,
      details: error.stack,
      timestamp: new Date(),
      operation,
      retryable: this.isRetryableError(error)
    };
    
    this.lastError = influxError;
    
    logger.error(`InfluxDB ${operation} error:`, {
      error: error.message,
      operation,
      retryable: influxError.retryable
    });
  }

  private isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNRESET',
      'timeout',
      'connection'
    ];
    
    return retryablePatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }
}
