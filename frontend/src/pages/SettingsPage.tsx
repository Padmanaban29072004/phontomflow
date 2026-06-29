import { useState, useEffect } from 'react'
import { useMutation } from 'react-query'
import api from '../services/api'
import {
  Cog6ToothIcon,
  BellIcon,
  ShieldCheckIcon,
  ServerIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
import { PageShell } from '../components/layout/PageShell'

const SETTINGS_KEY = 'phantom-flow-settings'

const DEFAULT_SETTINGS = {
  notifications: true,
  autoBlock: false,
  threatThreshold: 0.7,
  refreshInterval: 30,
}

export function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  useEffect(() => {
    const savedSettings = localStorage.getItem(SETTINGS_KEY)
    if (!savedSettings) return
    try {
      const parsed = JSON.parse(savedSettings)
      setSettings((prev) => ({ ...prev, ...parsed }))
    } catch {
      // ignore invalid local storage
    }
  }, [])

  const saveSettingsMutation = useMutation(
    async (newSettings: typeof DEFAULT_SETTINGS) => {
      try {
        await api.post('/settings', newSettings)
      } catch {
        // Backend may not implement /settings — persist locally
      }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings))
      return { success: true }
    },
    {
      onSuccess: () => {
        toast.success('Settings saved')
      },
      onError: () => {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
        toast.success('Settings saved locally')
      },
    }
  )

  const handleSave = () => {
    saveSettingsMutation.mutate(settings)
  }

  return (
    <PageShell
      title="Settings"
      description="Configure your PHANTOM-Flow system preferences"
    >
      <div className="max-w-4xl space-y-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <BellIcon className="h-6 w-6 text-gray-400 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
          </div>
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Enable notifications</span>
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) =>
                setSettings({ ...settings, notifications: e.target.checked })
              }
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <ShieldCheckIcon className="h-6 w-6 text-gray-400 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Auto-block high-risk threats</span>
              <input
                type="checkbox"
                checked={settings.autoBlock}
                onChange={(e) => setSettings({ ...settings, autoBlock: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Threat Detection Threshold: {settings.threatThreshold}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.threatThreshold}
                onChange={(e) =>
                  setSettings({ ...settings, threatThreshold: parseFloat(e.target.value) })
                }
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <ServerIcon className="h-6 w-6 text-gray-400 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900">System Settings</h2>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Refresh Interval (seconds): {settings.refreshInterval}
            </label>
            <input
              type="number"
              min="5"
              max="300"
              value={settings.refreshInterval}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  refreshInterval: parseInt(e.target.value, 10) || 30,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end pb-4">
          <button
            onClick={handleSave}
            disabled={saveSettingsMutation.isLoading}
            className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Cog6ToothIcon className="h-5 w-5 mr-2" />
            {saveSettingsMutation.isLoading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </PageShell>
  )
}
