/**
 * Rate Limit Analytics Service
 * Provides effectiveness metrics, performance tracking, and optimization insights
 */

import {
  RateLimitMetrics,
  RateLimitAnalytics,
  RateLimitViolation,
  RateLimitInsight,
  RateLimitOptimization,
  UserProfile,
  ThreatLevel,
  GeographicZone,
  TimePattern
} from '@/types/rateLimit';
import { RedisService } from '@/services/RedisService';
import { logger } from '@/utils/logger';

export interface RateLimitAnalyticsConfig {
  metricsRetentionHours: number;
  violationRetentionHours: number;
  analyticsWindowHours: number;
  insightGenerationInterval: number;
  optimizationThreshold: number;
  falsePositiveThreshold: number;
}

export class RateLimitAnalyticsService {
  private redisService: RedisService;
  private config: RateLimitAnalyticsConfig;
  private metricsCache: Map<string, RateLimitMetrics>;
  private violationsCache: RateLimitViolation[];
  private insightsCache: RateLimitInsight[];

  constructor(redisService: RedisService, config: RateLimitAnalyticsConfig) {
    this.redisService = redisService;
    this.config = config;
    this.metricsCache = new Map();
    this.violationsCache = [];
    this.insightsCache = [];
  }

  /**
   * Record a rate limit check event
   */
  async recordRateLimitEvent(
    identifier: string,
    endpoint: string,
    allowed: boolean,
    limitApplied: number,
    responseTimeMs: number,
    metadata: {
      ipAddress: string;
      userProfile?: UserProfile;
      threatLevel?: ThreatLevel;
      countryCode?: string;
      violationCount?: number;
    }
  ): Promise<void> {
    try {
      const timestamp = new Date();
      const key = `rate_limit_metrics:${endpoint}:${this.getTimeSlot(timestamp)}`;

      // Update metrics
      await this.updateMetrics(key, allowed, responseTimeMs);
      
      // Record violation if request was blocked
      if (!allowed) {
        await this.recordViolation({
          identifier,
          endpoint,
          ipAddress: metadata.ipAddress,
          timestamp,
          requestCount: 1,
          limitApplied,
          exceedBy: 1,
          threatScore: this.getThreatScore(metadata.threatLevel),
          userProfile: metadata.userProfile,
          countryCode: metadata.countryCode,
          action: 'blocked',
          severity: this.calculateViolationSeverity(metadata.threatLevel, metadata.violationCount || 0)
        });
      }

      // Update overall metrics
      await this.updateOverallMetrics(allowed, responseTimeMs);

    } catch (error) {
      logger.error('Failed to record rate limit event', {
        identifier,
        endpoint,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get comprehensive analytics for a time period
   */
  async getAnalytics(
    startTime: Date,
    endTime: Date,
    groupBy: 'endpoint' | 'country' | 'userProfile' | 'threatLevel' = 'endpoint'
  ): Promise<RateLimitAnalytics> {
    try {
      const timeWindow = {
        start: startTime,
        end: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };

      // Get overall metrics
      const overallMetrics = await this.getOverallMetrics(startTime, endTime);
      
      // Get grouped metrics
      const groupedMetrics = await this.getGroupedMetrics(startTime, endTime, groupBy);
      
      // Get violations and top violators
      const violations = await this.getViolations(startTime, endTime);
      const topViolators = this.getTopViolators(violations);
      
      // Calculate trends
      const trends = await this.calculateTrends(startTime, endTime);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(overallMetrics, violations);

      return {
        timeWindow,
        overallMetrics,
        byEndpoint: groupBy === 'endpoint' ? groupedMetrics : {},
        byCountry: groupBy === 'country' ? groupedMetrics : {},
        byUserProfile: groupBy === 'userProfile' ? groupedMetrics : {},
        byThreatLevel: groupBy === 'threatLevel' ? groupedMetrics : {},
        topViolators,
        trends,
        recommendations
      };

    } catch (error) {
      logger.error('Failed to get analytics', { error });
      throw error;
    }
  }

  /**
   * Generate insights about rate limiting effectiveness
   */
  async generateInsights(): Promise<RateLimitInsight[]> {
    try {
      const insights: RateLimitInsight[] = [];
      const now = new Date();
      const lookbackHours = this.config.analyticsWindowHours;
      const startTime = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);

      // Detect abuse patterns
      const abusePatterns = await this.detectAbusePatterns(startTime, now);
      insights.push(...abusePatterns);

      // Identify policy optimization opportunities
      const optimizations = await this.identifyOptimizations(startTime, now);
      insights.push(...optimizations);

      // Detect performance issues
      const performanceIssues = await this.detectPerformanceIssues(startTime, now);
      insights.push(...performanceIssues);

      // Identify geographic threats
      const geographicThreats = await this.detectGeographicThreats(startTime, now);
      insights.push(...geographicThreats);

      // Detect temporal anomalies
      const temporalAnomalies = await this.detectTemporalAnomalies(startTime, now);
      insights.push(...temporalAnomalies);

      // Cache insights
      this.insightsCache = insights;

      logger.info('Generated rate limit insights', {
        insightCount: insights.length,
        timeWindow: `${lookbackHours} hours`
      });

      return insights;

    } catch (error) {
      logger.error('Failed to generate insights', { error });
      return [];
    }
  }

  /**
   * Get optimization recommendations
   */
  async getOptimizationRecommendations(): Promise<RateLimitOptimization> {
    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - this.config.analyticsWindowHours * 60 * 60 * 1000);
      
      const metrics = await this.getOverallMetrics(startTime, now);
      const currentEffectiveness = metrics.effectivenessScore;

      const optimizations = [];

      // Check if false positive rate is too high
      if (metrics.falsePositiveRate > this.config.falsePositiveThreshold) {
        optimizations.push({
          type: 'threshold_tuning' as const,
          description: `False positive rate (${(metrics.falsePositiveRate * 100).toFixed(1)}%) exceeds threshold`,
          expectedImprovement: 0.15,
          confidence: 0.8,
          implementation: {
            difficulty: 'medium' as const,
            riskLevel: 'medium' as const,
            estimatedTime: '2-3 hours'
          }
        });
      }

      // Check if effectiveness is below threshold
      if (currentEffectiveness < this.config.optimizationThreshold) {
        optimizations.push({
          type: 'policy_adjustment' as const,
          description: `Overall effectiveness (${(currentEffectiveness * 100).toFixed(1)}%) is below target`,
          expectedImprovement: 0.25,
          confidence: 0.7,
          implementation: {
            difficulty: 'easy' as const,
            riskLevel: 'low' as const,
            estimatedTime: '1-2 hours'
          }
        });
      }

      // Check response time performance
      if (metrics.averageResponseTime > 10) { // 10ms threshold
        optimizations.push({
          type: 'algorithm_change' as const,
          description: `Average response time (${metrics.averageResponseTime.toFixed(2)}ms) is too high`,
          expectedImprovement: 0.1,
          confidence: 0.9,
          implementation: {
            difficulty: 'hard' as const,
            riskLevel: 'medium' as const,
            estimatedTime: '1-2 days'
          }
        });
      }

      // Generate recommendations based on insights
      const insights = await this.generateInsights();
      const immediate = [];
      const shortTerm = [];
      const longTerm = [];

      for (const insight of insights) {
        if (insight.severity === 'critical') {
          immediate.push(...insight.recommendations);
        } else if (insight.severity === 'high') {
          shortTerm.push(...insight.recommendations);
        } else {
          longTerm.push(...insight.recommendations);
        }
      }

      return {
        currentEffectiveness,
        optimizations,
        recommendations: {
          immediate: [...new Set(immediate)], // Remove duplicates
          shortTerm: [...new Set(shortTerm)],
          longTerm: [...new Set(longTerm)]
        }
      };

    } catch (error) {
      logger.error('Failed to get optimization recommendations', { error });
      return {
        currentEffectiveness: 0,
        optimizations: [],
        recommendations: { immediate: [], shortTerm: [], longTerm: [] }
      };
    }
  }

  /**
   * Track rate limiting effectiveness over time
   */
  async trackEffectiveness(): Promise<{
    currentScore: number;
    trend: 'improving' | 'stable' | 'degrading';
    historicalData: Array<{ timestamp: Date; score: number }>;
  }> {
    try {
      const now = new Date();
      const hoursToCheck = 24; // Last 24 hours
      const intervalHours = 1; // Check every hour
      
      const historicalData = [];
      
      for (let i = hoursToCheck; i >= 0; i--) {
        const checkTime = new Date(now.getTime() - i * 60 * 60 * 1000);
        const startTime = new Date(checkTime.getTime() - intervalHours * 60 * 60 * 1000);
        
        const metrics = await this.getOverallMetrics(startTime, checkTime);
        historicalData.push({
          timestamp: checkTime,
          score: metrics.effectivenessScore
        });
      }

      // Calculate trend
      const recentScores = historicalData.slice(-6).map(d => d.score); // Last 6 hours
      const olderScores = historicalData.slice(-12, -6).map(d => d.score); // 6-12 hours ago
      
      const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      const olderAvg = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;
      
      let trend: 'improving' | 'stable' | 'degrading';
      const changePct = (recentAvg - olderAvg) / olderAvg;
      
      if (changePct > 0.05) trend = 'improving';
      else if (changePct < -0.05) trend = 'degrading';
      else trend = 'stable';

      return {
        currentScore: historicalData[historicalData.length - 1]?.score || 0,
        trend,
        historicalData
      };

    } catch (error) {
      logger.error('Failed to track effectiveness', { error });
      return {
        currentScore: 0,
        trend: 'stable',
        historicalData: []
      };
    }
  }

  /**
   * Update metrics for a specific key
   */
  private async updateMetrics(key: string, allowed: boolean, responseTimeMs: number): Promise<void> {
    try {
      const exists = await this.redisService.exists(key);
      
      if (!exists) {
        // Initialize new metrics
        const metrics: RateLimitMetrics = {
          totalRequests: 1,
          allowedRequests: allowed ? 1 : 0,
          blockedRequests: allowed ? 0 : 1,
          violationRate: allowed ? 0 : 1,
          averageResponseTime: responseTimeMs,
          effectivenessScore: allowed ? 1 : 0,
          falsePositiveRate: 0, // Will be calculated separately
          memoryUsage: 0,
          lastUpdated: new Date()
        };
        
        await this.redisService.set(
          key,
          JSON.stringify(metrics),
          this.config.metricsRetentionHours * 3600
        );
      } else {
        // Update existing metrics
        const cached = await this.redisService.get(key);
        if (cached) {
          const metrics: RateLimitMetrics = JSON.parse(cached);
          
          metrics.totalRequests += 1;
          metrics.allowedRequests += allowed ? 1 : 0;
          metrics.blockedRequests += allowed ? 0 : 1;
          metrics.violationRate = metrics.blockedRequests / metrics.totalRequests;
          
          // Update average response time
          metrics.averageResponseTime = (
            (metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTimeMs) /
            metrics.totalRequests
          );
          
          // Calculate effectiveness (balance between blocking threats and allowing legitimate requests)
          metrics.effectivenessScore = this.calculateEffectivenessScore(metrics);
          metrics.lastUpdated = new Date();
          
          await this.redisService.set(
            key,
            JSON.stringify(metrics),
            this.config.metricsRetentionHours * 3600
          );
        }
      }
    } catch (error) {
      logger.warn('Failed to update metrics', { error });
    }
  }

  /**
   * Record a rate limit violation
   */
  private async recordViolation(violation: RateLimitViolation): Promise<void> {
    try {
      const key = `rate_limit_violations:${this.getTimeSlot(violation.timestamp)}`;
      const violations = await this.getViolationsFromRedis(key) || [];
      
      violations.push(violation);
      
      // Keep only recent violations to manage memory
      const maxViolations = 1000;
      if (violations.length > maxViolations) {
        violations.splice(0, violations.length - maxViolations);
      }
      
      await this.redisService.set(
        key,
        JSON.stringify(violations),
        this.config.violationRetentionHours * 3600
      );
      
      // Update local cache
      this.violationsCache.push(violation);
      if (this.violationsCache.length > maxViolations) {
        this.violationsCache.splice(0, this.violationsCache.length - maxViolations);
      }
      
    } catch (error) {
      logger.warn('Failed to record violation', { error });
    }
  }

  /**
   * Calculate effectiveness score
   */
  private calculateEffectivenessScore(metrics: RateLimitMetrics): number {
    // Effectiveness combines low violation rate with reasonable blocking
    const blockingBalance = Math.min(metrics.violationRate * 2, 1); // Prefer some blocking over none
    const responseTimeScore = Math.max(0, 1 - metrics.averageResponseTime / 50); // Prefer fast responses
    
    return (blockingBalance * 0.7 + responseTimeScore * 0.3);
  }

  /**
   * Calculate violation severity
   */
  private calculateViolationSeverity(threatLevel?: ThreatLevel, violationCount: number = 0): 'low' | 'medium' | 'high' | 'critical' {
    if (threatLevel === 'critical' || violationCount > 10) return 'critical';
    if (threatLevel === 'high' || violationCount > 5) return 'high';
    if (threatLevel === 'medium' || violationCount > 2) return 'medium';
    return 'low';
  }

  /**
   * Get threat score from threat level
   */
  private getThreatScore(threatLevel?: ThreatLevel): number {
    switch (threatLevel) {
      case 'low': return 0.2;
      case 'medium': return 0.5;
      case 'high': return 0.8;
      case 'critical': return 1.0;
      default: return 0.0;
    }
  }

  /**
   * Get time slot for grouping metrics
   */
  private getTimeSlot(timestamp: Date): string {
    const hour = Math.floor(timestamp.getTime() / (60 * 60 * 1000));
    return hour.toString();
  }

  /**
   * Get violations from Redis
   */
  private async getViolationsFromRedis(key: string): Promise<RateLimitViolation[] | null> {
    try {
      const cached = await this.redisService.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn('Failed to get violations from Redis', { error });
      return null;
    }
  }

  // Additional helper methods would be implemented here for:
  // - getOverallMetrics()
  // - getGroupedMetrics()
  // - getViolations()
  // - getTopViolators()
  // - calculateTrends()
  // - generateRecommendations()
  // - detectAbusePatterns()
  // - identifyOptimizations()
  // - detectPerformanceIssues()
  // - detectGeographicThreats()
  // - detectTemporalAnomalies()

  /**
   * Get overall metrics for a time period (simplified implementation)
   */
  private async getOverallMetrics(startTime: Date, endTime: Date): Promise<RateLimitMetrics> {
    // This would aggregate metrics across the time period
    return {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      violationRate: 0,
      averageResponseTime: 0,
      effectivenessScore: 0.8, // Default effectiveness
      falsePositiveRate: 0.02, // Default 2% false positive rate
      memoryUsage: 0,
      lastUpdated: new Date()
    };
  }

  /**
   * Get grouped metrics (simplified implementation)
   */
  private async getGroupedMetrics(startTime: Date, endTime: Date, groupBy: string): Promise<Record<string, RateLimitMetrics>> {
    // This would return metrics grouped by the specified field
    return {};
  }

  /**
   * Get violations for a time period (simplified implementation)
   */
  private async getViolations(startTime: Date, endTime: Date): Promise<RateLimitViolation[]> {
    return this.violationsCache.filter(v => 
      v.timestamp >= startTime && v.timestamp <= endTime
    );
  }

  /**
   * Get top violators (simplified implementation)
   */
  private getTopViolators(violations: RateLimitViolation[]): Array<{
    identifier: string;
    ipAddress: string;
    violationCount: number;
    lastViolation: Date;
    countryCode?: string;
  }> {
    const violatorMap = new Map();
    
    violations.forEach(v => {
      const key = v.identifier;
      if (!violatorMap.has(key)) {
        violatorMap.set(key, {
          identifier: v.identifier,
          ipAddress: v.ipAddress,
          violationCount: 0,
          lastViolation: v.timestamp,
          countryCode: v.countryCode
        });
      }
      
      const violator = violatorMap.get(key);
      violator.violationCount += 1;
      if (v.timestamp > violator.lastViolation) {
        violator.lastViolation = v.timestamp;
      }
    });
    
    return Array.from(violatorMap.values())
      .sort((a, b) => b.violationCount - a.violationCount)
      .slice(0, 10); // Top 10
  }

  /**
   * Calculate trends (simplified implementation)
   */
  private async calculateTrends(startTime: Date, endTime: Date): Promise<{
    requestTrend: 'increasing' | 'decreasing' | 'stable';
    violationTrend: 'increasing' | 'decreasing' | 'stable';
    effectivenessTrend: 'improving' | 'degrading' | 'stable';
  }> {
    return {
      requestTrend: 'stable',
      violationTrend: 'stable',
      effectivenessTrend: 'stable'
    };
  }

  /**
   * Generate recommendations (simplified implementation)
   */
  private async generateRecommendations(metrics: RateLimitMetrics, violations: RateLimitViolation[]): Promise<string[]> {
    const recommendations: string[] = [];
    
    if (metrics.violationRate > 0.1) {
      recommendations.push('Consider tightening rate limits due to high violation rate');
    }
    
    if (metrics.averageResponseTime > 10) {
      recommendations.push('Optimize rate limiting algorithm for better performance');
    }
    
    if (violations.length > 100) {
      recommendations.push('Implement additional security measures for repeat violators');
    }
    
    return recommendations;
  }

  /**
   * Detect abuse patterns (simplified implementation)
   */
  private async detectAbusePatterns(startTime: Date, endTime: Date): Promise<RateLimitInsight[]> {
    return [];
  }

  /**
   * Identify optimizations (simplified implementation)
   */
  private async identifyOptimizations(startTime: Date, endTime: Date): Promise<RateLimitInsight[]> {
    return [];
  }

  /**
   * Detect performance issues (simplified implementation)
   */
  private async detectPerformanceIssues(startTime: Date, endTime: Date): Promise<RateLimitInsight[]> {
    return [];
  }

  /**
   * Detect geographic threats (simplified implementation)
   */
  private async detectGeographicThreats(startTime: Date, endTime: Date): Promise<RateLimitInsight[]> {
    return [];
  }

  /**
   * Detect temporal anomalies (simplified implementation)
   */
  private async detectTemporalAnomalies(startTime: Date, endTime: Date): Promise<RateLimitInsight[]> {
    return [];
  }

  /**
   * Update overall metrics (simplified implementation)
   */
  private async updateOverallMetrics(allowed: boolean, responseTimeMs: number): Promise<void> {
    // Would update global metrics
  }
}
