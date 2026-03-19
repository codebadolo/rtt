import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Truck, Package, CheckCircle, MapPin, Clock } from 'lucide-react'
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
      toast.success('Commande marquée comme distribuée !')
      onClose()
    },
    onError: (err) =>
      toast.error(err.response?.data?.detail ?? 'Erreur lors de la distribution'),
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
        <div className="p-4 bg-primary-50 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-primary-500" />
            <span className="text-gray-700">
              <span className="font-medium">Secteur :</span>{' '}
              {order.secteur_nom ?? order.secteur?.nom ?? '—'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-primary-500" />
            <span className="text-gray-700">
              <span className="font-medium">Salle :</span>{' '}
              {order.salle_nom ?? order.salle?.nom ?? '—'}
            </span>
          </div>
          {order.heure_souhaitee && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-primary-500" />
              <span className="text-gray-700">
                <span className="font-medium">Heure :</span> {order.heure_souhaitee}
              </span>
            </div>
          )}
        </div>

        {/* Student */}
        <div className="p-3 bg-gray-50 rounded-xl">
          <p className="text-sm font-medium text-gray-700">Étudiant</p>
          <p className="text-gray-600 text-sm mt-0.5">
            {order.etudiant_nom ?? order.etudiant?.nom}
          </p>
        </div>

        {/* Items summary */}
        {lignes.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Articles à livrer ({lignes.length})
            </p>
            <div className="space-y-1">
              {lignes.map((ligne, i) => (
                <div
                  key={ligne.id ?? i}
                  className="flex justify-between text-sm text-gray-600 py-1"
                >
                  <span>
                    {ligne.produit_nom ?? ligne.produit?.nom ?? 'Produit'} × {ligne.quantite ?? 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {order.statut === 'PRETE' && (
          <button
            onClick={() => distributeMutation.mutate()}
            disabled={distributeMutation.isPending}
            className="btn-primary w-full btn-lg"
          >
            {distributeMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Traitement…
              </span>
            ) : (
              <>
                <CheckCircle className="h-5 w-5" />
                Confirmer la livraison
              </>
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
    refetchInterval: 30000, // refresh every 30s
  })

  const { data: distributedData } = useQuery({
    queryKey: ['livreur-distributed'],
    queryFn: () => ordersApi.list({ statut: 'DISTRIBUEE', limit: 1 }),
  })

  const orders = Array.isArray(data) ? data : data?.results ?? []
  const distributedCount = Array.isArray(distributedData)
    ? distributedData.length
    : distributedData?.count ?? 0

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bonjour, {user?.prenom} !
          </h1>
          <p className="text-gray-500 mt-1">Tableau de bord — Livreur</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary-100 rounded-xl">
                <Truck className="h-5 w-5 text-primary-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
                <p className="text-sm text-gray-500">À livrer</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-100 rounded-xl">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{distributedCount}</p>
                <p className="text-sm text-gray-500">Distribuées</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {[
            { value: 'PRETE', label: 'Prêtes à livrer' },
            { value: 'DISTRIBUEE', label: 'Distribuées' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatut(tab.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                statut === tab.value
                  ? 'bg-primary-500 text-white'
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
          <div className="card text-center py-16">
            <Truck className="h-14 w-14 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {statut === 'PRETE'
                ? 'Aucune commande prête à livrer'
                : 'Aucune commande distribuée'}
            </p>
            {statut === 'PRETE' && (
              <p className="text-gray-400 text-sm mt-1">
                Les commandes validées par les chefs apparaîtront ici.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="card flex items-start gap-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                  order.statut === 'PRETE' ? 'bg-primary-100' : 'bg-green-100'
                }`}>
                  {order.statut === 'PRETE' ? (
                    <Truck className="h-5 w-5 text-primary-500" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">
                      {order.numero_commande}
                    </span>
                    <Badge status={order.statut} />
                  </div>

                  <div className="mt-1 space-y-0.5">
                    <p className="text-sm text-gray-600">
                      <MapPin className="h-3.5 w-3.5 inline mr-1 text-gray-400" />
                      {order.secteur_nom ?? order.secteur?.nom ?? '—'}
                      {(order.salle_nom ?? order.salle?.nom) && (
                        <span className="text-gray-400">
                          {' • '}
                          {order.salle_nom ?? order.salle?.nom}
                        </span>
                      )}
                    </p>
                    {order.heure_souhaitee && (
                      <p className="text-xs text-primary-500">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {order.heure_souhaitee}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-primary-500">
                    {parseFloat(order.total_ttc ?? 0).toLocaleString('fr-FR')} FCFA
                  </p>
                  {order.statut === 'PRETE' && (
                    <span className="text-xs text-primary-500 font-medium mt-1 block">
                      Tap pour livrer →
                    </span>
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
