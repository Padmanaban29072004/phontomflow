import { logger } from '@/utils/logger';
import { RedisService } from './RedisService';
import { HyperLogLogManager } from './HyperLogLogManager';
import { 
  VisitorMetrics, 
  UniqueVisitorInsight, 
  HLLAnalyticsResult,
  CardinalityComparison 
} from '@/types/hyperloglog';

/**
 * Integration interface for cardinality data
 */
export interface CardinalityData {
  uniqueVisitors: {
    total: number;
    ips: number;
    sessions: number;
    userAgents: number;
    locations: number;
    paths: number;
  };
  confidence: number;
  riskScore: number;          // Risk score based on cardinality patterns
  anomalyScore: number;       // Anomaly score from analytics
  insights: UniqueVisitorInsight[];
  timeWindow: {
    start: Date;
    end: Date;
    duration: number;
  };
}

/**
 * CardinalityIntegration provides a clean interface between HyperLogLog
 * and the existing threat detection system without modifying StatisticalAnalyzer
 */
export class CardinalityIntegration {
  private hllManager: HyperLogLogManager;
  private redisService: RedisService;
  private isInitialized: boolean = false;

  constructor(redisService: RedisService) {
    this.redisService = redisService;
    this.hllManager = new HyperLogLogManager(redisService);
  }

  /**
   * Initialize the integration layer
   */
  public async initialize(): Promise<void> {
    try {
      await this.hllManager.initialize();
      this.isInitialized = true;
      
      logger.info('CardinalityIntegration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize CardinalityIntegration:', error);
      throw error;
    }
  }

  /**
   * Process request and get cardinality data for threat analysis
   */
  public async processRequestForThreatAnalysis(requestData: {
    ipAddress?: string;
    sessionId?: string;
    userAgent?: string;
    country?: string;
    region?: string;
    city?: string;
    path?: string;
    timestamp?: Date;
  }): Promise<CardinalityData> {
    if (!this.isInitialized) {
      throw new Error('CardinalityIntegration not initialized');
    }

    try {
      // Process request through HLL manager
      const result = await this.hllManager.processRequest(requestData);
      
      // Get current metrics
      const metrics = result.metrics || await this.hllManager.getAggregatedMetrics(3600000); // 1 hour window
      
      // Calculate risk score based on cardinality patterns
      const riskScore = this.calculateCardinalityRiskScore(metrics);
      
      // Get anomaly score from insights
      const anomalyScore = this.extractAnomalyScore(result.insights || []);

      return {
        uniqueVisitors: metrics.uniqueVisitors,
        confidence: metrics.confidence,
        riskScore,
        anomalyScore,
        insights: result.insights || [],
        timeWindow: metrics.timeWindow
      };

    } catch (error) {
      logger.error('Error processing request for threat analysis:', error);
      
      // Return safe default
      return this.getDefaultCardinalityData();
    }
  }

  /**
   * Get cardinality metrics for a specific time window
   */
  public async getCardinalityMetrics(timeWindowMs: number = 3600000): Promise<CardinalityData> {
    if (!this.isInitialized) {
      throw new Error('CardinalityIntegration not initialized');
    }

    try {
      const metrics = await this.hllManager.getAggregatedMetrics(timeWindowMs);
      const analytics = await this.hllManager.getAnalytics('ips', timeWindowMs);
      
      const riskScore = this.calculateCardinalityRiskScore(metrics);
      const anomalyScore = analytics ? analytics.anomalyScore : 0;

      return {
        uniqueVisitors: metrics.uniqueVisitors,
        confidence: metrics.confidence,
        riskScore,
        anomalyScore,
        insights: [], // Would be populated from analytics if available
        timeWindow: metrics.timeWindow
      };

    } catch (error) {
      logger.error('Error getting cardinality metrics:', error);
      return this.getDefaultCardinalityData();
    }
  }

