import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  CheckCircle, XCircle, Package, ClipboardList,
  Search, X, Clock, MapPin, Phone,
  CreditCard, Eye,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import { ordersApi } from '../../api/orders'

const STATUTS = [
  { value: '',          label: 'Toutes',      color: 'bg-gray-100 text-gray-600' },
  { value: 'EN_ATTENTE', label: 'En attente', color: 'bg-amber-100 text-amber-700' },
  { value: 'VALIDEE',    label: 'Validées',   color: 'bg-blue-100 text-blue-700' },
  { value: 'REJETEE',    label: 'Rejetées',   color: 'bg-red-100 text-red-600' },
  { value: 'PRETE',      label: 'Prêtes',     color: 'bg-purple-100 text-purple-700' },
  { value: 'DISTRIBUEE', label: 'Distribuées', color: 'bg-green-100 text-green-700' },
]

const ROW_BG = {
  EN_ATTENTE: 'bg-amber-50/60 hover:bg-amber-50',
  VALIDEE:    'bg-blue-50/40 hover:bg-blue-50',
  REJETEE:    'bg-red-50/30 hover:bg-red-50',
  PRETE:      'bg-purple-50/40 hover:bg-purple-50',
  DISTRIBUEE: 'bg-green-50/30 hover:bg-green-50',
}

