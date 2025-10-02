/**
 * Adaptive Rate Limiting Types and Interfaces
 * Supports threat-based, user-specific, geographic, and temporal rate limiting
 */

export type RateLimitAlgorithm = 'token_bucket' | 'sliding_window' | 'adaptive_hybrid';

export type ThreatLevel = 'low' | 'medium' | 'high' | 'critical';

export type UserProfile = 'new' | 'trusted' | 'suspicious' | 'vip' | 'blocked';

export type GeographicZone = 'safe' | 'moderate' | 'high_risk' | 'blocked';

export type TimePattern = 'peak_hours' | 'off_hours' | 'weekend' | 'holiday' | 'emergency';

export interface RateLimitConfig {
  algorithm: RateLimitAlgorithm;
  baseLimit: number;              // Base requests per time window
  timeWindowMs: number;           // Time window in milliseconds
  burstLimit: number;             // Maximum burst allowance
  replenishRate: number;          // Token replenishment rate (tokens per second)
  enabled: boolean;               // Enable/disable this rate limiter
  description: string;            // Human-readable description
}

export interface ThreatBasedAdjustment {
  threatLevel: ThreatLevel;
  adjustmentFactor: number;       // Multiplier for rate limits (0.1 = 90% reduction)
  minLimit: number;               // Minimum allowable limit
  maxLimit: number;               // Maximum allowable limit
  cooldownPeriod: number;         // Minutes before adjustment can be relaxed
}

export interface UserRateProfile {
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userProfile: UserProfile;
  baselineRequests: number;       // Historical average requests per window
  trustScore: number;             // Trust score (0-1)
  violationCount: number;         // Number of rate limit violations
  lastViolation: Date | null;     // Last rate limit violation
  currentAdjustment: number;      // Current adjustment factor
  profileUpdated: Date;           // Last profile update
}

export interface GeographicRateRule {
  countryCode: string;
  zone: GeographicZone;
  adjustmentFactor: number;       // Multiplier for rate limits
  description: string;
  lastUpdated: Date;
}

export interface TemporalRateRule {
  pattern: TimePattern;
  timeRanges: Array<{
    startHour: number;            // 0-23
    endHour: number;              // 0-23
    daysOfWeek: number[];         // 0-6 (Sunday-Saturday)
  }>;
  adjustmentFactor: number;
  description: string;
}

export interface RateLimitRequest {
  identifier: string;             // User/IP/Session identifier
  endpoint: string;               // API endpoint or resource
  method: string;                 // HTTP method
  ipAddress: string;
  userAgent?: string;
  userId?: string;
  sessionId?: string;
  threatScore?: number;           // Current threat score (0-1)
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: Date;
  retryAfter?: number;            // Seconds until next request allowed
  limitApplied: number;           // Actual limit applied
  reason?: string;                // Reason for denial
  adjustments: {
    threatBased: number;
    userBased: number;
    geographic: number;
    temporal: number;
    final: number;
  };
  metadata: {
    algorithm: RateLimitAlgorithm;
    windowStart: Date;
    windowEnd: Date;
    requestCount: number;
    burstUsed: number;
  };
}

