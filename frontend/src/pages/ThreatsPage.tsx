import React from 'react'
import { useQuery } from 'react-query'

interface Threat {
  id: string; type: string; severity: string; ipAddress: string; timestamp: string; description: string
}

interface ThreatStats {
  totalThreats: number; threatsToday: number; threatsThisWeek: number; threatsThisMonth: number
  severityBreakdown: { critical: number; high: number; medium: number; low: number }
  topThreatTypes: { type: string; count: number }[]
}

export function ThreatsPage() {
  const { data: threatsRes } = useQuery('threats', () =>
    fetch('/api/threats').then(r => r.json())
  )
  const { data: statsRes } = useQuery('threat-stats', () =>
    fetch('/api/threats/stats/summary').then(r => r.json())
  )

  const threats: Threat[] = threatsRes?.data ?? []
  const stats: ThreatStats | null = statsRes?.data ?? null

  const sevColors: Record<string, string> = {
    critical: 'bg-red-900/50 text-red-400 border-red-800',
    high: 'bg-orange-900/50 text-orange-400 border-orange-800',
    medium: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
    low: 'bg-green-900/50 text-green-400 border-green-800',
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Threat Analysis</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
            <p className="text-sm text-gray-400">Total Threats</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.totalThreats}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
            <p className="text-sm text-gray-400">Today</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.threatsToday}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
            <p className="text-sm text-gray-400">This Week</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.threatsThisWeek}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
            <p className="text-sm text-gray-400">This Month</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.threatsThisMonth}</p>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Severity Breakdown</h2>
            <div className="space-y-3">
              {Object.entries(stats.severityBreakdown).map(([key, value]) => {
                const pct = stats.totalThreats > 0 ? (value / stats.totalThreats) * 100 : 0
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400 capitalize">{key}</span>
                      <span className="text-white font-medium">{value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-800">
                      <div
                        className="h-2 rounded-full bg-blue-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Top Threat Types</h2>
            <div className="space-y-3">
              {stats.topThreatTypes.map((t) => (
                <div key={t.type} className="flex items-center justify-between border-b border-gray-800 pb-2">
                  <span className="text-gray-300 text-sm capitalize">{t.type.replace(/_/g, ' ')}</span>
                  <span className="text-white font-medium">{t.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-800 bg-gray-950">
        <div className="border-b border-gray-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">All Threats</h2>
        </div>
        <div className="divide-y divide-gray-800">
          {threats.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-500">No threats detected</p>
          ) : threats.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <span className={`rounded border px-2 py-0.5 text-xs font-medium ${sevColors[t.severity] || ''}`}>
                  {t.severity}
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{t.ipAddress}</p>
                  <p className="text-xs text-gray-400">{t.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 capitalize">{t.type.replace(/_/g, ' ')}</p>
                <p className="text-xs text-gray-500">{new Date(t.timestamp).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
