import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CreditCard, Banknote, Clock, CheckCircle2, XCircle,
  ChevronRight, FlaskConical, ExternalLink, Smartphone,
} from 'lucide-react'
import DashboardLayout from '../../layouts/DashboardLayout'
import Breadcrumb from '../../components/Breadcrumb'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import { paymentsApi } from '../../api/payments'

/* ─── Config ─── */
const METHODE_CFG = {
  ORANGE: { label: 'Orange Money', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', emoji: '🟠' },
  MOOV:   { label: 'Moov Money',   color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500',   emoji: '🟢' },
  SANK:   { label: 'Sank Money',   color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500', emoji: '🔵' },
}

const SF_CFG = {
  send_otp:    { cls: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400',  label: 'Attente OTP'  },
  pay_offline: { cls: 'bg-sky-100 text-sky-700',      dot: 'bg-sky-400',    label: 'Hors ligne'   },
  success:     { cls: 'bg-green-100 text-green-700',  dot: 'bg-green-400',  label: 'Succès'       },
  failed:      { cls: 'bg-red-100 text-red-700',      dot: 'bg-red-400',    label: 'Échoué'       },
  pending:     { cls: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-300',   label: 'En attente'   },
}

const COMMANDE_SF_CFG = {
  BROUILLON:  { cls: 'bg-gray-100 text-gray-500',     label: 'Brouillon'  },
  EN_ATTENTE: { cls: 'bg-amber-100 text-amber-700',   label: 'En attente' },
  VALIDEE:    { cls: 'bg-blue-100 text-blue-700',     label: 'Validée'    },
  REJETEE:    { cls: 'bg-red-100 text-red-700',       label: 'Rejetée'    },
  PRETE:      { cls: 'bg-indigo-100 text-indigo-700', label: 'Prête'      },
  DISTRIBUEE: { cls: 'bg-green-100 text-green-700',   label: 'Distribuée' },
  ANNULEE:    { cls: 'bg-rose-100 text-rose-600',     label: 'Annulée'    },
}

/* ─── Stat card ─── */
function StatCard({ icon: Icon, label, value, sub, color, emoji }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
      <div className={`p-3 rounded-2xl ${color} flex-shrink-0`}>
        {emoji ? <span className="text-xl">{emoji}</span> : <Icon className="h-6 w-6 text-white" />}
      </div>
      <div className="min-w-0">
        <p className="text-xl font-extrabold text-gray-900 truncate">{value ?? '—'}</p>
        <p className="text-sm text-gray-500 mt-0.5 truncate">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

/* ─── Steps mini-visualisation ─── */
function PaymentSteps({ charge }) {
  const sf = charge.statut
  // Étape 1 : Initiée (toujours true si la charge existe)
  const step1 = true
  // Étape 2 : OTP soumis / confirmation
  const step2Active  = ['send_otp', 'pay_offline'].includes(sf)
  const step2Done    = ['success', 'failed'].includes(sf)
  const step2Error   = sf === 'failed'
  // Étape 3 : Résultat
  const step3Done    = sf === 'success'
  const step3Error   = sf === 'failed'

  const StepDot = ({ done, active, error, label }) => (
    <div className="flex flex-col items-center gap-0.5">
      <div className={[
        'w-5 h-5 rounded-full flex items-center justify-center',
        done  && !error ? 'bg-green-500' :
        error           ? 'bg-red-400' :
        active          ? 'bg-orange-400' :
        'bg-gray-200',
      ].join(' ')}>
        {done && !error ? <CheckCircle2 className="h-3 w-3 text-white" /> :
         error          ? <XCircle      className="h-3 w-3 text-white" /> :
         active         ? <Clock        className="h-2.5 w-2.5 text-white" /> :
                          null}
      </div>
      <span className={`text-[10px] font-medium ${
        done && !error ? 'text-green-600' : error ? 'text-red-500' :
        active ? 'text-orange-500' : 'text-gray-300'
      }`}>{label}</span>
    </div>
  )

  return (
    <div className="flex items-center gap-1">
      <StepDot done={step1} label="Initiée" />
      <div className={`h-px w-4 flex-shrink-0 ${step2Done || step2Active ? 'bg-orange-300' : 'bg-gray-200'}`} />
      <StepDot done={step2Done} active={step2Active} error={step2Error} label="OTP" />
      <div className={`h-px w-4 flex-shrink-0 ${step3Done || step3Error ? 'bg-orange-300' : 'bg-gray-200'}`} />
      <StepDot done={step3Done} error={step3Error} label="Résultat" />
    </div>
  )
}

/* ─── Détail modal ─── */
function ChargeDetailModal({ charge, isOpen, onClose }) {
  if (!charge) return null
  const methode = METHODE_CFG[charge.methode_paiement] ?? { label: charge.methode_paiement, color: 'bg-gray-100 text-gray-600', emoji: '💰' }
  const sfCfg   = SF_CFG[charge.statut]   ?? SF_CFG.pending
  const cmdCfg  = COMMANDE_SF_CFG[charge.commande_statut] ?? { cls: 'bg-gray-100 text-gray-500', label: charge.commande_statut }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Détail du paiement" size="md">
      <div className="space-y-5">

        {/* En-tête */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-xl inline-block">
              {charge.charge_reference}
            </p>
            <p className="mt-2 text-2xl font-extrabold text-gray-900">
              {Number(charge.montant).toLocaleString('fr-FR')} FCFA
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${sfCfg.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sfCfg.dot}`} />
            {sfCfg.label}
          </span>
        </div>

        {/* Étapes */}
        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Étapes du paiement</p>
          <div className="flex items-center gap-3">
            <StepDetail
              done
              label="Charge initiée"
              sub={new Date(charge.date_creation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            />
            <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
            <StepDetail
              done={['success', 'failed'].includes(charge.statut)}
              active={['send_otp', 'pay_offline'].includes(charge.statut)}
              error={charge.statut === 'failed'}
              label={charge.statut === 'send_otp' ? 'Attente OTP' : charge.statut === 'pay_offline' ? 'Hors ligne' : 'Confirmation'}
              sub={charge.statut === 'send_otp' ? 'OTP non soumis' :
                   charge.statut === 'pay_offline' ? 'Validation téléphone' : ''}
            />
            <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
            <StepDetail
              done={charge.statut === 'success'}
              error={charge.statut === 'failed'}
              label="Résultat"
              sub={charge.statut === 'success' ? 'Paiement validé' : charge.statut === 'failed' ? 'Échec' : '—'}
            />
          </div>
          {charge.display_text && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-600">{charge.display_text}</p>
            </div>
          )}
        </div>

        {/* Infos grille */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Opérateur</p>
            <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-xl ${methode.color}`}>
              {methode.emoji} {methode.label}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Téléphone</p>
            <p className="font-mono font-semibold text-gray-800">{charge.telephone}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Commande</p>
            <p className="font-mono text-sm font-semibold text-gray-800">{charge.numero_commande}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Statut commande</p>
            <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${cmdCfg.cls}`}>
              {cmdCfg.label}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Date</p>
            <p className="text-sm text-gray-800">
              {new Date(charge.date_creation).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        {/* Étudiant */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Étudiant</p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">
                {charge.etudiant_nom?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </span>
            </div>
            <p className="font-semibold text-gray-800">{charge.etudiant_nom}</p>
          </div>
        </div>

        {/* Lien vers détail commande */}
        <Link
          to={`/admin/commandes/${charge.commande_id}`}
          onClick={onClose}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-orange-200 text-orange-600 text-sm font-medium hover:bg-orange-50 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Voir le détail de la commande
        </Link>
      </div>
    </Modal>
  )
}

function StepDetail({ done, active, error, label, sub }) {
  return (
    <div className="flex-1 flex flex-col items-center text-center gap-1">
      <div className={[
        'w-7 h-7 rounded-full flex items-center justify-center',
        done && !error ? 'bg-green-500' : error ? 'bg-red-400' :
        active ? 'bg-orange-400' : 'bg-gray-200',
      ].join(' ')}>
        {done && !error ? <CheckCircle2 className="h-4 w-4 text-white" /> :
         error          ? <XCircle      className="h-4 w-4 text-white" /> :
         active         ? <Clock        className="h-3.5 w-3.5 text-white" /> : null}
      </div>
      <p className={`text-xs font-semibold ${
        done && !error ? 'text-green-600' : error ? 'text-red-500' :
        active ? 'text-orange-500' : 'text-gray-400'
      }`}>{label}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  )
}

/* ─── Main ─── */
export default function AdminPayments() {
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [selectedCharge, setSelectedCharge] = useState(null)

  const { data: statsData } = useQuery({
    queryKey: ['payments-stats'],
    queryFn: () => paymentsApi.stats(),
    staleTime: 30_000,
  })

  const { data: chargesData, isLoading } = useQuery({
    queryKey: ['senfenico-charges', page, search, statutFilter],
    queryFn: () => paymentsApi.charges({
      page,
      search: search || undefined,
      statut: statutFilter || undefined,
    }),
  })

  const charges    = chargesData?.results ?? (Array.isArray(chargesData) ? chargesData : [])
  const total      = chargesData?.count ?? charges.length
  const totalPages = Math.ceil(total / 10)

  const par_methode = statsData?.par_methode ?? {}

  const columns = [
    {
      key: 'charge_reference',
      label: 'Référence charge',
      render: (v) => (
        <span className="font-mono text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg whitespace-nowrap">
          {v}
        </span>
      ),
    },
    {
      key: 'etudiant_nom',
      label: 'Étudiant',
      render: (v) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs">
              {v?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-800 truncate">{v}</span>
        </div>
      ),
    },
    {
      key: 'numero_commande',
      label: 'Commande',
      render: (v, row) => (
        <Link
          to={`/admin/commandes/${row.commande_id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-xs font-semibold text-orange-600 hover:underline whitespace-nowrap"
        >
          {v}
        </Link>
      ),
    },
    {
      key: 'methode_paiement',
      label: 'Opérateur',
      render: (v, row) => {
        const cfg = METHODE_CFG[v] ?? { label: v, color: 'bg-gray-100 text-gray-600', emoji: '💰' }
        return (
          <div>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
              {cfg.emoji} {cfg.label}
            </span>
            <p className="font-mono text-xs text-gray-400 mt-0.5">{row.telephone}</p>
          </div>
        )
      },
    },
    {
      key: 'montant',
      label: 'Montant',
      render: (v) => (
        <span className="font-bold text-gray-900 whitespace-nowrap">
          {Number(v).toLocaleString('fr-FR')} F
        </span>
      ),
    },
    {
      key: 'statut',
      label: 'Étapes',
      render: (_, row) => <PaymentSteps charge={row} />,
    },
    {
      key: 'statut',
      label: 'Statut charge',
      render: (v) => {
        const cfg = SF_CFG[v] ?? SF_CFG.pending
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        )
      },
    },
    {
      key: 'date_creation',
      label: 'Date',
      className: 'text-xs text-gray-400 whitespace-nowrap',
      render: (v) => v ? new Date(v).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      }) : '—',
    },
  ]

  const tableFilters = (
    <div className="flex items-center gap-2 flex-wrap">
      {[
        { value: '',           label: 'Tous' },
        { value: 'send_otp',   label: 'Attente OTP' },
        { value: 'pay_offline',label: 'Hors ligne'  },
        { value: 'success',    label: 'Succès'      },
        { value: 'failed',     label: 'Échoués'     },
      ].map((opt) => (
        <button
          key={opt.value}
          onClick={() => { setStatutFilter(opt.value); setPage(1) }}
          className={[
            'px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors',
            statutFilter === opt.value
              ? 'bg-orange-500 text-white border-orange-500'
              : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Paiements' }]} />

        {/* En-tête */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Paiements</h1>
            <p className="text-gray-500 mt-1">Gestion des transactions Senfenico et leurs étapes</p>
          </div>
          <Link
            to="/admin/paiements/senfenico"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-50 text-violet-700 border border-violet-200 text-sm font-medium hover:bg-violet-100 transition-colors"
          >
            <FlaskConical className="h-4 w-4" />
            Tests Sandbox
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard icon={CreditCard} label="Total paiements"
            value={statsData?.total_paiements ?? '—'} color="bg-slate-700" />
          <StatCard icon={Banknote} label="Montant collecté"
            value={statsData?.montant_total_valide != null
              ? `${Number(statsData.montant_total_valide).toLocaleString('fr-FR')} F` : '—'}
            color="bg-green-600" />
          <StatCard icon={Clock} label="En attente"
            value={statsData?.en_attente ?? '—'} color="bg-amber-500" />
          <StatCard emoji="🟠" label="Orange Money"
            value={par_methode.ORANGE?.count ?? '—'}
            sub={par_methode.ORANGE?.total ? `${Number(par_methode.ORANGE.total).toLocaleString('fr-FR')} F` : ''}
            color="bg-orange-100" />
          <StatCard emoji="🟢" label="Moov Money"
            value={par_methode.MOOV?.count ?? '—'}
            sub={par_methode.MOOV?.total ? `${Number(par_methode.MOOV.total).toLocaleString('fr-FR')} F` : ''}
            color="bg-blue-100" />
          <StatCard emoji="🔵" label="Sank Money"
            value={par_methode.SANK?.count ?? '—'}
            sub={par_methode.SANK?.total ? `${Number(par_methode.SANK.total).toLocaleString('fr-FR')} F` : ''}
            color="bg-indigo-100" />
        </div>

        {/* Table charges */}
        <DataTable
          columns={columns}
          data={charges}
          isLoading={isLoading}
          emptyIcon={<Smartphone className="h-12 w-12" />}
          emptyText="Aucune charge Senfenico"
          searchable
          searchPlaceholder="Référence, étudiant, N° commande…"
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          filters={tableFilters}
          total={total}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onRowClick={(row) => setSelectedCharge(row)}
        />
      </div>

      <ChargeDetailModal
        charge={selectedCharge}
        isOpen={!!selectedCharge}
        onClose={() => setSelectedCharge(null)}
      />
    </DashboardLayout>
  )
}
