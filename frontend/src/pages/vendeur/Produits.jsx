import Breadcrumb from '../../components/Breadcrumb'
import CatalogueEditor from '../../components/CatalogueEditor'
import DashboardLayout from '../../layouts/DashboardLayout'

export default function VendeurProduits() {
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: 'Tableau de bord', to: '/vendeur' }, { label: 'Mes produits' }]} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes produits</h1>
          <p className="text-gray-500 mt-1">Prix, disponibilité, photos et descriptions de votre catalogue.</p>
        </div>
        <div className="card">
          <CatalogueEditor />
        </div>
      </div>
    </DashboardLayout>
  )
}
