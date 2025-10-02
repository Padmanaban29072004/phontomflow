import { logger } from '@/utils/logger';
import { RedisService } from './RedisService';
import { EWMA } from '@/core/ewma/EWMA';
import { EWMAAnalytics } from '@/core/ewma/EWMAAnalytics';
import {
  EWMAManagerConfig,
  EWMAConfig,
  TimeWindow,
  MultiWindowEWMA,
  DataPoint,
  EWMAStatistics,
  EWMAHealthCheck,
  EWMAInsight
} from '@/types/ewma';

/**
 * EWMAManager orchestrates multiple EWMA instances across different time windows
 * Provides centralized management, analytics, and persistence
 */
export class EWMAManager {
  private config: EWMAManagerConfig;
  private redisService: RedisService;
  private ewmaInstances: Map<TimeWindow, EWMA> = new Map();
  private analytics: EWMAAnalytics;
  
  private persistenceTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  
  private isInitialized: boolean = false;
  private lastPersistenceTime: Date = new Date();
  private lastCleanupTime: Date = new Date();
  private processedDataPoints: number = 0;
  private detectedAnomalies: number = 0;

  constructor(redisService: RedisService, config: EWMAManagerConfig) {
    this.redisService = redisService;
    this.config = config;
    this.analytics = new EWMAAnalytics();
  }

  /**
   * Initialize the EWMAManager
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing EWMAManager...', {
        windows: this.config.windows.length,
        enableMetrics: this.config.monitoring.enableMetrics
      });

      // Initialize EWMA instances for each time window
      for (const window of this.config.windows) {
        const windowConfig = this.getWindowConfig(window);
        const ewma = new EWMA(windowConfig);
        
        this.ewmaInstances.set(window, ewma);
        this.analytics.addEWMAInstance(`ewma_${window}`, ewma);
      }

      // Load existing data from persistence
      await this.loadFromPersistence();

      // Start periodic tasks
      this.startPeriodicTasks();

      this.isInitialized = true;
      
      logger.info('EWMAManager initialized successfully', {
        activeWindows: this.ewmaInstances.size,
        memoryUsage: this.getTotalMemoryUsage()
      });
      
    } catch (error) {
      logger.error('Failed to initialize EWMAManager:', error);
      throw error;
    }
  }

  /**
   * Process data point through all EWMA windows
   */
  public async processDataPoint(dataPoint: DataPoint): Promise<MultiWindowEWMA> {
    if (!this.isInitialized) {
      throw new Error('EWMAManager not initialized');
    }

    const startTime = process.hrtime.bigint();

    try {
      const windowResults: Record<TimeWindow, any> = {};
      
      // Process through each EWMA window
      for (const [window, ewma] of this.ewmaInstances) {
        const result = ewma.update(dataPoint);
        windowResults[window] = result;

        // Track anomalies
        if (result.anomaly.isAnomalous) {
          this.detectedAnomalies++;
        }
      }

      // Analyze consensus across windows
      const consensus = this.analytics.analyzeMultiWindowConsensus(windowResults);

      // Generate recommendations
      const recommendations = this.generateRecommendations(windowResults, consensus);

      this.processedDataPoints++;

      // Update performance metrics
      const endTime = process.hrtime.bigint();
      const processingTime = Number(endTime - startTime) / 1000; // microseconds
      this.updatePerformanceMetrics(processingTime);

      return {
        windows: windowResults,
        consensus,
        recommendations
      };

    } catch (error) {
      logger.error('Error processing data point in EWMAManager:', error);
      throw error;
    }
  }

  /**
   * Get EWMA statistics across all windows
   */
  public getStatistics(): EWMAStatistics {
    const totalMemory = this.getTotalMemoryUsage();
    const analytics = this.analytics.generateAnalytics();

    return {
      totalDataPoints: this.processedDataPoints,
      windowsActive: this.ewmaInstances.size,
      averageAccuracy: analytics.summary.averageAccuracy,
      trendAccuracy: analytics.performance.accuracy.trend,
      anomaliesDetected: this.detectedAnomalies,
      falsePositives: Math.floor(this.detectedAnomalies * 0.05), // Estimated
      lastUpdate: new Date(),
      memoryUsage: totalMemory
    };
  }

