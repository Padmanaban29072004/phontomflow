import { logger } from '@/utils/logger';
import { RedisService } from './RedisService';
import { EWMAManager } from './EWMAManager';
import { BaselineAdaptationService } from './BaselineAdaptationService';
import {
  EWMAIntegrationData,
  EWMAInsight,
  DataPoint,
  TimeWindow,
  TrendDirection
} from '@/types/ewma';
import { getEWMAManagerConfig, getBaselineAdaptationConfig } from '@/config/ewmaConfig';

/**
 * EWMAIntegration provides a clean interface between EWMA analysis
 * and the existing threat detection system without modifying StatisticalAnalyzer
 */
export class EWMAIntegration {
  private ewmaManager: EWMAManager;
  private baselineAdaptation: BaselineAdaptationService;
  private redisService: RedisService;
  private isInitialized: boolean = false;
  
  private integrationWeights: {
    anomalyScore: number;
    trendScore: number;
    volatilityScore: number;
    baselineScore: number;
  };

  constructor(redisService: RedisService) {
    this.redisService = redisService;
    this.ewmaManager = new EWMAManager(redisService, getEWMAManagerConfig());
    this.baselineAdaptation = new BaselineAdaptationService(
      getBaselineAdaptationConfig(),
      redisService,
      this.ewmaManager
    );
    
    this.integrationWeights = {
      anomalyScore: parseFloat(process.env.EWMA_STATISTICAL_ANOMALY_WEIGHT || '0.4'),
      trendScore: parseFloat(process.env.EWMA_STATISTICAL_TREND_WEIGHT || '0.2'),
      volatilityScore: 0.2,
      baselineScore: parseFloat(process.env.EWMA_STATISTICAL_RISK_WEIGHT || '0.3')
    };
  }

  /**
   * Initialize the integration layer
   */
  public async initialize(): Promise<void> {
    try {
      await this.ewmaManager.initialize();
      await this.baselineAdaptation.initialize();
      
      this.isInitialized = true;
      
      logger.info('EWMAIntegration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize EWMAIntegration:', error);
      throw error;
    }
  }

  /**
   * Process metric data and get EWMA analysis for threat detection
   */
  public async processMetricForThreatAnalysis(
    metricName: string,
    value: number,
    timestamp?: Date
  ): Promise<EWMAIntegrationData> {
    if (!this.isInitialized) {
      throw new Error('EWMAIntegration not initialized');
    }

    try {
      const dataPoint: DataPoint = {
        value,
        timestamp: timestamp || new Date(),
        metadata: {
          source: 'threat_analysis',
          type: metricName
        }
      };

      // Process through EWMA manager
      const multiWindowResult = await this.ewmaManager.processDataPoint(dataPoint);

      // Process through baseline adaptation
      const adaptationResult = await this.baselineAdaptation.processDataPoint(metricName, dataPoint);

      // Get current baseline
      const baseline = this.baselineAdaptation.getBaseline(metricName) || value;

      // Extract key metrics from multi-window analysis
      const primaryWindow = '5min'; // Use 5min as primary window
      const primaryResult = multiWindowResult.windows[primaryWindow];

      if (!primaryResult) {
        return this.getDefaultIntegrationData(metricName, value, baseline);
      }

      // Calculate comprehensive risk score
      const riskScore = this.calculateIntegratedRiskScore(
        primaryResult,
        multiWindowResult.consensus,
        baseline,
        value
      );

      // Generate insights
      const insights = this.generateIntegrationInsights(
        metricName,
        multiWindowResult,
        adaptationResult
      );

      // Generate recommendations
      const recommendations = this.generateIntegrationRecommendations(
        multiWindowResult.consensus,
        adaptationResult,
        riskScore
      );

      // Determine health status
      const healthStatus = this.determineHealthStatus(riskScore, multiWindowResult.consensus);

      // Generate prediction
      const prediction = primaryResult.prediction || {
        nextValue: value,
        confidence: 0.5,
        range: { min: value * 0.9, max: value * 1.1 }
      };

      return {
        baseline,
        trend: multiWindowResult.consensus.trend,
        volatility: primaryResult.statistics?.volatility || 0,
        anomalyScore: multiWindowResult.consensus.anomalyScore,
        confidence: multiWindowResult.consensus.confidence,
        prediction: {
          nextValue: prediction.nextValue,
          confidence: prediction.confidence,
          timeHorizon: 5 // 5 minutes
        },
        insights,
        recommendations,
        riskScore,
        healthStatus
      };

    } catch (error) {
      logger.error('Error processing metric for threat analysis:', error);
      return this.getDefaultIntegrationData(metricName, value, value);
    }
  }

