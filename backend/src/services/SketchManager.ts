import { logger } from '@/utils/logger';
import { RedisService } from './RedisService';
import { FrequencyAnalyzer } from './FrequencyAnalyzer';
import { SketchAnomalyDetector } from '@/core/sketch/SketchAnomalyDetector';
import { CountMinSketch } from '@/core/sketch/CountMinSketch';
import {
  SketchManagerConfig,
  FrequencyTracker,
  SketchMetrics,
  SketchPerformanceMetrics,
  FrequencyAnalysisResult,
  SketchAnomalyResult
} from '@/types/sketch';
import { getSketchManagerConfig, getAnomalyDetectionConfig } from '@/config/sketchConfig';

/**
 * SketchManager manages multiple Count-Min Sketches for different data streams
 * Provides centralized management, persistence, and performance monitoring
 */
export class SketchManager {
  private config: SketchManagerConfig;
  private redisService: RedisService;
  private frequencyAnalyzer: FrequencyAnalyzer;
  private sketchAnomalyDetector: SketchAnomalyDetector;
  
  private persistenceTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private metricsCollectionTimer?: NodeJS.Timeout;
  
  private performanceMetrics: SketchPerformanceMetrics;
  private isInitialized: boolean = false;
  private lastPersistenceTime: Date = new Date();
  private lastCleanupTime: Date = new Date();

  constructor(redisService: RedisService, config?: Partial<SketchManagerConfig>) {
    this.redisService = redisService;
    this.config = { ...getSketchManagerConfig(), ...config };
    
    this.frequencyAnalyzer = new FrequencyAnalyzer(redisService);
    this.sketchAnomalyDetector = new SketchAnomalyDetector(
      this.frequencyAnalyzer,
      getAnomalyDetectionConfig()
    );
    
    this.performanceMetrics = this.initializePerformanceMetrics();
  }

  /**
   * Initialize the SketchManager
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing SketchManager...', {
        trackers: this.config.trackers.length,
        enableMetrics: this.config.enableMetrics
      });

      // Load existing sketches from Redis if available
      await this.loadFromPersistence();

      // Start periodic tasks
      this.startPeriodicTasks();

      this.isInitialized = true;
      
      logger.info('SketchManager initialized successfully', {
        memoryUsage: this.getTotalMemoryUsage(),
        enabledTrackers: this.config.trackers.filter(t => t.enabled).length
      });
      
    } catch (error) {
      logger.error('Failed to initialize SketchManager:', error);
      throw error;
    }
  }

  /**
   * Start periodic tasks (persistence, cleanup, metrics)
   */
  private startPeriodicTasks(): void {
    // Persistence timer
    if (this.config.persistenceInterval > 0) {
      this.persistenceTimer = setInterval(
        () => this.persistToPersistence(),
        this.config.persistenceInterval
      );
    }

    // Cleanup timer
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(
        () => this.performCleanup(),
        this.config.cleanupInterval
      );
    }

