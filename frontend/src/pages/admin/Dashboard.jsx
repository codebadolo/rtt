import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Users, ShoppingBag, ClipboardList, TrendingUp,
  ChevronRight, Package, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useState } from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import { adminApi } from '../../api/admin'
import { usersApi } from '../../api/users'

const STATUT_COLORS = {
  EN_ATTENTE: 'bg-yellow-100 text-yellow-700',
  VALIDEE:    'bg-blue-100 text-blue-700',
  PRETE:      'bg-purple-100 text-purple-700',
  DISTRIBUEE: 'bg-green-100 text-green-700',
  REJETEE:    'bg-red-100 text-red-700',
}

const STATUT_LABELS = {
  EN_ATTENTE: 'En attente',
  VALIDEE:    'Validée',
  PRETE:      'Prête',
  DISTRIBUEE: 'Distribuée',
  REJETEE:    'Rejetée',
}

function StatCard({ icon: Icon, label, value, sub, colorBg, colorText, to, trend }) {
  const inner = (
    <div className={`bg-white border border-gray-100 rounded-2xl p-5 flex items-start gap-4 ${to ? 'hover:shadow-md transition-all cursor-pointer' : ''}`}>
      <div className={`p-3 rounded-2xl ${colorBg} flex-shrink-0`}>
        <Icon className={`h-6 w-6 ${colorText}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-extrabold text-gray-900">{value ?? <span className="text-gray-300">—</span>}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {trend != null && (
        <div className={`flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {trend >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

const CustomTooltipCA = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === 'ca' ? 'CA' : 'Commandes'} : <span className="font-bold">
            {p.name === 'ca' ? `${p.value.toLocaleString('fr-FR')} FCFA` : p.value}
          </span>
        </p>
      ))}
    </div>
  )
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState('week')

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.stats(),
  })

  const { data: tendances = [], isLoading: tendancesLoading } = useQuery({
    queryKey: ['admin-tendances', period],
    queryFn: () => adminApi.tendances(period),
  })

  const { data: usersRaw } = useQuery({
    queryKey: ['all-users-count'],
    queryFn: () => usersApi.list(),
  })

  const userCount = Array.isArray(usersRaw)
    ? usersRaw.length
    : usersRaw?.count ?? usersRaw?.results?.length ?? null

  const recentOrders = stats?.commandes_recentes ?? []
  const topSecteurs = stats?.top_secteurs ?? []

  const maxSecteurCA = Math.max(...topSecteurs.map((s) => s.total_ca), 1)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
            <p className="text-gray-500 mt-1">Vue d'ensemble de Ritoto Campus</p>
          </div>
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
                colorBg="bg-blue-50"
                colorText="text-blue-500"
                to="/admin/utilisateurs"
              />
              <StatCard
                icon={Package}
                label="Produits actifs"
                value={stats?.total_produits}
                colorBg="bg-orange-50"
                colorText="text-orange-500"
                to="/admin/produits"
              />
              <StatCard
                icon={ClipboardList}
                label="Commandes total"
                value={stats?.total_commandes ?? 0}
                sub={`Aujourd'hui : ${stats?.commandes_aujourdhui ?? 0}`}
                colorBg="bg-purple-50"
                colorText="text-purple-500"
              />
              <StatCard
                icon={TrendingUp}
                label="CA du mois"
                value={stats?.ca_mois ? `${parseFloat(stats.ca_mois).toLocaleString('fr-FR')} F` : '0 F'}
                sub={`Aujourd'hui : ${parseFloat(stats?.ca_aujourdhui ?? 0).toLocaleString('fr-FR')} F`}
                colorBg="bg-green-50"
                colorText="text-green-500"
              />
            </div>

            {/* Graphiques tendances */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-gray-800">Évolution du chiffre d'affaires</h2>
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  {[{ key: 'week', label: '7 jours' }, { key: 'month', label: '30 jours' }].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setPeriod(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        period === key ? 'bg-white shadow text-orange-500' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {tendancesLoading ? (
                <div className="flex items-center justify-center h-48">
                  <LoadingSpinner />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={tendances} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltipCA />} />
                    <Area
                      type="monotone"
                      dataKey="ca"
                      name="ca"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      fill="url(#caGradient)"
                      dot={{ fill: '#f97316', r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#f97316' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Commandes par jour + Top secteurs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Commandes par jour */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <h2 className="font-semibold text-gray-800 mb-5">Commandes par jour</h2>
                {tendancesLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={tendances} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltipCA />} />
                      <Bar dataKey="commandes" name="commandes" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Top secteurs */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <h2 className="font-semibold text-gray-800 mb-4">CA par secteur</h2>
                {topSecteurs.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                    Aucune donnée
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topSecteurs.map((s, i) => {
                      const pct = Math.round((s.total_ca / maxSecteurCA) * 100)
                      return (
                        <div key={s.id}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700 truncate max-w-[60%]">{s.nom}</span>
                            <span className="text-gray-500 text-xs">{s.total_ca.toLocaleString('fr-FR')} FCFA</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${pct}%`,
                                background: i === 0 ? '#f97316' : i === 1 ? '#fb923c' : i === 2 ? '#fdba74' : '#fed7aa',
                              }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{s.total_commandes} commandes</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Produits populaires + Commandes récentes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Produits populaires */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-800">Produits populaires</h2>
                  <Link to="/admin/produits" className="text-xs text-orange-500 font-medium hover:text-orange-600 flex items-center gap-1">
                    Gérer <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                {stats?.produits_populaires?.length > 0 ? (
                  <div className="space-y-3">
                    {stats.produits_populaires.map((p, i) => (
                      <div key={p.produit__id ?? i} className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                          i === 0 ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="text-sm text-gray-700 flex-1 truncate">{p.produit__nom ?? p.nom}</span>
                        <span className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded-full font-medium">
                          {p.total ?? p.total_commandes ?? 0} cmd
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

              {/* Commandes récentes */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-800">Commandes récentes</h2>
                  <Link to="/admin/commandes" className="text-xs text-orange-500 font-medium hover:text-orange-600 flex items-center gap-1">
                    Toutes <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                {recentOrders.length === 0 ? (
                  <div className="text-center py-10">
                    <ClipboardList className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">Aucune commande</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentOrders.slice(0, 6).map((order) => (
                      <div key={order.id} className="flex items-center gap-3 py-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-gray-500">{order.numero_commande}</p>
                          <p className="text-sm font-medium text-gray-800 truncate">{order.etudiant ?? order.etudiant_nom ?? '—'}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLORS[order.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUT_LABELS[order.statut] ?? order.statut}
                        </span>
                        <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                          {parseFloat(order.total ?? order.total_ttc ?? 0).toLocaleString('fr-FR')} F
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
