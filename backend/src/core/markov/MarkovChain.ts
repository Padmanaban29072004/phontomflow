import { logger } from '@/utils/logger';
import {
  MarkovOrder,
  BehavioralState,
  StateTransition,
  TransitionMatrix,
  MarkovChainConfig,
  SequencePrediction,
  TransitionProbability,
  BehavioralContext,
  SequenceValidationResult
} from '@/types/markov';

/**
 * Core Markov Chain implementation for behavioral sequence modeling
 * Supports 1st, 2nd, and 3rd order chains with real-time learning
 */
export class MarkovChain {
  private config: MarkovChainConfig;
  private transitionMatrix: TransitionMatrix;
  private stateEncoder: Map<string, string> = new Map();
  private stateDecoder: Map<string, string> = new Map();
  private stateCounter: number = 0;

  constructor(config: MarkovChainConfig) {
    this.config = config;
    this.transitionMatrix = this.initializeTransitionMatrix();
  }

  /**
   * Learn from a sequence of behavioral states
   */
  public learnSequence(sequence: BehavioralState[]): void {
    if (sequence.length < this.config.order + 1) {
      logger.debug('Sequence too short for learning', { 
        sequenceLength: sequence.length, 
        requiredLength: this.config.order + 1 
      });
      return;
    }

    try {
      // Convert states to encoded strings
      const encodedStates = sequence.map(state => this.encodeState(state));

      // Learn transitions based on chain order
      for (let i = 0; i <= encodedStates.length - this.config.order - 1; i++) {
        const context = this.buildContext(encodedStates, i);
        const nextState = encodedStates[i + this.config.order];
        
        this.updateTransition(context, nextState, sequence[i + this.config.order]);
      }

      this.transitionMatrix.totalTransitions++;
      this.transitionMatrix.lastUpdated = new Date();

      // Perform pruning if needed
      if (this.shouldPrune()) {
        this.pruneTransitions();
      }

    } catch (error) {
      logger.error('Error learning sequence:', error);
    }
  }

  /**
   * Predict next possible states given current context
   */
  public predictNext(recentStates: BehavioralState[]): SequencePrediction {
    try {
      if (recentStates.length < this.config.order) {
        return this.getDefaultPrediction('Insufficient context for prediction');
      }

      // Encode recent states
      const encodedStates = recentStates.slice(-this.config.order).map(state => this.encodeState(state));
      const context = encodedStates.join('|');

      // Get transitions from this context
      const transitions = this.transitionMatrix.transitions.get(context);
      if (!transitions || transitions.size === 0) {
        return this.getDefaultPrediction('No learned transitions for this context');
      }

      // Sort transitions by probability
      const sortedTransitions = Array.from(transitions.entries())
        .map(([state, transition]) => ({
          state: this.decodeState(state),
          probability: transition.probability,
          confidence: transition.confidence,
          metadata: {
            historicalCount: transition.count,
            avgDuration: transition.metadata.avgDuration,
            riskLevel: this.calculateRiskLevel(transition),
            contexts: transition.metadata.contexts
          }
        }))
        .sort((a, b) => b.probability - a.probability);

      // Calculate overall prediction confidence
      const totalProbability = sortedTransitions.reduce((sum, t) => sum + t.probability, 0);
      const predictionConfidence = totalProbability > 0 ? 
        sortedTransitions[0].probability / totalProbability : 0;

      // Calculate anomaly score
      const anomalyScore = this.calculateAnomalyScore(sortedTransitions);
      const isAnomalous = anomalyScore > 0.7;

      return {
        nextStates: sortedTransitions.slice(0, 5), // Top 5 predictions
        predictionConfidence,
        anomalyScore,
        isAnomalous,
        reasoning: this.generateReasoning(sortedTransitions, context),
        alternatives: this.generateAlternatives(context)
      };

    } catch (error) {
      logger.error('Error predicting next state:', error);
      return this.getDefaultPrediction('Prediction error occurred');
    }
  }

