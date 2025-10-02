/**
 * Rate Limiting Configuration
 * Environment-based configuration for different scenarios
 */

import {
  RateLimitManagerConfig,
  RateLimitPolicy,
  RateLimitConfig,
  ThreatBasedAdjustment,
  GeographicRateRule,
  TemporalRateRule,
  ThreatLevel,
  UserProfile,
  GeographicZone,
  TimePattern
} from '@/types/rateLimit';

/**
 * Default rate limiting configuration
 */
export function getDefaultRateLimitConfig(): RateLimitConfig {
  return {
    algorithm: 'adaptive_hybrid',
    baseLimit: 1000,
    timeWindowMs: 60000, // 1 minute
    burstLimit: 1200,
    replenishRate: 16.67, // ~1000 per minute
    enabled: true,
    description: 'Default rate limiting configuration'
  };
}

/**
 * High-performance rate limiting configuration
 */
export function getHighPerformanceRateLimitConfig(): RateLimitConfig {
  return {
    algorithm: 'token_bucket',
    baseLimit: 5000,
    timeWindowMs: 60000,
    burstLimit: 6000,
    replenishRate: 83.33, // ~5000 per minute
    enabled: true,
    description: 'High-performance rate limiting for VIP users'
  };
}

/**
 * Strict security rate limiting configuration
 */
export function getStrictSecurityRateLimitConfig(): RateLimitConfig {
  return {
    algorithm: 'sliding_window',
    baseLimit: 100,
    timeWindowMs: 60000,
    burstLimit: 50,
    replenishRate: 1.67, // ~100 per minute
    enabled: true,
    description: 'Strict security rate limiting for high-risk scenarios'
  };
}

/**
 * Authentication rate limiting configuration
 */
export function getAuthenticationRateLimitConfig(): RateLimitConfig {
  return {
    algorithm: 'sliding_window',
    baseLimit: parseInt(process.env.AUTH_RATE_LIMIT_BASE || '5'),
    timeWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '300000'), // 5 minutes
    burstLimit: parseInt(process.env.AUTH_RATE_LIMIT_BURST || '10'),
    replenishRate: parseFloat(process.env.AUTH_RATE_LIMIT_REPLENISH || '0.0167'), // ~5 per 5 minutes
    enabled: process.env.AUTH_RATE_LIMIT_ENABLED !== 'false',
    description: 'Authentication endpoint rate limiting'
  };
}

/**
 * Development rate limiting configuration
 */
export function getDevelopmentRateLimitConfig(): RateLimitConfig {
  return {
    algorithm: 'token_bucket',
    baseLimit: 10000,
    timeWindowMs: 60000,
    burstLimit: 12000,
    replenishRate: 166.67, // ~10000 per minute
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    description: 'Development rate limiting with relaxed limits'
  };
}

/**
 * Default threat-based adjustments
 */
export function getDefaultThreatAdjustments(): ThreatBasedAdjustment[] {
  return [
    {
      threatLevel: 'low',
      adjustmentFactor: parseFloat(process.env.RATE_LIMIT_THREAT_LOW_FACTOR || '1.2'),
      minLimit: parseInt(process.env.RATE_LIMIT_THREAT_LOW_MIN || '800'),
      maxLimit: parseInt(process.env.RATE_LIMIT_THREAT_LOW_MAX || '1500'),
      cooldownPeriod: parseInt(process.env.RATE_LIMIT_THREAT_LOW_COOLDOWN || '5')
    },
    {
      threatLevel: 'medium',
      adjustmentFactor: parseFloat(process.env.RATE_LIMIT_THREAT_MEDIUM_FACTOR || '0.8'),
      minLimit: parseInt(process.env.RATE_LIMIT_THREAT_MEDIUM_MIN || '500'),
      maxLimit: parseInt(process.env.RATE_LIMIT_THREAT_MEDIUM_MAX || '1000'),
      cooldownPeriod: parseInt(process.env.RATE_LIMIT_THREAT_MEDIUM_COOLDOWN || '10')
    },
    {
      threatLevel: 'high',
      adjustmentFactor: parseFloat(process.env.RATE_LIMIT_THREAT_HIGH_FACTOR || '0.3'),
      minLimit: parseInt(process.env.RATE_LIMIT_THREAT_HIGH_MIN || '100'),
      maxLimit: parseInt(process.env.RATE_LIMIT_THREAT_HIGH_MAX || '500'),
      cooldownPeriod: parseInt(process.env.RATE_LIMIT_THREAT_HIGH_COOLDOWN || '30')
    },
    {
      threatLevel: 'critical',
      adjustmentFactor: parseFloat(process.env.RATE_LIMIT_THREAT_CRITICAL_FACTOR || '0.1'),
      minLimit: parseInt(process.env.RATE_LIMIT_THREAT_CRITICAL_MIN || '10'),
      maxLimit: parseInt(process.env.RATE_LIMIT_THREAT_CRITICAL_MAX || '100'),
      cooldownPeriod: parseInt(process.env.RATE_LIMIT_THREAT_CRITICAL_COOLDOWN || '60')
    }
  ];
}

