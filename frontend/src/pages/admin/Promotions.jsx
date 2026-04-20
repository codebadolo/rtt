import { Megaphone, Sparkles, Tag } from 'lucide-react'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'

export default function AdminPromotions() {
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <Breadcrumb
          items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Publicités & Promotions' }]}
        />

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Publicités & Promotions</h1>
          <p className="text-gray-500 mt-1">Gérez vos campagnes promotionnelles et publicités</p>
        </div>

        {/* Coming soon */}
        <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-orange-400 to-orange-600 px-8 py-12 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mb-5">
              <Megaphone className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-2">Coming Soon</h2>
            <p className="text-orange-100 text-base max-w-sm">
              La gestion des publicités et promotions sera disponible prochainement.
            </p>
          </div>

          <div className="px-8 py-8 grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="flex flex-col items-center text-center p-4 bg-orange-50 rounded-2xl">
              <Tag className="h-7 w-7 text-orange-500 mb-3" />
              <p className="font-semibold text-gray-800 text-sm">Codes promo</p>
              <p className="text-xs text-gray-400 mt-1">Créez des réductions pour vos étudiants</p>
            </div>
            <div className="flex flex-col items-center text-center p-4 bg-orange-50 rounded-2xl">
              <Sparkles className="h-7 w-7 text-orange-500 mb-3" />
              <p className="font-semibold text-gray-800 text-sm">Offres spéciales</p>
              <p className="text-xs text-gray-400 mt-1">Promos flash et offres limitées</p>
            </div>
            <div className="flex flex-col items-center text-center p-4 bg-orange-50 rounded-2xl">
              <Megaphone className="h-7 w-7 text-orange-500 mb-3" />
              <p className="font-semibold text-gray-800 text-sm">Bannières</p>
              <p className="text-xs text-gray-400 mt-1">Affichez des annonces aux étudiants</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