  /**
   * Validate a sequence against learned patterns
   */
  public validateSequence(sequence: BehavioralState[]): SequenceValidationResult {
    const violations: SequenceValidationResult['violations'] = [];
    const suggestions: string[] = [];
    const alternativeSequences: string[][] = [];

    try {
      if (sequence.length < 2) {
        return {
          isValid: true,
          confidence: 0.5,
          violations: [],
          suggestions: ['Sequence too short for validation'],
          alternativeSequences: []
        };
      }

      const encodedStates = sequence.map(state => this.encodeState(state));

      // Check each transition in the sequence
      for (let i = 0; i <= encodedStates.length - this.config.order - 1; i++) {
        const context = this.buildContext(encodedStates, i);
        const nextState = encodedStates[i + this.config.order];
        
        const transitions = this.transitionMatrix.transitions.get(context);
        const transition = transitions?.get(nextState);

        if (!transition) {
          violations.push({
            type: 'impossible_transition',
            description: `No learned transition from ${context} to ${this.decodeState(nextState)}`,
            severity: 'high',
            position: i + this.config.order,
            actual: this.decodeState(nextState)
          });
        } else if (transition.probability < 0.1) {
          violations.push({
            type: 'impossible_transition',
            description: `Very low probability transition (${transition.probability.toFixed(3)})`,
            severity: 'medium',
            position: i + this.config.order,
            actual: this.decodeState(nextState)
          });
        }

        // Check timing violations
        if (i > 0) {
          const timingViolation = this.checkTimingViolation(sequence[i], sequence[i + 1]);
          if (timingViolation) {
            violations.push(timingViolation);
          }
        }
      }

      const isValid = violations.filter(v => v.severity === 'high' || v.severity === 'critical').length === 0;
      const confidence = Math.max(0, 1 - (violations.length * 0.2));

      return {
        isValid,
        confidence,
        violations,
        suggestions,
        alternativeSequences
      };

    } catch (error) {
      logger.error('Error validating sequence:', error);
      return {
        isValid: false,
        confidence: 0,
        violations: [{
          type: 'order_violation',
          description: 'Validation error occurred',
          severity: 'critical',
          position: 0,
          actual: 'error'
        }],
        suggestions: [],
        alternativeSequences: []
      };
    }
  }

  /**
   * Get transition probability between two states
   */
  public getTransitionProbability(from: string, to: string): TransitionProbability {
    const transitions = this.transitionMatrix.transitions.get(from);
    const transition = transitions?.get(to);
    return transition?.probability || 0;
  }

  /**
   * Get all learned states
   */
  public getStates(): string[] {
    return Array.from(this.transitionMatrix.states);
  }

  /**
   * Get transition matrix statistics
   */
  public getStatistics(): {
    totalStates: number;
    totalTransitions: number;
    averageTransitionsPerState: number;
    memoryUsage: number;
    lastUpdated: Date;
  } {
    const totalStates = this.transitionMatrix.states.size;
    const totalTransitions = Array.from(this.transitionMatrix.transitions.values())
      .reduce((sum, transitions) => sum + transitions.size, 0);

    return {
      totalStates,
      totalTransitions,
      averageTransitionsPerState: totalStates > 0 ? totalTransitions / totalStates : 0,
      memoryUsage: this.calculateMemoryUsage(),
      lastUpdated: this.transitionMatrix.lastUpdated
    };
  }

  /**
   * Serialize the Markov chain for persistence
   */
  public serialize(): string {
    const data = {
      config: this.config,
      transitionMatrix: {
        order: this.transitionMatrix.order,
        states: Array.from(this.transitionMatrix.states),
        transitions: Array.from(this.transitionMatrix.transitions.entries()).map(([context, transitions]) => ({
          context,
          transitions: Array.from(transitions.entries())
        })),
        totalTransitions: this.transitionMatrix.totalTransitions,
        lastUpdated: this.transitionMatrix.lastUpdated,
        pruningThreshold: this.transitionMatrix.pruningThreshold
      },
      stateEncoder: Array.from(this.stateEncoder.entries()),
      stateDecoder: Array.from(this.stateDecoder.entries()),
      stateCounter: this.stateCounter
    };

    return JSON.stringify(data);
  }

