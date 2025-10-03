/**
 * Adaptive Rate Limiter Implementation
 * Supports Token Bucket, Sliding Window, and Adaptive Hybrid algorithms
 * with threat-based dynamic adjustments
 */

import {
  RateLimitConfig,
  RateLimitRequest,
  RateLimitResult,
  RateLimitState,
  RateLimitAlgorithm,
  ThreatLevel,
  UserProfile,
  GeographicZone,
  TimePattern,
  ThreatBasedAdjustment,
  UserRateProfile,
  GeographicRateRule,
  TemporalRateRule
} from '@/types/rateLimit';
import { RedisService } from '@/services/RedisService';
import { logger } from '@/utils/logger';

export class AdaptiveRateLimiter {
  private redisService: RedisService;
  private config: RateLimitConfig;
  private threatAdjustments: Map<ThreatLevel, ThreatBasedAdjustment>;
  private userAdjustments: Map<UserProfile, number>;
  private geographicRules: Map<string, GeographicRateRule>;
  private temporalRules: TemporalRateRule[];
  private localCache: Map<string, RateLimitState>;
  private cacheSize: number = 1000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    redisService: RedisService,
    config: RateLimitConfig,
    threatAdjustments: ThreatBasedAdjustment[] = [],
    userAdjustments: Record<UserProfile, number> = {},
    geographicRules: GeographicRateRule[] = [],
    temporalRules: TemporalRateRule[] = []
  ) {
    this.redisService = redisService;
    this.config = config;
    this.threatAdjustments = new Map(
      threatAdjustments.map(adj => [adj.threatLevel, adj])
    );
    this.userAdjustments = new Map(Object.entries(userAdjustments) as [UserProfile, number][]);
    this.geographicRules = new Map(
      geographicRules.map(rule => [rule.countryCode, rule])
    );
    this.temporalRules = temporalRules;
    this.localCache = new Map();

    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Check if a request is allowed based on rate limits
   */
  async checkRateLimit(request: RateLimitRequest): Promise<RateLimitResult> {
    const startTime = process.hrtime.bigint();

    try {
      // Get current state
      const state = await this.getState(request.identifier);
      
      // Calculate dynamic adjustments
      const adjustments = await this.calculateAdjustments(request);
      
      // Apply adjustments to get final limit
      const finalLimit = Math.max(1, Math.floor(this.config.baseLimit * adjustments.final));
      
      // Check rate limit based on algorithm
      let result: RateLimitResult;
      
      switch (this.config.algorithm) {
        case 'token_bucket':
          result = await this.checkTokenBucket(request, state, finalLimit, adjustments);
          break;
        case 'sliding_window':
          result = await this.checkSlidingWindow(request, state, finalLimit, adjustments);
          break;
        case 'adaptive_hybrid':
          result = await this.checkAdaptiveHybrid(request, state, finalLimit, adjustments);
          break;
        default:
          throw new Error(`Unknown algorithm: ${this.config.algorithm}`);
      }

      // Update state
      await this.updateState(request.identifier, state, result);
      
      // Track metrics
      const endTime = process.hrtime.bigint();
      const latencyMs = Number(endTime - startTime) / 1000000;
      
      logger.debug('Rate limit check completed', {
        identifier: request.identifier,
        allowed: result.allowed,
        algorithm: this.config.algorithm,
        finalLimit,
        adjustments,
        latencyMs
      });

      return result;

    } catch (error) {
      logger.error('Rate limit check failed', {
        identifier: request.identifier,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Fail open for availability
      return this.createFailOpenResult(request);
    }
  }

  /**
   * Token Bucket algorithm implementation
   */
  private async checkTokenBucket(
    request: RateLimitRequest,
    state: RateLimitState,
    limit: number,
    adjustments: any
  ): Promise<RateLimitResult> {
    const now = new Date();
    const timeSinceLastRefill = now.getTime() - state.lastRefill.getTime();
    const tokensToAdd = Math.floor(timeSinceLastRefill * this.config.replenishRate / 1000);
    
    // Refill tokens
    state.tokens = Math.min(limit, state.tokens + tokensToAdd);
    state.lastRefill = now;

    const allowed = state.tokens >= 1;
    
    if (allowed) {
      state.tokens -= 1;
      state.requestCount += 1;
      state.lastRequest = now;
    }

    const resetTime = new Date(now.getTime() + 
      Math.ceil((1 - state.tokens) / this.config.replenishRate) * 1000);

    return {
      allowed,
      remainingRequests: Math.floor(state.tokens),
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil((1 - state.tokens) / this.config.replenishRate),
      limitApplied: limit,
      reason: allowed ? undefined : 'Rate limit exceeded (Token Bucket)',
      adjustments,
      metadata: {
        algorithm: 'token_bucket',
        windowStart: state.windowStart,
        windowEnd: resetTime,
        requestCount: state.requestCount,
        burstUsed: limit - state.tokens
      }
    };
  }

  /**
   * Sliding Window algorithm implementation
   */
  private async checkSlidingWindow(
    request: RateLimitRequest,
    state: RateLimitState,
    limit: number,
    adjustments: any
  ): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.timeWindowMs);
    
    // Clean old requests
    state.requests = state.requests.filter(req => req.timestamp >= windowStart);
    
    // Count current requests in window
    const currentCount = state.requests.reduce((sum, req) => sum + req.count, 0);
    const allowed = currentCount < limit;
    
    if (allowed) {
      // Add current request
      const existingReq = state.requests.find(req => 
        req.timestamp.getTime() === now.getTime()
      );
      
      if (existingReq) {
        existingReq.count += 1;
      } else {
        state.requests.push({ timestamp: now, count: 1 });
      }
      
      state.requestCount += 1;
      state.lastRequest = now;
    }

    const resetTime = new Date(
      state.requests.length > 0 ? 
      state.requests[0].timestamp.getTime() + this.config.timeWindowMs :
      now.getTime() + this.config.timeWindowMs
    );

    return {
      allowed,
      remainingRequests: Math.max(0, limit - currentCount - (allowed ? 1 : 0)),
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil(
        (resetTime.getTime() - now.getTime()) / 1000
      ),
      limitApplied: limit,
      reason: allowed ? undefined : 'Rate limit exceeded (Sliding Window)',
      adjustments,
      metadata: {
        algorithm: 'sliding_window',
        windowStart,
        windowEnd: new Date(now.getTime() + this.config.timeWindowMs),
        requestCount: currentCount + (allowed ? 1 : 0),
        burstUsed: 0
      }
    };
  }

  /**
   * Adaptive Hybrid algorithm (combines Token Bucket and Sliding Window)
   */
  private async checkAdaptiveHybrid(
    request: RateLimitRequest,
    state: RateLimitState,
    limit: number,
    adjustments: any
  ): Promise<RateLimitResult> {
    // Use Token Bucket for burst handling
    const tokenResult = await this.checkTokenBucket(request, { ...state }, limit, adjustments);
    
    // Use Sliding Window for precise rate limiting
    const windowResult = await this.checkSlidingWindow(request, { ...state }, limit, adjustments);
    
    // Both must allow the request
    const allowed = tokenResult.allowed && windowResult.allowed;
    
    // Use the more restrictive result
    const restrictiveResult = tokenResult.remainingRequests < windowResult.remainingRequests ? 
      tokenResult : windowResult;

    return {
      allowed,
      remainingRequests: Math.min(tokenResult.remainingRequests, windowResult.remainingRequests),
      resetTime: new Date(Math.min(tokenResult.resetTime.getTime(), windowResult.resetTime.getTime())),
      retryAfter: allowed ? undefined : Math.max(
        tokenResult.retryAfter || 0,
        windowResult.retryAfter || 0
      ),
      limitApplied: limit,
      reason: allowed ? undefined : 'Rate limit exceeded (Adaptive Hybrid)',
      adjustments,
      metadata: {
        algorithm: 'adaptive_hybrid',
        windowStart: restrictiveResult.metadata.windowStart,
        windowEnd: restrictiveResult.metadata.windowEnd,
        requestCount: Math.max(tokenResult.metadata.requestCount, windowResult.metadata.requestCount),
        burstUsed: tokenResult.metadata.burstUsed
      }
    };
  }

  /**
   * Calculate dynamic adjustments based on various factors
   */
  private async calculateAdjustments(request: RateLimitRequest): Promise<{
    threatBased: number;
    userBased: number;
    geographic: number;
    temporal: number;
    final: number;
  }> {
    // Threat-based adjustment
    const threatBased = this.calculateThreatAdjustment(request.threatScore || 0);
    
    // User-based adjustment
    const userBased = await this.calculateUserAdjustment(request);
    
    // Geographic adjustment
    const geographic = this.calculateGeographicAdjustment(request.ipAddress);
    
    // Temporal adjustment
    const temporal = this.calculateTemporalAdjustment(request.timestamp);
    
    // Final adjustment (product of all factors)
    const final = threatBased * userBased * geographic * temporal;

    return { threatBased, userBased, geographic, temporal, final };
  }

  /**
   * Calculate threat-based adjustment
   */
  private calculateThreatAdjustment(threatScore: number): number {
    let threatLevel: ThreatLevel;
    
    if (threatScore < 0.3) threatLevel = 'low';
    else if (threatScore < 0.6) threatLevel = 'medium';
    else if (threatScore < 0.8) threatLevel = 'high';
    else threatLevel = 'critical';

    const adjustment = this.threatAdjustments.get(threatLevel);
    return adjustment ? adjustment.adjustmentFactor : 1.0;
  }

  /**
   * Calculate user-based adjustment
   */
  private async calculateUserAdjustment(request: RateLimitRequest): Promise<number> {
    try {
      const userProfile = await this.getUserProfile(request);
      if (!userProfile) return 1.0;

      const baseAdjustment = this.userAdjustments.get(userProfile.userProfile) || 1.0;
      const trustAdjustment = 0.5 + (userProfile.trustScore * 0.5); // 0.5 to 1.0 based on trust
      
      return baseAdjustment * trustAdjustment;
    } catch (error) {
      logger.warn('Failed to calculate user adjustment', { error });
      return 1.0;
    }
  }

  /**
   * Calculate geographic adjustment
   */
  private calculateGeographicAdjustment(ipAddress: string): number {
    try {
      // Simple country detection (in production, use a proper IP geolocation service)
      const countryCode = this.getCountryFromIP(ipAddress);
      const rule = this.geographicRules.get(countryCode);
      return rule ? rule.adjustmentFactor : 1.0;
    } catch (error) {
      logger.warn('Failed to calculate geographic adjustment', { error });
      return 1.0;
    }
  }

  /**
   * Calculate temporal adjustment
   */
  private calculateTemporalAdjustment(timestamp: Date): number {
    const timePattern = this.getTimePattern(timestamp);
    const rule = this.temporalRules.find(r => r.pattern === timePattern);
    return rule ? rule.adjustmentFactor : 1.0;
  }

  /**
   * Get current time pattern
   */
  private getTimePattern(timestamp: Date): TimePattern {
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay();
    
    // Simple pattern detection
    if (hour >= 9 && hour <= 17 && dayOfWeek >= 1 && dayOfWeek <= 5) {
      return 'peak_hours';
    } else if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 'weekend';
    } else {
      return 'off_hours';
    }
  }

  /**
   * Get country code from IP address (simplified)
   */
  private getCountryFromIP(ipAddress: string): string {
    // In production, use a proper IP geolocation service
    // This is a simplified implementation for demonstration
    if (ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress === '127.0.0.1') {
      return 'LOCAL';
    }
    
    // Default to unknown country
    return 'XX';
  }

  /**
   * Get user profile from cache or create new
   */
  private async getUserProfile(request: RateLimitRequest): Promise<UserRateProfile | null> {
    try {
      const key = `user_profile:${request.userId || request.sessionId || request.ipAddress}`;
      const cached = await this.redisService.get(key);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // Create new profile for new users
      const newProfile: UserRateProfile = {
        userId: request.userId,
        sessionId: request.sessionId,
        ipAddress: request.ipAddress,
        userProfile: 'new',
        baselineRequests: this.config.baseLimit,
        trustScore: 0.5, // Start with neutral trust
        violationCount: 0,
        lastViolation: null,
        currentAdjustment: 1.0,
        profileUpdated: new Date()
      };

      await this.redisService.set(key, JSON.stringify(newProfile), 3600);
      return newProfile;
    } catch (error) {
      logger.warn('Failed to get user profile', { error });
      return null;
    }
  }

  /**
   * Get state from cache or create new
   */
  private async getState(identifier: string): Promise<RateLimitState> {
    // Try local cache first
    let state = this.localCache.get(identifier);
    
    if (!state) {
      // Try Redis
      try {
        const cached = await this.redisService.get(`rate_limit_state:${identifier}`);
        if (cached) {
          state = JSON.parse(cached);
          // Convert date strings back to Date objects
          state!.lastRefill = new Date(state!.lastRefill);
          state!.windowStart = new Date(state!.windowStart);
          state!.lastRequest = new Date(state!.lastRequest);
          state!.requests = state!.requests.map(req => ({
            ...req,
            timestamp: new Date(req.timestamp)
          }));
        }
      } catch (error) {
        logger.warn('Failed to get state from Redis', { error });
      }
    }

    // Create new state if not found
    if (!state) {
      const now = new Date();
      state = {
        identifier,
        algorithm: this.config.algorithm,
        tokens: this.config.baseLimit,
        lastRefill: now,
        requests: [],
        windowStart: now,
        requestCount: 0,
        lastRequest: now,
        currentLimit: this.config.baseLimit,
        violationCount: 0,
        metadata: {}
      };
    }

    // Update local cache
    this.localCache.set(identifier, state);
    this.manageCacheSize();

    return state;
  }

  /**
   * Update state in cache
   */
  private async updateState(identifier: string, state: RateLimitState, result: RateLimitResult): Promise<void> {
    try {
      // Update local cache
      this.localCache.set(identifier, state);
      
      // Update Redis with TTL
      const ttl = Math.ceil(this.config.timeWindowMs / 1000) + 60; // Window + buffer
      await this.redisService.set(
        `rate_limit_state:${identifier}`,
        JSON.stringify(state),
        ttl
      );
    } catch (error) {
      logger.warn('Failed to update state', { error });
    }
  }

  /**
   * Create a fail-open result when errors occur
   */
  private createFailOpenResult(request: RateLimitRequest): RateLimitResult {
    const now = new Date();
    return {
      allowed: true,
      remainingRequests: this.config.baseLimit,
      resetTime: new Date(now.getTime() + this.config.timeWindowMs),
      limitApplied: this.config.baseLimit,
      reason: 'Fail-open due to system error',
      adjustments: {
        threatBased: 1.0,
        userBased: 1.0,
        geographic: 1.0,
        temporal: 1.0,
        final: 1.0
      },
      metadata: {
        algorithm: this.config.algorithm,
        windowStart: now,
        windowEnd: new Date(now.getTime() + this.config.timeWindowMs),
        requestCount: 0,
        burstUsed: 0
      }
    };
  }

  /**
   * Manage local cache size
   */
  private manageCacheSize(): void {
    if (this.localCache.size > this.cacheSize) {
      // Remove oldest entries (simple LRU-like behavior)
      const keysToRemove = Array.from(this.localCache.keys()).slice(0, this.cacheSize / 4);
      keysToRemove.forEach(key => this.localCache.delete(key));
    }
  }

  /**
   * Start cleanup timer for expired entries
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Cleanup every minute
  }

  /**
   * Cleanup expired entries from local cache
   */
  private cleanupExpiredEntries(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, state] of this.localCache.entries()) {
      const age = now.getTime() - state.lastRequest.getTime();
      if (age > this.config.timeWindowMs * 2) { // Double the window time
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.localCache.delete(key));
    
    if (expiredKeys.length > 0) {
      logger.debug(`Cleaned up ${expiredKeys.length} expired rate limit entries`);
    }
  }

  /**
   * Get current statistics
   */
  getStats(): {
    cacheSize: number;
    algorithm: RateLimitAlgorithm;
    baseLimit: number;
    timeWindow: number;
  } {
    return {
      cacheSize: this.localCache.size,
      algorithm: this.config.algorithm,
      baseLimit: this.config.baseLimit,
      timeWindow: this.config.timeWindowMs
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.localCache.clear();
  }
}
