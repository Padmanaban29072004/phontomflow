/**
 * Data Retention & Cleanup Service
 * Manage data retention policies and automated cleanup
 */

import { logger } from '@/utils/logger';
import { InfluxDBService } from './InfluxDBService';
import { 
  DataRetentionConfig, 
  RetentionPolicy, 
  InfluxDBQueryResult 
} from '@/types/influxdb';
import { retentionPolicies } from '@/config/influxdbConfig';
import * as cron from 'node-cron';

export class DataRetentionService {
  private influxDB: InfluxDBService;
  private config: DataRetentionConfig;
  private cleanupJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  constructor(influxDB: InfluxDBService, config?: DataRetentionConfig) {
    this.influxDB = influxDB;
    this.config = config || retentionPolicies;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  public async initialize(): Promise<boolean> {
    try {
      logger.info('Initializing data retention service...');

      // Create all retention policies
      await this.createAllRetentionPolicies();

      // Start cleanup scheduler
      this.startCleanupScheduler();

      logger.info('Data retention service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize data retention service:', error);
      return false;
    }
  }

  public async shutdown(): Promise<void> {
    try {
      if (this.cleanupJob) {
        this.cleanupJob.stop();
        this.cleanupJob = null;
      }
      this.isRunning = false;
      logger.info('Data retention service shutdown');
    } catch (error) {
      logger.error('Error shutting down data retention service:', error);
    }
  }

  // ============================================================================
  // RETENTION POLICY MANAGEMENT
  // ============================================================================

  public async createAllRetentionPolicies(): Promise<void> {
    try {
      logger.info('Creating retention policies...');

      const policies = Object.values(this.config.policies);
      
      for (const policy of policies) {
        try {
          await this.createRetentionPolicy(policy);
        } catch (error) {
          logger.warn(`Failed to create retention policy ${policy.name}:`, error);
        }
      }

      logger.info('Retention policies creation completed');
    } catch (error) {
      logger.error('Error creating retention policies:', error);
      throw error;
    }
  }

  public async createRetentionPolicy(policy: RetentionPolicy): Promise<boolean> {
    try {
      logger.debug('Creating retention policy', { policy: policy.name });

      const result = await this.influxDB.createRetentionPolicy(policy);
      
      if (result) {
        logger.info('Retention policy created successfully', { policy: policy.name });
      } else {
        logger.warn('Failed to create retention policy', { policy: policy.name });
      }

      return result;
    } catch (error) {
      logger.error('Error creating retention policy:', error);
      return false;
    }
  }

  public async getRetentionPolicies(): Promise<RetentionPolicy[]> {
    try {
      return await this.influxDB.getRetentionPolicies();
    } catch (error) {
      logger.error('Error getting retention policies:', error);
      return [];
    }
  }

  public async updateRetentionPolicy(policyName: string, newPolicy: RetentionPolicy): Promise<boolean> {
    try {
      logger.info('Updating retention policy', { policy: policyName });

      // Drop existing policy
      await this.dropRetentionPolicy(policyName);

      // Create new policy
      const result = await this.createRetentionPolicy(newPolicy);
      
      if (result) {
        logger.info('Retention policy updated successfully', { policy: policyName });
      }

      return result;
    } catch (error) {
      logger.error('Error updating retention policy:', error);
      return false;
    }
  }

  public async dropRetentionPolicy(policyName: string): Promise<boolean> {
    try {
      logger.info('Dropping retention policy', { policy: policyName });

      const query = `DROP RETENTION POLICY "${policyName}" ON "${this.influxDB['config'].database}"`;
      const result = await this.influxDB.query(query);
      
      if (result.success) {
        logger.info('Retention policy dropped successfully', { policy: policyName });
        return true;
      } else {
        logger.warn('Failed to drop retention policy', { policy: policyName, error: result.error });
        return false;
      }
    } catch (error) {
      logger.error('Error dropping retention policy:', error);
      return false;
    }
  }

  // ============================================================================
  // CLEANUP OPERATIONS
  // ============================================================================

  public startCleanupScheduler(): void {
    try {
      if (this.cleanupJob) {
        this.cleanupJob.stop();
      }

      logger.info('Starting cleanup scheduler', { schedule: this.config.cleanupSchedule });

      this.cleanupJob = cron.schedule(this.config.cleanupSchedule, async () => {
        await this.performCleanup();
      }, {
        scheduled: true,
        timezone: 'UTC'
      });

      this.isRunning = true;
      logger.info('Cleanup scheduler started successfully');
    } catch (error) {
      logger.error('Error starting cleanup scheduler:', error);
    }
  }

  public async performCleanup(): Promise<void> {
    try {
      logger.info('Starting data cleanup process...');

      const startTime = Date.now();
      let totalDeleted = 0;

      // Clean up each measurement based on retention policies
      const measurements = ['performance_metrics', 'threat_detection', 'user_behavior', 'system_health', 'rate_limiting'];
      
      for (const measurement of measurements) {
        try {
          const deleted = await this.cleanupMeasurement(measurement);
          totalDeleted += deleted;
        } catch (error) {
          logger.error(`Error cleaning up measurement ${measurement}:`, error);
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Data cleanup completed', {
        totalDeleted,
        duration: `${duration}ms`
      });
    } catch (error) {
      logger.error('Error during cleanup process:', error);
    }
  }

  private async cleanupMeasurement(measurement: string): Promise<number> {
    try {
      logger.debug('Cleaning up measurement', { measurement });

      // Get the appropriate retention policy for this measurement
      const policy = this.getRetentionPolicyForMeasurement(measurement);
      if (!policy) {
        logger.warn('No retention policy found for measurement', { measurement });
        return 0;
      }

      // Calculate cutoff time
      const cutoffTime = this.calculateCutoffTime(policy.duration);
      
      // Count records to be deleted
      const countQuery = `
        SELECT count(*) as record_count 
        FROM "${measurement}" 
        WHERE time < '${cutoffTime.toISOString()}'
      `;
      
      const countResult = await this.influxDB.query(countQuery);
      const recordCount = countResult.success && countResult.data.length > 0 
        ? countResult.data[0].record_count 
        : 0;

      if (recordCount === 0) {
        logger.debug('No records to delete for measurement', { measurement });
        return 0;
      }

      // Archive data if configured
      if (this.config.archiveBeforeDelete) {
        await this.archiveData(measurement, cutoffTime);
      }

      // Delete old records
      const deleteQuery = `
        DELETE FROM "${measurement}" 
        WHERE time < '${cutoffTime.toISOString()}'
      `;
      
      const deleteResult = await this.influxDB.query(deleteQuery);
      
      if (deleteResult.success) {
        logger.info('Measurement cleanup completed', {
          measurement,
          recordsDeleted: recordCount,
          cutoffTime: cutoffTime.toISOString()
        });
        return recordCount;
      } else {
        logger.error('Failed to delete records from measurement', {
          measurement,
          error: deleteResult.error
        });
        return 0;
      }
    } catch (error) {
      logger.error('Error cleaning up measurement:', error);
      return 0;
    }
  }

  // ============================================================================
  // ARCHIVAL OPERATIONS
  // ============================================================================

  private async archiveData(measurement: string, cutoffTime: Date): Promise<void> {
    try {
      logger.info('Archiving data before deletion', { measurement, cutoffTime });

      // Create archive query
      const archiveQuery = `
        SELECT * 
        FROM "${measurement}" 
        WHERE time < '${cutoffTime.toISOString()}'
        INTO archive.${measurement}
      `;

      const result = await this.influxDB.query(archiveQuery);
      
      if (result.success) {
        logger.info('Data archived successfully', { measurement });
      } else {
        logger.warn('Failed to archive data', { measurement, error: result.error });
      }
    } catch (error) {
      logger.error('Error archiving data:', error);
    }
  }

  // ============================================================================
  // STORAGE MANAGEMENT
  // ============================================================================

  public async getStorageUsage(): Promise<{
    totalSize: number;
    measurements: Array<{
      name: string;
      size: number;
      recordCount: number;
    }>;
  }> {
    try {
      logger.debug('Getting storage usage information');

      // Get database size (this is a simplified approach)
      const sizeQuery = `SHOW STATS`;
      const result = await this.influxDB.query(sizeQuery);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get storage stats');
      }

      // Parse stats to get size information
      const stats = result.data;
      let totalSize = 0;
      const measurements: Array<{ name: string; size: number; recordCount: number }> = [];

      // This is a simplified implementation
      // In a real scenario, you'd parse the stats more thoroughly
      for (const stat of stats) {
        if (stat.series) {
          for (const series of stat.series) {
            if (series.name && series.values) {
              const measurementName = series.name;
              const size = series.values[0]?.[1] || 0; // Approximate size
              const recordCount = series.values[0]?.[2] || 0; // Approximate count
              
              totalSize += size;
              measurements.push({
                name: measurementName,
                size,
                recordCount
              });
            }
          }
        }
      }

      return {
        totalSize,
        measurements
      };
    } catch (error) {
      logger.error('Error getting storage usage:', error);
      return {
        totalSize: 0,
        measurements: []
      };
    }
  }

