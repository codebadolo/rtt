import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Store, MapPin, Clock, CheckCircle, XCircle, Upload, Building2, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import useAuthStore from '../../stores/authStore'
import { profilsApi } from '../../api/orders'
import { sectorsApi } from '../../api/sectors'
import { universitesApi } from '../../api/auth'

const CATEGORIES = [
  { value: 'SANDWICH', label: 'Sandwich' },
  { value: 'BOISSON', label: 'Boisson' },
  { value: 'PATISSERIE', label: 'Pâtisserie' },
  { value: 'SNACK', label: 'Snack' },
  { value: 'AUTRE', label: 'Autre' },
]

function StatutBanner({ profil }) {
  if (profil.est_valide) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
        <p className="text-sm text-green-700 font-medium">Boutique validée — visible par les étudiants.</p>
      </div>
    )
  }
  if (profil.motif_rejet) {
    return (
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-red-700 font-medium">Dossier rejeté</p>
          <p className="text-sm text-red-600 mt-0.5">Motif : {profil.motif_rejet}</p>
          <p className="text-xs text-red-500 mt-1">Modifiez les informations ci-dessous et resoumettez.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
      <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
      <p className="text-sm text-amber-700 font-medium">
        Boutique en attente de validation par l'administrateur. Votre compte reste utilisable normalement entre-temps.
      </p>
    </div>
  )
}

export default function VendeurProfil() {
  const user = useAuthStore((s) => s.user)
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const queryClient = useQueryClient()
  const estExterieur = user?.role === 'VENDEUR_EXTERIEUR'

  const { data: profil, isLoading } = useQuery({
    queryKey: ['mon-profil-vendeur'],
    queryFn: () => profilsApi.getVendeur().catch((e) => { if (e.response?.status === 404) return null; throw e }),
  })

  const { data: secteursData } = useQuery({
    queryKey: ['secteurs-actifs'],
    queryFn: () => sectorsApi.actifs(),
  })
  const secteurs = Array.isArray(secteursData) ? secteursData : secteursData?.results ?? []

  const { data: universitesData } = useQuery({
    queryKey: ['universites-liste'],
    queryFn: () => universitesApi.list(),
    enabled: estExterieur,
  })
  const universites = Array.isArray(universitesData) ? universitesData : universitesData?.results ?? []

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: profil ?? { mode_livraison: 'LIVREUR', capacite_max_commandes: 20 },
  })

  const createMut = useMutation({
    mutationFn: (data) => profilsApi.createVendeur(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mon-profil-vendeur'] })
      fetchProfile()
      toast.success('Boutique créée — en attente de validation')
    },
    onError: (e) => toast.error(Object.values(e.response?.data ?? {})[0]?.[0] ?? e.response?.data?.error ?? 'Erreur'),
  })

  const updateMut = useMutation({
    mutationFn: (data) => profilsApi.updateVendeur(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mon-profil-vendeur'] })
      toast.success('Boutique mise à jour')
    },
    onError: (e) => toast.error(Object.values(e.response?.data ?? {})[0]?.[0] ?? 'Erreur'),
  })

  const onSubmit = (data) => {
    const form = new FormData()
    Object.entries(data).forEach(([k, v]) => {
      if (k === 'photo_cnib' || k === 'photo_visage') {
        if (v?.[0]) form.append(k, v[0])
      } else if (v !== undefined && v !== null) {
        form.append(k, v)
      }
    })
    if (profil) updateMut.mutate(form)
    else createMut.mutate(form)
  }

  if (isLoading) {
    return <DashboardLayout><LoadingSpinner className="py-32" size="xl" /></DashboardLayout>
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: 'Tableau de bord', to: '/vendeur' }, { label: 'Ma boutique' }]} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ma boutique</h1>
          <p className="text-gray-500 mt-1">
            {profil ? 'Gérez les informations de votre boutique' : 'Créez votre boutique pour commencer à vendre'}
          </p>
        </div>

        {profil && <StatutBanner profil={profil} />}

        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Store className="h-5 w-5 text-primary-500" />
            <h2 className="font-semibold text-gray-800">Informations générales</h2>
          </div>

          <div>
            <label className="label">Nom de la boutique *</label>
            <input className={`input ${errors.nom_boutique ? 'border-red-400' : ''}`}
              defaultValue={profil?.nom_boutique}
              placeholder="Ex: Chez Fatou" {...register('nom_boutique', { required: 'Requis' })} />
            {errors.nom_boutique && <p className="form-error">{errors.nom_boutique.message}</p>}
          </div>

          <div>
            <label className="label">Description de l'activité</label>
            <textarea rows={3} className="input resize-none" defaultValue={profil?.description}
              placeholder="Décrivez votre activité…" {...register('description')} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Catégorie de produits *</label>
              <select className="input" defaultValue={profil?.categorie_principale} {...register('categorie_principale', { required: true })}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Mode de livraison</label>
              <select className="input" defaultValue={profil?.mode_livraison} {...register('mode_livraison')}>
                <option value="LIVREUR">Fait appel à un livreur</option>
                <option value="SOI_MEME">Je livre moi-même</option>
              </select>
            </div>
          </div>

          {!estExterieur && (
            <div>
              <label className="label">Emplacement sur le campus *</label>
              <select className={`input ${errors.emplacement ? 'border-red-400' : ''}`}
                defaultValue={profil?.emplacement} {...register('emplacement', { required: 'Requis' })}>
                <option value="">Choisir un emplacement</option>
                {secteurs.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
              {errors.emplacement && <p className="form-error">{errors.emplacement.message}</p>}
            </div>
          )}

          {estExterieur && (
            <>
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <Building2 className="h-4 w-4 text-primary-500" />
                <h2 className="font-semibold text-gray-800 text-sm">Commerce extérieur</h2>
              </div>
              <div>
                <label className="label">Université desservie *</label>
                <select className="input" defaultValue={profil?.universite} {...register('universite')}>
                  <option value="">Choisir</option>
                  {universites.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Adresse du commerce *</label>
                <input className="input" defaultValue={profil?.adresse_commerce}
                  placeholder="Adresse complète" {...register('adresse_commerce', { required: estExterieur })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label flex items-center gap-1"><Upload className="h-3.5 w-3.5" /> Photo CNIB</label>
                  <input type="file" accept="image/*" className="input text-xs" {...register('photo_cnib')} />
                </div>
                <div>
                  <label className="label flex items-center gap-1"><Upload className="h-3.5 w-3.5" /> Photo du visage</label>
                  <input type="file" accept="image/*" capture="user" className="input text-xs" {...register('photo_visage')} />
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-2">
                Requis pour la validation d'un commerce extérieur au campus (§3.3).
              </p>
            </>
          )}

          <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="btn-primary w-full btn-lg">
            {createMut.isPending || updateMut.isPending
              ? 'Enregistrement…'
              : profil ? 'Mettre à jour ma boutique' : 'Créer ma boutique'}
          </button>
        </form>

        <Link to="/vendeur/compte" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 justify-center">
          <Settings className="h-4 w-4" /> Paramètres du compte
        </Link>
      </div>
    </DashboardLayout>
  )
}
