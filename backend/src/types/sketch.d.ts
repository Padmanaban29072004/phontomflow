export interface CountMinSketchConfig {
  width: number;           // Number of buckets per hash function
  depth: number;           // Number of hash functions
  hashSeed: number;        // Random seed for hash functions
  errorRate: number;       // Target error rate (epsilon)
  confidence: number;      // Confidence level (delta)
  name?: string;           // Optional name for the sketch
}

export interface FrequencyEstimate {
  item: string;            // The item being queried
  frequency: number;       // Estimated frequency
  confidence: number;      // Confidence in the estimate
  errorBound: number;      // Maximum possible error
  timestamp: Date;         // When the estimate was made
}

export interface SketchMetrics {
  totalInserts: number;    // Total number of items inserted
  totalQueries: number;    // Total number of queries performed
  memoryUsage: number;     // Memory usage in bytes
  averageInsertTime: number; // Average insert time in microseconds
  averageQueryTime: number;  // Average query time in microseconds
  errorRate: number;       // Observed error rate
  fillRatio: number;       // How full the sketch is (0-1)
}

export interface FrequencyThresholds {
  baseline: number;        // Normal/baseline frequency
  suspicious: number;      // Threshold for suspicious activity
  anomalous: number;       // Threshold for anomalous activity
  critical: number;        // Threshold for critical threats
}

export interface FrequencyAnalysisResult {
  item: string;
  currentFrequency: number;
  baselineFrequency: number;
  deviationRatio: number;  // Current / baseline
  riskLevel: 'normal' | 'suspicious' | 'anomalous' | 'critical';
  riskScore: number;       // 0-1 risk score based on frequency
  confidence: number;      // Confidence in the analysis
  timeWindow: number;      // Time window for analysis (ms)
  lastSeen: Date;
}

export interface SketchAnomalyResult {
  detected: boolean;
  anomalyType: 'frequency_spike' | 'rare_item' | 'burst_pattern' | 'sustained_high';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  affectedItems: string[];
  timeWindow: {
    start: Date;
    end: Date;
    duration: number;
  };
  recommendations: string[];
}

export interface SketchPersistenceData {
  config: CountMinSketchConfig;
  matrix: number[][];      // The actual sketch matrix
  totalItems: number;      // Total items inserted
  lastUpdated: Date;
  version: string;         // Schema version for migration
}

export interface HashFunction {
  (item: string, seed: number, width: number): number;
}

export interface FrequencyTracker {
  type: 'ip_address' | 'user_agent' | 'request_path' | 'parameter' | 'session_id';
  sketch: CountMinSketchConfig;
  thresholds: FrequencyThresholds;
  timeWindow: number;      // Rolling window in milliseconds
  enabled: boolean;
}

export interface SketchManagerConfig {
  trackers: FrequencyTracker[];
  persistenceInterval: number;  // How often to persist to Redis (ms)
  cleanupInterval: number;      // How often to cleanup old data (ms)
  maxMemoryUsage: number;       // Maximum memory usage in bytes
  enableMetrics: boolean;
}

export interface TimeWindowFrequency {
  item: string;
  frequency: number;
  window: {
    start: Date;
    end: Date;
    duration: number;
  };
  buckets: number[];       // Frequency per time bucket
}

export interface FrequencyPattern {
  type: 'steady' | 'increasing' | 'decreasing' | 'burst' | 'periodic';
  confidence: number;
  description: string;
  trend: number;           // -1 to 1 indicating direction
  periodicity?: number;    // Period in milliseconds if periodic
}

export interface SketchPerformanceMetrics {
  operationsPerSecond: {
    inserts: number;
    queries: number;
  };
  latency: {
    insert: {
      p50: number;
      p95: number;
      p99: number;
    };
    query: {
      p50: number;
      p95: number;
      p99: number;
    };
  };
  accuracy: {
    truePositives: number;
    falsePositives: number;
    trueNegatives: number;
    falseNegatives: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  memoryEfficiency: {
    totalMemory: number;
    memoryPerItem: number;
    compressionRatio: number;
  };
}
