import { logger } from '@/utils/logger';
import { RedisService } from './RedisService';
import { EWMAManager } from './EWMAManager';
import {
  BaselineAdaptation,
  DataPoint,
  TimeWindow,
  TrendDirection
} from '@/types/ewma';

/**
 * Baseline adaptation result
 */
interface AdaptationResult {
  adapted: boolean;
  reason: string;
  confidence: number;
  oldBaseline: number;
  newBaseline: number;
  validationPeriod: number;
  rollbackThreshold: number;
}

/**
 * Drift detection result
 */
interface DriftDetectionResult {
  driftDetected: boolean;
  driftMagnitude: number;
  driftDirection: 'upward' | 'downward' | 'volatile';
  confidence: number;
  recommendation: 'adapt' | 'monitor' | 'rollback';
}

/**
 * BaselineAdaptationService handles real-time baseline learning and adaptation
 * Provides concept drift detection and model retraining capabilities
 */
export class BaselineAdaptationService {
  private config: BaselineAdaptation;
  private redisService: RedisService;
  private ewmaManager: EWMAManager;
  
  private baselines: Map<string, number> = new Map(); // metric -> baseline
  private adaptationHistory: Array<{
    timestamp: Date;
    metric: string;
    oldBaseline: number;
    newBaseline: number;
    reason: string;
    confidence: number;
  }> = [];
  
  private validationData: Map<string, {
    adaptedBaseline: number;
    validationStart: Date;
    validationEnd: Date;
    performanceMetrics: number[];
    isValidated: boolean;
  }> = new Map();

  private isInitialized: boolean = false;
  private lastAdaptationCheck: Date = new Date();

  constructor(
    config: BaselineAdaptation,
    redisService: RedisService,
    ewmaManager: EWMAManager
  ) {
    this.config = config;
    this.redisService = redisService;
    this.ewmaManager = ewmaManager;
  }

  /**
   * Initialize the baseline adaptation service
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing BaselineAdaptationService...', {
        enabled: this.config.enabled,
        adaptationRate: this.config.adaptationRate
      });

      // Load existing baselines from persistence
      await this.loadBaselinesFromPersistence();

      // Initialize baselines if none exist
      if (this.baselines.size === 0) {
        await this.initializeDefaultBaselines();
      }

      this.isInitialized = true;
      
      logger.info('BaselineAdaptationService initialized successfully', {
        baselines: this.baselines.size
      });

    } catch (error) {
      logger.error('Failed to initialize BaselineAdaptationService:', error);
      throw error;
    }
  }

  /**
   * Process data point and check for adaptation needs
   */
  public async processDataPoint(metric: string, dataPoint: DataPoint): Promise<AdaptationResult | null> {
    if (!this.isInitialized || !this.config.enabled) {
      return null;
    }

    try {
      // Get current baseline
      const currentBaseline = this.baselines.get(metric) || dataPoint.value;

      // Detect concept drift
      const driftResult = await this.detectConceptDrift(metric, dataPoint, currentBaseline);

      // Check if adaptation is needed
      if (driftResult.recommendation === 'adapt') {
        return await this.adaptBaseline(metric, dataPoint, currentBaseline, driftResult);
      } else if (driftResult.recommendation === 'rollback') {
        return await this.rollbackAdaptation(metric, currentBaseline);
      }

      // Update validation data if in validation period
      await this.updateValidationData(metric, dataPoint);

      return null;

    } catch (error) {
      logger.error('Error processing data point for adaptation:', error);
      return null;
    }
  }

  /**
   * Get current baseline for a metric
   */
  public getBaseline(metric: string): number | undefined {
    return this.baselines.get(metric);
  }

  /**
   * Set baseline for a metric
   */
  public setBaseline(metric: string, baseline: number): void {
    this.baselines.set(metric, baseline);
    logger.debug(`Baseline set for ${metric}: ${baseline}`);
  }

  /**
   * Get adaptation history
   */
  public getAdaptationHistory(metric?: string): typeof this.adaptationHistory {
    if (metric) {
      return this.adaptationHistory.filter(h => h.metric === metric);
    }
    return [...this.adaptationHistory];
  }

