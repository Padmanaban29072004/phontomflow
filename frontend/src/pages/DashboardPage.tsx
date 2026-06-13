import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  GlobeAltIcon,
  UserGroupIcon,
  ServerIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline'
import { ThreatMetricsCard } from '../components/dashboard/ThreatMetricsCard'
import { SystemStatusCard } from '../components/dashboard/SystemStatusCard'
import { RealTimeThreatsChart } from '../components/dashboard/RealTimeThreatsChart'
import { RecentThreatsTable } from '../components/dashboard/RecentThreatsTable'
import { GeographicThreatsMap } from '../components/dashboard/GeographicThreatsMap'
import { useSocket } from '../contexts/SocketContext'
import { useQuery } from 'react-query'
import api from '../services/api'
import { toast } from 'react-hot-toast'
import {
  STATIC_DASHBOARD_METRICS,
  STATIC_THREATS,
  MockDashboardMetrics,
  MockThreat,
} from '../services/mockData'

type DashboardMetrics = MockDashboardMetrics

interface ThreatAlert extends MockThreat {
  timestamp: Date | string
}

export const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    ...STATIC_DASHBOARD_METRICS,
  })

  const [recentThreats, setRecentThreats] = useState<ThreatAlert[]>(STATIC_THREATS.slice(0, 50))
  const [isLoading, setIsLoading] = useState(true)

  const { socket } = useSocket()

  const { refetch } = useQuery(
    'dashboard-overview',
    async () => {
      try {
        const response = await api.get('/dashboard/overview')
        return response
      } catch {
        setMetrics(STATIC_DASHBOARD_METRICS)
        return { data: { data: STATIC_DASHBOARD_METRICS } } as any
      }
    },
    {
      refetchInterval: 30000,
      onSuccess: (data: any) => {
        if (data?.data) {
          const source = data.data.data || data.data
          setMetrics({
            totalRequests: source.totalRequests ?? metrics.totalRequests,
            threatsDetected: source.threatsDetected ?? metrics.threatsDetected,
            falsePositives: source.falsePositives ?? metrics.falsePositives,
            averageResponseTime: source.averageResponseTime ?? metrics.averageResponseTime,
            accuracy: source.accuracy ?? metrics.accuracy,
            activeThreats: source.activeThreats ?? metrics.activeThreats,
            blockedAttacks: source.blockedAttacks ?? metrics.blockedAttacks,
            systemHealth: source.systemHealth ?? metrics.systemHealth,
          })
          setIsLoading(false)
        }
      },
      onError: () => {
        setIsLoading(false)
      },
    }
  )

  useQuery(
    'recent-threats',
    async () => {
      try {
        const response = await api.get('/threats')
        return response
      } catch {
        setRecentThreats(STATIC_THREATS.slice(0, 50) as any)
        return { data: STATIC_THREATS } as any
      }
    },
    {
      refetchInterval: 10000,
      onSuccess: (data: any) => {
        if (data?.data && Array.isArray(data.data)) {
          setRecentThreats(
            data.data.slice(0, 50).map((threat: any) => ({
              ...threat,
              timestamp: threat.timestamp || new Date(),
            }))
          )
        }
      },
    }
  )

  useEffect(() => {
    if (!socket) return

    const handleThreatUpdate = (threat: ThreatAlert) => {
      setRecentThreats(prev => [threat, ...prev.slice(0, 9)])

      if (threat.riskLevel === 'critical') {
        toast.error(`Critical threat detected from ${threat.ipAddress}`, {
          duration: 8000,
        })
      } else if (threat.riskLevel === 'high') {
        toast(`High-risk threat detected from ${threat.ipAddress}`, {
          icon: '\u26A0\uFE0F',
          duration: 5000,
        })
      }
    }

    const handleMetricsUpdate = (newMetrics: DashboardMetrics) => {
      setMetrics(newMetrics)
    }

    const handleDeceptionUpdate = (event: { type: string; [key: string]: any }) => {
      toast.success(`Deception event: ${event.type}`, {
        duration: 3000,
      })
    }

    socket.on('threat-update', handleThreatUpdate)
    socket.on('metrics-update', handleMetricsUpdate)
    socket.on('deception-update', handleDeceptionUpdate)

    return () => {
      socket.off('threat-update', handleThreatUpdate)
      socket.off('metrics-update', handleMetricsUpdate)
      socket.off('deception-update', handleDeceptionUpdate)
    }
  }, [socket])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center flex-1 min-h-[50vh]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 gap-4">
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PHANTOM-Flow Dashboard</h1>
            <p className="text-sm text-gray-500">Real-time threat monitoring and adaptive defense</p>
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <ClockIcon className="h-4 w-4 mr-1" />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <ThreatMetricsCard
            title="Total Requests"
            value={metrics.totalRequests.toLocaleString()}
            icon={<GlobeAltIcon className="h-6 w-6" />}
            color="blue"
            trend="+12.5%"
            trendDirection="up"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <ThreatMetricsCard
            title="Threats Detected"
            value={metrics.threatsDetected.toLocaleString()}
            icon={<ExclamationTriangleIcon className="h-6 w-6" />}
            color="red"
            trend="+8.2%"
            trendDirection="up"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <ThreatMetricsCard
            title="Detection Accuracy"
            value={`${metrics.accuracy.toFixed(1)}%`}
            icon={<ShieldCheckIcon className="h-6 w-6" />}
            color="green"
            trend="+2.1%"
            trendDirection="up"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <ThreatMetricsCard
            title="Response Time"
            value={`${metrics.averageResponseTime}ms`}
            icon={<CpuChipIcon className="h-6 w-6" />}
            color="purple"
            trend="-15.3%"
            trendDirection="down"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <ThreatMetricsCard
            title="Active Sessions"
            value={Math.floor(metrics.totalRequests * 0.1).toLocaleString()}
            icon={<ServerIcon className="h-6 w-6" />}
            color="blue"
            trend="+5.4%"
            trendDirection="up"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <ThreatMetricsCard
            title="Blocked Attacks"
            value={metrics.blockedAttacks.toLocaleString()}
            icon={<ShieldCheckIcon className="h-6 w-6" />}
            color="green"
            trend="+3.8%"
            trendDirection="up"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <ThreatMetricsCard
            title="False Positives"
            value={metrics.falsePositives.toLocaleString()}
            icon={<ExclamationTriangleIcon className="h-6 w-6" />}
            color="red"
            trend="-1.2%"
            trendDirection="down"
          />
        </motion.div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex-1 min-h-0 bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col"
          >
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">
                Real-time Threat Activity
              </h2>
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm text-gray-500">Live</span>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <RealTimeThreatsChart className="h-full min-h-[180px]" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex-shrink-0"
          >
            <SystemStatusCard metrics={metrics} />
          </motion.div>
        </div>

        <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex-1 min-h-0 bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Threats
              </h2>
              <span className="text-sm text-gray-500">
                {recentThreats.length} active
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <RecentThreatsTable threats={recentThreats} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex-shrink-0 bg-white rounded-lg shadow-sm border border-gray-200 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Geographic Threats
              </h2>
              <UserGroupIcon className="h-5 w-5 text-gray-400" />
            </div>
            <GeographicThreatsMap threats={recentThreats} />
          </motion.div>
        </div>
      </div>
    </div>
  )
}