/**
 * Default user profile adjustments
 */
export function getDefaultUserAdjustments(): Record<UserProfile, number> {
  return {
    new: parseFloat(process.env.RATE_LIMIT_USER_NEW_FACTOR || '0.7'),
    trusted: parseFloat(process.env.RATE_LIMIT_USER_TRUSTED_FACTOR || '1.3'),
    suspicious: parseFloat(process.env.RATE_LIMIT_USER_SUSPICIOUS_FACTOR || '0.3'),
    vip: parseFloat(process.env.RATE_LIMIT_USER_VIP_FACTOR || '2.0'),
    blocked: parseFloat(process.env.RATE_LIMIT_USER_BLOCKED_FACTOR || '0.05')
  };
}

/**
 * Default geographic rules
 */
export function getDefaultGeographicRules(): GeographicRateRule[] {
  return [
    {
      countryCode: 'US',
      zone: 'safe',
      adjustmentFactor: 1.2,
      description: 'United States - Safe zone',
      lastUpdated: new Date()
    },
    {
      countryCode: 'CA',
      zone: 'safe',
      adjustmentFactor: 1.2,
      description: 'Canada - Safe zone',
      lastUpdated: new Date()
    },
    {
      countryCode: 'GB',
      zone: 'safe',
      adjustmentFactor: 1.2,
      description: 'United Kingdom - Safe zone',
      lastUpdated: new Date()
    },
    {
      countryCode: 'DE',
      zone: 'safe',
      adjustmentFactor: 1.1,
      description: 'Germany - Safe zone',
      lastUpdated: new Date()
    },
    {
      countryCode: 'FR',
      zone: 'safe',
      adjustmentFactor: 1.1,
      description: 'France - Safe zone',
      lastUpdated: new Date()
    },
    {
      countryCode: 'JP',
      zone: 'safe',
      adjustmentFactor: 1.1,
      description: 'Japan - Safe zone',
      lastUpdated: new Date()
    },
    {
      countryCode: 'AU',
      zone: 'safe',
      adjustmentFactor: 1.1,
      description: 'Australia - Safe zone',
      lastUpdated: new Date()
    },
    {
      countryCode: 'BR',
      zone: 'moderate',
      adjustmentFactor: 1.0,
      description: 'Brazil - Moderate zone',
      lastUpdated: new Date()
    },
    {
      countryCode: 'IN',
      zone: 'moderate',
      adjustmentFactor: 1.0,
      description: 'India - Moderate zone',
      lastUpdated: new Date()
    },
    {
      countryCode: 'MX',
      zone: 'moderate',
      adjustmentFactor: 1.0,
      description: 'Mexico - Moderate zone',
      lastUpdated: new Date()
    },
    {
      countryCode: 'CN',
      zone: 'high_risk',
      adjustmentFactor: 0.5,
      description: 'China - High risk zone',
      lastUpdated: new Date()
    },
    {
      countryCode: 'RU',
      zone: 'high_risk',
      adjustmentFactor: 0.4,
      description: 'Russia - High risk zone',
      lastUpdated: new Date()
    },
    {
      countryCode: 'KP',
      zone: 'blocked',
      adjustmentFactor: 0.1,
      description: 'North Korea - Blocked zone',
      lastUpdated: new Date()
    },
    {
      countryCode: 'IR',
      zone: 'high_risk',
      adjustmentFactor: 0.3,
      description: 'Iran - High risk zone',
      lastUpdated: new Date()
    },
    {
      countryCode: 'LOCAL',
      zone: 'safe',
      adjustmentFactor: 1.5,
      description: 'Local/Private networks - Safe zone',
      lastUpdated: new Date()
    },
    {
      countryCode: 'XX',
      zone: 'moderate',
      adjustmentFactor: 0.8,
      description: 'Unknown country - Moderate zone',
      lastUpdated: new Date()
    }
  ];
}

/**
 * Default temporal rules
 */
