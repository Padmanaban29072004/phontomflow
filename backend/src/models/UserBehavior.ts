export interface UserBehavior {
  id: string;
  sessionId: string;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  behaviorPattern: BehaviorPattern;
  riskFactors: RiskFactor[];
  anomalies: Anomaly[];
  confidence: number;
  metadata: {
    source: string;
    version: string;
    analysisDuration: number;
  };
}

export interface BehaviorPattern {
  timingPatterns: TimingPattern[];
  navigationPatterns: NavigationPattern[];
  interactionPatterns: InteractionPattern[];
  devicePatterns: DevicePattern[];
  locationPatterns: LocationPattern[];
}

export interface TimingPattern {
  sessionDuration: number;
  burstRequests: number;
  idlePeriods: number;
  averageTimeBetweenRequests: number;
  requestFrequency: number;
  timeOfDay: number;
  dayOfWeek: number;
}

export interface NavigationPattern {
  pageSequence: string[];
  directAccess: number;
  referrerPatterns: string[];
  backButtonUsage: number;
  bookmarkUsage: number;
  searchUsage: number;
}

export interface InteractionPattern {
  mouseMovements: number;
  formInteractions: number;
  scrollBehavior: number;
  clickPatterns: ClickPattern[];
  keyboardPatterns: KeyboardPattern[];
  touchPatterns: TouchPattern[];
}

export interface DevicePattern {
  screenResolution: string;
  colorDepth: number;
  timezone: string;
  language: string;
  platform: string;
  browser: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
}

export interface LocationPattern {
  country: string;
  region: string;
  city: string;
  isp: string;
  proxy: boolean;
  vpn: boolean;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface ClickPattern {
  elementType: string;
  position: { x: number; y: number };
  timestamp: number;
  duration: number;
}

export interface KeyboardPattern {
  keySequence: string[];
  typingSpeed: number;
  pausePatterns: number[];
  timestamp: number;
}

export interface TouchPattern {
  gestureType: string;
  coordinates: { x: number; y: number }[];
  duration: number;
  timestamp: number;
}

export interface RiskFactor {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  score: number;
  evidence: string[];
}

export interface Anomaly {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  timestamp: Date;
  context: Record<string, any>;
}
