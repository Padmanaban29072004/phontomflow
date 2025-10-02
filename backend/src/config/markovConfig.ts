import {
  MarkovChainConfig,
  MarkovManagerConfig,
  MarkovOrder,
  StateCompressionConfig
} from '@/types/markov';

/**
 * Environment-based configuration for Markov Chain system
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Default Markov Chain configuration
 */
export function getDefaultMarkovChainConfig(): MarkovChainConfig {
  return {
    order: 2, // 2nd order for better accuracy
    smoothingParameter: parseFloat(process.env.MARKOV_SMOOTHING_PARAMETER || '1.0'),
    pruningThreshold: parseInt(process.env.MARKOV_PRUNING_THRESHOLD || '5'),
    maxStates: parseInt(process.env.MARKOV_MAX_STATES || '10000'),
    memoryLimit: parseInt(process.env.MARKOV_MEMORY_LIMIT || '100') * 1024 * 1024, // MB to bytes
    persistenceInterval: parseInt(process.env.MARKOV_PERSISTENCE_INTERVAL || '300000'), // 5 minutes
    stateExpiryHours: parseInt(process.env.MARKOV_STATE_EXPIRY_HOURS || '168'), // 7 days
    minConfidenceThreshold: parseFloat(process.env.MARKOV_MIN_CONFIDENCE || '0.3')
  };
}

/**
 * High-accuracy Markov Chain configuration (3rd order)
 */
export function getHighAccuracyMarkovConfig(): MarkovChainConfig {
  const base = getDefaultMarkovChainConfig();
  return {
    ...base,
    order: 3,
    smoothingParameter: parseFloat(process.env.MARKOV_HA_SMOOTHING || '0.5'),
    pruningThreshold: parseInt(process.env.MARKOV_HA_PRUNING_THRESHOLD || '10'),
    maxStates: parseInt(process.env.MARKOV_HA_MAX_STATES || '50000'),
    memoryLimit: parseInt(process.env.MARKOV_HA_MEMORY_LIMIT || '500') * 1024 * 1024,
    minConfidenceThreshold: parseFloat(process.env.MARKOV_HA_MIN_CONFIDENCE || '0.5')
  };
}

/**
 * Memory-efficient Markov Chain configuration (1st order)
 */
export function getMemoryEfficientMarkovConfig(): MarkovChainConfig {
  const base = getDefaultMarkovChainConfig();
  return {
    ...base,
    order: 1,
    smoothingParameter: parseFloat(process.env.MARKOV_ME_SMOOTHING || '2.0'),
    pruningThreshold: parseInt(process.env.MARKOV_ME_PRUNING_THRESHOLD || '3'),
    maxStates: parseInt(process.env.MARKOV_ME_MAX_STATES || '5000'),
    memoryLimit: parseInt(process.env.MARKOV_ME_MEMORY_LIMIT || '50') * 1024 * 1024,
    persistenceInterval: parseInt(process.env.MARKOV_ME_PERSISTENCE_INTERVAL || '600000'), // 10 minutes
    minConfidenceThreshold: parseFloat(process.env.MARKOV_ME_MIN_CONFIDENCE || '0.2')
  };
}

/**
 * Development Markov Chain configuration
 */
export function getDevelopmentMarkovConfig(): MarkovChainConfig {
  const base = getDefaultMarkovChainConfig();
  return {
    ...base,
    order: 2,
    pruningThreshold: parseInt(process.env.MARKOV_DEV_PRUNING_THRESHOLD || '2'),
    maxStates: parseInt(process.env.MARKOV_DEV_MAX_STATES || '1000'),
    memoryLimit: parseInt(process.env.MARKOV_DEV_MEMORY_LIMIT || '20') * 1024 * 1024,
    persistenceInterval: parseInt(process.env.MARKOV_DEV_PERSISTENCE_INTERVAL || '60000'), // 1 minute
    stateExpiryHours: parseInt(process.env.MARKOV_DEV_STATE_EXPIRY_HOURS || '24'), // 1 day
    minConfidenceThreshold: parseFloat(process.env.MARKOV_DEV_MIN_CONFIDENCE || '0.1')
  };
}

/**
 * Security-focused Markov Chain configuration
 */
export function getSecurityMarkovConfig(): MarkovChainConfig {
  const base = getDefaultMarkovChainConfig();
  return {
    ...base,
    order: 2,
    smoothingParameter: parseFloat(process.env.MARKOV_SEC_SMOOTHING || '0.1'), // Less smoothing for anomaly detection
    pruningThreshold: parseInt(process.env.MARKOV_SEC_PRUNING_THRESHOLD || '1'), // Keep more rare patterns
    maxStates: parseInt(process.env.MARKOV_SEC_MAX_STATES || '20000'),
    memoryLimit: parseInt(process.env.MARKOV_SEC_MEMORY_LIMIT || '200') * 1024 * 1024,
    persistenceInterval: parseInt(process.env.MARKOV_SEC_PERSISTENCE_INTERVAL || '180000'), // 3 minutes
    stateExpiryHours: parseInt(process.env.MARKOV_SEC_STATE_EXPIRY_HOURS || '336'), // 14 days
    minConfidenceThreshold: parseFloat(process.env.MARKOV_SEC_MIN_CONFIDENCE || '0.05') // Lower threshold for security
  };
}

