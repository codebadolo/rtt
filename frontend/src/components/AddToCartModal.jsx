import { useQuery } from '@tanstack/react-query'
import { Check, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { productsApi } from '../api/products'
import useCartStore from '../stores/cartStore'
import Modal from './Modal'

const prixOption = (o) => parseFloat(o.prix ?? o.prix_supplementaire ?? 0)

/**
 * Choix variante / options / quantité puis ajout au panier.
 * Un panier ne contient que les produits d'une seule boutique : si le
 * produit vient d'une autre boutique, on propose de vider le panier.
 */
export default function AddToCartModal({ product, isOpen, onClose }) {
  const { addItem, clearCart, peutAjouter } = useCartStore()
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [selectedOptions, setSelectedOptions] = useState([])
  const [quantity, setQuantity] = useState(1)
  const [conflit, setConflit] = useState(false)

  const { data: detail } = useQuery({
    queryKey: ['product', product?.id],
    queryFn: () => productsApi.get(product.id),
    enabled: isOpen && !!product,
  })

  const variants = (detail?.variantes ?? []).filter((v) => v.est_actif !== false)
  const options = (detail?.options ?? []).filter((o) => o.est_actif !== false)

  const fermer = () => {
    setSelectedVariant(null)
    setSelectedOptions([])
    setQuantity(1)
    setConflit(false)
    onClose()
  }

  const toggleOption = (option) =>
    setSelectedOptions((prev) =>
      prev.find((o) => o.id === option.id) ? prev.filter((o) => o.id !== option.id) : [...prev, option]
    )

  const ajouter = (remplacer = false) => {
    if (variants.length > 0 && !selectedVariant) {
      toast.error('Veuillez choisir une variante')
      return
    }
    if (!remplacer && !peutAjouter(product)) {
      setConflit(true)
      return
    }
    if (remplacer) clearCart()
    addItem(product, quantity, selectedVariant, selectedOptions)
    toast.success(`${product.nom} ajouté au panier`)
    fermer()
  }

  if (!product) return null

  const prix = selectedVariant
    ? parseFloat(selectedVariant.prix_total ?? selectedVariant.prix ?? 0)
    : parseFloat(product.prix_base ?? 0)
  const total = (prix + selectedOptions.reduce((s, o) => s + prixOption(o), 0)) * quantity
  const image = product.image_url ?? product.image

  return (
    <Modal isOpen={isOpen} onClose={fermer} title={product.nom} size="md">
      {conflit ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Votre panier contient des produits d'une autre boutique. Une commande ne peut concerner
            qu'une seule boutique.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setConflit(false)} className="btn-secondary flex-1">
              Garder mon panier
            </button>
            <button type="button" onClick={() => ajouter(true)} className="btn-primary flex-1">
              Vider et ajouter
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {image && <img src={image} alt={product.nom} className="w-full h-48 object-cover rounded-lg" />}
          {(detail?.description || product.description) && (
            <p className="text-sm text-gray-600">{detail?.description || product.description}</p>
          )}

          {variants.length > 0 && (
            <div>
              <p className="label">Variante *</p>
              <div className="grid grid-cols-2 gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariant(v)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      selectedVariant?.id === v.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-sm text-gray-800">{v.nom}</p>
                    <p className="text-primary-500 font-semibold text-sm">
                      {parseFloat(v.prix_total ?? v.prix ?? 0).toLocaleString('fr-FR')} FCFA
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {options.length > 0 && (
            <div>
              <p className="label">Options</p>
              <div className="space-y-2">
                {options.map((opt) => {
                  const selected = selectedOptions.find((o) => o.id === opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleOption(opt)}
                      className={`w-full p-3 rounded-xl border-2 flex items-center justify-between transition-all ${
                        selected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-sm text-gray-700">{opt.nom}</span>
                      <span className="flex items-center gap-2">
                        {prixOption(opt) > 0 && (
                          <span className="text-sm text-primary-500 font-medium">
                            +{prixOption(opt).toLocaleString('fr-FR')} FCFA
                          </span>
                        )}
                        {selected && <Check className="h-4 w-4 text-primary-500" />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <p className="label">Quantité</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-9 h-9 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-lg font-medium"
              >
                −
              </button>
              <span className="w-12 text-center font-semibold text-gray-800">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-9 h-9 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-lg font-medium"
              >
                +
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-600">Total</span>
              <span className="text-xl font-bold text-primary-500">{total.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <button type="button" onClick={() => ajouter(false)} className="btn-primary w-full btn-lg">
              <ShoppingCart className="h-5 w-5" />
              Ajouter au panier
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
