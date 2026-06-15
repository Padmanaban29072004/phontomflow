import React from 'react'
import { motion } from 'framer-motion'

interface ThreatMetricsCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color: 'blue' | 'red' | 'green' | 'purple' | 'yellow'
  trend?: string
  trendDirection?: 'up' | 'down'
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    border: 'border-blue-200',
    trendUp: 'text-blue-600',
    trendDown: 'text-blue-600',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'text-red-600',
    border: 'border-red-200',
    trendUp: 'text-red-600',
    trendDown: 'text-green-600',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'text-green-600',
    border: 'border-green-200',
    trendUp: 'text-green-600',
    trendDown: 'text-red-600',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'text-purple-600',
    border: 'border-purple-200',
    trendUp: 'text-purple-600',
    trendDown: 'text-purple-600',
  },
  yellow: {
    bg: 'bg-yellow-50',
    icon: 'text-yellow-600',
    border: 'border-yellow-200',
    trendUp: 'text-yellow-600',
    trendDown: 'text-yellow-600',
  },
}

export function ThreatMetricsCard({ title, value, icon, color, trend, trendDirection = 'up' }: ThreatMetricsCardProps) {
  const colors = colorClasses[color]

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`bg-white rounded-xl shadow-sm border ${colors.border} p-6 transition-all duration-200 hover:shadow-md`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <div className="flex items-center mt-2">
              <span className={`text-sm font-medium ${trendDirection === 'up' ? colors.trendUp : colors.trendDown}`}>
                {trendDirection === 'up' ? '\u2191' : '\u2193'} {trend}
              </span>
              <span className="text-xs text-gray-500 ml-2">vs last hour</span>
            </div>
          )}
        </div>
        <div className={`${colors.bg} p-3 rounded-lg flex-shrink-0 ml-4`}>
          <div className={colors.icon}>{icon}</div>
        </div>
      </div>
    </motion.div>
  )
}