  /**
   * Get adaptation statistics
   */
  public getAdaptationStatistics(): {
    totalAdaptations: number;
    successfulAdaptations: number;
    failedAdaptations: number;
    averageConfidence: number;
    lastAdaptation: Date | null;
    metricsTracked: number;
    adaptationRate: number;
  } {
    const successfulAdaptations = this.adaptationHistory.filter(h => h.confidence > 0.7).length;
    const totalAdaptations = this.adaptationHistory.length;
    const averageConfidence = totalAdaptations > 0 
      ? this.adaptationHistory.reduce((sum, h) => sum + h.confidence, 0) / totalAdaptations
      : 0;

    const lastAdaptation = this.adaptationHistory.length > 0
      ? this.adaptationHistory[this.adaptationHistory.length - 1].timestamp
      : null;

    return {
      totalAdaptations,
      successfulAdaptations,
      failedAdaptations: totalAdaptations - successfulAdaptations,
      averageConfidence,
      lastAdaptation,
      metricsTracked: this.baselines.size,
      adaptationRate: this.config.adaptationRate
    };
  }

  /**
   * Force adaptation for a metric
   */
  public async forceAdaptation(metric: string, newBaseline: number, reason: string): Promise<AdaptationResult> {
    const oldBaseline = this.baselines.get(metric) || 0;
    
    this.baselines.set(metric, newBaseline);
    
    const result: AdaptationResult = {
      adapted: true,
      reason: `Manual adaptation: ${reason}`,
      confidence: 1.0,
      oldBaseline,
      newBaseline,
      validationPeriod: this.config.validationPeriod,
      rollbackThreshold: this.config.rollbackThreshold
    };

    // Record adaptation
    this.recordAdaptation(metric, oldBaseline, newBaseline, result.reason, result.confidence);

    // Start validation period
    await this.startValidationPeriod(metric, newBaseline);

    logger.info(`Forced adaptation for ${metric}`, result);
    
    return result;
  }

  /**
   * Validate current adaptations
   */
  public async validateAdaptations(): Promise<{
    validated: string[];
    failed: string[];
    pending: string[];
  }> {
    const validated: string[] = [];
    const failed: string[] = [];
    const pending: string[] = [];

    for (const [metric, validation] of this.validationData) {
      const now = new Date();
      
      if (now > validation.validationEnd) {
        // Validation period ended
        const success = this.evaluateValidationSuccess(validation);
        
        if (success) {
          validated.push(metric);
          validation.isValidated = true;
        } else {
          failed.push(metric);
          // Rollback adaptation
          await this.rollbackAdaptation(metric, validation.adaptedBaseline);
        }
      } else {
        pending.push(metric);
      }
    }

    return { validated, failed, pending };
  }

  /**
   * Clear adaptation history and reset baselines
   */
  public async reset(): Promise<void> {
    this.baselines.clear();
    this.adaptationHistory = [];
    this.validationData.clear();
    
    await this.initializeDefaultBaselines();
    
    logger.info('BaselineAdaptationService reset completed');
  }

  /**
   * Shutdown the service
   */
  public async shutdown(): Promise<void> {
    // Persist current state
    await this.persistBaselines();
    
    this.isInitialized = false;
    logger.info('BaselineAdaptationService shutdown complete');
  }

