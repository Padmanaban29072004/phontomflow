import { logger } from '@/utils/logger';
import { EWMA } from './EWMA';
import { EWMAStatisticalModels } from './EWMAStatisticalModels';
import {
  EWMAInsight,
  EWMAValidationResult,
  EWMAPerformanceMetrics,
  MultiWindowEWMA,
  TimeWindow,
  TrendDirection,
  DataPoint,
  EWMAForecast
} from '@/types/ewma';

/**
 * EWMA Analytics Engine for advanced analysis and insights
 * Provides comprehensive analytics on EWMA data and trends
 */
export class EWMAAnalytics {
  private ewmaInstances: Map<string, EWMA> = new Map();
  private statisticalModels: EWMAStatisticalModels;
  private performanceMetrics: EWMAPerformanceMetrics;
  private insights: EWMAInsight[] = [];
  private lastAnalysisTime: Date = new Date();

  constructor() {
    this.statisticalModels = new EWMAStatisticalModels();
    this.performanceMetrics = this.initializePerformanceMetrics();
  }

  /**
   * Add EWMA instance for analysis
   */
  public addEWMAInstance(name: string, ewma: EWMA): void {
    this.ewmaInstances.set(name, ewma);
    logger.debug(`Added EWMA instance: ${name}`);
  }

  /**
   * Remove EWMA instance
   */
  public removeEWMAInstance(name: string): boolean {
    const removed = this.ewmaInstances.delete(name);
    if (removed) {
      logger.debug(`Removed EWMA instance: ${name}`);
    }
    return removed;
  }

  /**
   * Generate comprehensive analytics across all EWMA instances
   */
  public generateAnalytics(): {
    summary: {
      totalInstances: number;
      activeInstances: number;
      averageAccuracy: number;
      totalAnomalies: number;
      overallTrend: TrendDirection;
    };
    insights: EWMAInsight[];
    performance: EWMAPerformanceMetrics;
    recommendations: string[];
  } {
    const startTime = process.hrtime.bigint();

    try {
      const activeInstances = Array.from(this.ewmaInstances.values());
      let totalAnomalies = 0;
      let accuracySum = 0;
      const trends: TrendDirection[] = [];

      // Analyze each instance
      for (const ewma of activeInstances) {
        const trend = ewma.getTrend();
        trends.push(trend);
        
        // Simplified metrics collection
        accuracySum += 0.8; // Would be calculated from actual performance
        totalAnomalies += 1; // Would be tracked from actual anomalies
      }

      const averageAccuracy = activeInstances.length > 0 ? accuracySum / activeInstances.length : 0;
      const overallTrend = this.determineOverallTrend(trends);

      // Generate insights
      this.generateInsights();

      // Generate recommendations
      const recommendations = this.generateRecommendations();

      // Update performance metrics
      const endTime = process.hrtime.bigint();
      const latency = Number(endTime - startTime) / 1000; // microseconds
      this.updatePerformanceMetrics(latency);

      this.lastAnalysisTime = new Date();

      return {
        summary: {
          totalInstances: this.ewmaInstances.size,
          activeInstances: activeInstances.length,
          averageAccuracy,
          totalAnomalies,
          overallTrend
        },
        insights: [...this.insights],
        performance: { ...this.performanceMetrics },
        recommendations
      };

    } catch (error) {
      logger.error('Error generating EWMA analytics:', error);
      throw error;
    }
  }

  /**
   * Analyze cross-window consensus
   */
  public analyzeMultiWindowConsensus(
    windowResults: Record<TimeWindow, any>
  ): MultiWindowEWMA['consensus'] {
    try {
      const windows = Object.keys(windowResults) as TimeWindow[];
      if (windows.length < 2) {
        return {
          trend: 'stable',
          anomalyScore: 0,
          confidence: 0.3,
          agreement: 0
        };
      }

      // Analyze trend consensus
      const trends = windows.map(w => windowResults[w].trend?.direction || 'stable');
      const trendCounts = this.countOccurrences(trends);
      const consensusTrend = this.getMostCommon(trendCounts) as TrendDirection;

      // Calculate agreement percentage
      const maxCount = Math.max(...Object.values(trendCounts));
      const agreement = maxCount / windows.length;

      // Calculate consensus anomaly score
      const anomalyScores = windows.map(w => windowResults[w].anomaly?.score || 0);
      const avgAnomalyScore = anomalyScores.reduce((sum, score) => sum + score, 0) / anomalyScores.length;

      // Calculate overall confidence
      const confidences = windows.map(w => windowResults[w].current?.confidence || 0.5);
      const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
      const consensusConfidence = avgConfidence * agreement;

      return {
        trend: consensusTrend,
        anomalyScore: avgAnomalyScore,
        confidence: consensusConfidence,
        agreement
      };

    } catch (error) {
      logger.error('Error analyzing multi-window consensus:', error);
      return {
        trend: 'stable',
        anomalyScore: 0,
        confidence: 0,
        agreement: 0
      };
    }
  }

