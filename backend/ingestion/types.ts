export type EventSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface UnifiedEventSchema {
  event_id: string;
  source: string;
  src_ip: string;
  dst_ip?: string;
  timestamp: string;
  event_type: string;
  severity: EventSeverity;
  raw_payload: Record<string, unknown>;
  user_id?: string;
  host?: string;
  geo?: {
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
    ll?: [number, number];
  };
  threat_intel?: {
    virustotal_score?: number;
    abuseipdb_score?: number;
    tags?: string[];
    verdict?: 'clean' | 'suspicious' | 'malicious';
  };
  asset?: {
    asset_id?: string;
    hostname?: string;
    owner?: string;
    environment?: string;
    criticality_score: number;
  };
  metadata?: Record<string, unknown>;
}

export interface KafkaIngestionConfig {
  clientId: string;
  brokers: string[];
  topic: string;
  groupId: string;
}

export interface NormalizationInput {
  source: string;
  payload: Record<string, any>;
}

