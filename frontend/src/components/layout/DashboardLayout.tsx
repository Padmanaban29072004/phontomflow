import React, { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useSocket } from '../../contexts/SocketContext'
import {
  HomeIcon,
  ShieldExclamationIcon,
  ChartBarIcon,
  BeakerIcon,
  ShareIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Dashboard', to: '/dashboard', icon: HomeIcon },
  { name: 'Threats', to: '/threats', icon: ShieldExclamationIcon },
  { name: 'Analytics', to: '/analytics', icon: ChartBarIcon },
  { name: 'Deception', to: '/deception', icon: BeakerIcon },
  { name: 'Graph', to: '/graph', icon: ShareIcon },
  { name: 'Settings', to: '/settings', icon: Cog6ToothIcon },
]

export function DashboardLayout() {
  const { user, logout } = useAuth()
  const { connected } = useSocket()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="flex-shrink-0 bg-white shadow-sm border-b border-gray-200">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="lg:hidden text-gray-400 hover:text-gray-600 flex-shrink-0"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0" />
                <span className="text-lg font-bold text-gray-900 hidden sm:inline">PHANTOM-Flow</span>
              </div>
              <nav className="hidden lg:flex items-center ml-6 gap-1 overflow-x-auto">
                {navigation.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `inline-flex items-center flex-shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4 mr-1.5" />
                      {item.name}
                    </NavLink>
                  )
                })}
              </nav>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-500 hidden sm:inline">{connected ? 'Live' : 'Offline'}</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                  <p className="text-xs text-gray-500">{user?.role}</p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-100">
            <nav className="px-4 py-3 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`
                    }
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    {item.name}
                  </NavLink>
                )
              })}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  )
}