  /**
   * Get EWMA-based threat indicators
   */
  public async getThreatIndicators(): Promise<{
    indicators: Array<{
      type: 'baseline_drift' | 'trend_anomaly' | 'volatility_spike' | 'prediction_failure';
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      confidence: number;
      metric: string;
      value: number;
      threshold: number;
    }>;
    overallRisk: number;
    summary: string;
  }> {
    const indicators: Array<{
      type: 'baseline_drift' | 'trend_anomaly' | 'volatility_spike' | 'prediction_failure';
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      confidence: number;
      metric: string;
      value: number;
      threshold: number;
    }> = [];

    try {
      // Get insights from EWMA analytics
      const insights = this.ewmaManager.getInsights();

      // Convert insights to threat indicators
      for (const insight of insights) {
        let indicatorType: 'baseline_drift' | 'trend_anomaly' | 'volatility_spike' | 'prediction_failure';
        
        switch (insight.type) {
          case 'baseline_drift':
            indicatorType = 'baseline_drift';
            break;
          case 'trend_change':
            indicatorType = 'trend_anomaly';
            break;
          case 'volatility_spike':
            indicatorType = 'volatility_spike';
            break;
          case 'performance_degradation':
            indicatorType = 'prediction_failure';
            break;
          default:
            indicatorType = 'trend_anomaly';
        }

        indicators.push({
          type: indicatorType,
          severity: insight.severity,
          description: insight.description,
          confidence: insight.confidence,
          metric: insight.data.metric,
          value: insight.data.currentValue,
          threshold: insight.data.expectedValue
        });
      }

      // Check baseline adaptation statistics
      const adaptationStats = this.baselineAdaptation.getAdaptationStatistics();
      if (adaptationStats.failedAdaptations > adaptationStats.successfulAdaptations) {
        indicators.push({
          type: 'baseline_drift',
          severity: 'medium',
          description: `High baseline adaptation failure rate: ${adaptationStats.failedAdaptations}/${adaptationStats.totalAdaptations}`,
          confidence: 0.8,
          metric: 'baseline_adaptation',
          value: adaptationStats.failedAdaptations,
          threshold: adaptationStats.successfulAdaptations
        });
      }

      // Calculate overall risk
      const overallRisk = this.calculateOverallThreatRisk(indicators);

      // Generate summary
      const summary = this.generateThreatSummary(indicators, overallRisk);

      return { indicators, overallRisk, summary };

    } catch (error) {
      logger.error('Error getting EWMA threat indicators:', error);
      return {
        indicators: [],
        overallRisk: 0,
        summary: 'Unable to assess EWMA-based threats due to error'
      };
    }
  }

  /**
   * Get summary statistics for integration with other systems
   */
  public async getSummaryStatistics(): Promise<{
    ewmaWindows: number;
    totalDataPoints: number;
    averageAccuracy: number;
    anomaliesDetected: number;
    baselineAdaptations: number;
    memoryUsage: number;
    isHealthy: boolean;
    lastUpdate: Date;
  }> {
    try {
      if (!this.isInitialized) {
        return {
          ewmaWindows: 0,
          totalDataPoints: 0,
          averageAccuracy: 0,
          anomaliesDetected: 0,
          baselineAdaptations: 0,
          memoryUsage: 0,
          isHealthy: false,
          lastUpdate: new Date()
        };
      }

      const ewmaStats = this.ewmaManager.getStatistics();
      const adaptationStats = this.baselineAdaptation.getAdaptationStatistics();
      const healthCheck = this.ewmaManager.getHealthCheck();

      return {
        ewmaWindows: ewmaStats.windowsActive,
        totalDataPoints: ewmaStats.totalDataPoints,
        averageAccuracy: ewmaStats.averageAccuracy,
        anomaliesDetected: ewmaStats.anomaliesDetected,
        baselineAdaptations: adaptationStats.totalAdaptations,
        memoryUsage: ewmaStats.memoryUsage,
        isHealthy: healthCheck.isHealthy,
        lastUpdate: ewmaStats.lastUpdate
      };

    } catch (error) {
      logger.error('Error getting EWMA summary statistics:', error);
      return {
        ewmaWindows: 0,
        totalDataPoints: 0,
        averageAccuracy: 0,
        anomaliesDetected: 0,
        baselineAdaptations: 0,
        memoryUsage: 0,
        isHealthy: false,
        lastUpdate: new Date()
      };
    }
  }

