import { logger } from '@/utils/logger';
import { 
  HLLAnalyticsResult, 
  VisitorPattern, 
  UniqueVisitorInsight, 
  CardinalityComparison,
  TimeSeriesCardinality 
} from '@/types/hyperloglog';
import { VisitorTracker } from '@/services/VisitorTracker';

/**
 * HLL Analytics Engine for pattern analysis and insights
 * Provides advanced analytics on cardinality data
 */
export class HLLAnalytics {
  private visitorTracker: VisitorTracker;
  private historicalData: Map<string, TimeSeriesCardinality[]> = new Map();
  private patterns: Map<string, VisitorPattern> = new Map();

  constructor(visitorTracker: VisitorTracker) {
    this.visitorTracker = visitorTracker;
  }

  /**
   * Analyze trends and patterns in visitor data
   */
  public analyzeVisitorTrends(
    metric: string, 
    timeWindowMs: number,
    comparisonPeriods: number = 7
  ): HLLAnalyticsResult {
    try {
      const currentEstimate = this.visitorTracker.getCardinality(metric, timeWindowMs);
      if (!currentEstimate) {
        throw new Error(`No data available for metric: ${metric}`);
      }

      // Get historical data for comparison
      const historical = this.getHistoricalData(metric, comparisonPeriods);
      const previousValue = historical.length > 0 ? historical[historical.length - 1].cardinality : 0;
      
      // Calculate growth rate
      const growthRate = previousValue > 0 ? 
        ((currentEstimate.count - previousValue) / previousValue) * 100 : 0;

      // Determine trend
      let trend: 'increasing' | 'decreasing' | 'stable';
      if (Math.abs(growthRate) < 5) {
        trend = 'stable';
      } else if (growthRate > 0) {
        trend = 'increasing';
      } else {
        trend = 'decreasing';
      }

      // Calculate volatility
      const volatility = this.calculateVolatility(historical);

      // Calculate anomaly score
      const anomalyScore = this.calculateAnomalyScore(currentEstimate.count, historical);

      // Generate recommendations
      const recommendations = this.generateRecommendations(trend, growthRate, anomalyScore);

      const now = new Date();
      const previousPeriodStart = new Date(now.getTime() - (timeWindowMs * 2));
      const previousPeriodEnd = new Date(now.getTime() - timeWindowMs);

      return {
        metric,
        currentValue: currentEstimate.count,
        previousValue,
        growthRate,
        trend,
        volatility,
        anomalyScore,
        recommendations,
        timeWindow: {
          current: {
            start: new Date(now.getTime() - timeWindowMs),
            end: now
          },
          previous: {
            start: previousPeriodStart,
            end: previousPeriodEnd
          }
        }
      };

    } catch (error) {
      logger.error('Error analyzing visitor trends:', error);
      throw error;
    }
  }

  /**
   * Detect visitor patterns (growth, seasonal, etc.)
   */
  public detectVisitorPattern(metric: string, dataPoints: number = 24): VisitorPattern {
    try {
      const historical = this.getHistoricalData(metric, dataPoints);
      
      if (historical.length < 3) {
        return {
          type: 'steady',
          confidence: 0.5,
          description: 'Insufficient data for pattern analysis',
          characteristics: {
            averageGrowthRate: 0,
            peakTimes: [],
            lowTimes: [],
            seasonality: 0
          },
          predictions: {
            nextPeriod: historical.length > 0 ? historical[historical.length - 1].cardinality : 0,
            confidence: 0.5,
            range: { min: 0, max: 0 }
          }
        };
      }

      const cardinalities = historical.map(h => h.cardinality);
      
      // Analyze growth pattern
      const growthRates = this.calculateGrowthRates(cardinalities);
      const avgGrowthRate = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
      
      // Detect pattern type
      let patternType: VisitorPattern['type'];
      const confidence = 0.8;
      
      if (Math.abs(avgGrowthRate) < 2) {
        patternType = 'steady';
      } else if (avgGrowthRate > 10) {
        patternType = 'growing';
      } else if (avgGrowthRate < -10) {
        patternType = 'declining';
      } else {
        // Check for spiky or seasonal patterns
        const variance = this.calculateVariance(cardinalities);
        const mean = cardinalities.reduce((sum, val) => sum + val, 0) / cardinalities.length;
        const coefficientOfVariation = Math.sqrt(variance) / mean;
        
        if (coefficientOfVariation > 0.5) {
          patternType = 'spiky';
        } else {
          patternType = 'seasonal';
        }
      }

      // Identify peak and low times
      const peakTimes = this.identifyPeakTimes(historical);
      const lowTimes = this.identifyLowTimes(historical);
      
      // Calculate seasonality score
      const seasonality = this.calculateSeasonality(cardinalities);

      // Generate predictions
      const prediction = this.predictNextPeriod(cardinalities, avgGrowthRate);

      const pattern: VisitorPattern = {
        type: patternType,
        confidence,
        description: this.generatePatternDescription(patternType, avgGrowthRate),
        characteristics: {
          averageGrowthRate: avgGrowthRate,
          peakTimes,
          lowTimes,
          seasonality
        },
        predictions: {
          nextPeriod: prediction.value,
          confidence: prediction.confidence,
          range: prediction.range
        }
      };

      // Cache the pattern
      this.patterns.set(metric, pattern);
      
      return pattern;

    } catch (error) {
      logger.error('Error detecting visitor pattern:', error);
      throw error;
    }
  }

