import { CountMinSketchConfig, SketchManagerConfig, FrequencyTracker } from '@/types/sketch';

/**
 * Default configuration for Count-Min Sketch implementations
 */
export const getDefaultSketchConfig = (): CountMinSketchConfig => {
  return {
    width: parseInt(process.env.SKETCH_DEFAULT_WIDTH || '4096'),
    depth: parseInt(process.env.SKETCH_DEFAULT_DEPTH || '6'),
    hashSeed: parseInt(process.env.SKETCH_HASH_SEED || String(Math.floor(Math.random() * 1000000))),
    errorRate: parseFloat(process.env.SKETCH_ERROR_RATE || '0.001'),
    confidence: parseFloat(process.env.SKETCH_CONFIDENCE || '0.99'),
    name: 'default'
  };
};

/**
 * High-performance configuration for high-traffic scenarios
 */
export const getHighPerformanceSketchConfig = (): CountMinSketchConfig => {
  return {
    width: parseInt(process.env.SKETCH_HP_WIDTH || '8192'),
    depth: parseInt(process.env.SKETCH_HP_DEPTH || '8'),
    hashSeed: parseInt(process.env.SKETCH_HP_HASH_SEED || String(Math.floor(Math.random() * 1000000))),
    errorRate: parseFloat(process.env.SKETCH_HP_ERROR_RATE || '0.0005'),
    confidence: parseFloat(process.env.SKETCH_HP_CONFIDENCE || '0.995'),
    name: 'high_performance'
  };
};

/**
 * Memory-efficient configuration for resource-constrained environments
 */
export const getMemoryEfficientSketchConfig = (): CountMinSketchConfig => {
  return {
    width: parseInt(process.env.SKETCH_ME_WIDTH || '2048'),
    depth: parseInt(process.env.SKETCH_ME_DEPTH || '4'),
    hashSeed: parseInt(process.env.SKETCH_ME_HASH_SEED || String(Math.floor(Math.random() * 1000000))),
    errorRate: parseFloat(process.env.SKETCH_ME_ERROR_RATE || '0.01'),
    confidence: parseFloat(process.env.SKETCH_ME_CONFIDENCE || '0.95'),
    name: 'memory_efficient'
  };
};

/**
 * Development-specific configuration with faster operations and smaller memory footprint
 */
export const getDevelopmentSketchConfig = (): CountMinSketchConfig => {
  return {
    width: parseInt(process.env.SKETCH_DEV_WIDTH || '1024'),
    depth: parseInt(process.env.SKETCH_DEV_DEPTH || '4'),
    hashSeed: parseInt(process.env.SKETCH_DEV_HASH_SEED || '12345'), // Fixed seed for consistency
    errorRate: parseFloat(process.env.SKETCH_DEV_ERROR_RATE || '0.01'),
    confidence: parseFloat(process.env.SKETCH_DEV_CONFIDENCE || '0.9'),
    name: 'development'
  };
};

/**
 * Get sketch configuration based on environment and use case
 */
export const getSketchConfigForUseCase = (useCase: 'ip_tracking' | 'path_tracking' | 'ua_tracking' | 'session_tracking' | 'param_tracking'): CountMinSketchConfig => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const baseConfig = isDevelopment ? getDevelopmentSketchConfig() : getDefaultSketchConfig();

  switch (useCase) {
    case 'ip_tracking':
      return {
        ...baseConfig,
        width: parseInt(process.env.SKETCH_IP_WIDTH || (isDevelopment ? '2048' : '8192')),
        depth: parseInt(process.env.SKETCH_IP_DEPTH || '6'),
        name: 'ip_tracker'
      };

    case 'path_tracking':
      return {
        ...baseConfig,
        width: parseInt(process.env.SKETCH_PATH_WIDTH || (isDevelopment ? '1024' : '4096')),
        depth: parseInt(process.env.SKETCH_PATH_DEPTH || '5'),
        name: 'path_tracker'
      };

    case 'ua_tracking':
      return {
        ...baseConfig,
        width: parseInt(process.env.SKETCH_UA_WIDTH || (isDevelopment ? '512' : '2048')),
        depth: parseInt(process.env.SKETCH_UA_DEPTH || '4'),
        name: 'ua_tracker'
      };

    case 'session_tracking':
      return {
        ...baseConfig,
        width: parseInt(process.env.SKETCH_SESSION_WIDTH || (isDevelopment ? '1024' : '4096')),
        depth: parseInt(process.env.SKETCH_SESSION_DEPTH || '5'),
        name: 'session_tracker'
      };

    case 'param_tracking':
      return {
        ...baseConfig,
        width: parseInt(process.env.SKETCH_PARAM_WIDTH || (isDevelopment ? '1024' : '4096')),
        depth: parseInt(process.env.SKETCH_PARAM_DEPTH || '5'),
        name: 'param_tracker'
      };

    default:
      return baseConfig;
  }
};

