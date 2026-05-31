import { useQuery } from '@tanstack/react-query'
import { BarChart3, CheckCircle, Clock, Package, ShoppingBag, TrendingUp, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import Badge from '../../components/Badge'
import useAuthStore from '../../stores/authStore'
import { ordersApi, walletApi } from '../../api/orders'

function StatCard({ icon: Icon, label, value, sub, color = 'orange', to }) {
  const colors = {
    orange: 'bg-orange-100 text-orange-600',
    green:  'bg-green-100 text-green-600',
    blue:   'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
  }
  const card = (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`p-3 rounded-xl flex-shrink-0 ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
  return to ? <Link to={to}>{card}</Link> : card
}

export default function VendeurDashboard() {
  const user = useAuthStore((s) => s.user)

  const { data: ordersData, isLoading: loadingOrders } = useQuery({
    queryKey: ['vendeur-orders', 'EN_ATTENTE'],
    queryFn: () => ordersApi.list({ statut: 'EN_ATTENTE', page_size: 50 }),
    refetchInterval: 15000,
  })

  const { data: readyData } = useQuery({
    queryKey: ['vendeur-orders-prete'],
    queryFn: () => ordersApi.list({ statut: 'PRETE', page_size: 50 }),
    refetchInterval: 15000,
  })

  const { data: wallet } = useQuery({
    queryKey: ['vendeur-wallet'],
    queryFn: walletApi.get,
    refetchInterval: 60000,
  })

  const { data: todayData } = useQuery({
    queryKey: ['vendeur-today'],
    queryFn: () => ordersApi.list({ statut: 'LIVREE', page_size: 200 }),
  })

  const pending = Array.isArray(ordersData) ? ordersData : ordersData?.results ?? []
  const ready = Array.isArray(readyData) ? readyData : readyData?.results ?? []
  const today = Array.isArray(todayData) ? todayData : todayData?.results ?? []

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayOrders = today.filter((o) => new Date(o.date_creation) >= todayStart)
  const todayCA = todayOrders.reduce((s, o) => s + parseFloat(o.total_ht ?? 0), 0)

  const recentOrders = [...pending].slice(0, 5)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bonjour, {user?.prenom} !</h1>
          <p className="text-gray-500 mt-1">Tableau de bord vendeur</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Clock} label="En attente" value={pending.length} color="orange" to="/vendeur/commandes" />
          <StatCard icon={CheckCircle} label="Prêtes" value={ready.length} color="purple" to="/vendeur/commandes" />
          <StatCard icon={TrendingUp} label="CA aujourd'hui" value={`${todayCA.toLocaleString('fr-FR')} F`} color="green" />
          <StatCard
            icon={Wallet}
            label="Solde wallet"
            value={`${parseFloat(wallet?.solde ?? 0).toLocaleString('fr-FR')} F`}
            color="blue"
            to="/vendeur/wallet"
          />
        </div>

        {/* Commandes en attente */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-orange-500" />
              Nouvelles commandes
              {pending.length > 0 && (
                <span className="bg-orange-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{pending.length}</span>
              )}
            </h2>
            <Link to="/vendeur/commandes" className="text-sm text-orange-500 hover:text-orange-600 font-medium">
              Voir toutes →
            </Link>
          </div>

          {loadingOrders ? (
            <div className="py-12"><LoadingSpinner size="lg" /></div>
          ) : recentOrders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">Aucune commande en attente</p>
              <p className="text-sm text-gray-400 mt-1">Les nouvelles commandes apparaîtront ici</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-gray-700">{order.numero_commande}</span>
                      <Badge status={order.statut} />
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{order.etudiant_nom ?? '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-orange-500">{parseFloat(order.total_ttc ?? 0).toLocaleString('fr-FR')} F</p>
                    {order.heure_souhaitee && (
                      <p className="text-xs text-gray-400 mt-0.5">{order.heure_souhaitee}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Raccourcis */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { to: '/vendeur/commandes', icon: ShoppingBag, label: 'Commandes', color: 'orange' },
            { to: '/vendeur/produits', icon: Package, label: 'Mes produits', color: 'blue' },
            { to: '/vendeur/wallet', icon: Wallet, label: 'Wallet', color: 'green' },
            { to: '/vendeur/stats', icon: BarChart3, label: 'Statistiques', color: 'purple' },
          ].map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.to} to={item.to}
                className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  item.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                  item.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                  item.color === 'green' ? 'bg-green-100 text-green-600' :
                  'bg-purple-100 text-purple-600'
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="font-medium text-gray-800 text-sm">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </DashboardLayout>
  )
}
