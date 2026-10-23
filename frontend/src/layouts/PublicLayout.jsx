import { Building2, ShoppingBag, ShoppingCart, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import useAuthStore from '../stores/authStore'
import useCartStore from '../stores/cartStore'
import useParcoursStore from '../stores/parcoursStore'

const ESPACE_PAR_ROLE = {
  ETUDIANT: '/etudiant',
  LIVREUR: '/livreur',
  VENDEUR_INTERIEUR: '/vendeur',
  VENDEUR_EXTERIEUR: '/vendeur',
  CHEF_SECTEUR: '/chef',
  ADMIN_UNIVERSITAIRE: '/admin',
  ADMIN: '/admin',
}

/**
 * Mise en page des pages accessibles sans compte : choix du campus,
 * boutiques, produits, panier et parcours de commande.
 */
export default function PublicLayout({ children, masquerPanier = false }) {
  const { isAuthenticated, user } = useAuthStore()
  const universite = useParcoursStore((s) => s.universite)
  const nbArticles = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0))

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-amber-400 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900 hidden sm:inline">
              Ritôtô <span className="text-orange-500">Campus</span>
            </span>
          </Link>

          {universite && (
            <Link
              to="/campus"
              title="Changer d'université"
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1.5 min-w-0"
            >
              <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{universite.nom}</span>
            </Link>
          )}

          <div className="flex-1" />

          {!masquerPanier && (
            <Link to="/panier" className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-700" aria-label="Panier">
              <ShoppingCart className="w-5 h-5" />
              {nbArticles > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                  {nbArticles}
                </span>
              )}
            </Link>
          )}

          {isAuthenticated ? (
            <Link
              to={ESPACE_PAR_ROLE[user?.role] ?? '/'}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 px-2 py-1.5 rounded-xl hover:bg-gray-100"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Mon espace</span>
            </Link>
          ) : (
            <Link to="/connexion" className="text-sm font-medium text-orange-600 hover:text-orange-700 px-2">
              Se connecter
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