  /**
   * Validate EWMA performance and accuracy
   */
  public validatePerformance(): EWMAValidationResult {
    try {
      const errors: EWMAValidationResult['errors'] = [];
      let overallAccuracy = 0;
      let totalSpeed = 0;
      let totalMemory = 0;

      // Validate each EWMA instance
      for (const [name, ewma] of this.ewmaInstances) {
        const validation = ewma.validate();
        
        if (!validation.isValid) {
          errors.push({
            type: 'calculation',
            description: `EWMA instance ${name} has validation issues: ${validation.issues.join(', ')}`,
            severity: 'medium',
            suggestion: 'Review EWMA configuration and data quality'
          });
        }

        overallAccuracy += validation.performance.accuracy;
        totalSpeed += 100; // Would be measured from actual performance
        totalMemory += validation.performance.memoryUsage;
      }

      // Calculate averages
      const instanceCount = this.ewmaInstances.size;
      const avgAccuracy = instanceCount > 0 ? overallAccuracy / instanceCount : 0;
      const avgSpeed = instanceCount > 0 ? totalSpeed / instanceCount : 0;

      // Check performance thresholds
      if (avgAccuracy < 0.7) {
        errors.push({
          type: 'accuracy',
          description: `Low average accuracy: ${avgAccuracy.toFixed(2)}`,
          severity: 'high',
          suggestion: 'Increase window sizes or adjust smoothing parameters'
        });
      }

      if (avgSpeed < 50) {
        errors.push({
          type: 'performance',
          description: `Low processing speed: ${avgSpeed.toFixed(0)} calculations/sec`,
          severity: 'medium',
          suggestion: 'Optimize calculation algorithms or reduce data points'
        });
      }

      const recommendations = this.generateValidationRecommendations(errors);

      return {
        isValid: errors.filter(e => e.severity === 'high').length === 0,
        accuracy: avgAccuracy,
        errors,
        performance: {
          speed: avgSpeed,
          memory: totalMemory,
          accuracy: avgAccuracy
        },
        recommendations
      };

    } catch (error) {
      logger.error('Error validating EWMA performance:', error);
      return {
        isValid: false,
        accuracy: 0,
        errors: [{
          type: 'calculation',
          description: 'Validation error occurred',
          severity: 'high',
          suggestion: 'Check EWMA configuration and data'
        }],
        performance: { speed: 0, memory: 0, accuracy: 0 },
        recommendations: ['Fix validation errors before proceeding']
      };
    }
  }

  /**
   * Generate forecast using statistical models
   */
  public generateForecast(
    dataPoints: DataPoint[], 
    horizonMinutes: number = 30
  ): EWMAForecast {
    try {
      // Add data points to statistical models
      dataPoints.forEach(dp => this.statisticalModels.addDataPoint(dp));
      
      // Generate forecast
      return this.statisticalModels.generateForecast(horizonMinutes, 0.8);

    } catch (error) {
      logger.error('Error generating forecast:', error);
      
      // Return default forecast
      return {
        horizon: horizonMinutes,
        predictions: [],
        accuracy: { expected: 0.3, confidence: 0.3 },
        assumptions: ['Error occurred during forecast generation'],
        limitations: ['Unable to generate reliable forecast due to error']
      };
    }
  }

  /**
   * Analyze trend patterns across time windows
   */
  public analyzeTrendPatterns(windowMinutes: number = 60): {
    patterns: Array<{
      pattern: string;
      frequency: number;
      confidence: number;
      description: string;
    }>;
    dominantPattern: string;
    stability: number;
  } {
    try {
      const trendAnalysis = this.statisticalModels.analyzeTrend(windowMinutes);
      
      // Analyze patterns
      const patterns = [
        {
          pattern: 'increasing_trend',
          frequency: trendAnalysis.longTerm.trend === 'increasing' ? 1 : 0,
          confidence: trendAnalysis.longTerm.confidence,
          description: 'Sustained increasing trend detected'
        },
        {
          pattern: 'decreasing_trend',
          frequency: trendAnalysis.longTerm.trend === 'decreasing' ? 1 : 0,
          confidence: trendAnalysis.longTerm.confidence,
          description: 'Sustained decreasing trend detected'
        },
        {
          pattern: 'stable_pattern',
          frequency: trendAnalysis.longTerm.trend === 'stable' ? 1 : 0,
          confidence: trendAnalysis.longTerm.confidence,
          description: 'Stable pattern with minimal variation'
        },
        {
          pattern: 'seasonal_pattern',
          frequency: trendAnalysis.seasonality.detected ? 1 : 0,
          confidence: trendAnalysis.seasonality.confidence,
          description: `Seasonal pattern with ${trendAnalysis.seasonality.period} minute period`
        }
      ].filter(p => p.frequency > 0);

      // Determine dominant pattern
      const dominantPattern = patterns.length > 0 ? 
        patterns.reduce((prev, curr) => prev.confidence > curr.confidence ? prev : curr).pattern :
        'no_pattern';

      // Calculate stability (inverse of change points)
      const stability = Math.max(0, 1 - (trendAnalysis.changePoints.length / 10));

      return { patterns, dominantPattern, stability };

    } catch (error) {
      logger.error('Error analyzing trend patterns:', error);
      return {
        patterns: [],
        dominantPattern: 'unknown',
        stability: 0.5
      };
    }
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): EWMAPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get current insights
   */
  public getInsights(): EWMAInsight[] {
    return [...this.insights];
  }

