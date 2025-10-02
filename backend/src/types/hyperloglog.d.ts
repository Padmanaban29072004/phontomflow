export interface HyperLogLogConfig {
  precision: number;           // Number of bits for precision (4-16)
  hashFunction: 'murmur3' | 'xxhash' | 'fnv1a';
  biasCorrection: boolean;     // Enable bias correction for small cardinalities
  sparseMode: boolean;         // Use sparse representation for small sets
  maxMemoryMB: number;         // Maximum memory usage in MB
  name?: string;               // Optional name for the HLL instance
}

export interface CardinalityEstimate {
  count: number;               // Estimated cardinality
  precision: number;           // Precision used (bits)
  errorRate: number;           // Theoretical error rate
  confidence: number;          // Confidence in the estimate (0-1)
  isSparse: boolean;           // Whether sparse mode was used
  timestamp: Date;             // When the estimate was calculated
  metadata?: Record<string, any>;
}

export interface HyperLogLogMetrics {
  totalAdds: number;           // Total number of elements added
  totalQueries: number;        // Total number of cardinality queries
  currentCardinality: number;  // Current estimated cardinality
  memoryUsage: number;         // Current memory usage in bytes
  averageAddTime: number;      // Average add operation time (microseconds)
  averageQueryTime: number;    // Average query operation time (microseconds)
  sparseThreshold: number;     // Threshold for switching from sparse to dense
  lastUpdated: Date;
}

export interface VisitorTrackingConfig {
  trackIPs: boolean;           // Track unique IP addresses
  trackSessions: boolean;      // Track unique session IDs
  trackUserAgents: boolean;    // Track unique user agents
  trackGeolocation: boolean;   // Track unique geographic locations
  trackPaths: boolean;         // Track unique request paths
  timeWindows: number[];       // Time windows for analysis (milliseconds)
  enabled: boolean;            // Master enable/disable switch
}

export interface VisitorMetrics {
  timeWindow: {
    start: Date;
    end: Date;
    duration: number;          // Duration in milliseconds
  };
  uniqueVisitors: {
    total: number;             // Total unique visitors in window
    ips: number;               // Unique IP addresses
    sessions: number;          // Unique sessions
    userAgents: number;        // Unique user agents
    locations: number;         // Unique geographic locations
    paths: number;             // Unique paths accessed
  };
  growthRate: number;          // Growth rate compared to previous window
  confidence: number;          // Confidence in the metrics
}

export interface HLLAnalyticsResult {
  metric: string;              // Name of the metric being analyzed
  currentValue: number;        // Current cardinality estimate
  previousValue: number;       // Previous period cardinality
  growthRate: number;          // Percentage growth rate
  trend: 'increasing' | 'decreasing' | 'stable';
  volatility: number;          // Measure of how volatile the metric is (0-1)
  anomalyScore: number;        // Anomaly score based on historical patterns (0-1)
  recommendations: string[];   // Actionable recommendations
  timeWindow: {
    current: { start: Date; end: Date };
    previous: { start: Date; end: Date };
  };
}

export interface HLLPersistenceData {
  config: HyperLogLogConfig;
  registers: number[] | Map<number, number>; // Dense array or sparse map
  sparseMode: boolean;
  cardinality: number;
  totalAdds: number;
  lastUpdated: Date;
  version: string;             // Schema version for migration
}

export interface VisitorPattern {
  type: 'steady' | 'growing' | 'declining' | 'spiky' | 'seasonal';
  confidence: number;          // Confidence in pattern detection (0-1)
  description: string;         // Human-readable description
  characteristics: {
    averageGrowthRate: number; // Average growth rate per period
    peakTimes: string[];       // Times when activity peaks
    lowTimes: string[];        // Times when activity is low
    seasonality: number;       // Seasonality score (0-1)
  };
  predictions: {
    nextPeriod: number;        // Predicted cardinality for next period
    confidence: number;        // Confidence in prediction
    range: { min: number; max: number }; // Prediction range
  };
}

