import { logger } from '@/utils/logger';
import { RedisService } from './RedisService';
import { MarkovManager } from './MarkovManager';
import {
  BehavioralInsight,
  SequenceAnomalyResult,
  UserJourney,
  BehavioralRiskScore,
  BehavioralPattern
} from '@/types/markov';

/**
 * Integration interface for behavioral sequence data
 */
export interface BehavioralSequenceData {
  riskScore: number;           // Overall behavioral risk score (0-1)
  anomalyScore: number;        // Sequence anomaly score (0-1)
  confidence: number;          // Confidence in the assessment (0-1)
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  behavioralState: string;     // Current behavioral state
  predictedNextStates: Array<{
    state: string;
    probability: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }>;
  anomalyDetails: SequenceAnomalyResult | null;
  journey: UserJourney | null;
  insights: BehavioralInsight[];
  recommendations: string[];
  threatIndicators: Array<{
    type: 'sequence_anomaly' | 'pattern_break' | 'impossible_transition' | 'timing_anomaly' | 'context_violation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    confidence: number;
  }>;
}

/**
 * BehavioralIntegration provides a clean interface between Markov Chain analysis
 * and the existing threat detection system without modifying BehavioralAnalyzer
 */
export class BehavioralIntegration {
  private markovManager: MarkovManager;
  private redisService: RedisService;
  private isInitialized: boolean = false;
  private riskWeights: {
    sequenceAnomaly: number;
    patternDeviation: number;
    transitionRisk: number;
    contextViolation: number;
  };

  constructor(redisService: RedisService) {
    this.redisService = redisService;
    this.markovManager = new MarkovManager(redisService);
    this.riskWeights = {
      sequenceAnomaly: parseFloat(process.env.MARKOV_BEHAVIORAL_ANOMALY_WEIGHT || '0.4'),
      patternDeviation: 0.3,
      transitionRisk: 0.2,
      contextViolation: 0.1
    };
  }

  /**
   * Initialize the integration layer
   */
  public async initialize(): Promise<void> {
    try {
      await this.markovManager.initialize();
      this.isInitialized = true;
      
      logger.info('BehavioralIntegration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize BehavioralIntegration:', error);
      throw error;
    }
  }

  /**
   * Process request and get behavioral sequence data for threat analysis
   */
  public async processRequestForThreatAnalysis(requestData: {
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
  }): Promise<BehavioralSequenceData> {
    if (!this.isInitialized) {
      throw new Error('BehavioralIntegration not initialized');
    }

    try {
      // Process request through Markov manager
      const result = await this.markovManager.processRequest(requestData);
      
      if (!result.processed || !result.primaryResult) {
        return this.getDefaultBehavioralData();
      }

      const { behavioralState, prediction, anomalyResult, journey } = result.primaryResult;

      // Calculate behavioral risk score
      const behavioralRisk = this.calculateBehavioralRiskScore(anomalyResult, prediction, journey);

      // Extract predicted next states
      const predictedNextStates = prediction.nextStates.map((state: any) => ({
        state: state.state,
        probability: state.probability,
        riskLevel: state.metadata.riskLevel
      }));

      // Generate threat indicators
      const threatIndicators = this.generateThreatIndicators(anomalyResult, journey);

      // Generate recommendations
      const recommendations = this.generateRecommendations(anomalyResult, behavioralRisk);

      return {
        riskScore: behavioralRisk.score,
        anomalyScore: anomalyResult.anomalyScore,
        confidence: behavioralRisk.confidence,
        riskLevel: behavioralRisk.riskLevel,
        behavioralState: `${behavioralState.action}:${behavioralState.context}`,
        predictedNextStates,
        anomalyDetails: anomalyResult,
        journey,
        insights: result.insights || [],
        recommendations,
        threatIndicators
      };

    } catch (error) {
      logger.error('Error processing request for threat analysis:', error);
      return this.getDefaultBehavioralData();
    }
  }

  /**
   * Get behavioral risk assessment for a session
   */
  public async getBehavioralRiskAssessment(sessionId: string): Promise<BehavioralRiskScore | null> {
    if (!this.isInitialized) {
      throw new Error('BehavioralIntegration not initialized');
    }

    try {
      const primaryAnalyzer = this.markovManager.getAnalyzer('primary');
      if (!primaryAnalyzer) {
        return null;
      }

      const journey = primaryAnalyzer.analyzeUserJourney(sessionId);
      if (!journey) {
        return null;
      }

      // Calculate risk score based on journey analysis
      const riskScore = this.calculateJourneyRiskScore(journey);

      return {
        score: riskScore,
        confidence: 0.8,
        riskLevel: this.determineRiskLevel(riskScore),
        contributingFactors: this.identifyRiskFactors(journey),
        recommendations: this.generateJourneyRecommendations(journey),
        historicalComparison: {
          userAverage: 0.3, // Would be calculated from historical data
          globalAverage: 0.25,
          percentile: 0.7
        }
      };

    } catch (error) {
      logger.error('Error getting behavioral risk assessment:', error);
      return null;
    }
  }

