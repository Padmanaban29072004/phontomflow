import { logger } from '@/utils/logger';
import { FrequencyAnalyzer } from '@/services/FrequencyAnalyzer';
import {
  SketchAnomalyResult,
  FrequencyAnalysisResult,
  FrequencyPattern,
  FrequencyThresholds
} from '@/types/sketch';

/**
 * Configuration for anomaly detection
 */
export interface AnomalyDetectionConfig {
  enableFrequencySpikes: boolean;
  enableRareItemDetection: boolean;
  enableBurstPatterns: boolean;
  enableSustainedHighActivity: boolean;
  
  // Sensitivity settings (0-1, higher = more sensitive)
  sensitivity: number;
  
  // Time windows for analysis
  shortTermWindow: number;  // milliseconds
  longTermWindow: number;   // milliseconds
  
  // Minimum samples required for reliable detection
  minSamples: number;
  
  // Thresholds for different anomaly types
  spikeThreshold: number;        // Multiplier for spike detection
  rarityThreshold: number;       // Frequency below which items are considered rare
  burstVarianceThreshold: number; // Variance threshold for burst detection
  sustainedDuration: number;     // Duration for sustained high activity
}

/**
 * SketchAnomalyDetector uses Count-Min Sketch frequency data to detect various types of anomalies
 */
export class SketchAnomalyDetector {
  private frequencyAnalyzer: FrequencyAnalyzer;
  private config: AnomalyDetectionConfig;
  private detectionHistory: Map<string, SketchAnomalyResult[]> = new Map();

  constructor(frequencyAnalyzer: FrequencyAnalyzer, config?: Partial<AnomalyDetectionConfig>) {
    this.frequencyAnalyzer = frequencyAnalyzer;
    this.config = {
      enableFrequencySpikes: true,
      enableRareItemDetection: true,
      enableBurstPatterns: true,
      enableSustainedHighActivity: true,
      sensitivity: 0.7,
      shortTermWindow: 300000,   // 5 minutes
      longTermWindow: 3600000,   // 1 hour
      minSamples: 10,
      spikeThreshold: 5.0,       // 5x normal frequency
      rarityThreshold: 0.001,    // Less than 0.1% of total frequency
      burstVarianceThreshold: 2.0, // 2x standard deviation
      sustainedDuration: 600000, // 10 minutes
      ...config
    };

    logger.info('SketchAnomalyDetector initialized', { config: this.config });
  }

  /**
   * Analyze a frequency result for anomalies
   */
  public async analyzeFrequency(
    sketchName: string,
    result: FrequencyAnalysisResult
  ): Promise<SketchAnomalyResult[]> {
    const anomalies: SketchAnomalyResult[] = [];

    try {
      // Check for frequency spikes
      if (this.config.enableFrequencySpikes) {
        const spikeAnomaly = await this.detectFrequencySpike(sketchName, result);
        if (spikeAnomaly) anomalies.push(spikeAnomaly);
      }

      // Check for rare items
      if (this.config.enableRareItemDetection) {
        const rareAnomaly = await this.detectRareItem(sketchName, result);
        if (rareAnomaly) anomalies.push(rareAnomaly);
      }

      // Check for burst patterns
      if (this.config.enableBurstPatterns) {
        const burstAnomaly = await this.detectBurstPattern(sketchName, result);
        if (burstAnomaly) anomalies.push(burstAnomaly);
      }

      // Check for sustained high activity
      if (this.config.enableSustainedHighActivity) {
        const sustainedAnomaly = await this.detectSustainedHighActivity(sketchName, result);
        if (sustainedAnomaly) anomalies.push(sustainedAnomaly);
      }

      // Store detection history
      if (anomalies.length > 0) {
        this.storeDetectionHistory(sketchName, anomalies);
      }

    } catch (error) {
      logger.error('Error in anomaly detection:', error);
    }

    return anomalies;
  }

