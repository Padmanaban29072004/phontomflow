/**
 * Rate Limit Integration Layer
 * Clean integration with existing threat detection system
 * Provides threat-aware rate limiting without modifying existing components
 */

import {
  RateLimitIntegrationData,
  RateLimitInsight,
  RateLimitViolation,
  RateLimitAnalytics,
  RateLimitHealth
} from '@/types/rateLimit';
import { RateLimitEnforcementService } from '@/services/RateLimitEnforcementService';
import { RateLimitManager } from '@/services/RateLimitManager';
import { getRateLimitConfiguration } from '@/config/rateLimitConfig';
import { RedisService } from '@/services/RedisService';
import { logger } from '@/utils/logger';

export interface ThreatContext {
  ipAddress: string;
  userAgent?: string;
  endpoint: string;
  method: string;
  threatScore?: number;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
}

export interface RateLimitIntegrationConfig {
  enabled: boolean;
  threatScoreThreshold: number;
  dynamicAdjustmentEnabled: boolean;
  emergencyModeThreshold: number;
  insightGenerationInterval: number;
  metricsAggregationInterval: number;
}

export class RateLimitIntegration {
  private enforcementService: RateLimitEnforcementService;
  private redisService: RedisService;
  private config: RateLimitIntegrationConfig;
  private isEmergencyMode: boolean = false;
  private lastInsightGeneration: Date = new Date();
  private cachedInsights: RateLimitInsight[] = [];
  private performanceMetrics: {
    totalRequests: number;
    allowedRequests: number;
    blockedRequests: number;
    averageResponseTime: number;
    lastUpdated: Date;
  };

  constructor(redisService: RedisService, config?: Partial<RateLimitIntegrationConfig>) {
    this.redisService = redisService;
    this.config = {
      enabled: process.env.RATE_LIMIT_INTEGRATION_ENABLED !== 'false',
      threatScoreThreshold: parseFloat(process.env.RATE_LIMIT_THREAT_THRESHOLD || '0.7'),
      dynamicAdjustmentEnabled: process.env.RATE_LIMIT_DYNAMIC_ADJUSTMENT !== 'false',
      emergencyModeThreshold: parseFloat(process.env.RATE_LIMIT_EMERGENCY_THRESHOLD || '0.9'),
      insightGenerationInterval: parseInt(process.env.RATE_LIMIT_INSIGHT_INTERVAL || '3600000'), // 1 hour
      metricsAggregationInterval: parseInt(process.env.RATE_LIMIT_METRICS_INTERVAL || '300000'), // 5 minutes
      ...config
    };

    this.performanceMetrics = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      averageResponseTime: 0,
      lastUpdated: new Date()
    };