  /**
   * Get behavioral threat indicators
   */
  public async getBehavioralThreatIndicators(): Promise<{
    indicators: Array<{
      type: 'sequence_anomaly' | 'pattern_deviation' | 'behavioral_drift' | 'journey_anomaly';
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      affectedSessions: number;
      confidence: number;
      pattern?: BehavioralPattern;
    }>;
    overallRisk: number;
    summary: string;
  }> {
    const indicators: Array<{
      type: 'sequence_anomaly' | 'pattern_deviation' | 'behavioral_drift' | 'journey_anomaly';
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      affectedSessions: number;
      confidence: number;
      pattern?: BehavioralPattern;
    }> = [];

    try {
      // Detect anomalies across all analyzers
      const anomalyResult = await this.markovManager.detectAnomalies();

      // Convert insights to threat indicators
      for (const insight of anomalyResult.insights) {
        if (insight.insight === 'anomalous_sequence') {
          indicators.push({
            type: 'sequence_anomaly',
            severity: insight.impact as any,
            description: insight.description,
            affectedSessions: insight.affectedUsers,
            confidence: insight.confidence,
            pattern: insight.data.pattern
          });
        } else if (insight.insight === 'rare_behavior') {
          indicators.push({
            type: 'pattern_deviation',
            severity: 'medium',
            description: insight.description,
            affectedSessions: insight.affectedUsers,
            confidence: insight.confidence
          });
        } else if (insight.insight === 'journey_abandonment') {
          indicators.push({
            type: 'journey_anomaly',
            severity: 'medium',
            description: insight.description,
            affectedSessions: insight.affectedUsers,
            confidence: insight.confidence
          });
        }
      }

      // Discover patterns and identify deviations
      const patternResult = await this.markovManager.discoverPatterns(3);
      for (const pattern of patternResult.anomalousPatterns) {
        if (pattern.riskLevel === 'high' || pattern.riskLevel === 'critical') {
          indicators.push({
            type: 'pattern_deviation',
            severity: pattern.riskLevel,
            description: `Anomalous behavioral pattern: ${pattern.description}`,
            affectedSessions: pattern.examples.length,
            confidence: pattern.confidence,
            pattern
          });
        }
      }

      // Calculate overall risk
      const overallRisk = this.calculateOverallThreatRisk(indicators);

      // Generate summary
      const summary = this.generateThreatSummary(indicators, overallRisk);

      return { indicators, overallRisk, summary };

    } catch (error) {
      logger.error('Error getting behavioral threat indicators:', error);
      return {
        indicators: [],
        overallRisk: 0,
        summary: 'Unable to assess behavioral threats due to error'
      };
    }
  }

  /**
   * Get summary statistics for integration with other systems
   */
  public async getSummaryStatistics(): Promise<{
    totalSequencesAnalyzed: number;
    uniquePatternsDiscovered: number;
    anomaliesDetected: number;
    averageRiskScore: number;
    highRiskSessions: number;
    memoryUsage: number;
    isHealthy: boolean;
    lastAnalysisTime: Date;
  }> {
    try {
      if (!this.isInitialized) {
        return {
          totalSequencesAnalyzed: 0,
          uniquePatternsDiscovered: 0,
          anomaliesDetected: 0,
          averageRiskScore: 0,
          highRiskSessions: 0,
          memoryUsage: 0,
          isHealthy: false,
          lastAnalysisTime: new Date()
        };
      }

      const managerStats = this.markovManager.getManagerStatistics();
      const healthStatus = this.markovManager.getHealthStatus();

      const totalSequences = managerStats.analyzerDetails.reduce(
        (sum, analyzer) => sum + analyzer.sequencesAnalyzed, 0
      );

      const totalAnomalies = managerStats.analyzerDetails.reduce(
        (sum, analyzer) => sum + analyzer.anomaliesDetected, 0
      );

      const patternResult = await this.markovManager.discoverPatterns(1);

      return {
        totalSequencesAnalyzed: totalSequences,
        uniquePatternsDiscovered: patternResult.totalPatterns,
        anomaliesDetected: totalAnomalies,
        averageRiskScore: managerStats.anomalyRate * 0.7, // Rough estimate
        highRiskSessions: Math.floor(totalAnomalies * 0.3), // Estimate high-risk sessions
        memoryUsage: managerStats.totalMemoryUsage,
        isHealthy: healthStatus.isHealthy,
        lastAnalysisTime: new Date()
      };

    } catch (error) {
      logger.error('Error getting summary statistics:', error);
      return {
        totalSequencesAnalyzed: 0,
        uniquePatternsDiscovered: 0,
        anomaliesDetected: 0,
        averageRiskScore: 0,
        highRiskSessions: 0,
        memoryUsage: 0,
        isHealthy: false,
        lastAnalysisTime: new Date()
      };
    }
  }

