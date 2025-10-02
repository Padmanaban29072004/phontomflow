import { logger } from '@/utils/logger';
import { CountMinSketch } from '@/core/sketch/CountMinSketch';
import { RedisService } from './RedisService';
import {
  CountMinSketchConfig,
  FrequencyEstimate,
  FrequencyAnalysisResult,
  FrequencyThresholds,
  TimeWindowFrequency,
  FrequencyPattern
} from '@/types/sketch';

/**
 * FrequencyAnalyzer service for real-time frequency analysis using Count-Min Sketch
 * Tracks and analyzes request patterns, IP frequencies, and other security-relevant metrics
 */
export class FrequencyAnalyzer {
  private sketches: Map<string, CountMinSketch> = new Map();
  private baselines: Map<string, number> = new Map();
  private thresholds: Map<string, FrequencyThresholds> = new Map();
  private redisService: RedisService;
  private timeWindows: Map<string, TimeWindowFrequency[]> = new Map();
  private isInitialized: boolean = false;

  constructor(redisService: RedisService) {
    this.redisService = redisService;
    this.initializeDefaultSketches();
  }

  /**
   * Initialize default sketches for common tracking scenarios
   */
  private initializeDefaultSketches(): void {
    const defaultConfig: CountMinSketchConfig = {
      width: 4096,
      depth: 6,
      hashSeed: Math.floor(Math.random() * 1000000),
      errorRate: 0.001,
      confidence: 0.99,
      name: 'default'
    };

    // IP address frequency tracking
    this.createSketch('ip_addresses', {
      ...defaultConfig,
      width: 8192,
      name: 'ip_tracker'
    });

    // User agent frequency tracking
    this.createSketch('user_agents', {
      ...defaultConfig,
      width: 2048,
      name: 'ua_tracker'
    });

    // Request path frequency tracking
    this.createSketch('request_paths', {
      ...defaultConfig,
      width: 4096,
      name: 'path_tracker'
    });

    // Session ID frequency tracking
    this.createSketch('session_ids', {
      ...defaultConfig,
      width: 2048,
      name: 'session_tracker'
    });

    // Request parameter frequency tracking
    this.createSketch('parameters', {
      ...defaultConfig,
      width: 4096,
      name: 'param_tracker'
    });

    // Set default thresholds
    this.setDefaultThresholds();
    this.isInitialized = true;

    logger.info('FrequencyAnalyzer initialized with default sketches', {
      sketchCount: this.sketches.size,
      memoryUsage: this.getTotalMemoryUsage()
    });
  }

  /**
   * Set default frequency thresholds
   */
  private setDefaultThresholds(): void {
    // IP address thresholds (requests per time window)
    this.thresholds.set('ip_addresses', {
      baseline: 10,      // 10 requests per window is normal
      suspicious: 50,    // 50+ requests is suspicious
      anomalous: 100,    // 100+ requests is anomalous
      critical: 500      // 500+ requests is critical (likely DDoS)
    });

    // User agent thresholds
    this.thresholds.set('user_agents', {
      baseline: 5,       // 5 requests per UA is normal
      suspicious: 20,    // 20+ requests from same UA is suspicious
      anomalous: 50,     // 50+ requests is anomalous
      critical: 200      // 200+ requests is critical
    });

    // Request path thresholds
    this.thresholds.set('request_paths', {
      baseline: 20,      // 20 requests per path is normal
      suspicious: 100,   // 100+ requests to same path is suspicious
      anomalous: 500,    // 500+ requests is anomalous
      critical: 2000     // 2000+ requests is critical
    });

    // Session ID thresholds
    this.thresholds.set('session_ids', {
      baseline: 50,      // 50 requests per session is normal
      suspicious: 200,   // 200+ requests per session is suspicious
      anomalous: 1000,   // 1000+ requests is anomalous
      critical: 5000     // 5000+ requests is critical
    });

    // Parameter thresholds
    this.thresholds.set('parameters', {
      baseline: 1,       // 1 request with parameter is normal
      suspicious: 5,     // 5+ requests with same parameter is suspicious
      anomalous: 20,     // 20+ requests is anomalous
      critical: 100      // 100+ requests is critical
    });
  }

  /**
   * Create a new sketch for tracking
   */
  public createSketch(name: string, config: CountMinSketchConfig): void {
    const sketch = new CountMinSketch(config);
    this.sketches.set(name, sketch);
    this.timeWindows.set(name, []);
    
    logger.debug('Created frequency sketch', { name, config });
  }

  /**
   * Track IP address frequency
   */
  public trackIPAddress(ipAddress: string, timestamp?: Date): FrequencyAnalysisResult {
    return this.trackItem('ip_addresses', ipAddress, timestamp);
  }

  /**
   * Track user agent frequency
   */
  public trackUserAgent(userAgent: string, timestamp?: Date): FrequencyAnalysisResult {
    // Normalize user agent to reduce variations
    const normalizedUA = this.normalizeUserAgent(userAgent);
    return this.trackItem('user_agents', normalizedUA, timestamp);
  }

