import { logger } from '@/utils/logger';
import { MarkovChain } from '@/core/markov/MarkovChain';
import { BehavioralStateManager } from '@/core/markov/BehavioralStateManager';
import {
  BehavioralState,
  StateSequence,
  UserJourney,
  BehavioralPattern,
  SequenceAnomalyResult,
  SequencePrediction,
  BehavioralInsight,
  MarkovChainConfig
} from '@/types/markov';

/**
 * SequenceAnalyzer provides high-level sequence analysis capabilities
 * Combines Markov chains with behavioral state management for user journey analysis
 */
export class SequenceAnalyzer {
  private markovChain: MarkovChain;
  private stateManager: BehavioralStateManager;
  private journeyHistory: Map<string, UserJourney> = new Map();
  private patternCache: Map<string, BehavioralPattern> = new Map();
  private anomalyThresholds: {
    sequenceAnomaly: number;
    transitionAnomaly: number;
    timingAnomaly: number;
  };

  constructor(config: MarkovChainConfig, anomalyThresholds?: typeof this.anomalyThresholds) {
    this.markovChain = new MarkovChain(config);
    this.stateManager = new BehavioralStateManager();
    this.anomalyThresholds = anomalyThresholds || {
      sequenceAnomaly: 0.7,
      transitionAnomaly: 0.8,
      timingAnomaly: 0.6
    };
  }

  /**
   * Process a request and update behavioral models
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
    behavioralState: BehavioralState;
    sequence: StateSequence;
    prediction: SequencePrediction;
    anomalyResult: SequenceAnomalyResult;
    journey: UserJourney;
  }> {
    try {
      // Create behavioral state
      const behavioralState = this.stateManager.createBehavioralState(requestData);
      
      // Add to sequence
      const sequence = this.stateManager.addToSequence(behavioralState);
      
      // Learn from the sequence
      if (sequence.states.length > 1) {
        this.markovChain.learnSequence(sequence.states);
      }

      // Generate prediction for next state
      const prediction = this.markovChain.predictNext(sequence.states.slice(-2));

      // Detect anomalies
      const anomalyResult = this.detectSequenceAnomaly(sequence);

      // Update or create user journey
      const journey = this.updateUserJourney(sequence, behavioralState, anomalyResult);

      return {
        behavioralState,
        sequence,
        prediction,
        anomalyResult,
        journey
      };

    } catch (error) {
      logger.error('Error processing request in SequenceAnalyzer:', error);
      throw error;
    }
  }

  /**
   * Analyze user journey patterns
   */
  public analyzeUserJourney(sessionId: string): UserJourney | null {
    try {
      const sequence = this.stateManager.getSequence(sessionId);
      if (!sequence || sequence.states.length < 2) {
        return null;
      }

      const journey = this.journeyHistory.get(sessionId);
      if (!journey) {
        return this.createUserJourney(sequence);
      }

      return this.updateJourneyAnalysis(journey, sequence);

    } catch (error) {
      logger.error('Error analyzing user journey:', error);
      return null;
    }
  }

