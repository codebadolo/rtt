import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, ChefHat, Clock, Package, X } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import { ordersApi } from '../../api/orders'

const TABS = [
  { value: 'EN_ATTENTE',     label: 'En attente',      icon: Clock },
  { value: 'EN_PREPARATION', label: 'En préparation',  icon: ChefHat },
  { value: 'PRETE',          label: 'Prêtes',          icon: Package },
  { value: 'LIVREE',         label: 'Livrées',         icon: CheckCircle },
]

function OrderModal({ order, onClose }) {
  const qc = useQueryClient()

  const { data: detail, isLoading } = useQuery({
    queryKey: ['order-detail', order?.id],
    queryFn: () => ordersApi.get(order.id),
    enabled: !!order?.id,
  })

  const acceptMutation = useMutation({
    mutationFn: () => ordersApi.accepterVendeur(order.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendeur-orders'] })
      toast.success('Commande acceptée — en cours de préparation')
      onClose()
    },
    onError: (e) => toast.error(e.response?.data?.detail ?? 'Erreur'),
  })

  const readyMutation = useMutation({
    mutationFn: () => ordersApi.markReady(order.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendeur-orders'] })
      toast.success('Commande marquée comme prête !')
      onClose()
    },
    onError: (e) => toast.error(e.response?.data?.detail ?? 'Erreur'),
  })

  if (!order) return null
  const o = detail ?? order

  return (
    <Modal isOpen onClose={onClose} title={`Commande ${order.numero_commande}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge status={order.statut} />
          {order.heure_souhaitee && (
            <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
              {order.heure_souhaitee}
            </span>
          )}
        </div>

        {/* Client */}
        <div className="p-3 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Client</p>
          <p className="font-semibold text-gray-800 mt-1">{o.etudiant_nom ?? '—'}</p>
          <p className="text-sm text-gray-500">{o.salle_nom ?? ''} — {o.secteur_nom ?? ''}</p>
        </div>

        {/* Articles */}
        {isLoading ? (
          <div className="py-6"><LoadingSpinner /></div>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Articles ({o.lignes?.length ?? 0})</p>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              {(o.lignes ?? []).map((ligne, i) => (
                <div key={i} className="px-3 py-2.5 border-b border-gray-50 last:border-0 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{ligne.produit_nom ?? ligne.produit?.nom}</p>
                    <p className="text-xs text-gray-400">× {ligne.quantite}</p>
                    {ligne.options?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {ligne.options.map((opt, j) => (
                          <span key={j} className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">{opt.option_nom}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="font-semibold text-sm">{parseFloat(ligne.sous_total ?? 0).toLocaleString('fr-FR')} F</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between font-bold text-orange-500 pt-2 border-t border-gray-100">
              <span>Total</span>
              <span>{parseFloat(o.total_ttc ?? 0).toLocaleString('fr-FR')} F</span>
            </div>
          </div>
        )}

        {o.description_besoin && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
            <p className="font-semibold text-xs text-yellow-600 mb-1">Instructions spéciales</p>
            {o.description_besoin}
          </div>
        )}

        {/* Actions */}
        {order.statut === 'EN_ATTENTE' && (
          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2">
              <X className="h-4 w-4" /> Ignorer
            </button>
            <button onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}
              className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
              {acceptMutation.isPending
                ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><CheckCircle className="h-4 w-4" /> Accepter</>}
            </button>
          </div>
        )}

        {order.statut === 'EN_PREPARATION' && (
          <button onClick={() => readyMutation.mutate()} disabled={readyMutation.isPending}
            className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2">
            {readyMutation.isPending
              ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Package className="h-4 w-4" /> Marquer comme prête</>}
          </button>
        )}
      </div>
    </Modal>
  )
}

export default function VendeurOrders() {
  const [activeTab, setActiveTab] = useState('EN_ATTENTE')
  const [selected, setSelected] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['vendeur-orders', activeTab],
    queryFn: () => ordersApi.list({ statut: activeTab, page_size: 100 }),
    refetchInterval: 15000,
  })

  const orders = Array.isArray(data) ? data : data?.results ?? []

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-gray-900">Gestion des commandes</h1>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(({ value, label, icon: Icon }) => (
            <button key={value} onClick={() => setActiveTab(value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                activeTab === value ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}>
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="py-20"><LoadingSpinner size="lg" /></div>
        ) : orders.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl text-center py-16 shadow-sm">
            <Package className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">Aucune commande dans cet état</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id}
                onClick={() => ['EN_ATTENTE', 'EN_PREPARATION'].includes(order.statut) ? setSelected(order) : null}
                className={`bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-4 ${
                  ['EN_ATTENTE', 'EN_PREPARATION'].includes(order.statut) ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
                }`}>
                <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                  order.statut === 'EN_ATTENTE' ? 'bg-yellow-100' :
                  order.statut === 'EN_PREPARATION' ? 'bg-orange-100' :
                  order.statut === 'PRETE' ? 'bg-purple-100' : 'bg-green-100'
                }`}>
                  <Package className={`h-5 w-5 ${
                    order.statut === 'EN_ATTENTE' ? 'text-yellow-600' :
                    order.statut === 'EN_PREPARATION' ? 'text-orange-600' :
                    order.statut === 'PRETE' ? 'text-purple-600' : 'text-green-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-gray-700">{order.numero_commande}</span>
                    <Badge status={order.statut} />
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{order.etudiant_nom ?? '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{order.salle_nom ?? ''} · {order.secteur_nom ?? ''}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-orange-500">{parseFloat(order.total_ttc ?? 0).toLocaleString('fr-FR')} F</p>
                  {order.heure_souhaitee && <p className="text-xs text-gray-400 mt-0.5">{order.heure_souhaitee}</p>}
                  {['EN_ATTENTE', 'EN_PREPARATION'].includes(order.statut) && (
                    <span className="text-xs text-orange-500 font-medium mt-1 block">Tap →</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && <OrderModal order={selected} onClose={() => setSelected(null)} />}
    </DashboardLayout>
  )
}
