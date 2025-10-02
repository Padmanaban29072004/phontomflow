import { logger } from '@/utils/logger';
import {
  DataPoint,
  TrendDirection,
  EWMAForecast,
  TrendAnalysis
} from '@/types/ewma';

/**
 * Advanced statistical models for EWMA analysis
 * Provides basic trend analysis and forecasting capabilities
 */
export class EWMAStatisticalModels {
  private dataHistory: DataPoint[] = [];
  private maxHistorySize: number = 1000;

  constructor(maxHistorySize: number = 1000) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Add data point to history
   */
  public addDataPoint(dataPoint: DataPoint): void {
    this.dataHistory.push(dataPoint);
    
    // Maintain history size
    if (this.dataHistory.length > this.maxHistorySize) {
      this.dataHistory = this.dataHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Perform trend analysis on historical data
   */
  public analyzeTrend(windowMinutes: number = 60): TrendAnalysis {
    try {
      if (this.dataHistory.length < 10) {
        return this.getDefaultTrendAnalysis();
      }

      const now = new Date();
      const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
      
      // Filter data within window
      const windowData = this.dataHistory.filter(dp => dp.timestamp >= windowStart);
      
      if (windowData.length < 5) {
        return this.getDefaultTrendAnalysis();
      }

      // Short-term trend (last 25% of window)
      const shortTermData = windowData.slice(-Math.floor(windowData.length * 0.25));
      const shortTerm = this.calculateTrendMetrics(shortTermData);

      // Long-term trend (entire window)
      const longTerm = this.calculateTrendMetrics(windowData);

      // Basic seasonality detection (simplified)
      const seasonality = this.detectSeasonality(windowData);

      // Change point detection
      const changePoints = this.detectChangePoints(windowData);

      return {
        shortTerm,
        longTerm,
        seasonality,
        changePoints
      };

    } catch (error) {
      logger.error('Error analyzing trend:', error);
      return this.getDefaultTrendAnalysis();
    }
  }

  /**
   * Generate forecast for specified horizon
   */
  public generateForecast(horizonMinutes: number = 30, confidence: number = 0.8): EWMAForecast {
    try {
      if (this.dataHistory.length < 20) {
        return this.getDefaultForecast(horizonMinutes);
      }

      const recentData = this.dataHistory.slice(-50); // Use last 50 points
      const values = recentData.map(dp => dp.value);
      
      // Calculate basic trend
      const trend = this.calculateLinearTrend(values);
      const lastValue = values[values.length - 1];
      const lastTimestamp = recentData[recentData.length - 1].timestamp;

      // Generate predictions
      const predictions: EWMAForecast['predictions'] = [];
      const intervalMinutes = Math.max(1, Math.floor(horizonMinutes / 10)); // 10 prediction points
      
      for (let i = 1; i <= 10; i++) {
        const futureMinutes = i * intervalMinutes;
        const predictedValue = lastValue + (trend * futureMinutes);
        
        // Calculate prediction range based on historical variance
        const variance = this.calculateVariance(values);
        const stdDev = Math.sqrt(variance);
        const confidenceMultiplier = this.getConfidenceMultiplier(confidence);
        
        predictions.push({
          timestamp: new Date(lastTimestamp.getTime() + futureMinutes * 60 * 1000),
          value: predictedValue,
          confidence: Math.max(0.1, confidence - (i * 0.05)), // Decrease confidence over time
          range: {
            min: predictedValue - confidenceMultiplier * stdDev,
            max: predictedValue + confidenceMultiplier * stdDev
          }
        });
      }

      // Calculate expected accuracy based on recent performance
      const expectedAccuracy = this.calculateForecastAccuracy(values);

      return {
        horizon: horizonMinutes,
        predictions,
        accuracy: {
          expected: expectedAccuracy,
          confidence: confidence
        },
        assumptions: [
          'Linear trend continuation',
          'Constant variance assumption',
          'No external shocks or regime changes'
        ],
        limitations: [
          'Basic linear model - may not capture complex patterns',
          'Accuracy decreases with longer forecast horizons',
          'Does not account for seasonal patterns'
        ]
      };

    } catch (error) {
      logger.error('Error generating forecast:', error);
      return this.getDefaultForecast(horizonMinutes);
    }
  }

  /**
   * Calculate confidence intervals for predictions
   */
  public calculateConfidenceInterval(
    value: number, 
    variance: number, 
    confidence: number = 0.95
  ): { min: number; max: number } {
    const stdDev = Math.sqrt(variance);
    const multiplier = this.getConfidenceMultiplier(confidence);
    
    return {
      min: value - multiplier * stdDev,
      max: value + multiplier * stdDev
    };
  }

  /**
   * Detect statistical outliers
   */
  public detectStatisticalOutliers(
    values: number[], 
    method: 'zscore' | 'iqr' = 'zscore'
  ): { indices: number[]; scores: number[] } {
    if (values.length < 5) {
      return { indices: [], scores: [] };
    }

    const outlierIndices: number[] = [];
    const outlierScores: number[] = [];

    if (method === 'zscore') {
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const stdDev = Math.sqrt(this.calculateVariance(values));
      
      values.forEach((value, index) => {
        const zScore = Math.abs(value - mean) / (stdDev + 0.001);
        if (zScore > 2.5) { // 2.5 standard deviations
          outlierIndices.push(index);
          outlierScores.push(zScore);
        }
      });
    } else if (method === 'iqr') {
      const sorted = [...values].sort((a, b) => a - b);
      const q1 = this.calculatePercentile(sorted, 25);
      const q3 = this.calculatePercentile(sorted, 75);
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      
      values.forEach((value, index) => {
        if (value < lowerBound || value > upperBound) {
          outlierIndices.push(index);
          const score = Math.max(
            Math.abs(value - lowerBound) / iqr,
            Math.abs(value - upperBound) / iqr
          );
          outlierScores.push(score);
        }
      });
    }

    return { indices: outlierIndices, scores: outlierScores };
  }

  /**
   * Calculate rolling statistics
   */
  public calculateRollingStatistics(
    values: number[], 
    windowSize: number = 10
  ): {
    means: number[];
    variances: number[];
    trends: TrendDirection[];
  } {
    const means: number[] = [];
    const variances: number[] = [];
    const trends: TrendDirection[] = [];

    for (let i = windowSize - 1; i < values.length; i++) {
      const window = values.slice(i - windowSize + 1, i + 1);
      
      // Calculate mean
      const mean = window.reduce((sum, v) => sum + v, 0) / window.length;
      means.push(mean);
      
      // Calculate variance
      const variance = window.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / window.length;
      variances.push(variance);
      
      // Calculate trend
      const trend = this.determineTrendDirection(window);
      trends.push(trend);
    }

    return { means, variances, trends };
  }

  /**
   * Calculate trend metrics for data points
   */
  private calculateTrendMetrics(data: DataPoint[]): TrendAnalysis['shortTerm'] {
    if (data.length < 3) {
      return {
        trend: 'stable',
        strength: 0,
        duration: 0,
        confidence: 0.3
      };
    }

    const values = data.map(dp => dp.value);
    const slope = this.calculateLinearTrend(values);
    const variance = this.calculateVariance(values);
    const stdDev = Math.sqrt(variance);
    
    // Determine trend direction
    let trend: TrendDirection;
    const slopeThreshold = stdDev * 0.1;
    
    if (Math.abs(slope) < slopeThreshold) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }
    
    // Calculate strength (normalized slope)
    const strength = Math.min(1, Math.abs(slope) / (stdDev + 0.001));
    
    // Calculate duration (simplified)
    const durationMinutes = data.length > 0 ? 
      (data[data.length - 1].timestamp.getTime() - data[0].timestamp.getTime()) / (1000 * 60) : 0;
    
    // Calculate confidence
    const confidence = Math.min(0.95, data.length / 20);

    return { trend, strength, duration: durationMinutes, confidence };
  }

  /**
   * Detect basic seasonality patterns
   */
  private detectSeasonality(data: DataPoint[]): TrendAnalysis['seasonality'] {
    if (data.length < 60) { // Need at least 1 hour of data
      return {
        detected: false,
        period: 0,
        strength: 0,
        confidence: 0
      };
    }

    // Simplified seasonality detection
    // In a full implementation, this would use FFT or autocorrelation
    const values = data.map(dp => dp.value);
    const hourlyAverages = this.calculateHourlyAverages(data);
    
    // Check if there's a clear pattern in hourly averages
    const hourlyVariance = this.calculateVariance(hourlyAverages);
    const overallVariance = this.calculateVariance(values);
    
    const seasonalityStrength = hourlyVariance / (overallVariance + 0.001);
    const detected = seasonalityStrength > 0.3;

    return {
      detected,
      period: 60, // Assume hourly pattern
      strength: Math.min(1, seasonalityStrength),
      confidence: Math.min(0.8, data.length / 200)
    };
  }

  /**
   * Detect change points in the data
   */
  private detectChangePoints(data: DataPoint[]): TrendAnalysis['changePoints'] {
    const changePoints: TrendAnalysis['changePoints'] = [];
    
    if (data.length < 20) {
      return changePoints;
    }

    const values = data.map(dp => dp.value);
    const windowSize = Math.max(5, Math.floor(data.length / 10));
    
    // Simple change point detection using variance differences
    for (let i = windowSize; i < values.length - windowSize; i++) {
      const before = values.slice(i - windowSize, i);
      const after = values.slice(i, i + windowSize);
      
      const meanBefore = before.reduce((sum, v) => sum + v, 0) / before.length;
      const meanAfter = after.reduce((sum, v) => sum + v, 0) / after.length;
      
      const change = Math.abs(meanAfter - meanBefore);
      const threshold = Math.sqrt(this.calculateVariance(values)) * 1.5;
      
      if (change > threshold) {
        changePoints.push({
          timestamp: data[i].timestamp,
          magnitude: change / threshold,
          confidence: Math.min(0.9, windowSize / 10),
          type: 'level' // Simplified - could detect trend or variance changes
        });
      }
    }

    return changePoints;
  }

  /**
   * Calculate linear trend (slope) of values
   */
  private calculateLinearTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2; // Sum of indices
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = values.reduce((sum, v, i) => sum + i * v, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squared indices
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return isNaN(slope) ? 0 : slope;
  }

  /**
   * Calculate variance of values
   */
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    
    return variance;
  }

