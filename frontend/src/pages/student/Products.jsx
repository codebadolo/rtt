import { useQuery } from '@tanstack/react-query'
import { Check, Plus, Search, ShoppingCart, X } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { productsApi } from '../../api/products'
import Breadcrumb from '../../components/Breadcrumb'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import DashboardLayout from '../../layouts/DashboardLayout'
import useCartStore from '../../stores/cartStore'

const CATEGORIES = [
  { key: 'all', label: 'Tous' },
  { key: 'SANDWICH', label: 'Sandwichs' },
  { key: 'BOISSON', label: 'Boissons' },
  { key: 'PATISSERIE', label: 'Pâtisseries' },
  { key: 'SNACK', label: 'Snacks' },
  { key: 'AUTRE', label: 'Autres' },
]

function ProductCard({ product, onAddToCart }) {
  return (
    <div className="card flex flex-col hover:shadow-md transition-shadow">
      {product.image ? (
        <img
          src={product.image}
          alt={product.nom}
          className="w-full h-40 object-cover rounded-lg mb-3"
        />
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-primary-50 to-orange-100 rounded-lg mb-3 flex items-center justify-center">
          <span className="text-4xl">🍽️</span>
        </div>
      )}

      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-800 leading-tight">{product.nom}</h3>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
            {product.categorie}
          </span>
        </div>
        {product.description && (
          <p className="text-gray-500 text-sm mt-1 line-clamp-2">{product.description}</p>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <span className="font-bold text-primary-500 text-lg">
          {parseFloat(product.prix_base ?? product.prix ?? 0).toLocaleString('fr-FR')} FCFA
        </span>
        <button
          onClick={() => onAddToCart(product)}
          className="btn-primary btn-sm"
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>
    </div>
  )
}

function VariantModal({ product, isOpen, onClose }) {
  const addItem = useCartStore((s) => s.addItem)
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [selectedOptions, setSelectedOptions] = useState([])
  const [quantity, setQuantity] = useState(1)

  const { data: productDetail } = useQuery({
    queryKey: ['product', product?.id],
    queryFn: () => productsApi.get(product.id),
    enabled: isOpen && !!product,
  })

  const variants = productDetail?.variantes ?? []
  const options = productDetail?.options ?? []

  const toggleOption = (option) => {
    setSelectedOptions((prev) =>
      prev.find((o) => o.id === option.id)
        ? prev.filter((o) => o.id !== option.id)
        : [...prev, option]
    )
  }

  const handleAdd = () => {
    if (variants.length > 0 && !selectedVariant) {
      toast.error('Veuillez sélectionner une variante')
      return
    }

    addItem(product, quantity, selectedVariant, selectedOptions)
    toast.success(`${product.nom} ajouté au panier`)
    onClose()
    setSelectedVariant(null)
    setSelectedOptions([])
    setQuantity(1)
  }

  if (!product) return null

  const price = selectedVariant
    ? parseFloat(selectedVariant.prix_total ?? selectedVariant.prix ?? 0)
    : parseFloat(product.prix_base ?? product.prix ?? 0)
  const optionsTotal = selectedOptions.reduce(
    (sum, o) => sum + parseFloat(o.prix_supplementaire ?? 0),
    0
  )
  const total = (price + optionsTotal) * quantity

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product.nom}
      size="md"
    >
      <div className="space-y-4">
        {product.image && (
          <img
            src={product.image}
            alt={product.nom}
            className="w-full h-48 object-cover rounded-lg"
          />
        )}

        {/* Variants */}
        {variants.length > 0 && (
          <div>
            <p className="label">Variante *</p>
            <div className="grid grid-cols-2 gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariant(v)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selectedVariant?.id === v.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
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

        {/* Options */}
        {options.length > 0 && (
          <div>
            <p className="label">Options</p>
            <div className="space-y-2">
              {options.map((opt) => {
                const selected = selectedOptions.find((o) => o.id === opt.id)
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleOption(opt)}
                    className={`w-full p-3 rounded-xl border-2 flex items-center justify-between transition-all ${
                      selected
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-sm text-gray-700">{opt.nom}</span>
                    <div className="flex items-center gap-2">
                      {opt.prix_supplementaire && parseFloat(opt.prix_supplementaire) > 0 && (
                        <span className="text-sm text-primary-500 font-medium">
                          +{parseFloat(opt.prix_supplementaire).toLocaleString('fr-FR')} FCFA
                        </span>
                      )}
                      {selected && <Check className="h-4 w-4 text-primary-500" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div>
          <p className="label">Quantité</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-9 h-9 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-lg font-medium"
            >
              −
            </button>
            <span className="w-12 text-center font-semibold text-gray-800">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-9 h-9 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-lg font-medium"
            >
              +
            </button>
          </div>
        </div>

        {/* Total */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-600">Total</span>
            <span className="text-xl font-bold text-primary-500">
              {total.toLocaleString('fr-FR')} FCFA
            </span>
          </div>
          <button onClick={handleAdd} className="btn-primary w-full btn-lg">
            <ShoppingCart className="h-5 w-5" />
            Ajouter au panier
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function StudentProducts() {
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const addItem = useCartStore((s) => s.addItem)

  const { data, isLoading } = useQuery({
    queryKey: ['products', category, search],
    queryFn: () => {
      if (search) return productsApi.search(search)
      const params = category !== 'all' ? { categorie: category } : {}
      return productsApi.list(params)
    },
  })

  const products = Array.isArray(data) ? data : data?.results ?? []

  const handleAddToCart = (product) => {
    const needsVariant = false // will open modal to check
    setSelectedProduct(product)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Accueil', to: '/etudiant' }, { label: 'Produits' }]} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
          <p className="text-gray-500 mt-1">Parcourez notre catalogue et commandez</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit…"
            className="input pl-11"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category tabs */}
        {!search && (
          <div className="flex gap-2 overflow-x-auto pb-1 ">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  category === cat.key
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Products grid */}
        {isLoading ? (
          <LoadingSpinner className="py-20" size="lg" />
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🍽️</p>
            <p className="text-gray-500">Aucun produit trouvé</p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="btn-secondary mt-3"
              >
                Effacer la recherche
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        )}
      </div>

      <VariantModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </DashboardLayout>
  )
}
