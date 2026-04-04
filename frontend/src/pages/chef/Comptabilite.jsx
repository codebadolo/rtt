import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  BarChart3, TrendingUp, ShoppingBag, Percent,
  CheckCircle2, Clock, XCircle, ChevronDown, DoorOpen,
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

function fmt(n) { return Number(n || 0).toLocaleString('fr-FR') }

function StatCard({ icon: Icon, label, value, sub, color = 'text-gray-700' }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="inline-flex p-2 rounded-xl bg-gray-50 mb-3">
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className={`text-xs mt-1 font-medium ${color}`}>{sub}</p>}
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name} : {fmt(p.value)} FCFA
        </p>
      ))}
    </div>
  )
}

export default function ChefComptabilite() {
  const [periode, setPeriode] = useState('month')
  const [tab, setTab] = useState('stats')

  const { data, isLoading } = useQuery({
    queryKey: ['comptabilite-chef', periode],
    queryFn: () => comptabiliteApi.get(periode),
  })

  const r = data?.resume ?? {}
  const evolution = data?.evolution ?? []
  const parSalle = data?.par_salle ?? []
  const taux = data?.taux_service ?? 10

  const TABS = [
    { id: 'stats',  label: 'Vue globale', icon: BarChart3 },
    { id: 'salles', label: 'Par salle',   icon: DoorOpen },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Chef Secteur', to: '/chef' }, { label: 'Comptabilité' }]} />

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Comptabilité</h1>
            <p className="text-gray-500 mt-1">Suivi de votre secteur — frais de service {taux}%</p>
          </div>
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

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === id ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <LoadingSpinner className="py-20" size="lg" />
        ) : (
          <>
            {tab === 'stats' && (
              <div className="space-y-6">
                {/* KPI */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard icon={TrendingUp} label="CA brut encaissé" value={`${fmt(r.ca_brut)} F`}
                    sub={`${r.nb_commandes_encaissees ?? 0} commandes`} color="text-primary-600" />
                  <StatCard icon={ShoppingBag} label="Revenus produits" value={`${fmt(r.revenus_produits)} F`} color="text-blue-600" />
                  <StatCard icon={Percent} label="Frais de service" value={`${fmt(r.frais_service_total)} F`}
                    sub={`${taux}% du sous-total`} color="text-green-600" />
                  <StatCard icon={BarChart3} label="Total commandes" value={r.nb_total ?? 0}
                    sub={`${r.nb_en_attente ?? 0} en attente`} color="text-orange-500" />
                </div>

                {/* Statuts */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { icon: CheckCircle2, label: 'Validées / Livrées', val: r.nb_validees,   bg: 'bg-green-50', border: 'border-green-100', iconColor: 'text-green-500', textColor: 'text-green-700' },
                    { icon: Clock,        label: 'En attente',          val: r.nb_en_attente, bg: 'bg-amber-50', border: 'border-amber-100', iconColor: 'text-amber-500',  textColor: 'text-amber-700' },
                    { icon: XCircle,      label: 'Annulées / Rejetées', val: r.nb_annulees,   bg: 'bg-red-50',   border: 'border-red-100',   iconColor: 'text-red-400',    textColor: 'text-red-600' },
                  ].map(({ icon: Icon, label, val, bg, border, iconColor, textColor }) => (
                    <div key={label} className={`${bg} border ${border} rounded-2xl p-4 flex items-center gap-3`}>
                      <Icon className={`h-8 w-8 ${iconColor} flex-shrink-0`} />
                      <div>
                        <p className={`text-2xl font-bold ${textColor}`}>{val ?? 0}</p>
                        <p className={`text-xs font-medium ${textColor} opacity-80`}>{label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Évolution */}
                {evolution.length > 0 && (
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">Évolution du CA</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={evolution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line type="monotone" dataKey="ca_brut" name="CA brut" stroke="#f97316" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="frais_service" name="Frais" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {r.nb_total === 0 && (
                  <div className="text-center py-16 text-gray-400">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Aucune donnée pour cette période</p>
                  </div>
                )}
              </div>
            )}

            {tab === 'salles' && (
              <div className="space-y-6">
                {parSalle.length > 0 && (
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">Top salles par CA</h2>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={parSalle.slice(0, 10).map((s) => ({ name: s.salle_code, 'CA brut': s.ca_brut }))} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                        <Tooltip formatter={(v) => `${fmt(v)} FCFA`} />
                        <Bar dataKey="CA brut" fill="#f97316" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-800">Détail par salle</h2>
                  </div>
                  {parSalle.length === 0 ? (
                    <p className="text-center text-gray-400 py-8 text-sm">Aucune commande pour cette période</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Salle</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Commandes</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">CA brut</th>
                            <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Frais</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {parSalle.map((s, i) => (
                            <tr key={s.salle_id ?? i} className="hover:bg-gray-50">
                              <td className="px-6 py-3">
                                <p className="font-medium text-gray-800">{s.salle_nom}</p>
                                <p className="text-xs text-gray-400">{s.salle_code}</p>
                              </td>
                              <td className="px-4 py-3 text-right text-gray-600">{s.nb_commandes}</td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(s.ca_brut)} F</td>
                              <td className="px-6 py-3 text-right text-green-600 font-medium">{fmt(s.frais_service)} F</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
