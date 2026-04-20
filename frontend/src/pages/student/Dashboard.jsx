import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingBag,
  ClipboardList,
  AlertTriangle,
  Clock,
  ChevronRight,
} from 'lucide-react'
import DashboardLayout from '../../layouts/DashboardLayout'
import useAuthStore from '../../stores/authStore'
import { horairesApi } from '../../api/sectors'
import { configApi } from '../../api/admin'

const JOURS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

function getNextOpening(config) {
  if (!config?.horaires_actifs) return null
  const now = new Date()
  const jsToPython = (d) => (d + 6) % 7

  for (let offset = 0; offset < 8; offset++) {
    const d = new Date(now)
    d.setDate(now.getDate() + offset)
    const jour = jsToPython(d.getDay())

    let ouverture = null
    let actif = true

    if (config.horaires_semaine?.length > 0) {
      const h = config.horaires_semaine.find((h) => h.jour === jour)
      if (h) { actif = h.actif; ouverture = h.heure_ouverture }
    } else {
      ouverture = config.heure_ouverture
    }

    if (!actif || !ouverture) continue

    const [hh, mm] = ouverture.split(':').map(Number)
    const opening = new Date(d)
    opening.setHours(hh, mm, 0, 0)
    if (opening > now) return opening
  }
  return null
}

function isCommandesFermees(config) {
  if (!config) return false
  if (!config.commandes_actives) return true
  if (config.horaires_actifs) {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const heureActuelle = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    const jour = (now.getDay() + 6) % 7

    if (config.horaires_semaine?.length > 0) {
      const horaire = config.horaires_semaine.find((h) => h.jour === jour)
      if (horaire) {
        if (!horaire.actif) return true
        if (horaire.heure_ouverture && horaire.heure_fermeture) {
          return heureActuelle < horaire.heure_ouverture || heureActuelle > horaire.heure_fermeture
        }
      }
    } else if (config.heure_ouverture && config.heure_fermeture) {
      return heureActuelle < config.heure_ouverture || heureActuelle > config.heure_fermeture
    }
  }
  return false
}

function CountdownBanner({ config }) {
  const [seconds, setSeconds] = useState(null)
  const [nextDate, setNextDate] = useState(null)
  const fermee = isCommandesFermees(config)

  useEffect(() => {
    if (!fermee || !config) { setSeconds(null); setNextDate(null); return }

    function tick() {
      const next = getNextOpening(config)
      setNextDate(next)
      if (!next) { setSeconds(null); return }
      setSeconds(Math.max(0, Math.floor((next - new Date()) / 1000)))
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [fermee, config])

  if (!fermee) return null

  const pad = (n) => String(n).padStart(2, '0')
  const hh = seconds !== null ? pad(Math.floor(seconds / 3600)) : '--'
  const mm = seconds !== null ? pad(Math.floor((seconds % 3600) / 60)) : '--'
  const ss = seconds !== null ? pad(seconds % 60) : '--'

  const jourLabel = nextDate ? JOURS_FR[nextDate.getDay()] : null
  const heureLabel = nextDate
    ? `${pad(nextDate.getHours())}:${pad(nextDate.getMinutes())}`
    : null

  return (
    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-6 text-white shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-orange-200" />
        <p className="text-orange-100 font-medium text-sm">Commandes actuellement fermées</p>
      </div>

      <p className="text-orange-100 text-sm mb-3">Prochaine ouverture dans</p>

      {/* Grand compte à rebours */}
      <div className="flex items-end gap-2 mb-4">
        {[hh, mm, ss].map((val, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="bg-white/20 rounded-2xl px-4 py-3 min-w-[64px] text-center backdrop-blur-sm">
              <span className="font-mono font-extrabold text-4xl leading-none">{val}</span>
              <p className="text-orange-200 text-xs mt-1">
                {i === 0 ? 'heures' : i === 1 ? 'minutes' : 'secondes'}
              </p>
            </div>
            {i < 2 && <span className="font-bold text-3xl text-orange-200 mb-3">:</span>}
          </div>
        ))}
      </div>

      {jourLabel && heureLabel && (
        <p className="text-orange-100 text-sm">
          Ouverture {jourLabel === JOURS_FR[new Date().getDay()] ? 'aujourd\'hui' : jourLabel} à{' '}
          <strong className="text-white">{heureLabel}</strong>
        </p>
      )}

      {!nextDate && seconds === null && (
        <p className="text-orange-200 text-sm">Aucune ouverture programmée prochainement.</p>
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

  const { data: config } = useQuery({
    queryKey: ['configuration'],
    queryFn: () => configApi.get(),
  })

  const todaySchedules = Array.isArray(horaires)
    ? horaires
    : horaires?.results ?? []

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Countdown — visible seulement si fermé */}
        {config && <CountdownBanner config={config} />}

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