  /**
   * Get health check status
   */
  public getHealthCheck(): EWMAHealthCheck {
    const issues: EWMAHealthCheck['issues'] = [];
    const memoryUsage = this.getTotalMemoryUsage();
    const memoryLimit = this.config.globalSettings.maxMemoryUsage;

    // Check memory usage
    if (memoryUsage > memoryLimit * 0.9) {
      issues.push({
        component: 'memory',
        severity: 'high',
        description: `Memory usage approaching limit: ${memoryUsage}/${memoryLimit} bytes`,
        suggestion: 'Reduce window sizes or increase memory limit'
      });
    }

    // Check EWMA performance
    const validation = this.analytics.validatePerformance();
    if (!validation.isValid) {
      issues.push({
        component: 'accuracy',
        severity: 'medium',
        description: `EWMA validation failed: ${validation.errors.length} errors`,
        suggestion: 'Review EWMA configuration and parameters'
      });
    }

    // Check if instances are active
    if (this.ewmaInstances.size === 0) {
      issues.push({
        component: 'calculation',
        severity: 'critical',
        description: 'No active EWMA instances',
        suggestion: 'Initialize EWMA instances for analysis'
      });
    }

    // Determine overall status
    let status: EWMAHealthCheck['status'];
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;

    if (criticalIssues > 0) {
      status = 'critical';
    } else if (highIssues > 0) {
      status = 'error';
    } else if (issues.length > 0) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    const recommendations = this.generateHealthRecommendations(issues);

    return {
      isHealthy: issues.length === 0,
      status,
      issues,
      metrics: {
        accuracy: validation.accuracy,
        performance: validation.performance.speed,
        memoryUsage: memoryUsage / memoryLimit,
        errorRate: validation.errors.length / Math.max(this.ewmaInstances.size, 1)
      },
      recommendations,
      lastCheck: new Date()
    };
  }

  /**
   * Get insights from analytics
   */
  public getInsights(): EWMAInsight[] {
    return this.analytics.getInsights();
  }

  /**
   * Get specific EWMA instance
   */
  public getEWMAInstance(window: TimeWindow): EWMA | undefined {
    return this.ewmaInstances.get(window);
  }

  /**
   * Get all active time windows
   */
  public getActiveWindows(): TimeWindow[] {
    return Array.from(this.ewmaInstances.keys());
  }

  /**
   * Get total memory usage across all instances
   */
  public getTotalMemoryUsage(): number {
    let total = 0;
    for (const ewma of this.ewmaInstances.values()) {
      total += ewma.getMemoryUsage();
    }
    return total;
  }

  /**
   * Check if memory usage is within limits
   */
  public isMemoryUsageHealthy(): boolean {
    return this.getTotalMemoryUsage() <= this.config.globalSettings.maxMemoryUsage;
  }

  /**
   * Force persistence of all EWMA data
   */
  public async forcePersistence(): Promise<void> {
    await this.persistToStorage();
  }

  /**
   * Force cleanup of old data
   */
  public async forceCleanup(): Promise<void> {
    await this.performCleanup();
  }

  /**
   * Reset all EWMA instances
   */
  public async reset(): Promise<void> {
    for (const ewma of this.ewmaInstances.values()) {
      ewma.reset();
    }
    
    this.analytics.clear();
    this.processedDataPoints = 0;
    this.detectedAnomalies = 0;
    
    logger.info('EWMAManager reset completed');
  }

  /**
   * Shutdown the manager gracefully
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down EWMAManager...');

    // Clear timers
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }

    // Final persistence
    await this.persistToStorage();

    this.isInitialized = false;
    logger.info('EWMAManager shutdown complete');
  }

  /**
   * Get configuration for specific time window
   */
  private getWindowConfig(window: TimeWindow): EWMAConfig {
    const baseConfig = this.config.defaultConfig;
    const windowSpecific = this.config.windowConfigs[window] || {};

    // Map time window to appropriate parameters
    const windowParams = this.getWindowParameters(window);

    return {
      ...baseConfig,
      ...windowSpecific,
      ...windowParams,
      timeWindow: window
    };
  }

  /**
   * Get parameters specific to time window
   */
  private getWindowParameters(window: TimeWindow): Partial<EWMAConfig> {
    switch (window) {
      case '1min':
        return {
          alpha: 0.3,          // More responsive for short term
          windowSize: 60,      // 60 data points
          volatilityThreshold: 0.1,
          changeDetectionThreshold: 0.8
        };
      case '5min':
        return {
          alpha: 0.2,          // Balanced responsiveness
          windowSize: 300,     // 300 data points
          volatilityThreshold: 0.15,
          changeDetectionThreshold: 0.6
        };
      case '15min':
        return {
          alpha: 0.1,          // Less responsive for medium term
          windowSize: 900,     // 900 data points
          volatilityThreshold: 0.2,
          changeDetectionThreshold: 0.4
        };
      case '60min':
        return {
          alpha: 0.05,         // Least responsive for long term
          windowSize: 3600,    // 3600 data points
          volatilityThreshold: 0.3,
          changeDetectionThreshold: 0.3
        };
      default:
        return {};
    }
  }

  /**
   * Start periodic tasks
   */
  private startPeriodicTasks(): void {
    // Persistence timer
    if (this.config.globalSettings.persistenceInterval > 0) {
      this.persistenceTimer = setInterval(
        () => this.persistToStorage(),
        this.config.globalSettings.persistenceInterval
      );
    }

    // Cleanup timer
    if (this.config.globalSettings.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(
        () => this.performCleanup(),
        this.config.globalSettings.cleanupInterval
      );
    }

    // Metrics collection timer
    if (this.config.monitoring.enableMetrics) {
      this.metricsTimer = setInterval(
        () => this.collectMetrics(),
        this.config.monitoring.metricsInterval
      );
    }
  }