  /**
   * Deserialize and restore Markov chain from persistence
   */
  public static deserialize(serializedData: string): MarkovChain {
    try {
      const data = JSON.parse(serializedData);
      
      const markov = new MarkovChain(data.config);
      
      // Restore state encoders/decoders
      markov.stateEncoder = new Map(data.stateEncoder);
      markov.stateDecoder = new Map(data.stateDecoder);
      markov.stateCounter = data.stateCounter;

      // Restore transition matrix
      markov.transitionMatrix.order = data.transitionMatrix.order;
      markov.transitionMatrix.states = new Set(data.transitionMatrix.states);
      markov.transitionMatrix.totalTransitions = data.transitionMatrix.totalTransitions;
      markov.transitionMatrix.lastUpdated = new Date(data.transitionMatrix.lastUpdated);
      markov.transitionMatrix.pruningThreshold = data.transitionMatrix.pruningThreshold;

      // Restore transitions
      for (const { context, transitions } of data.transitionMatrix.transitions) {
        const transitionMap = new Map<string, StateTransition>();
        for (const [state, transition] of transitions) {
          transitionMap.set(state, {
            ...transition,
            lastSeen: new Date(transition.lastSeen)
          });
        }
        markov.transitionMatrix.transitions.set(context, transitionMap);
      }

      return markov;

    } catch (error) {
      logger.error('Error deserializing Markov chain:', error);
      throw error;
    }
  }

  /**
   * Clear all learned data
   */
  public clear(): void {
    this.transitionMatrix = this.initializeTransitionMatrix();
    this.stateEncoder.clear();
    this.stateDecoder.clear();
    this.stateCounter = 0;
  }

  /**
   * Initialize empty transition matrix
   */
  private initializeTransitionMatrix(): TransitionMatrix {
    return {
      order: this.config.order,
      states: new Set(),
      transitions: new Map(),
      totalTransitions: 0,
      lastUpdated: new Date(),
      pruningThreshold: this.config.pruningThreshold
    };
  }

  /**
   * Encode behavioral state to string representation
   */
  private encodeState(state: BehavioralState): string {
    const key = `${state.action}:${state.context}`;
    
    if (!this.stateEncoder.has(key)) {
      const encodedKey = `S${this.stateCounter++}`;
      this.stateEncoder.set(key, encodedKey);
      this.stateDecoder.set(encodedKey, key);
      this.transitionMatrix.states.add(encodedKey);
    }

    return this.stateEncoder.get(key)!;
  }

  /**
   * Decode state string back to readable format
   */
  private decodeState(encodedState: string): string {
    return this.stateDecoder.get(encodedState) || encodedState;
  }

  /**
   * Build context string for N-order chain
   */
  private buildContext(encodedStates: string[], startIndex: number): string {
    const contextStates = encodedStates.slice(startIndex, startIndex + this.config.order);
    return contextStates.join('|');
  }

  /**
   * Update transition in the matrix
   */
  private updateTransition(context: string, nextState: string, stateData: BehavioralState): void {
    if (!this.transitionMatrix.transitions.has(context)) {
      this.transitionMatrix.transitions.set(context, new Map());
    }

    const transitions = this.transitionMatrix.transitions.get(context)!;
    
    if (!transitions.has(nextState)) {
      transitions.set(nextState, {
        from: context,
        to: nextState,
        probability: 0,
        count: 0,
        lastSeen: new Date(),
        confidence: 0,
        metadata: {
          avgDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          contexts: [],
          riskFactors: []
        }
      });
    }

    const transition = transitions.get(nextState)!;
    transition.count++;
    transition.lastSeen = new Date();

    // Update duration statistics
    const duration = stateData.metadata.duration || 0;
    if (duration > 0) {
      transition.metadata.avgDuration = (transition.metadata.avgDuration * (transition.count - 1) + duration) / transition.count;
      transition.metadata.minDuration = Math.min(transition.metadata.minDuration, duration);
      transition.metadata.maxDuration = Math.max(transition.metadata.maxDuration, duration);
    }

    // Update contexts
    if (!transition.metadata.contexts.includes(stateData.context)) {
      transition.metadata.contexts.push(stateData.context);
    }

    // Recalculate probabilities for this context
    this.updateProbabilities(context);
  }

  /**
   * Update probabilities for all transitions from a context
   */
  private updateProbabilities(context: string): void {
    const transitions = this.transitionMatrix.transitions.get(context);
    if (!transitions) return;

    const totalCount = Array.from(transitions.values()).reduce((sum, t) => sum + t.count, 0);
    
    for (const transition of transitions.values()) {
      // Apply Laplace smoothing
      transition.probability = (transition.count + this.config.smoothingParameter) / 
                              (totalCount + this.config.smoothingParameter * transitions.size);
      
      // Calculate confidence based on count and recency
      const recencyFactor = this.calculateRecencyFactor(transition.lastSeen);
      transition.confidence = Math.min(0.95, (transition.count / 100) * recencyFactor);
    }
  }

