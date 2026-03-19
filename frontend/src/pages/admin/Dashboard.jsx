import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Users, ShoppingBag, ClipboardList,
  TrendingUp, ChevronRight, Package,
} from 'lucide-react'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import { adminApi } from '../../api/admin'
import { usersApi } from '../../api/users'

function StatCard({ icon: Icon, label, value, sub, color, to }) {
  const inner = (
    <div className={`bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4 ${to ? 'hover:shadow-md hover:border-opacity-50 transition-all' : ''}`}>
      <div className={`w-13 h-13 p-3 rounded-2xl ${color} flex-shrink-0`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold text-gray-900">{value ?? <span className="text-gray-300">—</span>}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}


export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.stats(),
  })

  const { data: usersRaw } = useQuery({
    queryKey: ['all-users-count'],
    queryFn: () => usersApi.list(),
  })

  const userCount = Array.isArray(usersRaw)
    ? usersRaw.length
    : usersRaw?.count ?? usersRaw?.results?.length ?? null

  const recentOrders = stats?.commandes_recentes ?? []

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-500 mt-1">Vue d'ensemble de Ritoto Express</p>
        </div>

        {statsLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Users}
                label="Utilisateurs"
                value={userCount}
                color="bg-blue-500"
                to="/admin/utilisateurs"
              />
              <StatCard
                icon={Package}
                label="Produits"
                value={stats?.total_produits}
                color="bg-orange-500"
                to="/admin/produits"
              />
              <StatCard
                icon={ClipboardList}
                label="Commandes"
                value={stats?.total_commandes ?? 0}
                sub={`Aujourd'hui: ${stats?.commandes_aujourdhui ?? 0}`}
                color="bg-purple-500"
              />
              <StatCard
                icon={TrendingUp}
                label="CA du mois"
                value={stats?.ca_mois ? `${parseFloat(stats.ca_mois).toLocaleString('fr-FR')} F` : null}
                color="bg-amber-500"
              />
            </div>

            {/* Revenue */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-5 text-white">
                <p className="text-orange-100 text-sm font-medium">CA aujourd'hui</p>
                <p className="text-3xl font-extrabold mt-1">
                  {parseFloat(stats?.ca_aujourdhui ?? 0).toLocaleString('fr-FR')}
                  <span className="text-lg font-normal ml-1">FCFA</span>
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl p-5 text-white">
                <p className="text-purple-100 text-sm font-medium">CA du mois</p>
                <p className="text-3xl font-extrabold mt-1">
                  {parseFloat(stats?.ca_mois ?? 0).toLocaleString('fr-FR')}
                  <span className="text-lg font-normal ml-1">FCFA</span>
                </p>
              </div>
            </div>

            {/* Popular products */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-gray-800">Produits populaires</h2>
                  <Link to="/admin/produits" className="text-xs text-orange-500 font-medium hover:text-orange-600 flex items-center gap-1">
                    Gérer <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                {stats?.produits_populaires?.length > 0 ? (
                  <div className="space-y-3">
                    {stats.produits_populaires.map((p, i) => (
                      <div key={p.id ?? i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="text-sm text-gray-700">{p.nom}</span>
                        </div>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          {p.total_commandes ?? p.nb_commandes ?? 0} cmd
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ShoppingBag className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Aucune commande enregistrée</p>
                  </div>
                )}
              </div>

            {/* Recent orders */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-800">Commandes récentes</h2>
              </div>
              {recentOrders.length === 0 ? (
                <div className="text-center py-10">
                  <ClipboardList className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Aucune commande pour l'instant</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2.5 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">N°</th>
                        <th className="text-left py-2.5 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Étudiant</th>
                        <th className="text-left py-2.5 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Secteur</th>
                        <th className="text-left py-2.5 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Statut</th>
                        <th className="text-right py-2.5 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => (
                        <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-xs text-gray-700">{order.numero_commande}</td>
                          <td className="py-2.5 px-3 text-gray-600">{order.etudiant_nom ?? '—'}</td>
                          <td className="py-2.5 px-3 text-gray-600">{order.secteur_nom ?? '—'}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                              {order.statut}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-gray-800">
                            {parseFloat(order.total_ttc ?? 0).toLocaleString('fr-FR')} FCFA
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
