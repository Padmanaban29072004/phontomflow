import { HyperLogLogConfig, VisitorTrackingConfig, HLLManagerConfig } from '@/types/hyperloglog';

/**
 * Default HyperLogLog configuration
 */
export const getDefaultHLLConfig = (): HyperLogLogConfig => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    precision: parseInt(process.env.HLL_DEFAULT_PRECISION || (isDevelopment ? '10' : '12')),
    hashFunction: (process.env.HLL_HASH_FUNCTION as 'murmur3' | 'xxhash' | 'fnv1a') || 'murmur3',
    biasCorrection: process.env.HLL_BIAS_CORRECTION !== 'false',
    sparseMode: process.env.HLL_SPARSE_MODE !== 'false',
    maxMemoryMB: parseInt(process.env.HLL_MAX_MEMORY_MB || (isDevelopment ? '10' : '50')),
    name: 'default'
  };
};

/**
 * High-precision configuration for accurate cardinality estimation
 */
export const getHighPrecisionHLLConfig = (): HyperLogLogConfig => {
  return {
    precision: parseInt(process.env.HLL_HIGH_PRECISION || '14'),
    hashFunction: 'murmur3',
    biasCorrection: true,
    sparseMode: true,
    maxMemoryMB: parseInt(process.env.HLL_HIGH_MEMORY_MB || '100'),
    name: 'high_precision'
  };
};

/**
 * Memory-efficient configuration for resource-constrained environments
 */
export const getMemoryEfficientHLLConfig = (): HyperLogLogConfig => {
  return {
    precision: parseInt(process.env.HLL_MEMORY_PRECISION || '8'),
    hashFunction: 'fnv1a', // Faster hash function
    biasCorrection: false,  // Disable to save computation
    sparseMode: true,
    maxMemoryMB: parseInt(process.env.HLL_MEMORY_LIMIT_MB || '5'),
    name: 'memory_efficient'
  };
};

/**
 * Development configuration with faster operations
 */
export const getDevelopmentHLLConfig = (): HyperLogLogConfig => {
  return {
    precision: parseInt(process.env.HLL_DEV_PRECISION || '8'),
    hashFunction: 'fnv1a',
    biasCorrection: false,
    sparseMode: true,
    maxMemoryMB: parseInt(process.env.HLL_DEV_MEMORY_MB || '5'),
    name: 'development'
  };
};

/**
 * Get HLL configuration optimized for specific use cases
 */
export const getHLLConfigForUseCase = (useCase: 'ip_tracking' | 'session_tracking' | 'visitor_tracking' | 'path_tracking' | 'general'): HyperLogLogConfig => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const baseConfig = isDevelopment ? getDevelopmentHLLConfig() : getDefaultHLLConfig();

  switch (useCase) {
    case 'ip_tracking':
      return {
        ...baseConfig,
        precision: parseInt(process.env.HLL_IP_PRECISION || (isDevelopment ? '10' : '12')),
        maxMemoryMB: parseInt(process.env.HLL_IP_MEMORY_MB || (isDevelopment ? '8' : '30')),
        name: 'ip_tracker'
      };

    case 'session_tracking':
      return {
        ...baseConfig,
        precision: parseInt(process.env.HLL_SESSION_PRECISION || (isDevelopment ? '8' : '10')),
        maxMemoryMB: parseInt(process.env.HLL_SESSION_MEMORY_MB || (isDevelopment ? '5' : '20')),
        name: 'session_tracker'
      };

    case 'visitor_tracking':
      return {
        ...baseConfig,
        precision: parseInt(process.env.HLL_VISITOR_PRECISION || (isDevelopment ? '10' : '14')),
        biasCorrection: true, // More accurate for visitor counting
        maxMemoryMB: parseInt(process.env.HLL_VISITOR_MEMORY_MB || (isDevelopment ? '10' : '50')),
        name: 'visitor_tracker'
      };

    case 'path_tracking':
      return {
        ...baseConfig,
        precision: parseInt(process.env.HLL_PATH_PRECISION || (isDevelopment ? '8' : '10')),
        maxMemoryMB: parseInt(process.env.HLL_PATH_MEMORY_MB || (isDevelopment ? '5' : '15')),
        name: 'path_tracker'
      };

    case 'general':
    default:
      return baseConfig;
  }
};

/**
 * Default visitor tracking configuration
 */