  /**
   * Calculate risk score based on cardinality patterns
   */
  private calculateCardinalityRiskScore(metrics: VisitorMetrics): number {
    let riskScore = 0;

    try {
      // Risk factors based on cardinality patterns
      
      // 1. Unusual IP to session ratio
      const ipSessionRatio = metrics.uniqueVisitors.sessions > 0 ? 
        metrics.uniqueVisitors.ips / metrics.uniqueVisitors.sessions : 0;
      
      if (ipSessionRatio > 0.8) {
        // High IP to session ratio might indicate distributed attack
        riskScore += 0.3;
      } else if (ipSessionRatio < 0.1) {
        // Very low ratio might indicate session hijacking or bot activity
        riskScore += 0.2;
      }

      // 2. User agent diversity
      const uaIpRatio = metrics.uniqueVisitors.ips > 0 ? 
        metrics.uniqueVisitors.userAgents / metrics.uniqueVisitors.ips : 0;
      
      if (uaIpRatio < 0.1) {
        // Very low user agent diversity indicates potential bot activity
        riskScore += 0.4;
      } else if (uaIpRatio > 2) {
        // Unusually high diversity might indicate spoofing
        riskScore += 0.2;
      }

      // 3. Geographic distribution
      const locationIpRatio = metrics.uniqueVisitors.ips > 0 ? 
        metrics.uniqueVisitors.locations / metrics.uniqueVisitors.ips : 0;
      
      if (locationIpRatio > 0.5) {
        // High geographic diversity might indicate distributed attack
        riskScore += 0.2;
      }

      // 4. Path access patterns
      const pathSessionRatio = metrics.uniqueVisitors.sessions > 0 ? 
        metrics.uniqueVisitors.paths / metrics.uniqueVisitors.sessions : 0;
      
      if (pathSessionRatio > 10) {
        // Very high path diversity might indicate scanning behavior
        riskScore += 0.3;
      }

      // 5. Growth rate consideration
      if (metrics.growthRate > 200) {
        // Extremely high growth rate is suspicious
        riskScore += 0.4;
      } else if (metrics.growthRate > 100) {
        // High growth rate needs monitoring
        riskScore += 0.2;
      }

      // 6. Confidence factor
      if (metrics.confidence < 0.7) {
        // Low confidence in estimates reduces reliability
        riskScore *= 0.7;
      }

    } catch (error) {
      logger.error('Error calculating cardinality risk score:', error);
    }

    return Math.min(Math.max(riskScore, 0), 1); // Clamp to 0-1 range
  }

  /**
   * Extract anomaly score from insights
   */
  private extractAnomalyScore(insights: UniqueVisitorInsight[]): number {
    if (insights.length === 0) return 0;

    let maxAnomalyScore = 0;
    
    for (const insight of insights) {
      if (insight.insight === 'anomaly_detected') {
        maxAnomalyScore = Math.max(maxAnomalyScore, insight.confidence);
      } else if (insight.impact === 'critical') {
        maxAnomalyScore = Math.max(maxAnomalyScore, 0.9);
      } else if (insight.impact === 'high') {
        maxAnomalyScore = Math.max(maxAnomalyScore, 0.7);
      }
    }

    return maxAnomalyScore;
  }

  /**
   * Get default cardinality data for fallback
   */
  private getDefaultCardinalityData(): CardinalityData {
    const now = new Date();
    
    return {
      uniqueVisitors: {
        total: 0,
        ips: 0,
        sessions: 0,
        userAgents: 0,
        locations: 0,
        paths: 0
      },
      confidence: 0.5,
      riskScore: 0,
      anomalyScore: 0,
      insights: [],
      timeWindow: {
        start: new Date(now.getTime() - 3600000), // 1 hour ago
        end: now,
        duration: 3600000
      }
    };
  }

