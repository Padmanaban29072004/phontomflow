import {
  EWMAConfig,
  EWMAManagerConfig,
  TimeWindow,
  BaselineAdaptation
} from '@/types/ewma';

/**
 * Environment-based configuration for EWMA system
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Default EWMA configuration
 */
export function getDefaultEWMAConfig(): EWMAConfig {
  return {
    variant: 'simple',
    alpha: parseFloat(process.env.EWMA_DEFAULT_ALPHA || '0.2'),
    adaptiveAlpha: process.env.EWMA_ADAPTIVE_ALPHA === 'true',
    minAlpha: parseFloat(process.env.EWMA_MIN_ALPHA || '0.05'),
    maxAlpha: parseFloat(process.env.EWMA_MAX_ALPHA || '0.5'),
    windowSize: parseInt(process.env.EWMA_WINDOW_SIZE || '100'),
    timeWindow: '5min',
    volatilityThreshold: parseFloat(process.env.EWMA_VOLATILITY_THRESHOLD || '0.15'),
    changeDetectionThreshold: parseFloat(process.env.EWMA_CHANGE_THRESHOLD || '0.6'),
    enableTrendAnalysis: process.env.EWMA_ENABLE_TREND_ANALYSIS !== 'false',
    enableOutlierDetection: process.env.EWMA_ENABLE_OUTLIER_DETECTION !== 'false'
  };
}

/**
 * Simple EWMA configuration
 */
export function getSimpleEWMAConfig(): EWMAConfig {
  const base = getDefaultEWMAConfig();
  return {
    ...base,
    variant: 'simple',
    alpha: parseFloat(process.env.EWMA_SIMPLE_ALPHA || '0.2'),
    adaptiveAlpha: false,
    enableTrendAnalysis: process.env.EWMA_SIMPLE_TREND_ANALYSIS !== 'false'
  };
}

/**
 * Double EWMA configuration (Holt's method)
 */
export function getDoubleEWMAConfig(): EWMAConfig {
  const base = getDefaultEWMAConfig();
  return {
    ...base,
    variant: 'double',
    alpha: parseFloat(process.env.EWMA_DOUBLE_ALPHA || '0.15'),
    adaptiveAlpha: false,
    enableTrendAnalysis: true,
    windowSize: parseInt(process.env.EWMA_DOUBLE_WINDOW_SIZE || '200')
  };
}

/**
 * Adaptive EWMA configuration
 */
export function getAdaptiveEWMAConfig(): EWMAConfig {
  const base = getDefaultEWMAConfig();
  return {
    ...base,
    variant: 'adaptive',
    alpha: parseFloat(process.env.EWMA_ADAPTIVE_BASE_ALPHA || '0.2'),
    adaptiveAlpha: true,
    minAlpha: parseFloat(process.env.EWMA_ADAPTIVE_MIN_ALPHA || '0.05'),
    maxAlpha: parseFloat(process.env.EWMA_ADAPTIVE_MAX_ALPHA || '0.8'),
    volatilityThreshold: parseFloat(process.env.EWMA_ADAPTIVE_VOLATILITY_THRESHOLD || '0.2'),
    changeDetectionThreshold: parseFloat(process.env.EWMA_ADAPTIVE_CHANGE_THRESHOLD || '0.5')
  };
}

/**
 * Development EWMA configuration
 */
export function getDevelopmentEWMAConfig(): EWMAConfig {
  const base = getDefaultEWMAConfig();
  return {
    ...base,
    alpha: parseFloat(process.env.EWMA_DEV_ALPHA || '0.3'),
    windowSize: parseInt(process.env.EWMA_DEV_WINDOW_SIZE || '50'),
    volatilityThreshold: parseFloat(process.env.EWMA_DEV_VOLATILITY_THRESHOLD || '0.1'),
    changeDetectionThreshold: parseFloat(process.env.EWMA_DEV_CHANGE_THRESHOLD || '0.8'),
    enableTrendAnalysis: true,
    enableOutlierDetection: true
  };
}

/**
 * Production EWMA configuration
 */
