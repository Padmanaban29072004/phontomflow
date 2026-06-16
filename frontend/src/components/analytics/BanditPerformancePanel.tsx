import { useState, useMemo, useEffect } from 'react'
import { useQuery } from 'react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { banditApi, BanditStatsResponse, BanditStatsEntry } from '../../services/api'

const ACTION_ORDER = ['allow', 'monitor', 'warn', 'restrict', 'block', 'isolate', 'divert']
const ACTION_LABELS: Record<string, string> = {
  allow: 'Allow',
  monitor: 'Monitor',
  warn: 'Warn',
  restrict: 'Restrict',
  block: 'Block',
  isolate: 'Isolate',
  divert: 'Divert',
}
const SEVERITY_COLORS: Record<string, string> = {
  allow: '#10b981',
  monitor: '#34d399',
  warn: '#fbbf24',
  restrict: '#f59e0b',
  block: '#f97316',
  isolate: '#ef4444',
  divert: '#dc2626',
}

function formatContextLabel(ctx: string): string {
  return ctx
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function BanditPerformancePanel() {
  const [selectedContext, setSelectedContext] = useState<string>('')

  const { data: statsResp, isLoading: statsLoading } = useQuery(
    'bandit-stats',
    () => banditApi.stats(),
    { refetchInterval: 30000, retry: 1 },
  )

  const { data: actionsResp } = useQuery(
    'bandit-actions',
    () => banditApi.actions(),
    { staleTime: 60000, retry: 1 },
  )

  const banditData = statsResp?.data?.data as BanditStatsResponse | undefined
  const actionsData = actionsResp?.data?.data as {
    actions: { id: string; description: string; severity: number }[]
    contextBuckets: string[]
  } | undefined

  const contextBuckets = actionsData?.contextBuckets?.length
    ? actionsData.contextBuckets
    : Object.keys(banditData?.contexts ?? {})

  const activeContext = selectedContext && contextBuckets.includes(selectedContext)
    ? selectedContext
    : (contextBuckets[0] || '')

  const currentStats = banditData?.contexts?.[activeContext] ?? null
  const feedbackStats = banditData?.feedback ?? { totalFeedback: 0, signalCounts: {}, recentRewardAvg: 0 }
  const config = banditData?.config ?? {}

  console.log('BanditPerformancePanel render:', { selectedContext, activeContext, contextBucketsLength: contextBuckets.length, statsLoaded: !!banditData, actionsLoaded: !!actionsData })

  const winRateData = useMemo(() => {
    if (!currentStats?.actions) return []
    return ACTION_ORDER
      .filter((action) => currentStats.actions[action])
      .map((action) => {
        const entry: BanditStatsEntry = currentStats.actions[action]
        const total = entry.alpha + entry.beta
        return {
          name: ACTION_LABELS[action] || action,
          action,
          winRate: total > 0 ? (entry.alpha / total) * 100 : 50,
          selectionCount: entry.selectionCount,
          avgReward: entry.avgReward,
        }
      })
  }, [currentStats])

  const bestAction = currentStats?.currentBestAction
    ? ACTION_LABELS[currentStats.currentBestAction] || currentStats.currentBestAction
    : '—'

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4 flex-shrink-0 flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Bandit Performance</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Context:</label>
          <select
            value={activeContext}
            onChange={(e) => setSelectedContext(e.target.value)}
            disabled={contextBuckets.length === 0}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[240px] disabled:opacity-50"
          >
            {contextBuckets.length === 0 ? (
              <option value="">No contexts</option>
            ) : (
              contextBuckets.map((ctx) => (
                <option key={ctx} value={ctx}>{formatContextLabel(ctx)}</option>
              ))
            )}
          </select>
        </div>
      </div>

      {statsLoading ? (
        <div className="flex items-center justify-center h-48 text-sm text-gray-400">Loading bandit data...</div>
      ) : !currentStats || contextBuckets.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-gray-400">
          No bandit data available yet. Process traffic through the backend to populate learning stats.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Total Selections</p>
              <p className="text-xl font-bold text-gray-900">{currentStats.totalSelections}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Best Action</p>
              <p className="text-xl font-bold text-gray-900">{bestAction}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Best Action Probability</p>
              <p className="text-xl font-bold text-gray-900">
                {currentStats.bestActionProbability != null
                  ? `${(currentStats.bestActionProbability * 100).toFixed(1)}%`
                  : '—'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Recent Avg Reward</p>
              <p className="text-xl font-bold text-gray-900">{feedbackStats.recentRewardAvg.toFixed(3)}</p>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Arm Win Rates (alpha / (alpha + beta))</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={winRateData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="winRate" name="Win Rate" radius={[0, 4, 4, 0]}>
                    {winRateData.map((entry) => (
                      <Cell key={entry.action} fill={SEVERITY_COLORS[entry.action] || '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Selection Counts</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {winRateData.map((entry) => (
                <div
                  key={entry.action}
                  className={`rounded-lg p-2 text-center ${
                    entry.action === currentStats.currentBestAction
                      ? 'bg-blue-50 ring-1 ring-blue-300'
                      : 'bg-gray-50'
                  }`}
                >
                  <p
                    className="text-xs font-medium"
                    style={{ color: SEVERITY_COLORS[entry.action] }}
                  >
                    {entry.name}
                  </p>
                  <p className="text-sm font-bold text-gray-900">{entry.selectionCount}</p>
                  <p className="text-xs text-gray-400">{entry.avgReward.toFixed(3)}</p>
                </div>
              ))}
            </div>
          </div>

          {feedbackStats.totalFeedback > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Total feedback signals collected: <strong>{feedbackStats.totalFeedback}</strong>
                {Object.keys(feedbackStats.signalCounts).length > 0 && (
                  <span> · Signals: {Object.entries(feedbackStats.signalCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}</span>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Exploration rate: {((config as Record<string, number>).explorationRate ?? 0.1) * 100}% · Min samples: {(config as Record<string, number>).minSamples ?? 10}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
