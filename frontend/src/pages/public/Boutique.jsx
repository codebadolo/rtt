import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MapPin, Plus, ShoppingCart, Store } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { boutiquesApi } from '../../api/auth'
import { productsApi } from '../../api/products'
import AddToCartModal from '../../components/AddToCartModal'
import LoadingSpinner from '../../components/LoadingSpinner'
import PublicLayout from '../../layouts/PublicLayout'
import useCartStore from '../../stores/cartStore'

/** Étape 3 du parcours étudiant : produits d'une boutique, ajout au panier. */
export default function Boutique() {
  const { universiteId, boutiqueId } = useParams()
  const [produitChoisi, setProduitChoisi] = useState(null)
  const items = useCartStore((s) => s.items)
  const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)

  const { data: boutique, isLoading: chargementBoutique, isError } = useQuery({
    queryKey: ['boutique', boutiqueId],
    queryFn: () => boutiquesApi.get(boutiqueId),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['produits-boutique', boutiqueId],
    queryFn: () => productsApi.list({ vendeur: boutiqueId, est_actif: true, page_size: 200 }),
  })
  const produits = Array.isArray(data) ? data : data?.results ?? []

  if (chargementBoutique) {
    return <PublicLayout><LoadingSpinner className="py-24" size="lg" /></PublicLayout>
  }
  if (isError || !boutique) {
    return (
      <PublicLayout>
        <div className="text-center py-20">
          <p className="text-gray-500">Cette boutique n'est pas disponible.</p>
          <Link to={`/campus/${universiteId}`} className="btn-secondary mt-4 inline-flex">Voir les boutiques</Link>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="space-y-5 pb-24">
        <Link to={`/campus/${universiteId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" /> Toutes les boutiques
        </Link>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-4 items-center">
          {boutique.photo_boutique ? (
            <img src={boutique.photo_boutique} alt={boutique.nom_boutique} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Store className="w-7 h-7 text-orange-500" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-gray-900">{boutique.nom_boutique}</h1>
            <p className="text-sm text-gray-500">{boutique.categorie_display}</p>
            {(boutique.emplacement_nom || boutique.adresse_commerce) && (
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {boutique.emplacement_nom ?? boutique.adresse_commerce}
              </p>
            )}
          </div>
        </div>
        {boutique.description && <p className="text-sm text-gray-600">{boutique.description}</p>}

        {isLoading ? (
          <LoadingSpinner className="py-16" size="lg" />
        ) : produits.length === 0 ? (
          <p className="text-center text-gray-500 py-16">Aucun produit disponible pour le moment.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {produits.map((p) => {
              const image = p.image_url ?? p.image
              const disponible = p.en_stock !== false
              return (
                <div key={p.id} className="card flex flex-col">
                  {image ? (
                    <img src={image} alt={p.nom} className="w-full h-36 object-cover rounded-lg mb-3" />
                  ) : (
                    <div className="w-full h-36 bg-gradient-to-br from-primary-50 to-orange-100 rounded-lg mb-3 flex items-center justify-center">
                      <span className="text-4xl">🍽️</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 leading-tight">{p.nom}</h3>
                    {p.description && <p className="text-gray-500 text-sm mt-1 line-clamp-2">{p.description}</p>}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <span className="font-bold text-primary-500">
                      {parseFloat(p.prix_base ?? 0).toLocaleString('fr-FR')} FCFA
                    </span>
                    {disponible ? (
                      <button type="button" onClick={() => setProduitChoisi(p)} className="btn-primary btn-sm">
                        <Plus className="h-4 w-4" /> Ajouter
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">Indisponible</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 backdrop-blur border-t border-gray-100">
          <Link to="/panier" className="btn-primary btn-lg w-full max-w-md mx-auto flex">
            <ShoppingCart className="h-5 w-5" />
            Voir le panier · {total.toLocaleString('fr-FR')} FCFA
          </Link>
        </div>
      )}

      <AddToCartModal product={produitChoisi} isOpen={!!produitChoisi} onClose={() => setProduitChoisi(null)} />
    </PublicLayout>
  )
}