export function getProductionEWMAConfig(): EWMAConfig {
  const base = getDefaultEWMAConfig();
  return {
    ...base,
    alpha: parseFloat(process.env.EWMA_PROD_ALPHA || '0.15'),
    windowSize: parseInt(process.env.EWMA_PROD_WINDOW_SIZE || '500'),
    volatilityThreshold: parseFloat(process.env.EWMA_PROD_VOLATILITY_THRESHOLD || '0.2'),
    changeDetectionThreshold: parseFloat(process.env.EWMA_PROD_CHANGE_THRESHOLD || '0.4'),
    adaptiveAlpha: process.env.EWMA_PROD_ADAPTIVE_ALPHA === 'true'
  };
}

/**
 * High-frequency EWMA configuration (for 1min window)
 */
export function getHighFrequencyEWMAConfig(): EWMAConfig {
  const base = getDefaultEWMAConfig();
  return {
    ...base,
    alpha: parseFloat(process.env.EWMA_HF_ALPHA || '0.4'),
    windowSize: parseInt(process.env.EWMA_HF_WINDOW_SIZE || '60'),
    volatilityThreshold: parseFloat(process.env.EWMA_HF_VOLATILITY_THRESHOLD || '0.1'),
    changeDetectionThreshold: parseFloat(process.env.EWMA_HF_CHANGE_THRESHOLD || '0.9'),
    adaptiveAlpha: process.env.EWMA_HF_ADAPTIVE_ALPHA !== 'false',
    enableOutlierDetection: true
  };
}

/**
 * Low-frequency EWMA configuration (for 60min window)
 */
export function getLowFrequencyEWMAConfig(): EWMAConfig {
  const base = getDefaultEWMAConfig();
  return {
    ...base,
    alpha: parseFloat(process.env.EWMA_LF_ALPHA || '0.05'),
    windowSize: parseInt(process.env.EWMA_LF_WINDOW_SIZE || '1000'),
    volatilityThreshold: parseFloat(process.env.EWMA_LF_VOLATILITY_THRESHOLD || '0.3'),
    changeDetectionThreshold: parseFloat(process.env.EWMA_LF_CHANGE_THRESHOLD || '0.2'),
    adaptiveAlpha: false,
    enableTrendAnalysis: true
  };
}

/**
 * Baseline adaptation configuration
 */
export function getBaselineAdaptationConfig(): BaselineAdaptation {
  return {
    enabled: process.env.EWMA_BASELINE_ADAPTATION_ENABLED !== 'false',
    adaptationRate: parseFloat(process.env.EWMA_ADAPTATION_RATE || '0.1'),
    driftThreshold: parseFloat(process.env.EWMA_DRIFT_THRESHOLD || '0.3'),
    validationPeriod: parseInt(process.env.EWMA_VALIDATION_PERIOD || '15'), // minutes
    rollbackThreshold: parseFloat(process.env.EWMA_ROLLBACK_THRESHOLD || '0.8'),
    lastAdaptation: new Date(),
    adaptationCount: 0
  };
}

/**
 * EWMA Manager configuration
 */
export function getEWMAManagerConfig(): EWMAManagerConfig {
  const windows: TimeWindow[] = [];
  
  // Add windows based on environment variables
  if (process.env.EWMA_ENABLE_1MIN !== 'false') windows.push('1min');
  if (process.env.EWMA_ENABLE_5MIN !== 'false') windows.push('5min');
  if (process.env.EWMA_ENABLE_15MIN !== 'false') windows.push('15min');
  if (process.env.EWMA_ENABLE_60MIN !== 'false') windows.push('60min');

  // Default to all windows if none specified
  if (windows.length === 0) {
    windows.push('1min', '5min', '15min', '60min');
  }

  return {
    windows,
    defaultConfig: getDefaultEWMAConfig(),
    windowConfigs: {
      '1min': getHighFrequencyEWMAConfig(),
      '5min': getDefaultEWMAConfig(),
      '15min': getDefaultEWMAConfig(),
      '60min': getLowFrequencyEWMAConfig()
    },
    globalSettings: {
      enableCrossPollination: process.env.EWMA_CROSS_POLLINATION === 'true',
      consensusThreshold: parseFloat(process.env.EWMA_CONSENSUS_THRESHOLD || '0.6'),
      maxMemoryUsage: parseInt(process.env.EWMA_MAX_MEMORY_USAGE || '100') * 1024 * 1024, // MB to bytes
      persistenceInterval: parseInt(process.env.EWMA_PERSISTENCE_INTERVAL || '300000'), // 5 minutes
      cleanupInterval: parseInt(process.env.EWMA_CLEANUP_INTERVAL || '3600000') // 1 hour
    },
    adaptation: getBaselineAdaptationConfig(),
    monitoring: {
      enableMetrics: process.env.EWMA_ENABLE_METRICS !== 'false',
      metricsInterval: parseInt(process.env.EWMA_METRICS_INTERVAL || '60000'), // 1 minute
      enableAlerting: process.env.EWMA_ENABLE_ALERTING === 'true',
      alertThreshold: parseFloat(process.env.EWMA_ALERT_THRESHOLD || '0.8')
    }
  };
}