export const getDefaultVisitorTrackingConfig = (): VisitorTrackingConfig => {
  return {
    trackIPs: process.env.VISITOR_TRACK_IPS !== 'false',
    trackSessions: process.env.VISITOR_TRACK_SESSIONS !== 'false',
    trackUserAgents: process.env.VISITOR_TRACK_USER_AGENTS !== 'false',
    trackGeolocation: process.env.VISITOR_TRACK_GEOLOCATION !== 'false',
    trackPaths: process.env.VISITOR_TRACK_PATHS !== 'false',
    timeWindows: [
      parseInt(process.env.VISITOR_WINDOW_1MIN || '60000'),      // 1 minute
      parseInt(process.env.VISITOR_WINDOW_5MIN || '300000'),     // 5 minutes
      parseInt(process.env.VISITOR_WINDOW_1HOUR || '3600000'),   // 1 hour
      parseInt(process.env.VISITOR_WINDOW_1DAY || '86400000')    // 1 day
    ],
    enabled: process.env.VISITOR_TRACKING_ENABLED !== 'false'
  };
};

/**
 * HyperLogLog Manager configuration
 */
export const getHLLManagerConfig = (): HLLManagerConfig => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    trackers: [
      {
        name: 'unique_ips',
        config: getHLLConfigForUseCase('ip_tracking'),
        visitorConfig: {
          ...getDefaultVisitorTrackingConfig(),
          trackSessions: false,
          trackUserAgents: false,
          trackGeolocation: false,
          trackPaths: false
        },
        enabled: process.env.HLL_TRACK_IPS !== 'false'
      },
      {
        name: 'unique_sessions',
        config: getHLLConfigForUseCase('session_tracking'),
        visitorConfig: {
          ...getDefaultVisitorTrackingConfig(),
          trackIPs: false,
          trackUserAgents: false,
          trackGeolocation: false,
          trackPaths: false
        },
        enabled: process.env.HLL_TRACK_SESSIONS !== 'false'
      },
      {
        name: 'unique_visitors',
        config: getHLLConfigForUseCase('visitor_tracking'),
        visitorConfig: getDefaultVisitorTrackingConfig(),
        enabled: process.env.HLL_TRACK_VISITORS !== 'false'
      },
      {
        name: 'unique_paths',
        config: getHLLConfigForUseCase('path_tracking'),
        visitorConfig: {
          ...getDefaultVisitorTrackingConfig(),
          trackIPs: false,
          trackSessions: false,
          trackUserAgents: false,
          trackGeolocation: false
        },
        enabled: process.env.HLL_TRACK_PATHS !== 'false'
      }
    ],
    persistenceInterval: parseInt(process.env.HLL_PERSISTENCE_INTERVAL || (isDevelopment ? '60000' : '300000')),
    cleanupInterval: parseInt(process.env.HLL_CLEANUP_INTERVAL || (isDevelopment ? '300000' : '900000')),
    maxMemoryUsage: parseInt(process.env.HLL_TOTAL_MEMORY_MB || (isDevelopment ? '50' : '200')) * 1024 * 1024,
    enableMetrics: process.env.HLL_ENABLE_METRICS !== 'false',
    enableAnalytics: process.env.HLL_ENABLE_ANALYTICS !== 'false'
  };
};

/**
 * Get optimal HLL configuration based on expected cardinality
 */
export const getOptimalHLLConfig = (expectedCardinality: number, errorTolerance: number = 0.02): HyperLogLogConfig => {
  // Calculate required precision for desired error rate
  // Error rate = 1.04 / sqrt(2^precision)
  // Solving for precision: precision = log2((1.04 / errorTolerance)^2)
  const requiredPrecision = Math.ceil(Math.log2(Math.pow(1.04 / errorTolerance, 2)));
  const precision = Math.max(4, Math.min(16, requiredPrecision));
  
  // Estimate memory usage
  const memoryKB = Math.pow(2, precision) * 6 / 8 / 1024; // 6 bits per register
  const memoryMB = Math.ceil(memoryKB / 1024);
  
  return {
    precision,
    hashFunction: 'murmur3',
    biasCorrection: expectedCardinality < 100000, // Enable for smaller cardinalities
    sparseMode: expectedCardinality < 10000,      // Use sparse mode for small sets
    maxMemoryMB: Math.max(5, memoryMB * 2),       // 2x safety margin
    name: `optimal_${expectedCardinality}_${errorTolerance}`
  };
};

