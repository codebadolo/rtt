import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2, TrendingUp, Package, Clock,
  MapPin, CalendarDays,
} from 'lucide-react'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import { ordersApi } from '../../api/orders'

const PERIODES = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week',  label: '7 derniers jours' },
  { value: 'month', label: 'Ce mois' },
  { value: 'all',   label: 'Tout' },
]

function startOf(period) {
  const now = new Date()
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }
  if (period === 'week') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }
  return null
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
      <div className={`p-3 rounded-2xl ${color} flex-shrink-0`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold text-gray-900">{value ?? '—'}</p>
        <p className="text-sm text-gray-500 truncate">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function LivreurHistory() {
  const [periode, setPeriode] = useState('today')

  const { data: raw, isLoading } = useQuery({
    queryKey: ['livreur-history'],
    queryFn: () => ordersApi.list({ statut: 'DISTRIBUEE', page_size: 500 }),
    staleTime: 30_000,
  })

  const allOrders = useMemo(() => {
    const list = Array.isArray(raw) ? raw : raw?.results ?? []
    return list
  }, [raw])

  const filtered = useMemo(() => {
    const from = startOf(periode)
    if (!from) return allOrders
    return allOrders.filter((o) => new Date(o.date_creation) >= from)
  }, [allOrders, periode])

  const totalCA = filtered.reduce((s, o) => s + parseFloat(o.total_ttc ?? 0), 0)

  // today stats always
  const todayFrom = startOf('today')
  const todayOrders = allOrders.filter((o) => new Date(o.date_creation) >= todayFrom)
  const todayCA = todayOrders.reduce((s, o) => s + parseFloat(o.total_ttc ?? 0), 0)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[
          { label: 'Tableau de bord', to: '/livreur' },
          { label: 'Historique des livraisons' },
        ]} />

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historique des livraisons</h1>
          <p className="text-gray-500 mt-1">Toutes vos livraisons effectuées</p>
        </div>

        {/* Stats du jour fixes */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={CheckCircle2} label="Livraisons auj."
            value={todayOrders.length} color="bg-green-500"
          />
          <StatCard
            icon={TrendingUp} label="CA distribué auj."
            value={`${todayCA.toLocaleString('fr-FR')} F`} color="bg-orange-500"
          />
          <StatCard
            icon={Package} label="Total livraisons"
            value={allOrders.length} color="bg-blue-500"
          />
          <StatCard
            icon={TrendingUp} label="CA total distribué"
            value={`${allOrders.reduce((s, o) => s + parseFloat(o.total_ttc ?? 0), 0).toLocaleString('fr-FR')} F`}
            color="bg-purple-500"
          />
        </div>

        {/* Filtre période */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-2xl p-1.5 w-fit flex-wrap">
          {PERIODES.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriode(p.value)}
              className={[
                'px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                periode === p.value ? 'bg-white shadow text-orange-500' : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Résumé période */}
        {filtered.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-3 flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-orange-700">
                {filtered.length} livraison{filtered.length > 1 ? 's' : ''} — {PERIODES.find((p) => p.value === periode)?.label}
              </p>
            </div>
            <div className="ml-auto">
              <p className="text-sm font-bold text-orange-700">{totalCA.toLocaleString('fr-FR')} FCFA distribués</p>
            </div>
          </div>
        )}

        {/* Liste */}
        {isLoading ? (
          <LoadingSpinner className="py-20" size="lg" />
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl text-center py-16 shadow-sm">
            <Package className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aucune livraison sur cette période</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => (
              <div key={order.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-start gap-4">
                <div className="p-2.5 bg-green-100 rounded-xl flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm text-gray-700">{order.numero_commande}</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Distribuée</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5 font-medium">
                    {order.etudiant_nom ?? order.etudiant?.nom ?? '—'}
                  </p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-400 flex-wrap">
                    {(order.salle_nom ?? order.salle?.nom) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {order.secteur_nom ?? '—'} · {order.salle_nom ?? order.salle?.nom}
                      </span>
                    )}
                    {order.heure_souhaitee && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {order.heure_souhaitee}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {new Date(order.date_creation).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-orange-500">{parseFloat(order.total_ttc ?? 0).toLocaleString('fr-FR')} F</p>
                  <p className="text-xs text-gray-400 mt-0.5">{order.methode_paiement}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
