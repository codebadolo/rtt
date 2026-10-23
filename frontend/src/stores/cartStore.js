import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      // Un panier = un seul vendeur (une commande par boutique).
      // Retourne false si le produit vient d'une autre boutique que le panier.
      peutAjouter: (product) => {
        const { items } = get()
        if (items.length === 0) return true
        return (items[0].product.vendeur ?? null) === (product.vendeur ?? null)
      },

      addItem: (product, quantity = 1, variant = null, options = []) => {
        const { items } = get()
        const key = `${product.id}-${variant?.id ?? 'none'}-${options.map((o) => o.id).sort().join(',')}`
        const existing = items.find((i) => i.key === key)

        if (existing) {
          set({
            items: items.map((i) =>
              i.key === key ? { ...i, quantity: i.quantity + quantity } : i
            ),
          })
        } else {
          set({
            items: [
              ...items,
              {
                key,
                product,
                variant,
                options,
                quantity,
                unitPrice: variant
                  ? parseFloat(variant.prix_total ?? variant.prix ?? 0)
                  : parseFloat(product.prix_base ?? product.prix ?? 0),
              },
            ],
          })
        }
      },

      removeItem: (key) =>
        set({ items: get().items.filter((i) => i.key !== key) }),

      updateQuantity: (key, quantity) => {
        if (quantity <= 0) {
          get().removeItem(key)
          return
        }
        set({
          items: get().items.map((i) =>
            i.key === key ? { ...i, quantity } : i
          ),
        })
      },

      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'ritoto-cart',
    }
  )
)

export default useCartStore
