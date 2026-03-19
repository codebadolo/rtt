import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ShoppingBag,
  ClipboardList,
  FileCheck,
  Clock,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Timer,
} from 'lucide-react'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import Badge from '../../components/Badge'
import useAuthStore from '../../stores/authStore'
import { horairesApi } from '../../api/sectors'

const KYC_CONFIG = {
  NON_SOUMIS: {
    bg: 'bg-amber-50 border-amber-200',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    title: 'Vérification KYC requise',
    msg: 'Soumettez votre carte étudiante pour pouvoir passer des commandes.',
    action: { to: '/etudiant/kyc', label: 'Soumettre mon KYC', cls: 'bg-orange-500 text-white' },
  },
  EN_ATTENTE: {
    bg: 'bg-blue-50 border-blue-200',
    icon: Timer,
    iconColor: 'text-blue-500',
    title: 'KYC en cours de vérification',
    msg: 'Votre dossier est en cours d\'examen. Vous serez notifié une fois validé.',
    action: null,
  },
  VALIDE: {
    bg: 'bg-green-50 border-green-200',
    icon: CheckCircle,
    iconColor: 'text-green-500',
    title: 'Identité vérifiée ✓',
    msg: 'Votre compte est vérifié. Vous pouvez passer des commandes.',
    action: null,
  },
  REJETE: {
    bg: 'bg-red-50 border-red-200',
    icon: XCircle,
    iconColor: 'text-red-500',
    title: 'KYC rejeté',
    msg: 'Votre dossier a été rejeté. Veuillez resoumettre avec des documents valides.',
    action: { to: '/etudiant/kyc', label: 'Resoumettre', cls: 'bg-red-500 text-white' },
  },
}

function KYCBanner({ statut }) {
  const cfg = KYC_CONFIG[statut] ?? KYC_CONFIG['NON_SOUMIS']
  const Icon = cfg.icon
  if (statut === 'VALIDE') return null
  return (
    <div className={`border rounded-xl p-4 flex items-start gap-3 ${cfg.bg}`}>
      <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${cfg.iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800">{cfg.title}</p>
        <p className="text-gray-600 text-sm mt-0.5">{cfg.msg}</p>
      </div>
      {cfg.action && (
        <Link
          to={cfg.action.to}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 ${cfg.action.cls}`}
        >
          {cfg.action.label}
        </Link>
      )}
    </div>
  )
}

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
              Bienvenue sur Ritoto Express — votre service de livraison universitaire.
            </p>
          </div>
          {user?.statut_kyc === 'VALIDE' && (
            <Link
              to="/etudiant/produits"
              className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-orange-600 transition-colors shadow-sm"
            >
              Commander maintenant →
            </Link>
          )}
        </div>

        {/* KYC Banner */}
        <KYCBanner statut={user?.statut_kyc ?? 'NON_SOUMIS'} />

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
            to="/etudiant/kyc"
            className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:border-green-200 transition-all group col-span-2 sm:col-span-1"
          >
            <div className="w-11 h-11 bg-green-100 group-hover:bg-green-500 rounded-xl flex items-center justify-center mb-3 transition-colors">
              <FileCheck className="h-5 w-5 text-green-500 group-hover:text-white transition-colors" />
            </div>
            <p className="font-semibold text-gray-900">Mon KYC</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Statut :{' '}
              <span className={
                user?.statut_kyc === 'VALIDE' ? 'text-green-500' :
                user?.statut_kyc === 'REJETE' ? 'text-red-500' :
                user?.statut_kyc === 'EN_ATTENTE' ? 'text-blue-500' :
                'text-amber-500'
              }>
                {user?.statut_kyc === 'VALIDE' ? 'Validé' :
                 user?.statut_kyc === 'REJETE' ? 'Rejeté' :
                 user?.statut_kyc === 'EN_ATTENTE' ? 'En attente' :
                 'Non soumis'}
              </span>
            </p>
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
                {
                  label: 'Statut KYC',
                  value: user?.statut_kyc === 'VALIDE' ? '✅ Validé' :
                         user?.statut_kyc === 'EN_ATTENTE' ? '⏳ En attente' :
                         user?.statut_kyc === 'REJETE' ? '❌ Rejeté' : '⚠️ Non soumis'
                },
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