  /**
   * Detect frequency spikes (sudden increases in frequency)
   */
  private async detectFrequencySpike(
    sketchName: string,
    result: FrequencyAnalysisResult
  ): Promise<SketchAnomalyResult | null> {
    const threshold = result.baselineFrequency * this.config.spikeThreshold;
    
    if (result.currentFrequency < threshold) {
      return null;
    }

    const pattern = this.frequencyAnalyzer.analyzePattern(sketchName, result.item);
    
    // Only consider it a spike if there's an increasing trend
    if (pattern.type !== 'increasing' && pattern.type !== 'burst') {
      return null;
    }

    const severity = this.calculateSpikeSeverity(result.deviationRatio);
    const confidence = Math.min(pattern.confidence * result.confidence, 1.0);

    return {
      detected: true,
      anomalyType: 'frequency_spike',
      severity,
      confidence,
      description: `Frequency spike detected: ${result.item} has ${result.currentFrequency} requests (${result.deviationRatio.toFixed(1)}x baseline)`,
      affectedItems: [result.item],
      timeWindow: {
        start: new Date(result.lastSeen.getTime() - this.config.shortTermWindow),
        end: result.lastSeen,
        duration: this.config.shortTermWindow
      },
      recommendations: this.generateSpikeRecommendations(result, severity)
    };
  }

  /**
   * Detect rare items (items with very low frequency that might be probing)
   */
  private async detectRareItem(
    sketchName: string,
    result: FrequencyAnalysisResult
  ): Promise<SketchAnomalyResult | null> {
    // Get sketch metrics to understand total activity
    const metrics = this.frequencyAnalyzer.getSketchMetrics(sketchName);
    if (!metrics || metrics.totalInserts < this.config.minSamples) {
      return null;
    }

    const relativeFrequency = result.currentFrequency / metrics.totalInserts;
    
    // Item is too common to be considered rare
    if (relativeFrequency > this.config.rarityThreshold) {
      return null;
    }

    // Special case: single occurrence of suspicious items
    if (result.currentFrequency === 1 && this.isSuspiciousItem(result.item)) {
      const severity = this.calculateRaritySeverity(relativeFrequency, result.item);
      
      return {
        detected: true,
        anomalyType: 'rare_item',
        severity,
        confidence: 0.8,
        description: `Rare suspicious item detected: ${result.item} (first occurrence)`,
        affectedItems: [result.item],
        timeWindow: {
          start: result.lastSeen,
          end: result.lastSeen,
          duration: 0
        },
        recommendations: this.generateRarityRecommendations(result, severity)
      };
    }

    return null;
  }

  /**
   * Detect burst patterns (irregular, high-variance activity)
   */
  private async detectBurstPattern(
    sketchName: string,
    result: FrequencyAnalysisResult
  ): Promise<SketchAnomalyResult | null> {
    const pattern = this.frequencyAnalyzer.analyzePattern(sketchName, result.item);
    
    if (pattern.type !== 'burst') {
      return null;
    }

    // Require minimum confidence in pattern detection
    if (pattern.confidence < 0.6) {
      return null;
    }

    const severity = this.calculateBurstSeverity(pattern.confidence, result.riskScore);

    return {
      detected: true,
      anomalyType: 'burst_pattern',
      severity,
      confidence: pattern.confidence,
      description: `Burst pattern detected: ${result.item} shows irregular activity pattern`,
      affectedItems: [result.item],
      timeWindow: {
        start: new Date(result.lastSeen.getTime() - this.config.longTermWindow),
        end: result.lastSeen,
        duration: this.config.longTermWindow
      },
      recommendations: this.generateBurstRecommendations(result, severity)
    };
  }