/**
 * Real-time Markov Chain configuration
 */
export function getRealTimeMarkovConfig(): MarkovChainConfig {
  const base = getDefaultMarkovChainConfig();
  return {
    ...base,
    order: 1, // Faster processing
    smoothingParameter: parseFloat(process.env.MARKOV_RT_SMOOTHING || '1.5'),
    pruningThreshold: parseInt(process.env.MARKOV_RT_PRUNING_THRESHOLD || '10'),
    maxStates: parseInt(process.env.MARKOV_RT_MAX_STATES || '5000'),
    memoryLimit: parseInt(process.env.MARKOV_RT_MEMORY_LIMIT || '100') * 1024 * 1024,
    persistenceInterval: parseInt(process.env.MARKOV_RT_PERSISTENCE_INTERVAL || '30000'), // 30 seconds
    stateExpiryHours: parseInt(process.env.MARKOV_RT_STATE_EXPIRY_HOURS || '72'), // 3 days
    minConfidenceThreshold: parseFloat(process.env.MARKOV_RT_MIN_CONFIDENCE || '0.4')
  };
}

/**
 * State compression configuration
 */
export function getStateCompressionConfig(): StateCompressionConfig {
  return {
    enabled: process.env.MARKOV_COMPRESSION_ENABLED === 'true',
    compressionRatio: parseFloat(process.env.MARKOV_COMPRESSION_RATIO || '0.7'),
    preserveImportantStates: process.env.MARKOV_PRESERVE_IMPORTANT === 'true',
    importanceThreshold: parseFloat(process.env.MARKOV_IMPORTANCE_THRESHOLD || '5'),
    compressionAlgorithm: (process.env.MARKOV_COMPRESSION_ALGORITHM as any) || 'hybrid'
  };
}

/**
 * Markov Manager configuration
 */
export function getMarkovManagerConfig(): MarkovManagerConfig {
  return {
    chains: [
      {
        name: 'primary',
        order: 2,
        config: getDefaultMarkovChainConfig(),
        enabled: process.env.MARKOV_PRIMARY_ENABLED !== 'false'
      },
      {
        name: 'security',
        order: 2,
        config: getSecurityMarkovConfig(),
        enabled: process.env.MARKOV_SECURITY_ENABLED === 'true'
      },
      {
        name: 'realtime',
        order: 1,
        config: getRealTimeMarkovConfig(),
        enabled: process.env.MARKOV_REALTIME_ENABLED === 'true'
      }
    ],
    globalConfig: {
      maxMemoryUsage: parseInt(process.env.MARKOV_GLOBAL_MEMORY_LIMIT || '1000') * 1024 * 1024, // 1GB default
      persistenceInterval: parseInt(process.env.MARKOV_GLOBAL_PERSISTENCE_INTERVAL || '300000'), // 5 minutes
      cleanupInterval: parseInt(process.env.MARKOV_GLOBAL_CLEANUP_INTERVAL || '3600000'), // 1 hour
      enableMetrics: process.env.MARKOV_ENABLE_METRICS !== 'false',
      enableAnalytics: process.env.MARKOV_ENABLE_ANALYTICS !== 'false',
      enableRealTimeUpdates: process.env.MARKOV_ENABLE_REALTIME_UPDATES !== 'false'
    },
    anomalyDetection: {
      enabled: process.env.MARKOV_ANOMALY_DETECTION_ENABLED !== 'false',
      thresholds: {
        sequenceAnomaly: parseFloat(process.env.MARKOV_SEQUENCE_ANOMALY_THRESHOLD || '0.7'),
        transitionAnomaly: parseFloat(process.env.MARKOV_TRANSITION_ANOMALY_THRESHOLD || '0.8'),
        timingAnomaly: parseFloat(process.env.MARKOV_TIMING_ANOMALY_THRESHOLD || '0.6')
      },
      alerting: {
        enabled: process.env.MARKOV_ALERTING_ENABLED === 'true',
        severityThreshold: (process.env.MARKOV_ALERT_SEVERITY_THRESHOLD as any) || 'high'
      }
    },
    integration: {
      behavioralAnalyzer: process.env.MARKOV_INTEGRATION_BEHAVIORAL !== 'false',
      threatDetection: process.env.MARKOV_INTEGRATION_THREAT !== 'false',
      riskScoring: process.env.MARKOV_INTEGRATION_RISK !== 'false',
      userProfiling: process.env.MARKOV_INTEGRATION_PROFILING === 'true'
    }
  };
}

/**
 * Get appropriate Markov configuration based on environment and use case
 */
export function getMarkovConfiguration(useCase?: 'default' | 'high-accuracy' | 'memory-efficient' | 'security' | 'realtime'): MarkovChainConfig {
  // Environment-based defaults
  if (isDevelopment) {
    return getDevelopmentMarkovConfig();
  }

  // Use case specific configurations
  switch (useCase) {
    case 'high-accuracy':
      return getHighAccuracyMarkovConfig();
    case 'memory-efficient':
      return getMemoryEfficientMarkovConfig();
    case 'security':
      return getSecurityMarkovConfig();
    case 'realtime':
      return getRealTimeMarkovConfig();
    case 'default':
    default:
      return getDefaultMarkovChainConfig();
  }
}

