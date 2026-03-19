import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CheckCircle, Shield, ShoppingBag, Star, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { productsApi } from '../api/products'
import useAuthStore from '../stores/authStore'

const ROLE_REDIRECTS = {
  ETUDIANT: '/etudiant',
  ADMIN: '/admin',
  CHEF_SECTEUR: '/chef',
  LIVREUR: '/livreur',
}

const CATEGORIES = {
  SANDWICH: { label: 'Sandwich', emoji: '🥪' },
  BOISSON: { label: 'Boisson', emoji: '🥤' },
  PATISSERIE: { label: 'Pâtisserie', emoji: '🥐' },
  SNACK: { label: 'Snack', emoji: '🍿' },
  AUTRE: { label: 'Autre', emoji: '🍽️' },
}

function Navbar() {
  const { isAuthenticated, user } = useAuthStore()
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-400 rounded-lg flex items-center justify-center shadow">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">
            Ritoto <span className="text-orange-500">Express</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link
              to={ROLE_REDIRECTS[user?.role] ?? '/'}
              className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors"
            >
              Mon espace →
            </Link>
          ) : (
            <>
              <Link
                to="/connexion"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Connexion
              </Link>
              <Link
                to="/inscription"
                className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors shadow-sm"
              >
                S'inscrire
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

function ProductCard({ product }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-36 bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center text-5xl">
        {CATEGORIES[product.categorie]?.emoji ?? '🍽️'}
      </div>
      <div className="p-4">
        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
          {product.categorie_display ?? CATEGORIES[product.categorie]?.label}
        </span>
        <h3 className="font-semibold text-gray-900 mt-2">{product.nom}</h3>
        <p className="text-orange-500 font-bold mt-1">
          {parseFloat(product.prix_base).toLocaleString('fr-FR')} FCFA
        </p>
      </div>
    </div>
  )
}

export default function Landing() {
  const { data: productsRaw } = useQuery({
    queryKey: ['landing-products'],
    queryFn: () => productsApi.list(),
    staleTime: 60_000,
  })

  const products = Array.isArray(productsRaw)
    ? productsRaw.slice(0, 6)
    : productsRaw?.results?.slice(0, 6) ?? []

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── Hero ── */}
      <section className="pt-24 pb-16 bg-gradient-to-br from-orange-50 via-white to-amber-50">
        <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              Livraison universitaire
            </span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight">
              Commandez repas &amp; boissons{' '}
              <span className="text-orange-500">directement en salle</span>
            </h1>
            <p className="mt-5 text-lg text-gray-500 leading-relaxed">
              Ritoto Campus livre sandwichs, boissons et pâtisseries dans votre salle de classe.
              Simple, rapide et pensé pour les étudiants.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/inscription"
                className="inline-flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-2xl font-semibold text-base hover:bg-orange-600 transition-colors shadow-md shadow-orange-200"
              >
                Créer un compte gratuit
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/connexion"
                className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-6 py-3 rounded-2xl font-semibold text-base hover:bg-gray-50 transition-colors"
              >
                Se connecter
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              {[
                'Livraison en salle de classe',
                'Paiement mobile money',
                'Inscription rapide et gratuite',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-500">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Visual */}
          <div className="hidden lg:flex justify-center">
            <div className="relative">
              <div className="w-72 h-72 bg-gradient-to-br from-orange-400 to-amber-500 rounded-3xl shadow-2xl flex items-center justify-center rotate-3">
                <ShoppingBag className="w-36 h-36 text-white opacity-90" />
              </div>
              <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-lg p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <Truck className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Livraison</p>
                  <p className="font-bold text-gray-800 text-sm">En cours 🚀</p>
                </div>
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-lg p-4">
                <div className="flex items-center gap-1 mb-1">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} className="w-3 h-3 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-xs text-gray-500">+500 étudiants satisfaits</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Comment ça fonctionne ?</h2>
            <p className="mt-3 text-gray-500">Simple en 3 étapes</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                color: 'bg-blue-100 text-blue-500',
                step: '01',
                title: 'Créez votre compte',
                desc: 'Inscrivez-vous avec votre email étudiant en quelques secondes.',
              },
              {
                icon: ShoppingBag,
                color: 'bg-orange-100 text-orange-500',
                step: '02',
                title: 'Choisissez vos produits',
                desc: 'Parcourez le catalogue : sandwichs, boissons, pâtisseries et plus.',
              },
              {
                icon: Truck,
                color: 'bg-green-100 text-green-500',
                step: '03',
                title: 'Recevez en salle',
                desc: 'Payez via mobile money (MTN, Moov, Orange) et recevez directement en classe.',
              },
            ].map((f) => (
              <div key={f.step} className="relative p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow bg-gray-50/50">
                <span className="absolute top-4 right-4 text-5xl font-black text-gray-100 select-none">
                  {f.step}
                </span>
                <div className={`w-12 h-12 rounded-2xl ${f.color} flex items-center justify-center mb-4`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Products ── */}
      {products.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Nos produits</h2>
                <p className="mt-2 text-gray-500">Frais préparés chaque jour</p>
              </div>
              <Link
                to="/connexion"
                className="text-orange-500 hover:text-orange-600 font-semibold text-sm flex items-center gap-1"
              >
                Voir tout <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="py-20 bg-gradient-to-br from-orange-500 to-amber-500">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-extrabold text-white mb-4">
            Prêt à commander ?
          </h2>
          <p className="text-orange-100 mb-8 text-lg">
            Rejoignez des centaines d'étudiants qui utilisent Ritoto Express chaque jour.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/inscription"
              className="bg-white text-orange-600 font-bold px-8 py-3.5 rounded-2xl hover:bg-orange-50 transition-colors shadow-lg"
            >
              S'inscrire gratuitement
            </Link>
            <Link
              to="/connexion"
              className="border-2 border-white text-white font-bold px-8 py-3.5 rounded-2xl hover:bg-white/10 transition-colors"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 bg-gray-900 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 bg-orange-500 rounded-md flex items-center justify-center">
            <ShoppingBag className="w-3 h-3 text-white" />
          </div>
          <span className="text-white font-bold">Ritoto Express</span>
        </div>
        <p className="text-gray-500 text-sm">
          © {new Date().getFullYear()} Ritoto Express — Service de livraison universitaire
        </p>
      </footer>
    </div>
  )
}