  /**
   * Get cardinality-based threat indicators
   */
  public async getThreatIndicators(): Promise<{
    indicators: Array<{
      type: 'cardinality_anomaly' | 'ratio_anomaly' | 'growth_anomaly';
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      value: number;
      threshold: number;
      confidence: number;
    }>;
    overallRisk: number;
  }> {
    const indicators: Array<{
      type: 'cardinality_anomaly' | 'ratio_anomaly' | 'growth_anomaly';
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      value: number;
      threshold: number;
      confidence: number;
    }> = [];

    try {
      const cardinalityData = await this.getCardinalityMetrics();
      const metrics = cardinalityData.uniqueVisitors;

      // Check for unusual ratios
      const ipSessionRatio = metrics.sessions > 0 ? metrics.ips / metrics.sessions : 0;
      if (ipSessionRatio > 0.8) {
        indicators.push({
          type: 'ratio_anomaly',
          severity: ipSessionRatio > 0.95 ? 'critical' : 'high',
          description: `High IP to session ratio: ${ipSessionRatio.toFixed(2)}`,
          value: ipSessionRatio,
          threshold: 0.8,
          confidence: cardinalityData.confidence
        });
      }

      // Check for low user agent diversity
      const uaIpRatio = metrics.ips > 0 ? metrics.userAgents / metrics.ips : 0;
      if (uaIpRatio < 0.1 && metrics.ips > 10) {
        indicators.push({
          type: 'ratio_anomaly',
          severity: uaIpRatio < 0.05 ? 'critical' : 'high',
          description: `Low user agent diversity: ${uaIpRatio.toFixed(3)}`,
          value: uaIpRatio,
          threshold: 0.1,
          confidence: cardinalityData.confidence
        });
      }

      // Check for anomalies from insights
      if (cardinalityData.anomalyScore > 0.7) {
        indicators.push({
          type: 'cardinality_anomaly',
          severity: cardinalityData.anomalyScore > 0.9 ? 'critical' : 'high',
          description: `Cardinality anomaly detected`,
          value: cardinalityData.anomalyScore,
          threshold: 0.7,
          confidence: cardinalityData.confidence
        });
      }

      const overallRisk = Math.max(cardinalityData.riskScore, cardinalityData.anomalyScore);

      return { indicators, overallRisk };

    } catch (error) {
      logger.error('Error getting threat indicators:', error);
      return { indicators: [], overallRisk: 0 };
    }
  }

  /**
   * Get summary statistics for integration with other systems
   */
  public async getSummaryStatistics(): Promise<{
    totalUniqueVisitors: number;
    uniqueIPs: number;
    uniqueSessions: number;
    confidenceLevel: number;
    riskScore: number;
    memoryUsage: number;
    isHealthy: boolean;
  }> {
    try {
      if (!this.isInitialized) {
        return {
          totalUniqueVisitors: 0,
          uniqueIPs: 0,
          uniqueSessions: 0,
          confidenceLevel: 0,
          riskScore: 0,
          memoryUsage: 0,
          isHealthy: false
        };
      }

      const cardinalityData = await this.getCardinalityMetrics();
      const managerStats = this.hllManager.getManagerStatistics();

      return {
        totalUniqueVisitors: cardinalityData.uniqueVisitors.total,
        uniqueIPs: cardinalityData.uniqueVisitors.ips,
        uniqueSessions: cardinalityData.uniqueVisitors.sessions,
        confidenceLevel: cardinalityData.confidence,
        riskScore: cardinalityData.riskScore,
        memoryUsage: managerStats.totalMemoryUsage,
        isHealthy: managerStats.isInitialized && this.hllManager.isMemoryUsageHealthy()
      };

    } catch (error) {
      logger.error('Error getting summary statistics:', error);
      return {
        totalUniqueVisitors: 0,
        uniqueIPs: 0,
        uniqueSessions: 0,
        confidenceLevel: 0,
        riskScore: 0,
        memoryUsage: 0,
        isHealthy: false
      };
    }
  }

  /**
   * Check if cardinality integration is healthy
   */
  public isHealthy(): boolean {
    return this.isInitialized && this.hllManager.isMemoryUsageHealthy();
  }

  /**
   * Get the underlying HLL manager for advanced operations
   */
  public getHLLManager(): HyperLogLogManager {
    return this.hllManager;
  }

  /**
   * Shutdown the integration layer
   */
  public async shutdown(): Promise<void> {
    await this.hllManager.shutdown();
    this.isInitialized = false;
    
    logger.info('CardinalityIntegration shutdown complete');
  }
}