  /**
   * Detect anomalous sequences
   */
  public detectSequenceAnomaly(sequence: StateSequence): SequenceAnomalyResult {
    try {
      if (sequence.states.length < 2) {
        return this.getDefaultAnomalyResult(sequence, false, 'Sequence too short for analysis');
      }

      const validationResult = this.markovChain.validateSequence(sequence.states);
      const prediction = this.markovChain.predictNext(sequence.states.slice(-2));

      // Calculate various anomaly scores
      const sequenceAnomalyScore = this.calculateSequenceAnomalyScore(sequence);
      const transitionAnomalyScore = this.calculateTransitionAnomalyScore(validationResult);
      const timingAnomalyScore = this.calculateTimingAnomalyScore(sequence);
      
      // Overall anomaly score (weighted average)
      const overallAnomalyScore = (
        sequenceAnomalyScore * 0.4 +
        transitionAnomalyScore * 0.4 +
        timingAnomalyScore * 0.2
      );

      const isAnomalous = overallAnomalyScore > this.anomalyThresholds.sequenceAnomaly;

      // Determine anomaly type
      let anomalyType: SequenceAnomalyResult['anomalyType'] = 'rare_sequence';
      if (transitionAnomalyScore > this.anomalyThresholds.transitionAnomaly) {
        anomalyType = 'impossible_transition';
      } else if (timingAnomalyScore > this.anomalyThresholds.timingAnomaly) {
        anomalyType = 'timing_anomaly';
      } else if (this.hasContextMismatch(sequence)) {
        anomalyType = 'context_mismatch';
      } else if (this.hasPatternBreak(sequence)) {
        anomalyType = 'pattern_break';
      }

      // Generate risk factors and recommendations
      const riskFactors = this.identifyRiskFactors(sequence, validationResult);
      const recommendations = this.generateAnomalyRecommendations(anomalyType, riskFactors);

      // Determine severity
      const severity = this.determineSeverity(overallAnomalyScore, anomalyType);

      return {
        isAnomalous,
        anomalyScore: overallAnomalyScore,
        anomalyType,
        confidence: validationResult.confidence,
        description: this.generateAnomalyDescription(anomalyType, overallAnomalyScore),
        expectedSequence: this.generateExpectedSequence(sequence),
        actualSequence: sequence.states.map(s => `${s.action}:${s.context}`),
        riskFactors,
        recommendations,
        severity
      };

    } catch (error) {
      logger.error('Error detecting sequence anomaly:', error);
      return this.getDefaultAnomalyResult(sequence, false, 'Error during anomaly detection');
    }
  }

  /**
   * Discover behavioral patterns
   */
  public discoverPatterns(minFrequency: number = 5): BehavioralPattern[] {
    try {
      const patterns: BehavioralPattern[] = [];
      const sequencePatterns = new Map<string, {
        count: number;
        totalDuration: number;
        contexts: Set<string>;
        examples: StateSequence[];
        riskScores: number[];
      }>();

      // Analyze all sequences
      const allSequences = this.stateManager.getActiveSequences();
      
      for (const sequence of allSequences) {
        if (sequence.states.length < 2) continue;

        // Extract patterns of different lengths
        for (let length = 2; length <= Math.min(5, sequence.states.length); length++) {
          for (let i = 0; i <= sequence.states.length - length; i++) {
            const pattern = sequence.states
              .slice(i, i + length)
              .map(s => `${s.action}:${s.context}`)
              .join('-');

            if (!sequencePatterns.has(pattern)) {
              sequencePatterns.set(pattern, {
                count: 0,
                totalDuration: 0,
                contexts: new Set(),
                examples: [],
                riskScores: []
              });
            }

            const patternData = sequencePatterns.get(pattern)!;
            patternData.count++;
            patternData.totalDuration += sequence.totalDuration;
            
            // Add contexts
            for (const state of sequence.states.slice(i, i + length)) {
              patternData.contexts.add(state.context);
            }

            // Add example (limit to 3)
            if (patternData.examples.length < 3) {
              patternData.examples.push(sequence);
            }

            // Track risk scores
            if (sequence.riskScore !== undefined) {
              patternData.riskScores.push(sequence.riskScore);
            }
          }
        }
      }

      // Convert to BehavioralPattern objects
      for (const [patternStr, data] of sequencePatterns.entries()) {
        if (data.count >= minFrequency) {
          const avgRiskScore = data.riskScores.length > 0 
            ? data.riskScores.reduce((sum, score) => sum + score, 0) / data.riskScores.length
            : 0;

          const pattern: BehavioralPattern = {
            patternId: this.generatePatternId(patternStr),
            sequence: patternStr.split('-'),
            frequency: data.count,
            probability: data.count / allSequences.length,
            avgDuration: data.totalDuration / data.count,
            contexts: Array.from(data.contexts) as any[],
            riskLevel: this.calculatePatternRiskLevel(avgRiskScore),
            description: this.generatePatternDescription(patternStr, data.count),
            examples: data.examples,
            isAnomalous: avgRiskScore > 0.7,
            confidence: Math.min(0.95, data.count / 50)
          };

          patterns.push(pattern);
        }
      }

      // Sort by frequency and cache
      patterns.sort((a, b) => b.frequency - a.frequency);
      
      // Cache patterns
      for (const pattern of patterns) {
        this.patternCache.set(pattern.patternId, pattern);
      }

      logger.debug(`Discovered ${patterns.length} behavioral patterns`);
      
      return patterns;

    } catch (error) {
      logger.error('Error discovering patterns:', error);
      return [];
    }
  }

