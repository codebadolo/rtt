import { useQuery } from '@tanstack/react-query'
import { Building2, ChevronRight, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { universitesApi } from '../../api/auth'
import LoadingSpinner from '../../components/LoadingSpinner'
import PublicLayout from '../../layouts/PublicLayout'
import useParcoursStore from '../../stores/parcoursStore'

/** Étape 1 du parcours étudiant : choix de l'université, sans compte. */
export default function Campus() {
  const navigate = useNavigate()
  const { universite: actuelle, choisirUniversite } = useParcoursStore()

  const { data, isLoading } = useQuery({
    queryKey: ['universites-publiques'],
    queryFn: () => universitesApi.list(),
  })
  const universites = Array.isArray(data) ? data : data?.results ?? []

  const choisir = (u) => {
    choisirUniversite({ id: u.id, nom: u.nom })
    navigate(`/campus/${u.id}`)
  }

  return (
    <PublicLayout>
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-extrabold text-gray-900">Choisissez votre université</h1>
        <p className="text-gray-500 mt-1 mb-6">
          Découvrez immédiatement les boutiques de votre campus — aucun compte n'est nécessaire pour parcourir l'offre.
        </p>

        {isLoading ? (
          <LoadingSpinner className="py-16" size="lg" />
        ) : universites.length === 0 ? (
          <p className="text-center text-gray-500 py-16">Aucune université disponible pour le moment.</p>
        ) : (
          <ul className="space-y-3">
            {universites.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => choisir(u)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 bg-white text-left transition-all hover:border-orange-300 ${
                    actuelle?.id === u.id ? 'border-orange-400' : 'border-gray-100'
                  }`}
                >
                  <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600 flex-shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{u.nom}</p>
                    {u.ville && (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {u.ville}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PublicLayout>
  )
}
