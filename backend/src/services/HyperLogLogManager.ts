import { logger } from '@/utils/logger';
import { RedisService } from './RedisService';
import { VisitorTracker } from './VisitorTracker';
import { HLLAnalytics } from '@/core/hyperloglog/HLLAnalytics';
import {
  HLLManagerConfig,
  HLLPerformanceMetrics,
  VisitorMetrics,
  HLLAnalyticsResult,
  UniqueVisitorInsight
} from '@/types/hyperloglog';
import { getHLLManagerConfig } from '@/config/hyperloglogConfig';

/**
 * HyperLogLogManager orchestrates multiple HLL instances for comprehensive visitor tracking
 * Provides centralized management, persistence, and analytics
 */
export class HyperLogLogManager {
  private config: HLLManagerConfig;
  private redisService: RedisService;
  private visitorTrackers: Map<string, VisitorTracker> = new Map();
  private analytics: HLLAnalytics | null = null;
  
  private persistenceTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private metricsCollectionTimer?: NodeJS.Timeout;
  
  private performanceMetrics: HLLPerformanceMetrics;
  private isInitialized: boolean = false;
  private lastPersistenceTime: Date = new Date();
  private lastCleanupTime: Date = new Date();

  constructor(redisService: RedisService, config?: Partial<HLLManagerConfig>) {
    this.redisService = redisService;
    this.config = { ...getHLLManagerConfig(), ...config };
    this.performanceMetrics = this.initializePerformanceMetrics();
  }

  /**
   * Initialize the HyperLogLogManager
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing HyperLogLogManager...', {
        trackers: this.config.trackers.length,
        enableMetrics: this.config.enableMetrics,
        enableAnalytics: this.config.enableAnalytics
      });

      // Initialize visitor trackers
      for (const trackerConfig of this.config.trackers) {
        if (trackerConfig.enabled) {
          const tracker = new VisitorTracker(trackerConfig.visitorConfig, this.redisService);
          this.visitorTrackers.set(trackerConfig.name, tracker);
        }
      }

      // Initialize analytics if enabled
      if (this.config.enableAnalytics && this.visitorTrackers.size > 0) {
        const primaryTracker = this.visitorTrackers.values().next().value;
        this.analytics = new HLLAnalytics(primaryTracker);
      }

      // Load existing data from Redis
      await this.loadFromPersistence();

      // Start periodic tasks
      this.startPeriodicTasks();

      this.isInitialized = true;
      
      logger.info('HyperLogLogManager initialized successfully', {
        activeTrackers: this.visitorTrackers.size,
        memoryUsage: this.getTotalMemoryUsage(),
        analyticsEnabled: this.analytics !== null
      });
      
    } catch (error) {
      logger.error('Failed to initialize HyperLogLogManager:', error);
      throw error;
    }
  }

  /**
   * Process a request through all enabled trackers
   */
  public async processRequest(requestData: {
    ipAddress?: string;
    sessionId?: string;
    userAgent?: string;
    country?: string;
    region?: string;
    city?: string;
    path?: string;
    timestamp?: Date;
  }): Promise<{
    processed: boolean;
    trackersUsed: string[];
    metrics?: VisitorMetrics;
    insights?: UniqueVisitorInsight[];
  }> {
    if (!this.isInitialized) {
      throw new Error('HyperLogLogManager not initialized');
    }

    const startTime = process.hrtime.bigint();
    const trackersUsed: string[] = [];

    try {
      // Process through each enabled tracker
      for (const [name, tracker] of this.visitorTrackers) {
        tracker.trackVisitor(requestData);
        trackersUsed.push(name);
      }

      // Get current metrics
      const metrics = await this.getAggregatedMetrics();

      // Generate insights if analytics is enabled
      let insights: UniqueVisitorInsight[] | undefined;
      if (this.analytics && this.config.enableAnalytics) {
        insights = this.analytics.generateInsights(['ips', 'sessions']);
      }

      // Update performance metrics
      const endTime = process.hrtime.bigint();
      const processingTime = Number(endTime - startTime) / 1000; // microseconds
      this.updatePerformanceMetrics(processingTime);

      return {
        processed: true,
        trackersUsed,
        metrics,
        insights
      };

    } catch (error) {
      logger.error('Error processing request in HyperLogLogManager:', error);
      return {
        processed: false,
        trackersUsed
      };
    }
  }

