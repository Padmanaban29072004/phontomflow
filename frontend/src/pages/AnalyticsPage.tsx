import React from 'react'
import { useQuery } from 'react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

interface AnalyticsData {
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

export function AnalyticsPage() {
  const { data: res } = useQuery('analytics-metrics', () =>
    fetch('/api/metrics/analytics').then(r => r.json())
  )

  const analytics: AnalyticsData | null = res?.data ?? null

  const hourlyData = analytics?.trafficPatterns.hourly.map((v, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    requests: v,
  })) ?? []

  const dailyData = analytics?.trafficPatterns.daily.map((v, i) => ({
    day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i] || `Day ${i + 1}`,
    requests: v,
  })) ?? []

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Analytics</h1>

      {analytics && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
            <p className="text-sm text-gray-400">Total Sessions</p>
            <p className="text-2xl font-bold text-white mt-1">{analytics.userBehavior.totalSessions.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
            <p className="text-sm text-gray-400">Unique Users</p>
            <p className="text-2xl font-bold text-white mt-1">{analytics.userBehavior.uniqueUsers.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
            <p className="text-sm text-gray-400">Avg Session</p>
            <p className="text-2xl font-bold text-white mt-1">{Math.round(analytics.userBehavior.averageSessionDuration / 60)}m</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Hourly Traffic</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '8px', fontSize: '13px' }} />
                <Line type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-950 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Daily Traffic</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '8px', fontSize: '13px' }} />
                <Bar dataKey="requests" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Top Countries</h2>
          <div className="space-y-3">
            {analytics?.geographic.topCountries.map((c) => (
              <div key={c.country} className="flex items-center justify-between border-b border-gray-800 pb-2">
                <span className="text-sm text-gray-300">{c.country}</span>
                <span className="text-sm font-medium text-white">{c.count}</span>
              </div>
            )) ?? <p className="text-sm text-gray-500">No data</p>}
          </div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-950 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">User Agents</h2>
          <div className="space-y-3">
            {analytics?.userBehavior.topUserAgents.map((ua) => (
              <div key={ua.agent} className="flex items-center justify-between border-b border-gray-800 pb-2">
                <span className="text-sm text-gray-300">{ua.agent}</span>
                <span className="text-sm font-medium text-white">{ua.count}</span>
              </div>
            )) ?? <p className="text-sm text-gray-500">No data</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
