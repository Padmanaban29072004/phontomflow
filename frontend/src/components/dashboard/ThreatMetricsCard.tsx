import React from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

interface ThreatMetricsCardProps {
  title: string
  value: string
  icon: React.ReactNode
  color: string
  trend: string
  trendDirection: 'up' | 'down'
}

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  red: 'bg-red-50 text-red-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  yellow: 'bg-yellow-50 text-yellow-600',
}

const trendColorMap: Record<string, string> = {
  up: 'text-green-600',
  down: 'text-red-600',
}

export function ThreatMetricsCard({ title, value, icon, color, trend, trendDirection }: ThreatMetricsCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className={clsx('rounded-lg p-3', colorMap[color] || colorMap.blue)}>
          {icon}
        </div>
        <span className={clsx('text-sm font-medium', trendColorMap[trendDirection])}>
          {trend}
        </span>
      </div>
      <p className="mt-4 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{title}</p>
    </motion.div>
  )
}
