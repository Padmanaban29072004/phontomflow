import { useQuery } from 'react-query'
import api from '../services/api'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  STATIC_THREAT_TREND_DATA,
  STATIC_THREAT_TYPE_DATA,
  STATIC_RISK_DISTRIBUTION_DATA,
} from '../services/mockData'
import { BanditPerformancePanel } from '../components/analytics/BanditPerformancePanel'
import { PageShell } from '../components/layout/PageShell'

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']

export function AnalyticsPage() {
  console.log('AnalyticsPage render!')
  useQuery('analytics', () => api.get('/dashboard/analytics'), {
    refetchInterval: 30000,
    retry: 1,
  })

  useQuery('metrics', () => api.get('/metrics/analytics'), {
    refetchInterval: 30000,
    retry: 1,
  })

  const threatTrendData = STATIC_THREAT_TREND_DATA
  const threatTypeData = STATIC_THREAT_TYPE_DATA
  const riskDistributionData = STATIC_RISK_DISTRIBUTION_DATA

  return (
    <PageShell
      title="Analytics & Insights"
      description="Comprehensive threat analysis and performance metrics"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Threat Trends (24h)</h2>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={threatTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="threats" stroke="#ef4444" name="Threats" />
                <Line type="monotone" dataKey="blocked" stroke="#10b981" name="Blocked" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Threat Types</h2>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={threatTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {threatTypeData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Risk Level Distribution</h2>
        <div className="h-56 w-full sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={riskDistributionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="level" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <BanditPerformancePanel />
    </PageShell>
  )
}