/**
 * Anomaly detection thresholds configuration
 */
export function getAnomalyThresholds(): {
  sequenceAnomaly: number;
  transitionAnomaly: number;
  timingAnomaly: number;
} {
  return {
    sequenceAnomaly: parseFloat(process.env.MARKOV_SEQUENCE_ANOMALY_THRESHOLD || '0.7'),
    transitionAnomaly: parseFloat(process.env.MARKOV_TRANSITION_ANOMALY_THRESHOLD || '0.8'),
    timingAnomaly: parseFloat(process.env.MARKOV_TIMING_ANOMALY_THRESHOLD || '0.6')
  };
}

/**
 * Performance tuning configuration
 */
export function getPerformanceTuningConfig(): {
  enableCaching: boolean;
  cacheSize: number;
  batchSize: number;
  maxConcurrentAnalysis: number;
  enableParallelProcessing: boolean;
} {
  return {
    enableCaching: process.env.MARKOV_ENABLE_CACHING !== 'false',
    cacheSize: parseInt(process.env.MARKOV_CACHE_SIZE || '1000'),
    batchSize: parseInt(process.env.MARKOV_BATCH_SIZE || '100'),
    maxConcurrentAnalysis: parseInt(process.env.MARKOV_MAX_CONCURRENT || '10'),
    enableParallelProcessing: process.env.MARKOV_ENABLE_PARALLEL !== 'false'
  };
}

/**
 * Logging and monitoring configuration
 */
export function getLoggingConfig(): {
  enableDebugLogs: boolean;
  enablePerformanceLogs: boolean;
  enableAnomalyLogs: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableMetrics: boolean;
  metricsInterval: number;
} {
  return {
    enableDebugLogs: process.env.MARKOV_DEBUG_LOGS === 'true' || isDevelopment,
    enablePerformanceLogs: process.env.MARKOV_PERFORMANCE_LOGS !== 'false',
    enableAnomalyLogs: process.env.MARKOV_ANOMALY_LOGS !== 'false',
    logLevel: (process.env.MARKOV_LOG_LEVEL as any) || (isDevelopment ? 'debug' : 'info'),
    enableMetrics: process.env.MARKOV_ENABLE_METRICS !== 'false',
    metricsInterval: parseInt(process.env.MARKOV_METRICS_INTERVAL || '60000') // 1 minute
  };
}

/**
 * Persistence configuration
 */
export function getPersistenceConfig(): {
  enablePersistence: boolean;
  persistenceBackend: 'redis' | 'file' | 'memory';
  backupInterval: number;
  maxBackups: number;
  compressionEnabled: boolean;
} {
  return {
    enablePersistence: process.env.MARKOV_ENABLE_PERSISTENCE !== 'false',
    persistenceBackend: (process.env.MARKOV_PERSISTENCE_BACKEND as any) || 'redis',
    backupInterval: parseInt(process.env.MARKOV_BACKUP_INTERVAL || '3600000'), // 1 hour
    maxBackups: parseInt(process.env.MARKOV_MAX_BACKUPS || '24'), // 24 backups
    compressionEnabled: process.env.MARKOV_COMPRESSION_ENABLED !== 'false'
  };
}

/**
 * Integration configuration with other PHANTOM-Flow components
 */
export function getIntegrationConfig(): {
  behavioralAnalyzer: {
    enabled: boolean;
    riskScoreWeight: number;
    anomalyScoreWeight: number;
  };
  threatDetection: {
    enabled: boolean;
    anomalyThreshold: number;
    riskMultiplier: number;
  };
  responseSystem: {
    enabled: boolean;
    triggerThreshold: number;
    escalationEnabled: boolean;
  };
} {
  return {
    behavioralAnalyzer: {
      enabled: process.env.MARKOV_BEHAVIORAL_INTEGRATION !== 'false',
      riskScoreWeight: parseFloat(process.env.MARKOV_BEHAVIORAL_RISK_WEIGHT || '0.3'),
      anomalyScoreWeight: parseFloat(process.env.MARKOV_BEHAVIORAL_ANOMALY_WEIGHT || '0.4')
    },
    threatDetection: {
      enabled: process.env.MARKOV_THREAT_INTEGRATION !== 'false',
      anomalyThreshold: parseFloat(process.env.MARKOV_THREAT_ANOMALY_THRESHOLD || '0.6'),
      riskMultiplier: parseFloat(process.env.MARKOV_THREAT_RISK_MULTIPLIER || '1.5')
    },
    responseSystem: {
      enabled: process.env.MARKOV_RESPONSE_INTEGRATION === 'true',
      triggerThreshold: parseFloat(process.env.MARKOV_RESPONSE_TRIGGER_THRESHOLD || '0.8'),
      escalationEnabled: process.env.MARKOV_RESPONSE_ESCALATION_ENABLED === 'true'
    }
  };
}
