export interface NetworkTraffic {
  id: string;
  sessionId: string;
  userId?: string;
  ipAddress: string;
  timestamp: Date;
  trafficPattern: TrafficPattern;
  protocolAnalysis: ProtocolAnalysis;
  bandwidthUsage: BandwidthUsage;
  connectionMetrics: ConnectionMetrics;
  securityIndicators: SecurityIndicator[];
  anomalies: NetworkAnomaly[];
  metadata: {
    source: string;
    version: string;
    analysisDuration: number;
  };
}

export interface TrafficPattern {
  requestCount: number;
  responseCount: number;
  averageRequestSize: number;
  averageResponseSize: number;
  requestRate: number;
  responseRate: number;
  peakTrafficTime: Date;
  trafficDistribution: TrafficDistribution;
}

export interface TrafficDistribution {
  byProtocol: Record<string, number>;
  byEndpoint: Record<string, number>;
  byMethod: Record<string, number>;
  byStatus: Record<string, number>;
  byTimeOfDay: Record<string, number>;
}

export interface ProtocolAnalysis {
  http: HTTPAnalysis;
  https: HTTPSAnalysis;
  tcp: TCPAnalysis;
  udp: UDPAnalysis;
  dns: DNSAnalysis;
}

export interface HTTPAnalysis {
  version: string;
  methods: string[];
  statusCodes: Record<string, number>;
  headers: Record<string, string[]>;
  userAgents: string[];
  referrers: string[];
  cookies: Record<string, string>;
}

export interface HTTPSAnalysis {
  certificates: CertificateInfo[];
  cipherSuites: string[];
  tlsVersion: string;
  certificateValidation: boolean;
}

export interface CertificateInfo {
  issuer: string;
  subject: string;
  validFrom: Date;
  validTo: Date;
  serialNumber: string;
  fingerprint: string;
}

export interface TCPAnalysis {
  connections: number;
  ports: number[];
  flags: string[];
  windowSize: number;
  sequenceNumbers: number[];
}

export interface UDPAnalysis {
  packets: number;
  ports: number[];
  payloadSize: number;
  checksum: boolean;
}

export interface DNSAnalysis {
  queries: DNSQuery[];
  responses: DNSResponse[];
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
}

export interface DNSQuery {
  domain: string;
  type: string;
  timestamp: Date;
  sourceIP: string;
}

export interface DNSResponse {
  domain: string;
  type: string;
  answers: string[];
  timestamp: Date;
  responseTime: number;
}

export interface BandwidthUsage {
  incoming: number;
  outgoing: number;
  total: number;
  peak: number;
  average: number;
  byProtocol: Record<string, number>;
  byTime: TimeSeriesData[];
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  label: string;
}

export interface ConnectionMetrics {
  activeConnections: number;
  totalConnections: number;
  connectionDuration: number;
  connectionRate: number;
  failedConnections: number;
  retryAttempts: number;
  connectionStates: Record<string, number>;
}

export interface SecurityIndicator {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string[];
  confidence: number;
  timestamp: Date;
  mitigation: string[];
}

export interface NetworkAnomaly {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  timestamp: Date;
  affectedProtocols: string[];
  affectedEndpoints: string[];
  context: Record<string, any>;
}
