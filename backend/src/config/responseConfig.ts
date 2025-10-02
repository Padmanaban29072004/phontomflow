import { ResponseConfiguration, ResponseTier } from '@/types/response';

/**
 * Default response configuration for PHANTOM-Flow
 * This configuration defines the graduated response tiers and their associated actions
 */
export const getDefaultResponseConfiguration = (): ResponseConfiguration => {
  // Get configuration from environment variables with sensible defaults
  const riskThresholdLow = parseFloat(process.env.RISK_THRESHOLD_LOW || '0.3');
  const riskThresholdMedium = parseFloat(process.env.RISK_THRESHOLD_MEDIUM || '0.5');
  const riskThresholdHigh = parseFloat(process.env.RISK_THRESHOLD_HIGH || '0.7');
  const riskThresholdCritical = parseFloat(process.env.RISK_THRESHOLD_CRITICAL || '0.85');

  const tiers: ResponseTier[] = [
    // MONITOR TIER - Passive monitoring (0.0 - 0.3)
    {
      level: 'monitor',
      name: 'Passive Monitoring',
      description: 'Low-risk activity requiring passive monitoring only',
      threshold: {
        min: 0.0,
        max: riskThresholdLow
      },
      actions: [
        {
          type: 'log_only',
          severity: 1,
          enabled: true,
          config: {}
        }
      ],
      escalationDelay: 300000, // 5 minutes
      cooldownPeriod: 60000    // 1 minute
    },

    // WARN TIER - Active monitoring with light restrictions (0.3 - 0.5)
    {
      level: 'warn',
      name: 'Active Warning',
      description: 'Moderate risk requiring active monitoring and light rate limiting',
      threshold: {
        min: riskThresholdLow,
        max: riskThresholdMedium
      },
      actions: [
        {
          type: 'log_only',
          severity: 1,
          enabled: true,
          config: {}
        },
        {
          type: 'rate_limit',
          severity: 2,
          enabled: true,
          config: {
            rateLimit: {
              requests: 100,
              window: 60000, // 1 minute
              burst: 10
            }
          }
        }
      ],
      escalationDelay: 180000, // 3 minutes
      cooldownPeriod: 120000   // 2 minutes
    },

    // RESTRICT TIER - Moderate restrictions (0.5 - 0.7)
    {
      level: 'restrict',
      name: 'Moderate Restriction',
      description: 'High risk requiring rate limiting and admin alerts',
      threshold: {
        min: riskThresholdMedium,
        max: riskThresholdHigh
      },
      actions: [
        {
          type: 'log_only',
          severity: 1,
          enabled: true,
          config: {}
        },
        {
          type: 'rate_limit',
          severity: 2,
          enabled: true,
          config: {
            rateLimit: {
              requests: 30,
              window: 60000, // 1 minute
              burst: 5
            }
          }
        },
        {
          type: 'alert_admin',
          severity: 4,
          enabled: true,
          config: {
            alert: {
              channels: ['email', 'webhook'],
              priority: 'medium',
              aggregation: true
            }
          }
        }
      ],
      escalationDelay: 120000, // 2 minutes
      cooldownPeriod: 300000   // 5 minutes
    },

    // BLOCK TIER - Strong restrictions with temporary blocking (0.7 - 0.85)
    {
      level: 'block',
      name: 'Temporary Block',
      description: 'Very high risk requiring temporary blocking',
      threshold: {
        min: riskThresholdHigh,
        max: riskThresholdCritical
      },
      actions: [
        {
          type: 'log_only',
          severity: 1,
          enabled: true,
          config: {}
        },
        {
          type: 'temporary_block',
          severity: 8,
          enabled: true,
          config: {
            block: {
              duration: 900000, // 15 minutes
              message: 'Access temporarily restricted due to suspicious activity',
              redirectUrl: '/security-notice'
            }
          }
        },
        {
          type: 'alert_admin',
          severity: 9,
          enabled: true,
          config: {
            alert: {
              channels: ['email', 'webhook'],
              priority: 'high',
              aggregation: false
            }
          }
        }
      ],
      escalationDelay: 60000,  // 1 minute
      cooldownPeriod: 600000   // 10 minutes
    },

    // ISOLATE TIER - Maximum security response (0.85 - 1.0)
    {
      level: 'isolate',
      name: 'Security Isolation',
      description: 'Critical threat requiring immediate isolation and investigation',
      threshold: {
        min: riskThresholdCritical,
        max: 1.0
      },
      actions: [
        {
          type: 'log_only',
          severity: 1,
          enabled: true,
          config: {}
        },
        {
          type: 'temporary_block',
          severity: 10,
          enabled: true,
          config: {
            block: {
              duration: 3600000, // 1 hour
              message: 'Access denied due to security violation. Contact administrator.',
              redirectUrl: '/security-violation'
            }
          }
        },
        {
          type: 'alert_admin',
          severity: 10,
          enabled: true,
          config: {
            alert: {
              channels: ['email', 'webhook'],
              priority: 'critical',
              aggregation: false
            }
          }
        }
      ],
      escalationDelay: 30000,  // 30 seconds
      cooldownPeriod: 1800000  // 30 minutes
    }
  ];

  return {
    enabled: process.env.RESPONSE_SYSTEM_ENABLED !== 'false',
    defaultTier: (process.env.DEFAULT_RESPONSE_TIER as any) || 'monitor',
    tiers,
    globalSettings: {
      maxEscalationsPerSession: parseInt(process.env.MAX_ESCALATIONS_PER_SESSION || '5'),
      defaultCooldownPeriod: parseInt(process.env.DEFAULT_COOLDOWN_PERIOD || '300000'), // 5 minutes
      responseTimeout: parseInt(process.env.RESPONSE_TIMEOUT || '10000'), // 10 seconds
      enableAdaptiveLearning: process.env.ENABLE_ADAPTIVE_LEARNING !== 'false',
      metricsRetentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '30')
    },
    adaptiveLearning: {
      enabled: process.env.ADAPTIVE_LEARNING_ENABLED !== 'false',
      learningRate: parseFloat(process.env.LEARNING_RATE || '0.01'),
      feedbackThreshold: parseFloat(process.env.FEEDBACK_THRESHOLD || '0.8'),
      retrainInterval: parseInt(process.env.RETRAIN_INTERVAL || '86400000') // 24 hours
    }
  };
};

/**
 * Development-specific configuration with more lenient settings
 */
export const getDevelopmentResponseConfiguration = (): ResponseConfiguration => {
  const config = getDefaultResponseConfiguration();
  
  // Make development more lenient
  config.tiers.forEach(tier => {
    // Reduce block durations for development
    tier.actions.forEach(action => {
      if (action.type === 'temporary_block' && action.config.block) {
        action.config.block.duration = Math.min(action.config.block.duration, 60000); // Max 1 minute in dev
      }
      
      // Increase rate limits for development
      if (action.type === 'rate_limit' && action.config.rateLimit) {
        action.config.rateLimit.requests *= 2; // Double the rate limits
      }
      
      // Disable some actions in development
      if (action.type === 'alert_admin') {
        action.enabled = false; // Don't spam alerts in development
      }
    });
    
    // Reduce cooldown periods
    tier.cooldownPeriod = Math.min(tier.cooldownPeriod || 60000, 30000); // Max 30 seconds in dev
  });
  
  return config;
};

/**
 * Get appropriate configuration based on environment
 */
export const getResponseConfiguration = (): ResponseConfiguration => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    return getDevelopmentResponseConfiguration();
  }
  
  return getDefaultResponseConfiguration();
};
