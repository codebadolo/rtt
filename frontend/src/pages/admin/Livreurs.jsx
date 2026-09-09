import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Truck, CheckCircle, XCircle, Clock, Power, Star, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import { profilsApi } from '../../api/orders'

const FILTERS = [
  { value: '',      label: 'Tous' },
  { value: 'false', label: 'En attente' },
  { value: 'true',  label: 'Validés' },
]

function DetailModal({ livreur, isOpen, onClose, vendeurs }) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset } = useForm()
  const [showReject, setShowReject] = useState(false)
  const [boutiques, setBoutiques] = useState([])

  const validerMut = useMutation({
    mutationFn: () => profilsApi.validerLivreur(livreur.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-livreurs'] }); toast.success('Livreur validé'); onClose() },
    onError: () => toast.error('Erreur'),
  })
  const rejeterMut = useMutation({
    mutationFn: (d) => profilsApi.rejeterLivreur(livreur.id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-livreurs'] }); toast.success('Livreur rejeté'); reset(); setShowReject(false); onClose() },
    onError: () => toast.error('Erreur'),
  })
  const assignerMut = useMutation({
    mutationFn: (ids) => profilsApi.assignerBoutiques(livreur.id, ids),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-livreurs'] }); toast.success('Boutique(s) attribuée(s)') },
    onError: () => toast.error('Erreur'),
  })

  if (!livreur) return null
  const currentBoutiques = boutiques.length ? boutiques : (livreur.boutiques_attribuees ?? [])

  const toggle = (id) => {
    const next = currentBoutiques.includes(id) ? currentBoutiques.filter((b) => b !== id) : [...currentBoutiques, id]
    setBoutiques(next)
  }

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); setShowReject(false); setBoutiques([]) }} title={livreur.utilisateur_nom} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-2xl p-4">
          <div><p className="text-xs text-gray-400">Email</p><p className="font-medium text-gray-800">{livreur.utilisateur_email}</p></div>
          <div><p className="text-xs text-gray-400">Note moyenne (interne)</p><p className="font-medium text-gray-800">{livreur.note_moyenne != null ? livreur.note_moyenne.toFixed(1) : '—'}</p></div>
          <div><p className="text-xs text-gray-400">Missions abandonnées</p><p className="font-medium text-gray-800">{livreur.compteur_abandon}</p></div>
          <div><p className="text-xs text-gray-400">Disponibilité</p><p className="font-medium text-gray-800">{livreur.en_service ? 'En service' : 'Hors service'}</p></div>
        </div>

        {(livreur.photo_cnib || livreur.photo_visage) && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Pièces justificatives</p>
            <div className="grid grid-cols-2 gap-3">
              {[{ src: livreur.photo_cnib, label: 'CNIB' }, { src: livreur.photo_visage, label: 'Visage' }].filter(d => d.src).map((d) => (
                <img key={d.label} src={d.src} alt={d.label} className="w-full h-32 object-cover rounded-xl border border-gray-200 cursor-pointer" onClick={() => window.open(d.src, '_blank')} />
              ))}
            </div>
          </div>
        )}

        {livreur.motif_rejet && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">Motif du rejet précédent : {livreur.motif_rejet}</div>
        )}

        {!livreur.est_valide && (
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

        <div className="pt-3 border-t border-gray-100">
          <p className="text-sm font-semibold text-gray-700 mb-2">Boutique(s) attribuée(s) (§7)</p>
          <p className="text-xs text-gray-400 mb-3">Vide = livreur "volant", réaffectable en cas d'absence d'un titulaire.</p>
          <div className="flex flex-wrap gap-2 mb-3 max-h-40 overflow-y-auto">
            {vendeurs.map((v) => (
              <button key={v.id} type="button" onClick={() => toggle(v.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                  currentBoutiques.includes(v.id) ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'
                }`}>{v.nom_boutique}</button>
            ))}
          </div>
          <button onClick={() => assignerMut.mutate(currentBoutiques)} disabled={assignerMut.isPending}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold">
            {assignerMut.isPending ? 'Enregistrement…' : 'Enregistrer l\'affectation'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function AdminLivreurs() {
  const [statut, setStatut] = useState('false')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-livreurs', statut, search],
    queryFn: () => profilsApi.listLivreurs({ est_valide: statut || undefined, search: search || undefined }),
  })
  const livreurs = Array.isArray(data) ? data : data?.results ?? []

  const { data: vendeursData } = useQuery({
    queryKey: ['admin-vendeurs-tous'],
    queryFn: () => profilsApi.listVendeurs({ est_valide: true, page_size: 200 }),
  })
  const vendeurs = Array.isArray(vendeursData) ? vendeursData : vendeursData?.results ?? []

  const { data: enServiceData } = useQuery({
    queryKey: ['livreurs-en-service'],
    queryFn: () => profilsApi.livreursEnService(),
    refetchInterval: 30000,
  })

  const columns = [
    { key: 'utilisateur_nom', label: 'Livreur', render: (v, row) => (
      <div><p className="font-semibold text-gray-800">{v}</p><p className="text-xs text-gray-400">{row.utilisateur_email}</p></div>
    ) },
    { key: 'en_service', label: 'Disponibilité', render: (v) => (
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${v ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
        <Power className="h-3.5 w-3.5" />{v ? 'En service' : 'Hors service'}
      </span>
    ) },
    { key: 'boutiques_noms', label: 'Boutiques', render: (v) => v?.length ? v.join(', ') : <span className="text-gray-300">Volant</span> },
    { key: 'note_moyenne', label: 'Note', render: (v) => v != null ? (
      <span className="flex items-center gap-1 text-amber-600"><Star className="h-3.5 w-3.5 fill-amber-400" />{v.toFixed(1)}</span>
    ) : <span className="text-gray-300">—</span> },
    { key: 'compteur_abandon', label: 'Abandons', render: (v) => v > 0 ? (
      <span className="inline-flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="h-3.5 w-3.5" />{v}</span>
    ) : v },
    { key: 'est_valide', label: 'Statut', render: (v) => v ? (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700"><CheckCircle className="h-3.5 w-3.5" />Validé</span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700"><Clock className="h-3.5 w-3.5" />En attente</span>
    ) },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Livreurs' }]} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Livreurs</h1>
          <p className="text-gray-500 mt-1">Validez les livreurs et affectez leurs boutiques (§3.4/§7/§12)</p>
        </div>

        {enServiceData && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 flex items-center gap-3">
            <Power className="h-4 w-4 text-green-600" />
            <p className="text-sm text-green-700 font-medium">{enServiceData.count} livreur(s) actuellement en service</p>
          </div>
        )}

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
          data={livreurs}
          isLoading={isLoading}
          emptyIcon={<Truck className="h-12 w-12" />}
          emptyText="Aucun livreur"
          search={search}
          onSearchChange={setSearch}
          onRowClick={setSelected}
        />
      </div>
      <DetailModal livreur={selected} isOpen={!!selected} onClose={() => setSelected(null)} vendeurs={vendeurs} />
    </DashboardLayout>
  )
}
