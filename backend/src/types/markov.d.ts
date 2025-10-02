/**
 * Markov Chain Types and Interfaces for Behavioral Pattern Prediction
 * Supports 1st, 2nd, and 3rd order Markov chains for user behavior analysis
 */

export type BehavioralActionType = 
  | 'page_view' | 'page_exit' | 'redirect' | 'back_button' | 'refresh' | 'scroll'
  | 'login_attempt' | 'login_success' | 'login_failure' | 'logout' | 'session_timeout'
  | 'search' | 'click' | 'form_submit' | 'download' | 'upload' | 'api_call'
  | 'error_404' | 'error_500' | 'error_403' | 'timeout' | 'network_error'
  | 'rate_limit_hit' | 'suspicious_activity' | 'blocked_request' | 'captcha_challenge'
  | 'idle' | 'active' | 'focus_lost' | 'focus_gained' | 'tab_switch';

export type BehavioralContext = 'normal' | 'suspicious' | 'authenticated' | 'anonymous' | 'privileged' | 'restricted';

export type MarkovOrder = 1 | 2 | 3;

export type TransitionProbability = number; // 0.0 to 1.0

export interface BehavioralState {
  action: BehavioralActionType;
  context: BehavioralContext;
  timestamp: Date;
  metadata: {
    path?: string;
    method?: string;
    statusCode?: number;
    userAgent?: string;
    ipAddress?: string;
    sessionId?: string;
    userId?: string;
    duration?: number; // milliseconds
    errorType?: string;
    riskScore?: number;
  };
}

export interface StateSequence {
  states: BehavioralState[];
  sessionId: string;
  userId?: string;
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  isComplete: boolean;
  riskScore?: number;
}

export interface StateTransition {
  from: string; // State identifier
  to: string;   // State identifier
  probability: TransitionProbability;
  count: number;
  lastSeen: Date;
  confidence: number;
  metadata: {
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    contexts: BehavioralContext[];
    riskFactors: string[];
  };
}

export interface TransitionMatrix {
  order: MarkovOrder;
  states: Set<string>;
  transitions: Map<string, Map<string, StateTransition>>;
  totalTransitions: number;
  lastUpdated: Date;
  pruningThreshold: number;
}

export interface MarkovChainConfig {
  order: MarkovOrder;
  smoothingParameter: number; // Laplace smoothing (default: 1.0)
  pruningThreshold: number;   // Minimum transition count to keep (default: 5)
  maxStates: number;          // Maximum number of states to track
  memoryLimit: number;        // Memory limit in MB
  persistenceInterval: number; // Milliseconds between saves
  stateExpiryHours: number;   // Hours after which unused states expire
  minConfidenceThreshold: number; // Minimum confidence for predictions
}

export interface SequencePrediction {
  nextStates: Array<{
    state: string;
    probability: TransitionProbability;
    confidence: number;
    metadata: {
      historicalCount: number;
      avgDuration: number;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      contexts: BehavioralContext[];
    };
  }>;
  predictionConfidence: number;
  anomalyScore: number;
  isAnomalous: boolean;
  reasoning: string[];
  alternatives: string[]; // Alternative likely sequences
}

