import React, { createContext, useContext, useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'
import toast from 'react-hot-toast'

interface ThreatUpdate {
  id: string
  type: string
  severity: string
  ipAddress: string
  timestamp: string
  description: string
}

interface DeceptionUpdate {
  id: string
  type: string
  ipAddress: string
  timestamp: string
  threatLevel: string
}

interface SocketContextValue {
  socket: Socket | null
  connected: boolean
  lastThreatUpdate: ThreatUpdate | null
  lastDeceptionUpdate: DeceptionUpdate | null
}

const SocketContext = createContext<SocketContextValue | null>(null)

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastThreatUpdate, setLastThreatUpdate] = useState<ThreatUpdate | null>(null)
  const [lastDeceptionUpdate, setLastDeceptionUpdate] = useState<DeceptionUpdate | null>(null)

  useEffect(() => {
    if (!token) {
      setSocket(null)
      setConnected(false)
      return
    }

    const instance = io({ auth: { token } })

    instance.on('connect', () => {
      setConnected(true)
      instance.emit('join-dashboard')
    })

    instance.on('disconnect', () => setConnected(false))

    instance.on('threat-update', (data: ThreatUpdate) => {
      setLastThreatUpdate(data)
      toast.error(`Threat detected: ${data.type} from ${data.ipAddress}`, { id: 'threat-alert' })
    })

    instance.on('deception-update', (data: DeceptionUpdate) => {
      setLastDeceptionUpdate(data)
    })

    setSocket(instance)

    return () => {
      instance.disconnect()
      setSocket(null)
      setConnected(false)
    }
  }, [token])

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        lastThreatUpdate,
        lastDeceptionUpdate,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocket must be used within SocketProvider')
  return ctx
}