  /**
   * Calculate percentile of sorted values
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Get confidence multiplier for confidence intervals
   */
  private getConfidenceMultiplier(confidence: number): number {
    // Simplified - using normal distribution approximations
    if (confidence >= 0.99) return 2.576;
    if (confidence >= 0.95) return 1.96;
    if (confidence >= 0.90) return 1.645;
    if (confidence >= 0.80) return 1.282;
    return 1.0;
  }

  /**
   * Calculate forecast accuracy based on recent performance
   */
  private calculateForecastAccuracy(values: number[]): number {
    if (values.length < 10) return 0.6;
    
    // Simple accuracy calculation based on trend consistency
    const recentTrend = this.calculateLinearTrend(values.slice(-10));
    const overallTrend = this.calculateLinearTrend(values);
    
    const trendConsistency = 1 - Math.abs(recentTrend - overallTrend) / (Math.abs(overallTrend) + 0.001);
    
    return Math.max(0.3, Math.min(0.9, trendConsistency));
  }

  /**
   * Calculate hourly averages for seasonality detection
   */
  private calculateHourlyAverages(data: DataPoint[]): number[] {
    const hourlyData: { [hour: number]: number[] } = {};
    
    // Group data by hour
    data.forEach(dp => {
      const hour = dp.timestamp.getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = [];
      }
      hourlyData[hour].push(dp.value);
    });
    