export interface HLLManagerConfig {
  trackers: {
    name: string;              // Tracker name
    config: HyperLogLogConfig; // HLL configuration
    visitorConfig: VisitorTrackingConfig; // Visitor tracking config
    enabled: boolean;          // Whether this tracker is enabled
  }[];
  persistenceInterval: number; // How often to persist to Redis (ms)
  cleanupInterval: number;     // How often to cleanup old data (ms)
  maxMemoryUsage: number;      // Maximum total memory usage (bytes)
  enableMetrics: boolean;      // Enable performance metrics collection
  enableAnalytics: boolean;    // Enable analytics and pattern detection
}

export interface UniqueVisitorInsight {
  insight: string;             // Type of insight
  description: string;         // Detailed description
  impact: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;          // Confidence in the insight (0-1)
  data: {
    current: number;           // Current metric value
    expected: number;          // Expected metric value
    deviation: number;         // Percentage deviation from expected
  };
  recommendations: string[];   // Actionable recommendations
  timestamp: Date;
}

export interface CardinalityComparison {
  metric: string;              // Name of the metric
  periods: {
    name: string;              // Period name (e.g., "This Hour", "Last Hour")
    cardinality: number;       // Cardinality for this period
    confidence: number;        // Confidence in the estimate
    timeRange: { start: Date; end: Date };
  }[];
  analysis: {
    trend: 'increasing' | 'decreasing' | 'stable';
    changeRate: number;        // Percentage change
    significance: 'low' | 'medium' | 'high'; // Statistical significance
    interpretation: string;    // Human-readable interpretation
  };
}

export interface HLLPerformanceMetrics {
  operationsPerSecond: {
    adds: number;              // Add operations per second
    queries: number;           // Query operations per second
  };
  latency: {
    add: {
      p50: number;             // 50th percentile latency (microseconds)
      p95: number;             // 95th percentile latency
      p99: number;             // 99th percentile latency
    };
    query: {
      p50: number;
      p95: number;
      p99: number;
    };
  };
  accuracy: {
    estimatedError: number;    // Estimated error rate
    actualError?: number;      // Actual error if known
    biasCorrection: boolean;   // Whether bias correction is active
    sparseEfficiency: number;  // Efficiency of sparse mode (0-1)
  };
  memory: {
    totalUsage: number;        // Total memory usage (bytes)
    perHLL: number;            // Average memory per HLL instance
    sparseRatio: number;       // Ratio of HLLs in sparse mode
    compressionRatio: number;  // Compression efficiency
  };
}

// Hash function interface for HyperLogLog
export interface HLLHashFunction {
  (data: string | Buffer): bigint; // Returns 64-bit hash as BigInt
}

// Interface for HLL register operations
export interface HLLRegisters {
  get(index: number): number;
  set(index: number, value: number): void;
  size(): number;
  isSparse(): boolean;
  toDense(): number[];
  toSparse(): Map<number, number>;
  memoryUsage(): number;
}

// Time-based cardinality tracking
export interface TimeSeriesCardinality {
  timestamp: Date;
  cardinality: number;
  confidence: number;
  metadata?: {
    windowSize: number;        // Size of the time window
    dataPoints: number;        // Number of data points in window
    anomalyScore: number;      // Anomaly score for this time point
  };
}

// Geographic visitor distribution
export interface GeographicDistribution {
  country: string;
  region?: string;
  city?: string;
  uniqueVisitors: number;
  percentage: number;          // Percentage of total visitors
  confidence: number;          // Confidence in the estimate
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// User agent analysis
export interface UserAgentAnalysis {
  category: 'browser' | 'bot' | 'mobile' | 'unknown';
  name: string;                // Browser/bot name
  version?: string;            // Version if available
  uniqueCount: number;         // Unique count for this user agent
  percentage: number;          // Percentage of total
  riskScore: number;           // Risk score (0-1) for security analysis
}