  /**
   * Track request path frequency
   */
  public trackRequestPath(path: string, timestamp?: Date): FrequencyAnalysisResult {
    // Normalize path to remove query parameters and fragments
    const normalizedPath = this.normalizePath(path);
    return this.trackItem('request_paths', normalizedPath, timestamp);
  }

  /**
   * Track session ID frequency
   */
  public trackSessionID(sessionId: string, timestamp?: Date): FrequencyAnalysisResult {
    return this.trackItem('session_ids', sessionId, timestamp);
  }

  /**
   * Track parameter frequency
   */
  public trackParameter(paramName: string, paramValue: string, timestamp?: Date): FrequencyAnalysisResult {
    const paramKey = `${paramName}=${paramValue}`;
    return this.trackItem('parameters', paramKey, timestamp);
  }

  /**
   * Generic item tracking method
   */
  private trackItem(sketchName: string, item: string, timestamp?: Date): FrequencyAnalysisResult {
    const sketch = this.sketches.get(sketchName);
    if (!sketch) {
      throw new Error(`Sketch '${sketchName}' not found`);
    }

    // Insert item into sketch
    sketch.insert(item);

    // Get current frequency
    const frequencyEstimate = sketch.query(item);
    
    // Get baseline frequency
    const baselineKey = `${sketchName}:${item}`;
    const baseline = this.baselines.get(baselineKey) || 1;
    
    // Calculate deviation ratio
    const deviationRatio = frequencyEstimate.frequency / baseline;
    
    // Determine risk level
    const thresholds = this.thresholds.get(sketchName)!;
    const riskLevel = this.determineRiskLevel(frequencyEstimate.frequency, thresholds);
    
    // Calculate risk score (0-1)
    const riskScore = this.calculateRiskScore(frequencyEstimate.frequency, thresholds);
    
    // Update time window data
    this.updateTimeWindow(sketchName, item, frequencyEstimate.frequency, timestamp || new Date());
    
    const result: FrequencyAnalysisResult = {
      item,
      currentFrequency: frequencyEstimate.frequency,
      baselineFrequency: baseline,
      deviationRatio,
      riskLevel,
      riskScore,
      confidence: frequencyEstimate.confidence,
      timeWindow: 300000, // 5 minutes default
      lastSeen: timestamp || new Date()
    };

    // Log suspicious activity
    if (riskLevel !== 'normal') {
      logger.warn('Frequency anomaly detected', {
        sketchName,
        item: item.substring(0, 50), // Truncate for logging
        frequency: frequencyEstimate.frequency,
        baseline,
        riskLevel,
        riskScore
      });
    }

    return result;
  }

  /**
   * Determine risk level based on frequency and thresholds
   */
  private determineRiskLevel(frequency: number, thresholds: FrequencyThresholds): 'normal' | 'suspicious' | 'anomalous' | 'critical' {
    if (frequency >= thresholds.critical) return 'critical';
    if (frequency >= thresholds.anomalous) return 'anomalous';
    if (frequency >= thresholds.suspicious) return 'suspicious';
    return 'normal';
  }

  /**
   * Calculate risk score (0-1) based on frequency
   */
  private calculateRiskScore(frequency: number, thresholds: FrequencyThresholds): number {
    if (frequency <= thresholds.baseline) {
      return 0;
    }
    
    if (frequency >= thresholds.critical) {
      return 1;
    }
    
    // Linear interpolation between baseline and critical
    const range = thresholds.critical - thresholds.baseline;
    const position = frequency - thresholds.baseline;
    return Math.min(position / range, 1);
  }

  /**
   * Update time window data for pattern analysis
   */
  private updateTimeWindow(sketchName: string, item: string, frequency: number, timestamp: Date): void {
    const windows = this.timeWindows.get(sketchName);
    if (!windows) return;

    const windowDuration = 60000; // 1 minute windows
    const windowStart = new Date(Math.floor(timestamp.getTime() / windowDuration) * windowDuration);
    const windowEnd = new Date(windowStart.getTime() + windowDuration);

    // Find or create window entry
    let windowEntry = windows.find(w => 
      w.item === item && 
      w.window.start.getTime() === windowStart.getTime()
    );

    if (!windowEntry) {
      windowEntry = {
        item,
        frequency: 0,
        window: {
          start: windowStart,
          end: windowEnd,
          duration: windowDuration
        },
        buckets: []
      };
      windows.push(windowEntry);
    }

    windowEntry.frequency = frequency;

    // Keep only recent windows (last hour)
    const oneHourAgo = timestamp.getTime() - 3600000;
    const recentWindows = windows.filter(w => w.window.start.getTime() > oneHourAgo);
    this.timeWindows.set(sketchName, recentWindows);
  }

