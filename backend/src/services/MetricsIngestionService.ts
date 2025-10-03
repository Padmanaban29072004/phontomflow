/**
 * Metrics Ingestion Service
 * Service for ingesting various types of metrics into InfluxDB
 */

import { logger } from '@/utils/logger';
import { InfluxDBService } from './InfluxDBService';
import {
  MetricsIngestionInterface,
  TimeSeriesPoint,
  PerformanceMetricsPoint,
  ThreatDetectionPoint,
  UserBehaviorPoint,
  SystemHealthPoint,
  RateLimitPoint,
  InfluxDBWriteResult
} from '@/types/influxdb';

export class MetricsIngestionService implements MetricsIngestionInterface {
  private influxDB: InfluxDBService;
  private batchSize: number;
  private batchTimeout: number;
  private pendingPoints: TimeSeriesPoint[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(influxDB: InfluxDBService, batchSize: number = 100, batchTimeout: number = 5000) {
    this.influxDB = influxDB;
    this.batchSize = batchSize;
    this.batchTimeout = batchTimeout;
  }

  // ============================================================================
  // PERFORMANCE METRICS INGESTION
  // ============================================================================

  public async ingestPerformanceMetrics(data: PerformanceMetricsPoint[]): Promise<boolean> {
    try {
      logger.debug('Ingesting performance metrics', { count: data.length });
      
      const points: TimeSeriesPoint[] = data.map(point => ({
        measurement: point.measurement,
        tags: point.tags,
        fields: point.fields,
        timestamp: point.timestamp
      }));

      const result = await this.batchIngest(points);
      
      if (result.success) {
        logger.info('Performance metrics ingested successfully', {
          pointsWritten: result.pointsWritten,
          latency: result.latency
        });
        return true;
      } else {
        logger.error('Failed to ingest performance metrics', {
          errors: result.errors
        });
        return false;
      }
    } catch (error) {
      logger.error('Error ingesting performance metrics:', error);
      return false;
    }
  }

  // ============================================================================
  // THREAT DETECTION DATA INGESTION
  // ============================================================================

  public async ingestThreatData(data: ThreatDetectionPoint[]): Promise<boolean> {
    try {
      logger.debug('Ingesting threat detection data', { count: data.length });
      
      const points: TimeSeriesPoint[] = data.map(point => ({
        measurement: point.measurement,
        tags: point.tags,
        fields: point.fields,
        timestamp: point.timestamp
      }));

      const result = await this.batchIngest(points);
      
      if (result.success) {
        logger.info('Threat detection data ingested successfully', {
          pointsWritten: result.pointsWritten,
          latency: result.latency
        });
        return true;
      } else {
        logger.error('Failed to ingest threat detection data', {
          errors: result.errors
        });
        return false;
      }
    } catch (error) {
      logger.error('Error ingesting threat detection data:', error);
      return false;
    }
  }

  // ============================================================================
  // USER BEHAVIOR DATA INGESTION
  // ============================================================================

  public async ingestUserBehavior(data: UserBehaviorPoint[]): Promise<boolean> {
    try {
      logger.debug('Ingesting user behavior data', { count: data.length });
      
      const points: TimeSeriesPoint[] = data.map(point => ({
        measurement: point.measurement,
        tags: point.tags,
        fields: point.fields,
        timestamp: point.timestamp
      }));

      const result = await this.batchIngest(points);
      
      if (result.success) {
        logger.info('User behavior data ingested successfully', {
          pointsWritten: result.pointsWritten,
          latency: result.latency
        });
        return true;
      } else {
        logger.error('Failed to ingest user behavior data', {
          errors: result.errors
        });
        return false;
      }
    } catch (error) {
      logger.error('Error ingesting user behavior data:', error);
      return false;
    }
  }

  // ============================================================================
  // SYSTEM HEALTH DATA INGESTION
  // ============================================================================

  public async ingestSystemHealth(data: SystemHealthPoint[]): Promise<boolean> {
    try {
      logger.debug('Ingesting system health data', { count: data.length });
      
      const points: TimeSeriesPoint[] = data.map(point => ({
        measurement: point.measurement,
        tags: point.tags,
        fields: point.fields,
        timestamp: point.timestamp
      }));

      const result = await this.batchIngest(points);
      
      if (result.success) {
        logger.info('System health data ingested successfully', {
          pointsWritten: result.pointsWritten,
          latency: result.latency
        });
        return true;
      } else {
        logger.error('Failed to ingest system health data', {
          errors: result.errors
        });
        return false;
      }
    } catch (error) {
      logger.error('Error ingesting system health data:', error);
      return false;
    }
  }

  // ============================================================================
  // RATE LIMITING DATA INGESTION
  // ============================================================================

  public async ingestRateLimitData(data: RateLimitPoint[]): Promise<boolean> {
    try {
      logger.debug('Ingesting rate limiting data', { count: data.length });
      
      const points: TimeSeriesPoint[] = data.map(point => ({
        measurement: point.measurement,
        tags: point.tags,
        fields: point.fields,
        timestamp: point.timestamp
      }));

      const result = await this.batchIngest(points);
      
      if (result.success) {
        logger.info('Rate limiting data ingested successfully', {
          pointsWritten: result.pointsWritten,
          latency: result.latency
        });
        return true;
      } else {
        logger.error('Failed to ingest rate limiting data', {
          errors: result.errors
        });
        return false;
      }
    } catch (error) {
      logger.error('Error ingesting rate limiting data:', error);
      return false;
    }
  }

  // ============================================================================
  // BATCH INGESTION
  // ============================================================================

  public async batchIngest(points: TimeSeriesPoint[]): Promise<InfluxDBWriteResult> {
    try {
      // Add points to pending batch
      this.pendingPoints.push(...points);
      
      // Check if we should flush the batch
      if (this.pendingPoints.length >= this.batchSize) {
        return await this.flushBatch();
      } else {
        // Set up timer for batch timeout if not already set
        if (!this.batchTimer) {
          this.batchTimer = setTimeout(() => {
            this.flushBatch();
          }, this.batchTimeout);
        }
        
        return {
          success: true,
          pointsWritten: 0, // Will be written when batch flushes
          errors: [],
          latency: 0
        };
      }
    } catch (error) {
      logger.error('Error in batch ingestion:', error);
      return {
        success: false,
        pointsWritten: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        latency: 0
      };
    }
  }

  // ============================================================================
  // BATCH MANAGEMENT
  // ============================================================================

  private async flushBatch(): Promise<InfluxDBWriteResult> {
    if (this.pendingPoints.length === 0) {
      return {
        success: true,
        pointsWritten: 0,
        errors: [],
        latency: 0
      };
    }

    try {
      // Clear the timer
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }

      // Get points to write
      const pointsToWrite = [...this.pendingPoints];
      this.pendingPoints = [];

      // Validate and sanitize points
      const validatedPoints = this.validatePoints(pointsToWrite);
      
      if (validatedPoints.length === 0) {
        logger.warn('No valid points to write after validation');
        return {
          success: true,
          pointsWritten: 0,
          errors: [],
          latency: 0
        };
      }

      // Write to InfluxDB
      const result = await this.influxDB.write(validatedPoints);
      
      logger.debug('Batch flushed', {
        pointsWritten: result.pointsWritten,
        latency: result.latency,
        success: result.success
      });

      return result;
    } catch (error) {
      logger.error('Error flushing batch:', error);
      return {
        success: false,
        pointsWritten: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        latency: 0
      };
    }
  }

