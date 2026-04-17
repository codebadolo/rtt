import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  BarChart3, TrendingUp, ShoppingBag, Percent, CheckCircle2,
  Clock, XCircle, ChevronDown, Wallet, ArrowDownToLine,
  RefreshCw, Building2, DoorOpen,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import { comptabiliteApi, soldeApi, settlementsApi } from '../../api/admin'

// ─── Constantes ───────────────────────────────────────────────────────────────
const PERIODES = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week',  label: '7 derniers jours' },
  { value: 'month', label: 'Ce mois' },
  { value: 'all',   label: 'Tout' },
]


const COLORS_SECTEUR = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b']
const COLORS_PIE = ['#3b82f6', '#10b981']

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function fmt(n) { return Number(n || 0).toLocaleString('fr-FR') }

function StatCard({ icon: Icon, label, value, sub, color = 'text-gray-700', bg = 'bg-white' }) {
  return (
    <div className={`${bg} border border-gray-100 rounded-2xl p-5 shadow-sm`}>
      <div className={`inline-flex p-2 rounded-xl ${bg === 'bg-white' ? 'bg-gray-50' : 'bg-white/30'} mb-3`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className={`text-xs mt-1 font-medium ${color}`}>{sub}</p>}
    </div>
  )
}

// Tooltip personnalisé recharts
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