  /**
   * Analyze frequency patterns for an item
   */
  public analyzePattern(sketchName: string, item: string): FrequencyPattern {
    const windows = this.timeWindows.get(sketchName);
    if (!windows) {
      throw new Error(`No time windows found for sketch '${sketchName}'`);
    }

    const itemWindows = windows
      .filter(w => w.item === item)
      .sort((a, b) => a.window.start.getTime() - b.window.start.getTime());

    if (itemWindows.length < 2) {
      return {
        type: 'steady',
        confidence: 0.5,
        description: 'Insufficient data for pattern analysis',
        trend: 0
      };
    }

    const frequencies = itemWindows.map(w => w.frequency);
    const trend = this.calculateTrend(frequencies);
    const variance = this.calculateVariance(frequencies);
    const mean = frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length;

    // Determine pattern type
    let type: FrequencyPattern['type'];
    let confidence = 0.8;
    let description: string;

    if (variance / mean > 2) {
      type = 'burst';
      description = 'Irregular burst pattern detected';
    } else if (Math.abs(trend) > 0.5) {
      type = trend > 0 ? 'increasing' : 'decreasing';
      description = `${type} trend detected (${(trend * 100).toFixed(1)}% change)`;
    } else {
      type = 'steady';
      description = 'Stable frequency pattern';
    }

    return {
      type,
      confidence,
      description,
      trend
    };
  }

  /**
   * Calculate trend in frequency data
   */
  private calculateTrend(frequencies: number[]): number {
    if (frequencies.length < 2) return 0;
    
    const first = frequencies[0];
    const last = frequencies[frequencies.length - 1];
    
    if (first === 0) return last > 0 ? 1 : 0;
    
    return (last - first) / first;
  }

  /**
   * Calculate variance of frequency data
   */
  private calculateVariance(frequencies: number[]): number {
    if (frequencies.length < 2) return 0;
    
    const mean = frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length;
    const squaredDiffs = frequencies.map(f => Math.pow(f - mean, 2));
    return squaredDiffs.reduce((sum, d) => sum + d, 0) / frequencies.length;
  }

  /**
   * Get top frequent items from a sketch
   */
  public getTopItems(sketchName: string, candidates: string[], limit: number = 10): FrequencyEstimate[] {
    const sketch = this.sketches.get(sketchName);
    if (!sketch) {
      throw new Error(`Sketch '${sketchName}' not found`);
    }

    return sketch.getTopK(limit, candidates);
  }

  /**
   * Update baseline frequency for an item
   */
  public updateBaseline(sketchName: string, item: string, baseline: number): void {
    const baselineKey = `${sketchName}:${item}`;
    this.baselines.set(baselineKey, baseline);
  }

  /**
   * Update thresholds for a sketch
   */
  public updateThresholds(sketchName: string, thresholds: FrequencyThresholds): void {
    this.thresholds.set(sketchName, thresholds);
  }

  /**
   * Normalize user agent string
   */
  private normalizeUserAgent(userAgent: string): string {
    // Remove version numbers and keep only browser/bot name
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
      // Fallback for malformed URLs
      return path.split('?')[0].toLowerCase();
    }
  }

  /**
   * Get sketch metrics
   */
  public getSketchMetrics(sketchName: string) {
    const sketch = this.sketches.get(sketchName);
    return sketch ? sketch.getMetrics() : null;
  }

  /**
   * Get all sketch names
   */
  public getSketchNames(): string[] {
    return Array.from(this.sketches.keys());
  }

  /**
   * Get total memory usage across all sketches
   */
  public getTotalMemoryUsage(): number {
    return Array.from(this.sketches.values())
      .reduce((total, sketch) => total + sketch.getMemoryUsage(), 0);
  }

  /**
   * Clear all sketches
   */
  public clearAll(): void {
    this.sketches.forEach(sketch => sketch.clear());
    this.timeWindows.clear();
    this.baselines.clear();
    logger.info('All frequency sketches cleared');
  }

  /**
   * Persist sketches to Redis
   */
  public async persistToRedis(): Promise<void> {
    try {
      for (const [name, sketch] of this.sketches) {
        const data = sketch.serialize();
        await this.redisService.set(
          `frequency_sketch:${name}`,
          JSON.stringify(data),
          3600 // 1 hour TTL
        );
      }
      logger.debug('Frequency sketches persisted to Redis');
    } catch (error) {
      logger.error('Failed to persist sketches to Redis:', error);
    }
  }

  /**
   * Load sketches from Redis
   */
  public async loadFromRedis(): Promise<void> {
    try {
      const sketchNames = this.getSketchNames();
      
      for (const name of sketchNames) {
        const data = await this.redisService.get(`frequency_sketch:${name}`);
        if (data) {
          const persistenceData = JSON.parse(data);
          const sketch = CountMinSketch.deserialize(persistenceData);
          this.sketches.set(name, sketch);
        }
      }
      
      logger.info('Frequency sketches loaded from Redis');
    } catch (error) {
      logger.warn('Failed to load sketches from Redis:', error);
    }
  }
}
