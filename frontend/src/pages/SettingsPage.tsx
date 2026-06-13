import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export function SettingsPage() {
  const { user } = useAuth()
  const [refetchInterval, setRefetchInterval] = useState(30)
  const [notifications, setNotifications] = useState(true)
  const [criticalAlerts, setCriticalAlerts] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const handleSave = () => {
    toast.success('Settings saved')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      <div className="space-y-6 max-w-2xl">
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Profile</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg font-bold text-white">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{user?.username}</p>
                <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-950 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Dashboard Preferences</h2>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Auto-refresh</p>
                <p className="text-xs text-gray-400">Automatically refresh dashboard data</p>
              </div>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`relative h-6 w-11 rounded-full transition-colors ${autoRefresh ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${autoRefresh ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {autoRefresh && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Refresh Interval (seconds)</label>
                <input
                  type="number"
                  value={refetchInterval}
                  onChange={(e) => setRefetchInterval(Number(e.target.value))}
                  min={5}
                  max={300}
                  className="w-24 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-950 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Notifications</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Toast notifications</p>
                <p className="text-xs text-gray-400">Show notification popups</p>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`relative h-6 w-11 rounded-full transition-colors ${notifications ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${notifications ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Critical alerts</p>
                <p className="text-xs text-gray-400">Show alerts for critical threats</p>
              </div>
              <button
                onClick={() => setCriticalAlerts(!criticalAlerts)}
                className={`relative h-6 w-11 rounded-full transition-colors ${criticalAlerts ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${criticalAlerts ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Save Settings
        </button>
      </div>
    </div>
  )
}
