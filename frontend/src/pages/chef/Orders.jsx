import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  CheckCircle,
  XCircle,
  Package,
  ClipboardList,
  Search,
  X,
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
  { value: '', label: 'Toutes' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'VALIDEE', label: 'Validées' },
  { value: 'REJETEE', label: 'Rejetées' },
  { value: 'PRETE', label: 'Prêtes' },
  { value: 'DISTRIBUEE', label: 'Distribuées' },
]

function OrderActionModal({ order, isOpen, onClose }) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset } = useForm()
  const [action, setAction] = useState(null)

  const validateMutation = useMutation({
    mutationFn: () => ordersApi.validate(order.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chef-orders'] })
      toast.success('Commande validée')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? 'Erreur'),
  })

  const rejectMutation = useMutation({
    mutationFn: (data) => ordersApi.reject(order.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chef-orders'] })
      toast.success('Commande rejetée')
      onClose()
      reset()
      setAction(null)
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? 'Erreur'),
  })

  const readyMutation = useMutation({
    mutationFn: () => ordersApi.markReady(order.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chef-orders'] })
      toast.success('Commande marquée prête')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? 'Erreur'),
  })

  if (!order) return null

  const lignes = order.lignes ?? order.items ?? []

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Commande ${order.numero_commande}`} size="md">
      <div className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2">
          <Badge status={order.statut} />
          <span className="text-sm text-gray-500">
            {new Date(order.date_creation ?? order.created_at).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>

        {/* Student info */}
        <div className="p-3 bg-gray-50 rounded-xl">
          <p className="text-sm font-medium text-gray-700">
            {order.etudiant_nom ?? order.etudiant?.nom}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Secteur : {order.secteur_nom ?? order.secteur?.nom} •
            Salle : {order.salle_nom ?? order.salle?.nom ?? '—'}
          </p>
          {order.heure_souhaitee && (
            <p className="text-xs text-primary-500 mt-0.5">
              Heure souhaitée : {order.heure_souhaitee}
            </p>
          )}
        </div>

        {/* Order items */}
        {lignes.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Articles</p>
            <div className="space-y-1.5">
              {lignes.map((ligne, i) => (
                <div
                  key={ligne.id ?? i}
                  className="flex justify-between text-sm py-1.5 border-b border-gray-50"
                >
                  <span className="text-gray-700">
                    {ligne.produit_nom ?? ligne.produit?.nom ?? 'Produit'} × {ligne.quantite ?? 1}
                  </span>
                  <span className="font-medium text-gray-800">
                    {parseFloat(
                      (ligne.prix_unitaire ?? 0) * (ligne.quantite ?? 1)
                    ).toLocaleString('fr-FR')}{' '}
                    FCFA
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-bold text-primary-500 mt-2">
              <span>Total TTC</span>
              <span>{parseFloat(order.total_ttc ?? 0).toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>
        )}

        {/* Payment info */}
        <div className="p-3 bg-blue-50 rounded-xl text-sm">
          <span className="text-blue-700 font-medium">{order.methode_paiement_display ?? order.methode_paiement}</span>
          {order.telephone_paiement && (
            <span className="text-blue-600 ml-2">{order.telephone_paiement}</span>
          )}
        </div>

        {order.description_besoin && (
          <div className="p-3 bg-amber-50 rounded-xl">
            <p className="text-xs text-amber-600 font-medium mb-0.5">Instructions</p>
            <p className="text-sm text-amber-800">{order.description_besoin}</p>
          </div>
        )}

        {/* Actions */}
        {order.statut === 'EN_ATTENTE' && action !== 'reject' && (
          <div className="flex gap-3">
            <button
              onClick={() => validateMutation.mutate()}
              disabled={validateMutation.isPending}
              className="btn-primary flex-1"
            >
              <CheckCircle className="h-4 w-4" />
              {validateMutation.isPending ? '…' : 'Valider'}
            </button>
            <button
              onClick={() => setAction('reject')}
              className="btn-danger flex-1"
            >
              <XCircle className="h-4 w-4" />
              Rejeter
            </button>
          </div>
        )}

        {order.statut === 'EN_ATTENTE' && action === 'reject' && (
          <form onSubmit={handleSubmit((d) => rejectMutation.mutate(d))} className="space-y-3">
            <div>
              <label className="label">Motif du rejet *</label>
              <textarea
                rows={2}
                className="input resize-none"
                placeholder="Expliquer le motif…"
                {...register('motif_rejet', { required: true })}
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setAction(null)} className="btn-secondary flex-1">
                Annuler
              </button>
              <button type="submit" disabled={rejectMutation.isPending} className="btn-danger flex-1">
                {rejectMutation.isPending ? '…' : 'Confirmer'}
              </button>
            </div>
          </form>
        )}

        {order.statut === 'VALIDEE' && (
          <button
            onClick={() => readyMutation.mutate()}
            disabled={readyMutation.isPending}
            className="btn-primary w-full"
          >
            <Package className="h-4 w-4" />
            {readyMutation.isPending ? '…' : 'Marquer comme prête'}
          </button>
        )}
      </div>
    </Modal>
  )
}

export default function ChefOrders() {
  const [page, setPage] = useState(1)
  const [statut, setStatut] = useState('EN_ATTENTE')
  const [search, setSearch] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['chef-orders', page, statut, search],
    queryFn: () =>
      ordersApi.list({
        page,
        statut: statut || undefined,
        search: search || undefined,
      }),
  })

  const orders = Array.isArray(data) ? data : data?.results ?? []
  const count = data?.count ?? orders.length
  const totalPages = Math.ceil(count / 20)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Tableau de bord', to: '/chef' }, { label: 'Commandes' }]} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des commandes</h1>
          <p className="text-gray-500 mt-1">Valider, rejeter ou marquer les commandes</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Rechercher…"
              className="input pl-9"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {STATUTS.map((s) => (
              <button
                key={s.value}
                onClick={() => { setStatut(s.value); setPage(1) }}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  statut === s.value
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner className="py-20" size="lg" />
        ) : orders.length === 0 ? (
          <div className="card text-center py-16">
            <ClipboardList className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">Aucune commande trouvée</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="card flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">
                        {order.numero_commande}
                      </span>
                      <Badge status={order.statut} />
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {order.etudiant_nom ?? order.etudiant?.nom}
                      {' • '}
                      {order.secteur_nom ?? order.secteur?.nom}
                    </p>
                    {order.heure_souhaitee && (
                      <p className="text-xs text-primary-500">
                        ⏰ {order.heure_souhaitee}
                      </p>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-primary-500">
                      {parseFloat(order.total_ttc ?? 0).toLocaleString('fr-FR')} FCFA
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{order.methode_paiement_display ?? order.methode_paiement}</p>
                  </div>
                </div>
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>

      <OrderActionModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </DashboardLayout>
  )
}
