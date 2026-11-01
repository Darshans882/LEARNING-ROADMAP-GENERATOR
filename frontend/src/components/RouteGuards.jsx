import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo'
import { Spinner } from './ui'

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
      <Logo size="lg" />
      <Spinner className="h-6 w-6" />
      <p className="text-sm text-slate-500">Preparing your learning workspace…</p>
    </div>
  )
}

export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

export function OnboardingRoute({ children }) {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return <FullScreenLoader />
  if (isAdmin) return <Navigate to="/admin" replace />
  if (user?.onboarding_completed) return <Navigate to="/dashboard" replace />
  return children
}

export function StudentGate() {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (user?.role !== 'admin' && !user?.onboarding_completed) {
    return <Navigate to="/onboarding" replace />
  }
  return <Outlet />
}

export function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return children
}
