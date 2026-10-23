import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Store, CheckCircle, XCircle, Pencil, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import { profilsApi } from '../../api/orders'

const FILTERS = [
  { value: 'EN_ATTENTE', label: 'En attente de validation' },
  { value: 'CORRECTION', label: 'Correction demandée' },
  { value: 'BROUILLON',  label: 'Inscription en cours' },
  { value: 'VALIDE',     label: 'Validés' },
  { value: 'REFUSE',     label: 'Refusés' },
  { value: '',           label: 'Tous' },
]

const STATUT_STYLE = {
  BROUILLON:  'bg-gray-100 text-gray-600',
  EN_ATTENTE: 'bg-amber-100 text-amber-700',
  CORRECTION: 'bg-orange-100 text-orange-700',
  VALIDE:     'bg-green-100 text-green-700',
  REFUSE:     'bg-red-100 text-red-700',
}

function DetailModal({ vendeur, isOpen, onClose }) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset } = useForm()
  const [decision, setDecision] = useState(null) // null | 'CORRECTION' | 'REFUS'

  const { data: catalogue = [] } = useQuery({
    queryKey: ['admin-vendeur-produits', vendeur?.id],
    queryFn: () => profilsApi.produitsVendeurAdmin(vendeur.id),
    enabled: !!vendeur,
  })

  const validerMut = useMutation({
    mutationFn: () => profilsApi.validerVendeur(vendeur.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-vendeurs'] })
      toast.success('Boutique validée')
      onClose()
    },
    onError: () => toast.error('Erreur lors de la validation'),
  })

  const decisionMut = useMutation({
    mutationFn: (d) => (decision === 'CORRECTION'
      ? profilsApi.demanderCorrectionVendeur(vendeur.id, d)
      : profilsApi.rejeterVendeur(vendeur.id, d)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-vendeurs'] })
      toast.success(decision === 'CORRECTION' ? 'Correction demandée au vendeur' : 'Activation refusée')
      reset(); setDecision(null); onClose()
    },
    onError: () => toast.error('Erreur'),
  })

  if (!vendeur) return null

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); setDecision(null) }} title={vendeur.nom_boutique} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-2xl p-4">
          <div><p className="text-xs text-gray-400">Responsable</p><p className="font-medium text-gray-800">{vendeur.utilisateur_nom}</p></div>
          <div><p className="text-xs text-gray-400">Téléphone</p><p className="font-medium text-gray-800">{vendeur.utilisateur_telephone} {vendeur.telephone_verifie ? '✓' : '(non vérifié)'}</p></div>
          <div><p className="text-xs text-gray-400">Catégorie</p><p className="font-medium text-gray-800">{vendeur.categorie_display}</p></div>
          <div><p className="text-xs text-gray-400">Emplacement</p><p className="font-medium text-gray-800">{vendeur.emplacement_nom ?? vendeur.adresse_commerce ?? '—'}</p></div>
          <div><p className="text-xs text-gray-400">Statut</p><p className="font-medium text-gray-800">{vendeur.statut_validation_display}</p></div>
          <div><p className="text-xs text-gray-400">Mode de livraison</p><p className="font-medium text-gray-800">{vendeur.mode_livraison}</p></div>
          {vendeur.adresse_commerce && (
            <div className="col-span-2"><p className="text-xs text-gray-400">Adresse du commerce</p><p className="font-medium text-gray-800">{vendeur.adresse_commerce}</p></div>
          )}
        </div>

        {vendeur.description && (
          <div><p className="text-xs text-gray-400 mb-1">Description</p><p className="text-sm text-gray-700">{vendeur.description}</p></div>
        )}

        {vendeur.photo_boutique && (
          <img src={vendeur.photo_boutique} alt="Boutique" className="w-full h-40 object-cover rounded-xl border border-gray-200" />
        )}

        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Catalogue ({catalogue.length})</p>
          {catalogue.length === 0 ? (
            <p className="text-sm text-gray-400">Aucun produit renseigné.</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
              {catalogue.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  {(p.image_url ?? p.image) && <img src={p.image_url ?? p.image} alt="" className="w-8 h-8 rounded object-cover" />}
                  <span className="flex-1 text-gray-800">{p.nom}</span>
                  <span className="text-gray-500">{parseFloat(p.prix_base).toLocaleString('fr-FR')} F</span>
                  {!p.est_actif && <span className="text-xs text-gray-400">indisponible</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {vendeur.motif_rejet && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">Dernier message au vendeur : {vendeur.motif_rejet}</div>
        )}

        {vendeur.statut_validation !== 'VALIDE' && (
          decision ? (
            <form onSubmit={handleSubmit((d) => decisionMut.mutate(d))} className="space-y-3">
              <textarea rows={3} className="input resize-none"
                placeholder={decision === 'CORRECTION' ? 'Corrections attendues (ex : ajouter une photo, préciser les prix)…' : 'Motif du refus…'}
                {...register('motif', { required: true })} />
              <div className="flex gap-3">
                <button type="button" onClick={() => setDecision(null)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={decisionMut.isPending}
                  className={`flex-1 text-white rounded-xl text-sm font-semibold ${decision === 'CORRECTION' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-500 hover:bg-red-600'}`}>
                  {decision === 'CORRECTION' ? 'Envoyer la demande' : 'Confirmer le refus'}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={() => validerMut.mutate()} disabled={validerMut.isPending}
                className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
                <CheckCircle className="h-4 w-4" /> Valider
              </button>
              <button onClick={() => setDecision('CORRECTION')}
                className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
                <Pencil className="h-4 w-4" /> Demander une correction
              </button>
              <button onClick={() => setDecision('REFUS')}
                className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
                <XCircle className="h-4 w-4" /> Refuser
              </button>
            </div>
          )
        )}
      </div>
    </Modal>
  )
}

export default function AdminVendeurs() {
  const [statut, setStatut] = useState('EN_ATTENTE')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-vendeurs', statut, search],
    queryFn: () => profilsApi.listVendeurs({ statut_validation: statut || undefined, search: search || undefined }),
  })
  const vendeurs = Array.isArray(data) ? data : data?.results ?? []

  const columns = [
    { key: 'nom_boutique', label: 'Boutique', render: (v, row) => (
      <div><p className="font-semibold text-gray-800">{v}</p><p className="text-xs text-gray-400">{row.utilisateur_nom}</p></div>
    ) },
    { key: 'categorie_display', label: 'Catégorie' },
    { key: 'note_moyenne', label: 'Note', render: (v) => v != null ? (
      <span className="flex items-center gap-1 text-amber-600"><Star className="h-3.5 w-3.5 fill-amber-400" />{v.toFixed(1)}</span>
    ) : <span className="text-gray-300">—</span> },
    { key: 'statut_validation', label: 'Statut', render: (v, row) => (
      <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full ${STATUT_STYLE[v] ?? ''}`}>{row.statut_validation_display}</span>
    ) },
    { key: 'date_creation', label: 'Créée le', render: (v) => new Date(v).toLocaleDateString('fr-FR') },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Vendeurs' }]} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendeurs</h1>
          <p className="text-gray-500 mt-1">Accompagnez les vendeurs : validez, demandez une correction ou refusez l'activation des boutiques.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => setStatut(f.value)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                statut === f.value ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
              }`}>{f.label}</button>
          ))}
        </div>

        <DataTable
          columns={columns}
          data={vendeurs}
          isLoading={isLoading}
          emptyIcon={<Store className="h-12 w-12" />}
          emptyText="Aucun vendeur"
          search={search}
          onSearchChange={setSearch}
          onRowClick={setSelected}
        />
      </div>
      <DetailModal vendeur={selected} isOpen={!!selected} onClose={() => setSelected(null)} />
    </DashboardLayout>
  )
}
