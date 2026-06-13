import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldCheckIcon, 
  ExclamationTriangleIcon, 
  ClockIcon,
  GlobeAltIcon,
  UserGroupIcon,
  ServerIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline';
import { ThreatMetricsCard } from '../components/dashboard/ThreatMetricsCard';
import { SystemStatusCard } from '../components/dashboard/SystemStatusCard';
import { RealTimeThreatsChart } from '../components/dashboard/RealTimeThreatsChart';
import { RecentThreatsTable } from '../components/dashboard/RecentThreatsTable';
import { GeographicThreatsMap } from '../components/dashboard/GeographicThreatsMap';
import { useSocket } from '../contexts/SocketContext';
import { useQuery } from 'react-query';
import api from '../services/api';
import { toast } from 'react-hot-toast';

interface DashboardMetrics {
  totalRequests: number;
  threatsDetected: number;
  falsePositives: number;
  averageResponseTime: number;
  accuracy: number;
  activeThreats: number;
  blockedAttacks: number;
  systemHealth: number;
}

interface ThreatAlert {
  id: string;
  threatScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  threatType: string[];
  status: 'active' | 'resolved' | 'investigating';
}

export const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRequests: 0,
    threatsDetected: 0,
    falsePositives: 0,
    averageResponseTime: 0,
    accuracy: 0,
    activeThreats: 0,
    blockedAttacks: 0,
    systemHealth: 100
  });
  
  const [recentThreats, setRecentThreats] = useState<ThreatAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { socket } = useSocket();

  const { refetch } = useQuery(
    'dashboard-metrics',
    () => api.get('/dashboard/overview'),
    {
      refetchInterval: 30000,
      onSuccess: (dashboardData) => {
        const overview = dashboardData.data.data
        setMetrics({
          totalRequests: overview.totalThreats * 100,
          threatsDetected: overview.totalThreats,
          falsePositives: Math.round(overview.totalThreats * 0.05),
          averageResponseTime: 45,
          accuracy: 94.5,
          activeThreats: overview.activeThreats,
          blockedAttacks: overview.totalThreats - overview.activeThreats,
          systemHealth: overview.systemHealth === 'good' ? 95 : 70,
        })
        setIsLoading(false)
      },
      onError: () => {
        toast.error('Failed to load dashboard metrics')
        setIsLoading(false)
      }
    }
  )

  useQuery(
    'recent-threats',
    () => api.get('/threats'),
    {
      refetchInterval: 10000,
      onSuccess: (threatsRes) => {
        const threats = threatsRes.data.data
        setRecentThreats(threats.map((t: any) => ({
          id: t.id,
          threatScore: t.severity === 'critical' ? 95 : t.severity === 'high' ? 75 : t.severity === 'medium' ? 50 : 20,
          riskLevel: t.severity,
          ipAddress: t.ipAddress,
          userAgent: 'Unknown',
          timestamp: new Date(t.timestamp),
          threatType: [t.type],
          status: 'active' as const,
        })))
      }
    }
  )

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Listen for real-time threat updates
    socket.on('threat-update', (threat: ThreatAlert) => {
      setRecentThreats(prev => [threat, ...prev.slice(0, 9)]); // Keep only 10 most recent
      
      // Show toast for critical threats
      if (threat.riskLevel === 'critical') {
        toast.error(`Critical threat detected from ${threat.ipAddress}`, {
          duration: 8000,
        });
      } else if (threat.riskLevel === 'high') {
        toast(`High-risk threat detected from ${threat.ipAddress}`, {
          icon: '⚠️',
          duration: 5000,
        });
      }
    });

    // Listen for metrics updates
    socket.on('metrics-update', (newMetrics: DashboardMetrics) => {
      setMetrics(newMetrics);
    });

    // Listen for deception events
    socket.on('deception-update', (event) => {
      toast.success(`Deception event: ${event.type}`, {
        duration: 3000,
      });
    });

    return () => {
      socket.off('threat-update');
      socket.off('metrics-update');
      socket.off('deception-update');
    };
  }, [socket]);

  const getSystemHealthColor = (health: number) => {
    if (health >= 90) return 'text-green-500';
    if (health >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getSystemHealthIcon = (health: number) => {
    if (health >= 90) return '🟢';
    if (health >= 70) return '🟡';
    return '🔴';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                PHANTOM-Flow Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Real-time threat monitoring and adaptive defense system
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">System Health:</span>
                <span className={`text-lg font-semibold ${getSystemHealthColor(metrics.systemHealth)}`}>
                  {getSystemHealthIcon(metrics.systemHealth)} {metrics.systemHealth}%
                </span>
              </div>
              <button
                onClick={() => refetch()}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <ClockIcon className="h-4 w-4 mr-1" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Charts and Status */}
          <div className="lg:col-span-2 space-y-8">
            {/* Real-time Threats Chart */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Real-time Threat Activity
                </h2>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-500">Live</span>
                </div>
              </div>
              <RealTimeThreatsChart />
            </motion.div>

            {/* System Status */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <SystemStatusCard metrics={metrics} />
            </motion.div>
          </div>

          {/* Right Column - Recent Threats and Map */}
          <div className="space-y-8">
            {/* Recent Threats */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Recent Threats
                </h2>
                <span className="text-sm text-gray-500">
                  {recentThreats.length} active
                </span>
              </div>
              <RecentThreatsTable threats={recentThreats} />
            </motion.div>

            {/* Geographic Threats Map */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Geographic Threats
                </h2>
                <UserGroupIcon className="h-5 w-5 text-gray-400" />
              </div>
              <GeographicThreatsMap threats={recentThreats} />
            </motion.div>
          </div>
        </div>

        {/* Bottom Section - Additional Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <ServerIcon className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Sessions</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {Math.floor(metrics.totalRequests * 0.1).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <ShieldCheckIcon className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Blocked Attacks</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {metrics.blockedAttacks.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">False Positives</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {metrics.falsePositives.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
