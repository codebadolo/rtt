import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, Clock, CheckCircle, XCircle, Package,
  Truck, Ban, TrendingUp,
} from 'lucide-react'
import DashboardLayout from '../../layouts/DashboardLayout'
import Breadcrumb from '../../components/Breadcrumb'
import DataTable from '../../components/DataTable'
import { ordersApi } from '../../api/orders'
import { adminApi } from '../../api/admin'

/* ── Status config ── */
const STATUS_CFG = {
  BROUILLON:   { cls: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-400',    label: 'Brouillon' },
  EN_ATTENTE:  { cls: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400',   label: 'En attente' },
  VALIDEE:     { cls: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400',    label: 'Validée' },
  REJETEE:     { cls: 'bg-red-100 text-red-700',      dot: 'bg-red-400',     label: 'Rejetée' },
  PRETE:       { cls: 'bg-indigo-100 text-indigo-700',dot: 'bg-indigo-400',  label: 'Prête' },
  DISTRIBUEE:  { cls: 'bg-green-100 text-green-700',  dot: 'bg-green-400',   label: 'Distribuée' },
  ANNULEE:     { cls: 'bg-rose-100 text-rose-700',    dot: 'bg-rose-400',    label: 'Annulée' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? { cls: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400', label: status }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

/* ── Payment pill ── */
const PAY_STYLES = {
  ORANGE: 'bg-orange-100 text-orange-700',
  MOOV:   'bg-blue-100 text-blue-700',
  SANK:   'bg-indigo-100 text-indigo-700',
}
function PayPill({ method }) {
  if (!method) return <span className="text-gray-300 text-xs">—</span>
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${PAY_STYLES[method] ?? 'bg-gray-100 text-gray-500'}`}>
      {method}
    </span>
  )
}

/* ── Stats card ── */
function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
      <div className={`p-3 rounded-2xl ${color} flex-shrink-0`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold text-gray-900 tabular-nums">{value ?? <span className="text-gray-200">…</span>}</p>
        <p className="text-sm text-gray-500 truncate">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

/* ── Status filter pills ── */
const STATUS_FILTERS = [
  { value: '', label: 'Toutes' },
  { value: 'EN_ATTENTE',  label: 'En attente' },
  { value: 'VALIDEE',     label: 'Validées' },
  { value: 'REJETEE',     label: 'Rejetées' },
  { value: 'PRETE',       label: 'Prêtes' },
  { value: 'DISTRIBUEE',  label: 'Distribuées' },
  { value: 'ANNULEE',     label: 'Annulées' },
]

/* ── Main ── */
export default function AdminOrders() {
  const [page, setPage] = useState(1)
  const [statut, setStatut] = useState('')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['all-orders', page, statut, search],
    queryFn: () => ordersApi.list({ page, statut: statut || undefined, search: search || undefined }),
  })

  const { data: dashStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.stats(),
    staleTime: 60_000,
  })

  const orders = Array.isArray(data) ? data : data?.results ?? []
  const total  = data?.count ?? orders.length
  const totalPages = data?.count ? Math.ceil(data.count / 10) : 1

  /* derive stats from loaded orders (or dashboard stats) */
  const allOrders = Array.isArray(data) ? data : []
  const stats = {
    total:      dashStats?.total_commandes   ?? total,
    today:      dashStats?.commandes_aujourdhui ?? 0,
    enAttente:  allOrders.filter((o) => o.statut === 'EN_ATTENTE').length,
    distribuees:allOrders.filter((o) => o.statut === 'DISTRIBUEE').length,
    ca_today:   parseFloat(dashStats?.ca_aujourdhui ?? 0),
    ca_mois:    parseFloat(dashStats?.ca_mois ?? 0),
  }

  /* DataTable columns */
  const columns = [
    {
      key: 'numero_commande',
      label: 'N° Commande',
      sortable: true,
      className: 'font-mono text-xs font-semibold text-gray-800 whitespace-nowrap',
    },
    {
      key: 'etudiant_nom',
      label: 'Étudiant',
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="font-medium text-gray-800">
            {row.etudiant_prenom ?? ''} {row.etudiant_nom ?? '—'}
          </p>
          {row.etudiant_email && (
            <p className="text-xs text-gray-400 truncate max-w-[160px]">{row.etudiant_email}</p>
          )}
        </div>
      ),
    },
    {
      key: 'secteur_nom',
      label: 'Secteur / Salle',
      render: (_, row) => (
        <div>
          <p className="text-gray-700">{row.secteur_nom ?? '—'}</p>
          {row.salle_nom && <p className="text-xs text-gray-400">{row.salle_nom}</p>}
        </div>
      ),
    },
    {
      key: 'statut',
      label: 'Statut',
      sortable: true,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'methode_paiement',
      label: 'Paiement',
      render: (v) => <PayPill method={v} />,
    },
    {
      key: 'total_ttc',
      label: 'Total TTC',
      sortable: true,
      headerClass: 'text-right',
      className: 'text-right font-bold text-gray-900 tabular-nums whitespace-nowrap',
      render: (v) => `${parseFloat(v ?? 0).toLocaleString('fr-FR')} FCFA`,
    },
    {
      key: 'date_creation',
      label: 'Date',
      sortable: true,
      className: 'text-gray-400 text-xs tabular-nums whitespace-nowrap',
      render: (v) => v ? new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Commandes' }]} />

        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Commandes</h1>
          <p className="text-gray-400 text-sm mt-0.5">Suivi de toutes les commandes de la plateforme</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard icon={ClipboardList} label="Total commandes"   value={stats.total}      color="bg-slate-700"   sub={`Aujourd'hui : ${stats.today}`} />
          <StatCard icon={Clock}         label="En attente"         value={stats.enAttente}  color="bg-amber-500" />
          <StatCard icon={Truck}         label="Distribuées"        value={stats.distribuees}color="bg-green-500" />
          <StatCard icon={TrendingUp}    label="CA du jour"
            value={`${stats.ca_today.toLocaleString('fr-FR')} F`}
            color="bg-orange-500"
            sub={`Mois : ${stats.ca_mois.toLocaleString('fr-FR')} FCFA`}
          />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatut(f.value); setPage(1) }}
              className={[
                'px-4 py-1.5 rounded-xl text-sm font-medium transition-colors border',
                statut === f.value
                  ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* DataTable */}
        <DataTable
          columns={columns}
          data={orders}
          isLoading={isLoading}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Rechercher par numéro ou étudiant…"
          total={total}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          emptyIcon={<ClipboardList className="w-14 h-14" />}
          emptyText="Aucune commande trouvée"
          onRowClick={(row) => navigate(`/admin/commandes/${row.id}`)}
        />
      </div>
    </DashboardLayout>
  )
}
