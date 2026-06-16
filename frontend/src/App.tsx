import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Toaster } from 'react-hot-toast'
import { SocketProvider } from './contexts/SocketContext'
import { AuthProvider } from './contexts/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { SetupPage } from './pages/SetupPage'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { APP_ROUTES, APP_BASE, DEFAULT_APP_ROUTE } from './config/routes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <Router>
            <div className="App min-h-screen">
              <Routes>
                <Route path="/login" element={<LoginPage />} />

                <Route
                  path="/setup"
                  element={
                    <ProtectedRoute requireSetup={false}>
                      <SetupPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path={APP_BASE}
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="dashboard" replace />} />
                  {APP_ROUTES.map(({ path, element: Page }) => (
                    <Route key={path} path={path} element={<Page />} />
                  ))}
                </Route>

                {/* Legacy URLs → new /app/* paths */}
                <Route path="/dashboard" element={<Navigate to={DEFAULT_APP_ROUTE} replace />} />
                <Route path="/threats" element={<Navigate to={`${APP_BASE}/threats`} replace />} />
                <Route path="/analytics" element={<Navigate to={`${APP_BASE}/analytics`} replace />} />
                <Route path="/deception" element={<Navigate to={`${APP_BASE}/deception`} replace />} />
                <Route path="/graph" element={<Navigate to={`${APP_BASE}/graph`} replace />} />
                <Route path="/settings" element={<Navigate to={`${APP_BASE}/settings`} replace />} />

                <Route path="/" element={<Navigate to={DEFAULT_APP_ROUTE} replace />} />
                <Route path="*" element={<Navigate to={DEFAULT_APP_ROUTE} replace />} />
              </Routes>

              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: { background: '#363636', color: '#fff' },
                  success: {
                    duration: 3000,
                    iconTheme: { primary: '#10B981', secondary: '#fff' },
                  },
                  error: {
                    duration: 5000,
                    iconTheme: { primary: '#EF4444', secondary: '#fff' },
                  },
                }}
              />
            </div>
          </Router>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