    // Calculate averages
    const averages: number[] = [];
    for (let hour = 0; hour < 24; hour++) {
      if (hourlyData[hour] && hourlyData[hour].length > 0) {
        const avg = hourlyData[hour].reduce((sum, v) => sum + v, 0) / hourlyData[hour].length;
        averages.push(avg);
      } else {
        averages.push(0);
      }
    }
    
    return averages;
  }

  /**
   * Determine trend direction from values
   */
  private determineTrendDirection(values: number[]): TrendDirection {
    if (values.length < 3) return 'stable';
    
    const slope = this.calculateLinearTrend(values);
    const variance = this.calculateVariance(values);
    const stdDev = Math.sqrt(variance);
    const threshold = stdDev * 0.1;
    
    if (Math.abs(slope) < threshold) return 'stable';
    return slope > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Get default trend analysis
   */
  private getDefaultTrendAnalysis(): TrendAnalysis {
    return {
      shortTerm: {
        trend: 'stable',
        strength: 0,
        duration: 0,
        confidence: 0.3
      },
      longTerm: {
        trend: 'stable',
        strength: 0,
        duration: 0,
        confidence: 0.3
      },
      seasonality: {
        detected: false,
        period: 0,
        strength: 0,
        confidence: 0
      },
      changePoints: []
    };
  }

  /**
   * Get default forecast
   */
  private getDefaultForecast(horizonMinutes: number): EWMAForecast {
    const now = new Date();
    
    return {
      horizon: horizonMinutes,
      predictions: [{
        timestamp: new Date(now.getTime() + horizonMinutes * 60 * 1000),
        value: 0,
        confidence: 0.3,
        range: { min: -1, max: 1 }
      }],
      accuracy: {
        expected: 0.3,
        confidence: 0.3
      },
      assumptions: ['Insufficient data for reliable forecast'],
      limitations: ['Requires more historical data for accurate predictions']
    };
  }

  /**
   * Clear historical data
   */
  public clear(): void {
    this.dataHistory = [];
    logger.debug('EWMAStatisticalModels cleared');
  }

  /**
   * Get memory usage
   */
  public getMemoryUsage(): number {
    return this.dataHistory.length * 100; // ~100 bytes per data point
  }
}
