import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface RealTimeThreatsChartProps {
  className?: string
}

export function RealTimeThreatsChart({ className = 'h-[300px]' }: RealTimeThreatsChartProps) {
  const [data, setData] = useState<Array<{ time: string; threats: number; blocked: number }>>([])

  useEffect(() => {
    const generateData = () => {
      const now = new Date()
      const hours = []
      for (let i = 23; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000)
        hours.push({
          time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          threats: Math.floor(Math.random() * 50) + 10,
          blocked: Math.floor(Math.random() * 30) + 5,
        })
      }
      setData(hours)
    }

    generateData()
    const interval = setInterval(() => {
      setData((prev) => {
        const newData = [...prev]
        newData.shift()
        newData.push({
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          threats: Math.floor(Math.random() * 50) + 10,
          blocked: Math.floor(Math.random() * 30) + 5,
        })
        return newData
      })
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorThreats" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="time"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            interval="preserveStartEnd"
          />
          <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="threats"
            stroke="#ef4444"
            fillOpacity={1}
            fill="url(#colorThreats)"
            name="Threats Detected"
          />
          <Area
            type="monotone"
            dataKey="blocked"
            stroke="#10b981"
            fillOpacity={1}
            fill="url(#colorBlocked)"
            name="Blocked Attacks"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