  /**
   * Get aggregated visitor metrics across all trackers
   */
  public async getAggregatedMetrics(timeWindowMs?: number): Promise<VisitorMetrics> {
    const aggregated: VisitorMetrics = {
      timeWindow: {
        start: timeWindowMs ? new Date(Date.now() - timeWindowMs) : new Date(0),
        end: new Date(),
        duration: timeWindowMs || Date.now()
      },
      uniqueVisitors: {
        total: 0,
        ips: 0,
        sessions: 0,
        userAgents: 0,
        locations: 0,
        paths: 0
      },
      growthRate: 0,
      confidence: 0
    };

    try {
      for (const [name, tracker] of this.visitorTrackers) {
        const metrics = tracker.getVisitorMetrics(timeWindowMs);
        
        // Aggregate metrics (taking maximum values to avoid double counting)
        aggregated.uniqueVisitors.total = Math.max(
          aggregated.uniqueVisitors.total, 
          metrics.uniqueVisitors.total
        );
        aggregated.uniqueVisitors.ips = Math.max(
          aggregated.uniqueVisitors.ips, 
          metrics.uniqueVisitors.ips
        );
        aggregated.uniqueVisitors.sessions = Math.max(
          aggregated.uniqueVisitors.sessions, 
          metrics.uniqueVisitors.sessions
        );
        aggregated.uniqueVisitors.userAgents = Math.max(
          aggregated.uniqueVisitors.userAgents, 
          metrics.uniqueVisitors.userAgents
        );
        aggregated.uniqueVisitors.locations = Math.max(
          aggregated.uniqueVisitors.locations, 
          metrics.uniqueVisitors.locations
        );
        aggregated.uniqueVisitors.paths = Math.max(
          aggregated.uniqueVisitors.paths, 
          metrics.uniqueVisitors.paths
        );

        // Use highest confidence
        aggregated.confidence = Math.max(aggregated.confidence, metrics.confidence);
        
        // Average growth rate
        aggregated.growthRate = (aggregated.growthRate + metrics.growthRate) / 2;
      }

    } catch (error) {
      logger.error('Error getting aggregated metrics:', error);
    }

    return aggregated;
  }

  /**
   * Get analytics results for a specific metric
   */
  public async getAnalytics(
    metric: string, 
    timeWindowMs: number = 3600000
  ): Promise<HLLAnalyticsResult | null> {
    if (!this.analytics) {
      logger.warn('Analytics not enabled');
      return null;
    }

    try {
      return this.analytics.analyzeVisitorTrends(metric, timeWindowMs);
    } catch (error) {
      logger.error('Error getting analytics:', error);
      return null;
    }
  }

  /**
   * Get comprehensive manager statistics
   */
  public getManagerStatistics(): {
    isInitialized: boolean;
    activeTrackers: number;
    totalMemoryUsage: number;
    performanceMetrics: HLLPerformanceMetrics;
    trackerDetails: Array<{
      name: string;
      memoryUsage: number;
      trackingTypes: string[];
    }>;
    lastPersistence: Date;
    lastCleanup: Date;
  } {
    const trackerDetails = Array.from(this.visitorTrackers.entries()).map(([name, tracker]) => ({
      name,
      memoryUsage: tracker.getMemoryUsage(),
      trackingTypes: tracker.getTrackingTypes()
    }));

    return {
      isInitialized: this.isInitialized,
      activeTrackers: this.visitorTrackers.size,
      totalMemoryUsage: this.getTotalMemoryUsage(),
      performanceMetrics: this.performanceMetrics,
      trackerDetails,
      lastPersistence: this.lastPersistenceTime,
      lastCleanup: this.lastCleanupTime
    };
  }

  /**
   * Get specific tracker by name
   */
  public getTracker(name: string): VisitorTracker | undefined {
    return this.visitorTrackers.get(name);
  }

  /**
   * Get all tracker names
   */
  public getTrackerNames(): string[] {
    return Array.from(this.visitorTrackers.keys());
  }

  /**
   * Get total memory usage across all trackers
   */
  public getTotalMemoryUsage(): number {
    let total = 0;
    for (const tracker of this.visitorTrackers.values()) {
      total += tracker.getMemoryUsage();
    }
    return total;
  }