  /**
   * Detect concept drift in the data
   */
  private async detectConceptDrift(
    metric: string, 
    dataPoint: DataPoint, 
    currentBaseline: number
  ): Promise<DriftDetectionResult> {
    try {
      // Get recent EWMA values for comparison
      const ewmaInstance = this.ewmaManager.getEWMAInstance('15min'); // Use 15min window for drift detection
      if (!ewmaInstance) {
        return {
          driftDetected: false,
          driftMagnitude: 0,
          driftDirection: 'upward',
          confidence: 0.3,
          recommendation: 'monitor'
        };
      }

      const currentValue = ewmaInstance.getCurrentValue();
      const trend = ewmaInstance.getTrend();
      
      // Calculate drift magnitude
      const driftMagnitude = Math.abs(currentValue - currentBaseline) / (currentBaseline + 0.001);
      
      // Determine drift direction
      let driftDirection: DriftDetectionResult['driftDirection'];
      if (trend === 'volatile') {
        driftDirection = 'volatile';
      } else if (currentValue > currentBaseline) {
        driftDirection = 'upward';
      } else {
        driftDirection = 'downward';
      }

      // Check if drift exceeds threshold
      const driftDetected = driftMagnitude > this.config.driftThreshold;
      
      // Calculate confidence based on trend consistency and magnitude
      const trendConfidence = trend === 'stable' ? 0.5 : trend === 'volatile' ? 0.3 : 0.8;
      const magnitudeConfidence = Math.min(1, driftMagnitude / this.config.driftThreshold);
      const confidence = (trendConfidence + magnitudeConfidence) / 2;

      // Determine recommendation
      let recommendation: DriftDetectionResult['recommendation'];
      if (driftDetected && confidence > 0.7) {
        recommendation = 'adapt';
      } else if (driftDetected && confidence > 0.4) {
        recommendation = 'monitor';
      } else if (driftMagnitude > this.config.rollbackThreshold) {
        recommendation = 'rollback';
      } else {
        recommendation = 'monitor';
      }

      return {
        driftDetected,
        driftMagnitude,
        driftDirection,
        confidence,
        recommendation
      };

    } catch (error) {
      logger.error('Error detecting concept drift:', error);
      return {
        driftDetected: false,
        driftMagnitude: 0,
        driftDirection: 'upward',
        confidence: 0,
        recommendation: 'monitor'
      };
    }
  }

  /**
   * Adapt baseline based on drift detection
   */
  private async adaptBaseline(
    metric: string,
    dataPoint: DataPoint,
    currentBaseline: number,
    driftResult: DriftDetectionResult
  ): Promise<AdaptationResult> {
    try {
      // Calculate new baseline using adaptation rate
      const targetValue = dataPoint.value;
      const newBaseline = currentBaseline + 
        (this.config.adaptationRate * (targetValue - currentBaseline));

      // Update baseline
      this.baselines.set(metric, newBaseline);

      // Record adaptation
      const reason = `Concept drift detected: ${driftResult.driftDirection} drift (${(driftResult.driftMagnitude * 100).toFixed(1)}%)`;
      this.recordAdaptation(metric, currentBaseline, newBaseline, reason, driftResult.confidence);

      // Start validation period
      await this.startValidationPeriod(metric, newBaseline);

      const result: AdaptationResult = {
        adapted: true,
        reason,
        confidence: driftResult.confidence,
        oldBaseline: currentBaseline,
        newBaseline,
        validationPeriod: this.config.validationPeriod,
        rollbackThreshold: this.config.rollbackThreshold
      };

      logger.info(`Adapted baseline for ${metric}`, result);
      
      return result;

    } catch (error) {
      logger.error('Error adapting baseline:', error);
      throw error;
    }
  }

  /**
   * Rollback adaptation for a metric
   */
  private async rollbackAdaptation(metric: string, currentBaseline: number): Promise<AdaptationResult> {
    // Find the most recent adaptation for this metric
    const recentAdaptations = this.adaptationHistory
      .filter(h => h.metric === metric)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (recentAdaptations.length === 0) {
      throw new Error(`No adaptation history found for metric: ${metric}`);
    }

    const lastAdaptation = recentAdaptations[0];
    const rollbackBaseline = lastAdaptation.oldBaseline;

    // Update baseline
    this.baselines.set(metric, rollbackBaseline);

    // Record rollback
    const reason = `Adaptation rollback: validation failed`;
    this.recordAdaptation(metric, currentBaseline, rollbackBaseline, reason, 1.0);

    // Remove from validation
    this.validationData.delete(metric);

    const result: AdaptationResult = {
      adapted: true,
      reason,
      confidence: 1.0,
      oldBaseline: currentBaseline,
      newBaseline: rollbackBaseline,
      validationPeriod: 0,
      rollbackThreshold: this.config.rollbackThreshold
    };

    logger.warn(`Rolled back adaptation for ${metric}`, result);
    
    return result;
  }

  /**
   * Start validation period for adapted baseline
   */
  private async startValidationPeriod(metric: string, newBaseline: number): Promise<void> {
    const now = new Date();
    const validationEnd = new Date(now.getTime() + this.config.validationPeriod * 60 * 1000);

    this.validationData.set(metric, {
      adaptedBaseline: newBaseline,
      validationStart: now,
      validationEnd,
      performanceMetrics: [],
      isValidated: false
    });

    logger.debug(`Started validation period for ${metric}`, {
      baseline: newBaseline,
      validationEnd
    });
  }