  /**
   * Check if behavioral integration is healthy
   */
  public isHealthy(): boolean {
    return this.isInitialized && this.markovManager.getHealthStatus().isHealthy;
  }

  /**
   * Get the underlying Markov manager for advanced operations
   */
  public getMarkovManager(): MarkovManager {
    return this.markovManager;
  }

  /**
   * Shutdown the integration layer
   */
  public async shutdown(): Promise<void> {
    await this.markovManager.shutdown();
    this.isInitialized = false;
    
    logger.info('BehavioralIntegration shutdown complete');
  }

  /**
   * Calculate behavioral risk score
   */
  private calculateBehavioralRiskScore(
    anomalyResult: SequenceAnomalyResult, 
    prediction: any, 
    journey: UserJourney
  ): BehavioralRiskScore {
    let riskScore = 0;

    // Sequence anomaly contribution
    riskScore += anomalyResult.anomalyScore * this.riskWeights.sequenceAnomaly;

    // Pattern deviation contribution
    if (prediction.isAnomalous) {
      riskScore += prediction.anomalyScore * this.riskWeights.patternDeviation;
    }

    // Transition risk contribution
    const transitionRisk = prediction.nextStates.length > 0 ? 
      1 - prediction.nextStates[0].probability : 0.5;
    riskScore += transitionRisk * this.riskWeights.transitionRisk;

    // Context violation contribution
    if (anomalyResult.anomalyType === 'context_mismatch') {
      riskScore += 0.8 * this.riskWeights.contextViolation;
    }

    // Journey-based risk factors
    if (journey && journey.isAnomalous) {
      riskScore += journey.riskScore * 0.2;
    }

    // Clamp to 0-1 range
    riskScore = Math.min(Math.max(riskScore, 0), 1);

    const riskLevel = this.determineRiskLevel(riskScore);
    const confidence = Math.min(0.95, anomalyResult.confidence + 0.1);

    const contributingFactors = [
      {
        factor: 'sequence_anomaly' as const,
        weight: this.riskWeights.sequenceAnomaly,
        description: `Sequence anomaly score: ${anomalyResult.anomalyScore.toFixed(2)}`,
        severity: anomalyResult.anomalyScore
      }
    ];

    if (prediction.isAnomalous) {
      contributingFactors.push({
        factor: 'pattern_deviation' as const,
        weight: this.riskWeights.patternDeviation,
        description: `Pattern deviation detected`,
        severity: prediction.anomalyScore
      });
    }

    return {
      score: riskScore,
      confidence,
      riskLevel,
      contributingFactors,
      recommendations: anomalyResult.recommendations,
      historicalComparison: {
        userAverage: 0.3,
        globalAverage: 0.25,
        percentile: riskScore > 0.5 ? 0.8 : 0.4
      }
    };
  }

  /**
   * Generate threat indicators from anomaly results
   */
  private generateThreatIndicators(
    anomalyResult: SequenceAnomalyResult, 
    journey: UserJourney | null
  ): BehavioralSequenceData['threatIndicators'] {
    const indicators: BehavioralSequenceData['threatIndicators'] = [];

    if (anomalyResult.isAnomalous) {
      indicators.push({
        type: anomalyResult.anomalyType,
        severity: anomalyResult.severity,
        description: anomalyResult.description,
        confidence: anomalyResult.confidence
      });
    }

    if (journey && journey.isAnomalous) {
      indicators.push({
        type: 'sequence_anomaly',
        severity: journey.riskScore > 0.8 ? 'critical' : 'high',
        description: `Anomalous user journey detected`,
        confidence: 0.8
      });
    }

    return indicators;
  }

