/**
 * Rate Limit Manager Service
 * Orchestrates multiple rate limiters and manages policies
 */

import {
  RateLimitManagerConfig,
  RateLimitRequest,
  RateLimitResult,
  RateLimitPolicy,
  RateLimitHealth,
  ThreatLevel,
  UserProfile,
  GeographicZone,
  TimePattern
} from '@/types/rateLimit';
import { AdaptiveRateLimiter } from '@/core/rateLimit/AdaptiveRateLimiter';
import { RateLimitPolicies } from '@/core/rateLimit/RateLimitPolicies';
import { RateLimitAnalyticsService, RateLimitAnalyticsConfig } from '@/services/RateLimitAnalytics';
import { RedisService } from '@/services/RedisService';
import { logger } from '@/utils/logger';

export class RateLimitManager {
  private redisService: RedisService;
  private config: RateLimitManagerConfig;
  private policies: RateLimitPolicies;
  private analytics: RateLimitAnalyticsService;
  private limiters: Map<string, AdaptiveRateLimiter>;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private currentMemoryUsage: number = 0;

  constructor(redisService: RedisService, config: RateLimitManagerConfig) {
    this.redisService = redisService;
    this.config = config;
    this.policies = new RateLimitPolicies();
    this.limiters = new Map();

    // Initialize analytics service
    const analyticsConfig: RateLimitAnalyticsConfig = {
      metricsRetentionHours: config.globalSettings.metricsRetention,
      violationRetentionHours: config.globalSettings.metricsRetention,
      analyticsWindowHours: 24,
      insightGenerationInterval: 3600000, // 1 hour
      optimizationThreshold: 0.75,
      falsePositiveThreshold: 0.05
    };
    this.analytics = new RateLimitAnalyticsService(redisService, analyticsConfig);

    // Load custom policies if provided
    if (config.policies && config.policies.length > 0) {
      config.policies.forEach(policy => this.policies.addPolicy(policy));
    }

    // Start background tasks
    this.startCleanupTimer();
    this.startHealthChecks();
  }

