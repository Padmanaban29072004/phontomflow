import { logger } from '@/utils/logger';
import {
  EWMAConfig,
  EWMAValue,
  EWMAResult,
  DataPoint,
  TrendDirection,
  OutlierDetection,
  VolatilityAnalysis,
  AdaptiveParameters
} from '@/types/ewma';

/**
 * Core EWMA implementation with adaptive parameters and trend analysis
 * Supports Simple, Double, and Adaptive EWMA variants
 */
export class EWMA {
  private config: EWMAConfig;
  private currentValue: number = 0;
  private previousValue: number = 0;
  private trendValue: number = 0;        // For double EWMA
  private variance: number = 0;
  private dataPoints: DataPoint[] = [];
  private lastUpdate: Date = new Date();
  private initialized: boolean = false;
  private adaptiveParams: AdaptiveParameters;

  constructor(config: EWMAConfig) {
    this.config = { ...config };
    this.adaptiveParams = this.initializeAdaptiveParameters();
  }

  /**
   * Add new data point and update EWMA
   */
  public update(dataPoint: DataPoint): EWMAResult {
    try {
      // Store data point
      this.dataPoints.push(dataPoint);
      this.maintainWindowSize();

      // Initialize if first data point
      if (!this.initialized) {
        this.initialize(dataPoint.value);
      }

      // Update adaptive parameters if enabled
      if (this.config.adaptiveAlpha) {
        this.updateAdaptiveParameters();
      }

      // Calculate EWMA based on variant
      const ewmaValue = this.calculateEWMA(dataPoint.value);
      
      // Update variance estimate
      this.updateVariance(dataPoint.value);

      // Detect trend
      const trend = this.detectTrend();

      // Detect outliers
      const outlierResult = this.detectOutlier(dataPoint.value);

      // Create EWMA value
      const current: EWMAValue = {
        value: ewmaValue,
        timestamp: dataPoint.timestamp,
        confidence: this.calculateConfidence(),
        trend: trend.direction,
        volatility: this.calculateVolatility(),
        isOutlier: outlierResult.result.isOutlier
      };

      // Generate prediction
      const prediction = this.generatePrediction();

      // Calculate statistics
      const statistics = this.calculateStatistics();

      // Detect anomalies
      const anomaly = this.detectAnomaly(dataPoint.value, ewmaValue);

      // Update state
      this.previousValue = this.currentValue;
      this.currentValue = ewmaValue;
      this.lastUpdate = dataPoint.timestamp;

      return {
        current,
        previous: {
          value: this.previousValue,
          timestamp: this.lastUpdate,
          confidence: this.calculateConfidence(),
          trend: trend.direction,
          volatility: this.calculateVolatility(),
          isOutlier: false
        },
        prediction,
        statistics,
        trend,
        anomaly
      };

    } catch (error) {
      logger.error('Error updating EWMA:', error);
      throw error;
    }
  }

  /**
   * Get current EWMA value
   */
  public getCurrentValue(): number {
    return this.currentValue;
  }

  /**
   * Get trend analysis
   */
  public getTrend(): TrendDirection {
    return this.detectTrend().direction;
  }

  /**
   * Get volatility analysis
   */
  public getVolatilityAnalysis(): VolatilityAnalysis {
    const recentValues = this.dataPoints.slice(-20).map(dp => dp.value);
    const volatilities = this.calculateVolatilityHistory(recentValues);
    
    const current = this.calculateVolatility();
    const average = volatilities.reduce((sum, v) => sum + v, 0) / volatilities.length;
    
    // Detect spikes
    const spikes = this.detectVolatilitySpikes(volatilities);
    
    // Determine regime
    let regime: VolatilityAnalysis['regime'];
    if (current < average * 0.5) regime = 'low';
    else if (current < average * 1.5) regime = 'medium';
    else if (current < average * 3) regime = 'high';
    else regime = 'extreme';

    return {
      current,
      average,
      trend: current > average ? 'increasing' : current < average ? 'decreasing' : 'stable',
      spikes,
      regime
    };
  }

