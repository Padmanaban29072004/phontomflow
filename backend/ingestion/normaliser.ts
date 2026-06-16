import { randomUUID } from 'crypto';
import { NormalizationInput, UnifiedEventSchema } from './types';

const severityMap: Record<string, UnifiedEventSchema['severity']> = {
  info: 'low',
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
  warn: 'medium',
  warning: 'medium',
  error: 'high',
};

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

function normalizeSeverity(payload: Record<string, any>): UnifiedEventSchema['severity'] {
  const raw = asString(payload.severity || payload.level || payload.priority, 'low').toLowerCase();
  return severityMap[raw] ?? 'low';
}

export function normalizeEvent(input: NormalizationInput): UnifiedEventSchema {
  const payload = input.payload || {};
  const nowIso = new Date().toISOString();

  const srcIp =
    asString(payload.src_ip) ||
    asString(payload.srcIp) ||
    asString(payload.source_ip) ||
    asString(payload.client_ip) ||
    asString(payload.ip) ||
    '0.0.0.0';

  const dstIp =
    asString(payload.dst_ip) ||
    asString(payload.dstIp) ||
    asString(payload.destination_ip) ||
    asString(payload.target_ip);

  const ts = asString(payload.timestamp || payload.time || payload.event_time, nowIso);

  const eventType =
    asString(payload.event_type) ||
    asString(payload.eventType) ||
    asString(payload.action) ||
    asString(payload.type, 'unknown');

  return {
    event_id: asString(payload.event_id || payload.id, randomUUID()),
    source: input.source,
    src_ip: srcIp,
    dst_ip: dstIp || undefined,
    timestamp: ts,
    event_type: eventType,
    severity: normalizeSeverity(payload),
    raw_payload: payload,
    user_id: asString(payload.user_id || payload.userId) || undefined,
    host: asString(payload.host || payload.hostname || payload.device) || undefined,
    metadata: {
      original_keys: Object.keys(payload),
      normalized_at: nowIso,
    },
  };
}

