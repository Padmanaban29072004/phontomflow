import { MapPinIcon } from '@heroicons/react/24/outline'

interface Threat {
  ipAddress: string
  country?: string
  riskLevel: string
}

interface GeographicThreatsMapProps {
  threats: Threat[]
}

export function GeographicThreatsMap({ threats }: GeographicThreatsMapProps) {
  const threatsByCountry = threats.reduce((acc, threat) => {
    const country = threat.country || 'Unknown'
    if (!acc[country]) {
      acc[country] = { count: 0, highRisk: 0 }
    }
    acc[country].count++
    if (threat.riskLevel === 'high' || threat.riskLevel === 'critical') {
      acc[country].highRisk++
    }
    return acc
  }, {} as Record<string, { count: number; highRisk: number }>)

  const topCountries = Object.entries(threatsByCountry)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)

  if (topCountries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MapPinIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p>No geographic data available</p>
      </div>
    )
  }

  const maxCount = Math.max(...topCountries.map(([, d]) => d.count))

  return (
    <div className="space-y-3">
      {topCountries.map(([country, data]) => (
        <div key={country} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3 min-w-0">
            <MapPinIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{country}</p>
              <p className="text-xs text-gray-500">
                {data.highRisk > 0 && (
                  <span className="text-red-600 font-medium">{data.highRisk} high risk | </span>
                )}
                {data.count} total
              </p>
            </div>
          </div>
          <div className="w-24 bg-gray-200 rounded-full h-2 flex-shrink-0 ml-3">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(data.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
