import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi, TOKEN_KEY } from '../services/api'
import toast from 'react-hot-toast'

interface User {
  id: string
  username: string
  role: string
}

interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(TOKEN_KEY)
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    authApi.verify()
      .then((res) => {
        if (res.data.success) {
          setUser(res.data.user)
        } else {
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [token])

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login(username, password)
    const { token: newToken, user: userData } = res.data

    localStorage.setItem(TOKEN_KEY, newToken)
    setToken(newToken)
    setUser(userData)
    toast.success(`Welcome back, ${userData.username}`)
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore server error on logout
    }
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
    toast.success('Logged out successfully')
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
