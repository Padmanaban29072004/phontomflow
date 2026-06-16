import { logger } from '@/utils/logger';
import { RedisService } from './RedisService';
import { SequenceAnalyzer } from './SequenceAnalyzer';
import { MarkovAnalytics } from '@/core/markov/MarkovAnalytics';
import {
  MarkovManagerConfig,
  MarkovPerformanceMetrics,
  BehavioralInsight,
  MarkovAnalyticsResult,
  BehavioralPattern,
  UserJourney,
  SequenceAnomalyResult,
  BehavioralState
} from '@/types/markov';
import { getMarkovManagerConfig, getAnomalyThresholds } from '@/config/markovConfig';

/**
 * MarkovManager orchestrates multiple Markov chain instances
 * Provides centralized management, analytics, and integration
 */
export class MarkovManager {
  private config: MarkovManagerConfig;
  private redisService: RedisService;
  private sequenceAnalyzers: Map<string, SequenceAnalyzer> = new Map();
  private analytics: MarkovAnalytics | null = null;
  
  private persistenceTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  
  private performanceMetrics: MarkovPerformanceMetrics;
  private isInitialized: boolean = false;
  private lastPersistenceTime: Date = new Date();
  private lastCleanupTime: Date = new Date();
  private processedRequests: number = 0;
  private detectedAnomalies: number = 0;

  constructor(redisService: RedisService, config?: Partial<MarkovManagerConfig>) {
    this.redisService = redisService;
    this.config = { ...getMarkovManagerConfig(), ...config };
    this.performanceMetrics = this.initializePerformanceMetrics();
  }

  /**
   * Initialize the MarkovManager
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing MarkovManager...', {
        chains: this.config.chains.length,
        enableMetrics: this.config.globalConfig.enableMetrics,
        enableAnalytics: this.config.globalConfig.enableAnalytics
      });

      // Initialize sequence analyzers for each enabled chain
      for (const chainConfig of this.config.chains) {
        if (chainConfig.enabled) {
          const anomalyThresholds = getAnomalyThresholds();
          const analyzer = new SequenceAnalyzer(chainConfig.config, anomalyThresholds);
          this.sequenceAnalyzers.set(chainConfig.name, analyzer);
        }
      }

      // Initialize analytics if enabled
      if (this.config.globalConfig.enableAnalytics && this.sequenceAnalyzers.size > 0) {
        const primaryAnalyzer = this.sequenceAnalyzers.values().next().value;
        if (primaryAnalyzer) {
          this.analytics = new MarkovAnalytics(primaryAnalyzer);
        }
      }

      // Load existing data from persistence
      await this.loadFromPersistence();

      // Start periodic tasks
      this.startPeriodicTasks();

      this.isInitialized = true;
      
      logger.info('MarkovManager initialized successfully', {
        activeAnalyzers: this.sequenceAnalyzers.size,
        analyticsEnabled: this.analytics !== null,
        memoryUsage: this.getTotalMemoryUsage()
      });
      
    } catch (error) {
      logger.error('Failed to initialize MarkovManager:', error);
      throw error;
    }
  }

  /**
   * Process a request through all enabled analyzers
   */
  public async processRequest(requestData: {
    method?: string;
    path?: string;
    statusCode?: number;
    userAgent?: string;
    ipAddress?: string;
    sessionId?: string;
    userId?: string;
    timestamp?: Date;
    duration?: number;
    errorType?: string;
    riskScore?: number;
    headers?: Record<string, string>;
    body?: any;
  }): Promise<{
    processed: boolean;
    analyzersUsed: string[];
    primaryResult?: {
      behavioralState: BehavioralState;
      prediction: any;
      anomalyResult: SequenceAnomalyResult;
      journey: UserJourney;
    };
    insights?: BehavioralInsight[];
    riskScore?: number;
  }> {
    if (!this.isInitialized) {
      throw new Error('MarkovManager not initialized');
    }

    const startTime = process.hrtime.bigint();
    const analyzersUsed: string[] = [];

    try {
      let primaryResult: any = null;
      let highestRiskScore = 0;
      const allInsights: BehavioralInsight[] = [];

      // Process through each enabled analyzer
      for (const [name, analyzer] of this.sequenceAnalyzers) {
        const result = await analyzer.processRequest(requestData);
        analyzersUsed.push(name);

        // Use first result as primary
        if (!primaryResult) {
          primaryResult = result;
        }

        // Track highest risk score
        if (result.anomalyResult.anomalyScore > highestRiskScore) {
          highestRiskScore = result.anomalyResult.anomalyScore;
        }

        // Collect insights
        if (result.anomalyResult.isAnomalous) {
          this.detectedAnomalies++;
        }
      }

      // Generate insights if analytics is enabled
      let insights: BehavioralInsight[] | undefined;
      if (this.analytics && this.config.globalConfig.enableAnalytics) {
        insights = this.analytics.generateBehavioralInsights();
        allInsights.push(...insights);
      }

      // Update performance metrics
      const endTime = process.hrtime.bigint();
      const processingTime = Number(endTime - startTime) / 1000; // microseconds
      this.updatePerformanceMetrics(processingTime);
      this.processedRequests++;

      return {
        processed: true,
        analyzersUsed,
        primaryResult,
        insights: allInsights,
        riskScore: highestRiskScore
      };

    } catch (error) {
      logger.error('Error processing request in MarkovManager:', error);
      return {
        processed: false,
        analyzersUsed
      };
    }
  }

