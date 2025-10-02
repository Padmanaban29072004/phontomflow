import { logger } from '@/utils/logger';
import { HyperLogLog } from '@/core/hyperloglog/HyperLogLog';
import { RedisService } from './RedisService';
import {
  VisitorTrackingConfig,
  VisitorMetrics,
  CardinalityEstimate,
  GeographicDistribution,
  UserAgentAnalysis
} from '@/types/hyperloglog';
import { getHLLConfigForUseCase } from '@/config/hyperloglogConfig';

/**
 * VisitorTracker service for real-time unique visitor counting using HyperLogLog
 * Provides efficient cardinality estimation for various visitor metrics
 */
export class VisitorTracker {
  private config: VisitorTrackingConfig;
  private redisService: RedisService;
  
  // HyperLogLog instances for different tracking types
  private hlls: Map<string, HyperLogLog> = new Map();
  
  // Time-window based tracking
  private timeWindowData: Map<string, Map<number, HyperLogLog>> = new Map();
  
  private isInitialized: boolean = false;

  constructor(config: VisitorTrackingConfig, redisService: RedisService) {
    this.config = config;
    this.redisService = redisService;
    this.initializeHLLs();
  }

  /**
   * Initialize HyperLogLog instances for different tracking types
   */
  private initializeHLLs(): void {
    if (this.config.trackIPs) {
      this.hlls.set('ips', new HyperLogLog(getHLLConfigForUseCase('ip_tracking')));
      this.initializeTimeWindows('ips');
    }
    
    if (this.config.trackSessions) {
      this.hlls.set('sessions', new HyperLogLog(getHLLConfigForUseCase('session_tracking')));
      this.initializeTimeWindows('sessions');
    }
    
    if (this.config.trackUserAgents) {
      this.hlls.set('user_agents', new HyperLogLog(getHLLConfigForUseCase('general')));
      this.initializeTimeWindows('user_agents');
    }
    
    if (this.config.trackGeolocation) {
      this.hlls.set('locations', new HyperLogLog(getHLLConfigForUseCase('general')));
      this.initializeTimeWindows('locations');
    }
    
    if (this.config.trackPaths) {
      this.hlls.set('paths', new HyperLogLog(getHLLConfigForUseCase('path_tracking')));
      this.initializeTimeWindows('paths');
    }

    this.isInitialized = true;
    
    logger.info('VisitorTracker initialized', {
      trackingTypes: Array.from(this.hlls.keys()),
      timeWindows: this.config.timeWindows.length
    });
  }

  /**
   * Initialize time windows for a tracking type
   */
  private initializeTimeWindows(trackingType: string): void {
    const windowMap = new Map<number, HyperLogLog>();
    
    for (const window of this.config.timeWindows) {
      windowMap.set(window, new HyperLogLog(getHLLConfigForUseCase('general')));
    }
    
    this.timeWindowData.set(trackingType, windowMap);
  }

  /**
   * Track a visitor request
   */
  public trackVisitor(requestData: {
    ipAddress?: string;
    sessionId?: string;
    userAgent?: string;
    country?: string;
    region?: string;
    city?: string;
    path?: string;
    timestamp?: Date;
  }): void {
    if (!this.isInitialized || !this.config.enabled) {
      return;
    }

    const timestamp = requestData.timestamp || new Date();

    try {
      // Track IP addresses
      if (this.config.trackIPs && requestData.ipAddress) {
        this.addToTracking('ips', requestData.ipAddress, timestamp);
      }

      // Track sessions
      if (this.config.trackSessions && requestData.sessionId) {
        this.addToTracking('sessions', requestData.sessionId, timestamp);
      }

      // Track user agents
      if (this.config.trackUserAgents && requestData.userAgent) {
        const normalizedUA = this.normalizeUserAgent(requestData.userAgent);
        this.addToTracking('user_agents', normalizedUA, timestamp);
      }

      // Track geographic locations
      if (this.config.trackGeolocation && requestData.country) {
        const location = this.buildLocationKey(requestData.country, requestData.region, requestData.city);
        this.addToTracking('locations', location, timestamp);
      }

      // Track request paths
      if (this.config.trackPaths && requestData.path) {
        const normalizedPath = this.normalizePath(requestData.path);
        this.addToTracking('paths', normalizedPath, timestamp);
      }

    } catch (error) {
      logger.error('Error tracking visitor:', error);
    }
  }