    this.initializeEnforcementService();
    this.startBackgroundTasks();
  }

  /**
   * Analyze threat context and apply rate limiting
   */
  async analyzeThreatContext(context: ThreatContext): Promise<{
    shouldLimit: boolean;
    adjustmentFactor: number;
    recommendedAction: 'allow' | 'limit' | 'block' | 'monitor';
    reasoning: string;
    confidence: number;
  }> {
    try {
      if (!this.config.enabled) {
        return {
          shouldLimit: false,
          adjustmentFactor: 1.0,
          recommendedAction: 'allow',
          reasoning: 'Rate limiting disabled',
          confidence: 1.0
        };
      }

      const threatScore = context.threatScore || 0;
      let adjustmentFactor = 1.0;
      let recommendedAction: 'allow' | 'limit' | 'block' | 'monitor' = 'allow';
      let reasoning = 'Normal traffic pattern';
      let confidence = 0.8;

      // Analyze threat score
      if (threatScore >= this.config.emergencyModeThreshold) {
        adjustmentFactor = 0.1; // 90% reduction
        recommendedAction = 'block';
        reasoning = 'Critical threat detected';
        confidence = 0.95;
      } else if (threatScore >= this.config.threatScoreThreshold) {
        adjustmentFactor = 0.3; // 70% reduction
        recommendedAction = 'limit';
        reasoning = 'High threat score detected';
        confidence = 0.9;
      } else if (threatScore >= 0.5) {
        adjustmentFactor = 0.6; // 40% reduction
        recommendedAction = 'limit';
        reasoning = 'Moderate threat score';
        confidence = 0.8;
      } else if (threatScore >= 0.3) {
        adjustmentFactor = 0.8; // 20% reduction
        recommendedAction = 'monitor';
        reasoning = 'Low threat score, monitoring';
        confidence = 0.7;
      }

      // Check for emergency mode
      if (this.isEmergencyMode) {
        adjustmentFactor = Math.min(adjustmentFactor, 0.2);
        recommendedAction = threatScore > 0.5 ? 'block' : 'limit';
        reasoning += ' (Emergency mode active)';
        confidence = Math.min(confidence + 0.1, 1.0);
      }

      // Dynamic adjustment based on recent patterns
      if (this.config.dynamicAdjustmentEnabled) {
        const recentPattern = await this.analyzeRecentPattern(context.ipAddress);
        if (recentPattern.isAbnormal) {
          adjustmentFactor *= 0.5; // Additional 50% reduction
          reasoning += '; Abnormal traffic pattern detected';
          confidence = Math.min(confidence + 0.1, 1.0);
        }
      }

      return {
        shouldLimit: adjustmentFactor < 1.0,
        adjustmentFactor,
        recommendedAction,
        reasoning,
        confidence
      };

    } catch (error) {
      logger.error('Failed to analyze threat context', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context
      });

      // Fail safe - allow request but with monitoring
      return {
        shouldLimit: false,
        adjustmentFactor: 1.0,
        recommendedAction: 'monitor',
        reasoning: 'Analysis failed, failing safe',
        confidence: 0.5
      };
    }
  }

  /**
   * Get comprehensive rate limiting data for integration
   */
  async getRateLimitIntegrationData(): Promise<RateLimitIntegrationData> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Get current limits (simplified)
      const currentLimits = await this.getCurrentLimits();

      // Get adjustment factors
      const adjustmentFactors = {
        threatBased: await this.getAverageThreatAdjustment(),
        userBased: 1.0, // Would calculate from user profiles
        geographic: 1.0, // Would calculate from geographic rules
        temporal: this.getTemporalAdjustment(),
        overall: 0.8 // Example overall adjustment
      };

      // Get recent violations
      const recentViolations = await this.getRecentViolations(oneHourAgo, now);

      // Calculate effectiveness
      const effectiveness = await this.calculateEffectiveness();

      // Get cached insights
      const insights = await this.getInsights();

      // Generate recommendations
      const recommendations = await this.generateRecommendations(effectiveness, insights);

      // Determine health status
      const healthStatus = effectiveness.score > 0.8 ? 'healthy' : 
                          effectiveness.score > 0.6 ? 'warning' : 'critical';

      // Calculate threat mitigation metrics
      const threatMitigation = {
        attacksBlocked: recentViolations.filter(v => v.severity === 'high' || v.severity === 'critical').length,
        legitimateRequestsAllowed: this.performanceMetrics.allowedRequests,
        falsePositiveRate: 0.02 // Would calculate from actual data
      };

      return {
        currentLimits,
        adjustmentFactors,
        recentViolations,
        effectiveness,
        insights,
        recommendations,
        healthStatus,
        threatMitigation
      };

    } catch (error) {
      logger.error('Failed to get rate limit integration data', { error });
      
      // Return minimal safe data
      return {
        currentLimits: {},
        adjustmentFactors: {
          threatBased: 1.0,
          userBased: 1.0,
          geographic: 1.0,
          temporal: 1.0,
          overall: 1.0
        },
        recentViolations: [],
        effectiveness: {
          score: 0.5,
          trend: 'stable',
          lastUpdated: new Date()
        },
        insights: [],
        recommendations: ['Rate limiting system experiencing issues'],
        healthStatus: 'critical',
        threatMitigation: {
          attacksBlocked: 0,
          legitimateRequestsAllowed: 0,
          falsePositiveRate: 0
        }
      };
    }
  }

  /**
   * Trigger emergency mode based on threat level
   */
  async handleEmergencyThreatLevel(threatLevel: 'low' | 'medium' | 'high' | 'critical'): Promise<void> {
    try {
      if (threatLevel === 'critical' && !this.isEmergencyMode) {
        await this.activateEmergencyMode();
      } else if (threatLevel !== 'critical' && this.isEmergencyMode) {
        // Consider deactivating emergency mode after some time
        setTimeout(() => {
          this.considerDeactivatingEmergencyMode();
        }, 300000); // 5 minutes delay
      }
    } catch (error) {
      logger.error('Failed to handle emergency threat level', {
        threatLevel,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get rate limiting middleware for Express integration
   */
  getMiddleware() {
    return this.enforcementService.createMiddleware({
      threatScoreExtractor: (req) => {
        // Extract threat score from request (would be set by threat detection)
        return (req as any).threatScore || 0;
      },
      userExtractor: (req) => {
        // Extract user information from request
        return {
          userId: (req as any).user?.id,
          sessionId: (req as any).sessionId
        };
      }
    });
  }

  /**
   * Get analytics for dashboard integration
   */
  async getAnalytics(timeRange: { start: Date; end: Date }) {
    return this.enforcementService.getAnalytics(timeRange.start, timeRange.end);
  }

  /**
   * Get health status for monitoring integration
   */
  async getHealthStatus(): Promise<RateLimitHealth> {
    return this.enforcementService.getHealthStatus();
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(allowed: boolean, responseTimeMs: number): void {
    this.performanceMetrics.totalRequests++;
    if (allowed) {
      this.performanceMetrics.allowedRequests++;
    } else {
      this.performanceMetrics.blockedRequests++;
    }

    // Update average response time
    this.performanceMetrics.averageResponseTime = (
      (this.performanceMetrics.averageResponseTime * (this.performanceMetrics.totalRequests - 1) + responseTimeMs) /
      this.performanceMetrics.totalRequests
    );

    this.performanceMetrics.lastUpdated = new Date();
  }

  /**
   * Initialize enforcement service
   */
  private initializeEnforcementService(): void {
    const rateLimitConfig = getRateLimitConfiguration();
    this.enforcementService = new RateLimitEnforcementService(
      this.redisService,
      rateLimitConfig,
      {
        enabled: this.config.enabled,
        onLimitReached: (req, res, result) => {
          // Custom handler that tracks metrics
          this.updatePerformanceMetrics(false, 0);
          
          // Default response
          res.status(429).json({
            error: 'Too Many Requests',
            message: result.reason || 'Rate limit exceeded',
            retryAfter: result.retryAfter,
            limit: result.limitApplied,
            remaining: result.remainingRequests,
            resetTime: result.resetTime
          });
        }
      }
    );
  }

  /**
   * Start background tasks
   */
  private startBackgroundTasks(): void {
    // Insight generation task
    setInterval(() => {
      this.generateInsights();
    }, this.config.insightGenerationInterval);

    // Metrics aggregation task
    setInterval(() => {
      this.aggregateMetrics();
    }, this.config.metricsAggregationInterval);
  }

  /**
   * Analyze recent traffic pattern for an IP
   */
  private async analyzeRecentPattern(ipAddress: string): Promise<{
    isAbnormal: boolean;
    confidence: number;
    reason: string;
  }> {
    try {
      // This would analyze recent request patterns from Redis
      // For now, return a simplified analysis
      return {
        isAbnormal: false,
        confidence: 0.7,
        reason: 'Normal pattern'
      };
    } catch (error) {
      return {
        isAbnormal: false,
        confidence: 0.5,
        reason: 'Analysis failed'
      };
    }
  }

  /**
   * Get current rate limits
   */
  private async getCurrentLimits(): Promise<Record<string, number>> {
    // This would return current limits for different endpoints
    return {
      '/api/auth/login': 5,
      '/api/auth/register': 3,
      '/api/*': 1000,
      '/health': 10000
    };
  }

  /**
   * Get average threat adjustment
   */
  private async getAverageThreatAdjustment(): Promise<number> {
    // This would calculate from recent threat-based adjustments
    return 0.8; // Example: 20% average reduction
  }

  /**
   * Get temporal adjustment
   */
  private getTemporalAdjustment(): number {
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    
    // Peak hours adjustment
    if (hour >= 9 && hour <= 17 && dayOfWeek >= 1 && dayOfWeek <= 5) {
      return 0.8; // 20% reduction during peak hours
    }
    
    return 1.1; // 10% increase during off hours
  }

  /**
   * Get recent violations
   */
  private async getRecentViolations(start: Date, end: Date): Promise<RateLimitViolation[]> {
    // This would query violations from Redis/analytics
    return [];
  }

  /**
   * Calculate effectiveness
   */
  private async calculateEffectiveness(): Promise<{
    score: number;
    trend: 'improving' | 'stable' | 'degrading';
    lastUpdated: Date;
  }> {
    const totalRequests = this.performanceMetrics.totalRequests;
    const blockedRequests = this.performanceMetrics.blockedRequests;
    
    // Simple effectiveness calculation
    const blockingRate = totalRequests > 0 ? blockedRequests / totalRequests : 0;
    const score = Math.max(0, Math.min(1, 0.9 - blockingRate)); // Prefer low blocking rate
    
    return {
      score,
      trend: 'stable', // Would calculate from historical data
      lastUpdated: new Date()
    };
  }

  /**
   * Get insights
   */
  private async getInsights(): Promise<RateLimitInsight[]> {
    if (this.shouldGenerateNewInsights()) {
      this.cachedInsights = await this.enforcementService.getInsights();
      this.lastInsightGeneration = new Date();
    }
    
    return this.cachedInsights;
  }

  /**
   * Generate recommendations
   */
  private async generateRecommendations(
    effectiveness: { score: number; trend: string },
    insights: RateLimitInsight[]
  ): Promise<string[]> {
    const recommendations: string[] = [];
    
    if (effectiveness.score < 0.6) {
      recommendations.push('Consider adjusting rate limit thresholds');
    }
    
    if (insights.some(i => i.severity === 'critical')) {
      recommendations.push('Critical rate limiting issues detected - review immediately');
    }
    
    if (this.isEmergencyMode) {
      recommendations.push('Emergency mode is active - monitor for when it can be safely deactivated');
    }
    
    if (this.performanceMetrics.averageResponseTime > 10) {
      recommendations.push('Rate limiting response time is high - consider optimization');
    }
    
    return recommendations;
  }

  /**
   * Check if new insights should be generated
   */
  private shouldGenerateNewInsights(): boolean {
    const timeSinceLastGeneration = Date.now() - this.lastInsightGeneration.getTime();
    return timeSinceLastGeneration > this.config.insightGenerationInterval;
  }

  /**
   * Activate emergency mode
   */
  private async activateEmergencyMode(): Promise<void> {
    this.isEmergencyMode = true;
    await this.enforcementService.activateEmergencyMode();
    
    logger.warn('Rate limiting emergency mode activated via integration layer');
  }

  /**
   * Consider deactivating emergency mode
   */
  private async considerDeactivatingEmergencyMode(): Promise<void> {
    // Check if threat level has reduced
    const currentEffectiveness = await this.calculateEffectiveness();
    
    if (currentEffectiveness.score > 0.8 && this.isEmergencyMode) {
      this.isEmergencyMode = false;
      await this.enforcementService.deactivateEmergencyMode();
      
      logger.info('Rate limiting emergency mode deactivated via integration layer');
    }
  }

  /**
   * Generate insights (background task)
   */
  private async generateInsights(): Promise<void> {
    try {
      this.cachedInsights = await this.enforcementService.getInsights();
      this.lastInsightGeneration = new Date();
      
      logger.debug('Rate limiting insights updated', {
        insightCount: this.cachedInsights.length
      });
    } catch (error) {
      logger.error('Failed to generate rate limiting insights', { error });
    }
  }

  /**
   * Aggregate metrics (background task)
   */
  private async aggregateMetrics(): Promise<void> {
    try {
      // This would aggregate metrics and store them for analysis
      logger.debug('Rate limiting metrics aggregated', {
        totalRequests: this.performanceMetrics.totalRequests,
        blockedRequests: this.performanceMetrics.blockedRequests,
        averageResponseTime: this.performanceMetrics.averageResponseTime
      });
    } catch (error) {
      logger.error('Failed to aggregate rate limiting metrics', { error });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.enforcementService) {
      this.enforcementService.destroy();
    }
    
    this.cachedInsights = [];
    
    logger.info('Rate limit integration destroyed');
  }
}
