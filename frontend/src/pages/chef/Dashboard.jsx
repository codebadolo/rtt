import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ClipboardList, Clock, ChevronRight, AlertCircle,
  CheckCircle2, XCircle, Package, Truck,
} from 'lucide-react'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import Badge from '../../components/Badge'
import useAuthStore from '../../stores/authStore'
import { ordersApi } from '../../api/orders'
import { horairesApi } from '../../api/sectors'
import { usersApi } from '../../api/users'

function StatCard({ icon: Icon, label, value, color, sub, pulse }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
      <div className={`relative p-3 rounded-2xl ${color} flex-shrink-0`}>
        <Icon className="h-5 w-5 text-white" />
        {pulse && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold text-gray-900">{value ?? '—'}</p>
        <p className="text-sm text-gray-500 truncate">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function ChefDashboard() {
  const user = useAuthStore((s) => s.user)

  const { data: enAttente, isLoading: loadingAttente } = useQuery({
    queryKey: ['chef-orders-attente'],
    queryFn: () => ordersApi.list({ statut: 'EN_ATTENTE', limit: 20 }),
    refetchInterval: 15000,
  })

  const { data: valideesData } = useQuery({
    queryKey: ['chef-orders-validees'],
    queryFn: () => ordersApi.list({ statut: 'VALIDEE', limit: 1 }),
    refetchInterval: 15000,
  })

  const { data: pretesData } = useQuery({
    queryKey: ['chef-orders-pretes'],
    queryFn: () => ordersApi.list({ statut: 'PRETE', limit: 1 }),
    refetchInterval: 15000,
  })

  const { data: rejetesData } = useQuery({
    queryKey: ['chef-orders-rejetees'],
    queryFn: () => ordersApi.list({ statut: 'REJETEE', limit: 1 }),
  })

  const { data: horaires } = useQuery({
    queryKey: ['horaires-today'],
    queryFn: () => horairesApi.aujourdhui(),
  })

  const { data: livreursData } = useQuery({
    queryKey: ['livreurs-list'],
    queryFn: () => usersApi.list({ role: 'LIVREUR' }),
    staleTime: 60_000,
  })

  const pendingOrders = Array.isArray(enAttente) ? enAttente : enAttente?.results ?? []
  const pendingCount  = Array.isArray(enAttente) ? enAttente.length : (enAttente?.count ?? 0)
  const valideesCount = Array.isArray(valideesData) ? valideesData.length : (valideesData?.count ?? 0)
  const pretesCount   = Array.isArray(pretesData)   ? pretesData.length   : (pretesData?.count   ?? 0)
  const rejetesCount  = Array.isArray(rejetesData)  ? rejetesData.length  : (rejetesData?.count  ?? 0)
  const todaySchedules = Array.isArray(horaires) ? horaires : horaires?.results ?? []
  const livreurs = Array.isArray(livreursData) ? livreursData : livreursData?.results ?? []
  const livreursActifs = livreurs.filter((l) => l.est_actif)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Chef Secteur' }]} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bonjour, {user?.prenom} !</h1>
          <p className="text-gray-500 mt-1">Tableau de bord — Chef de secteur</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={AlertCircle} label="En attente" value={pendingCount}
            color="bg-amber-500" pulse={pendingCount > 0}
            sub={pendingCount > 0 ? 'Nécessitent une action' : 'Aucune en attente'}
          />
          <StatCard icon={CheckCircle2} label="Validées" value={valideesCount} color="bg-blue-500" />
          <StatCard icon={Package}      label="Prêtes"   value={pretesCount}   color="bg-purple-500" />
          <StatCard icon={XCircle}      label="Rejetées" value={rejetesCount}  color="bg-red-400" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Commandes en attente */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-800">Commandes en attente</h2>
                {pendingCount > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </div>
              <Link to="/chef/commandes" className="text-sm text-orange-500 hover:text-orange-600 flex items-center gap-1">
                Gérer <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {loadingAttente ? (
              <LoadingSpinner className="py-8" />
            ) : pendingOrders.length === 0 ? (
              <div className="text-center py-8">
                <ClipboardList className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Aucune commande en attente</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingOrders.slice(0, 6).map((order) => (
                  <Link
                    key={order.id}
                    to="/chef/commandes"
                    className="flex items-center justify-between p-3 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors"
                  >
                    <div>
                      <p className="font-mono font-bold text-xs text-gray-600">{order.numero_commande}</p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">
                        {order.etudiant_nom ?? order.etudiant?.nom ?? '—'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm text-orange-600">
                        {parseFloat(order.total_ttc ?? 0).toLocaleString('fr-FR')} F
                      </p>
                      <Badge status={order.statut} />
                    </div>
                  </Link>
                ))}
                {pendingCount > 6 && (
                  <Link to="/chef/commandes" className="block text-center text-sm text-orange-500 py-2 hover:text-orange-600">
                    +{pendingCount - 6} de plus →
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Horaires + Livreurs */}
          <div className="space-y-4">
            {/* Horaires */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-orange-500" />
                <h2 className="font-semibold text-gray-800">Horaires d'aujourd'hui</h2>
              </div>
              {todaySchedules.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Aucun horaire programmé</p>
              ) : (
                <div className="space-y-2">
                  {todaySchedules.map((h) => (
                    <div key={h.id} className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                      <div>
                        <p className="font-medium text-sm text-gray-800">
                          {h.secteur_nom ?? h.secteur?.nom ?? 'Secteur'}
                        </p>
                        <p className="text-xs text-green-600 mt-0.5">
                          {h.heure_ouverture} – {h.heure_fermeture}
                        </p>
                      </div>
                      <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">Actif</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Livreurs */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-orange-500" />
                  <h2 className="font-semibold text-gray-800">Équipe livreurs</h2>
                </div>
                <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                  {livreursActifs.length} actif{livreursActifs.length !== 1 ? 's' : ''}
                </span>
              </div>
              {livreurs.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Aucun livreur assigné</p>
              ) : (
                <div className="space-y-2">
                  {livreurs.slice(0, 6).map((l) => (
                    <div key={l.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-xs">
                          {l.prenom?.[0]}{l.nom?.[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{l.prenom} {l.nom}</p>
                        <p className="text-xs text-gray-400 truncate">{l.telephone || l.email}</p>
                      </div>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${l.est_actif ? 'bg-green-500' : 'bg-gray-300'}`} />
                    </div>
                  ))}
                  {livreurs.length > 6 && (
                    <p className="text-xs text-gray-400 text-center pt-1">+{livreurs.length - 6} autres</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
