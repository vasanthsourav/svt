import { Navigate, useLocation } from 'react-router-dom'
import { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'

function FullScreenLoader() {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="h-10 w-10 rounded-full border-4 border-maroon/20 border-t-maroon animate-spin" />
    </div>
  )
}

// Requires a logged-in customer (any role). Redirects to /login, remembering target.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <>{children}</>
}

// Requires ADMIN. Redirects non-admins to the admin login.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}
