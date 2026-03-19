import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  FileCheck, Clock, CheckCircle, XCircle, Eye,
  Users, TrendingUp, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import { kycApi } from '../../api/kyc'

/* ── Stat card ── */
function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
      <div className={`p-3 rounded-2xl ${color} flex-shrink-0`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-extrabold text-gray-900">{value ?? <span className="text-gray-300">—</span>}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

/* ── KYC status badge ── */
const KYC_STATUS = {
  EN_ATTENTE: { cls: 'bg-amber-100 text-amber-700',  txt: 'En attente',  icon: Clock },
  VALIDE:     { cls: 'bg-green-100 text-green-700',  txt: 'Validé',      icon: CheckCircle },
  REJETE:     { cls: 'bg-red-100 text-red-700',      txt: 'Rejeté',      icon: XCircle },
  NON_SOUMIS: { cls: 'bg-gray-100 text-gray-500',    txt: 'Non soumis',  icon: AlertCircle },
}

function KYCBadge({ statut }) {
  const cfg = KYC_STATUS[statut] ?? KYC_STATUS.NON_SOUMIS
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>
      <Icon className="h-3 w-3" />
      {cfg.txt}
    </span>
  )
}

/* ── Detail + Action modal ── */
function KYCDetailModal({ kyc, isOpen, onClose }) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset } = useForm()
  const [showRejectForm, setShowRejectForm] = useState(false)

  const validateMut = useMutation({
    mutationFn: () => kycApi.validate(kyc.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kyc-list'] })
      qc.invalidateQueries({ queryKey: ['kyc-stats'] })
      toast.success('KYC validé')
      onClose()
    },
    onError: (e) => toast.error(e.response?.data?.error ?? 'Erreur lors de la validation'),
  })

  const rejectMut = useMutation({
    mutationFn: (d) => kycApi.reject(kyc.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kyc-list'] })
      qc.invalidateQueries({ queryKey: ['kyc-stats'] })
      toast.success('KYC rejeté')
      reset()
      setShowRejectForm(false)
      onClose()
    },
    onError: () => toast.error('Erreur'),
  })

  if (!kyc) return null

  const userStatut = kyc.statut_actuel?.code ?? 'NON_SOUMIS'
  const nomComplet = kyc.utilisateur_nom ?? ''
  const email = kyc.utilisateur_email ?? ''
  const initiales = nomComplet.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); setShowRejectForm(false); reset() }} title="Dossier KYC" size="lg">
      <div className="space-y-5">
        {/* Student info */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold">{initiales}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{nomComplet}</p>
            <p className="text-sm text-gray-400">{email}</p>
          </div>
          <KYCBadge statut={userStatut} />
        </div>

        {/* Card info */}
        <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-2xl p-4">
          <div>
            <p className="text-xs text-gray-400">N° carte</p>
            <p className="font-mono font-semibold text-gray-800 mt-0.5">{kyc.numero_carte || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Expiration carte</p>
            <p className="text-sm font-medium text-gray-800 mt-0.5">
              {kyc.date_expiration ? new Date(kyc.date_expiration).toLocaleDateString('fr-FR') : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Soumis le</p>
            <p className="text-sm font-medium text-gray-800 mt-0.5">
              {kyc.date_creation ? new Date(kyc.date_creation).toLocaleDateString('fr-FR') : '—'}
            </p>
          </div>
          {kyc.verifie_par_nom && (
            <div>
              <p className="text-xs text-gray-400">Vérifié par</p>
              <p className="text-sm font-medium text-gray-800 mt-0.5">{kyc.verifie_par_nom}</p>
            </div>
          )}
        </div>

        {/* Documents */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">Documents fournis</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { src: kyc.image_carte_recto, label: 'Recto' },
              { src: kyc.image_carte_verso, label: 'Verso' },
              { src: kyc.selfie_etudiant, label: 'Selfie' },
            ].filter((d) => d.src).map((doc) => (
              <div key={doc.label}>
                <p className="text-xs text-gray-400 mb-1.5 text-center">{doc.label}</p>
                <img
                  src={doc.src}
                  alt={doc.label}
                  className="w-full h-28 object-cover rounded-xl cursor-pointer hover:opacity-90 border border-gray-200 transition-opacity"
                  onClick={() => window.open(doc.src, '_blank')}
                />
              </div>
            ))}
            {![kyc.image_carte_recto, kyc.image_carte_verso, kyc.selfie_etudiant].some(Boolean) && (
              <p className="text-sm text-gray-400 col-span-3 text-center py-4">Aucun document uploadé</p>
            )}
          </div>
        </div>

        {/* Motif rejet */}
        {kyc.motif_rejet && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-red-600 mb-1">Motif du rejet</p>
            <p className="text-sm text-red-700">{kyc.motif_rejet}</p>
          </div>
        )}

        {/* Actions — only for EN_ATTENTE */}
        {userStatut === 'EN_ATTENTE' && (
          <div className="space-y-3 pt-2 border-t border-gray-100">
            {!showRejectForm ? (
              <div className="flex gap-3">
                <button
                  onClick={() => validateMut.mutate()}
                  disabled={validateMut.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  <CheckCircle className="h-4 w-4" />
                  {validateMut.isPending ? 'Validation…' : 'Valider'}
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  Rejeter
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit((d) => rejectMut.mutate(d))} className="space-y-3">
                <div>
                  <label className="label">Motif du rejet *</label>
                  <textarea
                    rows={3}
                    className="input resize-none"
                    placeholder="Expliquer pourquoi le dossier est rejeté…"
                    {...register('motif_rejet', { required: true })}
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowRejectForm(false)} className="btn-secondary flex-1">Annuler</button>
                  <button type="submit" disabled={rejectMut.isPending} className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
                    {rejectMut.isPending ? 'Rejet…' : 'Confirmer le rejet'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── Status filter pills ── */
const FILTERS = [
  { value: '',           label: 'Tous' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'VALIDE',     label: 'Validés' },
  { value: 'REJETE',     label: 'Rejetés' },
]

/* ── Main ── */
export default function AdminKYCManagement() {
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [statut, setStatut] = useState('EN_ATTENTE')
  const [selected, setSelected] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['kyc-list', page, search, statut],
    queryFn: () => kycApi.list({
      page,
      search: search || undefined,
      statut: statut || undefined,
    }),
  })

  const { data: stats } = useQuery({
    queryKey: ['kyc-stats'],
    queryFn: () => kycApi.stats(),
    staleTime: 30_000,
  })

  const items = Array.isArray(data) ? data : data?.results ?? []
  const total = data?.count ?? items.length
  const totalPages = Math.ceil(total / 20)

  const columns = [
    {
      key: 'utilisateur',
      label: 'Étudiant',
      sortable: false,
      render: (_, row) => {
        const nomComplet = row.utilisateur_nom ?? ''
        const email      = row.utilisateur_email ?? ''
        const initiales  = nomComplet.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">{initiales}</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 truncate">{nomComplet}</p>
              <p className="text-xs text-gray-400 truncate">{email}</p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'numero_carte',
      label: 'N° Carte',
      render: (v) => (
        <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg">
          {v || '—'}
        </span>
      ),
    },
    {
      key: 'date_creation',
      label: 'Soumis le',
      sortable: true,
      render: (v) => v ? new Date(v).toLocaleDateString('fr-FR') : '—',
    },
    {
      key: 'date_expiration',
      label: 'Expiration',
      render: (v) => {
        if (!v) return <span className="text-gray-300">—</span>
        const isExpired = new Date(v) < new Date()
        return (
          <span className={`text-sm ${isExpired ? 'text-red-500 font-semibold' : 'text-gray-600'}`}>
            {new Date(v).toLocaleDateString('fr-FR')}
            {isExpired && <span className="ml-1 text-xs">(Expirée)</span>}
          </span>
        )
      },
    },
    {
      key: 'statut_actuel',
      label: 'Statut KYC',
      render: (_, row) => <KYCBadge statut={row.statut_actuel?.code ?? 'NON_SOUMIS'} />,
    },
    {
      key: 'id',
      label: 'Actions',
      headerClass: 'text-right',
      className: 'text-right',
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelected(row) }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-orange-50 text-gray-600 hover:text-orange-600 transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          Voir
        </button>
      ),
    },
  ]

  const taux = stats?.taux_completion ?? 0

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Gestion KYC' }]} />

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vérifications KYC</h1>
          <p className="text-gray-500 mt-1">Valider ou rejeter les dossiers d'identité des étudiants</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Total étudiants"
            value={stats?.total_etudiants ?? '—'}
            color="bg-slate-700"
          />
          <StatCard
            icon={Clock}
            label="En attente"
            value={stats?.en_attente ?? '—'}
            color="bg-amber-500"
            sub="À traiter"
          />
          <StatCard
            icon={CheckCircle}
            label="Validés"
            value={stats?.valides ?? '—'}
            color="bg-green-500"
            sub={`${taux}% du total`}
          />
          <StatCard
            icon={XCircle}
            label="Rejetés"
            value={stats?.rejetes ?? '—'}
            color="bg-red-500"
          />
        </div>

        {/* Taux de completion progress */}
        {stats && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">Taux de vérification</span>
              </div>
              <span className="text-sm font-bold text-orange-500">{taux}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className="bg-gradient-to-r from-orange-400 to-amber-400 h-2.5 rounded-full transition-all duration-700"
                style={{ width: `${taux}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>{stats.valides} validés</span>
              <span>{stats.non_soumis} non soumis</span>
            </div>
          </div>
        )}

        {/* Filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
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
              {f.value === 'EN_ATTENTE' && stats?.en_attente > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {stats.en_attente}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* DataTable */}
        <DataTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          emptyIcon={<FileCheck className="h-12 w-12" />}
          emptyText="Aucun dossier KYC trouvé"
          searchable
          searchPlaceholder="Rechercher par nom, email…"
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          total={total}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onRowClick={(row) => setSelected(row)}
        />
      </div>

      <KYCDetailModal
        kyc={selected}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
      />
    </DashboardLayout>
  )
}