/**
 * Get appropriate EWMA configuration based on environment and use case
 */
export function getEWMAConfiguration(
  useCase?: 'default' | 'simple' | 'double' | 'adaptive' | 'high-frequency' | 'low-frequency'
): EWMAConfig {
  // Environment-based defaults
  if (isDevelopment) {
    return getDevelopmentEWMAConfig();
  }

  if (isProduction) {
    return getProductionEWMAConfig();
  }

  // Use case specific configurations
  switch (useCase) {
    case 'simple':
      return getSimpleEWMAConfig();
    case 'double':
      return getDoubleEWMAConfig();
    case 'adaptive':
      return getAdaptiveEWMAConfig();
    case 'high-frequency':
      return getHighFrequencyEWMAConfig();
    case 'low-frequency':
      return getLowFrequencyEWMAConfig();
    case 'default':
    default:
      return getDefaultEWMAConfig();
  }
}

/**
 * Performance optimization configuration
 */
export function getPerformanceConfig(): {
  enableBatching: boolean;
  batchSize: number;
  maxConcurrentCalculations: number;
  enableCaching: boolean;
  cacheSize: number;
  enableParallelProcessing: boolean;
} {
  return {
    enableBatching: process.env.EWMA_ENABLE_BATCHING === 'true',
    batchSize: parseInt(process.env.EWMA_BATCH_SIZE || '10'),
    maxConcurrentCalculations: parseInt(process.env.EWMA_MAX_CONCURRENT || '5'),
    enableCaching: process.env.EWMA_ENABLE_CACHING !== 'false',
    cacheSize: parseInt(process.env.EWMA_CACHE_SIZE || '100'),
    enableParallelProcessing: process.env.EWMA_ENABLE_PARALLEL !== 'false'
  };
}

/**
 * Integration configuration with other PHANTOM-Flow components
 */
export function getIntegrationConfig(): {
  statisticalAnalyzer: {
    enabled: boolean;
    riskScoreWeight: number;
    anomalyScoreWeight: number;
    trendWeight: number;
  };
  threatDetection: {
    enabled: boolean;
    anomalyThreshold: number;
    trendThreshold: number;
    volatilityThreshold: number;
  };
  alerting: {
    enabled: boolean;
    anomalyThreshold: number;
    trendChangeThreshold: number;
    volatilityThreshold: number;
  };
} {
  return {
    statisticalAnalyzer: {
      enabled: process.env.EWMA_STATISTICAL_INTEGRATION !== 'false',
      riskScoreWeight: parseFloat(process.env.EWMA_STATISTICAL_RISK_WEIGHT || '0.3'),
      anomalyScoreWeight: parseFloat(process.env.EWMA_STATISTICAL_ANOMALY_WEIGHT || '0.4'),
      trendWeight: parseFloat(process.env.EWMA_STATISTICAL_TREND_WEIGHT || '0.2')
    },
    threatDetection: {
      enabled: process.env.EWMA_THREAT_INTEGRATION !== 'false',
      anomalyThreshold: parseFloat(process.env.EWMA_THREAT_ANOMALY_THRESHOLD || '0.7'),
      trendThreshold: parseFloat(process.env.EWMA_THREAT_TREND_THRESHOLD || '0.8'),
      volatilityThreshold: parseFloat(process.env.EWMA_THREAT_VOLATILITY_THRESHOLD || '0.6')
    },
    alerting: {
      enabled: process.env.EWMA_ALERTING_INTEGRATION === 'true',
      anomalyThreshold: parseFloat(process.env.EWMA_ALERT_ANOMALY_THRESHOLD || '0.8'),
      trendChangeThreshold: parseFloat(process.env.EWMA_ALERT_TREND_THRESHOLD || '0.7'),
      volatilityThreshold: parseFloat(process.env.EWMA_ALERT_VOLATILITY_THRESHOLD || '0.9')
    }
  };
}