  public async checkStorageLimit(): Promise<{
    withinLimit: boolean;
    currentSize: number;
    maxSize: number;
    percentage: number;
  }> {
    try {
      const usage = await this.getStorageUsage();
      const maxSizeBytes = this.parseStorageSize(this.config.maxStorageSize);
      const percentage = (usage.totalSize / maxSizeBytes) * 100;

      return {
        withinLimit: usage.totalSize < maxSizeBytes,
        currentSize: usage.totalSize,
        maxSize: maxSizeBytes,
        percentage
      };
    } catch (error) {
      logger.error('Error checking storage limit:', error);
      return {
        withinLimit: true,
        currentSize: 0,
        maxSize: 0,
        percentage: 0
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getRetentionPolicyForMeasurement(measurement: string): RetentionPolicy | null {
    // Map measurements to retention policies
    const measurementPolicyMap: Record<string, keyof typeof this.config.policies> = {
      'performance_metrics': 'raw_data',
      'user_behavior': 'raw_data',
      'system_health': 'raw_data',
      'rate_limiting': 'raw_data',
      'threat_detection': 'threat_data'
    };

    const policyName = measurementPolicyMap[measurement];
    return policyName ? this.config.policies[policyName] : null;
  }

  private calculateCutoffTime(duration: string): Date {
    const now = new Date();
    const durationMs = this.parseDuration(duration);
    return new Date(now.getTime() - durationMs);
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhdwy])$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      's': 1000,           // seconds
      'm': 60 * 1000,      // minutes
      'h': 60 * 60 * 1000, // hours
      'd': 24 * 60 * 60 * 1000, // days
      'w': 7 * 24 * 60 * 60 * 1000, // weeks
      'y': 365 * 24 * 60 * 60 * 1000 // years
    };

    return value * (multipliers[unit] || 0);
  }