/**
 * Create frequency trackers configuration
 */
export const getFrequencyTrackersConfig = (): FrequencyTracker[] => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return [
    {
      type: 'ip_address',
      sketch: getSketchConfigForUseCase('ip_tracking'),
      thresholds: {
        baseline: parseInt(process.env.IP_BASELINE_FREQUENCY || (isDevelopment ? '5' : '10')),
        suspicious: parseInt(process.env.IP_SUSPICIOUS_FREQUENCY || (isDevelopment ? '20' : '50')),
        anomalous: parseInt(process.env.IP_ANOMALOUS_FREQUENCY || (isDevelopment ? '50' : '100')),
        critical: parseInt(process.env.IP_CRITICAL_FREQUENCY || (isDevelopment ? '100' : '500'))
      },
      timeWindow: parseInt(process.env.IP_TIME_WINDOW || '300000'), // 5 minutes
      enabled: process.env.ENABLE_IP_TRACKING !== 'false'
    },
    {
      type: 'user_agent',
      sketch: getSketchConfigForUseCase('ua_tracking'),
      thresholds: {
        baseline: parseInt(process.env.UA_BASELINE_FREQUENCY || (isDevelopment ? '2' : '5')),
        suspicious: parseInt(process.env.UA_SUSPICIOUS_FREQUENCY || (isDevelopment ? '10' : '20')),
        anomalous: parseInt(process.env.UA_ANOMALOUS_FREQUENCY || (isDevelopment ? '25' : '50')),
        critical: parseInt(process.env.UA_CRITICAL_FREQUENCY || (isDevelopment ? '50' : '200'))
      },
      timeWindow: parseInt(process.env.UA_TIME_WINDOW || '300000'), // 5 minutes
      enabled: process.env.ENABLE_UA_TRACKING !== 'false'
    },
    {
      type: 'request_path',
      sketch: getSketchConfigForUseCase('path_tracking'),
      thresholds: {
        baseline: parseInt(process.env.PATH_BASELINE_FREQUENCY || (isDevelopment ? '10' : '20')),
        suspicious: parseInt(process.env.PATH_SUSPICIOUS_FREQUENCY || (isDevelopment ? '50' : '100')),
        anomalous: parseInt(process.env.PATH_ANOMALOUS_FREQUENCY || (isDevelopment ? '200' : '500')),
        critical: parseInt(process.env.PATH_CRITICAL_FREQUENCY || (isDevelopment ? '500' : '2000'))
      },
      timeWindow: parseInt(process.env.PATH_TIME_WINDOW || '300000'), // 5 minutes
      enabled: process.env.ENABLE_PATH_TRACKING !== 'false'
    },
    {
      type: 'session_id',
      sketch: getSketchConfigForUseCase('session_tracking'),
      thresholds: {
        baseline: parseInt(process.env.SESSION_BASELINE_FREQUENCY || (isDevelopment ? '25' : '50')),
        suspicious: parseInt(process.env.SESSION_SUSPICIOUS_FREQUENCY || (isDevelopment ? '100' : '200')),
        anomalous: parseInt(process.env.SESSION_ANOMALOUS_FREQUENCY || (isDevelopment ? '500' : '1000')),
        critical: parseInt(process.env.SESSION_CRITICAL_FREQUENCY || (isDevelopment ? '1000' : '5000'))
      },
      timeWindow: parseInt(process.env.SESSION_TIME_WINDOW || '600000'), // 10 minutes
      enabled: process.env.ENABLE_SESSION_TRACKING !== 'false'
    },
    {
      type: 'parameter',
      sketch: getSketchConfigForUseCase('param_tracking'),
      thresholds: {
        baseline: parseInt(process.env.PARAM_BASELINE_FREQUENCY || '1'),
        suspicious: parseInt(process.env.PARAM_SUSPICIOUS_FREQUENCY || (isDevelopment ? '3' : '5')),
        anomalous: parseInt(process.env.PARAM_ANOMALOUS_FREQUENCY || (isDevelopment ? '10' : '20')),
        critical: parseInt(process.env.PARAM_CRITICAL_FREQUENCY || (isDevelopment ? '25' : '100'))
      },
      timeWindow: parseInt(process.env.PARAM_TIME_WINDOW || '300000'), // 5 minutes
      enabled: process.env.ENABLE_PARAM_TRACKING !== 'false'
    }
  ];
};

