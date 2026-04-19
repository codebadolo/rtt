import {
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Truck,
  User,
  Users,
  Utensils,
  X,
} from 'lucide-react'
import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import useAuthStore from '../stores/authStore'
import useCartStore from '../stores/cartStore'
import useNotificationsStore from '../stores/notificationsStore'
import useWebSocket from '../hooks/useWebSocket'
import NotificationBell from '../components/NotificationBell'

const navByRole = {
  ETUDIANT: [
    { to: '/etudiant', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
    { to: '/etudiant/produits', label: 'Produits', icon: ShoppingBag },
    { to: '/etudiant/panier', label: 'Panier', icon: ShoppingCart, badge: 'cart' },
    { to: '/etudiant/commandes', label: 'Mes commandes', icon: ClipboardList },
    { to: '/etudiant/plaintes', label: 'Mes plaintes', icon: AlertTriangle },
    { to: '/etudiant/profil', label: 'Mon profil', icon: User },
  ],
  ADMIN: [
    { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
    { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users },
    { to: '/admin/produits', label: 'Produits', icon: Package },
    { to: '/admin/secteurs', label: 'Secteurs & Salles', icon: MapPin },
    { to: '/admin/commandes', label: 'Commandes', icon: ClipboardList },
    { to: '/admin/paiements', label: 'Paiements', icon: CreditCard },
    { to: '/admin/plaintes', label: 'Plaintes', icon: AlertTriangle },
    { to: '/admin/comptabilite', label: 'Comptabilité', icon: BarChart3 },
    { to: '/admin/configuration', label: 'Configuration', icon: Settings },
    { to: '/etudiant/profil', label: 'Mon profil', icon: User },
  ],
  CHEF_SECTEUR: [
    { to: '/chef', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
    { to: '/chef/commandes', label: 'Commandes', icon: ClipboardList },
    { to: '/chef/livreurs', label: 'Livreurs', icon: Truck },
    { to: '/chef/comptabilite', label: 'Comptabilité', icon: BarChart3 },
    { to: '/chef/profil', label: 'Mon profil', icon: User },
  ],
  LIVREUR: [
    { to: '/livreur', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
    { to: '/livreur/historique', label: 'Historique', icon: History },
    { to: '/livreur/profil', label: 'Mon profil', icon: User },
  ],
}

const roleLabels = {
  ETUDIANT: 'Étudiant',
  ADMIN: 'Administrateur',
  CHEF_SECTEUR: 'Chef de Secteur',
  LIVREUR: 'Livreur',
}

// URL WebSocket : en dev Vite proxy /ws → localhost:8001, en prod via Nginx
const WS_URL = typeof window !== 'undefined'
  ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/commandes/`
  : null

export default function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const cartItems = useCartStore((s) => s.items)
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0)
  const navigate = useNavigate()
  const addNotification = useNotificationsStore((s) => s.addNotification)

  // Connexion WebSocket temps réel (active seulement si connecté)
  const handleWsMessage = useCallback((data) => {
    const notif = addNotification(data)
    // Toast flash selon le type d'événement
    if (data.type === 'commande_update' || data.type === 'notification') {
      toast(notif.message, {
        icon: data.statut === 'DISTRIBUEE' ? '🎉'
            : data.statut === 'REJETEE'   ? '❌'
            : data.statut === 'VALIDEE'   ? '✅'
            : '📦',
        duration: 5000,
      })
    }
  }, [addNotification])

  useWebSocket(user?.id ? WS_URL : null, handleWsMessage)

  const navItems = navByRole[user?.role] ?? []

  const handleLogout = async () => {
    await logout()
    toast.success('Déconnecté avec succès')
    navigate('/connexion')
  }

  const sidebarW = collapsed ? 'w-[68px]' : 'w-64'

  return (
    <div className="h-screen bg-gray-50 flex ">

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-30
          flex flex-col transition-all duration-300 ease-in-out
          bg-gradient-to-b from-orange-500 to-orange-600
          ${sidebarW}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:relative lg:z-auto lg:flex-shrink-0
        `}
      >
        {/* Logo row */}
        <div className={`flex items-center gap-3 px-4 py-4 border-b border-orange-400/40 h-14 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/20 flex-shrink-0">
            <Utensils className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white leading-none text-sm truncate">Ritoto Campus</p>
              <p className="text-xs text-orange-200 mt-0.5 truncate">{roleLabels[user?.role]}</p>
            </div>
          )}
          <button
            className="ml-auto p-1 rounded-lg text-orange-200 hover:text-white lg:hidden flex-shrink-0"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User info */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-orange-400/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-semibold text-xs">
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.prenom} {user?.nom}
                </p>
                <p className="text-xs text-orange-200 truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="flex justify-center py-3 border-b border-orange-400/30">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white font-semibold text-xs">
                {user?.prenom?.[0]}{user?.nom?.[0]}
              </span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-2 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium mb-0.5 transition-all
                  ${collapsed ? 'justify-center' : ''}
                  ${isActive
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'text-orange-100 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                {!collapsed && item.badge === 'cart' && cartCount > 0 && (
                  <span className="bg-white text-orange-500 text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                    {cartCount}
                  </span>
                )}
                {collapsed && item.badge === 'cart' && cartCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-white" />
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-2 border-t border-orange-400/30">
          <button
            onClick={handleLogout}
            title={collapsed ? 'Se déconnecter' : undefined}
            className={`flex items-center gap-3 w-full px-2.5 py-2.5 rounded-xl text-sm font-medium text-orange-100 hover:bg-white/10 hover:text-white transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Se déconnecter</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="flex-shrink-0 sticky top-0 z-10 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">

          {/* Mobile hamburger */}
          <button
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Desktop collapse toggle */}
          <button
            className="hidden lg:flex p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>

          <div className="flex-1" />

          {/* Cloche de notifications (tous les rôles) */}
          <NotificationBell />

          {user?.role === 'ETUDIANT' && (
            <Link
              to="/etudiant/panier"
              className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {cartCount}
                </span>
              )}
            </Link>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
