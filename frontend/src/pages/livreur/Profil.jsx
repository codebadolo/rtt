import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Power, Store, Upload, CheckCircle, Clock, XCircle, AlertTriangle, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import { profilsApi } from '../../api/orders'

function StatutBanner({ profil }) {
  if (profil.est_valide) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
        <p className="text-sm text-green-700 font-medium">Profil validé — vous pouvez recevoir des missions.</p>
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
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
      <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
      <p className="text-sm text-amber-700 font-medium">Profil en attente de validation par l'administrateur.</p>
    </div>
  )
}

export default function LivreurProfil() {
  const queryClient = useQueryClient()
  const { register, handleSubmit } = useForm()

  const { data: profil, isLoading } = useQuery({
    queryKey: ['mon-profil-livreur'],
    queryFn: () => profilsApi.getLivreur(),
  })

  const toggleMut = useMutation({
    mutationFn: () => profilsApi.basculerService(),
    onSuccess: (data) => {
      queryClient.setQueryData(['mon-profil-livreur'], (old) => old ? { ...old, en_service: data.en_service } : old)
      toast.success(data.en_service ? 'Vous êtes en service' : 'Vous êtes hors service')
    },
    onError: (e) => toast.error(e.response?.data?.error ?? 'Erreur'),
  })

  const kycMut = useMutation({
    mutationFn: (form) => profilsApi.updateLivreur(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mon-profil-livreur'] })
      toast.success('Documents envoyés')
    },
    onError: () => toast.error('Erreur lors de l\'envoi'),
  })

  const onSubmitKyc = (data) => {
    const form = new FormData()
    if (data.photo_cnib?.[0]) form.append('photo_cnib', data.photo_cnib[0])
    if (data.photo_visage?.[0]) form.append('photo_visage', data.photo_visage[0])
    kycMut.mutate(form)
  }

  if (isLoading) return <DashboardLayout><LoadingSpinner className="py-32" size="xl" /></DashboardLayout>

  if (!profil) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto text-center py-20">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Aucun profil livreur</h1>
          <p className="text-gray-500 text-sm">
            Le statut de livreur est activé par un administrateur depuis un compte client existant (§3.4).
            Contactez l'administration si vous pensez qu'il s'agit d'une erreur.
          </p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: 'Tableau de bord', to: '/livreur' }, { label: 'Mon profil' }]} />
        <h1 className="text-2xl font-bold text-gray-900">Mon profil livreur</h1>

        <StatutBanner profil={profil} />

        {/* Interrupteur En service / Hors service */}
        <div className="card flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${profil.en_service ? 'bg-green-100' : 'bg-gray-100'}`}>
              <Power className={`h-5 w-5 ${profil.en_service ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{profil.en_service ? 'En service' : 'Hors service'}</p>
              <p className="text-xs text-gray-400">Basculez selon votre disponibilité réelle (§3.4)</p>
            </div>
          </div>
          <button
            onClick={() => toggleMut.mutate()}
            disabled={!profil.est_valide || toggleMut.isPending}
            className={`relative w-14 h-8 rounded-full transition-colors flex-shrink-0 disabled:opacity-40 ${profil.en_service ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${profil.en_service ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Boutiques attribuées */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Store className="h-5 w-5 text-primary-500" />
            <h2 className="font-semibold text-gray-800">Boutique(s) attribuée(s)</h2>
          </div>
          {profil.boutiques_noms?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profil.boutiques_noms.map((nom) => (
                <span key={nom} className="text-sm bg-orange-50 text-orange-700 px-3 py-1.5 rounded-xl font-medium">{nom}</span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Aucune boutique attribuée pour l'instant — vous êtes "volant" et pouvez couvrir tout le pool de commandes prêtes (§7).
            </p>
          )}
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-900">{profil.note_moyenne != null ? profil.note_moyenne.toFixed(1) : '—'}</p>
            <p className="text-xs text-gray-400 mt-1">Note moyenne (interne)</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-900">{profil.compteur_abandon}</p>
            <p className="text-xs text-gray-400 mt-1">Missions abandonnées</p>
          </div>
        </div>

        {/* KYC */}
        <form onSubmit={handleSubmit(onSubmitKyc)} className="card space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary-500" />
            <h2 className="font-semibold text-gray-800">Documents d'identité (CNIB)</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Photo CNIB</label>
              {profil.photo_cnib && <p className="text-xs text-green-600 mb-1">Document déjà envoyé</p>}
              <input type="file" accept="image/*" className="input text-xs" {...register('photo_cnib')} />
            </div>
            <div>
              <label className="label">Photo du visage</label>
              {profil.photo_visage && <p className="text-xs text-green-600 mb-1">Document déjà envoyé</p>}
              <input type="file" accept="image/*" capture="user" className="input text-xs" {...register('photo_visage')} />
            </div>
          </div>
          <button type="submit" disabled={kycMut.isPending} className="btn-primary w-full">
            {kycMut.isPending ? 'Envoi…' : 'Envoyer les documents'}
          </button>
        </form>

        <Link to="/livreur/compte" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 justify-center">
          <Settings className="h-4 w-4" /> Paramètres du compte
        </Link>
      </div>
    </DashboardLayout>
  )
}