  /**
   * Detect sustained high activity (persistently high frequency over time)
   */
  private async detectSustainedHighActivity(
    sketchName: string,
    result: FrequencyAnalysisResult
  ): Promise<SketchAnomalyResult | null> {
    if (result.riskLevel !== 'anomalous' && result.riskLevel !== 'critical') {
      return null;
    }

    const pattern = this.frequencyAnalyzer.analyzePattern(sketchName, result.item);
    
    // Look for steady high activity or increasing trends
    if (pattern.type !== 'steady' && pattern.type !== 'increasing') {
      return null;
    }

    // Check if activity has been sustained for minimum duration
    const history = this.detectionHistory.get(sketchName) || [];
    const recentAnomalies = history.filter(a => 
      a.affectedItems.includes(result.item) &&
      a.timeWindow.end.getTime() > Date.now() - this.config.sustainedDuration
    );

    if (recentAnomalies.length < 3) { // Require at least 3 recent detections
      return null;
    }

    const severity = this.calculateSustainedSeverity(result.riskScore, recentAnomalies.length);

    return {
      detected: true,
      anomalyType: 'sustained_high',
      severity,
      confidence: 0.9,
      description: `Sustained high activity detected: ${result.item} has maintained ${result.riskLevel} activity for extended period`,
      affectedItems: [result.item],
      timeWindow: {
        start: new Date(result.lastSeen.getTime() - this.config.sustainedDuration),
        end: result.lastSeen,
        duration: this.config.sustainedDuration
      },
      recommendations: this.generateSustainedRecommendations(result, severity)
    };
  }

  /**
   * Check if an item appears suspicious based on patterns
   */
  private isSuspiciousItem(item: string): boolean {
    const suspiciousPatterns = [
      /admin/i,
      /\.php$/i,
      /\.asp$/i,
      /phpmyadmin/i,
      /wp-admin/i,
      /\.env$/i,
      /config/i,
      /backup/i,
      /test/i,
      /debug/i,
      /dev/i,
      /api\/v\d+/i,
      /bot/i,
      /crawler/i,
      /spider/i,
      /scanner/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(item));
  }

  /**
   * Calculate spike severity based on deviation ratio
   */
  private calculateSpikeSeverity(deviationRatio: number): 'low' | 'medium' | 'high' | 'critical' {
    if (deviationRatio >= 50) return 'critical';
    if (deviationRatio >= 20) return 'high';
    if (deviationRatio >= 10) return 'medium';
    return 'low';
  }

  /**
   * Calculate rarity severity based on frequency and content
   */
  private calculateRaritySeverity(relativeFrequency: number, item: string): 'low' | 'medium' | 'high' | 'critical' {
    const isSuspicious = this.isSuspiciousItem(item);
    
    if (isSuspicious && relativeFrequency < 0.0001) return 'critical';
    if (isSuspicious && relativeFrequency < 0.001) return 'high';
    if (relativeFrequency < 0.0001) return 'medium';
    return 'low';
  }

