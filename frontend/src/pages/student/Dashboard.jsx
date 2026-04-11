import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ShoppingBag,
  ClipboardList,
  AlertTriangle,
  Clock,
  ChevronRight,
} from 'lucide-react'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import useAuthStore from '../../stores/authStore'
import { horairesApi } from '../../api/sectors'

export default function StudentDashboard() {
  const user = useAuthStore((s) => s.user)

  const { data: horaires } = useQuery({
    queryKey: ['horaires-today'],
    queryFn: () => horairesApi.aujourdhui(),
  })

  const todaySchedules = Array.isArray(horaires)
    ? horaires
    : horaires?.results ?? []

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {greeting}, {user?.prenom ?? user?.nom_complet?.split(' ')[0]} ! 👋
            </h1>
            <p className="text-gray-500 mt-1">
              Bienvenue sur Ritoto Campus — votre service de livraison universitaire.
            </p>
          </div>
          <Link
            to="/etudiant/produits"
            className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-orange-600 transition-colors shadow-sm"
          >
            Commander maintenant →
          </Link>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Link
            to="/etudiant/produits"
            className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:border-orange-200 transition-all group"
          >
            <div className="w-11 h-11 bg-orange-100 group-hover:bg-orange-500 rounded-xl flex items-center justify-center mb-3 transition-colors">
              <ShoppingBag className="h-5 w-5 text-orange-500 group-hover:text-white transition-colors" />
            </div>
            <p className="font-semibold text-gray-900">Produits</p>
            <p className="text-xs text-gray-400 mt-0.5">Voir le catalogue</p>
          </Link>

          <Link
            to="/etudiant/commandes"
            className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:border-blue-200 transition-all group"
          >
            <div className="w-11 h-11 bg-blue-100 group-hover:bg-blue-500 rounded-xl flex items-center justify-center mb-3 transition-colors">
              <ClipboardList className="h-5 w-5 text-blue-500 group-hover:text-white transition-colors" />
            </div>
            <p className="font-semibold text-gray-900">Commandes</p>
            <p className="text-xs text-gray-400 mt-0.5">Mes commandes</p>
          </Link>

          <Link
            to="/etudiant/plaintes"
            className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:border-red-200 transition-all group col-span-2 sm:col-span-1"
          >
            <div className="w-11 h-11 bg-red-100 group-hover:bg-red-500 rounded-xl flex items-center justify-center mb-3 transition-colors">
              <AlertTriangle className="h-5 w-5 text-red-500 group-hover:text-white transition-colors" />
            </div>
            <p className="font-semibold text-gray-900">Plaintes</p>
            <p className="text-xs text-gray-400 mt-0.5">Signaler un problème</p>
          </Link>
        </div>

        {/* Today schedules + profile info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's schedules */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="h-4 w-4 text-orange-500" />
              </div>
              <h2 className="font-semibold text-gray-800">Horaires du jour</h2>
            </div>
            {todaySchedules.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Aucune livraison programmée aujourd'hui</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaySchedules.map((h) => (
                  <div key={h.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {h.secteur_nom ?? h.secteur?.nom ?? 'Secteur'}
                      </p>
                      <p className="text-xs text-orange-600 mt-0.5">
                        {h.heure_debut ?? h.heure_ouverture} – {h.heure_fin ?? h.heure_fermeture}
                      </p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
                      Ouvert
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Profile summary */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <ClipboardList className="h-4 w-4 text-purple-500" />
              </div>
              <h2 className="font-semibold text-gray-800">Mon profil</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Nom complet', value: user?.nom_complet },
                { label: 'Email', value: user?.email },
                { label: 'Rôle', value: 'Étudiant' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-500">{item.label}</span>
                  <span className="text-sm font-medium text-gray-800">{item.value ?? '—'}</span>
                </div>
              ))}
            </div>
            <Link
              to="/etudiant/profil"
              className="flex items-center gap-1 text-sm text-orange-500 hover:text-orange-600 mt-3 font-medium"
            >
              Modifier mon profil <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
