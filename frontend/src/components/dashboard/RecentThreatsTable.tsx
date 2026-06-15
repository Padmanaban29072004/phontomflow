import { ShieldExclamationIcon, GlobeAltIcon } from '@heroicons/react/24/outline'

interface Threat {
  id: string
  threatScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ipAddress: string
  userAgent: string
  timestamp: Date | string
  threatType: string[]
  status: 'active' | 'resolved' | 'investigating'
}

interface RecentThreatsTableProps {
  threats: Threat[]
}

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    default:
      return 'bg-blue-100 text-blue-800 border-blue-200'
  }
}

export function RecentThreatsTable({ threats }: RecentThreatsTableProps) {
  if (threats.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <ShieldExclamationIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p>No recent threats detected</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              IP Address
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Risk
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Score
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Time
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {threats.slice(0, 10).map((threat) => (
            <tr key={threat.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-3 whitespace-nowrap">
                <div className="flex items-center">
                  <GlobeAltIcon className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm font-medium text-gray-900">{threat.ipAddress}</span>
                </div>
              </td>
              <td className="px-3 py-3 whitespace-nowrap">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRiskColor(
                    threat.riskLevel
                  )}`}
                >
                  {threat.riskLevel}
                </span>
              </td>
              <td className="px-3 py-3 whitespace-nowrap">
                <span className="text-sm text-gray-900">
                  {(threat.threatScore * 100).toFixed(0)}%
                </span>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                {new Date(threat.timestamp).toLocaleTimeString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