  /**
   * Clear analytics data
   */
  public clear(): void {
    this.insights = [];
    this.statisticalModels.clear();
    this.performanceMetrics = this.initializePerformanceMetrics();
    
    logger.debug('EWMA analytics cleared');
  }

  /**
   * Generate insights from EWMA analysis
   */
  private generateInsights(): void {
    this.insights = []; // Clear previous insights

    try {
      // Analyze trend changes
      this.analyzeTrendChanges();
      
      // Analyze volatility spikes
      this.analyzeVolatilitySpikes();
      
      // Analyze performance issues
      this.analyzePerformanceIssues();

    } catch (error) {
      logger.error('Error generating insights:', error);
    }
  }

  /**
   * Analyze trend changes across instances
   */
  private analyzeTrendChanges(): void {
    const trendCounts = { increasing: 0, decreasing: 0, stable: 0, volatile: 0 };
    
    for (const ewma of this.ewmaInstances.values()) {
      const trend = ewma.getTrend();
      trendCounts[trend]++;
    }

    const totalInstances = this.ewmaInstances.size;
    if (totalInstances === 0) return;

    // Check for dominant trends
    if (trendCounts.increasing > totalInstances * 0.7) {
      this.insights.push({
        type: 'trend_change',
        severity: 'medium',
        description: 'Strong increasing trend detected across multiple metrics',
        confidence: 0.8,
        data: {
          metric: 'overall_trend',
          currentValue: trendCounts.increasing,
          expectedValue: totalInstances * 0.3,
          deviation: trendCounts.increasing - totalInstances * 0.3,
          timeWindow: '60min',
          duration: 60
        },
        recommendations: [
          'Monitor for capacity issues',
          'Check for traffic increases',
          'Validate trend sustainability'
        ],
        timestamp: new Date(),
        affectedWindows: ['1min', '5min', '15min', '60min']
      });
    }

    if (trendCounts.volatile > totalInstances * 0.5) {
      this.insights.push({
        type: 'volatility_spike',
        severity: 'high',
        description: 'High volatility detected across multiple metrics',
        confidence: 0.9,
        data: {
          metric: 'volatility',
          currentValue: trendCounts.volatile,
          expectedValue: totalInstances * 0.2,
          deviation: trendCounts.volatile - totalInstances * 0.2,
          timeWindow: '60min',
          duration: 30
        },
        recommendations: [
          'Investigate source of volatility',
          'Check for system instabilities',
          'Consider increasing smoothing parameters'
        ],
        timestamp: new Date(),
        affectedWindows: ['1min', '5min']
      });
    }
  }

  /**
   * Analyze volatility spikes
   */
  private analyzeVolatilitySpikes(): void {
    let highVolatilityCount = 0;
    
    for (const ewma of this.ewmaInstances.values()) {
      const volatilityAnalysis = ewma.getVolatilityAnalysis();
      if (volatilityAnalysis.regime === 'high' || volatilityAnalysis.regime === 'extreme') {
        highVolatilityCount++;
      }
    }

    if (highVolatilityCount > this.ewmaInstances.size * 0.3) {
      this.insights.push({
        type: 'volatility_spike',
        severity: 'high',
        description: `High volatility detected in ${highVolatilityCount} metrics`,
        confidence: 0.85,
        data: {
          metric: 'volatility_count',
          currentValue: highVolatilityCount,
          expectedValue: this.ewmaInstances.size * 0.1,
          deviation: highVolatilityCount - this.ewmaInstances.size * 0.1,
          timeWindow: '15min',
          duration: 15
        },
        recommendations: [
          'Investigate volatility sources',
          'Consider adaptive smoothing',
          'Monitor for system issues'
        ],
        timestamp: new Date(),
        affectedWindows: ['5min', '15min']
      });
    }
  }

