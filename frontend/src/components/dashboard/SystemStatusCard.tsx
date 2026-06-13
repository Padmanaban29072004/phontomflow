import React from 'react'
import { CheckCircleIcon, ExclamationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

interface SystemMetrics {
  systemHealth: number
  averageResponseTime: number
  accuracy: number
}

interface SystemStatusCardProps {
  metrics: SystemMetrics
}

const getHealthStatus = (health: number) => {
  if (health >= 90) return { status: 'excellent', color: 'green', icon: CheckCircleIcon }
  if (health >= 70) return { status: 'good', color: 'yellow', icon: ExclamationCircleIcon }
  return { status: 'warning', color: 'red', icon: XCircleIcon }
}

export function SystemStatusCard({ metrics }: SystemStatusCardProps) {
  const healthStatus = getHealthStatus(metrics.systemHealth)
  const StatusIcon = healthStatus.icon

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">System Status</h2>
        <div className={`flex items-center space-x-2 text-${healthStatus.color}-600`}>
          <StatusIcon className="h-6 w-6" />
          <span className="text-sm font-medium capitalize">{healthStatus.status}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600">System Health</span>
            <span className="text-sm font-semibold text-gray-900">{metrics.systemHealth}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`bg-${healthStatus.color}-500 h-2 rounded-full transition-all duration-500`}
              style={{ width: `${metrics.systemHealth}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600">Detection Accuracy</span>
            <span className="text-sm font-semibold text-gray-900">{metrics.accuracy.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${metrics.accuracy}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600">Average Response Time</span>
            <span className="text-sm font-semibold text-gray-900">{metrics.averageResponseTime}ms</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (1000 - metrics.averageResponseTime) / 10)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
