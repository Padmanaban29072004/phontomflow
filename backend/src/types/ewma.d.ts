/**
 * Advanced EWMA (Exponentially Weighted Moving Average) Types and Interfaces
 * Supports multi-window analysis, adaptive parameters, and trend detection
 */

export type EWMAVariant = 'simple' | 'double' | 'adaptive';

export type TimeWindow = '1min' | '5min' | '15min' | '60min';

export type TrendDirection = 'increasing' | 'decreasing' | 'stable' | 'volatile';

export interface EWMAConfig {
  variant: EWMAVariant;
  alpha: number;                    // Smoothing parameter (0-1)
  adaptiveAlpha: boolean;           // Enable adaptive alpha adjustment
  minAlpha: number;                 // Minimum alpha value
  maxAlpha: number;                 // Maximum alpha value
  windowSize: number;               // Window size in data points
  timeWindow: TimeWindow;           // Time window for analysis
  volatilityThreshold: number;      // Threshold for volatility detection
  changeDetectionThreshold: number; // Threshold for change point detection
  enableTrendAnalysis: boolean;     // Enable trend detection
  enableOutlierDetection: boolean;  // Enable outlier detection
}

export interface EWMAValue {
  value: number;
  timestamp: Date;
  confidence: number;
  trend: TrendDirection;
  volatility: number;
  isOutlier: boolean;
}

export interface EWMAResult {
  current: EWMAValue;
  previous: EWMAValue;
  prediction: {
    nextValue: number;
    confidence: number;
    range: { min: number; max: number };
  };
  statistics: {
    mean: number;
    variance: number;
    standardDeviation: number;
    volatility: number;
  };
  trend: {
    direction: TrendDirection;
    strength: number;        // 0-1 scale
    changePoint: boolean;    // True if trend change detected
    duration: number;        // Duration of current trend in minutes
  };
  anomaly: {
    isAnomalous: boolean;
    score: number;          // 0-1 scale
    threshold: number;
    confidence: number;
  };
}

export interface MultiWindowEWMA {
  windows: Partial<Record<TimeWindow, EWMAResult>>;
  consensus: {
    trend: TrendDirection;
    anomalyScore: number;
    confidence: number;
    agreement: number;      // Agreement between windows (0-1)
  };
  recommendations: string[];
}

export interface EWMAStatistics {
  totalDataPoints: number;
  windowsActive: number;
  averageAccuracy: number;
  trendAccuracy: number;
  anomaliesDetected: number;
  falsePositives: number;
  lastUpdate: Date;
  memoryUsage: number;
}

export interface BaselineAdaptation {
  enabled: boolean;
  adaptationRate: number;      // How quickly to adapt (0-1)
  driftThreshold: number;      // Threshold for concept drift detection
  validationPeriod: number;    // Minutes to validate new baseline
  rollbackThreshold: number;   // Threshold to rollback adaptation
  lastAdaptation: Date;
  adaptationCount: number;
}

export interface TrendAnalysis {
  shortTerm: {
    trend: TrendDirection;
    strength: number;
    duration: number;        // minutes
    confidence: number;
  };
  longTerm: {
    trend: TrendDirection;
    strength: number;
    duration: number;        // minutes
    confidence: number;
  };
  seasonality: {
    detected: boolean;
    period: number;          // minutes
    strength: number;
    confidence: number;
  };
  changePoints: Array<{
    timestamp: Date;
    magnitude: number;
    confidence: number;
    type: 'level' | 'trend' | 'variance';
  }>;
}

export interface EWMAPerformanceMetrics {
  accuracy: {
    prediction: number;      // Prediction accuracy (0-1)
    trend: number;          // Trend detection accuracy (0-1)
    anomaly: number;        // Anomaly detection accuracy (0-1)
  };
  latency: {
    calculation: number;     // microseconds
    adaptation: number;      // microseconds
    prediction: number;      // microseconds
  };
  throughput: {
    dataPointsPerSecond: number;
    calculationsPerSecond: number;
  };
  memory: {
    totalUsage: number;      // bytes
    perWindow: number;       // bytes
    efficiency: number;      // utilization percentage
  };
  reliability: {
    uptime: number;          // percentage
    errorRate: number;       // errors per calculation
    adaptationSuccess: number; // successful adaptations (0-1)
  };
}