  /**
   * Validate EWMA configuration and performance
   */
  public validate(): { isValid: boolean; issues: string[]; performance: any } {
    const issues: string[] = [];
    
    // Validate configuration
    if (this.config.alpha <= 0 || this.config.alpha >= 1) {
      issues.push('Alpha must be between 0 and 1');
    }
    
    if (this.config.windowSize < 10) {
      issues.push('Window size should be at least 10 for stable results');
    }

    // Check performance
    const accuracy = this.calculatePredictionAccuracy();
    if (accuracy < 0.7) {
      issues.push(`Low prediction accuracy: ${accuracy.toFixed(2)}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      performance: {
        accuracy,
        dataPoints: this.dataPoints.length,
        memoryUsage: this.calculateMemoryUsage()
      }
    };
  }

  /**
   * Reset EWMA state
   */
  public reset(): void {
    this.currentValue = 0;
    this.previousValue = 0;
    this.trendValue = 0;
    this.variance = 0;
    this.dataPoints = [];
    this.initialized = false;
    this.adaptiveParams = this.initializeAdaptiveParameters();
    
    logger.debug('EWMA reset completed');
  }

  /**
   * Get memory usage in bytes
   */
  public getMemoryUsage(): number {
    return this.calculateMemoryUsage();
  }

  /**
   * Initialize EWMA with first data point
   */
  private initialize(value: number): void {
    this.currentValue = value;
    this.previousValue = value;
    this.trendValue = 0;
    this.variance = 0;
    this.initialized = true;
    
    logger.debug('EWMA initialized', { value, variant: this.config.variant });
  }

  /**
   * Calculate EWMA based on variant
   */
  private calculateEWMA(value: number): number {
    const alpha = this.config.adaptiveAlpha ? 
      this.adaptiveParams.alpha.current : 
      this.config.alpha;

    switch (this.config.variant) {
      case 'simple':
        return this.calculateSimpleEWMA(value, alpha);
      
      case 'double':
        return this.calculateDoubleEWMA(value, alpha);
      
      case 'adaptive':
        return this.calculateAdaptiveEWMA(value);
      
      default:
        return this.calculateSimpleEWMA(value, alpha);
    }
  }

  /**
   * Calculate Simple EWMA
   */
  private calculateSimpleEWMA(value: number, alpha: number): number {
    return alpha * value + (1 - alpha) * this.currentValue;
  }

  /**
   * Calculate Double EWMA (Holt's method)
   */
  private calculateDoubleEWMA(value: number, alpha: number): number {
    const beta = alpha; // Use same smoothing parameter for trend
    
    // Update level
    const newLevel = alpha * value + (1 - alpha) * (this.currentValue + this.trendValue);
    
    // Update trend
    this.trendValue = beta * (newLevel - this.currentValue) + (1 - beta) * this.trendValue;
    
    return newLevel;
  }

  /**
   * Calculate Adaptive EWMA
   */
  private calculateAdaptiveEWMA(value: number): number {
    // Adapt alpha based on volatility and change detection
    const volatility = this.calculateVolatility();
    const changeDetected = this.detectChangePoint(value);
    
    let adaptiveAlpha = this.config.alpha;
    
    // Increase alpha during high volatility or changes
    if (volatility > this.config.volatilityThreshold || changeDetected) {
      adaptiveAlpha = Math.min(this.config.maxAlpha, adaptiveAlpha * 1.5);
    } else {
      adaptiveAlpha = Math.max(this.config.minAlpha, adaptiveAlpha * 0.95);
    }
    
    // Update adaptive parameters
    this.adaptiveParams.alpha.current = adaptiveAlpha;
    this.adaptiveParams.alpha.lastUpdate = new Date();
    
    return this.calculateSimpleEWMA(value, adaptiveAlpha);
  }

  /**
   * Update variance estimate using EWMA
   */
  private updateVariance(value: number): void {
    const error = value - this.currentValue;
    this.variance = this.config.alpha * (error * error) + (1 - this.config.alpha) * this.variance;
  }

  /**
   * Detect trend direction and strength
   */
  private detectTrend(): EWMAResult['trend'] {
    if (this.dataPoints.length < 5) {
      return {
        direction: 'stable',
        strength: 0,
        changePoint: false,
        duration: 0
      };
    }

    const recentValues = this.dataPoints.slice(-10).map(dp => dp.value);
    const slope = this.calculateSlope(recentValues);
    const slopeThreshold = Math.sqrt(this.variance) * 0.1;
    
    let direction: TrendDirection;
    if (Math.abs(slope) < slopeThreshold) {
      direction = 'stable';
    } else if (slope > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }
    
    // Check for high volatility
    const volatility = this.calculateVolatility();
    if (volatility > this.config.volatilityThreshold * 2) {
      direction = 'volatile';
    }

    const strength = Math.min(1, Math.abs(slope) / (Math.sqrt(this.variance) + 0.001));
    const changePoint = this.detectChangePoint(this.currentValue);
    
    return {
      direction,
      strength,
      changePoint,
      duration: this.calculateTrendDuration(direction)
    };
  }

  /**
   * Detect outliers using statistical methods
   */
  private detectOutlier(value: number): OutlierDetection {
    if (this.dataPoints.length < 10) {
      return {
        method: 'statistical',
        threshold: this.config.volatilityThreshold,
        sensitivity: 0.5,
        windowSize: this.dataPoints.length,
        result: {
          isOutlier: false,
          score: 0,
          confidence: 0.5,
          explanation: 'Insufficient data for outlier detection'
        }
      };
    }

    const recentValues = this.dataPoints.slice(-20).map(dp => dp.value);
    const mean = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;
    const stdDev = Math.sqrt(this.variance);
    
    // Z-score method
    const zScore = Math.abs(value - mean) / (stdDev + 0.001);
    const threshold = 2.5; // 2.5 standard deviations
    
    const isOutlier = zScore > threshold;
    const score = Math.min(1, zScore / threshold);
    const confidence = Math.min(0.95, this.dataPoints.length / 50);

    return {
      method: 'statistical',
      threshold,
      sensitivity: 0.8,
      windowSize: recentValues.length,
      result: {
        isOutlier,
        score,
        confidence,
        explanation: `Z-score: ${zScore.toFixed(2)}, threshold: ${threshold}`
      }
    };
  }

  /**
   * Generate prediction for next value
   */
  private generatePrediction(): EWMAResult['prediction'] {
    let nextValue = this.currentValue;
    
    // Add trend component for double EWMA
    if (this.config.variant === 'double') {
      nextValue += this.trendValue;
    }
    
    // Calculate confidence based on recent accuracy
    const confidence = Math.min(0.95, this.calculatePredictionAccuracy());
    
    // Calculate prediction range based on variance
    const stdDev = Math.sqrt(this.variance);
    const range = {
      min: nextValue - 2 * stdDev,
      max: nextValue + 2 * stdDev
    };

    return { nextValue, confidence, range };
  }

  /**
   * Calculate various statistics
   */
  private calculateStatistics(): EWMAResult['statistics'] {
    if (this.dataPoints.length === 0) {
      return {
        mean: 0,
        variance: 0,
        standardDeviation: 0,
        volatility: 0
      };
    }

    const values = this.dataPoints.map(dp => dp.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    
    return {
      mean,
      variance: this.variance,
      standardDeviation: Math.sqrt(this.variance),
      volatility: this.calculateVolatility()
    };
  }

  /**
   * Detect anomalies based on EWMA baseline
   */
  private detectAnomaly(actualValue: number, ewmaValue: number): EWMAResult['anomaly'] {
    const deviation = Math.abs(actualValue - ewmaValue);
    const threshold = Math.sqrt(this.variance) * 2.5; // 2.5 standard deviations
    
    const isAnomalous = deviation > threshold;
    const score = Math.min(1, deviation / (threshold + 0.001));
    const confidence = Math.min(0.95, this.dataPoints.length / 30);

    return {
      isAnomalous,
      score,
      threshold,
      confidence
    };
  }

  /**
   * Calculate volatility (rolling standard deviation)
   */
  private calculateVolatility(): number {
    if (this.dataPoints.length < 2) return 0;
    
    const recentValues = this.dataPoints.slice(-10).map(dp => dp.value);
    if (recentValues.length < 2) return 0;
    
    const mean = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;
    const variance = recentValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / recentValues.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Calculate confidence based on data quality and quantity
   */
  private calculateConfidence(): number {
    if (this.dataPoints.length < 5) return 0.3;
    
    const dataQuality = Math.min(1, this.dataPoints.length / 50);
    const volatilityFactor = Math.max(0.1, 1 - this.calculateVolatility() / 10);
    const timeFactor = this.calculateTimeFactor();
    
    return Math.min(0.95, dataQuality * volatilityFactor * timeFactor);
  }

  /**
   * Calculate slope for trend detection
   */
  private calculateSlope(values: number[]): number {
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
   * Detect change points in the data
   */
  private detectChangePoint(value: number): boolean {
    if (this.dataPoints.length < 10) return false;
    
    const recentMean = this.dataPoints.slice(-5).reduce((sum, dp) => sum + dp.value, 0) / 5;
    const historicalMean = this.dataPoints.slice(-15, -5).reduce((sum, dp) => sum + dp.value, 0) / 10;
    
    const change = Math.abs(recentMean - historicalMean);
    const threshold = Math.sqrt(this.variance) * this.config.changeDetectionThreshold;
    
    return change > threshold;
  }

  /**
   * Calculate trend duration
   */
  private calculateTrendDuration(currentDirection: TrendDirection): number {
    // Simplified implementation - would track trend changes over time
    return 5; // Default 5 minutes
  }

  /**
   * Calculate prediction accuracy based on recent performance
   */
  private calculatePredictionAccuracy(): number {
    if (this.dataPoints.length < 10) return 0.5;
    
    let correctPredictions = 0;
    const recentData = this.dataPoints.slice(-10);
    
    for (let i = 1; i < recentData.length; i++) {
      const predicted = recentData[i - 1].value; // Simplified prediction
      const actual = recentData[i].value;
      const error = Math.abs(predicted - actual);
      const threshold = Math.sqrt(this.variance);
      
      if (error <= threshold) {
        correctPredictions++;
      }
    }
    
    return correctPredictions / (recentData.length - 1);
  }

  /**
   * Calculate memory usage
   */
  private calculateMemoryUsage(): number {
    // Rough estimation in bytes
    const dataPointSize = 100; // ~100 bytes per data point
    const baseSize = 500; // Base EWMA object size
    
    return baseSize + (this.dataPoints.length * dataPointSize);
  }

  /**
   * Maintain window size by removing old data points
   */
  private maintainWindowSize(): void {
    if (this.dataPoints.length > this.config.windowSize) {
      this.dataPoints = this.dataPoints.slice(-this.config.windowSize);
    }
  }

  /**
   * Initialize adaptive parameters
   */
  private initializeAdaptiveParameters(): AdaptiveParameters {
    return {
      alpha: {
        current: this.config.alpha,
        target: this.config.alpha,
        adaptationRate: 0.1,
        bounds: { min: this.config.minAlpha, max: this.config.maxAlpha },
        lastUpdate: new Date()
      },
      volatilityThreshold: {
        current: this.config.volatilityThreshold,
        adaptive: true,
        history: [],
        percentile: 0.95
      },
      changeDetectionThreshold: {
        current: this.config.changeDetectionThreshold,
        adaptive: true,
        sensitivity: 0.8,
        falsePositiveRate: 0.05
      }
    };
  }

  /**
   * Update adaptive parameters based on recent performance
   */
  private updateAdaptiveParameters(): void {
    // Update volatility threshold based on recent volatility history
    const currentVolatility = this.calculateVolatility();
    this.adaptiveParams.volatilityThreshold.history.push(currentVolatility);
    
    if (this.adaptiveParams.volatilityThreshold.history.length > 100) {
      this.adaptiveParams.volatilityThreshold.history.shift();
    }
    
    // Update threshold to 95th percentile of recent volatility
    if (this.adaptiveParams.volatilityThreshold.history.length > 20) {
      const sorted = [...this.adaptiveParams.volatilityThreshold.history].sort((a, b) => a - b);
      const percentileIndex = Math.floor(sorted.length * this.adaptiveParams.volatilityThreshold.percentile);
      this.adaptiveParams.volatilityThreshold.current = sorted[percentileIndex];
    }
  }

  /**
   * Calculate time factor for confidence
   */
  private calculateTimeFactor(): number {
    if (this.dataPoints.length === 0) return 0.5;
    
    const now = new Date();
    const lastUpdate = this.dataPoints[this.dataPoints.length - 1].timestamp;
    const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    
    // Confidence decreases with time since last update
    return Math.max(0.1, Math.exp(-minutesSinceUpdate / 60)); // Decay over 1 hour
  }

  /**
   * Calculate volatility history for analysis
   */
  private calculateVolatilityHistory(values: number[]): number[] {
    const volatilities: number[] = [];
    const windowSize = 5;
    
    for (let i = windowSize; i < values.length; i++) {
      const window = values.slice(i - windowSize, i);
      const mean = window.reduce((sum, v) => sum + v, 0) / window.length;
      const variance = window.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / window.length;
      volatilities.push(Math.sqrt(variance));
    }
    
    return volatilities;
  }

  /**
   * Detect volatility spikes
   */
  private detectVolatilitySpikes(volatilities: number[]): VolatilityAnalysis['spikes'] {
    const spikes: VolatilityAnalysis['spikes'] = [];
    const threshold = volatilities.reduce((sum, v) => sum + v, 0) / volatilities.length * 2;
    
    for (let i = 0; i < volatilities.length; i++) {
      if (volatilities[i] > threshold) {
        spikes.push({
          timestamp: new Date(Date.now() - (volatilities.length - i) * 60000), // Approximate timestamp
          magnitude: volatilities[i] / threshold,
          duration: 1 // Simplified - would track actual duration
        });
      }
    }
    
    return spikes;
  }
}
