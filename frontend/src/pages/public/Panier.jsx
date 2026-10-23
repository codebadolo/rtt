import { ArrowRight, Minus, Plus, ShoppingCart, Store, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import PublicLayout from '../../layouts/PublicLayout'
import useCartStore from '../../stores/cartStore'
import useParcoursStore from '../../stores/parcoursStore'

/** Étape 4 du parcours étudiant : panier, accessible sans compte. */
export default function Panier() {
  const navigate = useNavigate()
  const { items, removeItem, updateQuantity, clearCart } = useCartStore()
  const universite = useParcoursStore((s) => s.universite)
  const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const boutique = items[0]?.product?.vendeur_nom
  const retour = universite ? `/campus/${universite.id}` : '/campus'

  if (items.length === 0) {
    return (
      <PublicLayout masquerPanier>
        <div className="text-center py-20">
          <ShoppingCart className="h-16 w-16 text-gray-200 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-700 mb-2">Votre panier est vide</h1>
          <p className="text-gray-400 mb-6">Parcourez les boutiques de votre campus pour ajouter des produits.</p>
          <Link to={retour} className="btn-primary btn-lg">Voir les boutiques</Link>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout masquerPanier>
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Mon panier</h1>
          {boutique && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
              <Store className="w-4 h-4" /> {boutique}
            </p>
          )}
        </div>

        <div className="space-y-3">
          {items.map((item) => {
            const image = item.product.image_url ?? item.product.image
            return (
              <div key={item.key} className="card flex gap-4">
                {image ? (
                  <img src={image} alt={item.product.nom} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl">🍽️</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800">{item.product.nom}</p>
                  {item.variant && <p className="text-sm text-gray-500">{item.variant.nom}</p>}
                  {item.options.length > 0 && (
                    <p className="text-xs text-gray-400">+ {item.options.map((o) => o.nom).join(', ')}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => updateQuantity(item.key, item.quantity - 1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50" aria-label="Diminuer">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50" aria-label="Augmenter">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary-500">
                        {(item.unitPrice * item.quantity).toLocaleString('fr-FR')} FCFA
                      </span>
                      <button type="button" onClick={() => removeItem(item.key)}
                        className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50" aria-label="Retirer">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="card space-y-3">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Sous-total produits</span>
            <span className="font-semibold text-gray-900">{total.toLocaleString('fr-FR')} FCFA</span>
          </div>
          <p className="text-xs text-gray-400">Les frais de service sont détaillés dans le récapitulatif, avant le paiement.</p>
          <button type="button" onClick={() => navigate('/commande')} className="btn-primary btn-lg w-full">
            Commander <ArrowRight className="h-5 w-5" />
          </button>
          <div className="flex justify-between">
            <Link to={retour} className="text-sm text-gray-500 hover:text-gray-800">Continuer mes achats</Link>
            <button type="button" onClick={clearCart} className="text-sm text-red-500 hover:text-red-700">Vider le panier</button>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
