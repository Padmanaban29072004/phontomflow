/**
 * InfluxDB Configuration Management
 * Centralized configuration for InfluxDB connection and settings
 */

import { InfluxDBConfig, DataRetentionConfig, RetentionPolicy } from '@/types/influxdb';

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const defaultInfluxDBConfig: InfluxDBConfig = {
  host: process.env.INFLUXDB_HOST || 'localhost',
  port: parseInt(process.env.INFLUXDB_PORT || '8086'),
  database: process.env.INFLUXDB_DATABASE || 'phantom_flow',
  username: process.env.INFLUXDB_USERNAME,
  password: process.env.INFLUXDB_PASSWORD,
  protocol: (process.env.INFLUXDB_PROTOCOL as 'http' | 'https') || 'http',
  timeout: parseInt(process.env.INFLUXDB_TIMEOUT || '30000'),
  poolSize: parseInt(process.env.INFLUXDB_POOL_SIZE || '10'),
  retryAttempts: parseInt(process.env.INFLUXDB_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.INFLUXDB_RETRY_DELAY || '1000'),
  precision: (process.env.INFLUXDB_PRECISION as 'ns' | 'u' | 'ms' | 's' | 'm' | 'h') || 'ms',
  consistency: (process.env.INFLUXDB_CONSISTENCY as 'one' | 'quorum' | 'all' | 'any') || 'one'
};

// ============================================================================
// RETENTION POLICIES CONFIGURATION
// ============================================================================

export const retentionPolicies: DataRetentionConfig = {
  policies: {
    raw_data: {
      name: 'raw_data',
      duration: process.env.INFLUXDB_RETENTION_RAW || '7d',
      replication: 1,
      shardDuration: '1h',
      default: true,
      description: 'Raw data retention for 7 days with 1-hour shards'
    },
    hourly_aggregates: {
      name: 'hourly_aggregates',
      duration: process.env.INFLUXDB_RETENTION_HOURLY || '30d',
      replication: 1,
      shardDuration: '1d',
      default: false,
      description: 'Hourly aggregated data retention for 30 days'
    },
    daily_aggregates: {
      name: 'daily_aggregates',
      duration: process.env.INFLUXDB_RETENTION_DAILY || '1y',
      replication: 1,
      shardDuration: '7d',
      default: false,
      description: 'Daily aggregated data retention for 1 year'
    },
    monthly_aggregates: {
      name: 'monthly_aggregates',
      duration: process.env.INFLUXDB_RETENTION_MONTHLY || '5y',
      replication: 1,
      shardDuration: '30d',
      default: false,
      description: 'Monthly aggregated data retention for 5 years'
    },
    threat_data: {
      name: 'threat_data',
      duration: process.env.INFLUXDB_RETENTION_THREAT || '2y',
      replication: 1,
      shardDuration: '1d',
      default: false,
      description: 'Threat detection data retention for 2 years (compliance)'
    }
  },
  cleanupSchedule: process.env.INFLUXDB_CLEANUP_SCHEDULE || '0 2 * * *', // Daily at 2 AM
  archiveBeforeDelete: process.env.INFLUXDB_ARCHIVE_BEFORE_DELETE === 'true',
  maxStorageSize: process.env.INFLUXDB_MAX_STORAGE_SIZE || '10GB'
};

// ============================================================================
// MEASUREMENT CONFIGURATIONS
// ============================================================================

export const measurementConfigs = {
  performance_metrics: {
    name: 'performance_metrics',
    retentionPolicy: 'raw_data',
    tags: ['host', 'service', 'endpoint', 'method', 'status_code', 'user_type'],
    fields: ['response_time', 'cpu_usage', 'memory_usage', 'request_count', 'error_count', 'throughput', 'active_connections'],
    description: 'Performance metrics for system monitoring'
  },
  threat_detection: {
    name: 'threat_detection',
    retentionPolicy: 'threat_data',
    tags: ['ip_address', 'threat_type', 'severity', 'source', 'session_id', 'user_agent', 'country'],
    fields: ['risk_score', 'confidence', 'response_time', 'blocked', 'threat_count', 'false_positive', 'mitigation_applied'],
    description: 'Threat detection and security events'
  },
  user_behavior: {
    name: 'user_behavior',
    retentionPolicy: 'raw_data',
    tags: ['session_id', 'user_type', 'location', 'device_type', 'browser', 'os'],
    fields: ['action_count', 'session_duration', 'page_views', 'conversion_rate', 'bounce_rate', 'unique_pages', 'api_calls'],
    description: 'User behavior and session analytics'
  },
  system_health: {
    name: 'system_health',
    retentionPolicy: 'raw_data',
    tags: ['host', 'service', 'environment', 'version'],
    fields: ['uptime', 'cpu_usage', 'memory_usage', 'disk_usage', 'network_io', 'error_rate', 'warning_count', 'active_sessions'],
    description: 'System health and infrastructure metrics'
  },
  rate_limiting: {
    name: 'rate_limiting',
    retentionPolicy: 'raw_data',
    tags: ['ip_address', 'endpoint', 'user_id', 'policy_type', 'algorithm', 'country'],
    fields: ['requests_per_minute', 'limit_applied', 'blocked_requests', 'allowed_requests', 'effectiveness_score', 'response_time', 'policy_violations'],
    description: 'Rate limiting and traffic control metrics'
  }
};