export function getDefaultTemporalRules(): TemporalRateRule[] {
  return [
    {
      pattern: 'peak_hours',
      timeRanges: [
        {
          startHour: 9,
          endHour: 17,
          daysOfWeek: [1, 2, 3, 4, 5] // Monday to Friday
        }
      ],
      adjustmentFactor: parseFloat(process.env.RATE_LIMIT_TEMPORAL_PEAK_FACTOR || '0.8'),
      description: 'Peak business hours - Reduced limits'
    },
    {
      pattern: 'off_hours',
      timeRanges: [
        {
          startHour: 18,
          endHour: 8,
          daysOfWeek: [1, 2, 3, 4, 5] // Monday to Friday
        },
        {
          startHour: 0,
          endHour: 23,
          daysOfWeek: [0, 6] // Sunday and Saturday
        }
      ],
      adjustmentFactor: parseFloat(process.env.RATE_LIMIT_TEMPORAL_OFF_FACTOR || '1.2'),
      description: 'Off hours - Increased limits'
    },
    {
      pattern: 'weekend',
      timeRanges: [
        {
          startHour: 0,
          endHour: 23,
          daysOfWeek: [0, 6] // Sunday and Saturday
        }
      ],
      adjustmentFactor: parseFloat(process.env.RATE_LIMIT_TEMPORAL_WEEKEND_FACTOR || '1.1'),
      description: 'Weekend - Slightly increased limits'
    },
    {
      pattern: 'holiday',
      timeRanges: [], // Would be dynamically populated based on calendar
      adjustmentFactor: parseFloat(process.env.RATE_LIMIT_TEMPORAL_HOLIDAY_FACTOR || '1.3'),
      description: 'Holidays - Increased limits'
    },
    {
      pattern: 'emergency',
      timeRanges: [], // Activated manually during emergencies
      adjustmentFactor: parseFloat(process.env.RATE_LIMIT_TEMPORAL_EMERGENCY_FACTOR || '0.2'),
      description: 'Emergency mode - Severely reduced limits'
    }
  ];
}

/**
 * Create default policy
 */
