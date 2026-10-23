import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './stores/authStore'
import ProtectedRoute from './components/ProtectedRoute'
import LoadingSpinner from './components/LoadingSpinner'
import useInactivityLogout from './hooks/useInactivityLogout'

// Pages
import Landing from './pages/Landing'

// Auth pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import TelephoneLogin from './pages/auth/TelephoneLogin'

// Parcours public (sans compte) — dossier V1
import Campus from './pages/public/Campus'
import Boutiques from './pages/public/Boutiques'
import Boutique from './pages/public/Boutique'
import Panier from './pages/public/Panier'
import Checkout from './pages/checkout/Checkout'

// Student pages
import StudentDashboard from './pages/student/Dashboard'
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
import AdminComplaints from './pages/admin/Complaints'
import AdminPromotions from './pages/admin/Promotions'
import AdminVendeurs from './pages/admin/Vendeurs'
import AdminLivreurs from './pages/admin/Livreurs'
import AdminRemboursements from './pages/admin/Remboursements'
import AdminJournalAudit from './pages/admin/JournalAudit'
import AdminKYCManagement from './pages/admin/KYCManagement'

// Chef pages
import ChefDashboard from './pages/chef/Dashboard'
import ChefOrders from './pages/chef/Orders'
import ChefComptabilite from './pages/chef/Comptabilite'
import ChefLivreurs from './pages/chef/Livreurs'

// Livreur pages
import LivreurDashboard from './pages/livreur/Dashboard'
import LivreurHistory from './pages/livreur/History'
import LivreurProfil from './pages/livreur/Profil'

// Vendeur pages
import VendeurDashboard from './pages/vendeur/Dashboard'
import VendeurOrders from './pages/vendeur/Orders'
import VendeurWallet from './pages/vendeur/Wallet'
import VendeurProfil from './pages/vendeur/Profil'
import VendeurInscription from './pages/vendeur/Inscription'
import VendeurProduits from './pages/vendeur/Produits'

const ROLES_VENDEUR = ['VENDEUR_INTERIEUR', 'VENDEUR_EXTERIEUR']

// Une boutique n'est exploitable qu'après validation Ritôtô (dossier V1 §7) :
// tant qu'elle ne l'est pas, le vendeur est ramené à son parcours d'inscription.
function BoutiqueValideeRequise({ children }) {
  const user = useAuthStore((s) => s.user)
  if (ROLES_VENDEUR.includes(user?.role) && user?.etat_parcours?.statut_boutique !== 'VALIDE') {
    return <Navigate to="/vendeur/inscription" replace />
  }
  return children
}

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
    ETUDIANT:           '/etudiant',
    LIVREUR:            '/livreur',
    VENDEUR_INTERIEUR:  '/vendeur',
    VENDEUR_EXTERIEUR:  '/vendeur',
    CHEF_SECTEUR:       '/chef',
    ADMIN_UNIVERSITAIRE:'/admin',
    ADMIN:              '/admin',
  }

  return <Navigate to={redirects[user?.role] ?? '/connexion'} replace />
}

export default function App() {
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const isLoading = useAuthStore((s) => s.isLoading)

  useInactivityLogout()

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
      <Route path="/connexion-telephone" element={<TelephoneLogin />} />

      {/* Parcours étudiant sans compte : université → boutiques → produits → panier → commande */}
      <Route path="/campus" element={<Campus />} />
      <Route path="/campus/:universiteId" element={<Boutiques />} />
      <Route path="/campus/:universiteId/boutiques/:boutiqueId" element={<Boutique />} />
      <Route path="/panier" element={<Panier />} />
      <Route path="/commande" element={<Checkout />} />

      {/* Parcours vendeur progressif */}
      <Route path="/vendeur/inscription" element={<VendeurInscription />} />

      {/* Student */}
      <Route
        path="/etudiant/*"
        element={
          <ProtectedRoute allowedRoles={['ETUDIANT', 'ADMIN']}>
            <Routes>
              <Route path="/" element={<StudentDashboard />} />
              <Route path="/produits" element={<Navigate to="/campus" replace />} />
              <Route path="/panier" element={<Navigate to="/panier" replace />} />
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
              <Route path="/plaintes" element={<AdminComplaints />} />
              <Route path="/promotions" element={<AdminPromotions />} />
              <Route path="/vendeurs" element={<AdminVendeurs />} />
              <Route path="/livreurs" element={<AdminLivreurs />} />
              <Route path="/remboursements" element={<AdminRemboursements />} />
              <Route path="/journal-audit" element={<AdminJournalAudit />} />
              <Route path="/kyc" element={<AdminKYCManagement />} />
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
              <Route path="/livreurs" element={<ChefLivreurs />} />
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
              <Route path="/historique" element={<LivreurHistory />} />
              <Route path="/plaintes" element={<StudentComplaints />} />
              <Route path="/profil" element={<LivreurProfil />} />
              <Route path="/compte" element={<StudentProfile />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      {/* Vendeur */}
      <Route
        path="/vendeur/*"
        element={
          <ProtectedRoute allowedRoles={['VENDEUR_INTERIEUR', 'VENDEUR_EXTERIEUR', 'ADMIN']}>
            <BoutiqueValideeRequise>
            <Routes>
              <Route path="/" element={<VendeurDashboard />} />
              <Route path="/commandes" element={<VendeurOrders />} />
              <Route path="/wallet" element={<VendeurWallet />} />
              <Route path="/produits" element={<VendeurProduits />} />
              <Route path="/plaintes" element={<StudentComplaints />} />
              <Route path="/profil" element={<VendeurProfil />} />
              <Route path="/compte" element={<StudentProfile />} />
            </Routes>
            </BoutiqueValideeRequise>
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
