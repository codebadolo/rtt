import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Trash2, Plus, Minus, ShoppingCart, ArrowRight, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import useCartStore from '../../stores/cartStore'
import { roomsApi } from '../../api/sectors'
import { ordersApi } from '../../api/orders'
import { paymentsApi } from '../../api/payments'
import { configApi } from '../../api/admin'

const PAYMENT_METHODS = [
  { value: 'ORANGE', label: 'Orange Money', emoji: '🟠' },
  { value: 'MOOV',   label: 'Moov Money',   emoji: '🟢' },
  { value: 'SANK',   label: 'Sank Money',   emoji: '🔵' },
]

export default function StudentCart() {
  const { items, removeItem, updateQuantity, clearCart } = useCartStore()
  const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      methode_paiement: 'ORANGE',
    },
  })

  const selectedMethode = watch('methode_paiement')

  const { data: roomsData } = useQuery({
    queryKey: ['rooms-all'],
    queryFn: () => roomsApi.list({ est_actif: true }),
  })

  const { data: config } = useQuery({
    queryKey: ['configuration'],
    queryFn: () => configApi.get(),
  })

  const rooms = Array.isArray(roomsData) ? roomsData : roomsData?.results ?? []

  const commandesFermees = useMemo(() => {
    if (!config) return null
    if (!config.commandes_actives) {
      return 'Les commandes sont temporairement désactivées.'
    }
    if (config.horaires_actifs && config.heure_ouverture && config.heure_fermeture) {
      const now = new Date()
      const pad = (n) => String(n).padStart(2, '0')
      const heureActuelle = `${pad(now.getHours())}:${pad(now.getMinutes())}`
      if (heureActuelle < config.heure_ouverture || heureActuelle > config.heure_fermeture) {
        return `Les commandes sont acceptées entre ${config.heure_ouverture} et ${config.heure_fermeture}.`
      }
    }
    return null
  }, [config])

  const { fraisService, totalTTC } = useMemo(() => {
    if (!config) return { fraisService: 0, totalTTC: total }
    const taux = parseFloat(config.taux_service || 10)
    const fraisService = Math.round(total * taux / 100)
    const totalTTC = total + fraisService
    return { fraisService, totalTTC }
  }, [config, total])

  // Mutation 2 : initier le paiement Senfenico après création de la commande
  const initierPaiementMutation = useMutation({
    mutationFn: (commandeId) => paymentsApi.initierPaiement(commandeId),
    onSuccess: (_, commandeId) => {
      queryClient.invalidateQueries({ queryKey: ['student-orders'] })
      navigate(`/etudiant/commandes/${commandeId}`)
    },
    onError: (err, commandeId) => {
      const msg = err.response?.data?.error ?? 'Erreur lors de l\'initiation du paiement'
      toast.error(msg)
      // Redirige quand même vers la commande
      navigate(`/etudiant/commandes/${commandeId}`)
    },
  })

  // Mutation 1 : créer la commande
  const orderMutation = useMutation({
    mutationFn: (data) => ordersApi.create(data),
    onSuccess: (order) => {
      clearCart()
      initierPaiementMutation.mutate(order.id)
    },
    onError: (err) => {
      const msg =
        err.response?.data?.detail ??
        Object.values(err.response?.data ?? {})[0]?.[0] ??
        'Erreur lors de la commande'
      toast.error(msg)
    },
  })

  const onSubmit = (data) => {
    if (items.length === 0) {
      toast.error('Votre panier est vide')
      return
    }

    const lignes = items.map((item) => ({
      produit: item.product.id,
      variante: item.variant?.id ?? null,
      options: item.options.map((o) => o.id),
      quantite: item.quantity,
      prix_unitaire: item.unitPrice,
    }))

    orderMutation.mutate({
      salle: parseInt(data.salle),
      methode_paiement: data.methode_paiement,
      telephone_paiement: data.telephone_paiement,
      description_besoin: data.description_besoin || '',
      heure_souhaitee: data.heure_souhaitee,
      lignes,
    })
  }

  const isSubmitting = orderMutation.isPending || initierPaiementMutation.isPending
  const canOrder = !commandesFermees

  if (items.length === 0) {
    return (
      <DashboardLayout>
      <Breadcrumb items={[{ label: 'Accueil', to: '/etudiant' }, { label: 'Mon panier' }]} />
        <div className="text-center py-20">
          <ShoppingCart className="h-16 w-16 text-gray-200 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Votre panier est vide
          </h2>
          <p className="text-gray-400 mb-6">
            Ajoutez des produits pour passer une commande.
          </p>
          <Link to="/etudiant/produits" className="btn-primary btn-lg">
            <ShoppingCart className="h-5 w-5" />
            Voir les produits
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon panier</h1>
          <p className="text-gray-500 mt-1">{items.length} article{items.length > 1 ? 's' : ''}</p>
        </div>

        {commandesFermees && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <Clock className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Site temporairement fermé</p>
              <p className="text-amber-700 text-sm mt-0.5">{commandesFermees}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart items */}
            <div className="lg:col-span-2 space-y-3">
              {items.map((item) => (
                <div key={item.key} className="card">
                  <div className="flex gap-4">
                    {item.product.image ? (
                      <img
                        src={item.product.image}
                        alt={item.product.nom}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">🍽️</span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-800">{item.product.nom}</h3>
                      {item.variant && (
                        <p className="text-sm text-gray-500">{item.variant.nom}</p>
                      )}
                      {item.options.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          + {item.options.map((o) => o.nom).join(', ')}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.key, item.quantity - 1)}
                            className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.key, item.quantity + 1)}
                            className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-primary-500">
                            {(item.unitPrice * item.quantity).toLocaleString('fr-FR')} FCFA
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItem(item.key)}
                            className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Delivery info */}
              <div className="card space-y-4">
                <h2 className="font-semibold text-gray-800">Informations de livraison</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Salle *</label>
                    <select
                      className={`input ${errors.salle ? 'border-red-400' : ''}`}
                      {...register('salle', { required: 'Salle requise' })}
                    >
                      <option value="">Choisir une salle</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nom}{r.batiment ? ` (${r.batiment})` : ''}
                        </option>
                      ))}
                    </select>
                    {errors.salle && <p className="form-error">{errors.salle.message}</p>}
                  </div>

                  <div>
                    <label className="label">Heure de livraison *</label>
                    <input
                      type="time"
                      className={`input ${errors.heure_souhaitee ? 'border-red-400' : ''}`}
                      {...register('heure_souhaitee', { required: 'Heure de livraison requise' })}
                    />
                    {errors.heure_souhaitee && <p className="form-error">{errors.heure_souhaitee.message}</p>}
                  </div>
                </div>

                <div>
                  <label className="label">Instructions spéciales</label>
                  <textarea
                    rows={2}
                    placeholder="Allergies, préférences, instructions particulières…"
                    className="input resize-none"
                    {...register('description_besoin')}
                  />
                </div>
              </div>

              {/* Payment */}
              <div className="card space-y-4">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-gray-800">Paiement mobile</h2>
                  <span className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full font-medium">
                    via Senfenico
                  </span>
                </div>

                <div>
                  <label className="label">Opérateur *</label>
                  <div className="grid grid-cols-3 gap-3">
                    {PAYMENT_METHODS.map((method) => (
                      <label
                        key={method.value}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedMethode === method.value
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          value={method.value}
                          className="sr-only"
                          {...register('methode_paiement', { required: true })}
                        />
                        <span className="text-lg">{method.emoji}</span>
                        <span className="text-xs font-medium text-gray-700 text-center leading-tight">
                          {method.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Numéro de téléphone *</label>
                  <input
                    type="tel"
                    placeholder="Ex: 07 00 00 00 00"
                    className={`input ${errors.telephone_paiement ? 'border-red-400' : ''}`}
                    {...register('telephone_paiement', {
                      required: 'Numéro requis',
                      pattern: {
                        value: /^[0-9\s\+\-]{8,15}$/,
                        message: 'Numéro invalide',
                      },
                    })}
                  />
                  {errors.telephone_paiement && (
                    <p className="form-error">{errors.telephone_paiement.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Order summary */}
            <div className="lg:col-span-1">
              <div className="card sticky top-20">
                <h2 className="font-semibold text-gray-800 mb-4">Récapitulatif</h2>

                <div className="space-y-2 mb-4">
                  {items.map((item) => (
                    <div key={item.key} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.product.nom} × {item.quantity}
                      </span>
                      <span className="text-gray-800 font-medium">
                        {(item.unitPrice * item.quantity).toLocaleString('fr-FR')}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-3 mb-4 space-y-1.5">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Sous-total produits</span>
                    <span>{total.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  {fraisService > 0 && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Frais de service ({config?.taux_service ?? 10}%)</span>
                      <span>+ {fraisService.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg text-gray-900 pt-1 border-t border-gray-100">
                    <span>Total</span>
                    <span className="text-primary-500">{totalTTC.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !canOrder}
                  className="btn-primary w-full btn-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {orderMutation.isPending ? 'Création…' : 'Initiation du paiement…'}
                    </span>
                  ) : (
                    <>
                      Commander et payer
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={clearCart}
                  className="btn-ghost w-full mt-2 text-sm text-red-500 hover:bg-red-50"
                >
                  Vider le panier
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