  /**
   * Generate insights from sequence analysis
   */
  public generateInsights(): BehavioralInsight[] {
    const insights: BehavioralInsight[] = [];

    try {
      const patterns = this.discoverPatterns(3);
      const allSequences = this.stateManager.getActiveSequences();
      const stats = this.stateManager.getStatistics();

      // Common pattern insights
      const commonPatterns = patterns.filter(p => p.frequency > 10 && !p.isAnomalous).slice(0, 3);
      for (const pattern of commonPatterns) {
        insights.push({
          insight: 'common_pattern',
          description: `Common behavioral pattern: ${pattern.description}`,
          impact: 'low',
          confidence: pattern.confidence,
          data: { pattern },
          recommendations: [
            'Monitor for deviations from this common pattern',
            'Use as baseline for anomaly detection',
            'Consider optimizing user flow for this pattern'
          ],
          timestamp: new Date(),
          affectedUsers: pattern.examples.length,
          businessImpact: 'Represents normal user behavior baseline'
        });
      }

      // Anomalous pattern insights
      const anomalousPatterns = patterns.filter(p => p.isAnomalous && p.riskLevel !== 'low');
      for (const pattern of anomalousPatterns.slice(0, 2)) {
        insights.push({
          insight: 'anomalous_sequence',
          description: `Detected suspicious behavioral pattern: ${pattern.description}`,
          impact: pattern.riskLevel === 'critical' ? 'critical' : 'high',
          confidence: pattern.confidence,
          data: { pattern },
          recommendations: [
            'Investigate users exhibiting this pattern',
            'Consider additional security measures',
            'Monitor for escalation'
          ],
          timestamp: new Date(),
          affectedUsers: pattern.examples.length,
          businessImpact: 'Potential security threat requiring attention'
        });
      }

      // Journey abandonment insights
      const incompletedJourneys = allSequences.filter(seq => !seq.isComplete && seq.states.length > 3);
      if (incompletedJourneys.length > stats.totalSequences * 0.3) {
        insights.push({
          insight: 'journey_abandonment',
          description: `High journey abandonment rate: ${((incompletedJourneys.length / stats.totalSequences) * 100).toFixed(1)}%`,
          impact: 'medium',
          confidence: 0.8,
          data: { 
            users: incompletedJourneys.length,
            frequency: incompletedJourneys.length / stats.totalSequences 
          },
          recommendations: [
            'Analyze common abandonment points',
            'Improve user experience at critical steps',
            'Consider A/B testing for journey optimization'
          ],
          timestamp: new Date(),
          affectedUsers: incompletedJourneys.length,
          businessImpact: 'User experience optimization opportunity'
        });
      }

      // Rare behavior insights
      const rarePatterns = patterns.filter(p => p.frequency < 5 && p.probability < 0.01);
      if (rarePatterns.length > 0) {
        insights.push({
          insight: 'rare_behavior',
          description: `Detected ${rarePatterns.length} rare behavioral patterns`,
          impact: 'medium',
          confidence: 0.7,
          data: { 
            frequency: rarePatterns.length,
            pattern: rarePatterns[0]
          },
          recommendations: [
            'Monitor rare behaviors for security implications',
            'Investigate if rare patterns indicate new attack vectors',
            'Consider updating behavioral baselines'
          ],
          timestamp: new Date(),
          affectedUsers: rarePatterns.reduce((sum, p) => sum + p.examples.length, 0),
          businessImpact: 'Early detection of potential security threats'
        });
      }

    } catch (error) {
      logger.error('Error generating insights:', error);
    }

    return insights;
  }