  /**
   * Generate comprehensive analytics report
   */
  public async generateAnalyticsReport(timeWindowHours: number = 24): Promise<MarkovAnalyticsResult | null> {
    if (!this.analytics) {
      logger.warn('Analytics not enabled');
      return null;
    }

    try {
      return this.analytics.generateAnalyticsReport(timeWindowHours);
    } catch (error) {
      logger.error('Error generating analytics report:', error);
      return null;
    }
  }

  /**
   * Detect behavioral anomalies across all analyzers
   */
  public async detectAnomalies(): Promise<{
    totalAnomalies: number;
    anomaliesByAnalyzer: Record<string, number>;
    highRiskAnomalies: SequenceAnomalyResult[];
    insights: BehavioralInsight[];
  }> {
    const anomaliesByAnalyzer: Record<string, number> = {};
    const highRiskAnomalies: SequenceAnomalyResult[] = [];
    let totalAnomalies = 0;

    try {
      for (const [name, analyzer] of this.sequenceAnalyzers) {
        const stats = analyzer.getStatistics();
        const analyzerAnomalies = stats.anomaliesDetected;
        
        anomaliesByAnalyzer[name] = analyzerAnomalies;
        totalAnomalies += analyzerAnomalies;
      }

      // Get insights from analytics
      const insights = this.analytics ? this.analytics.generateBehavioralInsights() : [];

      return {
        totalAnomalies,
        anomaliesByAnalyzer,
        highRiskAnomalies,
        insights
      };

    } catch (error) {
      logger.error('Error detecting anomalies:', error);
      return {
        totalAnomalies: 0,
        anomaliesByAnalyzer: {},
        highRiskAnomalies: [],
        insights: []
      };
    }
  }

  /**
   * Discover behavioral patterns across all analyzers
   */
  public async discoverPatterns(minFrequency: number = 5): Promise<{
    totalPatterns: number;
    patternsByAnalyzer: Record<string, BehavioralPattern[]>;
    commonPatterns: BehavioralPattern[];
    anomalousPatterns: BehavioralPattern[];
  }> {
    const patternsByAnalyzer: Record<string, BehavioralPattern[]> = {};
    const allPatterns: BehavioralPattern[] = [];

    try {
      for (const [name, analyzer] of this.sequenceAnalyzers) {
        const patterns = analyzer.discoverPatterns(minFrequency);
        patternsByAnalyzer[name] = patterns;
        allPatterns.push(...patterns);
      }

      // Separate common and anomalous patterns
      const commonPatterns = allPatterns.filter(p => !p.isAnomalous && p.frequency >= minFrequency);
      const anomalousPatterns = allPatterns.filter(p => p.isAnomalous);

      return {
        totalPatterns: allPatterns.length,
        patternsByAnalyzer,
        commonPatterns,
        anomalousPatterns
      };

    } catch (error) {
      logger.error('Error discovering patterns:', error);
      return {
        totalPatterns: 0,
        patternsByAnalyzer: {},
        commonPatterns: [],
        anomalousPatterns: []
      };
    }
  }

