/**
 * InfluxDB Integration Type Definitions
 * Comprehensive interfaces for time-series data management
 */

// ============================================================================
// CORE CONFIGURATION INTERFACES
// ============================================================================

export interface InfluxDBConfig {
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  protocol: 'http' | 'https';
  timeout: number;
  poolSize: number;
  retryAttempts: number;
  retryDelay: number;
  precision: 'ns' | 'u' | 'ms' | 's' | 'm' | 'h';
  consistency: 'one' | 'quorum' | 'all' | 'any';
}

export interface InfluxDBConnectionOptions {
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  protocol?: 'http' | 'https';
  timeout?: number;
  poolSize?: number;
}

// ============================================================================
// TIME-SERIES DATA POINT INTERFACES
// ============================================================================

export interface TimeSeriesPoint {
  measurement: string;
  tags: Record<string, string>;
  fields: Record<string, number | string | boolean>;
  timestamp?: number | Date;
}

export interface InfluxDBWriteOptions {
  precision?: 'ns' | 'u' | 'ms' | 's' | 'm' | 'h';
  consistency?: 'one' | 'quorum' | 'all' | 'any';
  retentionPolicy?: string;
  database?: string;
}

export interface InfluxDBWriteResult {
  success: boolean;
  pointsWritten: number;
  errors: string[];
  latency: number;
}

// ============================================================================
// METRICS DATA MODELS
// ============================================================================

export interface PerformanceMetricsPoint {
  measurement: 'performance_metrics';
  tags: {
    host: string;
    service: string;
    endpoint: string;
    method: string;
    status_code: string;
    user_type?: string;
  };
  fields: {
    response_time: number;
    cpu_usage: number;
    memory_usage: number;
    request_count: number;
    error_count: number;
    throughput: number;
    active_connections: number;
  };
  timestamp?: number | Date;
}

export interface ThreatDetectionPoint {
  measurement: 'threat_detection';
  tags: {
    ip_address: string;
    threat_type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    source: string;
    session_id?: string;
    user_agent?: string;
    country?: string;
  };
  fields: {
    risk_score: number;
    confidence: number;
    response_time: number;
    blocked: boolean;
    threat_count: number;
    false_positive: boolean;
    mitigation_applied: boolean;
  };
  timestamp?: number | Date;
}

export interface UserBehaviorPoint {
  measurement: 'user_behavior';
  tags: {
    session_id: string;
    user_type: 'anonymous' | 'authenticated' | 'admin';
    location: string;
    device_type: string;
    browser: string;
    os: string;
  };
  fields: {
    action_count: number;
    session_duration: number;
    page_views: number;
    conversion_rate: number;
    bounce_rate: number;
    unique_pages: number;
    api_calls: number;
  };
  timestamp?: number | Date;
}

export interface SystemHealthPoint {
  measurement: 'system_health';
  tags: {
    host: string;
    service: string;
    environment: string;
    version: string;
  };
  fields: {
    uptime: number;
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    network_io: number;
    error_rate: number;
    warning_count: number;
    active_sessions: number;
  };
  timestamp?: number | Date;
}

export interface RateLimitPoint {
  measurement: 'rate_limiting';
  tags: {
    ip_address: string;
    endpoint: string;
    user_id?: string;
    policy_type: string;
    algorithm: string;
    country?: string;
  };
  fields: {
    requests_per_minute: number;
    limit_applied: number;
    blocked_requests: number;
    allowed_requests: number;
    effectiveness_score: number;
    response_time: number;
    policy_violations: number;
  };
  timestamp?: number | Date;
}

// ============================================================================
// QUERY INTERFACES
// ============================================================================

export interface QueryOptions {
  measurement: string;
  startTime?: string | Date;
  endTime?: string | Date;
  tags?: Record<string, string>;
  fields?: string[];
  groupBy?: string[];
  aggregation?: AggregationFunction;
  limit?: number;
  offset?: number;
  orderBy?: 'ASC' | 'DESC';
  fill?: 'none' | 'null' | 'previous' | 'linear' | '0';
}

export interface AggregationFunction {
  function: 'mean' | 'sum' | 'count' | 'min' | 'max' | 'median' | 'percentile';
  field: string;
  percentile?: number; // For percentile function
  groupByTime?: string; // e.g., '1m', '5m', '1h', '1d'
}

export interface InfluxDBQueryResult {
  success: boolean;
  data: TimeSeriesPoint[];
  count: number;
  executionTime: number;
  error?: string;
}

export interface TimeSeriesQuery {
  measurement: string;
  timeRange: {
    start: string | Date;
    end: string | Date;
  };
  filters: {
    tags?: Record<string, string>;
    fields?: string[];
  };
  aggregation?: AggregationFunction;
  groupBy?: string[];
  limit?: number;
}

// ============================================================================
// RETENTION POLICY INTERFACES
// ============================================================================

export interface RetentionPolicy {
  name: string;
  duration: string; // e.g., '7d', '30d', '1y'
  replication: number;
  shardDuration?: string;
  default?: boolean;
  description?: string;
}