  // ============================================================================
  // DATA VALIDATION
  // ============================================================================

  private validatePoints(points: TimeSeriesPoint[]): TimeSeriesPoint[] {
    const validPoints: TimeSeriesPoint[] = [];
    const errors: string[] = [];

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      try {
        // Validate measurement
        if (!point.measurement || typeof point.measurement !== 'string') {
          errors.push(`Point ${i}: measurement is required and must be a string`);
          continue;
        }

        // Validate tags
        if (!point.tags || typeof point.tags !== 'object') {
          errors.push(`Point ${i}: tags are required and must be an object`);
          continue;
        }

        // Validate fields
        if (!point.fields || typeof point.fields !== 'object') {
          errors.push(`Point ${i}: fields are required and must be an object`);
          continue;
        }

        // Sanitize tags (all values must be strings)
        const sanitizedTags: Record<string, string> = {};
        for (const [key, value] of Object.entries(point.tags)) {
          if (typeof value === 'string') {
            sanitizedTags[key] = value;
          } else {
            sanitizedTags[key] = String(value);
          }
        }

        // Sanitize fields (convert to appropriate types)
        const sanitizedFields: Record<string, number | string | boolean> = {};
        for (const [key, value] of Object.entries(point.fields)) {
          if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
            sanitizedFields[key] = value;
          } else if (value === null || value === undefined) {
            // Skip null/undefined values
            continue;
          } else {
            // Convert to string as fallback
            sanitizedFields[key] = String(value);
          }
        }

        // Validate timestamp
        let timestamp = point.timestamp;
        if (timestamp) {
          if (typeof timestamp === 'string') {
            timestamp = new Date(timestamp).getTime();
          } else if (timestamp instanceof Date) {
            timestamp = timestamp.getTime();
          } else if (typeof timestamp === 'number') {
            // Already in milliseconds
          } else {
            errors.push(`Point ${i}: invalid timestamp format`);
            continue;
          }
        } else {
          timestamp = Date.now();
        }

        validPoints.push({
          measurement: point.measurement,
          tags: sanitizedTags,
          fields: sanitizedFields,
          timestamp
        });
      } catch (error) {
        errors.push(`Point ${i}: validation error - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (errors.length > 0) {
      logger.warn('Point validation errors:', { errors });
    }

    return validPoints;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  public async flush(): Promise<InfluxDBWriteResult> {
    return await this.flushBatch();
  }

  public getPendingCount(): number {
    return this.pendingPoints.length;
  }

  public getBatchSize(): number {
    return this.batchSize;
  }

  public setBatchSize(size: number): void {
    this.batchSize = size;
  }

  public getBatchTimeout(): number {
    return this.batchTimeout;
  }

  public setBatchTimeout(timeout: number): void {
    this.batchTimeout = timeout;
  }

  // ============================================================================
  // CONVENIENCE METHODS FOR COMMON METRICS
  // ============================================================================

  public async recordPerformanceMetric(
    host: string,
    service: string,
    endpoint: string,
    method: string,
    responseTime: number,
    additionalFields: Partial<PerformanceMetricsPoint['fields']> = {}
  ): Promise<boolean> {
    const point: PerformanceMetricsPoint = {
      measurement: 'performance_metrics',
      tags: {
        host,
        service,
        endpoint,
        method,
        status_code: '200', // Default, should be passed in real usage
        user_type: 'unknown'
      },
      fields: {
        response_time: responseTime,
        cpu_usage: 0,
        memory_usage: 0,
        request_count: 1,
        error_count: 0,
        throughput: 0,
        active_connections: 0,
        ...additionalFields
      },
      timestamp: Date.now()
    };

    return await this.ingestPerformanceMetrics([point]);
  }

  public async recordThreatEvent(
    ipAddress: string,
    threatType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    riskScore: number,
    additionalFields: Partial<ThreatDetectionPoint['fields']> = {}
  ): Promise<boolean> {
    const point: ThreatDetectionPoint = {
      measurement: 'threat_detection',
      tags: {
        ip_address: ipAddress,
        threat_type: threatType,
        severity,
        source: 'phantom_flow',
        session_id: 'unknown',
        user_agent: 'unknown',
        country: 'unknown'
      },
      fields: {
        risk_score: riskScore,
        confidence: 0.8, // Default confidence
        response_time: 0,
        blocked: false,
        threat_count: 1,
        false_positive: false,
        mitigation_applied: false,
        ...additionalFields
      },
      timestamp: Date.now()
    };

    return await this.ingestThreatData([point]);
  }

  public async recordUserAction(
    sessionId: string,
    userType: 'anonymous' | 'authenticated' | 'admin',
    action: string,
    additionalFields: Partial<UserBehaviorPoint['fields']> = {}
  ): Promise<boolean> {
    const point: UserBehaviorPoint = {
      measurement: 'user_behavior',
      tags: {
        session_id: sessionId,
        user_type: userType,
        location: 'unknown',
        device_type: 'unknown',
        browser: 'unknown',
        os: 'unknown'
      },
      fields: {
        action_count: 1,
        session_duration: 0,
        page_views: 1,
        conversion_rate: 0,
        bounce_rate: 0,
        unique_pages: 1,
        api_calls: 1,
        ...additionalFields
      },
      timestamp: Date.now()
    };

    return await this.ingestUserBehavior([point]);
  }
}
