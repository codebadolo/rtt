import { useQuery } from '@tanstack/react-query'
import { MapPin, Search, Star, Store, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { boutiquesApi, universitesApi } from '../../api/auth'
import LoadingSpinner from '../../components/LoadingSpinner'
import PublicLayout from '../../layouts/PublicLayout'
import useParcoursStore from '../../stores/parcoursStore'

/** Étape 2 du parcours étudiant : liste des vendeurs/boutiques du campus. */
export default function Boutiques() {
  const { universiteId } = useParams()
  const { universite, choisirUniversite } = useParcoursStore()
  const [search, setSearch] = useState('')

  // Lien direct vers un campus : mémoriser le choix
  const { data: univ } = useQuery({
    queryKey: ['universite', universiteId],
    queryFn: () => universitesApi.list().then((l) => (Array.isArray(l) ? l : l.results ?? []).find((u) => String(u.id) === universiteId)),
    enabled: String(universite?.id) !== universiteId,
  })
  useEffect(() => {
    if (univ) choisirUniversite({ id: univ.id, nom: univ.nom })
  }, [univ, choisirUniversite])

  const { data, isLoading } = useQuery({
    queryKey: ['boutiques', universiteId, search],
    queryFn: () => boutiquesApi.list({ universite: universiteId, search: search || undefined, page_size: 100 }),
  })
  const boutiques = Array.isArray(data) ? data : data?.results ?? []

  return (
    <PublicLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Boutiques du campus</h1>
          <p className="text-gray-500 mt-1">Choisissez une boutique pour voir ses produits.</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une boutique…"
            className="input pl-11"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isLoading ? (
          <LoadingSpinner className="py-16" size="lg" />
        ) : boutiques.length === 0 ? (
          <div className="text-center py-16">
            <Store className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">Aucune boutique active sur ce campus pour le moment.</p>
            <Link to="/campus" className="btn-secondary mt-4 inline-flex">Changer d'université</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boutiques.map((b) => (
              <Link
                key={b.id}
                to={`/campus/${universiteId}/boutiques/${b.id}`}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
              >
                {b.photo_boutique ? (
                  <img src={b.photo_boutique} alt={b.nom_boutique} className="w-full h-32 object-cover" />
                ) : (
                  <div className="w-full h-32 bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center">
                    <Store className="w-10 h-10 text-orange-300" />
                  </div>
                )}
                <div className="p-4 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-gray-900">{b.nom_boutique}</h2>
                    {b.note_moyenne != null && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-600 flex-shrink-0">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {b.note_moyenne.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{b.categorie_display}</p>
                  {(b.emplacement_nom || b.adresse_commerce) && (
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {b.emplacement_nom ?? b.adresse_commerce}
                    </p>
                  )}
                  <p className="text-xs text-orange-600 font-medium mt-2">
                    {b.nb_produits} produit{b.nb_produits > 1 ? 's' : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
