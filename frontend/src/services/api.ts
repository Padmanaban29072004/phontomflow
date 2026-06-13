import axios from 'axios'

const TOKEN_KEY = 'phantom_flow_token'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  total?: number
}

export interface AuthResponse {
  token: string
  user: { id: string; username: string; role: string }
  success: boolean
  message?: string
}

export interface Threat {
  id: string
  type: string
  severity: string
  ipAddress: string
  timestamp: string
  description: string
  details?: Record<string, unknown>
}

export interface ThreatStats {
  totalThreats: number
  threatsToday: number
  threatsThisWeek: number
  threatsThisMonth: number
  severityBreakdown: {
    critical: number
    high: number
    medium: number
    low: number
  }
  topThreatTypes: { type: string; count: number }[]
}

export interface DashboardMetrics {
  totalRequests: number
  threatsDetected: number
  falsePositives: number
  averageResponseTime: number
  accuracy: number
  activeThreats: number
  blockedAttacks: number
  systemHealth: number
}

export interface DashboardOverview {
  totalThreats: number
  activeThreats: number
  threatsToday: number
  threatsThisWeek: number
  systemHealth: string
  lastUpdated: string
  alerts: { id: string; type: string; message: string; timestamp: string }[]
}

export interface ActivityEvent {
  id: string
  type: string
  description: string
  timestamp: string
  severity: string
}

export interface SystemStatus {
  status: string
  uptime: string
  version: string
  lastMaintenance: string
  services: { name: string; status: string }[]
  performance: { responseTime: string; throughput: string; errorRate: string }
}

export interface DeceptionEvent {
  id: string
  type: string
  ipAddress: string
  userAgent: string
  timestamp: string
  threatLevel: string
  details: Record<string, unknown>
}

export interface DeceptionStats {
  totalEvents: number
  eventsToday: number
  eventsThisWeek: number
  activeTraps: number
  trapTypes: Record<string, number>
  threatLevels: Record<string, number>
}

export interface DeceptionTrap {
  id: string
  type: string
  path?: string
  credential?: string
  filename?: string
  accessCount: number
  created: string
  status: string
}

export interface PerformanceMetrics {
  responseTime: { average: number; p95: number; p99: number; min: number; max: number }
  throughput: { requestsPerSecond: number; requestsPerMinute: number; requestsPerHour: number }
  errorRate: { percentage: number; totalErrors: number; errorTypes: Record<string, number> }
  systemResources: {
    cpu: { usage: number; cores: number; load: number[] }
    memory: { usage: number; total: string; available: string; used: string }
    disk: { usage: number; total: string; available: string; used: string }
    network: { bytesIn: number; bytesOut: number; connections: number }
  }
}

export interface ThreatMetrics {
  detection: {
    totalDetected: number; today: number; thisWeek: number; thisMonth: number
    accuracy: number; precision: number; recall: number; f1Score: number
  }
  falsePositives: { total: number; today: number; thisWeek: number; thisMonth: number; rate: number }
  falseNegatives: { total: number; today: number; thisWeek: number; thisMonth: number; rate: number }
  responseTime: { average: number; p95: number; p99: number }
}

export interface AnalyticsMetrics {
  userBehavior: {
    totalSessions: number; averageSessionDuration: number; uniqueUsers: number
    topUserAgents: { agent: string; count: number }[]
  }
  trafficPatterns: { hourly: number[]; daily: number[]; monthly: number[] }
  geographic: {
    topCountries: { country: string; count: number }[]
    topCities: { city: string; count: number }[]
  }
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { username, password }),
  logout: () => api.post<{ success: boolean; message?: string }>('/auth/logout'),
  verify: () => api.get<{ success: boolean; message?: string; user: { id: string; username: string; role: string } }>('/auth/verify'),
}

export const threatsApi = {
  list: () => api.get<ApiResponse<Threat[]> & { total: number }>('/threats'),
  getById: (id: string) => api.get<ApiResponse<Threat>>(`/threats/${id}`),
  stats: () => api.get<ApiResponse<ThreatStats>>('/threats/stats/summary'),
}

export const dashboardApi = {
  overview: () => api.get<ApiResponse<DashboardOverview>>('/dashboard/overview'),
  analytics: () => api.get<ApiResponse<Record<string, unknown>>>('/dashboard/analytics'),
  recentActivity: () => api.get<ApiResponse<ActivityEvent[]>>('/dashboard/recent-activity'),
  systemStatus: () => api.get<ApiResponse<SystemStatus>>('/dashboard/system-status'),
}

export const deceptionApi = {
  events: () => api.get<ApiResponse<DeceptionEvent[]> & { total: number }>('/deception/events'),
  stats: () => api.get<ApiResponse<DeceptionStats>>('/deception/stats'),
  traps: () => api.get<ApiResponse<DeceptionTrap[]>>('/deception/traps'),
  createTrap: (data: Partial<DeceptionTrap>) =>
    api.post<ApiResponse<DeceptionTrap>>('/deception/traps', data),
  deleteTrap: (id: string) => api.delete<ApiResponse<null>>(`/deception/traps/${id}`),
}

export const metricsApi = {
  performance: () => api.get<ApiResponse<PerformanceMetrics>>('/metrics/performance'),
  threats: () => api.get<ApiResponse<ThreatMetrics>>('/metrics/threats'),
  analytics: () => api.get<ApiResponse<AnalyticsMetrics>>('/metrics/analytics'),
  realtime: () => api.get<ApiResponse<Record<string, unknown>>>('/metrics/real-time'),
}

export { TOKEN_KEY }
export default api
