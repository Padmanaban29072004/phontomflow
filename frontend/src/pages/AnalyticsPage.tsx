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

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']

export const AnalyticsPage: React.FC = () => {
  useQuery(
    'analytics',
    () =>
      api.get('/dashboard/analytics').catch(() => {
        return { data: null }
      }),
    {
      refetchInterval: 30000,
      retry: 1,
    }
  )

  useQuery(
    'metrics',
    () =>
      api.get('/metrics/analytics').catch(() => {
        return { data: null }
      }),
    {
      refetchInterval: 30000,
      retry: 1,
    }
  )

  const threatTrendData = STATIC_THREAT_TREND_DATA
  const threatTypeData = STATIC_THREAT_TYPE_DATA
  const riskDistributionData = STATIC_RISK_DISTRIBUTION_DATA

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 gap-4">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Analytics & Insights</h1>
        <p className="text-sm text-gray-500">Comprehensive threat analysis and performance metrics</p>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col min-h-0">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex-shrink-0">Threat Trends (24h)</h2>
          <div className="flex-1 min-h-[200px]">
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

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col min-h-0">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex-shrink-0">Threat Types</h2>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={threatTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
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

      <div className="flex-shrink-0 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Risk Level Distribution</h2>
        <div className="h-48 sm:h-56">
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
    </div>
  )
}
