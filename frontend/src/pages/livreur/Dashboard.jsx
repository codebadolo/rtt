import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Truck, Package, CheckCircle, MapPin, Clock,
  History, TrendingUp, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import useAuthStore from '../../stores/authStore'
import { ordersApi } from '../../api/orders'

function OrderDistributeModal({ order, isOpen, onClose }) {
  const queryClient = useQueryClient()

  const distributeMutation = useMutation({
    mutationFn: () => ordersApi.distribute(order.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livreur-orders'] })
      queryClient.invalidateQueries({ queryKey: ['livreur-today'] })
      toast.success('Commande marquée comme distribuée !')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? 'Erreur lors de la distribution'),
  })

  if (!order) return null
  const lignes = order.lignes ?? order.items ?? []

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Livraison ${order.numero_commande}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge status={order.statut} />
          <span className="text-sm text-gray-500">
            {new Date(order.date_creation ?? order.created_at).toLocaleDateString('fr-FR')}
          </span>
        </div>

        {/* Delivery info */}
        <div className="p-4 bg-orange-50 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-orange-500" />
            <span className="text-gray-700">
              <span className="font-medium">Secteur :</span>{' '}
              {order.secteur_nom ?? order.secteur?.nom ?? '—'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-orange-500" />
            <span className="text-gray-700">
              <span className="font-medium">Salle :</span>{' '}
              {order.salle_nom ?? order.salle?.nom ?? '—'}
            </span>
          </div>
          {order.heure_souhaitee && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-gray-700">
                <span className="font-medium">Heure :</span> {order.heure_souhaitee}
              </span>
            </div>
          )}
        </div>

        {/* Student */}
        <div className="p-3 bg-gray-50 rounded-xl">
          <p className="text-sm font-medium text-gray-700">Étudiant</p>
          <p className="text-gray-600 text-sm mt-0.5">{order.etudiant_nom ?? order.etudiant?.nom}</p>
        </div>

        {lignes.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Articles à livrer ({lignes.length})</p>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              {lignes.map((ligne, i) => (
                <div key={ligne.id ?? i} className="flex items-center justify-between px-3 py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{ligne.produit_nom ?? ligne.produit?.nom ?? 'Produit'}</p>
                    <p className="text-xs text-gray-400">{parseFloat(ligne.prix_unitaire ?? 0).toLocaleString('fr-FR')} F/u × {ligne.quantite ?? 1}</p>
                  </div>
                  <span className="font-semibold text-sm text-gray-800 flex-shrink-0">
                    {parseFloat(ligne.sous_total ?? (ligne.prix_unitaire ?? 0) * (ligne.quantite ?? 1)).toLocaleString('fr-FR')} F
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 space-y-1">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Sous-total produits</span>
                <span>{parseFloat(order.total_ht ?? 0).toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Frais de service</span>
                <span>+ {parseFloat(order.frais_service ?? 0).toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div className="flex justify-between font-bold text-orange-500 pt-1 border-t border-gray-100">
                <span>Total TTC</span>
                <span>{parseFloat(order.total_ttc ?? 0).toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>
          </div>
        )}

        {order.statut === 'PRETE' && (
          <button
            onClick={() => distributeMutation.mutate()}
            disabled={distributeMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-colors disabled:opacity-60"
          >
            {distributeMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Traitement…
              </span>
            ) : (
              <><CheckCircle className="h-5 w-5" /> Confirmer la livraison</>
            )}
          </button>
        )}
      </div>
    </Modal>
  )
}

export default function LivreurDashboard() {
  const user = useAuthStore((s) => s.user)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [statut, setStatut] = useState('PRETE')

  const { data, isLoading } = useQuery({
    queryKey: ['livreur-orders', statut],
    queryFn: () => ordersApi.list({ statut }),
    refetchInterval: 20000,
  })

  // Stats du jour
  const { data: todayData } = useQuery({
    queryKey: ['livreur-today'],
    queryFn: () => ordersApi.list({ statut: 'DISTRIBUEE', page_size: 200 }),
    refetchInterval: 30000,
  })

  const orders = Array.isArray(data) ? data : data?.results ?? []

  const allToday = Array.isArray(todayData) ? todayData : todayData?.results ?? []
  const todayStart = new Date(); todayStart.setHours(0,0,0,0)
  const todayDelivered = allToday.filter((o) => new Date(o.date_creation) >= todayStart)
  const todayCA = todayDelivered.reduce((s, o) => s + parseFloat(o.total_ttc ?? 0), 0)
  const totalDistribued = Array.isArray(todayData) ? todayData.length : (todayData?.count ?? 0)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bonjour, {user?.prenom} !</h1>
          <p className="text-gray-500 mt-1">Tableau de bord — Livreur</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-3">
            <div className={`p-2.5 rounded-xl flex-shrink-0 ${orders.length > 0 && statut === 'PRETE' ? 'bg-orange-100' : 'bg-gray-100'}`}>
              <Truck className={`h-5 w-5 ${orders.length > 0 && statut === 'PRETE' ? 'text-orange-500' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{Array.isArray(data) ? data.length : (data?.count ?? 0)}</p>
              <p className="text-sm text-gray-500">À livrer</p>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-3">
            <div className="p-2.5 bg-green-100 rounded-xl flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{todayDelivered.length}</p>
              <p className="text-sm text-gray-500">Livr. aujourd'hui</p>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-xl flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{todayCA.toLocaleString('fr-FR')} F</p>
              <p className="text-sm text-gray-500">CA aujourd'hui</p>
            </div>
          </div>

          <Link
            to="/livreur/historique"
            className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow"
          >
            <div className="p-2.5 bg-purple-100 rounded-xl flex-shrink-0">
              <History className="h-5 w-5 text-purple-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-bold text-gray-900">{totalDistribued}</p>
              <p className="text-sm text-gray-500">Total livré</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {[
            { value: 'PRETE',     label: 'Prêtes à livrer' },
            { value: 'DISTRIBUEE', label: 'Distribuées' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatut(tab.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                statut === tab.value
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders list */}
        {isLoading ? (
          <LoadingSpinner className="py-20" size="lg" />
        ) : orders.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl text-center py-16 shadow-sm">
            <Truck className="h-14 w-14 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {statut === 'PRETE' ? 'Aucune commande prête à livrer' : 'Aucune commande distribuée'}
            </p>
            {statut === 'PRETE' && (
              <p className="text-gray-400 text-sm mt-1">
                Les commandes validées par les chefs apparaîtront ici. Mise à jour auto toutes les 20s.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                onClick={() => statut === 'PRETE' ? setSelectedOrder(order) : null}
                className={`bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-start gap-4 ${
                  statut === 'PRETE' ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
                }`}
              >
                <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                  order.statut === 'PRETE' ? 'bg-orange-100' : 'bg-green-100'
                }`}>
                  {order.statut === 'PRETE'
                    ? <Truck className="h-5 w-5 text-orange-500" />
                    : <CheckCircle className="h-5 w-5 text-green-500" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-gray-700">{order.numero_commande}</span>
                    <Badge status={order.statut} />
                  </div>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">
                    {order.etudiant_nom ?? order.etudiant?.nom ?? '—'}
                  </p>
                  <div className="mt-1 text-xs text-gray-400 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {order.secteur_nom ?? '—'}{order.salle_nom ? ` · ${order.salle_nom}` : ''}
                    </span>
                    {order.heure_souhaitee && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />{order.heure_souhaitee}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-orange-500">
                    {parseFloat(order.total_ttc ?? 0).toLocaleString('fr-FR')} F
                  </p>
                  {order.statut === 'PRETE' && (
                    <span className="text-xs text-orange-500 font-medium mt-1 block">Tap pour livrer →</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <OrderDistributeModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </DashboardLayout>
  )
}