/* ── Modal détail + actions ── */
function OrderModal({ order, isOpen, onClose }) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset } = useForm()
  const [showReject, setShowReject] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['chef-orders'] })
    queryClient.invalidateQueries({ queryKey: ['chef-orders-attente'] })
  }

  const validateMut = useMutation({
    mutationFn: () => ordersApi.validate(order.id),
    onSuccess: () => { invalidate(); toast.success('Commande validée'); onClose() },
    onError: (e) => toast.error(e.response?.data?.detail ?? 'Erreur'),
  })
  const rejectMut = useMutation({
    mutationFn: (d) => ordersApi.reject(order.id, d),
    onSuccess: () => { invalidate(); toast.success('Commande rejetée'); reset(); setShowReject(false); onClose() },
    onError: (e) => toast.error(e.response?.data?.detail ?? 'Erreur'),
  })
  const readyMut = useMutation({
    mutationFn: () => ordersApi.markReady(order.id),
    onSuccess: () => { invalidate(); toast.success('Commande marquée prête'); onClose() },
    onError: (e) => toast.error(e.response?.data?.detail ?? 'Erreur'),
  })

  if (!order) return null
  const lignes = order.lignes ?? order.items ?? []

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); setShowReject(false) }} title={`Commande ${order.numero_commande}`} size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge status={order.statut} />
          <span className="text-xs text-gray-400 font-mono">
            {new Date(order.date_creation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Info étudiant + livraison */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-400 mb-1">Étudiant</p>
            <p className="text-sm font-semibold text-gray-800">{order.etudiant_nom ?? '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-400 mb-1">Livraison</p>
            <p className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-orange-400" />
              {order.salle_nom ?? '—'}
            </p>
            {order.heure_souhaitee && (
              <p className="text-xs text-orange-500 mt-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3" />{order.heure_souhaitee}
              </p>
            )}
          </div>
        </div>

        {/* Paiement */}
        <div className="p-3 bg-blue-50 rounded-xl flex items-center gap-3">
          <CreditCard className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">{order.methode_paiement_display ?? order.methode_paiement}</p>
            {order.telephone_paiement && (
              <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3" />{order.telephone_paiement}
              </p>
            )}
          </div>
          <span className="ml-auto font-medium text-blue-700 text-sm">{order.methode_paiement ?? '—'}</span>
        </div>

        {/* Articles */}
        {lignes.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Articles ({lignes.length})</p>
            <div className="space-y-0 max-h-44 overflow-y-auto pr-1 border border-gray-100 rounded-xl">
              {lignes.map((l, i) => (
                <div key={l.id ?? i} className="flex items-center justify-between px-3 py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <span className="text-sm font-medium text-gray-800">{l.produit_nom ?? l.produit?.nom ?? 'Produit'}</span>
                    {l.variante_nom && <span className="text-xs text-gray-400 ml-1">({l.variante_nom})</span>}
                    <p className="text-xs text-gray-400">{parseFloat(l.prix_unitaire ?? 0).toLocaleString('fr-FR')} F/u × {l.quantite ?? 1}</p>
                  </div>
                  <span className="font-semibold text-gray-800 text-sm flex-shrink-0">
                    {parseFloat(l.sous_total ?? (l.prix_unitaire ?? 0) * (l.quantite ?? 1)).toLocaleString('fr-FR')} F
                  </span>
                </div>
              ))}
            </div>
            {/* Récapitulatif financier */}
            <div className="mt-2 pt-2 space-y-1">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Sous-total produits</span>
                <span>{parseFloat(order.total_ht ?? 0).toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span className="flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> Frais de service</span>
                <span>+ {parseFloat(order.frais_service ?? 0).toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100">
                <span>Total TTC</span>
                <span className="text-orange-500">{parseFloat(order.total_ttc ?? 0).toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>
          </div>
        )}

        {order.description_besoin && (
          <div className="p-3 bg-amber-50 rounded-xl">
            <p className="text-xs text-amber-600 font-medium mb-0.5">Instructions</p>
            <p className="text-sm text-amber-800">{order.description_besoin}</p>
          </div>
        )}

        {order.statut === 'REJETEE' && order.motif_rejet && (
          <div className="p-3 bg-red-50 rounded-xl">
            <p className="text-xs text-red-600 font-medium mb-0.5">Motif de rejet</p>
            <p className="text-sm text-red-800">{order.motif_rejet}</p>
          </div>
        )}

        {/* Actions */}
        {order.statut === 'EN_ATTENTE' && !showReject && (
          <div className="flex gap-3">
            <button onClick={() => validateMut.mutate()} disabled={validateMut.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold text-sm transition-colors disabled:opacity-60">
              <CheckCircle className="h-4 w-4" />
              {validateMut.isPending ? 'Validation…' : 'Valider'}
            </button>
            <button onClick={() => setShowReject(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors">
              <XCircle className="h-4 w-4" /> Rejeter
            </button>
          </div>
        )}

        {order.statut === 'EN_ATTENTE' && showReject && (
          <form onSubmit={handleSubmit((d) => rejectMut.mutate(d))} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motif du rejet *</label>
              <textarea rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none"
                placeholder="Expliquer le motif…" {...register('motif_rejet', { required: true })} />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowReject(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Annuler
              </button>
              <button type="submit" disabled={rejectMut.isPending}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-60">
                {rejectMut.isPending ? 'Rejet…' : 'Confirmer le rejet'}
              </button>
            </div>
          </form>
        )}

        {order.statut === 'VALIDEE' && (
          <button onClick={() => readyMut.mutate()} disabled={readyMut.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-semibold text-sm transition-colors disabled:opacity-60">
            <Package className="h-4 w-4" />
            {readyMut.isPending ? 'Traitement…' : 'Marquer comme prête'}
          </button>
        )}
      </div>
    </Modal>
  )
}

/* ── Boutons inline rapides ── */
function InlineActions({ order, onOpenModal }) {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['chef-orders'] })
    queryClient.invalidateQueries({ queryKey: ['chef-orders-attente'] })
  }

  const validateMut = useMutation({
    mutationFn: () => ordersApi.validate(order.id),
    onSuccess: () => { invalidate(); toast.success('Validée') },
    onError: (e) => toast.error(e.response?.data?.detail ?? 'Erreur'),
  })
  const readyMut = useMutation({
    mutationFn: () => ordersApi.markReady(order.id),
    onSuccess: () => { invalidate(); toast.success('Prête') },
    onError: (e) => toast.error(e.response?.data?.detail ?? 'Erreur'),
  })

  return (
    <div className="flex items-center gap-1 justify-end">
      {order.statut === 'EN_ATTENTE' && (
        <button
          onClick={(e) => { e.stopPropagation(); validateMut.mutate() }}
          disabled={validateMut.isPending}
          title="Valider"
          className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors disabled:opacity-50"
        >
          <CheckCircle className="h-4 w-4" />
        </button>
      )}
      {order.statut === 'VALIDEE' && (
        <button
          onClick={(e) => { e.stopPropagation(); readyMut.mutate() }}
          disabled={readyMut.isPending}
          title="Marquer prête"
          className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 transition-colors disabled:opacity-50"
        >
          <Package className="h-4 w-4" />
        </button>
      )}
      {order.statut === 'EN_ATTENTE' && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenModal() }}
          title="Rejeter"
          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onOpenModal() }}
        title="Voir détail"
        className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
      >
        <Eye className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function ChefOrders() {
  const [page, setPage] = useState(1)
  const [statut, setStatut] = useState('EN_ATTENTE')
  const [search, setSearch] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['chef-orders', page, statut, search],
    queryFn: () => ordersApi.list({ page, statut: statut || undefined, search: search || undefined }),
    refetchInterval: 15000,
  })

  const orders = Array.isArray(data) ? data : data?.results ?? []
  const count = data?.count ?? orders.length
  const totalPages = Math.ceil(count / 20)

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Breadcrumb items={[{ label: 'Tableau de bord', to: '/chef' }, { label: 'Commandes' }]} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des commandes</h1>
          <p className="text-gray-500 mt-1">Valider, rejeter ou marquer les commandes · Actualisation auto toutes les 15s</p>
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Rechercher…"
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {STATUTS.map((s) => (
              <button
                key={s.value}
                onClick={() => { setStatut(s.value); setPage(1) }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap border ${
                  statut === s.value
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tableau */}
        {isLoading ? (
          <LoadingSpinner className="py-20" size="lg" />
        ) : orders.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl text-center py-16 shadow-sm">
            <ClipboardList className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">Aucune commande trouvée</p>
          </div>
        ) : (
          <>
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">N° Commande</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Étudiant</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden sm:table-cell">Salle</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden md:table-cell">Heure</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Montant</th>
                    <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">Statut</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`cursor-pointer transition-colors ${ROW_BG[order.statut] ?? 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                          {order.numero_commande}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-800 truncate max-w-[140px]">
                          {order.etudiant_nom ?? order.etudiant?.nom ?? '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate max-w-[100px]">{order.salle_nom ?? '—'}</span>
                        </p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {order.heure_souhaitee ? (
                          <span className="text-xs text-orange-600 flex items-center gap-1 font-medium">
                            <Clock className="h-3.5 w-3.5" />{order.heure_souhaitee}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-sm text-gray-800">
                          {parseFloat(order.total_ttc ?? 0).toLocaleString('fr-FR')} F
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge status={order.statut} />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <InlineActions order={order} onOpenModal={() => setSelectedOrder(order)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>

      <OrderModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </DashboardLayout>
  )
}
