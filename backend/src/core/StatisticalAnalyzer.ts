import { logger } from '@/utils/logger';
import { RedisService } from '@/services/RedisService';
import { NetworkTraffic } from '@/models/NetworkTraffic';
import { FrequencyAnalyzer } from '@/services/FrequencyAnalyzer';
import { SketchAnomalyDetector } from './sketch/SketchAnomalyDetector';
import { getAnomalyDetectionConfig } from '@/config/sketchConfig';
import { FrequencyAnalysisResult, SketchAnomalyResult } from '@/types/sketch';

export interface TrafficStatistics {
  totalRequests: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  uniqueIPs: number;
  uniqueUserAgents: number;
  averageResponseTime: number;
  errorRate: number;
  bandwidthUsage: number;
  peakTrafficTime: Date;
  baselineMetrics: BaselineMetrics;
}

export interface BaselineMetrics {
  averageRequestsPerMinute: number;
  averageRequestsPerHour: number;
  averageUniqueIPs: number;
  averageResponseTime: number;
  averageErrorRate: number;
  standardDeviation: number;
}

export interface AnomalyDetection {
  isAnomaly: boolean;
  anomalyScore: number;
  anomalyType: string;
  confidence: number;
  description: string;
  timestamp: Date;
}

export interface TrafficPattern {
  timestamp: Date;
  requestCount: number;
  uniqueIPs: number;
  responseTime: number;
  errorCount: number;
  bandwidth: number;
}

export class StatisticalAnalyzer {
  private redisService: RedisService;
  private frequencyAnalyzer: FrequencyAnalyzer;
  private sketchAnomalyDetector: SketchAnomalyDetector;
  private trafficCache: Map<string, TrafficPattern[]>;
  private baselineMetrics: BaselineMetrics = {
    averageRequestsPerMinute: 0,
    averageRequestsPerHour: 0,
    averageUniqueIPs: 0,
    averageResponseTime: 0,
    averageErrorRate: 0,
    standardDeviation: 0
  };
  private anomalyThreshold: number;
  private timeWindows: number[];

  constructor() {
    this.redisService = new RedisService();
    this.trafficCache = new Map();
    this.anomalyThreshold = 0.7;
    this.timeWindows = [60000, 300000, 900000, 3600000]; // 1min, 5min, 15min, 1hour
    
    // Initialize frequency analysis components
    this.frequencyAnalyzer = new FrequencyAnalyzer(this.redisService);
    this.sketchAnomalyDetector = new SketchAnomalyDetector(
      this.frequencyAnalyzer,
      getAnomalyDetectionConfig()
    );
    
    this.initializeBaselineMetrics();
  }

  /**
   * Initialize baseline metrics
   */
  private async initializeBaselineMetrics(): Promise<void> {
    try {
      const cached = await this.redisService.get('baseline:metrics');
      if (cached) {
        this.baselineMetrics = JSON.parse(cached);
      } else {
        this.baselineMetrics = this.getDefaultBaselineMetrics();
        await this.saveBaselineMetrics();
      }
    } catch (error) {
      logger.error('Error initializing baseline metrics:', error);
      this.baselineMetrics = this.getDefaultBaselineMetrics();
    }
  }

  /**
   * Get default baseline metrics
   */
  private getDefaultBaselineMetrics(): BaselineMetrics {
    return {
      averageRequestsPerMinute: 100,
      averageRequestsPerHour: 6000,
      averageUniqueIPs: 50,
      averageResponseTime: 200,
      averageErrorRate: 0.02,
      standardDeviation: 0.1
    };
  }

  /**
   * Main statistical analysis method
   */
  public async analyze(requestData: any): Promise<number> {
    try {
      const timestamp = new Date();
      
      // Update traffic patterns
      await this.updateTrafficPatterns(requestData, timestamp);
      
      // Calculate current statistics
      const currentStats = await this.calculateCurrentStatistics();
      
      // Detect anomalies
      const anomaly = this.detectAnomalies(currentStats);
      
      // Update baseline metrics
      await this.updateBaselineMetrics(currentStats);
      
      // Calculate risk score based on anomalies
      const riskScore = this.calculateStatisticalRisk(anomaly, currentStats);
      
      logger.debug(`Statistical analysis completed, risk score: ${riskScore}`);
      
      return riskScore;
      
    } catch (error) {
      logger.error('Error in statistical analysis:', error);
      return 0.1; // Return low risk score on error
    }
  }

