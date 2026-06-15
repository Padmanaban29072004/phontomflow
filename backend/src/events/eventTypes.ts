export interface ThreatDetectedEvent {
  eventId: string;
  requestId: string;
  clientIp: string;
  threatScore: number;
  riskLevel: string;
  threatType: string;
  requestPath: string;
  requestMethod: string;
  sourceService: string;
  timestampUnixMs: number;
}

export interface ResponseExecutedEvent {
  eventId: string;
  requestId: string;
  clientIp: string;
  actionType: string;
  target: string;
  success: boolean;
  durationMs: number;
  threatId: string;
  sourceService: string;
  timestampUnixMs: number;
}