export interface EWMAManagerConfig {
  windows: TimeWindow[];
  defaultConfig: EWMAConfig;
  windowConfigs: Partial<Record<TimeWindow, Partial<EWMAConfig>>>;
  globalSettings: {
    enableCrossPollination: boolean; // Share learnings between windows
    consensusThreshold: number;      // Agreement threshold for consensus
    maxMemoryUsage: number;          // Maximum memory in bytes
    persistenceInterval: number;     // Persistence interval in milliseconds
    cleanupInterval: number;         // Cleanup interval in milliseconds
  };
  adaptation: BaselineAdaptation;
  monitoring: {
    enableMetrics: boolean;
    metricsInterval: number;    // milliseconds
    enableAlerting: boolean;
    alertThreshold: number;
  };
}

export interface EWMAInsight {
  type: 'trend_change' | 'volatility_spike' | 'baseline_drift' | 'anomaly_cluster' | 'performance_degradation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  confidence: number;
  data: {
    metric: string;
    currentValue: number;
    expectedValue: number;
    deviation: number;
    timeWindow: TimeWindow;
    duration: number;        // minutes
  };
  recommendations: string[];
  timestamp: Date;
  affectedWindows: TimeWindow[];
}

export interface EWMAValidationResult {
  isValid: boolean;
  accuracy: number;
  errors: Array<{
    type: 'calculation' | 'trend' | 'prediction' | 'adaptation' | 'accuracy' | 'performance';
    description: string;
    severity: 'low' | 'medium' | 'high';
    suggestion: string;
  }>;
  performance: {
    speed: number;           // calculations per second
    memory: number;          // bytes used
    accuracy: number;        // prediction accuracy
  };
  recommendations: string[];
}

export interface DataPoint {
  value: number;
  timestamp: Date;
  metadata?: {
    source?: string;
    type?: string;
    context?: Record<string, any>;
  };
}

export interface EWMAForecast {
  horizon: number;             // forecast horizon in minutes
  predictions: Array<{
    timestamp: Date;
    value: number;
    confidence: number;
    range: { min: number; max: number };
  }>;
  accuracy: {
    expected: number;        // expected accuracy based on historical performance
    confidence: number;      // confidence in the forecast
  };
  assumptions: string[];       // assumptions made in the forecast
  limitations: string[];       // limitations of the forecast
}

export interface OutlierDetection {
  method: 'statistical' | 'iqr' | 'zscore' | 'modified_zscore';
  threshold: number;
  sensitivity: number;         // 0-1 scale
  windowSize: number;          // data points to consider
  result: {
    isOutlier: boolean;
    score: number;             // outlier score
    confidence: number;
    explanation: string;
  };
}

export interface VolatilityAnalysis {
  current: number;             // current volatility
  average: number;             // average volatility over window
  trend: TrendDirection;       // volatility trend
  spikes: Array<{
    timestamp: Date;
    magnitude: number;
    duration: number;          // minutes
  }>;
  regime: 'low' | 'medium' | 'high' | 'extreme';
}

export interface EWMAHealthCheck {
  isHealthy: boolean;
  status: 'healthy' | 'warning' | 'critical' | 'error';
  issues: Array<{
    component: 'calculation' | 'memory' | 'performance' | 'accuracy' | 'adaptation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    suggestion: string;
  }>;
  metrics: {
    accuracy: number;
    performance: number;
    memoryUsage: number;
    errorRate: number;
  };
  recommendations: string[];
  lastCheck: Date;
}

export interface AdaptiveParameters {
  alpha: {
    current: number;
    target: number;
    adaptationRate: number;
    bounds: { min: number; max: number };
    lastUpdate: Date;
  };
  volatilityThreshold: {
    current: number;
    adaptive: boolean;
    history: number[];
    percentile: number;        // percentile for threshold calculation
  };
  changeDetectionThreshold: {
    current: number;
    adaptive: boolean;
    sensitivity: number;
    falsePositiveRate: number;
  };
}

export interface EWMAIntegrationData {
  baseline: number;            // current baseline value
  trend: TrendDirection;       // current trend
  volatility: number;          // current volatility level
  anomalyScore: number;        // anomaly score (0-1)
  confidence: number;          // confidence in assessment (0-1)
  prediction: {
    nextValue: number;
    confidence: number;
    timeHorizon: number;       // minutes
  };
  insights: EWMAInsight[];
  recommendations: string[];
  riskScore: number;           // risk score based on EWMA analysis (0-1)
  healthStatus: 'healthy' | 'warning' | 'critical';
}