  /**
   * Update traffic patterns with new request data
   */
  private async updateTrafficPatterns(requestData: any, timestamp: Date): Promise<void> {
    const pattern: TrafficPattern = {
      timestamp,
      requestCount: 1,
      uniqueIPs: 1,
      responseTime: requestData.responseTime || 0,
      errorCount: requestData.isError ? 1 : 0,
      bandwidth: requestData.contentLength || 0
    };

    // Update patterns for different time windows
    for (const windowMs of this.timeWindows) {
      const windowKey = `traffic:${windowMs}`;
      await this.updateTrafficWindow(windowKey, pattern, windowMs);
    }
  }

  /**
   * Update traffic window with new pattern
   */
  private async updateTrafficWindow(windowKey: string, pattern: TrafficPattern, windowMs: number): Promise<void> {
    try {
      const now = Date.now();
      const cutoffTime = now - windowMs;
      
      // Get existing patterns for this window
      let patterns = this.trafficCache.get(windowKey) || [];
      const cached = await this.redisService.get(windowKey);
      
      if (cached) {
        patterns = JSON.parse(cached);
      }
      
      // Remove old patterns outside the window
      patterns = patterns.filter(p => p.timestamp.getTime() > cutoffTime);
      
      // Add new pattern
      patterns.push(pattern);
      
      // Aggregate patterns within the window
      const aggregatedPattern = this.aggregatePatterns(patterns);
      
      // Store updated patterns
      this.trafficCache.set(windowKey, patterns);
      await this.redisService.set(windowKey, JSON.stringify(patterns), Math.ceil(windowMs / 1000));
      
    } catch (error) {
      logger.error(`Error updating traffic window ${windowKey}:`, error);
    }
  }

  /**
   * Aggregate multiple patterns into a single pattern
   */
  private aggregatePatterns(patterns: TrafficPattern[]): TrafficPattern {
    if (patterns.length === 0) {
      return {
        timestamp: new Date(),
        requestCount: 0,
        uniqueIPs: 0,
        responseTime: 0,
        errorCount: 0,
        bandwidth: 0
      };
    }

    const totalRequests = patterns.reduce((sum, p) => sum + p.requestCount, 0);
    const totalErrors = patterns.reduce((sum, p) => sum + p.errorCount, 0);
    const totalBandwidth = patterns.reduce((sum, p) => sum + p.bandwidth, 0);
    const avgResponseTime = patterns.reduce((sum, p) => sum + p.responseTime, 0) / patterns.length;

    return {
      timestamp: new Date(),
      requestCount: totalRequests,
      uniqueIPs: patterns.length, // Simplified - in real implementation would track unique IPs
      responseTime: avgResponseTime,
      errorCount: totalErrors,
      bandwidth: totalBandwidth
    };
  }

  /**
   * Calculate current traffic statistics
   */
  private async calculateCurrentStatistics(): Promise<TrafficStatistics> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    
    // Get patterns for different time windows
    const oneMinPatterns = await this.getPatternsInWindow(oneMinuteAgo, now);
    const oneHourPatterns = await this.getPatternsInWindow(oneHourAgo, now);
    
    const totalRequests = oneMinPatterns.reduce((sum, p) => sum + p.requestCount, 0);
    const requestsPerMinute = totalRequests;
    const requestsPerHour = oneHourPatterns.reduce((sum, p) => sum + p.requestCount, 0);
    const uniqueIPs = this.calculateUniqueIPs(oneMinPatterns);
    const uniqueUserAgents = this.calculateUniqueUserAgents(oneMinPatterns);
    const averageResponseTime = this.calculateAverageResponseTime(oneMinPatterns);
    const errorRate = this.calculateErrorRate(oneMinPatterns);
    const bandwidthUsage = oneMinPatterns.reduce((sum, p) => sum + p.bandwidth, 0);
    