export function createDefaultPolicy(): RateLimitPolicy {
  return {
    policyId: 'default-policy',
    name: 'Default Rate Limiting Policy',
    description: 'Default rate limiting applied when no specific policy matches',
    enabled: true,
    priority: 1,
    conditions: {},
    limits: {
      base: getDefaultRateLimitConfig(),
      threatAdjustments: getDefaultThreatAdjustments(),
      userAdjustments: getDefaultUserAdjustments(),
      geographicAdjustments: {
        safe: 1.2,
        moderate: 1.0,
        high_risk: 0.5,
        blocked: 0.1
      },
      temporalAdjustments: {
        peak_hours: 0.8,
        off_hours: 1.2,
        weekend: 1.1,
        holiday: 1.3,
        emergency: 0.2
      }
    },
    actions: {
      onViolation: 'delay',
      escalationThreshold: parseInt(process.env.RATE_LIMIT_DEFAULT_ESCALATION_THRESHOLD || '5'),
      cooldownPeriod: parseInt(process.env.RATE_LIMIT_DEFAULT_COOLDOWN_PERIOD || '15'),
      notifyAdmin: process.env.RATE_LIMIT_DEFAULT_NOTIFY_ADMIN === 'true'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Get default rate limit manager configuration
 */
export function getDefaultRateLimitManagerConfig(): RateLimitManagerConfig {
  return {
    defaultPolicy: createDefaultPolicy(),
    policies: [], // Additional policies can be added
    globalSettings: {
      enableDistributed: process.env.RATE_LIMIT_DISTRIBUTED_ENABLED === 'true',
      redisKeyPrefix: process.env.RATE_LIMIT_REDIS_PREFIX || 'rl:',
      cleanupInterval: parseInt(process.env.RATE_LIMIT_CLEANUP_INTERVAL || '300000'), // 5 minutes
      metricsRetention: parseInt(process.env.RATE_LIMIT_METRICS_RETENTION_HOURS || '24'), // 24 hours
      maxMemoryUsage: parseInt(process.env.RATE_LIMIT_MAX_MEMORY_MB || '500') * 1024 * 1024 // 500MB
    },
    threatIntegration: {
      enabled: process.env.RATE_LIMIT_THREAT_INTEGRATION_ENABLED === 'true',
      dynamicAdjustment: process.env.RATE_LIMIT_DYNAMIC_ADJUSTMENT_ENABLED === 'true',
      adjustmentSpeed: parseFloat(process.env.RATE_LIMIT_ADJUSTMENT_SPEED || '0.5'),
      minThreatScore: parseFloat(process.env.RATE_LIMIT_MIN_THREAT_SCORE || '0.3')
    },
    userProfiling: {
      enabled: process.env.RATE_LIMIT_USER_PROFILING_ENABLED === 'true',
      learningPeriod: parseInt(process.env.RATE_LIMIT_LEARNING_PERIOD_DAYS || '7'),
      trustBuildingRate: parseFloat(process.env.RATE_LIMIT_TRUST_BUILDING_RATE || '0.1'),
      trustDecayRate: parseFloat(process.env.RATE_LIMIT_TRUST_DECAY_RATE || '0.05'),
      maxTrustScore: parseFloat(process.env.RATE_LIMIT_MAX_TRUST_SCORE || '1.0')
    },
    geographicRules: getDefaultGeographicRules(),
    temporalRules: getDefaultTemporalRules()
  };
}

/**
 * Get development configuration with relaxed limits
 */
export function getDevelopmentRateLimitManagerConfig(): RateLimitManagerConfig {
  const config = getDefaultRateLimitManagerConfig();
  
  // Relax limits for development
  config.defaultPolicy.limits.base = getDevelopmentRateLimitConfig();
  config.globalSettings.maxMemoryUsage = 1024 * 1024 * 1024; // 1GB for development
  
  // Enable all features for testing
  config.threatIntegration.enabled = true;
  config.threatIntegration.dynamicAdjustment = true;
  config.userProfiling.enabled = true;
  
  return config;
}

/**
 * Get production configuration with strict limits
 */
export function getProductionRateLimitManagerConfig(): RateLimitManagerConfig {
  const config = getDefaultRateLimitManagerConfig();
  
  // Use production values from environment
  config.globalSettings.enableDistributed = true; // Always use distributed in production
  config.threatIntegration.enabled = true;
  config.userProfiling.enabled = true;
  
  // Set conservative memory limits
  config.globalSettings.maxMemoryUsage = parseInt(process.env.RATE_LIMIT_MAX_MEMORY_MB || '200') * 1024 * 1024;
  
  return config;
}

/**
 * Get high-security configuration
 */
export function getHighSecurityRateLimitManagerConfig(): RateLimitManagerConfig {
  const config = getProductionRateLimitManagerConfig();
  
  // Use strict security base config
  config.defaultPolicy.limits.base = getStrictSecurityRateLimitConfig();
  
  // More aggressive threat adjustments
  config.defaultPolicy.limits.threatAdjustments = [
    {
      threatLevel: 'low',
      adjustmentFactor: 1.0, // No increase for low threat
      minLimit: 500,
      maxLimit: 1000,
      cooldownPeriod: 10
    },
    {
      threatLevel: 'medium',
      adjustmentFactor: 0.5, // 50% reduction
      minLimit: 250,
      maxLimit: 500,
      cooldownPeriod: 30
    },
    {
      threatLevel: 'high',
      adjustmentFactor: 0.2, // 80% reduction
      minLimit: 50,
      maxLimit: 200,
      cooldownPeriod: 120
    },
    {
      threatLevel: 'critical',
      adjustmentFactor: 0.05, // 95% reduction
      minLimit: 5,
      maxLimit: 50,
      cooldownPeriod: 300
    }
  ];
  
  // More restrictive geographic adjustments
  config.defaultPolicy.limits.geographicAdjustments = {
    safe: 1.0, // No bonus even for safe zones
    moderate: 0.7,
    high_risk: 0.2,
    blocked: 0.01
  };
  
  return config;
}

/**
 * Get the appropriate configuration based on environment
 */
export function getRateLimitConfiguration(): RateLimitManagerConfig {
  const environment = process.env.NODE_ENV || 'development';
  const securityMode = process.env.RATE_LIMIT_SECURITY_MODE || 'normal';
  
  switch (environment) {
    case 'production':
      return securityMode === 'high' 
        ? getHighSecurityRateLimitManagerConfig()
        : getProductionRateLimitManagerConfig();
    case 'staging':
      return getProductionRateLimitManagerConfig();
    case 'test':
      return getDevelopmentRateLimitManagerConfig();
    case 'development':
    default:
      return getDevelopmentRateLimitManagerConfig();
  }
}

/**
 * Validate configuration
 */
export function validateRateLimitConfiguration(config: RateLimitManagerConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check default policy
  if (!config.defaultPolicy) {
    errors.push('Default policy is required');
  } else {
    if (config.defaultPolicy.limits.base.baseLimit <= 0) {
      errors.push('Base limit must be greater than 0');
    }
    if (config.defaultPolicy.limits.base.timeWindowMs <= 0) {
      errors.push('Time window must be greater than 0');
    }
  }
  
  // Check global settings
  if (config.globalSettings.maxMemoryUsage <= 0) {
    errors.push('Max memory usage must be greater than 0');
  }
  
  if (config.globalSettings.cleanupInterval < 60000) {
    warnings.push('Cleanup interval less than 1 minute may impact performance');
  }
  
  // Check threat integration
  if (config.threatIntegration.adjustmentSpeed < 0 || config.threatIntegration.adjustmentSpeed > 1) {
    errors.push('Adjustment speed must be between 0 and 1');
  }
  
  // Check user profiling
  if (config.userProfiling.learningPeriod <= 0) {
    warnings.push('Learning period should be at least 1 day');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
