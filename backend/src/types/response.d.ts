export interface ResponseTier {
  level: ResponseLevel;
  name: string;
  description: string;
  threshold: {
    min: number; // minimum risk score to trigger this tier
    max: number; // maximum risk score for this tier
  };
  actions: ResponseAction[];
  escalationDelay?: number; // milliseconds before escalating
  cooldownPeriod?: number; // milliseconds before allowing de-escalation
}

export type ResponseLevel = 'monitor' | 'warn' | 'restrict' | 'block' | 'isolate';

export interface ResponseAction {
  type: ResponseActionType;
  severity: number; // 1-10 scale
  enabled: boolean;
  config: ResponseActionConfig;
  metadata?: Record<string, any>;
}

export type ResponseActionType = 
  | 'allow'
  | 'log_only'
  | 'rate_limit'
  | 'challenge_response'
  | 'step_up_auth'
  | 'deception_redirect'
  | 'temporary_block'
  | 'permanent_block'
  | 'quarantine'
  | 'alert_admin'
  | 'honeypot_engage'
  | 'divert';

export interface ResponseActionConfig {
  // Rate limiting config
  rateLimit?: {
    requests: number;
    window: number; // milliseconds
    burst?: number;
  };
  
  // Challenge response config
  challenge?: {
    type: 'captcha' | 'javascript' | 'proof_of_work';
    difficulty: number; // 1-10
    timeout: number; // milliseconds
  };
  
  // Authentication config
  authentication?: {
    required: boolean;
    methods: ('password' | 'mfa' | 'biometric')[];
    timeout: number;
  };
  
  // Blocking config
  block?: {
    duration: number; // milliseconds, -1 for permanent
    message: string;
    redirectUrl?: string;
  };
  
  // Deception config
  deception?: {
    honeypotUrl: string;
    logLevel: 'basic' | 'detailed' | 'forensic';
    trackingDuration: number;
  };
  
  // Alert config
  alert?: {
    channels: ('email' | 'slack' | 'webhook' | 'sms')[];
    priority: 'low' | 'medium' | 'high' | 'critical';
    aggregation: boolean; // group similar alerts
  };
}

export interface ResponseDecision {
  tier: ResponseTier;
  actions: ResponseAction[];
  reason: string;
  confidence: number;
  timestamp: Date;
  sessionId: string;
  riskScore: number;
  context: {
    previousResponses: ResponseHistory[];
    escalationPath: ResponseLevel[];
    cooldownStatus: boolean;
  };
}

export interface ResponseHistory {
  timestamp: Date;
  tier: ResponseLevel;
  actions: ResponseActionType[];
  effectiveness: number; // 0-1 (measured by subsequent behavior)
  duration: number; // how long the response was active
}

export interface ResponseMetrics {
  totalResponses: number;
  responsesByTier: Record<ResponseLevel, number>;
  averageResponseTime: number;
  effectiveness: {
    falsePositives: number;
    falseNegatives: number;
    truePositives: number;
    trueNegatives: number;
    accuracy: number;
    precision: number;
    recall: number;
  };
  escalationRate: number;
  cooldownViolations: number;
}

export interface ResponseConfiguration {
  enabled: boolean;
  defaultTier: ResponseLevel;
  tiers: ResponseTier[];
  globalSettings: {
    maxEscalationsPerSession: number;
    defaultCooldownPeriod: number;
    responseTimeout: number;
    enableAdaptiveLearning: boolean;
    metricsRetentionDays: number;
  };
  adaptiveLearning: {
    enabled: boolean;
    learningRate: number;
    feedbackThreshold: number;
    retrainInterval: number; // milliseconds
  };
}

export interface ResponseExecutionResult {
  success: boolean;
  actionsExecuted: string[];
  actionResults: Record<string, {
    success: boolean;
    latency: number;
    error?: string;
    metadata?: Record<string, any>;
  }>;
  totalLatency: number;
  error?: string;
}