/**
 * Sketch Manager configuration
 */
export const getSketchManagerConfig = (): SketchManagerConfig => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    trackers: getFrequencyTrackersConfig(),
    persistenceInterval: parseInt(process.env.SKETCH_PERSISTENCE_INTERVAL || (isDevelopment ? '60000' : '300000')), // 1min dev, 5min prod
    cleanupInterval: parseInt(process.env.SKETCH_CLEANUP_INTERVAL || (isDevelopment ? '300000' : '900000')), // 5min dev, 15min prod
    maxMemoryUsage: parseInt(process.env.SKETCH_MAX_MEMORY || (isDevelopment ? '50' : '200')) * 1024 * 1024, // 50MB dev, 200MB prod
    enableMetrics: process.env.ENABLE_SKETCH_METRICS !== 'false'
  };
};

/**
 * Anomaly detection configuration
 */
export const getAnomalyDetectionConfig = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    enableFrequencySpikes: process.env.ENABLE_FREQUENCY_SPIKE_DETECTION !== 'false',
    enableRareItemDetection: process.env.ENABLE_RARE_ITEM_DETECTION !== 'false',
    enableBurstPatterns: process.env.ENABLE_BURST_PATTERN_DETECTION !== 'false',
    enableSustainedHighActivity: process.env.ENABLE_SUSTAINED_ACTIVITY_DETECTION !== 'false',
    
    sensitivity: parseFloat(process.env.ANOMALY_SENSITIVITY || (isDevelopment ? '0.5' : '0.7')),
    
    shortTermWindow: parseInt(process.env.ANOMALY_SHORT_WINDOW || '300000'), // 5 minutes
    longTermWindow: parseInt(process.env.ANOMALY_LONG_WINDOW || '3600000'), // 1 hour
    
    minSamples: parseInt(process.env.ANOMALY_MIN_SAMPLES || (isDevelopment ? '5' : '10')),
    
    spikeThreshold: parseFloat(process.env.SPIKE_THRESHOLD || (isDevelopment ? '3.0' : '5.0')),
    rarityThreshold: parseFloat(process.env.RARITY_THRESHOLD || '0.001'),
    burstVarianceThreshold: parseFloat(process.env.BURST_VARIANCE_THRESHOLD || '2.0'),
    sustainedDuration: parseInt(process.env.SUSTAINED_DURATION || '600000') // 10 minutes
  };
};

/**
 * Performance tuning configuration based on expected traffic
 */
