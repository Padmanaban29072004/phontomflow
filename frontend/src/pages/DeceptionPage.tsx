import React from 'react'
import { useQuery } from 'react-query'

interface DeceptionEvent {
  id: string; type: string; ipAddress: string; userAgent: string
  timestamp: string; threatLevel: string; details: Record<string, unknown>
}

interface DeceptionStats {
  totalEvents: number; eventsToday: number; eventsThisWeek: number
  activeTraps: number; trapTypes: Record<string, number>; threatLevels: Record<string, number>
}

interface DeceptionTrap {
  id: string; type: string; path?: string; credential?: string
  filename?: string; accessCount: number; created: string; status: string
}

const threatColors: Record<string, string> = {
  critical: 'bg-red-900/50 text-red-400',
  high: 'bg-orange-900/50 text-orange-400',
  medium: 'bg-yellow-900/50 text-yellow-400',
  low: 'bg-green-900/50 text-green-400',
}

const trapIcons: Record<string, string> = {
  honeypot: '🕳️',
  credential_trap: '🔑',
  decoy_file: '📄',
}

export function DeceptionPage() {
  const { data: eventsRes } = useQuery('deception-events', () =>
    fetch('/api/deception/events').then(r => r.json())
  )
  const { data: statsRes } = useQuery('deception-stats', () =>
    fetch('/api/deception/stats').then(r => r.json())
  )
  const { data: trapsRes } = useQuery('deception-traps', () =>
    fetch('/api/deception/traps').then(r => r.json())
  )

  const events: DeceptionEvent[] = eventsRes?.data ?? []
  const stats: DeceptionStats | null = statsRes?.data ?? null
  const traps: DeceptionTrap[] = trapsRes?.data ?? []

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Deception Layer</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
            <p className="text-sm text-gray-400">Total Events</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.totalEvents}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
            <p className="text-sm text-gray-400">Active Traps</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.activeTraps}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
            <p className="text-sm text-gray-400">Today</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.eventsToday}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
            <p className="text-sm text-gray-400">This Week</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.eventsThisWeek}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Active Traps</h2>
          {traps.length === 0 ? (
            <p className="text-sm text-gray-500">No traps deployed</p>
          ) : (
            <div className="space-y-3">
              {traps.map((trap) => (
                <div key={trap.id} className="flex items-center justify-between border-b border-gray-800 pb-3 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{trapIcons[trap.type] || '🪤'}</span>
                    <div>
                      <p className="text-sm font-medium text-white capitalize">{trap.type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-400">
                        {trap.path || trap.credential || trap.filename || trap.id}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{trap.accessCount} hits</p>
                    <span className="text-xs text-green-400 capitalize">{trap.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {stats && (
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Threat Levels</h2>
            <div className="space-y-3">
              {Object.entries(stats.threatLevels).map(([level, count]) => (
                <div key={level}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400 capitalize">{level}</span>
                    <span className="text-white font-medium">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-800">
                    <div
                      className="h-2 rounded-full bg-blue-600 transition-all"
                      style={{ width: `${stats.totalEvents > 0 ? (count / stats.totalEvents) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-950">
        <div className="border-b border-gray-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Deception Events</h2>
        </div>
        <div className="divide-y divide-gray-800">
          {events.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-500">No events recorded</p>
          ) : events.map((event) => (
            <div key={event.id} className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${threatColors[event.threatLevel] || ''}`}>
                  {event.threatLevel}
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{event.ipAddress}</p>
                  <p className="text-xs text-gray-400 capitalize">{event.type.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">{new Date(event.timestamp).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