    return {
      totalRequests,
      requestsPerMinute,
      requestsPerHour,
      uniqueIPs,
      uniqueUserAgents,
      averageResponseTime,
      errorRate,
      bandwidthUsage,
      peakTrafficTime: new Date(),
      baselineMetrics: this.baselineMetrics
    };
  }

  /**
   * Get patterns within a time window
   */
  private async getPatternsInWindow(startTime: number, endTime: number): Promise<TrafficPattern[]> {
    const patterns: TrafficPattern[] = [];
    
    for (const [key, cachedPatterns] of this.trafficCache) {
      const windowPatterns = cachedPatterns.filter(
        p => p.timestamp.getTime() >= startTime && p.timestamp.getTime() <= endTime
      );
      patterns.push(...windowPatterns);
    }
    
    return patterns;
  }

  /**
   * Calculate unique IPs (simplified implementation)
   */
  private calculateUniqueIPs(patterns: TrafficPattern[]): number {
    // In a real implementation, this would track actual unique IPs
    return Math.min(patterns.length * 2, 100); // Simplified estimate
  }

  /**
   * Calculate unique user agents (simplified implementation)
   */
  private calculateUniqueUserAgents(patterns: TrafficPattern[]): number {
    // In a real implementation, this would track actual unique user agents
    return Math.min(patterns.length, 50); // Simplified estimate
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(patterns: TrafficPattern[]): number {
    if (patterns.length === 0) return 0;
    const totalTime = patterns.reduce((sum, p) => sum + p.responseTime, 0);
    return totalTime / patterns.length;
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(patterns: TrafficPattern[]): number {
    const totalRequests = patterns.reduce((sum, p) => sum + p.requestCount, 0);
    const totalErrors = patterns.reduce((sum, p) => sum + p.errorCount, 0);
    return totalRequests > 0 ? totalErrors / totalRequests : 0;
  }

  /**
   * Detect anomalies in traffic patterns
   */
  private detectAnomalies(stats: TrafficStatistics): AnomalyDetection {
    const anomalies: AnomalyDetection[] = [];
    
    // Check request rate anomalies
    const requestRateAnomaly = this.detectRequestRateAnomaly(stats);
    if (requestRateAnomaly.isAnomaly) {
      anomalies.push(requestRateAnomaly);
    }
    
    // Check response time anomalies
    const responseTimeAnomaly = this.detectResponseTimeAnomaly(stats);
    if (responseTimeAnomaly.isAnomaly) {
      anomalies.push(responseTimeAnomaly);
    }
    
    // Check error rate anomalies
    const errorRateAnomaly = this.detectErrorRateAnomaly(stats);
    if (errorRateAnomaly.isAnomaly) {
      anomalies.push(errorRateAnomaly);
    }
    
    // Check bandwidth anomalies
    const bandwidthAnomaly = this.detectBandwidthAnomaly(stats);
    if (bandwidthAnomaly.isAnomaly) {
      anomalies.push(bandwidthAnomaly);
    }
    
    // Combine anomalies into overall detection
    return this.combineAnomalies(anomalies);
  }

  /**
   * Detect request rate anomalies
   */
  private detectRequestRateAnomaly(stats: TrafficStatistics): AnomalyDetection {
    const baseline = stats.baselineMetrics.averageRequestsPerMinute;
    const current = stats.requestsPerMinute;
    const deviation = Math.abs(current - baseline) / baseline;
    
    return {
      isAnomaly: deviation > 2.0, // 200% increase/decrease
      anomalyScore: Math.min(deviation / 2.0, 1.0),
      anomalyType: 'request_rate',
      confidence: Math.min(deviation, 1.0),
      description: `Request rate anomaly: ${current} req/min vs baseline ${baseline}`,
      timestamp: new Date()
    };
  }

  /**
   * Detect response time anomalies
   */
  private detectResponseTimeAnomaly(stats: TrafficStatistics): AnomalyDetection {
    const baseline = stats.baselineMetrics.averageResponseTime;
    const current = stats.averageResponseTime;
    const deviation = Math.abs(current - baseline) / baseline;
    
    return {
      isAnomaly: deviation > 1.5, // 150% increase/decrease
      anomalyScore: Math.min(deviation / 1.5, 1.0),
      anomalyType: 'response_time',
      confidence: Math.min(deviation, 1.0),
      description: `Response time anomaly: ${current}ms vs baseline ${baseline}ms`,
      timestamp: new Date()
    };
  }

  /**
   * Detect error rate anomalies
   */
  private detectErrorRateAnomaly(stats: TrafficStatistics): AnomalyDetection {
    const baseline = stats.baselineMetrics.averageErrorRate;
    const current = stats.errorRate;
    const deviation = current / Math.max(baseline, 0.001);
    
    return {
      isAnomaly: deviation > 3.0, // 300% increase
      anomalyScore: Math.min(deviation / 3.0, 1.0),
      anomalyType: 'error_rate',
      confidence: Math.min(deviation, 1.0),
      description: `Error rate anomaly: ${(current * 100).toFixed(2)}% vs baseline ${(baseline * 100).toFixed(2)}%`,
      timestamp: new Date()
    };
  }

  /**
   * Detect bandwidth anomalies
   */
  private detectBandwidthAnomaly(stats: TrafficStatistics): AnomalyDetection {
    // Simplified bandwidth anomaly detection
    const currentBandwidth = stats.bandwidthUsage;
    const expectedBandwidth = stats.requestsPerMinute * 1024; // Assume 1KB per request
    const deviation = Math.abs(currentBandwidth - expectedBandwidth) / Math.max(expectedBandwidth, 1);
    
    return {
      isAnomaly: deviation > 2.0, // 200% increase/decrease
      anomalyScore: Math.min(deviation / 2.0, 1.0),
      anomalyType: 'bandwidth',
      confidence: Math.min(deviation, 1.0),
      description: `Bandwidth anomaly: ${currentBandwidth} bytes vs expected ${expectedBandwidth} bytes`,
      timestamp: new Date()
    };
  }

  /**
   * Combine multiple anomalies into overall detection
   */
  private combineAnomalies(anomalies: AnomalyDetection[]): AnomalyDetection {
    if (anomalies.length === 0) {
      return {
        isAnomaly: false,
        anomalyScore: 0,
        anomalyType: 'none',
        confidence: 0,
        description: 'No anomalies detected',
        timestamp: new Date()
      };
    }
    
    const maxScore = Math.max(...anomalies.map(a => a.anomalyScore));
    const avgConfidence = anomalies.reduce((sum, a) => sum + a.confidence, 0) / anomalies.length;
    const types = anomalies.map(a => a.anomalyType).join(', ');
    const descriptions = anomalies.map(a => a.description).join('; ');
    
    return {
      isAnomaly: true,
      anomalyScore: maxScore,
      anomalyType: types,
      confidence: avgConfidence,
      description: descriptions,
      timestamp: new Date()
    };
  }

  /**
   * Calculate statistical risk score
   */
  private calculateStatisticalRisk(anomaly: AnomalyDetection, stats: TrafficStatistics): number {
    let riskScore = 0;
    
    // Base risk from anomaly detection
    if (anomaly.isAnomaly) {
      riskScore += anomaly.anomalyScore * 0.6;
    }
    
    // Additional risk factors
    const errorRateRisk = Math.min(stats.errorRate * 5, 0.3); // Max 30% risk from errors
    const responseTimeRisk = Math.min(stats.averageResponseTime / 1000, 0.2); // Max 20% risk from slow responses
    
    riskScore += errorRateRisk + responseTimeRisk;
    
    return Math.min(riskScore, 1.0);
  }

  /**
   * Update baseline metrics with current statistics
   */
  private async updateBaselineMetrics(stats: TrafficStatistics): Promise<void> {
    // Simple exponential moving average update
    const alpha = 0.1; // Learning rate
    
    this.baselineMetrics.averageRequestsPerMinute = 
      (1 - alpha) * this.baselineMetrics.averageRequestsPerMinute + alpha * stats.requestsPerMinute;
    
    this.baselineMetrics.averageResponseTime = 
      (1 - alpha) * this.baselineMetrics.averageResponseTime + alpha * stats.averageResponseTime;
    
    this.baselineMetrics.averageErrorRate = 
      (1 - alpha) * this.baselineMetrics.averageErrorRate + alpha * stats.errorRate;
    
    // Save updated baseline
    await this.saveBaselineMetrics();
  }

  /**
   * Save baseline metrics to Redis
   */
  private async saveBaselineMetrics(): Promise<void> {
    try {
      await this.redisService.set(
        'baseline:metrics',
        JSON.stringify(this.baselineMetrics),
        86400 // Expire in 24 hours
      );
    } catch (error) {
      logger.error('Error saving baseline metrics:', error);
    }
  }

  /**
   * Get current traffic statistics
   */
  public async getCurrentStatistics(): Promise<TrafficStatistics> {
    return await this.calculateCurrentStatistics();
  }

  /**
   * Get baseline metrics
   */
  public getBaselineMetrics(): BaselineMetrics {
    return { ...this.baselineMetrics };
  }

  /**
   * Clear traffic cache
   */
  public clearCache(): void {
    this.trafficCache.clear();
  }

  /**
   * Get frequency analyzer for external use
   */
  public getFrequencyAnalyzer(): FrequencyAnalyzer {
    return this.frequencyAnalyzer;
  }

  /**
   * Get sketch anomaly detector for external use
   */
  public getSketchAnomalyDetector(): SketchAnomalyDetector {
    return this.sketchAnomalyDetector;
  }
}
