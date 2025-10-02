export interface RiskContext {
  temporal: TemporalContext;
  geographic: GeographicContext;
  behavioral: BehavioralContext;
  session: SessionContext;
  network: NetworkContext;
}

export interface TemporalContext {
  timeOfDay: number; // 0-23 hours
  dayOfWeek: number; // 0-6 (Sunday = 0)
  isBusinessHours: boolean;
  isWeekend: boolean;
  timeZone: string;
  requestFrequency: number; // requests per minute
}

export interface GeographicContext {
  country: string;
  region: string;
  city: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  riskScore: number; // 0-1 based on geographic threat intelligence
}

export interface BehavioralContext {
  userType: 'new' | 'returning' | 'frequent' | 'suspicious';
  sessionAge: number; // milliseconds
  pageSequenceAnomalies: number;
  navigationPattern: 'linear' | 'random' | 'targeted' | 'scanning';
  interactionLevel: 'high' | 'medium' | 'low' | 'bot-like';
  deviceConsistency: boolean;
}

export interface SessionContext {
  sessionId: string;
  userId?: string;
  isAuthenticated: boolean;
  sessionDuration: number; // milliseconds
  requestCount: number;
  errorCount: number;
  privilegeLevel: 'guest' | 'user' | 'admin' | 'system';
  hashedFingerprint: string;
}

export interface NetworkContext {
  ipReputation: number; // 0-1 (0 = clean, 1 = malicious)
  asnNumber: number;
  asnOrganization: string;
  connectionType: 'residential' | 'datacenter' | 'mobile' | 'unknown';
  threatIntelligence: {
    isKnownThreat: boolean;
    threatSources: string[];
    lastSeenMalicious?: Date;
  };
}

export interface ScoringWeights {
  behavioral: number;
  statistical: number;
  relationship: number;
  contextMultipliers: ContextMultipliers;
}

export interface ContextMultipliers {
  temporal: TemporalMultipliers;
  geographic: GeographicMultipliers;
  behavioral: BehavioralMultipliers;
  session: SessionMultipliers;
  network: NetworkMultipliers;
}

export interface TemporalMultipliers {
  offHours: number; // Multiplier for requests outside business hours
  weekend: number; // Multiplier for weekend requests
  highFrequency: number; // Multiplier for high request frequency
  nightTime: number; // Multiplier for 12AM-6AM requests
}

export interface GeographicMultipliers {
  highRiskCountry: number;
  vpnUsage: number;
  proxyUsage: number;
  torUsage: number;
  unknownLocation: number;
}

export interface BehavioralMultipliers {
  newUser: number;
  suspiciousUser: number;
  botLikeBehavior: number;
  rapidNavigation: number;
  inconsistentDevice: number;
}

export interface SessionMultipliers {
  unauthenticated: number;
  shortSession: number;
  highErrorRate: number;
  privilegedAccount: number;
  anonymousSession: number;
}

export interface NetworkMultipliers {
  knownThreat: number;
  datacenterOrigin: number;
  poorReputation: number;
  newInfrastructure: number;
}

export interface ContextualRiskScore {
  baseScore: number; // Combined score from analyzers
  contextualScore: number; // Score after applying context
  confidence: number; // 0-1 confidence level
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  contributing_factors: ContributingFactor[];
  recommendations: string[];
}

export interface ContributingFactor {
  factor: string;
  weight: number;
  impact: number; // How much this factor affected the score
  description: string;
}

export interface RiskScoringConfig {
  weights: ScoringWeights;
  thresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  contextSensitivity: number; // 0-1, how much context affects the score
  confidenceThreshold: number; // Minimum confidence to act on score
  adaptiveLearning: boolean; // Whether to learn from feedback
}