export interface RateLimitViolation {
  identifier: string;
  endpoint: string;
  ipAddress: string;
  timestamp: Date;
  requestCount: number;
  limitApplied: number;
  exceedBy: number;               // How much the limit was exceeded
  threatScore?: number;
  userProfile?: UserProfile;
  countryCode?: string;
  action: 'blocked' | 'delayed' | 'logged';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface RateLimitMetrics {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  violationRate: number;          // Percentage of requests that violate limits
  averageResponseTime: number;    // Average rate limit check time
  effectivenessScore: number;     // Overall effectiveness (0-1)
  falsePositiveRate: number;      // Estimated false positive rate
  memoryUsage: number;            // Memory usage in bytes
  lastUpdated: Date;
}

export interface RateLimitAnalytics {
  timeWindow: {
    start: Date;
    end: Date;
    duration: number;             // Duration in milliseconds
  };
  overallMetrics: RateLimitMetrics;
  byEndpoint: Record<string, RateLimitMetrics>;
  byCountry: Record<string, RateLimitMetrics>;
  byUserProfile: Record<UserProfile, RateLimitMetrics>;
  byThreatLevel: Record<ThreatLevel, RateLimitMetrics>;
  topViolators: Array<{
    identifier: string;
    ipAddress: string;
    violationCount: number;
    lastViolation: Date;
    countryCode?: string;
  }>;
  trends: {
    requestTrend: 'increasing' | 'decreasing' | 'stable';
    violationTrend: 'increasing' | 'decreasing' | 'stable';
    effectivenessTrend: 'improving' | 'degrading' | 'stable';
  };
  recommendations: string[];
}

export interface RateLimitPolicy {
  policyId: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;               // Higher number = higher priority
  conditions: {
    endpoints?: string[];         // Specific endpoints to apply to
    methods?: string[];           // HTTP methods
    threatLevels?: ThreatLevel[]; // Threat levels to apply to
    userProfiles?: UserProfile[]; // User profiles to apply to
    geographicZones?: GeographicZone[];
    timePatterns?: TimePattern[];
  };
  limits: {
    base: RateLimitConfig;
    threatAdjustments: ThreatBasedAdjustment[];
    userAdjustments: Record<UserProfile, number>; // Adjustment factors
    geographicAdjustments: Record<GeographicZone, number>;
    temporalAdjustments: Record<TimePattern, number>;
  };
  actions: {
    onViolation: 'block' | 'delay' | 'log' | 'escalate';
    escalationThreshold: number;  // Number of violations before escalation
    cooldownPeriod: number;       // Minutes before allowing normal rates
    notifyAdmin: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitState {
  identifier: string;
  algorithm: RateLimitAlgorithm;
  // Token Bucket State
  tokens: number;
  lastRefill: Date;
  // Sliding Window State
  requests: Array<{
    timestamp: Date;
    count: number;
  }>;
  // General State
  windowStart: Date;
  requestCount: number;
  lastRequest: Date;
  currentLimit: number;
  violationCount: number;
  metadata: Record<string, any>;
}

export interface RateLimitManagerConfig {
  defaultPolicy: RateLimitPolicy;
  policies: RateLimitPolicy[];
  globalSettings: {
    enableDistributed: boolean;
    redisKeyPrefix: string;
    cleanupInterval: number;      // Cleanup interval in milliseconds
    metricsRetention: number;     // Metrics retention in hours
    maxMemoryUsage: number;       // Maximum memory usage in bytes
  };
  threatIntegration: {
    enabled: boolean;
    dynamicAdjustment: boolean;
    adjustmentSpeed: number;      // How quickly to adjust (0-1)
    minThreatScore: number;       // Minimum threat score to trigger adjustment
  };
  userProfiling: {
    enabled: boolean;
    learningPeriod: number;       // Days to establish baseline
    trustBuildingRate: number;    // Rate at which trust is built (0-1)
    trustDecayRate: number;       // Rate at which trust decays (0-1)
    maxTrustScore: number;        // Maximum achievable trust score
  };
  geographicRules: GeographicRateRule[];
  temporalRules: TemporalRateRule[];
}

export interface RateLimitHealth {
  isHealthy: boolean;
  status: 'healthy' | 'warning' | 'critical' | 'error';
  issues: Array<{
    component: 'algorithm' | 'redis' | 'memory' | 'performance' | 'policies';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    suggestion: string;
  }>;
  metrics: {
    responseTime: number;         // Average response time
    memoryUsage: number;          // Current memory usage
    errorRate: number;            // Error rate
    effectivenessScore: number;   // Overall effectiveness
  };
  lastCheck: Date;
}

export interface RateLimitInsight {
  type: 'abuse_pattern' | 'policy_optimization' | 'performance_issue' | 'geographic_threat' | 'temporal_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  confidence: number;
  data: {
    identifier?: string;
    endpoint?: string;
    countryCode?: string;
    violationCount?: number;
    timePattern?: string;
    recommendation?: string;
  };
  recommendations: string[];
  timestamp: Date;
  affectedRequests: number;
}

export interface RateLimitOptimization {
  currentEffectiveness: number;
  optimizations: Array<{
    type: 'policy_adjustment' | 'threshold_tuning' | 'algorithm_change' | 'geographic_update';
    description: string;
    expectedImprovement: number;  // Expected effectiveness improvement
    confidence: number;
    implementation: {
      difficulty: 'easy' | 'medium' | 'hard';
      riskLevel: 'low' | 'medium' | 'high';
      estimatedTime: string;
    };
  }>;
  recommendations: {
    immediate: string[];          // Actions to take immediately
    shortTerm: string[];          // Actions for next week
    longTerm: string[];           // Actions for next month
  };
}

export interface RateLimitIntegrationData {
  currentLimits: Record<string, number>; // endpoint -> current limit
  adjustmentFactors: {
    threatBased: number;
    userBased: number;
    geographic: number;
    temporal: number;
    overall: number;
  };
  recentViolations: RateLimitViolation[];
  effectiveness: {
    score: number;
    trend: 'improving' | 'stable' | 'degrading';
    lastUpdated: Date;
  };
  insights: RateLimitInsight[];
  recommendations: string[];
  healthStatus: 'healthy' | 'warning' | 'critical';
  threatMitigation: {
    attacksBlocked: number;
    legitimateRequestsAllowed: number;
    falsePositiveRate: number;
  };
}