  /**
   * Update validation data with new performance metrics
   */
  private async updateValidationData(metric: string, dataPoint: DataPoint): Promise<void> {
    const validation = this.validationData.get(metric);
    if (!validation || validation.isValidated) {
      return;
    }

    const now = new Date();
    if (now >= validation.validationStart && now <= validation.validationEnd) {
      // Calculate performance metric (e.g., prediction accuracy)
      const baseline = validation.adaptedBaseline;
      const error = Math.abs(dataPoint.value - baseline) / (baseline + 0.001);
      const performance = Math.max(0, 1 - error); // Convert error to performance score
      
      validation.performanceMetrics.push(performance);

      // Limit validation metrics to prevent memory issues
      if (validation.performanceMetrics.length > 1000) {
        validation.performanceMetrics = validation.performanceMetrics.slice(-1000);
      }
    }
  }

  /**
   * Evaluate validation success
   */
  private evaluateValidationSuccess(validation: {
    performanceMetrics: number[];
    adaptedBaseline: number;
  }): boolean {
    if (validation.performanceMetrics.length < 10) {
      return false; // Insufficient data
    }

    // Calculate average performance
    const avgPerformance = validation.performanceMetrics.reduce((sum, p) => sum + p, 0) / 
      validation.performanceMetrics.length;

    // Success if performance is above threshold
    return avgPerformance > (1 - this.config.rollbackThreshold);
  }

  /**
   * Record adaptation in history
   */
  private recordAdaptation(
    metric: string,
    oldBaseline: number,
    newBaseline: number,
    reason: string,
    confidence: number
  ): void {
    this.adaptationHistory.push({
      timestamp: new Date(),
      metric,
      oldBaseline,
      newBaseline,
      reason,
      confidence
    });

    // Limit history size
    if (this.adaptationHistory.length > 1000) {
      this.adaptationHistory = this.adaptationHistory.slice(-1000);
    }

    // Update config
    this.config.lastAdaptation = new Date();
    this.config.adaptationCount++;
  }

  /**
   * Load baselines from persistence
   */
  private async loadBaselinesFromPersistence(): Promise<void> {
    try {
      const baselinesData = await this.redisService.get('baseline_adaptation:baselines');
      if (baselinesData) {
        const savedBaselines = JSON.parse(baselinesData);
        this.baselines = new Map(Object.entries(savedBaselines));
      }

      const historyData = await this.redisService.get('baseline_adaptation:history');
      if (historyData) {
        this.adaptationHistory = JSON.parse(historyData);
      }

      logger.debug('Loaded baselines from persistence', {
        baselines: this.baselines.size,
        historyEntries: this.adaptationHistory.length
      });

    } catch (error) {
      logger.warn('Failed to load baselines from persistence:', error);
    }
  }

  /**
   * Persist baselines to storage
   */
  private async persistBaselines(): Promise<void> {
    try {
      // Convert Map to Object for JSON serialization
      const baselinesObj = Object.fromEntries(this.baselines);
      
      await this.redisService.set(
        'baseline_adaptation:baselines',
        JSON.stringify(baselinesObj),
        86400 // 24 hours TTL
      );

      await this.redisService.set(
        'baseline_adaptation:history',
        JSON.stringify(this.adaptationHistory.slice(-100)), // Keep last 100 entries
        86400
      );

      logger.debug('Persisted baselines to storage');

    } catch (error) {
      logger.error('Failed to persist baselines:', error);
    }
  }

  /**
   * Initialize default baselines
   */
  private async initializeDefaultBaselines(): Promise<void> {
    // Initialize with common metrics and reasonable defaults
    const defaultBaselines = {
      'request_rate': 100,
      'response_time': 200,
      'error_rate': 0.01,
      'cpu_usage': 0.5,
      'memory_usage': 0.6,
      'disk_usage': 0.4,
      'network_throughput': 1000
    };

    for (const [metric, baseline] of Object.entries(defaultBaselines)) {
      this.baselines.set(metric, baseline);
    }

    logger.debug('Initialized default baselines', {
      metrics: Object.keys(defaultBaselines)
    });
  }
}