  /**
   * Generate insights from visitor data
   */
  public generateInsights(metrics: string[] = ['ips', 'sessions']): UniqueVisitorInsight[] {
    const insights: UniqueVisitorInsight[] = [];

    try {
      for (const metric of metrics) {
        const analysis = this.analyzeVisitorTrends(metric, 3600000); // 1 hour window
        
        // High growth insight
        if (analysis.growthRate > 50) {
          insights.push({
            insight: 'high_growth',
            description: `${metric} showing exceptional growth of ${analysis.growthRate.toFixed(1)}%`,
            impact: analysis.growthRate > 100 ? 'critical' : 'high',
            confidence: 0.9,
            data: {
              current: analysis.currentValue,
              expected: analysis.previousValue,
              deviation: analysis.growthRate
            },
            recommendations: [
              'Monitor server capacity to handle increased load',
              'Investigate source of traffic increase',
              'Consider scaling infrastructure if sustained'
            ],
            timestamp: new Date()
          });
        }

        // Anomaly insight
        if (analysis.anomalyScore > 0.7) {
          insights.push({
            insight: 'anomaly_detected',
            description: `Unusual ${metric} pattern detected (anomaly score: ${analysis.anomalyScore.toFixed(2)})`,
            impact: analysis.anomalyScore > 0.9 ? 'critical' : 'medium',
            confidence: analysis.anomalyScore,
            data: {
              current: analysis.currentValue,
              expected: analysis.previousValue,
              deviation: (analysis.currentValue - analysis.previousValue) / analysis.previousValue * 100
            },
            recommendations: [
              'Investigate potential security threats',
              'Check for bot activity or DDoS attacks',
              'Validate data accuracy'
            ],
            timestamp: new Date()
          });
        }

        // Low activity insight
        if (analysis.growthRate < -30) {
          insights.push({
            insight: 'low_activity',
            description: `${metric} showing significant decline of ${Math.abs(analysis.growthRate).toFixed(1)}%`,
            impact: 'medium',
            confidence: 0.8,
            data: {
              current: analysis.currentValue,
              expected: analysis.previousValue,
              deviation: analysis.growthRate
            },
            recommendations: [
              'Check for service outages or issues',
              'Investigate potential blocking or filtering',
              'Review marketing or traffic sources'
            ],
            timestamp: new Date()
          });
        }
      }

    } catch (error) {
      logger.error('Error generating insights:', error);
    }

    return insights;
  }

  /**
   * Compare cardinalities across different time periods
   */
  public compareCardinalities(
    metric: string,
    periods: { name: string; windowMs: number }[]
  ): CardinalityComparison {
    const comparison: CardinalityComparison = {
      metric,
      periods: [],
      analysis: {
        trend: 'stable',
        changeRate: 0,
        significance: 'low',
        interpretation: ''
      }
    };

    try {
      for (const period of periods) {
        const estimate = this.visitorTracker.getCardinality(metric, period.windowMs);
        if (estimate) {
          const now = new Date();
          comparison.periods.push({
            name: period.name,
            cardinality: estimate.count,
            confidence: estimate.confidence,
            timeRange: {
              start: new Date(now.getTime() - period.windowMs),
              end: now
            }
          });
        }
      }

      // Analyze the comparison
      if (comparison.periods.length >= 2) {
        const first = comparison.periods[0];
        const last = comparison.periods[comparison.periods.length - 1];
        
        const changeRate = first.cardinality > 0 ? 
          ((last.cardinality - first.cardinality) / first.cardinality) * 100 : 0;
        
        comparison.analysis.changeRate = changeRate;
        
        if (Math.abs(changeRate) > 20) {
          comparison.analysis.significance = 'high';
          comparison.analysis.trend = changeRate > 0 ? 'increasing' : 'decreasing';
        } else if (Math.abs(changeRate) > 10) {
          comparison.analysis.significance = 'medium';
          comparison.analysis.trend = changeRate > 0 ? 'increasing' : 'decreasing';
        }

        comparison.analysis.interpretation = this.generateComparisonInterpretation(
          comparison.analysis.trend,
          changeRate,
          comparison.analysis.significance
        );
      }

    } catch (error) {
      logger.error('Error comparing cardinalities:', error);
    }

    return comparison;
  }