  /**
   * Persist EWMA data to storage
   */
  private async persistToStorage(): Promise<void> {
    try {
      // Store manager statistics
      const stats = this.getStatistics();
      await this.redisService.set(
        'ewma_manager:stats',
        JSON.stringify(stats),
        3600 // 1 hour TTL
      );

      // Store configuration
      await this.redisService.set(
        'ewma_manager:config',
        JSON.stringify(this.config),
        3600
      );

      this.lastPersistenceTime = new Date();
      logger.debug('EWMA persistence completed');

    } catch (error) {
      logger.error('Failed to persist EWMA data:', error);
    }
  }

  /**
   * Load data from persistence
   */
  private async loadFromPersistence(): Promise<void> {
    try {
      // Try to load previous statistics
      const statsData = await this.redisService.get('ewma_manager:stats');
      if (statsData) {
        const savedStats = JSON.parse(statsData);
        this.processedDataPoints = savedStats.totalDataPoints || 0;
        this.detectedAnomalies = savedStats.anomaliesDetected || 0;
      }

      logger.debug('EWMA persistence loaded');

    } catch (error) {
      logger.warn('Failed to load persisted EWMA data:', error);
    }
  }

  /**
   * Perform cleanup tasks
   */
  private async performCleanup(): Promise<void> {
    try {
      // Check memory usage
      if (!this.isMemoryUsageHealthy()) {
        logger.warn('Memory usage exceeds limit, performing cleanup', {
          current: this.getTotalMemoryUsage(),
          limit: this.config.globalSettings.maxMemoryUsage
        });

        // Reset instances if memory is critical
        for (const ewma of this.ewmaInstances.values()) {
          ewma.reset();
        }
      }

      this.lastCleanupTime = new Date();
      logger.debug('EWMA cleanup completed');

    } catch (error) {
      logger.error('Error during EWMA cleanup:', error);
    }
  }

  /**
   * Collect performance metrics
   */
  private collectMetrics(): void {
    try {
      const analytics = this.analytics.generateAnalytics();
      
      logger.debug('EWMA metrics collected', {
        memoryUsage: this.getTotalMemoryUsage(),
        instances: this.ewmaInstances.size,
        processedDataPoints: this.processedDataPoints,
        accuracy: analytics.summary.averageAccuracy
      });

    } catch (error) {
      logger.error('Error collecting EWMA metrics:', error);
    }
  }

  /**
   * Generate recommendations based on window results and consensus
   */
  private generateRecommendations(
    windowResults: Record<TimeWindow, any>,
    consensus: MultiWindowEWMA['consensus']
  ): string[] {
    const recommendations: string[] = [];

    // Based on consensus agreement
    if (consensus.agreement < 0.5) {
      recommendations.push('Low consensus between time windows - investigate data quality');
    } else if (consensus.agreement > 0.9) {
      recommendations.push('High consensus detected - trend is well-established');
    }

    // Based on anomaly scores
    if (consensus.anomalyScore > 0.8) {
      recommendations.push('High anomaly score across windows - immediate investigation required');
    } else if (consensus.anomalyScore > 0.6) {
      recommendations.push('Moderate anomaly detected - monitor closely');
    }

    // Based on trend
    if (consensus.trend === 'increasing') {
      recommendations.push('Increasing trend detected - monitor for capacity issues');
    } else if (consensus.trend === 'decreasing') {
      recommendations.push('Decreasing trend detected - check for service degradation');
    } else if (consensus.trend === 'volatile') {
      recommendations.push('High volatility detected - investigate system stability');
    }

    // Based on confidence
    if (consensus.confidence < 0.5) {
      recommendations.push('Low confidence in analysis - consider increasing data collection');
    }

    if (recommendations.length === 0) {
      recommendations.push('EWMA analysis shows normal patterns - continue monitoring');
    }

    return recommendations;
  }

  /**
   * Generate health recommendations
   */
  private generateHealthRecommendations(issues: EWMAHealthCheck['issues']): string[] {
    const recommendations: string[] = [];

    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const highIssues = issues.filter(i => i.severity === 'high');

    if (criticalIssues.length > 0) {
      recommendations.push('Address critical issues immediately to restore functionality');
    }

    if (highIssues.length > 0) {
      recommendations.push('Resolve high-severity issues to prevent system degradation');
    }

    // Component-specific recommendations
    const memoryIssues = issues.filter(i => i.component === 'memory');
    if (memoryIssues.length > 0) {
      recommendations.push('Optimize memory usage or increase available memory');
    }

    const accuracyIssues = issues.filter(i => i.component === 'accuracy');
    if (accuracyIssues.length > 0) {
      recommendations.push('Review and adjust EWMA parameters for better accuracy');
    }

    if (issues.length === 0) {
      recommendations.push('EWMA system is healthy - maintain current monitoring');
    }

    return recommendations;
  }

  /**
   * Update performance metrics (simplified)
   */
  private updatePerformanceMetrics(processingTime: number): void {
    // This would update internal performance tracking
    // For now, just log the processing time
    if (processingTime > 1000) { // > 1ms
      logger.debug('Slow EWMA processing detected', { processingTime });
    }
  }
}