export interface BehavioralPattern {
  patternId: string;
  sequence: string[];
  frequency: number;
  probability: number;
  avgDuration: number;
  contexts: BehavioralContext[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  examples: StateSequence[];
  isAnomalous: boolean;
  confidence: number;
}

export interface UserJourney {
  journeyId: string;
  userId?: string;
  sessionId: string;
  startState: string;
  endState: string;
  path: string[];
  totalDuration: number;
  stepDurations: number[];
  isCompleted: boolean;
  isAnomalous: boolean;
  riskScore: number;
  patterns: BehavioralPattern[];
  deviations: Array<{
    step: number;
    expected: string;
    actual: string;
    anomalyScore: number;
  }>;
  insights: string[];
}

export interface SequenceAnomalyResult {
  isAnomalous: boolean;
  anomalyScore: number;
  anomalyType: 'rare_sequence' | 'impossible_transition' | 'timing_anomaly' | 'context_mismatch' | 'pattern_break';
  confidence: number;
  description: string;
  expectedSequence?: string[];
  actualSequence: string[];
  riskFactors: string[];
  recommendations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface MarkovAnalyticsResult {
  totalSequences: number;
  uniquePatterns: number;
  averageSequenceLength: number;
  mostCommonPatterns: BehavioralPattern[];
  anomalousPatterns: BehavioralPattern[];
  transitionStats: {
    totalTransitions: number;
    averageProbability: number;
    highConfidenceTransitions: number;
    lowConfidenceTransitions: number;
  };
  userBehaviorInsights: {
    commonJourneys: UserJourney[];
    abandonmentPoints: string[];
    conversionPaths: string[];
    riskPatterns: string[];
  };
  predictionAccuracy: {
    overall: number;
    byOrder: Record<string, number>;
    byContext: Record<BehavioralContext, number>;
  };
  timeWindowAnalysis: {
    start: Date;
    end: Date;
    duration: number;
    sequenceCount: number;
    anomalyRate: number;
  };
}

export interface MarkovPerformanceMetrics {
  predictionLatency: {
    p50: number;
    p95: number;
    p99: number;
  };
  memoryUsage: {
    transitionMatrix: number;
    stateStorage: number;
    total: number;
    utilizationPercent: number;
  };
  accuracy: {
    nextStatePrediction: number;
    anomalyDetection: {
      precision: number;
      recall: number;
      f1Score: number;
    };
    sequenceCompletion: number;
  };
  throughput: {
    sequencesPerSecond: number;
    predictionsPerSecond: number;
    updatesPerSecond: number;
  };
  stateManagement: {
    totalStates: number;
    activeStates: number;
    prunedStates: number;
    stateUtilization: number;
  };
}

export interface BehavioralInsight {
  insight: 'common_pattern' | 'rare_behavior' | 'anomalous_sequence' | 'journey_abandonment' | 'security_risk';
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  data: {
    pattern?: BehavioralPattern;
    sequence?: string[];
    users?: number;
    frequency?: number;
    riskScore?: number;
  };
  recommendations: string[];
  timestamp: Date;
  affectedUsers: number;
  businessImpact: string;
}

export interface MarkovManagerConfig {
  chains: Array<{
    name: string;
    order: MarkovOrder;
    config: MarkovChainConfig;
    enabled: boolean;
  }>;
  globalConfig: {
    maxMemoryUsage: number;
    persistenceInterval: number;
    cleanupInterval: number;
    enableMetrics: boolean;
    enableAnalytics: boolean;
    enableRealTimeUpdates: boolean;
  };
  anomalyDetection: {
    enabled: boolean;
    thresholds: {
      sequenceAnomaly: number;
      transitionAnomaly: number;
      timingAnomaly: number;
    };
    alerting: {
      enabled: boolean;
      severityThreshold: 'medium' | 'high' | 'critical';
    };
  };
  integration: {
    behavioralAnalyzer: boolean;
    threatDetection: boolean;
    riskScoring: boolean;
    userProfiling: boolean;
  };
}

export interface StateCompressionConfig {
  enabled: boolean;
  compressionRatio: number;
  preserveImportantStates: boolean;
  importanceThreshold: number;
  compressionAlgorithm: 'frequency' | 'recency' | 'importance' | 'hybrid';
}

export interface BehavioralRiskScore {
  score: number; // 0.0 to 1.0
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  contributingFactors: Array<{
    factor: 'rare_sequence' | 'impossible_transition' | 'timing_anomaly' | 'context_violation' | 'pattern_deviation';
    weight: number;
    description: string;
    severity: number;
  }>;
  recommendations: string[];
  historicalComparison: {
    userAverage: number;
    globalAverage: number;
    percentile: number;
  };
}

export interface SequenceValidationResult {
  isValid: boolean;
  confidence: number;
  violations: Array<{
    type: 'impossible_transition' | 'timing_violation' | 'context_mismatch' | 'order_violation';
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    position: number;
    expected?: string;
    actual: string;
  }>;
  suggestions: string[];
  alternativeSequences: string[][];
}
