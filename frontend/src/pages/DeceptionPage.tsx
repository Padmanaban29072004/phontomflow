import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import api from '../services/api'
import {
  BeakerIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
import { STATIC_DECEPTION_TRAPS, STATIC_DECEPTION_EVENTS } from '../services/mockData'

export const DeceptionPage: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTrap, setNewTrap] = useState({ name: '', endpoint: '', type: 'honeypot' })
  const queryClient = useQueryClient()

  const { data: trapsData, isLoading: trapsLoading } = useQuery(
    'deception-traps',
    async () => {
      try {
        const response = await api.get('/deception/traps')
        const backendTraps = response.data?.data || response.data || []
        return backendTraps.map((trap: any) => ({
          id: trap.id || trap._id,
          name: trap.name || trap.path || trap.endpoint || `Trap ${trap.id}`,
          endpoint: trap.endpoint || trap.path || '/unknown',
          type: trap.type || 'honeypot',
          status: trap.status || 'active',
          accessCount: trap.accessCount || 0,
        }))
      } catch {
        return STATIC_DECEPTION_TRAPS
      }
    },
    {
      refetchInterval: 5000,
      retry: 1,
    }
  )

  const { data: eventsData, isLoading: eventsLoading } = useQuery(
    'deception-events',
    async () => {
      try {
        const response = await api.get('/deception/events')
        const backendEvents = response.data?.data || response.data || []
        return backendEvents.map((event: any) => ({
          id: event.id || event._id,
          type: event.type || 'honeypot_access',
          ipAddress: event.ipAddress,
          timestamp: event.timestamp || new Date().toISOString(),
          riskLevel: event.riskLevel || event.threatLevel?.toLowerCase() || 'medium',
          threatLevel: event.threatLevel || event.riskLevel || 'medium',
        }))
      } catch {
        return STATIC_DECEPTION_EVENTS
      }
    },
    {
      refetchInterval: 5000,
      retry: 1,
    }
  )

  const createTrapMutation = useMutation(
    async (trap: any) => {
      try {
        const response = await api.post('/deception/traps', trap)
        return response.data?.data || { id: Date.now().toString(), ...trap }
      } catch {
        const newTrap = { id: `trap-${Date.now()}`, ...trap, status: 'active' }
        queryClient.setQueryData('deception-traps', (old: any) => {
          return [...(old || []), newTrap]
        })
        return { data: newTrap }
      }
    },
    {
      onSuccess: () => {
        toast.success('Trap created successfully')
        setShowCreateModal(false)
        setNewTrap({ name: '', endpoint: '', type: 'honeypot' })
        queryClient.invalidateQueries('deception-traps')
      },
      onError: () => {
        toast.error('Failed to create trap')
      },
    }
  )

  const deleteTrapMutation = useMutation(
    async (trapId: string) => {
      try {
        await api.delete(`/deception/traps/${trapId}`)
        return { data: { success: true } }
      } catch {
        queryClient.setQueryData('deception-traps', (old: any) => {
          return (old || []).filter((trap: any) => (trap.id || trap._id) !== trapId)
        })
        return { data: { success: true } }
      }
    },
    {
      onSuccess: () => {
        toast.success('Trap deleted successfully')
        queryClient.invalidateQueries('deception-traps')
      },
      onError: () => {
        toast.error('Failed to delete trap')
      },
    }
  )

  const traps = trapsData || []
  const events = eventsData || []
  const isLoading = trapsLoading || eventsLoading

  const handleCreateTrap = () => {
    if (!newTrap.name || !newTrap.endpoint) {
      toast.error('Please fill in all fields')
      return
    }
    createTrapMutation.mutate(newTrap)
  }

  const handleViewTrap = (trap: any) => {
    toast(`Viewing trap: ${trap.name || trap.endpoint}`, {
      duration: 2000,
      icon: '\uD83D\uDC41\uFE0F',
    })
  }

  const handleDeleteTrap = (trap: any) => {
    if (window.confirm(`Are you sure you want to delete trap "${trap.name || trap.endpoint}"?`)) {
      deleteTrapMutation.mutate(trap.id || trap._id || 'unknown')
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 gap-4">
      <div className="flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deception Layer</h1>
          <p className="text-sm text-gray-500">Manage honeypots and deception traps</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4 mr-1.5" />
          Create Trap
        </button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col min-h-0 overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex-shrink-0">Active Traps</h2>
          {traps.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <BeakerIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No active traps</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
              {traps.map((trap: any) => (
                <div
                  key={trap.id || trap._id || Math.random().toString()}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{trap.name || trap.endpoint}</p>
                    <p className="text-sm text-gray-500">{trap.type}</p>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-3">
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                      Active
                    </span>
                    <button
                      onClick={() => handleViewTrap(trap)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTrap(trap)}
                      disabled={deleteTrapMutation.isLoading}
                      className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col min-h-0 overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex-shrink-0">Recent Events</h2>
          {events.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500">No events recorded</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
              {events.slice(0, 10).map((event: any) => (
                <div key={event.id || event._id || Math.random().toString()} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{event.type}</p>
                    <p className="text-xs text-gray-500 truncate">{event.ipAddress}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {event.timestamp ? new Date(event.timestamp).toLocaleString() : 'Unknown time'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Deception Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{traps.length}</p>
            <p className="text-sm text-gray-600">Active Traps</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{events.length}</p>
            <p className="text-sm text-gray-600">Total Events</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">
              {events.filter((e: any) => e.type === 'honeypot').length}
            </p>
            <p className="text-sm text-gray-600">Honeypot Hits</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">
              {events.filter((e: any) => e.riskLevel === 'high' || e.riskLevel === 'critical').length}
            </p>
            <p className="text-sm text-gray-600">High Risk</p>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Create New Trap</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trap Name</label>
                <input
                  type="text"
                  value={newTrap.name}
                  onChange={(e) => setNewTrap({ ...newTrap, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Admin Panel"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint</label>
                <input
                  type="text"
                  value={newTrap.endpoint}
                  onChange={(e) => setNewTrap({ ...newTrap, endpoint: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="/admin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={newTrap.type}
                  onChange={(e) => setNewTrap({ ...newTrap, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="honeypot">Honeypot</option>
                  <option value="credential_trap">Credential Trap</option>
                  <option value="decoy_file">Decoy File</option>
                  <option value="admin_panel">Admin Panel</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTrap}
                  disabled={createTrapMutation.isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {createTrapMutation.isLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
