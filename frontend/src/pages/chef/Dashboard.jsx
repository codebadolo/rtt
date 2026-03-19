import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ClipboardList, Clock, ChevronRight, AlertCircle } from 'lucide-react'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import Badge from '../../components/Badge'
import useAuthStore from '../../stores/authStore'
import { ordersApi } from '../../api/orders'
import { horairesApi } from '../../api/sectors'

export default function ChefDashboard() {
  const user = useAuthStore((s) => s.user)

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['chef-orders', 'EN_ATTENTE'],
    queryFn: () => ordersApi.list({ statut: 'EN_ATTENTE', limit: 10 }),
  })

  const { data: allOrdersData } = useQuery({
    queryKey: ['chef-orders-all'],
    queryFn: () => ordersApi.list({ limit: 1 }),
  })

  const { data: horaires } = useQuery({
    queryKey: ['horaires-today'],
    queryFn: () => horairesApi.aujourdhui(),
  })

  const pendingOrders = Array.isArray(ordersData)
    ? ordersData
    : ordersData?.results ?? []

  const totalOrders = Array.isArray(allOrdersData)
    ? allOrdersData.length
    : allOrdersData?.count ?? 0

  const todaySchedules = Array.isArray(horaires) ? horaires : horaires?.results ?? []

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Chef Secteur' }]} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bonjour, {user?.prenom} !
          </h1>
          <p className="text-gray-500 mt-1">
            Tableau de bord — Chef de secteur
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 rounded-xl">
                <AlertCircle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {pendingOrders.length}
                </p>
                <p className="text-sm text-gray-500">En attente</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary-100 rounded-xl">
                <ClipboardList className="h-5 w-5 text-primary-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
                <p className="text-sm text-gray-500">Total commandes</p>
              </div>
            </div>
          </div>

          <div className="card col-span-2 sm:col-span-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-100 rounded-xl">
                <Clock className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {todaySchedules.length}
                </p>
                <p className="text-sm text-gray-500">Horaires aujourd'hui</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending orders */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">
                Commandes en attente
              </h2>
              <Link
                to="/chef/commandes"
                className="text-sm text-primary-500 hover:text-primary-600 flex items-center gap-1"
              >
                Gérer <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {ordersLoading ? (
              <LoadingSpinner className="py-8" />
            ) : pendingOrders.length === 0 ? (
              <div className="text-center py-8">
                <ClipboardList className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">
                  Aucune commande en attente
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingOrders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 bg-amber-50 rounded-xl"
                  >
                    <div>
                      <p className="font-medium text-sm text-gray-800">
                        {order.numero_commande}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {order.etudiant_nom ?? order.etudiant?.nom}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm text-primary-500">
                        {parseFloat(order.total_ttc ?? 0).toLocaleString('fr-FR')} FCFA
                      </p>
                      <Badge status={order.statut} />
                    </div>
                  </div>
                ))}

                {pendingOrders.length > 5 && (
                  <Link
                    to="/chef/commandes"
                    className="block text-center text-sm text-primary-500 py-2 hover:text-primary-600"
                  >
                    +{pendingOrders.length - 5} de plus
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Today's schedule */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-primary-500" />
              <h2 className="font-semibold text-gray-800">
                Horaires d'aujourd'hui
              </h2>
            </div>

            {todaySchedules.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">
                  Aucun horaire programmé aujourd'hui
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {todaySchedules.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-xl"
                  >
                    <div>
                      <p className="font-medium text-sm text-gray-800">
                        {h.secteur_nom ?? h.secteur?.nom ?? 'Secteur'}
                      </p>
                      <p className="text-xs text-green-600 mt-0.5">
                        {h.heure_ouverture} – {h.heure_fermeture}
                      </p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
                      Actif
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
