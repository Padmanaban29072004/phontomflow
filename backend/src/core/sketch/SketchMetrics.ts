import { logger } from '@/utils/logger';
import { RedisService } from '@/services/RedisService';
import {
  SketchMetrics,
  SketchPerformanceMetrics,
  FrequencyAnalysisResult,
  SketchAnomalyResult
} from '@/types/sketch';

/**
 * Histogram for tracking latency percentiles
 */
class LatencyHistogram {
  private buckets: number[] = [];
  private readonly maxSize = 1000; // Keep last 1000 measurements

  add(value: number): void {
    this.buckets.push(value);
    if (this.buckets.length > this.maxSize) {
      this.buckets.shift(); // Remove oldest
    }
  }

  getPercentile(percentile: number): number {
    if (this.buckets.length === 0) return 0;
    
    const sorted = [...this.buckets].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  clear(): void {
    this.buckets = [];
  }

  size(): number {
    return this.buckets.length;
  }
}

/**
 * Time-series data point for metrics tracking
 */
interface MetricDataPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

/**
 * Time-series metrics collector
 */
class TimeSeriesCollector {
  private dataPoints: MetricDataPoint[] = [];
  private readonly maxPoints = 1440; // 24 hours of minute-level data

  add(value: number, metadata?: Record<string, any>): void {
    this.dataPoints.push({
      timestamp: new Date(),
      value,
      metadata
    });

    // Keep only recent data
    const oneHourAgo = Date.now() - 86400000; // 24 hours
    this.dataPoints = this.dataPoints.filter(dp => dp.timestamp.getTime() > oneHourAgo);
  }

  getRecent(minutes: number = 60): MetricDataPoint[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.dataPoints.filter(dp => dp.timestamp.getTime() > cutoff);
  }

  getAverage(minutes: number = 60): number {
    const recent = this.getRecent(minutes);
    if (recent.length === 0) return 0;
    
    const sum = recent.reduce((acc, dp) => acc + dp.value, 0);
    return sum / recent.length;
  }

  getMax(minutes: number = 60): number {
    const recent = this.getRecent(minutes);
    if (recent.length === 0) return 0;
    
    return Math.max(...recent.map(dp => dp.value));
  }

  getMin(minutes: number = 60): number {
    const recent = this.getRecent(minutes);
    if (recent.length === 0) return 0;
    
    return Math.min(...recent.map(dp => dp.value));
  }

  getTrend(minutes: number = 60): number {
    const recent = this.getRecent(minutes);
    if (recent.length < 2) return 0;
    
    const first = recent[0].value;
    const last = recent[recent.length - 1].value;
    
    return first === 0 ? 0 : (last - first) / first;
  }

  clear(): void {
    this.dataPoints = [];
  }
}

/**
 * Comprehensive metrics monitoring for Count-Min Sketch operations
 */
export class SketchMetricsCollector {
  private redisService: RedisService;
  
  // Latency tracking
  private insertLatency = new LatencyHistogram();
  private queryLatency = new LatencyHistogram();
  
  // Time-series metrics
  private operationsPerSecond = new TimeSeriesCollector();
  private memoryUsage = new TimeSeriesCollector();
  private errorRate = new TimeSeriesCollector();
  private anomalyRate = new TimeSeriesCollector();
  
  // Counters
  private totalInserts = 0;
  private totalQueries = 0;
  private totalErrors = 0;
  private totalAnomalies = 0;
  
  // Accuracy tracking
  private accuracyMetrics = {
    truePositives: 0,
    falsePositives: 0,
    trueNegatives: 0,
    falseNegatives: 0
  };
  
  // Performance tracking
  private performanceAlerts: Array<{
    timestamp: Date;
    type: 'high_latency' | 'high_memory' | 'high_error_rate' | 'low_accuracy';
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    metadata: Record<string, any>;
  }> = [];

  private metricsTimer?: NodeJS.Timeout;
  private readonly metricsInterval = 60000; // 1 minute