// ============================================================================
// QUERY TEMPLATES
// ============================================================================

export const queryTemplates = {
  // Performance metrics queries
  performanceMetrics: {
    averageResponseTime: `
      SELECT mean(response_time) as avg_response_time 
      FROM performance_metrics 
      WHERE time >= $startTime AND time <= $endTime
      GROUP BY time($interval), endpoint
    `,
    throughput: `
      SELECT sum(request_count) as total_requests 
      FROM performance_metrics 
      WHERE time >= $startTime AND time <= $endTime
      GROUP BY time($interval)
    `,
    errorRate: `
      SELECT (sum(error_count) / sum(request_count)) * 100 as error_rate 
      FROM performance_metrics 
      WHERE time >= $startTime AND time <= $endTime
      GROUP BY time($interval)
    `,
    topEndpoints: `
      SELECT endpoint, sum(request_count) as total_requests, mean(response_time) as avg_response_time
      FROM performance_metrics 
      WHERE time >= $startTime AND time <= $endTime
      GROUP BY endpoint
      ORDER BY total_requests DESC
      LIMIT $limit
    `
  },

  // Threat detection queries
  threatDetection: {
    threatCount: `
      SELECT count(*) as threat_count 
      FROM threat_detection 
      WHERE time >= $startTime AND time <= $endTime
      GROUP BY time($interval), threat_type
    `,
    riskScoreTrend: `
      SELECT mean(risk_score) as avg_risk_score 
      FROM threat_detection 
      WHERE time >= $startTime AND time <= $endTime
      GROUP BY time($interval)
    `,
    blockedThreats: `
      SELECT count(*) as blocked_count 
      FROM threat_detection 
      WHERE time >= $startTime AND time <= $endTime AND blocked = true
      GROUP BY time($interval)
    `,
    topThreatTypes: `
      SELECT threat_type, count(*) as count 
      FROM threat_detection 
      WHERE time >= $startTime AND time <= $endTime
      GROUP BY threat_type
      ORDER BY count DESC
      LIMIT $limit
    `,
    geographicDistribution: `
      SELECT country, count(*) as threat_count, mean(risk_score) as avg_risk_score
      FROM threat_detection 
      WHERE time >= $startTime AND time <= $endTime
      GROUP BY country
      ORDER BY threat_count DESC
    `
  },

  // User behavior queries
  userBehavior: {
    sessionMetrics: `
      SELECT mean(session_duration) as avg_duration, sum(page_views) as total_views
      FROM user_behavior 
      WHERE time >= $startTime AND time <= $endTime
      GROUP BY time($interval)
    `,
    conversionRate: `
      SELECT mean(conversion_rate) as avg_conversion_rate 
      FROM user_behavior 
      WHERE time >= $startTime AND time <= $endTime
      GROUP BY time($interval)
    `,
    userTypes: `
      SELECT user_type, count(*) as user_count, mean(session_duration) as avg_duration
      FROM user_behavior 
      WHERE time >= $startTime AND time <= $endTime
      GROUP BY user_type
    `
  },

  // System health queries
  systemHealth: {
    uptime: `
      SELECT last(uptime) as current_uptime 
      FROM system_health 
      WHERE time >= $startTime AND time <= $endTime
      GROUP BY host
    `,
    resourceUsage: `
      SELECT mean(cpu_usage) as avg_cpu, mean(memory_usage) as avg_memory, mean(disk_usage) as avg_disk
      FROM system_health 
      WHERE time >= $startTime AND time <= $endTime
      GROUP BY time($interval), host
    `,
    errorRate: `
      SELECT mean(error_rate) as avg_error_rate 
      FROM system_health 
      WHERE time >= $startTime AND time <= $endTime
      GROUP BY time($interval), host
    `
  },

  // Rate limiting queries
  rateLimiting: {
    effectiveness: `
      SELECT mean(effectiveness_score) as avg_effectiveness 
      FROM rate_limiting 
      WHERE time >= $startTime AND time <= $endTime
      GROUP BY time($interval), policy_type
    `,
    blockedRequests: `
      SELECT sum(blocked_requests) as total_blocked 
      FROM rate_limiting 
      WHERE time >= $startTime AND time <= $endTime
      GROUP BY time($interval)
    `,
    policyViolations: `
      SELECT sum(policy_violations) as total_violations 
      FROM rate_limiting 
      WHERE time >= $startTime AND time <= $endTime
      GROUP BY time($interval), policy_type
    `
  }
};