  /**
   * Calculate recency factor for confidence
   */
  private calculateRecencyFactor(lastSeen: Date): number {
    const hoursSince = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60);
    return Math.exp(-hoursSince / (24 * 7)); // Decay over a week
  }

  /**
   * Check if pruning is needed
   */
  private shouldPrune(): boolean {
    return this.transitionMatrix.states.size > this.config.maxStates ||
           this.calculateMemoryUsage() > this.config.memoryLimit;
  }

  /**
   * Prune low-frequency transitions
   */
  private pruneTransitions(): void {
    let prunedCount = 0;

    for (const [context, transitions] of this.transitionMatrix.transitions.entries()) {
      const toRemove: string[] = [];

      for (const [state, transition] of transitions.entries()) {
        if (transition.count < this.config.pruningThreshold) {
          toRemove.push(state);
        }
      }

      for (const state of toRemove) {
        transitions.delete(state);
        prunedCount++;
      }

      if (transitions.size === 0) {
        this.transitionMatrix.transitions.delete(context);
      }
    }

    logger.debug(`Pruned ${prunedCount} low-frequency transitions`);
  }

  /**
   * Calculate memory usage in bytes
   */
  private calculateMemoryUsage(): number {
    // Rough estimation
    const stateMemory = this.transitionMatrix.states.size * 50; // 50 bytes per state
    const transitionMemory = Array.from(this.transitionMatrix.transitions.values())
      .reduce((sum, transitions) => sum + transitions.size * 200, 0); // 200 bytes per transition
    
    return stateMemory + transitionMemory;
  }

  /**
   * Calculate risk level for a transition
   */
  private calculateRiskLevel(transition: StateTransition): 'low' | 'medium' | 'high' | 'critical' {
    if (transition.metadata.contexts.includes('suspicious')) return 'critical';
    if (transition.metadata.contexts.includes('restricted')) return 'high';
    if (transition.probability < 0.1) return 'medium';
    return 'low';
  }

  /**
   * Calculate anomaly score for predictions
   */
  private calculateAnomalyScore(predictions: any[]): number {
    if (predictions.length === 0) return 1.0;
    
    const topProbability = predictions[0].probability;
    const entropy = predictions.reduce((sum, p) => {
      if (p.probability > 0) {
        return sum - p.probability * Math.log2(p.probability);
      }
      return sum;
    }, 0);

    // High entropy or very low top probability indicates anomaly
    return Math.min(1.0, (entropy / Math.log2(predictions.length)) + (1 - topProbability));
  }

  /**
   * Generate reasoning for predictions
   */
  private generateReasoning(predictions: any[], context: string): string[] {
    const reasoning: string[] = [];
    
    if (predictions.length === 0) {
      reasoning.push('No historical data for this behavior sequence');
    } else {
      reasoning.push(`Based on ${predictions[0].metadata.historicalCount} similar sequences`);
      reasoning.push(`Confidence: ${(predictions[0].confidence * 100).toFixed(1)}%`);
      
      if (predictions[0].probability < 0.3) {
        reasoning.push('Low probability indicates unusual behavior');
      }
    }

    return reasoning;
  }

  /**
   * Generate alternative sequences
   */
  private generateAlternatives(_context: string): string[] {
    // Simplified implementation - return empty for now
    return [];
  }

  /**
   * Get default prediction when no data available
   */
  private getDefaultPrediction(reason: string): SequencePrediction {
    return {
      nextStates: [],
      predictionConfidence: 0,
      anomalyScore: 0.5,
      isAnomalous: false,
      reasoning: [reason],
      alternatives: []
    };
  }

  /**
   * Check for timing violations between states
   */
  private checkTimingViolation(state1: BehavioralState, state2: BehavioralState): SequenceValidationResult['violations'][0] | null {
    const timeDiff = state2.timestamp.getTime() - state1.timestamp.getTime();
    
    // Check for impossible timing (e.g., events too close together)
    if (timeDiff < 100) { // Less than 100ms
      return {
        type: 'timing_violation',
        description: `Events too close together: ${timeDiff}ms`,
        severity: 'medium',
        position: 0,
        actual: `${timeDiff}ms`
      };
    }

    return null;
  }
}
