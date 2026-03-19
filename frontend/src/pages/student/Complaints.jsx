import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle, Clock, Plus, X, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import { plaintesApi } from '../../api/complaints'
import { ordersApi } from '../../api/orders'

const CATEGORIES = [
  { value: 'COMMANDE', label: 'Problème de commande' },
  { value: 'LIVRAISON', label: 'Problème de livraison' },
  { value: 'PAIEMENT', label: 'Problème de paiement' },
  { value: 'PRODUIT', label: 'Problème de produit' },
  { value: 'AUTRE', label: 'Autre' },
]

const STATUT_CONFIG = {
  EN_ATTENTE: { label: 'En attente', color: 'text-yellow-600 bg-yellow-50', icon: Clock },
  EN_COURS: { label: 'En cours', color: 'text-blue-600 bg-blue-50', icon: Clock },
  RESOLUE: { label: 'Résolue', color: 'text-green-600 bg-green-50', icon: CheckCircle },
  REJETEE: { label: 'Rejetée', color: 'text-red-600 bg-red-50', icon: XCircle },
}

export default function StudentComplaints() {
  const [showForm, setShowForm] = useState(false)
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm()

  const { data: plaintesData, isLoading } = useQuery({
    queryKey: ['my-plaintes'],
    queryFn: () => plaintesApi.list(),
  })

  const { data: ordersData } = useQuery({
    queryKey: ['student-orders-list'],
    queryFn: () => ordersApi.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data) => plaintesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-plaintes'] })
      toast.success('Plainte soumise avec succès')
      reset()
      setShowForm(false)
    },
    onError: (err) => {
      const msg =
        err.response?.data?.detail ??
        Object.values(err.response?.data ?? {})[0]?.[0] ??
        'Erreur lors de la soumission'
      toast.error(msg)
    },
  })

  const plaintes = Array.isArray(plaintesData) ? plaintesData : plaintesData?.results ?? []
  const orders = Array.isArray(ordersData) ? ordersData : ordersData?.results ?? []

  const onSubmit = (data) => {
    createMutation.mutate({
      categorie: data.categorie,
      sujet: data.sujet,
      description: data.description,
      commande: data.commande || null,
    })
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: 'Accueil', to: '/etudiant' }, { label: 'Mes plaintes' }]} />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mes plaintes</h1>
            <p className="text-gray-500 mt-1">Signalez un problème lié à vos commandes ou services.</p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" />
              Nouvelle plainte
            </button>
          )}
        </div>

        {/* Formulaire de création */}
        {showForm && (
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary-500" />
                <h2 className="font-semibold text-gray-800">Soumettre une plainte</h2>
              </div>
              <button
                onClick={() => { setShowForm(false); reset() }}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Catégorie *</label>
                  <select
                    className={`input ${errors.categorie ? 'border-red-400' : ''}`}
                    {...register('categorie', { required: 'Catégorie requise' })}
                  >
                    <option value="">Sélectionner</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  {errors.categorie && <p className="form-error">{errors.categorie.message}</p>}
                </div>

                <div>
                  <label className="label">Commande concernée (optionnel)</label>
                  <select className="input" {...register('commande')}>
                    <option value="">Aucune commande spécifique</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.numero_commande}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Sujet *</label>
                <input
                  type="text"
                  placeholder="Résumez votre problème en quelques mots"
                  className={`input ${errors.sujet ? 'border-red-400' : ''}`}
                  {...register('sujet', { required: 'Sujet requis', maxLength: { value: 200, message: '200 caractères max' } })}
                />
                {errors.sujet && <p className="form-error">{errors.sujet.message}</p>}
              </div>

              <div>
                <label className="label">Description *</label>
                <textarea
                  rows={4}
                  placeholder="Décrivez votre problème en détail…"
                  className={`input resize-none ${errors.description ? 'border-red-400' : ''}`}
                  {...register('description', { required: 'Description requise' })}
                />
                {errors.description && <p className="form-error">{errors.description.message}</p>}
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary"
                >
                  {createMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Envoi…
                    </span>
                  ) : (
                    'Soumettre la plainte'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); reset() }}
                  className="btn-ghost"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Liste des plaintes */}
        {isLoading ? (
          <LoadingSpinner className="py-20" size="lg" />
        ) : plaintes.length === 0 ? (
          <div className="text-center py-20">
            <AlertTriangle className="h-16 w-16 text-gray-200 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Aucune plainte</h2>
            <p className="text-gray-400">Vous n'avez soumis aucune plainte pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {plaintes.map((plainte) => {
              const statutCfg = STATUT_CONFIG[plainte.statut] ?? STATUT_CONFIG.EN_ATTENTE
              const Icon = statutCfg.icon
              return (
                <div key={plainte.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-gray-800">{plainte.sujet}</span>
                        <span className="text-xs text-gray-400">
                          {CATEGORIES.find((c) => c.value === plainte.categorie)?.label}
                        </span>
                      </div>
                      {plainte.commande_numero && (
                        <p className="text-xs text-gray-400 mb-2">Commande : {plainte.commande_numero}</p>
                      )}
                      <p className="text-sm text-gray-600">{plainte.description}</p>
                      {plainte.reponse_admin && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-xl">
                          <p className="text-xs font-medium text-blue-600 mb-1">Réponse de l'administration</p>
                          <p className="text-sm text-blue-700">{plainte.reponse_admin}</p>
                        </div>
                      )}
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${statutCfg.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {statutCfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    {new Date(plainte.date_creation).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