// ============================================================================
// AGGREGATION CONFIGURATIONS
// ============================================================================

export const aggregationConfigs = {
  timeIntervals: {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '1h': '1h',
    '6h': '6h',
    '1d': '1d',
    '1w': '1w',
    '1M': '1M'
  },
  functions: {
    mean: 'mean',
    sum: 'sum',
    count: 'count',
    min: 'min',
    max: 'max',
    median: 'median',
    percentile95: 'percentile',
    percentile99: 'percentile'
  },
  fillOptions: {
    none: 'none',
    null: 'null',
    previous: 'previous',
    linear: 'linear',
    zero: '0'
  }
};

// ============================================================================
// CONFIGURATION VALIDATION
// ============================================================================

export function validateInfluxDBConfig(config: InfluxDBConfig): string[] {
  const errors: string[] = [];

  if (!config.host) {
    errors.push('InfluxDB host is required');
  }

  if (!config.port || config.port < 1 || config.port > 65535) {
    errors.push('InfluxDB port must be between 1 and 65535');
  }

  if (!config.database) {
    errors.push('InfluxDB database name is required');
  }

  if (config.timeout < 1000) {
    errors.push('InfluxDB timeout should be at least 1000ms');
  }

  if (config.poolSize < 1) {
    errors.push('InfluxDB pool size should be at least 1');
  }

  if (config.retryAttempts < 0) {
    errors.push('InfluxDB retry attempts should be non-negative');
  }

  if (config.retryDelay < 0) {
    errors.push('InfluxDB retry delay should be non-negative');
  }

  const validPrecisions = ['ns', 'u', 'ms', 's', 'm', 'h'];
  if (!validPrecisions.includes(config.precision)) {
    errors.push(`InfluxDB precision must be one of: ${validPrecisions.join(', ')}`);
  }

  const validConsistencies = ['one', 'quorum', 'all', 'any'];
  if (!validConsistencies.includes(config.consistency)) {
    errors.push(`InfluxDB consistency must be one of: ${validConsistencies.join(', ')}`);
  }

  return errors;
}

// ============================================================================
// CONFIGURATION HELPERS
// ============================================================================

export function getInfluxDBConfig(): InfluxDBConfig {
  return { ...defaultInfluxDBConfig };
}

export function getRetentionPolicy(policyName: keyof typeof retentionPolicies.policies): RetentionPolicy {
  return retentionPolicies.policies[policyName];
}

export function getAllRetentionPolicies(): RetentionPolicy[] {
  return Object.values(retentionPolicies.policies);
}

export function getMeasurementConfig(measurementName: string) {
  return measurementConfigs[measurementName as keyof typeof measurementConfigs];
}

export function getQueryTemplate(category: string, queryName: string): string {
  const categoryQueries = queryTemplates[category as keyof typeof queryTemplates];
  if (!categoryQueries) {
    throw new Error(`Query category '${category}' not found`);
  }
  
  const query = categoryQueries[queryName as keyof typeof categoryQueries];
  if (!query) {
    throw new Error(`Query '${queryName}' not found in category '${category}'`);
  }
  
  return query;
}

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

export function loadInfluxDBConfigFromEnv(): InfluxDBConfig {
  return {
    host: process.env.INFLUXDB_HOST || 'localhost',
    port: parseInt(process.env.INFLUXDB_PORT || '8086'),
    database: process.env.INFLUXDB_DATABASE || 'phantom_flow',
    username: process.env.INFLUXDB_USERNAME,
    password: process.env.INFLUXDB_PASSWORD,
    protocol: (process.env.INFLUXDB_PROTOCOL as 'http' | 'https') || 'http',
    timeout: parseInt(process.env.INFLUXDB_TIMEOUT || '30000'),
    poolSize: parseInt(process.env.INFLUXDB_POOL_SIZE || '10'),
    retryAttempts: parseInt(process.env.INFLUXDB_RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(process.env.INFLUXDB_RETRY_DELAY || '1000'),
    precision: (process.env.INFLUXDB_PRECISION as 'ns' | 'u' | 'ms' | 's' | 'm' | 'h') || 'ms',
    consistency: (process.env.INFLUXDB_CONSISTENCY as 'one' | 'quorum' | 'all' | 'any') || 'one'
  };
}
