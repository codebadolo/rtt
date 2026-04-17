import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { AlertTriangle, CheckCircle, Clock, XCircle, MessageSquare, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import { plaintesApi } from '../../api/complaints'

const CATEGORIES = {
  COMMANDE: 'Commande',
  LIVRAISON: 'Livraison',
  PAIEMENT: 'Paiement',
  PRODUIT: 'Produit',
  AUTRE: 'Autre',
}

const STATUTS = {
  EN_ATTENTE: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  EN_COURS:   { label: 'En cours',   color: 'bg-blue-100 text-blue-700',   icon: Clock },
  RESOLUE:    { label: 'Résolue',    color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  REJETEE:    { label: 'Rejetée',    color: 'bg-red-100 text-red-700',     icon: XCircle },
}

const STATUT_OPTIONS = [
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'EN_COURS',   label: 'En cours' },
  { value: 'RESOLUE',    label: 'Résolue' },
  { value: 'REJETEE',    label: 'Rejetée' },
]

function StatutBadge({ statut }) {
  const cfg = STATUTS[statut] ?? STATUTS.EN_ATTENTE
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  )
}

function RepondreModal({ plainte, isOpen, onClose }) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      statut: plainte?.statut ?? 'EN_COURS',
      reponse_admin: plainte?.reponse_admin ?? '',
    },
  })

  const mut = useMutation({
    mutationFn: (data) => plaintesApi.update(plainte.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-plaintes'] })
      toast.success('Plainte mise à jour')
      reset()
      onClose()
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })

  if (!plainte) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Traiter la plainte">
      <form onSubmit={handleSubmit((d) => mut.mutate(d))} className="space-y-4">
        <div className="bg-gray-50 rounded-xl p-4 space-y-1">
          <p className="font-semibold text-gray-800 text-sm">{plainte.sujet}</p>
          <p className="text-xs text-gray-500">
            {CATEGORIES[plainte.categorie]} · {plainte.etudiant_nom}
            {plainte.commande_numero && ` · Commande ${plainte.commande_numero}`}
          </p>
          <p className="text-sm text-gray-600 mt-2">{plainte.description}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Statut *</label>
          <select
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400"
            {...register('statut', { required: true })}
          >
            {STATUT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Réponse à l'étudiant</label>
          <textarea
            rows={4}
            placeholder="Rédigez votre réponse visible par l'étudiant…"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400 resize-none"
            {...register('reponse_admin')}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
          <button type="submit" disabled={mut.isPending} className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-60">
            {mut.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function AdminComplaints() {
  const [filterStatut, setFilterStatut] = useState('')
  const [filterCategorie, setFilterCategorie] = useState('')
  const [selected, setSelected] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-plaintes', filterStatut, filterCategorie],
    queryFn: () => plaintesApi.list({
      statut: filterStatut || undefined,
      categorie: filterCategorie || undefined,
    }),
  })

  const plaintes = Array.isArray(data) ? data : data?.results ?? []

  const counts = {
    total:      plaintes.length,
    en_attente: plaintes.filter((p) => p.statut === 'EN_ATTENTE').length,
    en_cours:   plaintes.filter((p) => p.statut === 'EN_COURS').length,
    resolues:   plaintes.filter((p) => p.statut === 'RESOLUE').length,
  }

  const openModal = (plainte) => { setSelected(plainte); setShowModal(true) }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Plaintes' }]} />

        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Plaintes étudiants</h1>
          <p className="text-gray-400 text-sm mt-0.5">Gérez les réclamations soumises par les étudiants</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total',      value: counts.total,      color: 'bg-slate-700' },
            { label: 'En attente', value: counts.en_attente, color: 'bg-yellow-500' },
            { label: 'En cours',   value: counts.en_cours,   color: 'bg-blue-500' },
            { label: 'Résolues',   value: counts.resolues,   color: 'bg-green-500' },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
              <div className={`w-2.5 h-10 rounded-full ${s.color} flex-shrink-0`} />
              <div>
                <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400 bg-white"
          >
            <option value="">Tous les statuts</option>
            {STATUT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={filterCategorie}
            onChange={(e) => setFilterCategorie(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400 bg-white"
          >
            <option value="">Toutes les catégories</option>
            {Object.entries(CATEGORIES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        {/* List */}
        {isLoading ? (
          <LoadingSpinner className="py-20" size="lg" />
        ) : plaintes.length === 0 ? (
          <div className="text-center py-20">
            <AlertTriangle className="h-16 w-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400">Aucune plainte à afficher.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Étudiant</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Sujet</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell">Catégorie</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Statut</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Date</th>
                  <th className="px-5 py-3.5 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {plaintes.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-800">{p.etudiant_nom}</p>
                      {p.commande_numero && (
                        <p className="text-xs text-gray-400">{p.commande_numero}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 max-w-xs">
                      <p className="font-medium text-gray-800 truncate">{p.sujet}</p>
                      <p className="text-xs text-gray-400 truncate">{p.description}</p>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <span className="text-xs text-gray-500">{CATEGORIES[p.categorie] ?? p.categorie}</span>
                    </td>
                    <td className="px-5 py-4">
                      <StatutBadge statut={p.statut} />
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap hidden md:table-cell">
                      {new Date(p.date_creation).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => openModal(p)}
                        className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-400 hover:text-orange-500 transition-colors"
                        title="Traiter"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RepondreModal
        plainte={selected}
        isOpen={showModal}
        onClose={() => { setShowModal(false); setSelected(null) }}
      />
    </DashboardLayout>
  )
}