/**
 * Performance-tuned configuration based on traffic volume
 */
export const getPerformanceTunedHLLConfig = (requestsPerSecond: number): HyperLogLogConfig => {
  let precision: number;
  let maxMemoryMB: number;
  let hashFunction: 'murmur3' | 'xxhash' | 'fnv1a';
  
  if (requestsPerSecond < 100) {
    // Low traffic
    precision = 10;
    maxMemoryMB = 10;
    hashFunction = 'murmur3';
  } else if (requestsPerSecond < 1000) {
    // Medium traffic
    precision = 12;
    maxMemoryMB = 30;
    hashFunction = 'murmur3';
  } else if (requestsPerSecond < 10000) {
    // High traffic
    precision = 14;
    maxMemoryMB = 100;
    hashFunction = 'murmur3';
  } else {
    // Very high traffic - optimize for speed
    precision = 12;
    maxMemoryMB = 50;
    hashFunction = 'fnv1a'; // Faster hash
  }
  
  return {
    precision,
    hashFunction,
    biasCorrection: requestsPerSecond < 1000, // Skip for high traffic
    sparseMode: true,
    maxMemoryMB,
    name: `performance_${requestsPerSecond}rps`
  };
};

/**
 * Memory budget configuration - creates optimal config within memory constraints
 */
export const getMemoryBudgetHLLConfig = (maxMemoryMB: number): HyperLogLogConfig => {
  // Calculate maximum precision that fits in memory budget
  // Memory usage ≈ 2^precision * 6 bits = 2^precision * 0.75 bytes
  const maxPrecision = Math.floor(Math.log2(maxMemoryMB * 1024 * 1024 / 0.75));
  const precision = Math.max(4, Math.min(16, maxPrecision));
  
  return {
    precision,
    hashFunction: 'fnv1a', // Faster for memory-constrained environments
    biasCorrection: false,  // Disable to save computation
    sparseMode: true,       // Always use sparse mode to save memory
    maxMemoryMB,
    name: `memory_budget_${maxMemoryMB}MB`
  };
};

/**
 * Validation function for HLL configuration
 */
export const validateHLLConfig = (config: HyperLogLogConfig): string[] => {
  const errors: string[] = [];
  
  if (config.precision < 4 || config.precision > 16) {
    errors.push('Precision must be between 4 and 16 bits');
  }
  
  if (config.maxMemoryMB <= 0) {
    errors.push('Max memory must be positive');
  }
  
  if (!['murmur3', 'xxhash', 'fnv1a'].includes(config.hashFunction)) {
    errors.push('Hash function must be murmur3, xxhash, or fnv1a');
  }
  
  // Estimate memory usage and warn if it might exceed limit
  const estimatedMemoryKB = Math.pow(2, config.precision) * 6 / 8 / 1024;
  const estimatedMemoryMB = estimatedMemoryKB / 1024;
  
  if (estimatedMemoryMB > config.maxMemoryMB) {
    errors.push(`Configuration may exceed memory limit: estimated ${estimatedMemoryMB.toFixed(2)}MB > limit ${config.maxMemoryMB}MB`);
  }
  
  return errors;
};

/**
 * Get recommended configuration based on use case description
 */
export const getRecommendedHLLConfig = (useCase: {
  expectedCardinality?: number;
  requestsPerSecond?: number;
  memoryBudgetMB?: number;
  errorTolerance?: number;
  environment?: 'development' | 'testing' | 'production';
}): HyperLogLogConfig => {
  const { 
    expectedCardinality, 
    requestsPerSecond, 
    memoryBudgetMB, 
    errorTolerance = 0.02,
    environment = 'production' 
  } = useCase;
  
  // If memory budget is specified, prioritize that
  if (memoryBudgetMB) {
    return getMemoryBudgetHLLConfig(memoryBudgetMB);
  }
  
  // If expected cardinality is known, optimize for accuracy
  if (expectedCardinality) {
    return getOptimalHLLConfig(expectedCardinality, errorTolerance);
  }
  
  // If RPS is specified, optimize for performance
  if (requestsPerSecond) {
    return getPerformanceTunedHLLConfig(requestsPerSecond);
  }
  
  // Default to environment-based configuration
  switch (environment) {
    case 'development':
      return getDevelopmentHLLConfig();
    case 'testing':
      return getMemoryEfficientHLLConfig();
    case 'production':
    default:
      return getDefaultHLLConfig();
  }
};