export interface DataRetentionConfig {
  policies: {
    raw_data: RetentionPolicy;
    hourly_aggregates: RetentionPolicy;
    daily_aggregates: RetentionPolicy;
    monthly_aggregates: RetentionPolicy;
    threat_data: RetentionPolicy;
  };
  cleanupSchedule: string; // Cron expression
  archiveBeforeDelete: boolean;
  maxStorageSize: string; // e.g., '10GB', '100GB'
}

// ============================================================================
// ANALYTICS AND REPORTING INTERFACES
// ============================================================================

export interface TimeSeriesAnalytics {
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  changeRate: number; // Percentage change
  average: number;
  median: number;
  min: number;
  max: number;
  percentile95: number;
  dataPoints: number;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface PerformanceReport {
  timeRange: {
    start: Date;
    end: Date;
  };
  metrics: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number;
    errorRate: number;
    uptime: number;
  };
  trends: {
    responseTime: TimeSeriesAnalytics;
    throughput: TimeSeriesAnalytics;
    errorRate: TimeSeriesAnalytics;
  };
  topEndpoints: Array<{
    endpoint: string;
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
  }>;
}

export interface ThreatAnalytics {
  timeRange: {
    start: Date;
    end: Date;
  };
  summary: {
    totalThreats: number;
    blockedThreats: number;
    falsePositives: number;
    averageRiskScore: number;
    topThreatTypes: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
  };
  trends: {
    threatCount: TimeSeriesAnalytics;
    riskScore: TimeSeriesAnalytics;
    blockedRate: TimeSeriesAnalytics;
  };
  geographicDistribution: Array<{
    country: string;
    threatCount: number;
    averageRiskScore: number;
  }>;
}

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

export interface InfluxDBServiceInterface {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  write(points: TimeSeriesPoint[], options?: InfluxDBWriteOptions): Promise<InfluxDBWriteResult>;
  query(query: string): Promise<InfluxDBQueryResult>;
  queryTimeSeries(options: QueryOptions): Promise<InfluxDBQueryResult>;
  createRetentionPolicy(policy: RetentionPolicy): Promise<boolean>;
  getRetentionPolicies(): Promise<RetentionPolicy[]>;
  healthCheck(): Promise<boolean>;
}

export interface MetricsIngestionInterface {
  ingestPerformanceMetrics(data: PerformanceMetricsPoint[]): Promise<boolean>;
  ingestThreatData(data: ThreatDetectionPoint[]): Promise<boolean>;
  ingestUserBehavior(data: UserBehaviorPoint[]): Promise<boolean>;
  ingestSystemHealth(data: SystemHealthPoint[]): Promise<boolean>;
  ingestRateLimitData(data: RateLimitPoint[]): Promise<boolean>;
  batchIngest(points: TimeSeriesPoint[]): Promise<InfluxDBWriteResult>;
}

export interface HistoricalDataInterface {
  getPerformanceMetrics(options: QueryOptions): Promise<PerformanceReport>;
  getThreatAnalytics(options: QueryOptions): Promise<ThreatAnalytics>;
  getTimeSeriesData(query: TimeSeriesQuery): Promise<InfluxDBQueryResult>;
  getAggregatedData(options: QueryOptions): Promise<InfluxDBQueryResult>;
  getRealTimeData(measurement: string, lastMinutes: number): Promise<InfluxDBQueryResult>;
}

// ============================================================================
// ERROR HANDLING INTERFACES
// ============================================================================

export interface InfluxDBError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  operation: string;
  retryable: boolean;
}

export interface InfluxDBHealthStatus {
  connected: boolean;
  database: string;
  version: string;
  uptime: number;
  lastError?: InfluxDBError;
  connectionPool: {
    active: number;
    idle: number;
    total: number;
  };
  performance: {
    averageQueryTime: number;
    averageWriteTime: number;
    totalQueries: number;
    totalWrites: number;
  };
}

// ============================================================================
// CONFIGURATION ENVIRONMENT VARIABLES
// ============================================================================

export interface InfluxDBEnvironmentConfig {
  INFLUXDB_HOST: string;
  INFLUXDB_PORT: number;
  INFLUXDB_DATABASE: string;
  INFLUXDB_USERNAME?: string;
  INFLUXDB_PASSWORD?: string;
  INFLUXDB_PROTOCOL: 'http' | 'https';
  INFLUXDB_TIMEOUT: number;
  INFLUXDB_POOL_SIZE: number;
  INFLUXDB_RETRY_ATTEMPTS: number;
  INFLUXDB_RETRY_DELAY: number;
  INFLUXDB_PRECISION: 'ns' | 'u' | 'ms' | 's' | 'm' | 'h';
  INFLUXDB_CONSISTENCY: 'one' | 'quorum' | 'all' | 'any';
  INFLUXDB_RETENTION_RAW: string;
  INFLUXDB_RETENTION_HOURLY: string;
  INFLUXDB_RETENTION_DAILY: string;
  INFLUXDB_RETENTION_MONTHLY: string;
  INFLUXDB_RETENTION_THREAT: string;
  INFLUXDB_CLEANUP_SCHEDULE: string;
  INFLUXDB_ARCHIVE_BEFORE_DELETE: boolean;
  INFLUXDB_MAX_STORAGE_SIZE: string;
}
