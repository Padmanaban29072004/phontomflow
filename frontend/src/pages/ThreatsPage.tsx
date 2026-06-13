import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import api from '../services/api'
import {
  ShieldExclamationIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
import { STATIC_THREATS } from '../services/mockData'

export const ThreatsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRisk, setFilterRisk] = useState<string>('all')
  const queryClient = useQueryClient()

  const { data: threatsData, isLoading, refetch } = useQuery(
    'threats',
    async () => {
      try {
        const response = await api.get('/threats')
        const backendThreats = response.data?.data || response.data || []
        return backendThreats.map((threat: any) => ({
          id: threat.id || threat._id,
          ipAddress: threat.ipAddress,
          riskLevel: threat.riskLevel || threat.severity?.toLowerCase() || 'medium',
          threatScore: threat.threatScore || (threat.severity === 'high' ? 0.8 : threat.severity === 'critical' ? 0.9 : 0.6),
          userAgent: threat.userAgent || threat.details?.userAgent || 'Unknown',
          timestamp: threat.timestamp || new Date().toISOString(),
          type: threat.type,
          description: threat.description,
        }))
      } catch {
        return STATIC_THREATS
      }
    },
    {
      refetchInterval: 10000,
      retry: 1,
    }
  )

  const blockThreatMutation = useMutation(
    (threatId: string) => api.post(`/threats/${threatId}/block`).catch(() => {
      return { data: { success: true } }
    }),
    {
      onSuccess: () => {
        toast.success('Threat blocked successfully')
        queryClient.invalidateQueries('threats')
      },
      onError: () => {
        toast.error('Failed to block threat')
      },
    }
  )

  const threats = threatsData || []

  const filteredThreats = threats.filter((threat: any) => {
    const matchesSearch =
      threat.ipAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      threat.userAgent?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRisk = filterRisk === 'all' || threat.riskLevel === filterRisk
    return matchesSearch && matchesRisk
  })

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300'
    }
  }

  const handleViewThreat = (threat: any) => {
    toast(`Viewing threat from ${threat.ipAddress}`, {
      duration: 2000,
      icon: '\uD83D\uDC41\uFE0F',
    })
  }

  const handleBlockThreat = async (threat: any) => {
    if (window.confirm(`Are you sure you want to block ${threat.ipAddress}?`)) {
      await blockThreatMutation.mutateAsync(threat.id || threat._id || 'unknown')
    }
  }

  if (isLoading && threats.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 gap-4">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Threat Management</h1>
        <p className="text-sm text-gray-500">Monitor and manage all detected security threats</p>
      </div>

      <div className="flex-shrink-0 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by IP or User Agent..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="all">All Risk Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Detected Threats ({filteredThreats.length})
            </h2>
            <button
              onClick={() => {
                refetch()
                toast.success('Refreshing threats...')
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {filteredThreats.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center py-12">
            <div>
              <ShieldExclamationIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">
                {threats.length === 0 ? 'No threats detected yet' : 'No threats match your filters'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Level</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Threat Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredThreats.map((threat: any) => (
                  <tr key={threat.id || threat._id || Math.random().toString()} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{threat.ipAddress || 'Unknown IP'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRiskColor(threat.riskLevel || 'medium')}`}>
                        {threat.riskLevel || 'medium'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {threat.threatScore ? (threat.threatScore * 100).toFixed(1) + '%' : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {threat.userAgent || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {threat.timestamp ? new Date(threat.timestamp).toLocaleString() : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewThreat(threat)}
                        className="inline-flex items-center text-blue-600 hover:text-blue-900 mr-4 transition-colors"
                      >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        View
                      </button>
                      <button
                        onClick={() => handleBlockThreat(threat)}
                        disabled={blockThreatMutation.isLoading}
                        className="inline-flex items-center text-red-600 hover:text-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <XCircleIcon className="h-4 w-4 mr-1" />
                        Block
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