export const getPerformanceTunedConfig = (expectedRequestsPerSecond: number): CountMinSketchConfig => {
  // Calculate optimal parameters based on expected load
  let width: number;
  let depth: number;
  
  if (expectedRequestsPerSecond < 100) {
    // Low traffic
    width = 2048;
    depth = 4;
  } else if (expectedRequestsPerSecond < 1000) {
    // Medium traffic
    width = 4096;
    depth = 6;
  } else if (expectedRequestsPerSecond < 10000) {
    // High traffic
    width = 8192;
    depth = 8;
  } else {
    // Very high traffic
    width = 16384;
    depth = 10;
  }
  
  return {
    width,
    depth,
    hashSeed: Math.floor(Math.random() * 1000000),
    errorRate: 0.001,
    confidence: 0.99,
    name: `performance_tuned_${expectedRequestsPerSecond}rps`
  };
};

/**
 * Memory budget configuration - creates optimal config within memory constraints
 */
export const getMemoryBudgetConfig = (maxMemoryBytes: number): CountMinSketchConfig => {
  // Each cell uses 4 bytes (32-bit integer)
  // Add 20% overhead for objects and structures
  const usableMemory = maxMemoryBytes * 0.8;
  const maxCells = Math.floor(usableMemory / 4);
  
  // Try to maintain good accuracy with balanced width/depth ratio
  // Generally, width should be larger than depth for better accuracy
  const optimalRatio = 1024; // width / depth
  
  // Solve: width * depth = maxCells, width = depth * ratio
  // depth^2 * ratio = maxCells
  const depth = Math.max(4, Math.floor(Math.sqrt(maxCells / optimalRatio)));
  const width = Math.floor(maxCells / depth);
  
  return {
    width: Math.max(width, 512), // Minimum width for reasonable accuracy
    depth: Math.max(depth, 4),   // Minimum depth for reasonable accuracy
    hashSeed: Math.floor(Math.random() * 1000000),
    errorRate: Math.E / width,   // Theoretical error rate
    confidence: 1 - Math.exp(-depth), // Theoretical confidence
    name: `memory_budget_${Math.floor(maxMemoryBytes / 1024)}KB`
  };
};

/**
 * Validation function for sketch configuration
 */
export const validateSketchConfig = (config: CountMinSketchConfig): string[] => {
  const errors: string[] = [];
  
  if (config.width <= 0 || !Number.isInteger(config.width)) {
    errors.push('Width must be a positive integer');
  }
  
  if (config.depth <= 0 || !Number.isInteger(config.depth)) {
    errors.push('Depth must be a positive integer');
  }
  
  if (config.errorRate <= 0 || config.errorRate >= 1) {
    errors.push('Error rate must be between 0 and 1');
  }
  
  if (config.confidence <= 0 || config.confidence >= 1) {
    errors.push('Confidence must be between 0 and 1');
  }
  
  if (!Number.isInteger(config.hashSeed)) {
    errors.push('Hash seed must be an integer');
  }
  
  // Memory usage warning
  const memoryUsage = config.width * config.depth * 4;
  if (memoryUsage > 100 * 1024 * 1024) { // 100MB
    errors.push(`Warning: Configuration will use approximately ${Math.round(memoryUsage / 1024 / 1024)}MB of memory`);
  }
  
  return errors;
};

/**
 * Get recommended configuration based on use case description
 */
export const getRecommendedConfig = (useCase: {
  expectedQPS?: number;
  memoryBudget?: number;
  accuracyRequirement?: 'low' | 'medium' | 'high';
  environment?: 'development' | 'testing' | 'production';
}): CountMinSketchConfig => {
  const { expectedQPS, memoryBudget, accuracyRequirement = 'medium', environment = 'production' } = useCase;
  
  // If memory budget is specified, prioritize that
  if (memoryBudget) {
    return getMemoryBudgetConfig(memoryBudget);
  }
  
  // If QPS is specified, use performance tuning
  if (expectedQPS) {
    return getPerformanceTunedConfig(expectedQPS);
  }
  
  // Default to environment-based configuration
  switch (environment) {
    case 'development':
      return getDevelopmentSketchConfig();
    case 'testing':
      return getMemoryEfficientSketchConfig();
    case 'production':
    default:
      return accuracyRequirement === 'high' 
        ? getHighPerformanceSketchConfig() 
        : getDefaultSketchConfig();
  }
};
