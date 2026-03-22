import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  TrendingUp,
  ShoppingBag,
  Percent,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
} from 'lucide-react'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import { comptabiliteApi } from '../../api/admin'

const PERIODES = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week',  label: '7 derniers jours' },
  { value: 'month', label: 'Ce mois' },
  { value: 'all',   label: 'Tout' },
]

function StatCard({ icon: Icon, label, value, sub, color = 'text-gray-700', bg = 'bg-white' }) {
  return (
    <div className={`${bg} border border-gray-100 rounded-2xl p-5 shadow-sm`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl ${bg === 'bg-white' ? 'bg-gray-50' : 'bg-white/30'}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className={`text-xs mt-1 font-medium ${color}`}>{sub}</p>}
    </div>
  )
}

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR')
}

export default function AdminComptabilite() {
  const [periode, setPeriode] = useState('month')

  const { data, isLoading } = useQuery({
    queryKey: ['comptabilite', periode],
    queryFn: () => comptabiliteApi.get(periode),
  })

  const r = data?.resume ?? {}
  const evolution = data?.evolution ?? []
  const parSecteur = data?.par_secteur ?? []
  const taux = data?.taux_service ?? 10

  const maxCA = Math.max(...evolution.map((e) => e.ca_brut), 1)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Comptabilité' }]} />

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Comptabilité</h1>
            <p className="text-gray-500 mt-1">Suivi financier des commandes — frais de service {taux}%</p>
          </div>

          {/* Période selector */}
          <div className="relative">
            <select
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
              className="input pr-8 appearance-none cursor-pointer font-medium"
            >
              {PERIODES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner className="py-20" size="lg" />
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={TrendingUp}
                label="CA brut encaissé"
                value={`${fmt(r.ca_brut)} FCFA`}
                sub={`${r.nb_commandes_encaissees} commande${r.nb_commandes_encaissees !== 1 ? 's' : ''} encaissée${r.nb_commandes_encaissees !== 1 ? 's' : ''}`}
                color="text-primary-600"
              />
              <StatCard
                icon={ShoppingBag}
                label="Revenus produits"
                value={`${fmt(r.revenus_produits)} FCFA`}
                sub="Part reversée aux fournisseurs"
                color="text-blue-600"
              />
              <StatCard
                icon={Percent}
                label="Frais de service collectés"
                value={`${fmt(r.frais_service_total)} FCFA`}
                sub={`${taux}% du sous-total produits`}
                color="text-green-600"
              />
              <StatCard
                icon={BarChart3}
                label="Commandes totales"
                value={r.nb_total ?? 0}
                sub={`${r.nb_en_attente ?? 0} en attente`}
                color="text-orange-500"
              />
            </div>

            {/* Statuts */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-green-700">{r.nb_validees ?? 0}</p>
                  <p className="text-xs text-green-600 font-medium">Validées / Livrées</p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3">
                <Clock className="h-8 w-8 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-amber-700">{r.nb_en_attente ?? 0}</p>
                  <p className="text-xs text-amber-600 font-medium">En attente</p>
                </div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{r.nb_annulees ?? 0}</p>
                  <p className="text-xs text-red-500 font-medium">Annulées / Rejetées</p>
                </div>
              </div>
            </div>

            {/* Répartition des frais */}
            {r.frais_service_total > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Répartition du CA</h2>
                <div className="space-y-3">
                  {[
                    {
                      label: 'Revenus produits',
                      montant: r.revenus_produits,
                      total: r.ca_brut,
                      color: 'bg-blue-400',
                    },
                    {
                      label: 'Frais de service',
                      montant: r.frais_service_total,
                      total: r.ca_brut,
                      color: 'bg-green-400',
                    },
                  ].map((item) => {
                    const pct = r.ca_brut > 0 ? (item.montant / r.ca_brut) * 100 : 0
                    return (
                      <div key={item.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{item.label}</span>
                          <span className="font-semibold text-gray-800">
                            {fmt(item.montant)} FCFA
                            <span className="text-gray-400 font-normal ml-1">({pct.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${item.color} rounded-full transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Évolution journalière */}
            {evolution.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Évolution du CA</h2>
                <div className="flex items-end gap-1 h-40">
                  {evolution.map((e, i) => {
                    const h = maxCA > 0 ? (e.ca_brut / maxCA) * 100 : 0
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="relative w-full flex flex-col items-center justify-end" style={{ height: '120px' }}>
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-1 bg-gray-800 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                            {fmt(e.ca_brut)} FCFA<br />
                            {e.nb_commandes} commande{e.nb_commandes !== 1 ? 's' : ''}
                          </div>
                          <div
                            className="w-full bg-primary-400 hover:bg-primary-500 rounded-t-sm transition-all"
                            style={{ height: `${Math.max(h, e.ca_brut > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 text-center">{e.date}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Par secteur */}
            {parSecteur.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-800">Performance par secteur</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Secteur</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Commandes</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CA brut</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Produits</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Frais service</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {parSecteur.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 font-medium text-gray-800">{s.nom}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{s.nb_commandes}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(s.ca_brut)} F</td>
                          <td className="px-4 py-3 text-right text-blue-600">{fmt(s.revenus_produits)} F</td>
                          <td className="px-6 py-3 text-right text-green-600 font-medium">{fmt(s.frais_service)} F</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-bold">
                        <td className="px-6 py-3 text-gray-800">Total</td>
                        <td className="px-4 py-3 text-right text-gray-800">{r.nb_commandes_encaissees}</td>
                        <td className="px-4 py-3 text-right text-gray-800">{fmt(r.ca_brut)} F</td>
                        <td className="px-4 py-3 text-right text-blue-700">{fmt(r.revenus_produits)} F</td>
                        <td className="px-6 py-3 text-right text-green-700">{fmt(r.frais_service_total)} F</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {r.nb_total === 0 && (
              <div className="text-center py-16 text-gray-400">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Aucune donnée pour cette période</p>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