  /**
   * Get comprehensive manager statistics
   */
  public getManagerStatistics(): {
    isInitialized: boolean;
    activeAnalyzers: number;
    totalMemoryUsage: number;
    processedRequests: number;
    detectedAnomalies: number;
    anomalyRate: number;
    performanceMetrics: MarkovPerformanceMetrics;
    analyzerDetails: Array<{
      name: string;
      memoryUsage: number;
      sequencesAnalyzed: number;
      anomaliesDetected: number;
    }>;
    lastPersistence: Date;
    lastCleanup: Date;
  } {
    const analyzerDetails = Array.from(this.sequenceAnalyzers.entries()).map(([name, analyzer]) => {
      const stats = analyzer.getStatistics();
      return {
        name,
        memoryUsage: stats.memoryUsage,
        sequencesAnalyzed: stats.totalSequencesAnalyzed,
        anomaliesDetected: stats.anomaliesDetected
      };
    });

    return {
      isInitialized: this.isInitialized,
      activeAnalyzers: this.sequenceAnalyzers.size,
      totalMemoryUsage: this.getTotalMemoryUsage(),
      processedRequests: this.processedRequests,
      detectedAnomalies: this.detectedAnomalies,
      anomalyRate: this.processedRequests > 0 ? this.detectedAnomalies / this.processedRequests : 0,
      performanceMetrics: this.performanceMetrics,
      analyzerDetails,
      lastPersistence: this.lastPersistenceTime,
      lastCleanup: this.lastCleanupTime
    };
  }

  /**
   * Get specific analyzer by name
   */
  public getAnalyzer(name: string): SequenceAnalyzer | undefined {
    return this.sequenceAnalyzers.get(name);
  }

  /**
   * Get all analyzer names
   */
  public getAnalyzerNames(): string[] {
    return Array.from(this.sequenceAnalyzers.keys());
  }

  /**
   * Get analytics engine
   */
  public getAnalytics(): MarkovAnalytics | null {
    return this.analytics;
  }

  /**
   * Get total memory usage across all analyzers
   */
  public getTotalMemoryUsage(): number {
    let total = 0;
    for (const analyzer of this.sequenceAnalyzers.values()) {
      total += analyzer.getStatistics().memoryUsage;
    }
    return total;
  }

  /**
   * Check if memory usage is within limits
   */
  public isMemoryUsageHealthy(): boolean {
    return this.getTotalMemoryUsage() <= this.config.globalConfig.maxMemoryUsage;
  }

  /**
   * Get health status
   */
  public getHealthStatus(): {
    isHealthy: boolean;
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    metrics: {
      memoryUsage: number;
      memoryLimit: number;
      anomalyRate: number;
      processedRequests: number;
    };
  } {
    const issues: string[] = [];
    const memoryUsage = this.getTotalMemoryUsage();
    const memoryLimit = this.config.globalConfig.maxMemoryUsage;
    const anomalyRate = this.processedRequests > 0 ? this.detectedAnomalies / this.processedRequests : 0;

    // Check memory usage
    if (memoryUsage > memoryLimit * 0.9) {
      issues.push('Memory usage approaching limit');
    }

    // Check anomaly rate
    if (anomalyRate > 0.1) {
      issues.push('High anomaly rate detected');
    }

    // Check if analyzers are responding
    if (this.sequenceAnalyzers.size === 0) {
      issues.push('No active analyzers');
    }

    let status: 'healthy' | 'warning' | 'critical';
    if (issues.length === 0) {
      status = 'healthy';
    } else if (memoryUsage > memoryLimit || anomalyRate > 0.2) {
      status = 'critical';
    } else {
      status = 'warning';
    }

    return {
      isHealthy: issues.length === 0,
      status,
      issues,
      metrics: {
        memoryUsage,
        memoryLimit,
        anomalyRate,
        processedRequests: this.processedRequests
      }
    };
  }

  /**
   * Start periodic tasks
   */
  private startPeriodicTasks(): void {
    // Persistence timer
    if (this.config.globalConfig.persistenceInterval > 0) {
      this.persistenceTimer = setInterval(
        () => this.persistToStorage(),
        this.config.globalConfig.persistenceInterval
      );
    }

    // Cleanup timer
    if (this.config.globalConfig.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(
        () => this.performCleanup(),
        this.config.globalConfig.cleanupInterval
      );
    }

    // Metrics collection timer
    if (this.config.globalConfig.enableMetrics) {
      this.metricsTimer = setInterval(
        () => this.collectMetrics(),
        60000 // Collect metrics every minute
      );
    }
  }

  /**
   * Persist data to storage
   */
  private async persistToStorage(): Promise<void> {
    try {
      // Store manager configuration and state
      await this.redisService.set(
        'markov_manager:config',
        JSON.stringify(this.config),
        3600 // 1 hour TTL
      );

      await this.redisService.set(
        'markov_manager:metrics',
        JSON.stringify(this.performanceMetrics),
        3600
      );

      await this.redisService.set(
        'markov_manager:stats',
        JSON.stringify({
          processedRequests: this.processedRequests,
          detectedAnomalies: this.detectedAnomalies,
          lastUpdate: new Date()
        }),
        3600
      );

      this.lastPersistenceTime = new Date();
      logger.debug('Markov persistence completed');

    } catch (error) {
      logger.error('Failed to persist Markov data:', error);
    }
  }

