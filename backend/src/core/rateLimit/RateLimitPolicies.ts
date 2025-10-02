/**
 * Rate Limiting Policies Implementation
 * Defines and manages various rate limiting policies for different scenarios
 */

import {
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
import { logger } from '@/utils/logger';

export class RateLimitPolicies {
  private policies: Map<string, RateLimitPolicy>;
  private priorityIndex: RateLimitPolicy[];

  constructor() {
    this.policies = new Map();
    this.priorityIndex = [];
    this.initializeDefaultPolicies();
  }

  /**
   * Initialize default rate limiting policies
   */
  private initializeDefaultPolicies(): void {
    // General API Policy
    this.addPolicy(this.createGeneralAPIPolicy());
    
    // Authentication Policy
    this.addPolicy(this.createAuthenticationPolicy());
    
    // High-Risk Geographic Policy
    this.addPolicy(this.createHighRiskGeographicPolicy());
    
    // Emergency Response Policy
    this.addPolicy(this.createEmergencyResponsePolicy());
    
    // VIP User Policy
    this.addPolicy(this.createVIPUserPolicy());
    
    // Suspicious Activity Policy
    this.addPolicy(this.createSuspiciousActivityPolicy());
  }

  /**
   * Create general API rate limiting policy
   */
  private createGeneralAPIPolicy(): RateLimitPolicy {
    return {
      policyId: 'general-api',
      name: 'General API Rate Limiting',
      description: 'Standard rate limiting for general API endpoints',
      enabled: true,
      priority: 1,
      conditions: {
        endpoints: ['/api/*'],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        threatLevels: ['low', 'medium'],
        userProfiles: ['new', 'trusted'],
        geographicZones: ['safe', 'moderate'],
        timePatterns: ['peak_hours', 'off_hours']
      },
      limits: {
        base: {
          algorithm: 'adaptive_hybrid',
          baseLimit: 1000,
          timeWindowMs: 60000, // 1 minute
          burstLimit: 1200,
          replenishRate: 16.67, // ~1000 per minute
          enabled: true,
          description: 'General API base limits'
        },
        threatAdjustments: [
          {
            threatLevel: 'low',
            adjustmentFactor: 1.2, // 20% increase for low threat
            minLimit: 800,
            maxLimit: 1500,
            cooldownPeriod: 5
          },
          {
            threatLevel: 'medium',
            adjustmentFactor: 0.8, // 20% decrease for medium threat
            minLimit: 500,
            maxLimit: 1000,
            cooldownPeriod: 10
          },
          {
            threatLevel: 'high',
            adjustmentFactor: 0.3, // 70% decrease for high threat
            minLimit: 100,
            maxLimit: 500,
            cooldownPeriod: 30
          },
          {
            threatLevel: 'critical',
            adjustmentFactor: 0.1, // 90% decrease for critical threat
            minLimit: 10,
            maxLimit: 100,
            cooldownPeriod: 60
          }
        ],
        userAdjustments: {
          new: 0.7,        // 30% reduction for new users
          trusted: 1.3,    // 30% increase for trusted users
          suspicious: 0.3, // 70% reduction for suspicious users
          vip: 2.0,        // 100% increase for VIP users
          blocked: 0.05    // 95% reduction for blocked users
        },
        geographicAdjustments: {
          safe: 1.2,       // 20% increase for safe zones
          moderate: 1.0,   // No adjustment for moderate zones
          high_risk: 0.5,  // 50% reduction for high-risk zones
          blocked: 0.1     // 90% reduction for blocked zones
        },
        temporalAdjustments: {
          peak_hours: 0.8,   // 20% reduction during peak hours
          off_hours: 1.2,    // 20% increase during off hours
          weekend: 1.1,      // 10% increase on weekends
          holiday: 1.3,      // 30% increase on holidays
          emergency: 0.2     // 80% reduction during emergencies
        }
      },
      actions: {
        onViolation: 'delay',
        escalationThreshold: 5,
        cooldownPeriod: 15,
        notifyAdmin: false
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Create authentication-specific rate limiting policy
   */
  private createAuthenticationPolicy(): RateLimitPolicy {
    return {
      policyId: 'authentication',
      name: 'Authentication Rate Limiting',
      description: 'Strict rate limiting for authentication endpoints to prevent brute force attacks',
      enabled: true,
      priority: 10, // High priority
      conditions: {
        endpoints: ['/api/auth/login', '/api/auth/register', '/api/auth/reset-password'],
        methods: ['POST'],
        threatLevels: ['low', 'medium', 'high', 'critical'],
        userProfiles: ['new', 'trusted', 'suspicious', 'blocked'],
        geographicZones: ['safe', 'moderate', 'high_risk', 'blocked']
      },
      limits: {
        base: {
          algorithm: 'sliding_window',
          baseLimit: 5,
          timeWindowMs: 300000, // 5 minutes
          burstLimit: 10,
          replenishRate: 0.0167, // ~5 per 5 minutes
          enabled: true,
          description: 'Authentication base limits'
        },
        threatAdjustments: [
          {
            threatLevel: 'low',
            adjustmentFactor: 1.0,
            minLimit: 3,
            maxLimit: 10,
            cooldownPeriod: 5
          },
          {
            threatLevel: 'medium',
            adjustmentFactor: 0.6,
            minLimit: 2,
            maxLimit: 5,
            cooldownPeriod: 15
          },
          {
            threatLevel: 'high',
            adjustmentFactor: 0.2,
            minLimit: 1,
            maxLimit: 3,
            cooldownPeriod: 60
          },
          {
            threatLevel: 'critical',
            adjustmentFactor: 0.0,
            minLimit: 0,
            maxLimit: 1,
            cooldownPeriod: 300
          }
        ],
        userAdjustments: {
          new: 0.8,
          trusted: 1.2,
          suspicious: 0.2,
          vip: 1.5,
          blocked: 0.0
        },
        geographicAdjustments: {
          safe: 1.0,
          moderate: 0.8,
          high_risk: 0.3,
          blocked: 0.0
        },
        temporalAdjustments: {
          peak_hours: 0.8,
          off_hours: 1.0,
          weekend: 1.0,
          holiday: 1.0,
          emergency: 0.1
        }
      },
      actions: {
        onViolation: 'block',
        escalationThreshold: 3,
        cooldownPeriod: 60,
        notifyAdmin: true
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Create high-risk geographic policy
   */
  private createHighRiskGeographicPolicy(): RateLimitPolicy {
    return {
      policyId: 'high-risk-geographic',
      name: 'High-Risk Geographic Zones',
      description: 'Restrictive rate limiting for requests from high-risk geographic locations',
      enabled: true,
      priority: 8,
      conditions: {
        geographicZones: ['high_risk', 'blocked'],
        threatLevels: ['medium', 'high', 'critical']
      },
      limits: {
        base: {
          algorithm: 'token_bucket',
          baseLimit: 100,
          timeWindowMs: 60000,
          burstLimit: 50,
          replenishRate: 1.67,
          enabled: true,
          description: 'High-risk geographic base limits'
        },
        threatAdjustments: [
          {
            threatLevel: 'medium',
            adjustmentFactor: 0.5,
            minLimit: 25,
            maxLimit: 100,
            cooldownPeriod: 30
          },
          {
            threatLevel: 'high',
            adjustmentFactor: 0.2,
            minLimit: 10,
            maxLimit: 50,
            cooldownPeriod: 120
          },
          {
            threatLevel: 'critical',
            adjustmentFactor: 0.05,
            minLimit: 1,
            maxLimit: 10,
            cooldownPeriod: 300
          }
        ],
        userAdjustments: {
          new: 0.5,
          trusted: 0.8,
          suspicious: 0.1,
          vip: 1.0,
          blocked: 0.0
        },
        geographicAdjustments: {
          safe: 1.0,
          moderate: 0.8,
          high_risk: 0.3,
          blocked: 0.05
        },
        temporalAdjustments: {
          peak_hours: 0.7,
          off_hours: 1.0,
          weekend: 0.9,
          holiday: 0.9,
          emergency: 0.1
        }
      },
      actions: {
        onViolation: 'block',
        escalationThreshold: 2,
        cooldownPeriod: 120,
        notifyAdmin: true
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Create emergency response policy
   */
  private createEmergencyResponsePolicy(): RateLimitPolicy {
    return {
      policyId: 'emergency-response',
      name: 'Emergency Response Mode',
      description: 'Aggressive rate limiting during security incidents or attacks',
      enabled: false, // Disabled by default, activated during emergencies
      priority: 15, // Highest priority
      conditions: {
        timePatterns: ['emergency'],
        threatLevels: ['high', 'critical']
      },
      limits: {
        base: {
          algorithm: 'sliding_window',
          baseLimit: 50,
          timeWindowMs: 60000,
          burstLimit: 25,
          replenishRate: 0.83,
          enabled: true,
          description: 'Emergency response base limits'
        },
        threatAdjustments: [
          {
            threatLevel: 'high',
            adjustmentFactor: 0.3,
            minLimit: 5,
            maxLimit: 25,
            cooldownPeriod: 300
          },
          {
            threatLevel: 'critical',
            adjustmentFactor: 0.1,
            minLimit: 1,
            maxLimit: 10,
            cooldownPeriod: 600
          }
        ],
        userAdjustments: {
          new: 0.2,
          trusted: 0.5,
          suspicious: 0.05,
          vip: 0.8,
          blocked: 0.0
        },
        geographicAdjustments: {
          safe: 0.8,
          moderate: 0.5,
          high_risk: 0.1,
          blocked: 0.0
        },
        temporalAdjustments: {
          peak_hours: 0.5,
          off_hours: 0.7,
          weekend: 0.6,
          holiday: 0.6,
          emergency: 0.2
        }
      },
      actions: {
        onViolation: 'block',
        escalationThreshold: 1,
        cooldownPeriod: 300,
        notifyAdmin: true
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Create VIP user policy
   */
  private createVIPUserPolicy(): RateLimitPolicy {
    return {
      policyId: 'vip-users',
      name: 'VIP User Premium Access',
      description: 'Enhanced rate limits for VIP users with premium access',
      enabled: true,
      priority: 5,
      conditions: {
        userProfiles: ['vip'],
        threatLevels: ['low', 'medium']
      },
      limits: {
        base: {
          algorithm: 'token_bucket',
          baseLimit: 5000,
          timeWindowMs: 60000,
          burstLimit: 6000,
          replenishRate: 83.33,
          enabled: true,
          description: 'VIP user base limits'
        },
        threatAdjustments: [
          {
            threatLevel: 'low',
            adjustmentFactor: 1.5,
            minLimit: 3000,
            maxLimit: 10000,
            cooldownPeriod: 2
          },
          {
            threatLevel: 'medium',
            adjustmentFactor: 1.0,
            minLimit: 2000,
            maxLimit: 5000,
            cooldownPeriod: 5
          },
          {
            threatLevel: 'high',
            adjustmentFactor: 0.6,
            minLimit: 1000,
            maxLimit: 3000,
            cooldownPeriod: 15
          },
          {
            threatLevel: 'critical',
            adjustmentFactor: 0.3,
            minLimit: 500,
            maxLimit: 1500,
            cooldownPeriod: 30
          }
        ],
        userAdjustments: {
          new: 0.8,
          trusted: 1.0,
          suspicious: 0.5,
          vip: 1.5,
          blocked: 0.1
        },
        geographicAdjustments: {
          safe: 1.2,
          moderate: 1.0,
          high_risk: 0.7,
          blocked: 0.3
        },
        temporalAdjustments: {
          peak_hours: 1.0,
          off_hours: 1.2,
          weekend: 1.1,
          holiday: 1.3,
          emergency: 0.5
        }
      },
      actions: {
        onViolation: 'delay',
        escalationThreshold: 10,
        cooldownPeriod: 5,
        notifyAdmin: false
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Create suspicious activity policy
   */
  private createSuspiciousActivityPolicy(): RateLimitPolicy {
    return {
      policyId: 'suspicious-activity',
      name: 'Suspicious Activity Detection',
      description: 'Restrictive rate limiting for users exhibiting suspicious behavior',
      enabled: true,
      priority: 12,
      conditions: {
        userProfiles: ['suspicious', 'blocked'],
        threatLevels: ['medium', 'high', 'critical']
      },
      limits: {
        base: {
          algorithm: 'sliding_window',
          baseLimit: 20,
          timeWindowMs: 300000, // 5 minutes
          burstLimit: 10,
          replenishRate: 0.067,
          enabled: true,
          description: 'Suspicious activity base limits'
        },
        threatAdjustments: [
          {
            threatLevel: 'medium',
            adjustmentFactor: 0.5,
            minLimit: 5,
            maxLimit: 20,
            cooldownPeriod: 60
          },
          {
            threatLevel: 'high',
            adjustmentFactor: 0.2,
            minLimit: 2,
            maxLimit: 10,
            cooldownPeriod: 180
          },
          {
            threatLevel: 'critical',
            adjustmentFactor: 0.05,
            minLimit: 1,
            maxLimit: 5,
            cooldownPeriod: 600
          }
        ],
        userAdjustments: {
          new: 0.7,
          trusted: 1.0,
          suspicious: 0.3,
          vip: 0.8,
          blocked: 0.1
        },
        geographicAdjustments: {
          safe: 1.0,
          moderate: 0.8,
          high_risk: 0.4,
          blocked: 0.1
        },
        temporalAdjustments: {
          peak_hours: 0.6,
          off_hours: 0.8,
          weekend: 0.7,
          holiday: 0.7,
          emergency: 0.2
        }
      },
      actions: {
        onViolation: 'block',
        escalationThreshold: 2,
        cooldownPeriod: 180,
        notifyAdmin: true
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Add a new policy
   */
  addPolicy(policy: RateLimitPolicy): void {
    this.policies.set(policy.policyId, policy);
    this.rebuildPriorityIndex();
    
    logger.info('Rate limit policy added', {
      policyId: policy.policyId,
      name: policy.name,
      priority: policy.priority
    });
  }

  /**
   * Update an existing policy
   */
  updatePolicy(policyId: string, updates: Partial<RateLimitPolicy>): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    const updatedPolicy = { ...policy, ...updates, updatedAt: new Date() };
    this.policies.set(policyId, updatedPolicy);
    this.rebuildPriorityIndex();

    logger.info('Rate limit policy updated', {
      policyId,
      updates: Object.keys(updates)
    });

    return true;
  }

  /**
   * Remove a policy
   */
  removePolicy(policyId: string): boolean {
    const success = this.policies.delete(policyId);
    if (success) {
      this.rebuildPriorityIndex();
      logger.info('Rate limit policy removed', { policyId });
    }
    return success;
  }

  /**
   * Get a specific policy
   */
  getPolicy(policyId: string): RateLimitPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Get all policies
   */
  getAllPolicies(): RateLimitPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get policies by priority order
   */
  getPoliciesByPriority(): RateLimitPolicy[] {
    return [...this.priorityIndex];
  }

  /**
   * Find applicable policies for a request
   */
  findApplicablePolicies(conditions: {
    endpoint?: string;
    method?: string;
    threatLevel?: ThreatLevel;
    userProfile?: UserProfile;
    geographicZone?: GeographicZone;
    timePattern?: TimePattern;
  }): RateLimitPolicy[] {
    return this.priorityIndex.filter(policy => {
      if (!policy.enabled) return false;

      // Check endpoint match
      if (conditions.endpoint && policy.conditions.endpoints) {
        const matches = policy.conditions.endpoints.some(pattern => {
          if (pattern.endsWith('*')) {
            return conditions.endpoint!.startsWith(pattern.slice(0, -1));
          }
          return conditions.endpoint === pattern;
        });
        if (!matches) return false;
      }

      // Check method match
      if (conditions.method && policy.conditions.methods) {
        if (!policy.conditions.methods.includes(conditions.method)) return false;
      }

      // Check threat level match
      if (conditions.threatLevel && policy.conditions.threatLevels) {
        if (!policy.conditions.threatLevels.includes(conditions.threatLevel)) return false;
      }

      // Check user profile match
      if (conditions.userProfile && policy.conditions.userProfiles) {
        if (!policy.conditions.userProfiles.includes(conditions.userProfile)) return false;
      }

      // Check geographic zone match
      if (conditions.geographicZone && policy.conditions.geographicZones) {
        if (!policy.conditions.geographicZones.includes(conditions.geographicZone)) return false;
      }

      // Check time pattern match
      if (conditions.timePattern && policy.conditions.timePatterns) {
        if (!policy.conditions.timePatterns.includes(conditions.timePattern)) return false;
      }

      return true;
    });
  }

  /**
   * Enable/disable a policy
   */
  togglePolicy(policyId: string, enabled: boolean): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) return false;

    policy.enabled = enabled;
    policy.updatedAt = new Date();

    logger.info('Rate limit policy toggled', {
      policyId,
      enabled
    });

    return true;
  }

  /**
   * Get policy statistics
   */
  getPolicyStats(): {
    totalPolicies: number;
    enabledPolicies: number;
    disabledPolicies: number;
    byPriority: Record<number, number>;
  } {
    const policies = Array.from(this.policies.values());
    const enabled = policies.filter(p => p.enabled).length;
    
    const byPriority: Record<number, number> = {};
    policies.forEach(policy => {
      byPriority[policy.priority] = (byPriority[policy.priority] || 0) + 1;
    });

    return {
      totalPolicies: policies.length,
      enabledPolicies: enabled,
      disabledPolicies: policies.length - enabled,
      byPriority
    };
  }

  /**
   * Rebuild priority index for efficient lookups
   */
  private rebuildPriorityIndex(): void {
    this.priorityIndex = Array.from(this.policies.values())
      .sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  /**
   * Validate policy configuration
   */
  validatePolicy(policy: RateLimitPolicy): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!policy.policyId || policy.policyId.trim() === '') {
      errors.push('Policy ID is required');
    }

    if (!policy.name || policy.name.trim() === '') {
      errors.push('Policy name is required');
    }

    if (policy.priority < 0 || policy.priority > 20) {
      errors.push('Policy priority must be between 0 and 20');
    }

    if (policy.limits.base.baseLimit <= 0) {
      errors.push('Base limit must be greater than 0');
    }

    if (policy.limits.base.timeWindowMs <= 0) {
      errors.push('Time window must be greater than 0');
    }

    if (policy.actions.escalationThreshold < 1) {
      errors.push('Escalation threshold must be at least 1');
    }

    if (policy.actions.cooldownPeriod < 0) {
      errors.push('Cooldown period cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