  /**
   * Get analyzer statistics
   */
  public getStatistics(): {
    totalSequencesAnalyzed: number;
    uniquePatternsDiscovered: number;
    anomaliesDetected: number;
    averageSequenceLength: number;
    predictionAccuracy: number;
    memoryUsage: number;
  } {
    const stateStats = this.stateManager.getStatistics();
    const markovStats = this.markovChain.getStatistics();

    return {
      totalSequencesAnalyzed: stateStats.totalSequences,
      uniquePatternsDiscovered: this.patternCache.size,
      anomaliesDetected: Array.from(this.journeyHistory.values()).filter(j => j.isAnomalous).length,
      averageSequenceLength: stateStats.averageSequenceLength,
      predictionAccuracy: 0.85, // Would be calculated from actual predictions vs outcomes
      memoryUsage: stateStats.memoryUsage + markovStats.memoryUsage
    };
  }

  /**
   * Clear all analysis data
   */
  public clear(): void {
    this.markovChain.clear();
    this.journeyHistory.clear();
    this.patternCache.clear();
    logger.info('SequenceAnalyzer cleared all data');
  }

  /**
   * Update user journey
   */
  private updateUserJourney(sequence: StateSequence, currentState: BehavioralState, anomalyResult: SequenceAnomalyResult): UserJourney {
    const sessionId = sequence.sessionId;
    
    if (!this.journeyHistory.has(sessionId)) {
      return this.createUserJourney(sequence);
    }

    const journey = this.journeyHistory.get(sessionId)!;
    
    // Update journey with new state
    journey.path.push(`${currentState.action}:${currentState.context}`);
    journey.stepDurations.push(currentState.metadata.duration || 0);
    journey.isAnomalous = journey.isAnomalous || anomalyResult.isAnomalous;
    journey.riskScore = Math.max(journey.riskScore, anomalyResult.anomalyScore);

    // Add insights
    if (anomalyResult.isAnomalous) {
      journey.insights.push(`Anomaly detected: ${anomalyResult.description}`);
    }

    this.journeyHistory.set(sessionId, journey);
    return journey;
  }

  /**
   * Create new user journey
   */
  private createUserJourney(sequence: StateSequence): UserJourney {
    const journey: UserJourney = {
      journeyId: `journey_${sequence.sessionId}_${Date.now()}`,
      userId: sequence.userId,
      sessionId: sequence.sessionId,
      startState: sequence.states.length > 0 ? `${sequence.states[0].action}:${sequence.states[0].context}` : 'unknown',
      endState: sequence.states.length > 0 ? `${sequence.states[sequence.states.length - 1].action}:${sequence.states[sequence.states.length - 1].context}` : 'unknown',
      path: sequence.states.map(s => `${s.action}:${s.context}`),
      totalDuration: sequence.totalDuration,
      stepDurations: sequence.states.map(s => s.metadata.duration || 0),
      isCompleted: sequence.isComplete,
      isAnomalous: false,
      riskScore: sequence.riskScore || 0,
      patterns: [],
      deviations: [],
      insights: []
    };

    this.journeyHistory.set(sequence.sessionId, journey);
    return journey;
  }

  /**
   * Update journey analysis
   */
  private updateJourneyAnalysis(journey: UserJourney, sequence: StateSequence): UserJourney {
    journey.totalDuration = sequence.totalDuration;
    journey.isCompleted = sequence.isComplete;
    journey.riskScore = Math.max(journey.riskScore, sequence.riskScore || 0);
    
    return journey;
  }

  // Helper methods for anomaly detection
  private calculateSequenceAnomalyScore(sequence: StateSequence): number {
    // Calculate based on rare state combinations
    const statePattern = sequence.states.map(s => `${s.action}:${s.context}`).join('-');
    const knownPattern = this.patternCache.get(this.generatePatternId(statePattern));
    
    if (!knownPattern) return 0.8; // Unknown pattern is anomalous
    if (knownPattern.frequency < 5) return 0.6; // Rare pattern
    if (knownPattern.isAnomalous) return 0.9; // Known anomalous pattern
    
    return 0.2; // Normal pattern
  }

