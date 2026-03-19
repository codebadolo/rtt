import { Navigate, useLocation } from 'react-router-dom'
import useAuthStore from '../stores/authStore'
import LoadingSpinner from './LoadingSpinner'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, isLoading, user } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/connexion" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    const roleRedirects = {
      ETUDIANT: '/etudiant',
      ADMIN: '/admin',
      CHEF_SECTEUR: '/chef',
      LIVREUR: '/livreur',
    }
    const redirect = roleRedirects[user?.role] ?? '/connexion'
    return <Navigate to={redirect} replace />
  }

  return children
}
