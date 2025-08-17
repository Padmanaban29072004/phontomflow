export interface ThreatScore {
  id: string;
  score: number;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  threatTypes: string[];
  timestamp: Date;
  sessionId: string;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  requestPath: string;
  requestMethod: string;
  behavioralScore: number;
  statisticalScore: number;
  relationshipScore: number;
  combinedScore: number;
  recommendations: string[];
  metadata: {
    source: string;
    version: string;
    modelVersion?: string;
  };
}

export interface ThreatScoreHistory {
  sessionId: string;
  scores: ThreatScore[];
  averageScore: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  lastUpdated: Date;
}

export interface ThreatScoreConfig {
  thresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  weights: {
    behavioral: number;
    statistical: number;
    relationship: number;
  };
  confidenceThreshold: number;
  updateInterval: number;
}