  constructor(redisService: RedisService) {
    this.redisService = redisService;
    this.startMetricsCollection();
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.collectPeriodicMetrics();
    }, this.metricsInterval);
  }

  /**
   * Record insert operation metrics
   */
  recordInsert(latency: number, success: boolean, metadata?: Record<string, any>): void {
    this.totalInserts++;
    
    if (success) {
      this.insertLatency.add(latency);
    } else {
      this.totalErrors++;
    }
    
    // Check for performance alerts
    this.checkLatencyAlert('insert', latency);
  }

  /**
   * Record query operation metrics
   */
  recordQuery(latency: number, success: boolean, metadata?: Record<string, any>): void {
    this.totalQueries++;
    
    if (success) {
      this.queryLatency.add(latency);
    } else {
      this.totalErrors++;
    }
    
    // Check for performance alerts
    this.checkLatencyAlert('query', latency);
  }

  /**
   * Record anomaly detection result
   */
  recordAnomalyDetection(
    result: SketchAnomalyResult[],
    actualThreat: boolean,
    confidence: number
  ): void {
    const hasHighConfidenceAnomaly = result.some(r => 
      r.confidence > 0.8 && (r.severity === 'high' || r.severity === 'critical')
    );
    
    // Update accuracy metrics
    if (hasHighConfidenceAnomaly && actualThreat) {
      this.accuracyMetrics.truePositives++;
    } else if (hasHighConfidenceAnomaly && !actualThreat) {
      this.accuracyMetrics.falsePositives++;
    } else if (!hasHighConfidenceAnomaly && !actualThreat) {
      this.accuracyMetrics.trueNegatives++;
    } else {
      this.accuracyMetrics.falseNegatives++;
    }
    
    if (result.length > 0) {
      this.totalAnomalies++;
    }
    
    // Check accuracy alerts
    this.checkAccuracyAlert();
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(bytes: number, maxBytes: number): void {
    this.memoryUsage.add(bytes);
    
    const usageRatio = bytes / maxBytes;
    if (usageRatio > 0.9) {
      this.addPerformanceAlert(
        'high_memory',
        `Memory usage at ${(usageRatio * 100).toFixed(1)}% of limit`,
        usageRatio > 0.95 ? 'critical' : 'high',
        { bytes, maxBytes, usageRatio }
      );
    }
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): SketchPerformanceMetrics {
    const totalOps = this.totalInserts + this.totalQueries;
    const errorRate = totalOps > 0 ? this.totalErrors / totalOps : 0;
    
    const { truePositives, falsePositives, trueNegatives, falseNegatives } = this.accuracyMetrics;
    const totalPredictions = truePositives + falsePositives + trueNegatives + falseNegatives;
    
    const precision = (truePositives + falsePositives) > 0 ? 
      truePositives / (truePositives + falsePositives) : 0;
    const recall = (truePositives + falseNegatives) > 0 ? 
      truePositives / (truePositives + falseNegatives) : 0;
    const f1Score = (precision + recall) > 0 ? 
      2 * (precision * recall) / (precision + recall) : 0;

    return {
      operationsPerSecond: {
        inserts: this.calculateOpsPerSecond('inserts'),
        queries: this.calculateOpsPerSecond('queries')
      },
      latency: {
        insert: {
          p50: this.insertLatency.getPercentile(50),
          p95: this.insertLatency.getPercentile(95),
          p99: this.insertLatency.getPercentile(99)
        },
        query: {
          p50: this.queryLatency.getPercentile(50),
          p95: this.queryLatency.getPercentile(95),
          p99: this.queryLatency.getPercentile(99)
        }
      },
      accuracy: {
        truePositives,
        falsePositives,
        trueNegatives,
        falseNegatives,
        precision,
        recall,
        f1Score
      },
      memoryEfficiency: {
        totalMemory: this.memoryUsage.getRecent(1)[0]?.value || 0,
        memoryPerItem: totalOps > 0 ? (this.memoryUsage.getRecent(1)[0]?.value || 0) / totalOps : 0,
        compressionRatio: this.calculateCompressionRatio()
      }
    };
  }

  /**
   * Get metrics summary for monitoring dashboard
   */
  getMetricsSummary(): {
    performance: SketchPerformanceMetrics;
    health: {
      status: 'healthy' | 'warning' | 'critical';
      issues: string[];
      score: number; // 0-100
    };
    trends: {
      operationsTrend: number;
      latencyTrend: number;
      memoryTrend: number;
      errorTrend: number;
    };
    alerts: Array<{
      timestamp: Date;
      type: 'high_latency' | 'high_memory' | 'high_error_rate' | 'low_accuracy';
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      metadata: Record<string, any>;
    }>;
  } {
    const performance = this.getPerformanceMetrics();
    const health = this.calculateHealthScore();
    const trends = this.calculateTrends();
    
    return {
      performance,
      health,
      trends,
      alerts: this.getRecentAlerts(60) // Last hour
    };
  }

  /**
   * Calculate operations per second
   */
  private calculateOpsPerSecond(type: 'inserts' | 'queries'): number {
    const oneMinuteAgo = Date.now() - 60000;
    const recent = this.operationsPerSecond.getRecent(1);
    
    // This is simplified - in practice you'd track separate counters
    const recentOps = recent.length;
    return recentOps; // Operations in the last minute
  }

  /**
   * Calculate compression ratio (simplified)
   */
  private calculateCompressionRatio(): number {
    // In a real implementation, this would compare actual data size
    // with the sketch size to calculate compression effectiveness
    const totalOps = this.totalInserts + this.totalQueries;
    const currentMemory = this.memoryUsage.getRecent(1)[0]?.value || 0;
    
    if (totalOps === 0 || currentMemory === 0) return 0;
    
    // Estimate: if we stored each operation as 100 bytes vs sketch memory
    const uncompressedSize = totalOps * 100;
    return uncompressedSize / currentMemory;
  }

  /**
   * Calculate health score
   */
  private calculateHealthScore(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    score: number;
  } {
    const issues: string[] = [];
    let score = 100;

    // Check latency
    const p95Insert = this.insertLatency.getPercentile(95);
    const p95Query = this.queryLatency.getPercentile(95);
    
    if (p95Insert > 10000 || p95Query > 5000) { // 10ms insert, 5ms query
      issues.push('High latency detected');
      score -= 20;
    }

    // Check error rate
    const totalOps = this.totalInserts + this.totalQueries;
    const errorRate = totalOps > 0 ? this.totalErrors / totalOps : 0;
    
    if (errorRate > 0.01) { // 1% error rate
      issues.push('High error rate');
      score -= 30;
    }

    // Check accuracy
    const { truePositives, falsePositives, trueNegatives, falseNegatives } = this.accuracyMetrics;
    const totalPredictions = truePositives + falsePositives + trueNegatives + falseNegatives;
    
    if (totalPredictions > 100) { // Only check if we have enough data
      const accuracy = (truePositives + trueNegatives) / totalPredictions;
      if (accuracy < 0.8) { // 80% accuracy threshold
        issues.push('Low anomaly detection accuracy');
        score -= 25;
      }
    }

    // Check memory usage
    const memoryTrend = this.memoryUsage.getTrend(60);
    if (memoryTrend > 0.1) { // 10% increase per hour
      issues.push('Rapidly increasing memory usage');
      score -= 15;
    }

    // Determine status
    let status: 'healthy' | 'warning' | 'critical';
    if (score >= 80) status = 'healthy';
    else if (score >= 60) status = 'warning';
    else status = 'critical';

    return { status, issues, score: Math.max(0, score) };
  }

  /**
   * Calculate trends
   */
  private calculateTrends(): {
    operationsTrend: number;
    latencyTrend: number;
    memoryTrend: number;
    errorTrend: number;
  } {
    return {
      operationsTrend: this.operationsPerSecond.getTrend(60),
      latencyTrend: this.calculateLatencyTrend(),
      memoryTrend: this.memoryUsage.getTrend(60),
      errorTrend: this.errorRate.getTrend(60)
    };
  }

  /**
   * Calculate latency trend
   */
  private calculateLatencyTrend(): number {
    // Compare current P95 with P95 from an hour ago
    const currentP95 = (this.insertLatency.getPercentile(95) + this.queryLatency.getPercentile(95)) / 2;
    
    // This is simplified - in practice you'd store historical percentiles
    return 0; // Placeholder
  }

  /**
   * Check for latency alerts
   */
  private checkLatencyAlert(operation: 'insert' | 'query', latency: number): void {
    const threshold = operation === 'insert' ? 5000 : 2000; // 5ms insert, 2ms query
    
    if (latency > threshold * 2) {
      this.addPerformanceAlert(
        'high_latency',
        `High ${operation} latency: ${(latency / 1000).toFixed(2)}ms`,
        'high',
        { operation, latency, threshold }
      );
    }
  }

  /**
   * Check for accuracy alerts
   */
  private checkAccuracyAlert(): void {
    const { truePositives, falsePositives, trueNegatives, falseNegatives } = this.accuracyMetrics;
    const total = truePositives + falsePositives + trueNegatives + falseNegatives;
    
    if (total > 100 && total % 50 === 0) { // Check every 50 predictions
      const accuracy = (truePositives + trueNegatives) / total;
      const precision = (truePositives + falsePositives) > 0 ? 
        truePositives / (truePositives + falsePositives) : 0;
      
      if (accuracy < 0.7) {
        this.addPerformanceAlert(
          'low_accuracy',
          `Low detection accuracy: ${(accuracy * 100).toFixed(1)}%`,
          accuracy < 0.5 ? 'critical' : 'high',
          { accuracy, precision, total }
        );
      }
    }
  }

  /**
   * Add performance alert
   */
  private addPerformanceAlert(
    type: 'high_latency' | 'high_memory' | 'high_error_rate' | 'low_accuracy',
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata: Record<string, any>
  ): void {
    this.performanceAlerts.push({
      timestamp: new Date(),
      type,
      message,
      severity,
      metadata
    });

    // Keep only recent alerts (last 24 hours)
    const oneDayAgo = Date.now() - 86400000;
    this.performanceAlerts = this.performanceAlerts.filter(
      alert => alert.timestamp.getTime() > oneDayAgo
    );

    // Log critical alerts immediately
    if (severity === 'critical') {
      logger.error('Critical sketch performance alert', {
        type,
        message,
        metadata
      });
    } else if (severity === 'high') {
      logger.warn('High severity sketch performance alert', {
        type,
        message,
        metadata
      });
    }
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(minutes: number = 60): typeof this.performanceAlerts {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.performanceAlerts.filter(alert => alert.timestamp.getTime() > cutoff);
  }

  /**
   * Collect periodic metrics
   */
  private collectPeriodicMetrics(): void {
    // Update time-series data
    const totalOps = this.totalInserts + this.totalQueries;
    this.operationsPerSecond.add(totalOps);
    
    const errorRate = totalOps > 0 ? this.totalErrors / totalOps : 0;
    this.errorRate.add(errorRate);
    
    const anomalyRate = totalOps > 0 ? this.totalAnomalies / totalOps : 0;
    this.anomalyRate.add(anomalyRate);
  }

  /**
   * Export metrics for external monitoring systems
   */
  async exportMetrics(): Promise<{
    prometheus?: string;
    json: Record<string, any>;
  }> {
    const metrics = this.getPerformanceMetrics();
    const summary = this.getMetricsSummary();
    
    // JSON format for APIs
    const jsonMetrics = {
      timestamp: new Date().toISOString(),
      sketch_metrics: metrics,
      health: summary.health,
      trends: summary.trends,
      alerts: summary.alerts.length,
      counters: {
        total_inserts: this.totalInserts,
        total_queries: this.totalQueries,
        total_errors: this.totalErrors,
        total_anomalies: this.totalAnomalies
      }
    };

    // Prometheus format (simplified)
    const prometheusMetrics = `
# HELP sketch_operations_total Total number of sketch operations
# TYPE sketch_operations_total counter
sketch_operations_total{operation="insert"} ${this.totalInserts}
sketch_operations_total{operation="query"} ${this.totalQueries}

# HELP sketch_latency_microseconds Sketch operation latency in microseconds
# TYPE sketch_latency_microseconds histogram
sketch_latency_microseconds{operation="insert",quantile="0.5"} ${metrics.latency.insert.p50}
sketch_latency_microseconds{operation="insert",quantile="0.95"} ${metrics.latency.insert.p95}
sketch_latency_microseconds{operation="insert",quantile="0.99"} ${metrics.latency.insert.p99}
sketch_latency_microseconds{operation="query",quantile="0.5"} ${metrics.latency.query.p50}
sketch_latency_microseconds{operation="query",quantile="0.95"} ${metrics.latency.query.p95}
sketch_latency_microseconds{operation="query",quantile="0.99"} ${metrics.latency.query.p99}

# HELP sketch_memory_bytes Current memory usage in bytes
# TYPE sketch_memory_bytes gauge
sketch_memory_bytes ${metrics.memoryEfficiency.totalMemory}

# HELP sketch_health_score Health score from 0-100
# TYPE sketch_health_score gauge
sketch_health_score ${summary.health.score}
    `.trim();

    return {
      prometheus: prometheusMetrics,
      json: jsonMetrics
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.insertLatency.clear();
    this.queryLatency.clear();
    this.operationsPerSecond.clear();
    this.memoryUsage.clear();
    this.errorRate.clear();
    this.anomalyRate.clear();
    
    this.totalInserts = 0;
    this.totalQueries = 0;
    this.totalErrors = 0;
    this.totalAnomalies = 0;
    
    this.accuracyMetrics = {
      truePositives: 0,
      falsePositives: 0,
      trueNegatives: 0,
      falseNegatives: 0
    };
    
    this.performanceAlerts = [];
    
    logger.info('Sketch metrics reset');
  }

  /**
   * Cleanup and stop metrics collection
   */
  shutdown(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    
    logger.info('Sketch metrics collector shutdown');
  }
}