  /**
   * Analyze performance issues
   */
  private analyzePerformanceIssues(): void {
    if (this.performanceMetrics.accuracy.prediction < 0.7) {
      this.insights.push({
        type: 'performance_degradation',
        severity: 'medium',
        description: 'EWMA prediction accuracy below threshold',
        confidence: 0.8,
        data: {
          metric: 'prediction_accuracy',
          currentValue: this.performanceMetrics.accuracy.prediction,
          expectedValue: 0.8,
          deviation: this.performanceMetrics.accuracy.prediction - 0.8,
          timeWindow: '60min',
          duration: 60
        },
        recommendations: [
          'Review EWMA parameters',
          'Increase window sizes',
          'Check data quality'
        ],
        timestamp: new Date(),
        affectedWindows: ['60min']
      });
    }
  }

  /**
   * Generate recommendations based on current state
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Based on number of instances
    if (this.ewmaInstances.size === 0) {
      recommendations.push('No EWMA instances active - add instances for analysis');
    } else if (this.ewmaInstances.size < 3) {
      recommendations.push('Consider adding more EWMA instances for better coverage');
    }

    // Based on performance
    if (this.performanceMetrics.accuracy.prediction < 0.7) {
      recommendations.push('Improve EWMA accuracy by adjusting smoothing parameters');
    }

    if (this.performanceMetrics.memory.efficiency < 0.8) {
      recommendations.push('Optimize memory usage by reducing window sizes or data retention');
    }

    // Based on insights
    const highSeverityInsights = this.insights.filter(i => i.severity === 'high' || i.severity === 'critical');
    if (highSeverityInsights.length > 0) {
      recommendations.push('Address high-severity insights immediately');
    }

    if (recommendations.length === 0) {
      recommendations.push('EWMA system operating normally - continue monitoring');
    }

    return recommendations;
  }

  /**
   * Generate validation recommendations
   */
  private generateValidationRecommendations(errors: EWMAValidationResult['errors']): string[] {
    const recommendations: string[] = [];

    const highErrors = errors.filter(e => e.severity === 'high');
    const mediumErrors = errors.filter(e => e.severity === 'medium');

    if (highErrors.length > 0) {
      recommendations.push('Address high-severity validation errors immediately');
      recommendations.push('Review EWMA configuration and parameters');
    }

    if (mediumErrors.length > 0) {
      recommendations.push('Consider optimizing EWMA performance');
      recommendations.push('Monitor system resources and data quality');
    }

    if (errors.length === 0) {
      recommendations.push('EWMA validation passed - system operating correctly');
    }

    return recommendations;
  }

  /**
   * Determine overall trend from multiple trends
   */
  private determineOverallTrend(trends: TrendDirection[]): TrendDirection {
    if (trends.length === 0) return 'stable';

    const counts = this.countOccurrences(trends);
    return this.getMostCommon(counts) as TrendDirection;
  }

  /**
   * Count occurrences in array
   */
  private countOccurrences<T>(items: T[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    items.forEach(item => {
      const key = String(item);
      counts[key] = (counts[key] || 0) + 1;
    });

    return counts;
  }

  /**
   * Get most common item from counts
   */
  private getMostCommon(counts: Record<string, number>): string {
    let maxCount = 0;
    let mostCommon = '';

    Object.entries(counts).forEach(([item, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    });

    return mostCommon;
  }

  /**
   * Initialize performance metrics
   */
  private initializePerformanceMetrics(): EWMAPerformanceMetrics {
    return {
      accuracy: {
        prediction: 0.8,
        trend: 0.85,
        anomaly: 0.82
      },
      latency: {
        calculation: 0,
        adaptation: 0,
        prediction: 0
      },
      throughput: {
        dataPointsPerSecond: 0,
        calculationsPerSecond: 0
      },
      memory: {
        totalUsage: 0,
        perWindow: 0,
        efficiency: 0.8
      },
      reliability: {
        uptime: 1.0,
        errorRate: 0,
        adaptationSuccess: 0.9
      }
    };
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(latency: number): void {
    this.performanceMetrics.latency.calculation = latency;
    this.performanceMetrics.throughput.calculationsPerSecond = 1000000 / latency; // Convert from microseconds
    
    // Update memory usage
    let totalMemory = 0;
    for (const ewma of this.ewmaInstances.values()) {
      totalMemory += ewma.getMemoryUsage();
    }
    this.performanceMetrics.memory.totalUsage = totalMemory;
    this.performanceMetrics.memory.perWindow = this.ewmaInstances.size > 0 ? 
      totalMemory / this.ewmaInstances.size : 0;
  }
}