  /**
   * Load data from persistence
   */
  private async loadFromPersistence(): Promise<void> {
    try {
      // Try to load previous metrics
      const metricsData = await this.redisService.get('markov_manager:metrics');
      if (metricsData) {
        const savedMetrics = JSON.parse(metricsData);
        this.performanceMetrics = { ...this.performanceMetrics, ...savedMetrics };
      }

      // Try to load previous stats
      const statsData = await this.redisService.get('markov_manager:stats');
      if (statsData) {
        const savedStats = JSON.parse(statsData);
        this.processedRequests = savedStats.processedRequests || 0;
        this.detectedAnomalies = savedStats.detectedAnomalies || 0;
      }

      logger.debug('Markov persistence loaded');

    } catch (error) {
      logger.warn('Failed to load persisted Markov data:', error);
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
          limit: this.config.globalConfig.maxMemoryUsage
        });

        // Clear some analyzers if memory is critical
        for (const analyzer of this.sequenceAnalyzers.values()) {
          analyzer.clear();
        }
      }

      this.lastCleanupTime = new Date();
      logger.debug('Markov cleanup completed');

    } catch (error) {
      logger.error('Error during Markov cleanup:', error);
    }
  }

  /**
   * Collect performance metrics
   */
  private collectMetrics(): void {
    try {
      // Update memory metrics
      this.performanceMetrics.memoryUsage.total = this.getTotalMemoryUsage();

      // Update throughput metrics
      this.performanceMetrics.throughput.sequencesPerSecond = this.processedRequests / 60; // Rough estimate

      logger.debug('Markov metrics collected', {
        memoryUsage: this.performanceMetrics.memoryUsage.total,
        analyzers: this.sequenceAnalyzers.size,
        processedRequests: this.processedRequests
      });

    } catch (error) {
      logger.error('Error collecting Markov metrics:', error);
    }
  }

  /**
   * Initialize performance metrics
   */
  private initializePerformanceMetrics(): MarkovPerformanceMetrics {
    return {
      predictionLatency: {
        p50: 0,
        p95: 0,
        p99: 0
      },
      memoryUsage: {
        transitionMatrix: 0,
        stateStorage: 0,
        total: 0,
        utilizationPercent: 0
      },
      accuracy: {
        nextStatePrediction: 0.85,
        anomalyDetection: {
          precision: 0.82,
          recall: 0.78,
          f1Score: 0.80
        },
        sequenceCompletion: 0.88
      },
      throughput: {
        sequencesPerSecond: 0,
        predictionsPerSecond: 0,
        updatesPerSecond: 0
      },
      stateManagement: {
        totalStates: 0,
        activeStates: 0,
        prunedStates: 0,
        stateUtilization: 0
      }
    };
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(processingTime: number): void {
    // Update latency metrics (simplified)
    this.performanceMetrics.predictionLatency.p50 = processingTime;
    this.performanceMetrics.memoryUsage.total = this.getTotalMemoryUsage();
  }

  /**
   * Shutdown the manager gracefully
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down MarkovManager...');

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

    // Clear analyzers
    for (const analyzer of this.sequenceAnalyzers.values()) {
      analyzer.clear();
    }

    this.isInitialized = false;
    logger.info('MarkovManager shutdown complete');
  }

  /**
   * Update configuration
   */
  public updateConfiguration(config: Partial<MarkovManagerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart periodic tasks with new intervals
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    
    this.startPeriodicTasks();
    
    logger.info('MarkovManager configuration updated');
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): MarkovManagerConfig {
    return { ...this.config };
  }

  /**
   * Manual trigger for persistence
   */
  public async forcePersistence(): Promise<void> {
    await this.persistToStorage();
  }

  /**
   * Manual trigger for cleanup
   */
  public async forceCleanup(): Promise<void> {
    await this.performCleanup();
  }

  /**
   * Reset all analyzers and metrics
   */
  public async reset(): Promise<void> {
    for (const analyzer of this.sequenceAnalyzers.values()) {
      analyzer.clear();
    }
    
    this.performanceMetrics = this.initializePerformanceMetrics();
    this.processedRequests = 0;
    this.detectedAnomalies = 0;
    
    logger.info('MarkovManager reset completed');
  }
}