  /**
   * Calculate burst severity
   */
  private calculateBurstSeverity(confidence: number, riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    const combinedScore = confidence * riskScore;
    
    if (combinedScore >= 0.8) return 'critical';
    if (combinedScore >= 0.6) return 'high';
    if (combinedScore >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * Calculate sustained activity severity
   */
  private calculateSustainedSeverity(riskScore: number, detectionCount: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= 0.8 && detectionCount >= 10) return 'critical';
    if (riskScore >= 0.6 && detectionCount >= 7) return 'high';
    if (riskScore >= 0.4 && detectionCount >= 5) return 'medium';
    return 'low';
  }

  /**
   * Generate recommendations for spike anomalies
   */
  private generateSpikeRecommendations(
    result: FrequencyAnalysisResult,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): string[] {
    const recommendations: string[] = [];

    if (severity === 'critical') {
      recommendations.push('Immediately block or rate-limit the source');
      recommendations.push('Investigate for potential DDoS attack');
      recommendations.push('Alert security team');
    } else if (severity === 'high') {
      recommendations.push('Apply temporary rate limiting');
      recommendations.push('Monitor closely for continued activity');
      recommendations.push('Consider blocking if pattern continues');
    } else {
      recommendations.push('Monitor for pattern continuation');
      recommendations.push('Log activity for further analysis');
    }

    recommendations.push(`Item: ${result.item}`);
    recommendations.push(`Current frequency: ${result.currentFrequency}`);
    recommendations.push(`Deviation: ${result.deviationRatio.toFixed(1)}x baseline`);

    return recommendations;
  }

  /**
   * Generate recommendations for rarity anomalies
   */
  private generateRarityRecommendations(
    result: FrequencyAnalysisResult,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): string[] {
    const recommendations: string[] = [];

    if (severity === 'critical' || severity === 'high') {
      recommendations.push('Block access to suspicious resource');
      recommendations.push('Investigate source IP and user agent');
      recommendations.push('Check for scanning or probing activity');
    } else {
      recommendations.push('Log activity for pattern analysis');
      recommendations.push('Monitor for repeated access attempts');
    }

    recommendations.push(`Rare item: ${result.item}`);
    recommendations.push('Consider if this resource should be accessible');

    return recommendations;
  }

  /**
   * Generate recommendations for burst anomalies
   */
  private generateBurstRecommendations(
    result: FrequencyAnalysisResult,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): string[] {
    const recommendations: string[] = [];

    if (severity === 'critical' || severity === 'high') {
      recommendations.push('Apply adaptive rate limiting');
      recommendations.push('Investigate burst source and pattern');
      recommendations.push('Consider temporary blocking during bursts');
    } else {
      recommendations.push('Monitor burst patterns');
      recommendations.push('Analyze timing and frequency distribution');
    }

    recommendations.push(`Burst pattern detected for: ${result.item}`);
    recommendations.push('Irregular activity pattern may indicate automated behavior');

    return recommendations;
  }

  /**
   * Generate recommendations for sustained anomalies
   */
  private generateSustainedRecommendations(
    result: FrequencyAnalysisResult,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): string[] {
    const recommendations: string[] = [];

    if (severity === 'critical') {
      recommendations.push('Implement immediate blocking or quarantine');
      recommendations.push('Escalate to security incident response team');
      recommendations.push('Investigate for potential compromise');
    } else if (severity === 'high') {
      recommendations.push('Apply strict rate limiting');
      recommendations.push('Require additional authentication');
      recommendations.push('Monitor all related activity');
    } else {
      recommendations.push('Continue monitoring sustained activity');
      recommendations.push('Consider gradual response escalation');
    }

    recommendations.push(`Sustained activity from: ${result.item}`);
    recommendations.push('Pattern suggests persistent automated behavior');

    return recommendations;
  }

  /**
   * Store detection history for trend analysis
   */
  private storeDetectionHistory(sketchName: string, anomalies: SketchAnomalyResult[]): void {
    const history = this.detectionHistory.get(sketchName) || [];
    history.push(...anomalies);

    // Keep only recent history (last 24 hours)
    const oneDayAgo = Date.now() - 86400000;
    const recentHistory = history.filter(a => a.timeWindow.end.getTime() > oneDayAgo);
    
    this.detectionHistory.set(sketchName, recentHistory);
  }

  /**
   * Get detection history for analysis
   */
  public getDetectionHistory(sketchName: string): SketchAnomalyResult[] {
    return this.detectionHistory.get(sketchName) || [];
  }

  /**
   * Update detection configuration
   */
  public updateConfig(config: Partial<AnomalyDetectionConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Anomaly detection configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  public getConfig(): AnomalyDetectionConfig {
    return { ...this.config };
  }

  /**
   * Clear detection history
   */
  public clearHistory(sketchName?: string): void {
    if (sketchName) {
      this.detectionHistory.delete(sketchName);
    } else {
      this.detectionHistory.clear();
    }
    logger.info('Detection history cleared', { sketchName: sketchName || 'all' });
  }

  /**
   * Get summary statistics of detections
   */
  public getDetectionSummary(sketchName: string): {
    totalDetections: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    averageConfidence: number;
  } {
    const history = this.getDetectionHistory(sketchName);
    
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let totalConfidence = 0;

    history.forEach(detection => {
      byType[detection.anomalyType] = (byType[detection.anomalyType] || 0) + 1;
      bySeverity[detection.severity] = (bySeverity[detection.severity] || 0) + 1;
      totalConfidence += detection.confidence;
    });

    return {
      totalDetections: history.length,
      byType,
      bySeverity,
      averageConfidence: history.length > 0 ? totalConfidence / history.length : 0
    };
  }
}
