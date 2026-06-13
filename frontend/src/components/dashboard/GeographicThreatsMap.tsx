import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface ThreatAlert {
  id: string
  threatScore: number
  riskLevel: string
  ipAddress: string
  userAgent: string
  timestamp: Date
  threatType: string[]
  status: string
}

interface GeographicThreatsMapProps {
  threats: ThreatAlert[]
}

const regionData = [
  { region: 'North America', threats: 142, severity: 'high' },
  { region: 'Europe', threats: 98, severity: 'medium' },
  { region: 'Asia Pacific', threats: 156, severity: 'critical' },
  { region: 'Middle East', threats: 45, severity: 'medium' },
  { region: 'Latin America', threats: 67, severity: 'low' },
  { region: 'Africa', threats: 23, severity: 'low' },
]

export function GeographicThreatsMap({ threats }: GeographicThreatsMapProps) {
  return (
    <div className="h-64">
      {threats.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <svg className="h-10 w-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
          </svg>
          <p className="text-sm">No geographic data</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={regionData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="region" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={100} />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
            />
            <Bar dataKey="threats" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
