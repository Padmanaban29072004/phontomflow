import React from 'react'
import clsx from 'clsx'

interface ThreatAlert {
  id: string
  threatScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ipAddress: string
  userAgent: string
  timestamp: Date
  threatType: string[]
  status: 'active' | 'resolved' | 'investigating'
}

interface RecentThreatsTableProps {
  threats: ThreatAlert[]
}

const riskColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
}

const statusColors: Record<string, string> = {
  active: 'bg-red-100 text-red-800',
  investigating: 'bg-blue-100 text-blue-800',
  resolved: 'bg-gray-100 text-gray-800',
}

function formatTimestamp(date: Date): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()

  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString()
}

export function RecentThreatsTable({ threats }: RecentThreatsTableProps) {
  if (threats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <svg className="h-10 w-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm">No threats detected</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {threats.slice(0, 5).map((threat) => (
        <div
          key={threat.id}
          className="flex items-start justify-between rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={clsx('rounded px-2 py-0.5 text-xs font-medium', riskColors[threat.riskLevel])}>
                {threat.riskLevel}
              </span>
              <span className="text-sm font-medium text-gray-900 truncate">{threat.ipAddress}</span>
            </div>
            <p className="mt-1 text-xs text-gray-500 truncate">{threat.threatType.join(', ')}</p>
          </div>
          <div className="ml-3 flex flex-col items-end gap-1">
            <span className={clsx('rounded px-2 py-0.5 text-xs font-medium', statusColors[threat.status])}>
              {threat.status}
            </span>
            <span className="text-xs text-gray-400">{formatTimestamp(threat.timestamp)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