  /**
   * Check if EWMA integration is healthy
   */
  public isHealthy(): boolean {
    return this.isInitialized && this.ewmaManager.getHealthCheck().isHealthy;
  }

  /**
   * Get the underlying EWMA manager for advanced operations
   */
  public getEWMAManager(): EWMAManager {
    return this.ewmaManager;
  }

  /**
   * Get the baseline adaptation service
   */
  public getBaselineAdaptationService(): BaselineAdaptationService {
    return this.baselineAdaptation;
  }

  /**
   * Shutdown the integration layer
   */
  public async shutdown(): Promise<void> {
    await this.ewmaManager.shutdown();
    await this.baselineAdaptation.shutdown();
    
    this.isInitialized = false;
    logger.info('EWMAIntegration shutdown complete');
  }

  /**
   * Calculate integrated risk score combining multiple factors
   */
  private calculateIntegratedRiskScore(
    primaryResult: any,
    consensus: any,
    baseline: number,
    currentValue: number
  ): number {
    let riskScore = 0;

    // Anomaly score contribution
    riskScore += consensus.anomalyScore * this.integrationWeights.anomalyScore;

    // Trend contribution
    const trendRisk = this.calculateTrendRisk(consensus.trend);
    riskScore += trendRisk * this.integrationWeights.trendScore;

    // Volatility contribution
    const volatilityRisk = this.calculateVolatilityRisk(primaryResult.statistics?.volatility || 0);
    riskScore += volatilityRisk * this.integrationWeights.volatilityScore;

    // Baseline deviation contribution
    const baselineDeviation = Math.abs(currentValue - baseline) / (baseline + 0.001);
    const baselineRisk = Math.min(1, baselineDeviation);
    riskScore += baselineRisk * this.integrationWeights.baselineScore;

    // Confidence adjustment
    const confidenceAdjustment = Math.max(0.5, consensus.confidence);
    riskScore *= confidenceAdjustment;

    return Math.min(Math.max(riskScore, 0), 1);
  }

  /**
   * Calculate trend-based risk
   */
  private calculateTrendRisk(trend: TrendDirection): number {
    switch (trend) {
      case 'volatile':
        return 0.8;
      case 'increasing':
      case 'decreasing':
        return 0.4;
      case 'stable':
      default:
        return 0.1;
    }
  }

  /**
   * Calculate volatility-based risk
   */
  private calculateVolatilityRisk(volatility: number): number {
    // Normalize volatility to risk score
    return Math.min(1, volatility / 10); // Assume volatility > 10 is high risk
  }

  /**
   * Generate integration-specific insights
   */
  private generateIntegrationInsights(
    metricName: string,
    multiWindowResult: any,
    adaptationResult: any
  ): EWMAInsight[] {
    const insights: EWMAInsight[] = [];

    // Add consensus-based insights
    if (multiWindowResult.consensus.agreement < 0.5) {
      insights.push({
        type: 'trend_change',
        severity: 'medium',
        description: `Low consensus between time windows for ${metricName}`,
        confidence: 1 - multiWindowResult.consensus.agreement,
        data: {
          metric: metricName,
          currentValue: multiWindowResult.consensus.agreement,
          expectedValue: 0.7,
          deviation: 0.7 - multiWindowResult.consensus.agreement,
          timeWindow: '5min',
          duration: 5
        },
        recommendations: [
          'Check data quality and consistency',
          'Review EWMA parameters for different windows',
          'Investigate potential data source issues'
        ],
        timestamp: new Date(),
        affectedWindows: ['1min', '5min', '15min', '60min']
      });
    }

    // Add adaptation-based insights
    if (adaptationResult?.adapted) {
      insights.push({
        type: 'baseline_drift',
        severity: adaptationResult.confidence > 0.8 ? 'low' : 'medium',
        description: `Baseline adapted for ${metricName}: ${adaptationResult.reason}`,
        confidence: adaptationResult.confidence,
        data: {
          metric: metricName,
          currentValue: adaptationResult.newBaseline,
          expectedValue: adaptationResult.oldBaseline,
          deviation: Math.abs(adaptationResult.newBaseline - adaptationResult.oldBaseline),
          timeWindow: '15min',
          duration: adaptationResult.validationPeriod
        },
        recommendations: [
          'Monitor adaptation performance during validation period',
          'Verify adaptation is improving prediction accuracy',
          'Check for legitimate system changes'
        ],
        timestamp: new Date(),
        affectedWindows: ['5min', '15min']
      });
    }

    return insights;
  }

