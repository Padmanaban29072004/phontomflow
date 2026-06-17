import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useSocket } from '../../contexts/SocketContext'
import { APP_ROUTES, APP_BASE } from '../../config/routes'

export function AppLayout() {
  const { user, logout, targetUrl } = useAuth()
  const { connected } = useSocket()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const currentRoute = APP_ROUTES.find((r) => location.pathname === `${APP_BASE}/${r.path}`)

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-30 flex-shrink-0 border-b border-gray-200 bg-white shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 lg:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <NavLink to={`${APP_BASE}/dashboard`} className="flex flex-shrink-0 items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600" />
                <span className="hidden text-lg font-bold text-gray-900 sm:inline">PHANTOM-Flow</span>
              </NavLink>
              <nav className="ml-4 hidden items-center gap-1 overflow-x-auto lg:flex">
                {APP_ROUTES.map((item) => {
                  const Icon = item.icon
                  const to = `${APP_BASE}/${item.path}`
                  return (
                    <NavLink
                      key={item.path}
                      to={to}
                      className={({ isActive }) =>
                        `inline-flex flex-shrink-0 items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`
                      }
                    >
                      <Icon className="mr-1.5 h-4 w-4" />
                      {item.label}
                    </NavLink>
                  )
                })}
              </nav>
            </div>

            <div className="flex flex-shrink-0 items-center gap-4">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-green-500' : 'bg-red-500'}`}
                />
                <span className="hidden text-sm text-gray-500 sm:inline">
                  {connected ? 'Live' : 'Offline'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                  <p className="text-xs text-gray-500">{user?.role}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-gray-100 lg:hidden">
            <nav className="space-y-1 px-4 py-3">
              {APP_ROUTES.map((item) => {
                const Icon = item.icon
                const to = `${APP_BASE}/${item.path}`
                return (
                  <NavLink
                    key={item.path}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`
                    }
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.label}
                  </NavLink>
                )
              })}
            </nav>
          </div>
        )}
      </header>

      {currentRoute && (
        <div className="border-b border-gray-100 bg-white px-4 py-2 text-xs text-gray-400 sm:px-6 lg:px-8 flex justify-between items-center">
          <div>
            {APP_BASE} / <span className="text-gray-600">{currentRoute.path}</span>
          </div>
          {targetUrl && (
            <div className="flex items-center gap-1.5 text-gray-500 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span>Target: <span className="text-gray-700 font-semibold">{targetUrl}</span></span>
            </div>
          )}
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