  /**
   * Add an item to tracking (both main HLL and time windows)
   */
  private addToTracking(trackingType: string, item: string, timestamp: Date): void {
    // Add to main HLL
    const hll = this.hlls.get(trackingType);
    if (hll) {
      hll.add(item);
    }

    // Add to time window HLLs
    const timeWindows = this.timeWindowData.get(trackingType);
    if (timeWindows) {
      for (const [windowSize, windowHLL] of timeWindows) {
        if (this.isWithinTimeWindow(timestamp, windowSize)) {
          windowHLL.add(item);
        }
      }
    }
  }

  /**
   * Get visitor metrics for a specific time window
   */
  public getVisitorMetrics(timeWindowMs?: number): VisitorMetrics {
    const now = new Date();
    const windowStart = timeWindowMs 
      ? new Date(now.getTime() - timeWindowMs)
      : new Date(0); // All time if no window specified

    const metrics: VisitorMetrics = {
      timeWindow: {
        start: windowStart,
        end: now,
        duration: timeWindowMs || now.getTime()
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
      // Get counts from appropriate HLLs
      if (timeWindowMs && this.timeWindowData.has('ips')) {
        const windowHLL = this.timeWindowData.get('ips')?.get(timeWindowMs);
        if (windowHLL) {
          const estimate = windowHLL.count();
          metrics.uniqueVisitors.ips = estimate.count;
          metrics.confidence = Math.max(metrics.confidence, estimate.confidence);
        }
      } else if (this.hlls.has('ips')) {
        const estimate = this.hlls.get('ips')!.count();
        metrics.uniqueVisitors.ips = estimate.count;
        metrics.confidence = Math.max(metrics.confidence, estimate.confidence);
      }

      // Similar logic for other tracking types
      this.populateMetricsForType('sessions', timeWindowMs, metrics);
      this.populateMetricsForType('user_agents', timeWindowMs, metrics);
      this.populateMetricsForType('locations', timeWindowMs, metrics);
      this.populateMetricsForType('paths', timeWindowMs, metrics);

      // Calculate total unique visitors (use IPs as primary metric)
      metrics.uniqueVisitors.total = metrics.uniqueVisitors.ips;

      // Calculate growth rate (simplified - compare with previous period)
      metrics.growthRate = this.calculateGrowthRate(timeWindowMs);

    } catch (error) {
      logger.error('Error getting visitor metrics:', error);
    }

    return metrics;
  }

  /**
   * Populate metrics for a specific tracking type
   */
  private populateMetricsForType(
    trackingType: string, 
    timeWindowMs: number | undefined, 
    metrics: VisitorMetrics
  ): void {
    let estimate: CardinalityEstimate | null = null;

    if (timeWindowMs && this.timeWindowData.has(trackingType)) {
      const windowHLL = this.timeWindowData.get(trackingType)?.get(timeWindowMs);
      if (windowHLL) {
        estimate = windowHLL.count();
      }
    } else if (this.hlls.has(trackingType)) {
      estimate = this.hlls.get(trackingType)!.count();
    }

    if (estimate) {
      switch (trackingType) {
        case 'sessions':
          metrics.uniqueVisitors.sessions = estimate.count;
          break;
        case 'user_agents':
          metrics.uniqueVisitors.userAgents = estimate.count;
          break;
        case 'locations':
          metrics.uniqueVisitors.locations = estimate.count;
          break;
        case 'paths':
          metrics.uniqueVisitors.paths = estimate.count;
          break;
      }
      
      metrics.confidence = Math.max(metrics.confidence, estimate.confidence);
    }
  }

  /**
   * Get geographic distribution of visitors
   */
  public getGeographicDistribution(limit: number = 10): GeographicDistribution[] {
    // This is a simplified implementation
    // In a real scenario, you'd need to track individual countries
    // and their cardinalities separately
    
    const totalVisitors = this.hlls.get('locations')?.count().count || 0;
    
    // Placeholder data - in practice, you'd maintain separate HLLs per country
    const mockDistribution: GeographicDistribution[] = [
      {
        country: 'United States',
        region: 'North America',
        uniqueVisitors: Math.floor(totalVisitors * 0.4),
        percentage: 40,
        confidence: 0.95
      },
      {
        country: 'Germany',
        region: 'Europe',
        uniqueVisitors: Math.floor(totalVisitors * 0.2),
        percentage: 20,
        confidence: 0.90
      }
      // Add more countries as needed
    ];

    return mockDistribution.slice(0, limit);
  }

  /**
   * Analyze user agents
   */
  public analyzeUserAgents(limit: number = 10): UserAgentAnalysis[] {
    const totalUserAgents = this.hlls.get('user_agents')?.count().count || 0;
    
    // Simplified analysis - in practice, you'd parse and categorize user agents
    const mockAnalysis: UserAgentAnalysis[] = [
      {
        category: 'browser',
        name: 'Chrome',
        version: '91+',
        uniqueCount: Math.floor(totalUserAgents * 0.6),
        percentage: 60,
        riskScore: 0.1
      },
      {
        category: 'browser',
        name: 'Firefox',
        uniqueCount: Math.floor(totalUserAgents * 0.2),
        percentage: 20,
        riskScore: 0.1
      },
      {
        category: 'bot',
        name: 'Googlebot',
        uniqueCount: Math.floor(totalUserAgents * 0.05),
        percentage: 5,
        riskScore: 0.0
      }
    ];

    return mockAnalysis.slice(0, limit);
  }

  /**
   * Get cardinality estimate for a specific tracking type
   */
  public getCardinality(trackingType: string, timeWindowMs?: number): CardinalityEstimate | null {
    try {
      if (timeWindowMs && this.timeWindowData.has(trackingType)) {
        const windowHLL = this.timeWindowData.get(trackingType)?.get(timeWindowMs);
        return windowHLL ? windowHLL.count() : null;
      }
      
      const hll = this.hlls.get(trackingType);
      return hll ? hll.count() : null;
      
    } catch (error) {
      logger.error(`Error getting cardinality for ${trackingType}:`, error);
      return null;
    }
  }

  /**
   * Clear all tracking data
   */
  public clear(): void {
    for (const hll of this.hlls.values()) {
      hll.clear();
    }
    
    for (const windowMap of this.timeWindowData.values()) {
      for (const windowHLL of windowMap.values()) {
        windowHLL.clear();
      }
    }
    
    logger.info('All visitor tracking data cleared');
  }

  /**
   * Get memory usage across all HLLs
   */
  public getMemoryUsage(): number {
    let totalMemory = 0;
    
    for (const hll of this.hlls.values()) {
      totalMemory += hll.getMemoryUsage();
    }
    
    for (const windowMap of this.timeWindowData.values()) {
      for (const windowHLL of windowMap.values()) {
        totalMemory += windowHLL.getMemoryUsage();
      }
    }
    
    return totalMemory;
  }

  /**
   * Normalize user agent string
   */
  private normalizeUserAgent(userAgent: string): string {
    return userAgent
      .replace(/\/[\d\.]+/g, '') // Remove version numbers
      .replace(/\s+/g, ' ')      // Normalize whitespace
      .trim()
      .toLowerCase();
  }

  /**
   * Normalize request path
   */
  private normalizePath(path: string): string {
    try {
      const url = new URL(path, 'http://example.com');
      return url.pathname.toLowerCase();
    } catch {
      return path.split('?')[0].toLowerCase();
    }
  }

  /**
   * Build location key from geographic components
   */
  private buildLocationKey(country: string, region?: string, city?: string): string {
    const parts = [country];
    if (region) parts.push(region);
    if (city) parts.push(city);
    return parts.join('|').toLowerCase();
  }

  /**
   * Check if timestamp is within time window
   */
  private isWithinTimeWindow(timestamp: Date, windowMs: number): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;
    return timestamp.getTime() >= windowStart;
  }

  /**
   * Calculate growth rate compared to previous period
   */
  private calculateGrowthRate(timeWindowMs?: number): number {
    // Simplified implementation - return 0 for now
    // In practice, you'd compare current period with previous period
    return 0;
  }

  /**
   * Update configuration
   */
  public updateConfiguration(config: Partial<VisitorTrackingConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Reinitialize if needed
    if (!this.isInitialized) {
      this.initializeHLLs();
    }
    
    logger.info('VisitorTracker configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): VisitorTrackingConfig {
    return { ...this.config };
  }

  /**
   * Get available tracking types
   */
  public getTrackingTypes(): string[] {
    return Array.from(this.hlls.keys());
  }
}