  /**
   * Generate integration-specific recommendations
   */
  private generateIntegrationRecommendations(
    consensus: any,
    adaptationResult: any,
    riskScore: number
  ): string[] {
    const recommendations: string[] = [];

    // Risk-based recommendations
    if (riskScore > 0.8) {
      recommendations.push('High EWMA risk score - immediate investigation required');
      recommendations.push('Check for system anomalies or attacks');
    } else if (riskScore > 0.6) {
      recommendations.push('Moderate EWMA risk - monitor closely');
      recommendations.push('Review recent system changes');
    } else if (riskScore > 0.4) {
      recommendations.push('Low EWMA risk detected - continue monitoring');
    }

    // Consensus-based recommendations
    if (consensus.agreement < 0.5) {
      recommendations.push('Low consensus between time windows - review data quality');
    }

    // Adaptation-based recommendations
    if (adaptationResult?.adapted) {
      recommendations.push('Baseline adaptation in progress - monitor validation results');
    }

    // Trend-based recommendations
    if (consensus.trend === 'volatile') {
      recommendations.push('High volatility detected - investigate system stability');
    } else if (consensus.trend === 'increasing') {
      recommendations.push('Increasing trend - monitor for capacity issues');
    } else if (consensus.trend === 'decreasing') {
      recommendations.push('Decreasing trend - check for service degradation');
    }

    if (recommendations.length === 0) {
      recommendations.push('EWMA analysis shows normal patterns');
    }

    return recommendations;
  }

  /**
   * Determine health status based on risk and consensus
   */
  private determineHealthStatus(riskScore: number, consensus: any): 'healthy' | 'warning' | 'critical' {
    if (riskScore > 0.8 || consensus.anomalyScore > 0.9) {
      return 'critical';
    } else if (riskScore > 0.6 || consensus.anomalyScore > 0.7 || consensus.agreement < 0.4) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  /**
   * Calculate overall threat risk from indicators
   */
  private calculateOverallThreatRisk(indicators: any[]): number {
    if (indicators.length === 0) return 0;

    const severityWeights: Record<'low' | 'medium' | 'high' | 'critical', number> = {
      low: 0.2, medium: 0.5, high: 0.8, critical: 1.0
    };
    let totalRisk = 0;
    let totalWeight = 0;

    for (const indicator of indicators) {
      const severity = indicator.severity as keyof typeof severityWeights;
      const weight = severityWeights[severity] * indicator.confidence;
      totalRisk += weight;
      totalWeight += indicator.confidence;
    }

    return totalWeight > 0 ? Math.min(totalRisk / totalWeight, 1) : 0;
  }

  /**
   * Generate threat summary
   */
  private generateThreatSummary(indicators: any[], overallRisk: number): string {
    if (indicators.length === 0) {
      return 'No EWMA-based threats detected';
    }

    const criticalCount = indicators.filter(i => i.severity === 'critical').length;
    const highCount = indicators.filter(i => i.severity === 'high').length;

    if (criticalCount > 0) {
      return `Critical EWMA threats detected: ${criticalCount} critical, ${highCount} high severity indicators`;
    } else if (highCount > 0) {
      return `High EWMA threats detected: ${highCount} high severity indicators`;
    } else {
      return `Moderate EWMA anomalies detected: ${indicators.length} indicators`;
    }
  }

  /**
   * Get default integration data for fallback
   */
  private getDefaultIntegrationData(metricName: string, value: number, baseline: number): EWMAIntegrationData {
    return {
      baseline,
      trend: 'stable',
      volatility: 0,
      anomalyScore: 0,
      confidence: 0.5,
      prediction: {
        nextValue: value,
        confidence: 0.3,
        timeHorizon: 5
      },
      insights: [],
      recommendations: [`Unable to analyze ${metricName} - insufficient data`],
      riskScore: 0,
      healthStatus: 'warning'
    };
  }
}