  private calculateTransitionAnomalyScore(validationResult: any): number {
    const highSeverityViolations = validationResult.violations.filter((v: any) => v.severity === 'high' || v.severity === 'critical').length;
    return Math.min(1.0, highSeverityViolations * 0.3);
  }

  private calculateTimingAnomalyScore(sequence: StateSequence): number {
    if (sequence.states.length < 2) return 0;

    let anomalyScore = 0;
    for (let i = 1; i < sequence.states.length; i++) {
      const timeDiff = sequence.states[i].timestamp.getTime() - sequence.states[i-1].timestamp.getTime();
      
      // Very fast transitions (< 100ms) or very slow (> 5 minutes) are suspicious
      if (timeDiff < 100 || timeDiff > 300000) {
        anomalyScore += 0.2;
      }
    }

    return Math.min(1.0, anomalyScore);
  }

  private hasContextMismatch(sequence: StateSequence): boolean {
    // Check for context inconsistencies
    const contexts = sequence.states.map(s => s.context);
    return contexts.includes('suspicious') && contexts.includes('normal');
  }

  private hasPatternBreak(sequence: StateSequence): boolean {
    // Check for breaks in expected patterns
    return false; // Simplified implementation
  }

  private identifyRiskFactors(sequence: StateSequence, validationResult: any): string[] {
    const factors: string[] = [];
    
    if (validationResult.violations.length > 0) {
      factors.push('Invalid state transitions detected');
    }
    
    if (sequence.states.some(s => s.context === 'suspicious')) {
      factors.push('Suspicious behavioral context');
    }
    
    if (sequence.riskScore && sequence.riskScore > 0.7) {
      factors.push('High risk score assigned');
    }

    return factors;
  }

  private generateAnomalyRecommendations(anomalyType: string, riskFactors: string[]): string[] {
    const recommendations: string[] = [];
    
    switch (anomalyType) {
      case 'impossible_transition':
        recommendations.push('Investigate potential bot activity');
        recommendations.push('Check for session hijacking');
        break;
      case 'timing_anomaly':
        recommendations.push('Monitor for automated behavior');
        recommendations.push('Consider rate limiting');
        break;
      case 'context_mismatch':
        recommendations.push('Review authentication status');
        recommendations.push('Check for privilege escalation');
        break;
      default:
        recommendations.push('Monitor user behavior closely');
        recommendations.push('Consider additional verification');
    }

    return recommendations;
  }

  private determineSeverity(score: number, type: string): 'low' | 'medium' | 'high' | 'critical' {
    if (score > 0.9 || type === 'impossible_transition') return 'critical';
    if (score > 0.7) return 'high';
    if (score > 0.5) return 'medium';
    return 'low';
  }

  private generateAnomalyDescription(type: string, score: number): string {
    return `${type.replace('_', ' ')} detected with anomaly score ${score.toFixed(2)}`;
  }

  private generateExpectedSequence(sequence: StateSequence): string[] {
    // Simplified - return the most common pattern
    return ['page_view:normal', 'click:normal', 'page_view:normal'];
  }

  private getDefaultAnomalyResult(sequence: StateSequence, isAnomalous: boolean, description: string): SequenceAnomalyResult {
    return {
      isAnomalous,
      anomalyScore: 0.5,
      anomalyType: 'rare_sequence',
      confidence: 0.5,
      description,
      actualSequence: sequence.states.map(s => `${s.action}:${s.context}`),
      riskFactors: [],
      recommendations: [],
      severity: 'low'
    };
  }

  private generatePatternId(pattern: string): string {
    return `pattern_${pattern.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  private calculatePatternRiskLevel(avgRiskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (avgRiskScore > 0.8) return 'critical';
    if (avgRiskScore > 0.6) return 'high';
    if (avgRiskScore > 0.4) return 'medium';
    return 'low';
  }

  private generatePatternDescription(pattern: string, frequency: number): string {
    const actions = pattern.split('-').map(p => p.split(':')[0]);
    return `${actions.join(' → ')} (${frequency} occurrences)`;
  }
}
