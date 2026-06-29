import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export function ProtectedRoute({
  children,
  requireSetup = true,
}: {
  children: React.ReactNode
  requireSetup?: boolean
}) {
  const { isAuthenticated, loading, targetUrl } = useAuth()
  const location = useLocation()

  console.log('ProtectedRoute render:', { isAuthenticated, loading, targetUrl, requireSetup, path: location.pathname })

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireSetup && !targetUrl) {
    return <Navigate to="/setup" state={{ from: location }} replace />
  }

  return <>{children}</>
}