  private parseStorageSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB)?$/i);
    if (!match) {
      throw new Error(`Invalid storage size format: ${sizeStr}`);
    }

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();

    const multipliers: Record<string, number> = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    };

    return value * (multipliers[unit] || 1);
  }

  // ============================================================================
  // MANUAL CLEANUP METHODS
  // ============================================================================

  public async cleanupOldData(measurement: string, olderThanDays: number): Promise<number> {
    try {
      logger.info('Performing manual cleanup', { measurement, olderThanDays });

      const cutoffTime = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      
      const countQuery = `
        SELECT count(*) as record_count 
        FROM "${measurement}" 
        WHERE time < '${cutoffTime.toISOString()}'
      `;
      
      const countResult = await this.influxDB.query(countQuery);
      const recordCount = countResult.success && countResult.data.length > 0 
        ? countResult.data[0].record_count 
        : 0;

      if (recordCount === 0) {
        logger.info('No records to delete', { measurement });
        return 0;
      }

      const deleteQuery = `
        DELETE FROM "${measurement}" 
        WHERE time < '${cutoffTime.toISOString()}'
      `;
      
      const deleteResult = await this.influxDB.query(deleteQuery);
      
      if (deleteResult.success) {
        logger.info('Manual cleanup completed', {
          measurement,
          recordsDeleted: recordCount
        });
        return recordCount;
      } else {
        logger.error('Failed to delete records', {
          measurement,
          error: deleteResult.error
        });
        return 0;
      }
    } catch (error) {
      logger.error('Error during manual cleanup:', error);
      return 0;
    }
  }

  public isCleanupRunning(): boolean {
    return this.isRunning;
  }

  public getConfig(): DataRetentionConfig {
    return { ...this.config };
  }
}