    // Metrics collection timer
    if (this.config.enableMetrics) {
      this.metricsCollectionTimer = setInterval(
        () => this.collectMetrics(),
        60000 // Collect metrics every minute
      );
    }
  }

  /**
   * Shutdown the SketchManager gracefully
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down SketchManager...');

    // Clear timers
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.metricsCollectionTimer) {
      clearInterval(this.metricsCollectionTimer);
    }

    // Final persistence
    await this.persistToPersistence();

    this.isInitialized = false;
    logger.info('SketchManager shutdown complete');
  }

  /**
   * Process a request through all enabled trackers
   */
  public async processRequest(requestData: {
    ipAddress?: string;
    userAgent?: string;
    path?: string;
    sessionId?: string;
    query?: Record<string, any>;
    timestamp?: Date;
  }): Promise<{
    analyses: Record<string, FrequencyAnalysisResult>;
    anomalies: SketchAnomalyResult[];
    riskScore: number;
  }> {
    if (!this.isInitialized) {
      throw new Error('SketchManager not initialized');
    }

    const startTime = process.hrtime.bigint();
    const timestamp = requestData.timestamp || new Date();
    const analyses: Record<string, FrequencyAnalysisResult> = {};
    const anomalies: SketchAnomalyResult[] = [];

    try {
      // Process each enabled tracker
      for (const tracker of this.config.trackers.filter(t => t.enabled)) {
        let analysis: FrequencyAnalysisResult | null = null;

        switch (tracker.type) {
          case 'ip_address':
            if (requestData.ipAddress) {
              analysis = this.frequencyAnalyzer.trackIPAddress(requestData.ipAddress, timestamp);
            }
            break;

          case 'user_agent':
            if (requestData.userAgent) {
              analysis = this.frequencyAnalyzer.trackUserAgent(requestData.userAgent, timestamp);
            }
            break;

          case 'request_path':
            if (requestData.path) {
              analysis = this.frequencyAnalyzer.trackRequestPath(requestData.path, timestamp);
            }
            break;

          case 'session_id':
            if (requestData.sessionId) {
              analysis = this.frequencyAnalyzer.trackSessionID(requestData.sessionId, timestamp);
            }
            break;

          case 'parameter':
            if (requestData.query && Object.keys(requestData.query).length > 0) {
              // Track each parameter
              for (const [key, value] of Object.entries(requestData.query)) {
                const paramAnalysis = this.frequencyAnalyzer.trackParameter(
                  key, 
                  String(value), 
                  timestamp
                );
                analyses[`param_${key}`] = paramAnalysis;

                // Check for anomalies in this parameter
                const paramAnomalies = await this.sketchAnomalyDetector.analyzeFrequency(
                  'parameters',
                  paramAnalysis
                );
                anomalies.push(...paramAnomalies);
              }
            }
            break;
        }

        if (analysis) {
          analyses[tracker.type] = analysis;

          // Check for anomalies
          const sketchName = this.getSketchNameForTracker(tracker.type);
          const trackerAnomalies = await this.sketchAnomalyDetector.analyzeFrequency(
            sketchName,
            analysis
          );
          anomalies.push(...trackerAnomalies);
        }
      }

      // Calculate overall risk score
      const riskScore = this.calculateOverallRiskScore(analyses, anomalies);

      // Update performance metrics
      const endTime = process.hrtime.bigint();
      const latency = Number(endTime - startTime) / 1000; // Convert to microseconds
      this.updatePerformanceMetrics(latency, analyses, anomalies);

      return { analyses, anomalies, riskScore };

    } catch (error) {
      logger.error('Error processing request in SketchManager:', error);
      throw error;
    }
  }

  /**
   * Get sketch name for tracker type
   */
  private getSketchNameForTracker(trackerType: string): string {
    switch (trackerType) {
      case 'ip_address': return 'ip_addresses';
      case 'user_agent': return 'user_agents';
      case 'request_path': return 'request_paths';
      case 'session_id': return 'session_ids';
      case 'parameter': return 'parameters';
      default: return trackerType;
    }
  }

  /**
   * Calculate overall risk score from analyses and anomalies
   */
  private calculateOverallRiskScore(
    analyses: Record<string, FrequencyAnalysisResult>,
    anomalies: SketchAnomalyResult[]
  ): number {
    let maxAnalysisRisk = 0;
    let weightedRisk = 0;
    let totalWeight = 0;

    // Calculate weighted risk from analyses
    for (const [type, analysis] of Object.entries(analyses)) {
      let weight = 1;
      
      // Weight different types differently
      if (type === 'ip_address') weight = 0.3;
      else if (type === 'user_agent') weight = 0.2;
      else if (type === 'request_path') weight = 0.3;
      else if (type === 'session_id') weight = 0.2;
      else if (type.startsWith('param_')) weight = 0.1;

      maxAnalysisRisk = Math.max(maxAnalysisRisk, analysis.riskScore);
      weightedRisk += analysis.riskScore * weight;
      totalWeight += weight;
    }

    const analysisRisk = totalWeight > 0 ? weightedRisk / totalWeight : 0;

    // Boost based on anomaly severity
    let anomalyBoost = 0;
    if (anomalies.length > 0) {
      const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
      const highCount = anomalies.filter(a => a.severity === 'high').length;
      const mediumCount = anomalies.filter(a => a.severity === 'medium').length;

      anomalyBoost = (criticalCount * 0.3) + (highCount * 0.2) + (mediumCount * 0.1);
    }

    // Combine analysis risk with anomaly boost
    const finalRisk = Math.min(analysisRisk + anomalyBoost, 1.0);
    
    return Math.max(finalRisk, maxAnalysisRisk);
  }

  /**
   * Get comprehensive manager statistics
   */
  public getManagerStatistics(): {
    isInitialized: boolean;
    totalMemoryUsage: number;
    enabledTrackers: number;
    sketchMetrics: Record<string, SketchMetrics | null>;
    performanceMetrics: SketchPerformanceMetrics;
    lastPersistence: Date;
    lastCleanup: Date;
  } {
    const sketchMetrics: Record<string, SketchMetrics | null> = {};
    
    for (const sketchName of this.frequencyAnalyzer.getSketchNames()) {
      sketchMetrics[sketchName] = this.frequencyAnalyzer.getSketchMetrics(sketchName);
    }

    return {
      isInitialized: this.isInitialized,
      totalMemoryUsage: this.getTotalMemoryUsage(),
      enabledTrackers: this.config.trackers.filter(t => t.enabled).length,
      sketchMetrics,
      performanceMetrics: this.performanceMetrics,
      lastPersistence: this.lastPersistenceTime,
      lastCleanup: this.lastCleanupTime
    };
  }

  /**
   * Get total memory usage across all sketches
   */
  public getTotalMemoryUsage(): number {
    return this.frequencyAnalyzer.getTotalMemoryUsage();
  }

  /**
   * Check if memory usage is within limits
   */
  public isMemoryUsageHealthy(): boolean {
    return this.getTotalMemoryUsage() <= this.config.maxMemoryUsage;
  }

  /**
   * Persist sketches to Redis
   */
  private async persistToPersistence(): Promise<void> {
    try {
      await this.frequencyAnalyzer.persistToRedis();
      
      // Also persist configuration and metrics
      await this.redisService.set(
        'sketch_manager:config',
        JSON.stringify(this.config),
        3600 // 1 hour TTL
      );

      await this.redisService.set(
        'sketch_manager:metrics',
        JSON.stringify(this.performanceMetrics),
        3600 // 1 hour TTL
      );

      this.lastPersistenceTime = new Date();
      logger.debug('Sketch persistence completed');

    } catch (error) {
      logger.error('Failed to persist sketches:', error);
    }
  }

  /**
   * Load sketches from Redis
   */
  private async loadFromPersistence(): Promise<void> {
    try {
      await this.frequencyAnalyzer.loadFromRedis();

      // Try to load previous metrics
      const metricsData = await this.redisService.get('sketch_manager:metrics');
      if (metricsData) {
        const savedMetrics = JSON.parse(metricsData);
        this.performanceMetrics = { ...this.performanceMetrics, ...savedMetrics };
      }

      logger.debug('Sketch persistence loaded');

    } catch (error) {
      logger.warn('Failed to load persisted sketches:', error);
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
          limit: this.config.maxMemoryUsage
        });

        // Clear some sketches if memory is critical
        this.frequencyAnalyzer.clearAll();
      }

      // Clear old anomaly detection history
      for (const sketchName of this.frequencyAnalyzer.getSketchNames()) {
        this.sketchAnomalyDetector.clearHistory(sketchName);
      }

      this.lastCleanupTime = new Date();
      logger.debug('Cleanup completed');

    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  /**
   * Collect performance metrics
   */
  private collectMetrics(): void {
    // Calculate current operations per second
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // This is a simplified metrics collection
    // In a real implementation, you'd track operations over time
    
    logger.debug('Performance metrics collected', {
      memoryUsage: this.getTotalMemoryUsage(),
      isHealthy: this.isMemoryUsageHealthy()
    });
  }

  /**
   * Initialize performance metrics
   */
  private initializePerformanceMetrics(): SketchPerformanceMetrics {
    return {
      operationsPerSecond: {
        inserts: 0,
        queries: 0
      },
      latency: {
        insert: { p50: 0, p95: 0, p99: 0 },
        query: { p50: 0, p95: 0, p99: 0 }
      },
      accuracy: {
        truePositives: 0,
        falsePositives: 0,
        trueNegatives: 0,
        falseNegatives: 0,
        precision: 0,
        recall: 0,
        f1Score: 0
      },
      memoryEfficiency: {
        totalMemory: 0,
        memoryPerItem: 0,
        compressionRatio: 0
      }
    };
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(
    latency: number,
    analyses: Record<string, FrequencyAnalysisResult>,
    anomalies: SketchAnomalyResult[]
  ): void {
    // Update memory metrics
    this.performanceMetrics.memoryEfficiency.totalMemory = this.getTotalMemoryUsage();
    
    // Update accuracy metrics based on anomalies
    if (anomalies.length > 0) {
      const highConfidenceAnomalies = anomalies.filter(a => a.confidence > 0.8);
      this.performanceMetrics.accuracy.truePositives += highConfidenceAnomalies.length;
      this.performanceMetrics.accuracy.falsePositives += anomalies.length - highConfidenceAnomalies.length;
    } else {
      this.performanceMetrics.accuracy.trueNegatives += 1;
    }

    // Recalculate derived metrics
    const { truePositives, falsePositives, trueNegatives, falseNegatives } = this.performanceMetrics.accuracy;
    const total = truePositives + falsePositives + trueNegatives + falseNegatives;
    
    if (total > 0) {
      this.performanceMetrics.accuracy.precision = 
        truePositives / (truePositives + falsePositives) || 0;
      this.performanceMetrics.accuracy.recall = 
        truePositives / (truePositives + falseNegatives) || 0;
      
      const precision = this.performanceMetrics.accuracy.precision;
      const recall = this.performanceMetrics.accuracy.recall;
      this.performanceMetrics.accuracy.f1Score = 
        2 * (precision * recall) / (precision + recall) || 0;
    }
  }

  /**
   * Update configuration
   */
  public updateConfiguration(config: Partial<SketchManagerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart periodic tasks with new intervals
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.startPeriodicTasks();
    
    logger.info('SketchManager configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): SketchManagerConfig {
    return { ...this.config };
  }

  /**
   * Get frequency analyzer
   */
  public getFrequencyAnalyzer(): FrequencyAnalyzer {
    return this.frequencyAnalyzer;
  }

  /**
   * Get anomaly detector
   */
  public getAnomalyDetector(): SketchAnomalyDetector {
    return this.sketchAnomalyDetector;
  }

  /**
   * Manual trigger for persistence
   */
  public async forcePersistence(): Promise<void> {
    await this.persistToPersistence();
  }

  /**
   * Manual trigger for cleanup
   */
  public async forceCleanup(): Promise<void> {
    await this.performCleanup();
  }

  /**
   * Reset all sketches and metrics
   */
  public async reset(): Promise<void> {
    this.frequencyAnalyzer.clearAll();
    this.performanceMetrics = this.initializePerformanceMetrics();
    this.sketchAnomalyDetector.clearHistory();
    
    logger.info('SketchManager reset completed');
  }
}