  /**
   * Generate recommendations based on risk assessment
   */
  private generateRecommendations(
    anomalyResult: SequenceAnomalyResult, 
    behavioralRisk: BehavioralRiskScore
  ): string[] {
    const recommendations: string[] = [];

    if (behavioralRisk.riskLevel === 'critical') {
      recommendations.push('Immediate investigation required - critical behavioral anomaly detected');
      recommendations.push('Consider blocking or restricting session access');
    } else if (behavioralRisk.riskLevel === 'high') {
      recommendations.push('Monitor session closely for escalation');
      recommendations.push('Consider additional authentication challenges');
    } else if (behavioralRisk.riskLevel === 'medium') {
      recommendations.push('Continue monitoring behavioral patterns');
      recommendations.push('Log detailed activity for analysis');
    }

    // Add specific recommendations from anomaly analysis
    recommendations.push(...anomalyResult.recommendations);

    return recommendations;
  }

  /**
   * Calculate journey-based risk score
   */
  private calculateJourneyRiskScore(journey: UserJourney): number {
    let riskScore = journey.riskScore || 0;

    // Factor in journey completion
    if (!journey.isCompleted && journey.path.length > 5) {
      riskScore += 0.1; // Incomplete long journeys are suspicious
    }

    // Factor in deviations
    riskScore += journey.deviations.length * 0.05;

    // Factor in anomalous flag
    if (journey.isAnomalous) {
      riskScore += 0.3;
    }

    return Math.min(Math.max(riskScore, 0), 1);
  }

  /**
   * Identify risk factors from journey
   */
  private identifyRiskFactors(journey: UserJourney): BehavioralRiskScore['contributingFactors'] {
    const factors: BehavioralRiskScore['contributingFactors'] = [];

    if (journey.isAnomalous) {
      factors.push({
        factor: 'pattern_deviation',
        weight: 0.4,
        description: 'Anomalous user journey pattern detected',
        severity: journey.riskScore || 0.5
      });
    }

    if (journey.deviations.length > 0) {
      factors.push({
        factor: 'sequence_anomaly',
        weight: 0.3,
        description: `${journey.deviations.length} behavioral deviations detected`,
        severity: journey.deviations.length * 0.1
      });
    }

    if (!journey.isCompleted && journey.path.length > 5) {
      factors.push({
        factor: 'pattern_deviation',
        weight: 0.2,
        description: 'Incomplete long journey - potential abandonment',
        severity: 0.3
      });
    }

    return factors;
  }

  /**
   * Generate journey-specific recommendations
   */
  private generateJourneyRecommendations(journey: UserJourney): string[] {
    const recommendations: string[] = [];

    if (journey.isAnomalous) {
      recommendations.push('Investigate anomalous journey pattern');
    }

    if (journey.deviations.length > 3) {
      recommendations.push('High number of behavioral deviations - potential bot activity');
    }

    if (!journey.isCompleted) {
      recommendations.push('Monitor for journey completion or abandonment patterns');
    }

    return recommendations;
  }

  /**
   * Calculate overall threat risk from indicators
   */
  private calculateOverallThreatRisk(indicators: any[]): number {
    if (indicators.length === 0) return 0;

    const severityWeights = { low: 0.2, medium: 0.5, high: 0.8, critical: 1.0 };
    let totalRisk = 0;
    let totalWeight = 0;

    for (const indicator of indicators) {
      const weight = severityWeights[indicator.severity] * indicator.confidence;
      totalRisk += weight;
      totalWeight += indicator.confidence;
    }

    return totalWeight > 0 ? Math.min(totalRisk / totalWeight, 1) : 0;
  }

  /**
   * Generate threat summary
   */
  private generateThreatSummary(indicators: any[], overallRisk: number): string {
    if (indicators.length === 0) {
      return 'No behavioral threats detected';
    }

    const criticalCount = indicators.filter(i => i.severity === 'critical').length;
    const highCount = indicators.filter(i => i.severity === 'high').length;

    if (criticalCount > 0) {
      return `Critical behavioral threats detected: ${criticalCount} critical, ${highCount} high severity indicators`;
    } else if (highCount > 0) {
      return `High behavioral threats detected: ${highCount} high severity indicators`;
    } else {
      return `Moderate behavioral anomalies detected: ${indicators.length} indicators`;
    }
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score > 0.8) return 'critical';
    if (score > 0.6) return 'high';
    if (score > 0.4) return 'medium';
    return 'low';
  }

  /**
   * Get default behavioral data for fallback
   */
  private getDefaultBehavioralData(): BehavioralSequenceData {
    return {
      riskScore: 0,
      anomalyScore: 0,
      confidence: 0.5,
      riskLevel: 'low',
      behavioralState: 'unknown',
      predictedNextStates: [],
      anomalyDetails: null,
      journey: null,
      insights: [],
      recommendations: ['Unable to analyze behavioral sequence'],
      threatIndicators: []
    };
  }
}