  /**
   * Check rate limit for a request
   */
  async checkRateLimit(request: RateLimitRequest): Promise<RateLimitResult> {
    const startTime = process.hrtime.bigint();

    try {
      // Find applicable policies
      const conditions = await this.extractConditions(request);
      const applicablePolicies = this.policies.findApplicablePolicies(conditions);

      if (applicablePolicies.length === 0) {
        // Use default policy
        applicablePolicies.push(this.config.defaultPolicy);
      }

      // Use the highest priority policy
      const activePolicy = applicablePolicies[0];
      
      // Get or create rate limiter for this policy
      const limiter = await this.getLimiter(activePolicy);
      
      // Check rate limit
      const result = await limiter.checkRateLimit(request);
      
      // Record analytics
      const endTime = process.hrtime.bigint();
      const responseTimeMs = Number(endTime - startTime) / 1000000;
      
      await this.analytics.recordRateLimitEvent(
        request.identifier,
        request.endpoint,
        result.allowed,
        result.limitApplied,
        responseTimeMs,
        {
          ipAddress: request.ipAddress,
          userProfile: conditions.userProfile,
          threatLevel: conditions.threatLevel,
          countryCode: this.getCountryFromIP(request.ipAddress),
          violationCount: result.allowed ? 0 : 1
        }
      );

      // Log significant events
      if (!result.allowed) {
        logger.warn('Rate limit exceeded', {
          identifier: request.identifier,
          endpoint: request.endpoint,
          policy: activePolicy.policyId,
          limitApplied: result.limitApplied,
          reason: result.reason
        });
      }

      return result;

    } catch (error) {
      logger.error('Rate limit check failed', {
        identifier: request.identifier,
        endpoint: request.endpoint,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Fail open for availability
      return this.createFailOpenResult(request);
    }
  }

  /**
   * Add or update a policy
   */
  addPolicy(policy: RateLimitPolicy): boolean {
    try {
      const validation = this.policies.validatePolicy(policy);
      if (!validation.valid) {
        logger.warn('Invalid policy rejected', {
          policyId: policy.policyId,
          errors: validation.errors
        });
        return false;
      }

      this.policies.addPolicy(policy);
      
      // Clear limiter cache to force recreation with new policy
      this.clearLimiterCache();

      logger.info('Rate limit policy added', {
        policyId: policy.policyId,
        name: policy.name
      });

      return true;
    } catch (error) {
      logger.error('Failed to add policy', {
        policyId: policy.policyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Update an existing policy
   */
  updatePolicy(policyId: string, updates: Partial<RateLimitPolicy>): boolean {
    try {
      const success = this.policies.updatePolicy(policyId, updates);
      
      if (success) {
        // Clear limiter cache to force recreation with updated policy
        this.clearLimiterCache();
        
        logger.info('Rate limit policy updated', {
          policyId,
          updates: Object.keys(updates)
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to update policy', {
        policyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Remove a policy
   */
  removePolicy(policyId: string): boolean {
    try {
      const success = this.policies.removePolicy(policyId);
      
      if (success) {
        // Clear limiter cache
        this.clearLimiterCache();
        
        logger.info('Rate limit policy removed', { policyId });
      }

      return success;
    } catch (error) {
      logger.error('Failed to remove policy', {
        policyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Enable or disable a policy
   */
  togglePolicy(policyId: string, enabled: boolean): boolean {
    try {
      const success = this.policies.togglePolicy(policyId, enabled);
      
      if (success) {
        logger.info('Rate limit policy toggled', {
          policyId,
          enabled
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to toggle policy', {
        policyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get all policies
   */
  getAllPolicies(): RateLimitPolicy[] {
    return this.policies.getAllPolicies();
  }

  /**
   * Get analytics for a time period
   */
  async getAnalytics(startTime: Date, endTime: Date) {
    return this.analytics.getAnalytics(startTime, endTime);
  }

  /**
   * Generate insights
   */
  async generateInsights() {
    return this.analytics.generateInsights();
  }

  /**
   * Get optimization recommendations
   */
  async getOptimizationRecommendations() {
    return this.analytics.getOptimizationRecommendations();
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<RateLimitHealth> {
    const issues = [];
    let status: 'healthy' | 'warning' | 'critical' | 'error' = 'healthy';

    try {
      // Check Redis connectivity
      const redisHealthy = await this.checkRedisHealth();
      if (!redisHealthy) {
        issues.push({
          component: 'redis' as const,
          severity: 'critical' as const,
          description: 'Redis connection is unhealthy',
          suggestion: 'Check Redis server status and network connectivity'
        });
        status = 'critical';
      }

      // Check memory usage
      if (this.currentMemoryUsage > this.config.globalSettings.maxMemoryUsage * 0.9) {
        issues.push({
          component: 'memory' as const,
          severity: 'medium' as const,
          description: `Memory usage (${this.formatBytes(this.currentMemoryUsage)}) approaching limit`,
          suggestion: 'Consider increasing memory limit or optimizing cache size'
        });
        if (status === 'healthy') status = 'warning';
      }

      // Check performance
      const avgResponseTime = await this.getAverageResponseTime();
      if (avgResponseTime > 20) { // 20ms threshold
        issues.push({
          component: 'performance' as const,
          severity: 'medium' as const,
          description: `Average response time (${avgResponseTime.toFixed(2)}ms) is high`,
          suggestion: 'Consider optimizing rate limiting algorithms or adding more instances'
        });
        if (status === 'healthy') status = 'warning';
      }

      // Check policy consistency
      const policyIssues = await this.checkPolicyConsistency();
      if (policyIssues.length > 0) {
        issues.push(...policyIssues);
        if (status === 'healthy') status = 'warning';
      }

      const metrics = {
        responseTime: avgResponseTime,
        memoryUsage: this.currentMemoryUsage,
        errorRate: await this.getErrorRate(),
        effectivenessScore: await this.getEffectivenessScore()
      };

      return {
        isHealthy: status === 'healthy',
        status,
        issues,
        metrics,
        lastCheck: new Date()
      };

    } catch (error) {
      logger.error('Health check failed', { error });
      return {
        isHealthy: false,
        status: 'error',
        issues: [{
          component: 'algorithm' as const,
          severity: 'critical' as const,
          description: 'Health check failed due to system error',
          suggestion: 'Check system logs and restart service if necessary'
        }],
        metrics: {
          responseTime: 0,
          memoryUsage: 0,
          errorRate: 1,
          effectivenessScore: 0
        },
        lastCheck: new Date()
      };
    }
  }

  /**
   * Get current statistics
   */
  getStatistics(): {
    limiters: number;
    policies: number;
    memoryUsage: number;
    uptime: number;
  } {
    return {
      limiters: this.limiters.size,
      policies: this.policies.getAllPolicies().length,
      memoryUsage: this.currentMemoryUsage,
      uptime: process.uptime() * 1000 // milliseconds
    };
  }

  /**
   * Emergency mode activation
   */
  async activateEmergencyMode(): Promise<void> {
    try {
      logger.warn('Activating emergency rate limiting mode');
      
      // Enable emergency policy
      this.policies.togglePolicy('emergency-response', true);
      
      // Clear all limiters to force immediate policy application
      this.clearLimiterCache();
      
      logger.info('Emergency rate limiting mode activated');
    } catch (error) {
      logger.error('Failed to activate emergency mode', { error });
    }
  }

  /**
   * Deactivate emergency mode
   */
  async deactivateEmergencyMode(): Promise<void> {
    try {
      logger.info('Deactivating emergency rate limiting mode');
      
      // Disable emergency policy
      this.policies.togglePolicy('emergency-response', false);
      
      // Clear limiters to return to normal policies
      this.clearLimiterCache();
      
      logger.info('Emergency rate limiting mode deactivated');
    } catch (error) {
      logger.error('Failed to deactivate emergency mode', { error });
    }
  }

  /**
   * Get or create rate limiter for a policy
   */
  private async getLimiter(policy: RateLimitPolicy): Promise<AdaptiveRateLimiter> {
    const key = policy.policyId;
    
    if (this.limiters.has(key)) {
      return this.limiters.get(key)!;
    }

    // Create new limiter
    const limiter = new AdaptiveRateLimiter(
      this.redisService,
      policy.limits.base,
      policy.limits.threatAdjustments,
      policy.limits.userAdjustments,
      this.config.geographicRules,
      this.config.temporalRules
    );

    this.limiters.set(key, limiter);
    this.updateMemoryUsage();

    logger.debug('Created new rate limiter', {
      policyId: policy.policyId,
      algorithm: policy.limits.base.algorithm
    });

    return limiter;
  }

  /**
   * Extract conditions from request for policy matching
   */
  private async extractConditions(request: RateLimitRequest): Promise<{
    endpoint?: string;
    method?: string;
    threatLevel?: ThreatLevel;
    userProfile?: UserProfile;
    geographicZone?: GeographicZone;
    timePattern?: TimePattern;
  }> {
    // Convert threat score to threat level
    let threatLevel: ThreatLevel | undefined;
    if (request.threatScore !== undefined) {
      if (request.threatScore < 0.3) threatLevel = 'low';
      else if (request.threatScore < 0.6) threatLevel = 'medium';
      else if (request.threatScore < 0.8) threatLevel = 'high';
      else threatLevel = 'critical';
    }

    // Determine user profile (simplified)
    const userProfile: UserProfile = 'new'; // Would be determined from user data

    // Determine geographic zone
    const countryCode = this.getCountryFromIP(request.ipAddress);
    const geographicZone = this.getGeographicZone(countryCode);

    // Determine time pattern
    const timePattern = this.getTimePattern(request.timestamp);

    return {
      endpoint: request.endpoint,
      method: request.method,
      threatLevel,
      userProfile,
      geographicZone,
      timePattern
    };
  }

  /**
   * Get country code from IP (simplified)
   */
  private getCountryFromIP(ipAddress: string): string {
    // In production, use a proper IP geolocation service
    if (ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress === '127.0.0.1') {
      return 'LOCAL';
    }
    return 'XX'; // Unknown
  }

  /**
   * Get geographic zone from country code
   */
  private getGeographicZone(countryCode: string): GeographicZone {
    // This would be based on a configurable mapping
    const riskCountries = ['CN', 'RU', 'KP']; // Example high-risk countries
    
    if (countryCode === 'LOCAL') return 'safe';
    if (riskCountries.includes(countryCode)) return 'high_risk';
    return 'moderate';
  }

  /**
   * Get current time pattern
   */
  private getTimePattern(timestamp: Date): TimePattern {
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay();
    
    if (hour >= 9 && hour <= 17 && dayOfWeek >= 1 && dayOfWeek <= 5) {
      return 'peak_hours';
    } else if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 'weekend';
    } else {
      return 'off_hours';
    }
  }

  /**
   * Create fail-open result
   */
  private createFailOpenResult(request: RateLimitRequest): RateLimitResult {
    const now = new Date();
    return {
      allowed: true,
      remainingRequests: 1000,
      resetTime: new Date(now.getTime() + 60000),
      limitApplied: 1000,
      reason: 'Fail-open due to system error',
      adjustments: {
        threatBased: 1.0,
        userBased: 1.0,
        geographic: 1.0,
        temporal: 1.0,
        final: 1.0
      },
      metadata: {
        algorithm: 'token_bucket',
        windowStart: now,
        windowEnd: new Date(now.getTime() + 60000),
        requestCount: 0,
        burstUsed: 0
      }
    };
  }

  /**
   * Clear limiter cache
   */
  private clearLimiterCache(): void {
    // Destroy existing limiters
    for (const limiter of this.limiters.values()) {
      limiter.destroy();
    }
    this.limiters.clear();
    this.updateMemoryUsage();
  }

  /**
   * Update memory usage estimate
   */
  private updateMemoryUsage(): void {
    // Rough estimate: each limiter uses ~1MB
    this.currentMemoryUsage = this.limiters.size * 1024 * 1024;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.globalSettings.cleanupInterval);
  }

  /**
   * Start health check timer
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 300000); // Every 5 minutes
  }

  /**
   * Perform cleanup
   */
  private async performCleanup(): Promise<void> {
    try {
      logger.debug('Performing rate limit cleanup');
      
      // Clean up unused limiters
      const activeKeys = new Set(this.policies.getAllPolicies().map(p => p.policyId));
      const limiterKeys = Array.from(this.limiters.keys());
      
      for (const key of limiterKeys) {
        if (!activeKeys.has(key)) {
          const limiter = this.limiters.get(key);
          if (limiter) {
            limiter.destroy();
          }
          this.limiters.delete(key);
        }
      }
      
      this.updateMemoryUsage();
      
    } catch (error) {
      logger.error('Cleanup failed', { error });
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.getHealthStatus();
      
      if (!health.isHealthy) {
        logger.warn('Rate limit system health issue detected', {
          status: health.status,
          issues: health.issues.length
        });
      }
      
    } catch (error) {
      logger.error('Health check failed', { error });
    }
  }

  // Helper methods for health checks
  private async checkRedisHealth(): Promise<boolean> {
    try {
      await this.redisService.ping();
      return true;
    } catch {
      return false;
    }
  }

  private async getAverageResponseTime(): Promise<number> {
    // Would calculate from recent metrics
    return 5; // Default 5ms
  }

  private async getErrorRate(): Promise<number> {
    // Would calculate from recent metrics
    return 0.01; // Default 1% error rate
  }

  private async getEffectivenessScore(): Promise<number> {
    // Would calculate from recent analytics
    return 0.85; // Default 85% effectiveness
  }

  private async checkPolicyConsistency(): Promise<Array<{
    component: 'policies';
    severity: 'low' | 'medium' | 'high';
    description: string;
    suggestion: string;
  }>> {
    const issues = [];
    const policies = this.policies.getAllPolicies();
    
    // Check for conflicting policies
    const priorities = policies.map(p => p.priority);
    const duplicatePriorities = priorities.filter((p, i) => priorities.indexOf(p) !== i);
    
    if (duplicatePriorities.length > 0) {
      issues.push({
        component: 'policies' as const,
        severity: 'medium' as const,
        description: 'Multiple policies with same priority detected',
        suggestion: 'Adjust policy priorities to avoid conflicts'
      });
    }
    
    return issues;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    this.clearLimiterCache();
    
    logger.info('Rate limit manager destroyed');
  }
}
