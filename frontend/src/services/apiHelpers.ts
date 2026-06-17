import {
  MockThreat,
  MockDashboardMetrics,
  STATIC_DASHBOARD_METRICS,
  RiskLevel,
} from './mockData'

/** Unwrap `{ success, data }` envelopes from backend responses. */
export function unwrapApiPayload<T>(response: { data?: unknown }): T | null {
  const payload = response.data
  if (payload == null) return null
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return (payload as { data: T }).data
  }
  return payload as T
}

const SEVERITY_TO_RISK: Record<string, RiskLevel> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
}

const SEVERITY_TO_SCORE: Record<string, number> = {
  critical: 0.95,
  high: 0.8,
  medium: 0.6,
  low: 0.3,
}

export function normalizeThreat(raw: Record<string, unknown>): MockThreat {
  const severity = String(raw.severity ?? raw.riskLevel ?? 'medium').toLowerCase()
  const details = raw.details as Record<string, unknown> | undefined

  return {
    id: String(raw.id ?? raw._id ?? `threat-${Math.random().toString(36).slice(2)}`),
    ipAddress: String(raw.ipAddress ?? 'Unknown'),
    riskLevel: SEVERITY_TO_RISK[severity] ?? 'medium',
    threatScore: Number(raw.threatScore ?? SEVERITY_TO_SCORE[severity] ?? 0.5),
    userAgent: String(raw.userAgent ?? details?.userAgent ?? 'Unknown'),
    timestamp: String(raw.timestamp ?? new Date().toISOString()),
    threatType: Array.isArray(raw.threatType)
      ? (raw.threatType as string[])
      : [String(raw.type ?? 'unknown')],
    status: (raw.status as MockThreat['status']) ?? 'active',
    country: raw.country as string | undefined,
  }
}

const HEALTH_TO_SCORE: Record<string, number> = {
  excellent: 95,
  good: 85,
  warning: 65,
  critical: 40,
  error: 20,
}

export function mapOverviewToMetrics(
  overview: Record<string, unknown> | null,
  fallback: MockDashboardMetrics = STATIC_DASHBOARD_METRICS
): MockDashboardMetrics {
  if (!overview) return { ...fallback }

  const rawHealth = overview.systemHealth
  let systemHealth = fallback.systemHealth
  if (typeof rawHealth === 'number' && !Number.isNaN(rawHealth)) {
    systemHealth = rawHealth
  } else if (typeof rawHealth === 'string') {
    systemHealth = HEALTH_TO_SCORE[rawHealth.toLowerCase()] ?? fallback.systemHealth
  }

  return {
    totalRequests: Number(overview.totalRequests ?? fallback.totalRequests),
    threatsDetected: Number(
      overview.totalThreats ?? overview.threatsDetected ?? fallback.threatsDetected
    ),
    falsePositives: Number(overview.falsePositives ?? fallback.falsePositives),
    averageResponseTime: Number(overview.averageResponseTime ?? fallback.averageResponseTime),
    accuracy: Number(overview.accuracy ?? fallback.accuracy),
    activeThreats: Number(overview.activeThreats ?? fallback.activeThreats),
    blockedAttacks: Number(overview.blockedAttacks ?? fallback.blockedAttacks),
    systemHealth,
  }
}

export function normalizeThreatList(payload: unknown): MockThreat[] {
  if (!Array.isArray(payload)) return []
  return payload.map((item) => normalizeThreat(item as Record<string, unknown>))
}
