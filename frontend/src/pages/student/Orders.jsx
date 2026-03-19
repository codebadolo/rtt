import { useQuery } from '@tanstack/react-query'
import { ChevronRight, ClipboardList } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ordersApi } from '../../api/orders'
import Badge from '../../components/Badge'
import Breadcrumb from '../../components/Breadcrumb'
import LoadingSpinner from '../../components/LoadingSpinner'
import Pagination from '../../components/Pagination'
import DashboardLayout from '../../layouts/DashboardLayout'

const STATUTS = [
  { value: '', label: 'Toutes' },
  { value: 'BROUILLON', label: 'Brouillon' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'VALIDEE', label: 'Validée' },
  { value: 'REJETEE', label: 'Rejetée' },
  { value: 'PRETE', label: 'Prête' },
  { value: 'DISTRIBUEE', label: 'Distribuée' },
  { value: 'ANNULEE', label: 'Annulée' },
]

export default function StudentOrders() {
  const [page, setPage] = useState(1)
  const [statut, setStatut] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['student-orders', page, statut],
    queryFn: () => ordersApi.list({ page, statut: statut || undefined }),
  })

  const orders = Array.isArray(data) ? data : data?.results ?? []
  const count = data?.count ?? orders.length
  const totalPages = Math.ceil(count / 20)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Accueil', to: '/etudiant' }, { label: 'Mes commandes' }]} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes commandes</h1>
          <p className="text-gray-500 mt-1">Historique de toutes vos commandes</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 ">
          {STATUTS.map((s) => (
            <button
              key={s.value}
              onClick={() => { setStatut(s.value); setPage(1) }}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                statut === s.value
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <LoadingSpinner className="py-20" size="lg" />
        ) : orders.length === 0 ? (
          <div className="card text-center py-16">
            <ClipboardList className="h-14 w-14 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aucune commande trouvée</p>
            <Link to="/etudiant/produits" className="btn-primary mt-4 inline-flex">
              Passer une commande
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  to={`/etudiant/commandes/${order.id}`}
                  className="card flex items-center gap-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">
                        {order.numero_commande}
                      </span>
                      <Badge status={order.statut} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      <span>
                        {order.secteur_nom ?? order.secteur?.nom ?? 'Secteur'}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(order.date_creation ?? order.created_at).toLocaleDateString(
                          'fr-FR',
                          { day: 'numeric', month: 'short', year: 'numeric' }
                        )}
                      </span>
                    </div>
                    {order.salle_nom && (
                      <p className="text-xs text-gray-400 mt-0.5">Salle : {order.salle_nom}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-primary-500">
                        {parseFloat(order.total_ttc ?? 0).toLocaleString('fr-FR')} FCFA
                      </p>
                      {order.methode_paiement && (
                        <p className="text-xs text-gray-400">{order.methode_paiement}</p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-300" />
                  </div>
                </Link>
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
