import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './stores/authStore'
import ProtectedRoute from './components/ProtectedRoute'
import LoadingSpinner from './components/LoadingSpinner'

// Pages
import Landing from './pages/Landing'

// Auth pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'

// Student pages
import StudentDashboard from './pages/student/Dashboard'
import StudentProducts from './pages/student/Products'
import StudentCart from './pages/student/Cart'
import StudentOrders from './pages/student/Orders'
import StudentOrderDetail from './pages/student/OrderDetail'
import StudentProfile from './pages/student/Profile'
import StudentComplaints from './pages/student/Complaints'

// Admin pages
import AdminDashboard from './pages/admin/Dashboard'
import AdminUsers from './pages/admin/Users'
import AdminUserDetail from './pages/admin/UserDetail'
import AdminProducts from './pages/admin/Products'
import AdminProductDetail from './pages/admin/ProductDetail'
import AdminSectors from './pages/admin/Sectors'
import AdminOrders from './pages/admin/Orders'
import AdminOrderDetail from './pages/admin/AdminOrderDetail'
import AdminPayments from './pages/admin/Payments'
import AdminSenfenicoTests from './pages/admin/SenfenicoTests'
import AdminConfiguration from './pages/admin/Configuration'
import AdminComptabilite from './pages/admin/Comptabilite'

// Chef pages
import ChefDashboard from './pages/chef/Dashboard'
import ChefOrders from './pages/chef/Orders'
import ChefComptabilite from './pages/chef/Comptabilite'

// Livreur pages
import LivreurDashboard from './pages/livreur/Dashboard'

function RootRedirect() {
  const { isAuthenticated, isLoading, user } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Not logged in → show landing
  if (!isAuthenticated) return <Landing />

  const redirects = {
    ETUDIANT:     '/etudiant',
    ADMIN:        '/admin',
    CHEF_SECTEUR: '/chef',
    LIVREUR:      '/livreur',
  }

  return <Navigate to={redirects[user?.role] ?? '/connexion'} replace />
}

export default function App() {
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const isLoading = useAuthStore((s) => s.isLoading)

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="xl" />
          <p className="mt-4 text-gray-500 text-sm">Chargement…</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Root */}
      <Route path="/" element={<RootRedirect />} />

      {/* Auth */}
      <Route path="/connexion" element={<Login />} />
      <Route path="/inscription" element={<Register />} />
      <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
      <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />

      {/* Student */}
      <Route
        path="/etudiant/*"
        element={
          <ProtectedRoute allowedRoles={['ETUDIANT', 'ADMIN']}>
            <Routes>
              <Route path="/" element={<StudentDashboard />} />
              <Route path="/produits" element={<StudentProducts />} />
              <Route path="/panier" element={<StudentCart />} />
              <Route path="/commandes" element={<StudentOrders />} />
              <Route path="/commandes/:id" element={<StudentOrderDetail />} />
              <Route path="/plaintes" element={<StudentComplaints />} />
              <Route path="/profil" element={<StudentProfile />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      {/* Admin */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <Routes>
              <Route path="/" element={<AdminDashboard />} />
              <Route path="/utilisateurs" element={<AdminUsers />} />
              <Route path="/utilisateurs/:id" element={<AdminUserDetail />} />
              <Route path="/produits" element={<AdminProducts />} />
              <Route path="/produits/:id" element={<AdminProductDetail />} />
              <Route path="/secteurs" element={<AdminSectors />} />
              <Route path="/commandes" element={<AdminOrders />} />
              <Route path="/commandes/:id" element={<AdminOrderDetail />} />
              <Route path="/paiements" element={<AdminPayments />} />
              <Route path="/paiements/senfenico" element={<AdminSenfenicoTests />} />
              <Route path="/configuration" element={<AdminConfiguration />} />
              <Route path="/comptabilite" element={<AdminComptabilite />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      {/* Chef */}
      <Route
        path="/chef/*"
        element={
          <ProtectedRoute allowedRoles={['CHEF_SECTEUR', 'ADMIN']}>
            <Routes>
              <Route path="/" element={<ChefDashboard />} />
              <Route path="/commandes" element={<ChefOrders />} />
              <Route path="/comptabilite" element={<ChefComptabilite />} />
              <Route path="/profil" element={<StudentProfile />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      {/* Livreur */}
      <Route
        path="/livreur/*"
        element={
          <ProtectedRoute allowedRoles={['LIVREUR', 'ADMIN']}>
            <Routes>
              <Route path="/" element={<LivreurDashboard />} />
              <Route path="/profil" element={<StudentProfile />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