  /**
   * Record historical data point
   */
  public recordHistoricalData(metric: string, cardinality: number, confidence: number = 0.95): void {
    if (!this.historicalData.has(metric)) {
      this.historicalData.set(metric, []);
    }

    const data = this.historicalData.get(metric)!;
    data.push({
      timestamp: new Date(),
      cardinality,
      confidence,
      metadata: {
        windowSize: 3600000, // 1 hour default
        dataPoints: 1,
        anomalyScore: 0
      }
    });

    // Keep only recent data (last 100 points)
    if (data.length > 100) {
      data.splice(0, data.length - 100);
    }
  }

  /**
   * Get historical data for analysis
   */
  private getHistoricalData(metric: string, points: number): TimeSeriesCardinality[] {
    const data = this.historicalData.get(metric) || [];
    return data.slice(-points);
  }

  /**
   * Calculate volatility from historical data
   */
  private calculateVolatility(data: TimeSeriesCardinality[]): number {
    if (data.length < 2) return 0;
    
    const values = data.map(d => d.cardinality);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  /**
   * Calculate anomaly score based on historical data
   */
  private calculateAnomalyScore(currentValue: number, historical: TimeSeriesCardinality[]): number {
    if (historical.length < 3) return 0;
    
    const values = historical.map(d => d.cardinality);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    
    if (stdDev === 0) return 0;
    
    const zScore = Math.abs(currentValue - mean) / stdDev;
    return Math.min(zScore / 3, 1); // Normalize to 0-1 range
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    trend: 'increasing' | 'decreasing' | 'stable',
    growthRate: number,
    anomalyScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (trend === 'increasing' && growthRate > 50) {
      recommendations.push('Monitor infrastructure capacity for increased load');
      recommendations.push('Investigate source of traffic growth');
    }

    if (trend === 'decreasing' && growthRate < -20) {
      recommendations.push('Check for service issues or outages');
      recommendations.push('Investigate potential traffic filtering');
    }

    if (anomalyScore > 0.8) {
      recommendations.push('Investigate potential security threats');
      recommendations.push('Validate data accuracy and collection');
    }

    if (trend === 'stable') {
      recommendations.push('Continue monitoring current trends');
      recommendations.push('Maintain current operational levels');
    }

    return recommendations;
  }

  /**
   * Calculate growth rates between consecutive data points
   */
  private calculateGrowthRates(values: number[]): number[] {
    const rates: number[] = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] > 0) {
        rates.push(((values[i] - values[i - 1]) / values[i - 1]) * 100);
      }
    }
    return rates;
  }

  /**
   * Calculate variance of values
   */
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  /**
   * Identify peak times from historical data
   */
  private identifyPeakTimes(data: TimeSeriesCardinality[]): string[] {
    // Simplified implementation - return hours when peaks typically occur
    return ['09:00', '14:00', '20:00']; // Mock data
  }

  /**
   * Identify low activity times
   */
  private identifyLowTimes(data: TimeSeriesCardinality[]): string[] {
    return ['03:00', '06:00', '23:00']; // Mock data
  }

  /**
   * Calculate seasonality score
   */
  private calculateSeasonality(values: number[]): number {
    // Simplified seasonality calculation
    return 0.3; // Mock value
  }

  /**
   * Predict next period value
   */
  private predictNextPeriod(values: number[], avgGrowthRate: number): {
    value: number;
    confidence: number;
    range: { min: number; max: number };
  } {
    const lastValue = values[values.length - 1];
    const predictedValue = lastValue * (1 + avgGrowthRate / 100);
    const margin = predictedValue * 0.2; // 20% margin
    
    return {
      value: Math.round(predictedValue),
      confidence: 0.7,
      range: {
        min: Math.round(predictedValue - margin),
        max: Math.round(predictedValue + margin)
      }
    };
  }

  /**
   * Generate pattern description
   */
  private generatePatternDescription(type: VisitorPattern['type'], growthRate: number): string {
    switch (type) {
      case 'growing':
        return `Consistent growth pattern with ${growthRate.toFixed(1)}% average increase`;
      case 'declining':
        return `Declining pattern with ${Math.abs(growthRate).toFixed(1)}% average decrease`;
      case 'spiky':
        return 'Irregular spiky pattern with high variability';
      case 'seasonal':
        return 'Seasonal pattern with predictable peaks and valleys';
      case 'steady':
      default:
        return 'Stable pattern with minimal variation';
    }
  }

  /**
   * Generate comparison interpretation
   */
  private generateComparisonInterpretation(
    trend: 'increasing' | 'decreasing' | 'stable',
    changeRate: number,
    significance: 'low' | 'medium' | 'high'
  ): string {
    if (significance === 'low') {
      return 'No significant change detected across time periods';
    }

    if (trend === 'increasing') {
      return `Significant increase of ${changeRate.toFixed(1)}% detected - monitor for capacity needs`;
    } else {
      return `Significant decrease of ${Math.abs(changeRate).toFixed(1)}% detected - investigate potential issues`;
    }
  }
}
