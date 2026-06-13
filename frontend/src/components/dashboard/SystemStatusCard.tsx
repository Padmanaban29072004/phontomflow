import React from 'react'
import { motion } from 'framer-motion'

interface DashboardMetrics {
  totalRequests: number
  threatsDetected: number
  falsePositives: number
  averageResponseTime: number
  accuracy: number
  activeThreats: number
  blockedAttacks: number
  systemHealth: number
}

interface SystemStatusCardProps {
  metrics: DashboardMetrics
}

const serviceItems = [
  { label: 'Threat Detection', key: 'accuracy', format: (v: number) => `${v.toFixed(1)}%` },
  { label: 'Active Threats', key: 'activeThreats', format: (v: number) => v.toString() },
  { label: 'Blocked Attacks', key: 'blockedAttacks', format: (v: number) => v.toString() },
  { label: 'Response Time', key: 'averageResponseTime', format: (v: number) => `${v}ms` },
  { label: 'False Positives', key: 'falsePositives', format: (v: number) => v.toString() },
]

export function SystemStatusCard({ metrics }: SystemStatusCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative h-16 w-16">
          <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e5e7eb" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.5" fill="none"
              stroke={metrics.systemHealth >= 90 ? '#22c55e' : metrics.systemHealth >= 70 ? '#eab308' : '#ef4444'}
              strokeWidth="3"
              strokeDasharray={`${metrics.systemHealth} ${100 - metrics.systemHealth}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">
            {metrics.systemHealth}%
          </span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">System Health</p>
          <p className="text-xs text-gray-500">
            {metrics.systemHealth >= 90 ? 'All systems operational' :
             metrics.systemHealth >= 70 ? 'Minor issues detected' :
             'Critical attention required'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {serviceItems.map((item) => {
          const value = metrics[item.key as keyof DashboardMetrics] as number
          return (
            <div key={item.key} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
              <span className="text-sm text-gray-600">{item.label}</span>
              <span className="text-sm font-semibold text-gray-900">{item.format(value)}</span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