/**
 * Logging and debugging configuration
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
    enableDebugLogs: process.env.EWMA_DEBUG_LOGS === 'true' || isDevelopment,
    enablePerformanceLogs: process.env.EWMA_PERFORMANCE_LOGS !== 'false',
    enableAnomalyLogs: process.env.EWMA_ANOMALY_LOGS !== 'false',
    logLevel: (process.env.EWMA_LOG_LEVEL as any) || (isDevelopment ? 'debug' : 'info'),
    enableMetrics: process.env.EWMA_ENABLE_METRICS !== 'false',
    metricsInterval: parseInt(process.env.EWMA_METRICS_INTERVAL || '60000') // 1 minute
  };
}

/**
 * Persistence and backup configuration
 */
export function getPersistenceConfig(): {
  enablePersistence: boolean;
  persistenceBackend: 'redis' | 'file' | 'memory';
  backupInterval: number;
  maxBackups: number;
  compressionEnabled: boolean;
  retentionDays: number;
} {
  return {
    enablePersistence: process.env.EWMA_ENABLE_PERSISTENCE !== 'false',
    persistenceBackend: (process.env.EWMA_PERSISTENCE_BACKEND as any) || 'redis',
    backupInterval: parseInt(process.env.EWMA_BACKUP_INTERVAL || '3600000'), // 1 hour
    maxBackups: parseInt(process.env.EWMA_MAX_BACKUPS || '24'), // 24 backups
    compressionEnabled: process.env.EWMA_COMPRESSION_ENABLED !== 'false',
    retentionDays: parseInt(process.env.EWMA_RETENTION_DAYS || '7') // 7 days
  };
}

/**
 * Anomaly detection thresholds configuration
 */
export function getAnomalyThresholds(): {
  statistical: number;
  trend: number;
  volatility: number;
  changePoint: number;
  outlier: number;
} {
  return {
    statistical: parseFloat(process.env.EWMA_ANOMALY_STATISTICAL_THRESHOLD || '0.7'),
    trend: parseFloat(process.env.EWMA_ANOMALY_TREND_THRESHOLD || '0.8'),
    volatility: parseFloat(process.env.EWMA_ANOMALY_VOLATILITY_THRESHOLD || '0.6'),
    changePoint: parseFloat(process.env.EWMA_ANOMALY_CHANGEPOINT_THRESHOLD || '0.5'),
    outlier: parseFloat(process.env.EWMA_ANOMALY_OUTLIER_THRESHOLD || '2.5') // Z-score threshold
  };
}

/**
 * Window-specific parameter optimization
 */
export function getWindowOptimization(): Record<TimeWindow, {
  alpha: number;
  responsiveness: number;
  stability: number;
  accuracy: number;
}> {
  return {
    '1min': {
      alpha: parseFloat(process.env.EWMA_1MIN_ALPHA || '0.4'),
      responsiveness: parseFloat(process.env.EWMA_1MIN_RESPONSIVENESS || '0.9'),
      stability: parseFloat(process.env.EWMA_1MIN_STABILITY || '0.3'),
      accuracy: parseFloat(process.env.EWMA_1MIN_ACCURACY || '0.7')
    },
    '5min': {
      alpha: parseFloat(process.env.EWMA_5MIN_ALPHA || '0.2'),
      responsiveness: parseFloat(process.env.EWMA_5MIN_RESPONSIVENESS || '0.7'),
      stability: parseFloat(process.env.EWMA_5MIN_STABILITY || '0.8'),
      accuracy: parseFloat(process.env.EWMA_5MIN_ACCURACY || '0.85')
    },
    '15min': {
      alpha: parseFloat(process.env.EWMA_15MIN_ALPHA || '0.1'),
      responsiveness: parseFloat(process.env.EWMA_15MIN_RESPONSIVENESS || '0.5'),
      stability: parseFloat(process.env.EWMA_15MIN_STABILITY || '0.9'),
      accuracy: parseFloat(process.env.EWMA_15MIN_ACCURACY || '0.9')
    },
    '60min': {
      alpha: parseFloat(process.env.EWMA_60MIN_ALPHA || '0.05'),
      responsiveness: parseFloat(process.env.EWMA_60MIN_RESPONSIVENESS || '0.3'),
      stability: parseFloat(process.env.EWMA_60MIN_STABILITY || '0.95'),
      accuracy: parseFloat(process.env.EWMA_60MIN_ACCURACY || '0.92')
    }
  };
}