// ─── Composant Settlement ─────────────────────────────────────────────────────
function SettlementsPanel() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ montant: '', compte: 'orange', note: '' })

  const { data: soldeData, isLoading: soldeLoading } = useQuery({
    queryKey: ['solde'],
    queryFn: soldeApi.get,
    retry: false,
  })

  const { data: settData, isLoading: settLoading } = useQuery({
    queryKey: ['settlements'],
    queryFn: settlementsApi.list,
  })

  const createMut = useMutation({
    mutationFn: settlementsApi.create,
    onSuccess: () => {
      toast.success('Settlement déclenché avec succès')
      queryClient.invalidateQueries(['settlements'])
      queryClient.invalidateQueries(['solde'])
      setForm({ montant: '', compte: 'orange', note: '' })
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Erreur settlement'),
  })

  const syncMut = useMutation({
    mutationFn: settlementsApi.sync,
    onSuccess: () => {
      toast.success('Statut mis à jour')
      queryClient.invalidateQueries(['settlements'])
    },
  })

  const solde = soldeData?.solde?.collection_balances
  const settlements = settData?.settlements ?? []

  const statutColor = {
    processing: 'bg-amber-100 text-amber-700',
    in_transit: 'bg-blue-100 text-blue-700',
    success:    'bg-green-100 text-green-700',
    cancelled:  'bg-gray-100 text-gray-600',
    failed:     'bg-red-100 text-red-600',
  }

  return (
    <div className="space-y-6">
      {/* Solde Senfenico */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary-500" />
            Solde Senfenico
          </h2>
          {soldeLoading && <LoadingSpinner size="sm" />}
        </div>

        {solde ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-xs text-green-600 font-medium mb-1">Disponible</p>
              <p className="text-2xl font-bold text-green-700">{fmt(solde.available)} FCFA</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4">
              <p className="text-xs text-amber-600 font-medium mb-1">En attente</p>
              <p className="text-2xl font-bold text-amber-700">{fmt(solde.pending)} FCFA</p>
            </div>
          </div>
        ) : !soldeLoading && (
          <p className="text-sm text-gray-400">Impossible de récupérer le solde Senfenico.</p>
        )}

      </div>

      {/* Formulaire settlement */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
          <ArrowDownToLine className="h-5 w-5 text-primary-500" />
          Déclencher un virement
        </h2>
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 text-xs text-blue-700">
          Le virement est envoyé vers le compte configuré dans votre dashboard Senfenico (Business Settings → Payment Account).
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Montant (FCFA)</label>
            <input
              type="number"
              min="100"
              placeholder="ex: 50000"
              value={form.montant}
              onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))}
              className="input w-full"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Note (optionnel)</label>
            <input
              type="text"
              placeholder="ex: Recettes du 17 avril"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="input w-full"
            />
          </div>
        </div>
        <button
          onClick={() => createMut.mutate({ montant: parseInt(form.montant), compte: 'orange', note: form.note })}
          disabled={!form.montant || createMut.isPending}
          className="btn-primary mt-3 flex items-center gap-2 disabled:opacity-50"
        >
          {createMut.isPending ? <LoadingSpinner size="sm" /> : <ArrowDownToLine className="h-4 w-4" />}
          Virer maintenant
        </button>
      </div>

      {/* Total viré */}
      {settData?.total_settle > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-lg font-bold text-gray-900">{fmt(settData.total_settle)} F</p>
          <p className="text-xs text-gray-500">Total viré (virements réussis)</p>
        </div>
      )}

      {/* Historique */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Historique des virements</h2>
        </div>
        {settLoading ? (
          <LoadingSpinner className="py-8" />
        ) : settlements.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">Aucun virement effectué</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Référence</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Montant</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Note</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-mono text-xs text-gray-500">{s.reference_senfenico.slice(0, 20)}…</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(s.montant)} F</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutColor[s.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                        {s.statut_display}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.note || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(s.date_creation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => syncMut.mutate(s.reference_senfenico)}
                        disabled={syncMut.isPending}
                        title="Mettre à jour le statut"
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function AdminComptabilite() {
  const [periode, setPeriode] = useState('month')
  const [tab, setTab] = useState('stats') // 'stats' | 'salles' | 'settlements'

  const { data, isLoading } = useQuery({
    queryKey: ['comptabilite', periode],
    queryFn: () => comptabiliteApi.get(periode),
  })

  const r = data?.resume ?? {}
  const evolution = data?.evolution ?? []
  const parSecteur = data?.par_secteur ?? []
  const parSalle = data?.par_salle ?? []
  const taux = data?.taux_service ?? 10

  // Données pie chart
  const pieData = r.ca_brut > 0 ? [
    { name: 'Revenus produits', value: r.revenus_produits },
    { name: 'Frais service',    value: r.frais_service_total },
  ] : []

  // Données bar par secteur (top 6)
  const barSecteurData = parSecteur.slice(0, 6).map((s) => ({
    name: s.nom.replace('Secteur ', 'Sec. '),
    'CA brut': s.ca_brut,
    'Frais service': s.frais_service,
  }))

  const TABS = [
    { id: 'stats',      label: 'Vue globale',   icon: BarChart3 },
    { id: 'salles',     label: 'Par salle',      icon: DoorOpen },
    { id: 'settlements',label: 'Virements',      icon: Wallet },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Comptabilité' }]} />

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Comptabilité</h1>
            <p className="text-gray-500 mt-1">
              Suivi financier — frais de service {taux}% · Senfenico 2.99%
            </p>
          </div>
          {tab !== 'settlements' && (
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
          )}
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

        {/* Tab : Vue globale */}
        {tab === 'stats' && (
          isLoading ? <LoadingSpinner className="py-20" size="lg" /> : (
            <div className="space-y-6">
              {/* KPI */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={TrendingUp}
                  label="CA brut encaissé"
                  value={`${fmt(r.ca_brut)} F`}
                  sub={`${r.nb_commandes_encaissees ?? 0} commandes`}
                  color="text-primary-600"
                />
                <StatCard
                  icon={ShoppingBag}
                  label="Revenus produits"
                  value={`${fmt(r.revenus_produits)} F`}
                  color="text-blue-600"
                />
                <StatCard
                  icon={Percent}
                  label="Frais de service"
                  value={`${fmt(r.frais_service_total)} F`}
                  sub={`${taux}% du sous-total`}
                  color="text-green-600"
                />
                <StatCard
                  icon={BarChart3}
                  label="Total commandes"
                  value={r.nb_total ?? 0}
                  sub={`${r.nb_en_attente ?? 0} en attente`}
                  color="text-orange-500"
                />
              </div>

              {/* Statuts */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { icon: CheckCircle2, label: 'Validées / Livrées', val: r.nb_validees,  bg: 'bg-green-50', border: 'border-green-100', iconColor: 'text-green-500', textColor: 'text-green-700' },
                  { icon: Clock,        label: 'En attente',          val: r.nb_en_attente, bg: 'bg-amber-50', border: 'border-amber-100', iconColor: 'text-amber-500',  textColor: 'text-amber-700' },
                  { icon: XCircle,      label: 'Annulées / Rejetées', val: r.nb_annulees,  bg: 'bg-red-50',   border: 'border-red-100',   iconColor: 'text-red-400',    textColor: 'text-red-600' },
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Line chart évolution */}
                {evolution.length > 0 && (
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">Évolution du CA</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={evolution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="ca_brut"
                          name="CA brut"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="frais_service"
                          name="Frais service"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                          strokeDasharray="4 2"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Pie chart répartition */}
                {pieData.length > 0 && (
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">Répartition du CA</h2>
                    <div className="flex items-center gap-6">
                      <ResponsiveContainer width="50%" height={180}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {pieData.map((_, i) => (
                              <Cell key={i} fill={COLORS_PIE[i]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => `${fmt(v)} FCFA`} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-3">
                        {pieData.map((d, i) => {
                          const pct = r.ca_brut > 0 ? ((d.value / r.ca_brut) * 100).toFixed(1) : 0
                          return (
                            <div key={d.name}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COLORS_PIE[i] }} />
                                  {d.name}
                                </span>
                                <span className="font-semibold">{pct}%</span>
                              </div>
                              <p className="text-xs text-gray-500 ml-4">{fmt(d.value)} FCFA</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bar chart par secteur */}
              {barSecteurData.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                  <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary-500" />
                    CA par secteur
                  </h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={barSecteurData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="CA brut" fill="#f97316" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Frais service" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Tableau par secteur */}
              {parSecteur.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-800">Détail par secteur</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Secteur</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Commandes</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">CA brut</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Produits</th>
                          <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Frais</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {parSecteur.map((s, i) => (
                          <tr key={s.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3">
                              <span
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{ background: COLORS_SECTEUR[i % COLORS_SECTEUR.length] }}
                              >
                                {i + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-800">{s.nom}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{s.nb_commandes}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(s.ca_brut)} F</td>
                            <td className="px-4 py-3 text-right text-blue-600">{fmt(s.revenus_produits)} F</td>
                            <td className="px-6 py-3 text-right text-green-600 font-medium">{fmt(s.frais_service)} F</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 font-bold">
                          <td className="px-6 py-3" />
                          <td className="px-4 py-3 text-gray-800">Total</td>
                          <td className="px-4 py-3 text-right text-gray-800">{r.nb_commandes_encaissees ?? 0}</td>
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
            </div>
          )
        )}

        {/* Tab : Par salle */}
        {tab === 'salles' && (
          isLoading ? <LoadingSpinner className="py-20" size="lg" /> : (
            <div className="space-y-6">
              {/* Bar chart top salles */}
              {parSalle.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                  <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <DoorOpen className="h-5 w-5 text-primary-500" />
                    Top salles par CA (10 premières)
                  </h2>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={parSalle.slice(0, 10).map((s) => ({ name: s.salle_code, 'CA brut': s.ca_brut }))} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                      <Tooltip formatter={(v) => `${fmt(v)} FCFA`} />
                      <Bar dataKey="CA brut" fill="#f97316" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Tableau complet */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-800">Toutes les salles</h2>
                </div>
                {parSalle.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">Aucune commande pour cette période</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Salle</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Secteur</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Commandes</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">CA brut</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Produits</th>
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
                            <td className="px-4 py-3 text-gray-500">{s.secteur_nom}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{s.nb_commandes}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(s.ca_brut)} F</td>
                            <td className="px-4 py-3 text-right text-blue-600">{fmt(s.revenus_produits)} F</td>
                            <td className="px-6 py-3 text-right text-green-600 font-medium">{fmt(s.frais_service)} F</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* Tab : Virements */}
        {tab === 'settlements' && <SettlementsPanel />}
      </div>
    </DashboardLayout>
  )
}