  /**
   * Check if memory usage is within limits
   */
  public isMemoryUsageHealthy(): boolean {
    return this.getTotalMemoryUsage() <= this.config.maxMemoryUsage;
  }

  /**
   * Start periodic tasks
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
   * Persist data to Redis
   */
  private async persistToPersistence(): Promise<void> {
    try {
      // Store manager configuration and state
      await this.redisService.set(
        'hll_manager:config',
        JSON.stringify(this.config),
        3600 // 1 hour TTL
      );

      await this.redisService.set(
        'hll_manager:metrics',
        JSON.stringify(this.performanceMetrics),
        3600
      );

      // Store aggregated metrics for analytics
      if (this.analytics) {
        const metrics = await this.getAggregatedMetrics(3600000); // 1 hour
        this.analytics.recordHistoricalData('total_visitors', metrics.uniqueVisitors.total);
        this.analytics.recordHistoricalData('unique_ips', metrics.uniqueVisitors.ips);
        this.analytics.recordHistoricalData('unique_sessions', metrics.uniqueVisitors.sessions);
      }

      this.lastPersistenceTime = new Date();
      logger.debug('HLL persistence completed');

    } catch (error) {
      logger.error('Failed to persist HLL data:', error);
    }
  }

  /**
   * Load data from Redis
   */
  private async loadFromPersistence(): Promise<void> {
    try {
      // Try to load previous metrics
      const metricsData = await this.redisService.get('hll_manager:metrics');
      if (metricsData) {
        const savedMetrics = JSON.parse(metricsData);
        this.performanceMetrics = { ...this.performanceMetrics, ...savedMetrics };
      }

      logger.debug('HLL persistence loaded');

    } catch (error) {
      logger.warn('Failed to load persisted HLL data:', error);
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

        // Clear some trackers if memory is critical
        for (const tracker of this.visitorTrackers.values()) {
          tracker.clear();
        }
      }

      this.lastCleanupTime = new Date();
      logger.debug('HLL cleanup completed');

    } catch (error) {
      logger.error('Error during HLL cleanup:', error);
    }
  }

  /**
   * Collect performance metrics
   */
  private collectMetrics(): void {
    try {
      // Update memory metrics
      this.performanceMetrics.memory.totalUsage = this.getTotalMemoryUsage();
      this.performanceMetrics.memory.perHLL = this.performanceMetrics.memory.totalUsage / Math.max(this.visitorTrackers.size, 1);

      logger.debug('HLL metrics collected', {
        memoryUsage: this.performanceMetrics.memory.totalUsage,
        trackers: this.visitorTrackers.size
      });

    } catch (error) {
      logger.error('Error collecting HLL metrics:', error);
    }
  }

  /**
   * Initialize performance metrics
   */
  private initializePerformanceMetrics(): HLLPerformanceMetrics {
    return {
      operationsPerSecond: {
        adds: 0,
        queries: 0
      },
      latency: {
        add: { p50: 0, p95: 0, p99: 0 },
        query: { p50: 0, p95: 0, p99: 0 }
      },
      accuracy: {
        estimatedError: 0.02,
        biasCorrection: true,
        sparseEfficiency: 0.8
      },
      memory: {
        totalUsage: 0,
        perHLL: 0,
        sparseRatio: 0.7,
        compressionRatio: 100
      }
    };
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(processingTime: number): void {
    // Update latency metrics (simplified)
    this.performanceMetrics.latency.add.p50 = processingTime;
    this.performanceMetrics.memory.totalUsage = this.getTotalMemoryUsage();
  }

  /**
   * Shutdown the manager gracefully
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down HyperLogLogManager...');

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
    logger.info('HyperLogLogManager shutdown complete');
  }

  /**
   * Update configuration
   */
  public updateConfiguration(config: Partial<HLLManagerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart periodic tasks with new intervals
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.startPeriodicTasks();
    
    logger.info('HyperLogLogManager configuration updated');
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): HLLManagerConfig {
    return { ...this.config };
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
   * Reset all trackers and metrics
   */
  public async reset(): Promise<void> {
    for (const tracker of this.visitorTrackers.values()) {
      tracker.clear();
    }
    
    this.performanceMetrics = this.initializePerformanceMetrics();
    
    logger.info('HyperLogLogManager reset completed');
  }
}
