import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Store, CheckCircle, XCircle, Clock, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import { profilsApi } from '../../api/orders'

const FILTERS = [
  { value: '',      label: 'Tous' },
  { value: 'false',  label: 'En attente' },
  { value: 'true', label: 'Validés' },
]

function DetailModal({ vendeur, isOpen, onClose }) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset } = useForm()
  const [showReject, setShowReject] = useState(false)

  const validerMut = useMutation({
    mutationFn: () => profilsApi.validerVendeur(vendeur.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-vendeurs'] })
      toast.success('Boutique validée')
      onClose()
    },
    onError: () => toast.error('Erreur lors de la validation'),
  })

  const rejeterMut = useMutation({
    mutationFn: (d) => profilsApi.rejeterVendeur(vendeur.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-vendeurs'] })
      toast.success('Boutique rejetée')
      reset(); setShowReject(false); onClose()
    },
    onError: () => toast.error('Erreur'),
  })

  if (!vendeur) return null

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); setShowReject(false) }} title={vendeur.nom_boutique} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-2xl p-4">
          <div><p className="text-xs text-gray-400">Responsable</p><p className="font-medium text-gray-800">{vendeur.utilisateur_nom}</p></div>
          <div><p className="text-xs text-gray-400">Email</p><p className="font-medium text-gray-800">{vendeur.utilisateur_email}</p></div>
          <div><p className="text-xs text-gray-400">Catégorie</p><p className="font-medium text-gray-800">{vendeur.categorie_principale}</p></div>
          <div><p className="text-xs text-gray-400">Mode de livraison</p><p className="font-medium text-gray-800">{vendeur.mode_livraison}</p></div>
          {vendeur.adresse_commerce && (
            <div className="col-span-2"><p className="text-xs text-gray-400">Adresse du commerce</p><p className="font-medium text-gray-800">{vendeur.adresse_commerce}</p></div>
          )}
        </div>

        {vendeur.description && (
          <div><p className="text-xs text-gray-400 mb-1">Description</p><p className="text-sm text-gray-700">{vendeur.description}</p></div>
        )}

        {(vendeur.photo_cnib || vendeur.photo_visage) && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Pièces justificatives (vendeur extérieur)</p>
            <div className="grid grid-cols-2 gap-3">
              {[{ src: vendeur.photo_cnib, label: 'CNIB' }, { src: vendeur.photo_visage, label: 'Visage' }].filter(d => d.src).map((d) => (
                <img key={d.label} src={d.src} alt={d.label} className="w-full h-32 object-cover rounded-xl border border-gray-200 cursor-pointer" onClick={() => window.open(d.src, '_blank')} />
              ))}
            </div>
          </div>
        )}

        {vendeur.motif_rejet && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">Motif du rejet précédent : {vendeur.motif_rejet}</div>
        )}

        {!vendeur.est_valide && (
          showReject ? (
            <form onSubmit={handleSubmit((d) => rejeterMut.mutate(d))} className="space-y-3">
              <textarea rows={3} className="input resize-none" placeholder="Motif du rejet…" {...register('motif', { required: true })} />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowReject(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={rejeterMut.isPending} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold">Confirmer le rejet</button>
              </div>
            </form>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => validerMut.mutate()} disabled={validerMut.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
                <CheckCircle className="h-4 w-4" /> Valider
              </button>
              <button onClick={() => setShowReject(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
                <XCircle className="h-4 w-4" /> Rejeter
              </button>
            </div>
          )
        )}
      </div>
    </Modal>
  )
}

export default function AdminVendeurs() {
  const [statut, setStatut] = useState('false')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-vendeurs', statut, search],
    queryFn: () => profilsApi.listVendeurs({ est_valide: statut || undefined, search: search || undefined }),
  })
  const vendeurs = Array.isArray(data) ? data : data?.results ?? []

  const columns = [
    { key: 'nom_boutique', label: 'Boutique', render: (v, row) => (
      <div><p className="font-semibold text-gray-800">{v}</p><p className="text-xs text-gray-400">{row.utilisateur_nom}</p></div>
    ) },
    { key: 'categorie_principale', label: 'Catégorie' },
    { key: 'note_moyenne', label: 'Note', render: (v) => v != null ? (
      <span className="flex items-center gap-1 text-amber-600"><Star className="h-3.5 w-3.5 fill-amber-400" />{v.toFixed(1)}</span>
    ) : <span className="text-gray-300">—</span> },
    { key: 'est_valide', label: 'Statut', render: (v) => v ? (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700"><CheckCircle className="h-3.5 w-3.5" />Validé</span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700"><Clock className="h-3.5 w-3.5" />En attente</span>
    ) },
    { key: 'date_creation', label: 'Créée le', render: (v) => new Date(v).toLocaleDateString('fr-FR') },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Vendeurs' }]} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendeurs</h1>
          <p className="text-gray-500 mt-1">Validez les boutiques vendeurs intérieurs et extérieurs (§3.2/§3.3)</p>
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
