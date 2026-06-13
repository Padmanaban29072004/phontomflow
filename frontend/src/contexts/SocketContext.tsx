import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
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
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastThreatUpdate, setLastThreatUpdate] = useState<ThreatUpdate | null>(null)
  const [lastDeceptionUpdate, setLastDeceptionUpdate] = useState<DeceptionUpdate | null>(null)

  useEffect(() => {
    if (!token) return

    const socket = io({ auth: { token } })

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join-dashboard')
    })

    socket.on('disconnect', () => setConnected(false))

    socket.on('threat-update', (data: ThreatUpdate) => {
      setLastThreatUpdate(data)
      toast.error(`Threat detected: ${data.type} from ${data.ipAddress}`, { id: 'threat-alert' })
    })

    socket.on('deception-update', (data: DeceptionUpdate) => {
      setLastDeceptionUpdate(data)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token])

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
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
