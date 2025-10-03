/**
 * InfluxDB Integration Layer
 * Integration layer connecting InfluxDB with existing systems
 */

import { logger } from '@/utils/logger';
import { InfluxDBService } from './InfluxDBService';
import { MetricsIngestionService } from './MetricsIngestionService';
import { HistoricalDataService } from './HistoricalDataService';
import { DataRetentionService } from './DataRetentionService';
import {
  PerformanceMetricsPoint,
  ThreatDetectionPoint,
  UserBehaviorPoint,
  SystemHealthPoint,
  RateLimitPoint,
  InfluxDBHealthStatus
} from '@/types/influxdb';

export class InfluxDBIntegration {
  private influxDB: InfluxDBService;
  private metricsIngestion: MetricsIngestionService;
  private historicalData: HistoricalDataService;
  private retentionService: DataRetentionService;
  private isInitialized: boolean = false;

  constructor() {
    this.influxDB = new InfluxDBService();
    this.metricsIngestion = new MetricsIngestionService(this.influxDB);
    this.historicalData = new HistoricalDataService(this.influxDB);
    this.retentionService = new DataRetentionService(this.influxDB);
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  public async initialize(): Promise<boolean> {
    try {
      logger.info('Initializing InfluxDB integration...');

      // Connect to InfluxDB
      const connected = await this.influxDB.connect();
      if (!connected) {
        throw new Error('Failed to connect to InfluxDB');
      }

      // Initialize retention service
      await this.retentionService.initialize();

      this.isInitialized = true;
      logger.info('InfluxDB integration initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize InfluxDB integration:', error);
      return false;
    }
  }

  public async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down InfluxDB integration...');

      // Flush any pending metrics
      await this.metricsIngestion.flush();

      // Shutdown retention service
      await this.retentionService.shutdown();

      // Disconnect from InfluxDB
      await this.influxDB.disconnect();

      this.isInitialized = false;
      logger.info('InfluxDB integration shutdown completed');
    } catch (error) {
      logger.error('Error during InfluxDB integration shutdown:', error);
    }
  }

  // ============================================================================
  // STATISTICAL ANALYZER INTEGRATION
  // ============================================================================

  public async recordStatisticalMetrics(
    host: string,
    service: string,
    metrics: {
      responseTime: number;
      cpuUsage: number;
      memoryUsage: number;
      requestCount: number;
      errorCount: number;
      throughput: number;
      activeConnections: number;
    },
    additionalTags: Record<string, string> = {}
  ): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        logger.warn('InfluxDB integration not initialized, skipping metrics recording');
        return false;
      }

      const point: PerformanceMetricsPoint = {
        measurement: 'performance_metrics',
        tags: {
          host,
          service,
          endpoint: additionalTags.endpoint || 'unknown',
          method: additionalTags.method || 'unknown',
          status_code: additionalTags.status_code || '200',
          user_type: additionalTags.user_type || 'unknown',
          ...additionalTags
        },
        fields: {
          response_time: metrics.responseTime,
          cpu_usage: metrics.cpuUsage,
          memory_usage: metrics.memoryUsage,
          request_count: metrics.requestCount,
          error_count: metrics.errorCount,
          throughput: metrics.throughput,
          active_connections: metrics.activeConnections
        },
        timestamp: Date.now()
      };

      return await this.metricsIngestion.ingestPerformanceMetrics([point]);
    } catch (error) {
      logger.error('Error recording statistical metrics:', error);
      return false;
    }
  }

  // ============================================================================
  // THREAT DETECTION INTEGRATION
  // ============================================================================

  public async recordThreatEvent(
    ipAddress: string,
    threatType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    riskScore: number,
    additionalData: {
      sessionId?: string;
      userAgent?: string;
      country?: string;
      source?: string;
      confidence?: number;
      responseTime?: number;
      blocked?: boolean;
      threatCount?: number;
      falsePositive?: boolean;
      mitigationApplied?: boolean;
    } = {}
  ): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        logger.warn('InfluxDB integration not initialized, skipping threat recording');
        return false;
      }

      const point: ThreatDetectionPoint = {
        measurement: 'threat_detection',
        tags: {
          ip_address: ipAddress,
          threat_type: threatType,
          severity,
          source: additionalData.source || 'phantom_flow',
          session_id: additionalData.sessionId || 'unknown',
          user_agent: additionalData.userAgent || 'unknown',
          country: additionalData.country || 'unknown'
        },
        fields: {
          risk_score: riskScore,
          confidence: additionalData.confidence || 0.8,
          response_time: additionalData.responseTime || 0,
          blocked: additionalData.blocked || false,
          threat_count: additionalData.threatCount || 1,
          false_positive: additionalData.falsePositive || false,
          mitigation_applied: additionalData.mitigationApplied || false
        },
        timestamp: Date.now()
      };

      return await this.metricsIngestion.ingestThreatData([point]);
    } catch (error) {
      logger.error('Error recording threat event:', error);
      return false;
    }
  }

  // ============================================================================
  // BEHAVIORAL ANALYZER INTEGRATION
  // ============================================================================

  public async recordUserBehavior(
    sessionId: string,
    userType: 'anonymous' | 'authenticated' | 'admin',
    behaviorData: {
      actionCount: number;
      sessionDuration: number;
      pageViews: number;
      conversionRate: number;
      bounceRate: number;
      uniquePages: number;
      apiCalls: number;
    },
    additionalTags: Record<string, string> = {}
  ): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        logger.warn('InfluxDB integration not initialized, skipping behavior recording');
        return false;
      }

      const point: UserBehaviorPoint = {
        measurement: 'user_behavior',
        tags: {
          session_id: sessionId,
          user_type: userType,
          location: additionalTags.location || 'unknown',
          device_type: additionalTags.device_type || 'unknown',
          browser: additionalTags.browser || 'unknown',
          os: additionalTags.os || 'unknown',
          ...additionalTags
        },
        fields: {
          action_count: behaviorData.actionCount,
          session_duration: behaviorData.sessionDuration,
          page_views: behaviorData.pageViews,
          conversion_rate: behaviorData.conversionRate,
          bounce_rate: behaviorData.bounceRate,
          unique_pages: behaviorData.uniquePages,
          api_calls: behaviorData.apiCalls
        },
        timestamp: Date.now()
      };

      return await this.metricsIngestion.ingestUserBehavior([point]);
    } catch (error) {
      logger.error('Error recording user behavior:', error);
      return false;
    }
  }

  // ============================================================================
  // RATE LIMITING INTEGRATION
  // ============================================================================

  public async recordRateLimitEvent(
    ipAddress: string,
    endpoint: string,
    policyType: string,
    algorithm: string,
    rateLimitData: {
      requestsPerMinute: number;
      limitApplied: number;
      blockedRequests: number;
      allowedRequests: number;
      effectivenessScore: number;
      responseTime: number;
      policyViolations: number;
    },
    additionalTags: Record<string, string> = {}
  ): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        logger.warn('InfluxDB integration not initialized, skipping rate limit recording');
        return false;
      }

      const point: RateLimitPoint = {
        measurement: 'rate_limiting',
        tags: {
          ip_address: ipAddress,
          endpoint,
          user_id: additionalTags.user_id,
          policy_type: policyType,
          algorithm,
          country: additionalTags.country || 'unknown',
          ...additionalTags
        },
        fields: {
          requests_per_minute: rateLimitData.requestsPerMinute,
          limit_applied: rateLimitData.limitApplied,
          blocked_requests: rateLimitData.blockedRequests,
          allowed_requests: rateLimitData.allowedRequests,
          effectiveness_score: rateLimitData.effectivenessScore,
          response_time: rateLimitData.responseTime,
          policy_violations: rateLimitData.policyViolations
        },
        timestamp: Date.now()
      };

      return await this.metricsIngestion.ingestRateLimitData([point]);
    } catch (error) {
      logger.error('Error recording rate limit event:', error);
      return false;
    }
  }

  // ============================================================================
  // SYSTEM HEALTH INTEGRATION
  // ============================================================================

  public async recordSystemHealth(
    host: string,
    service: string,
    healthData: {
      uptime: number;
      cpuUsage: number;
      memoryUsage: number;
      diskUsage: number;
      networkIO: number;
      errorRate: number;
      warningCount: number;
      activeSessions: number;
    },
    additionalTags: Record<string, string> = {}
  ): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        logger.warn('InfluxDB integration not initialized, skipping system health recording');
        return false;
      }

      const point: SystemHealthPoint = {
        measurement: 'system_health',
        tags: {
          host,
          service,
          environment: additionalTags.environment || 'development',
          version: additionalTags.version || '1.0.0',
          ...additionalTags
        },
        fields: {
          uptime: healthData.uptime,
          cpu_usage: healthData.cpuUsage,
          memory_usage: healthData.memoryUsage,
          disk_usage: healthData.diskUsage,
          network_io: healthData.networkIO,
          error_rate: healthData.errorRate,
          warning_count: healthData.warningCount,
          active_sessions: healthData.activeSessions
        },
        timestamp: Date.now()
      };

      return await this.metricsIngestion.ingestSystemHealth([point]);
    } catch (error) {
      logger.error('Error recording system health:', error);
      return false;
    }
  }

  // ============================================================================
  // ANALYTICS AND REPORTING
  // ============================================================================

  public async getPerformanceReport(
    startTime?: Date,
    endTime?: Date
  ): Promise<any> {
    try {
      if (!this.isInitialized) {
        throw new Error('InfluxDB integration not initialized');
      }

      const options = {
        measurement: 'performance_metrics',
        startTime,
        endTime
      };

      return await this.historicalData.getPerformanceMetrics(options);
    } catch (error) {
      logger.error('Error getting performance report:', error);
      throw error;
    }
  }

  public async getThreatAnalytics(
    startTime?: Date,
    endTime?: Date
  ): Promise<any> {
    try {
      if (!this.isInitialized) {
        throw new Error('InfluxDB integration not initialized');
      }

      const options = {
        measurement: 'threat_detection',
        startTime,
        endTime
      };

      return await this.historicalData.getThreatAnalytics(options);
    } catch (error) {
      logger.error('Error getting threat analytics:', error);
      throw error;
    }
  }

  public async getRealTimeMetrics(measurement: string, lastMinutes: number = 5): Promise<any> {
    try {
      if (!this.isInitialized) {
        throw new Error('InfluxDB integration not initialized');
      }

      return await this.historicalData.getRealTimeData(measurement, lastMinutes);
    } catch (error) {
      logger.error('Error getting real-time metrics:', error);
      throw error;
    }
  }

  // ============================================================================
  // HEALTH AND STATUS
  // ============================================================================

  public async getHealthStatus(): Promise<InfluxDBHealthStatus> {
    try {
      return this.influxDB.getHealthStatus();
    } catch (error) {
      logger.error('Error getting InfluxDB health status:', error);
      return {
        connected: false,
        database: 'unknown',
        version: 'unknown',
        uptime: 0,
        lastError: {
          code: 'HEALTH_CHECK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          operation: 'getHealthStatus',
          retryable: true
        },
        connectionPool: {
          active: 0,
          idle: 0,
          total: 0
        },
        performance: {
          averageQueryTime: 0,
          averageWriteTime: 0,
          totalQueries: 0,
          totalWrites: 0
        }
      };
    }
  }

  public isReady(): boolean {
    return this.isInitialized && this.influxDB.isConnected();
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  public async flushMetrics(): Promise<void> {
    try {
      if (this.isInitialized) {
        await this.metricsIngestion.flush();
      }
    } catch (error) {
      logger.error('Error flushing metrics:', error);
    }
  }

  public getPendingMetricsCount(): number {
    return this.metricsIngestion.getPendingCount();
  }

  public async getStorageUsage(): Promise<any> {
    try {
      if (!this.isInitialized) {
        throw new Error('InfluxDB integration not initialized');
      }

      return await this.retentionService.getStorageUsage();
    } catch (error) {
      logger.error('Error getting storage usage:', error);
      throw error;
    }
  }

  public async checkStorageLimit(): Promise<any> {
    try {
      if (!this.isInitialized) {
        throw new Error('InfluxDB integration not initialized');
      }

      return await this.retentionService.checkStorageLimit();
    } catch (error) {
      logger.error('Error checking storage limit:', error);
      throw error;
    }
  }

  // ============================================================================
  // CONVENIENCE METHODS FOR COMMON OPERATIONS
  // ============================================================================

  public async recordRequestMetrics(
    endpoint: string,
    method: string,
    responseTime: number,
    statusCode: number,
    additionalData: Record<string, any> = {}
  ): Promise<boolean> {
    return await this.recordStatisticalMetrics(
      process.env.HOSTNAME || 'localhost',
      'phantom-flow',
      {
        responseTime,
        cpuUsage: additionalData.cpuUsage || 0,
        memoryUsage: additionalData.memoryUsage || 0,
        requestCount: 1,
        errorCount: statusCode >= 400 ? 1 : 0,
        throughput: 1,
        activeConnections: additionalData.activeConnections || 0
      },
      {
        endpoint,
        method,
        status_code: statusCode.toString(),
        user_type: additionalData.userType || 'unknown'
      }
    );
  }

  public async recordThreatDetection(
    ipAddress: string,
    riskScore: number,
    threatType: string = 'unknown',
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    additionalData: Record<string, any> = {}
  ): Promise<boolean> {
    return await this.recordThreatEvent(
      ipAddress,
      threatType,
      severity,
      riskScore,
      {
        sessionId: additionalData.sessionId,
        userAgent: additionalData.userAgent,
        country: additionalData.country,
        source: additionalData.source,
        confidence: additionalData.confidence,
        responseTime: additionalData.responseTime,
        blocked: additionalData.blocked,
        threatCount: additionalData.threatCount,
        falsePositive: additionalData.falsePositive,
        mitigationApplied: additionalData.mitigationApplied
      }
    );
  }
}
