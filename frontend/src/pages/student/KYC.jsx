import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Clock, CheckCircle, XCircle, FileCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import useAuthStore from '../../stores/authStore'
import { kycApi } from '../../api/kyc'

export default function StudentKYC() {
  const user = useAuthStore((s) => s.user)
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const queryClient = useQueryClient()

  const { data: kycData, isLoading } = useQuery({
    queryKey: ['my-kyc'],
    queryFn: () => kycApi.list({ utilisateur: user?.id }),
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm()

  const submitMutation = useMutation({
    mutationFn: (data) => kycApi.submit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-kyc'] })
      fetchProfile()
      toast.success('KYC soumis avec succès')
      reset()
    },
    onError: (err) => {
      const msg =
        err.response?.data?.detail ??
        Object.values(err.response?.data ?? {})[0]?.[0] ??
        'Erreur lors de la soumission'
      toast.error(msg)
    },
  })

  const myKyc = Array.isArray(kycData) ? kycData[0] : kycData?.results?.[0] ?? null
  const statut = myKyc?.statut_actuel?.code ?? null

  const onSubmit = (data) => {
    submitMutation.mutate({ numero_carte: data.numero_carte })
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <Breadcrumb items={[{ label: 'Accueil', to: '/etudiant' }, { label: 'Vérification KYC' }]} />
        <LoadingSpinner className="py-20" size="lg" />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: 'Accueil', to: '/etudiant' }, { label: 'Vérification KYC' }]} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vérification KYC</h1>
          <p className="text-gray-500 mt-1">
            Vérifiez votre identité pour accéder à toutes les fonctionnalités.
          </p>
        </div>

        {/* Current status */}
        {myKyc && (
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Statut actuel</h2>

            {statut === 'EN_ATTENTE' && (
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                <Clock className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <p className="text-blue-700 text-sm">
                  Votre dossier est en cours de traitement. Vous serez notifié une fois la vérification terminée.
                </p>
              </div>
            )}

            {statut === 'VALIDE' && (
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-green-700 font-medium text-sm">Identité vérifiée !</p>
                  <p className="text-green-600 text-sm mt-0.5">
                    Votre compte est maintenant entièrement vérifié.
                  </p>
                </div>
              </div>
            )}

            {statut === 'REJETE' && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-red-700 font-medium text-sm">Dossier rejeté</p>
                  {myKyc.motif_rejet && (
                    <p className="text-red-600 text-sm mt-0.5">
                      Motif : {myKyc.motif_rejet}
                    </p>
                  )}
                  <p className="text-red-600 text-sm mt-1">
                    Veuillez resoumettre votre dossier ci-dessous.
                  </p>
                </div>
              </div>
            )}

            {myKyc.numero_carte && (
              <p className="text-sm text-gray-500 mt-3">
                Numéro de carte : <span className="font-medium text-gray-700">{myKyc.numero_carte}</span>
              </p>
            )}
          </div>
        )}

        {/* Submission form — only when no KYC or rejected */}
        {(!myKyc || statut === 'REJETE') && (
          <div className="card">
            <div className="flex items-center gap-2 mb-5">
              <FileCheck className="h-5 w-5 text-primary-500" />
              <h2 className="font-semibold text-gray-800">
                {myKyc ? 'Resoumettre le dossier' : 'Soumettre mon dossier'}
              </h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="label">Numéro de carte étudiant *</label>
                <input
                  type="text"
                  placeholder="Ex: ETU-2024-00001"
                  className={`input ${errors.numero_carte ? 'border-red-400' : ''}`}
                  {...register('numero_carte', { required: 'Numéro de carte requis' })}
                />
                {errors.numero_carte && (
                  <p className="form-error">{errors.numero_carte.message}</p>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                Entrez le numéro figurant sur votre carte étudiant. Une fois soumis, votre dossier sera traité par l'administration.
              </div>

              <button
                type="submit"
                disabled={submitMutation.isPending}
                className="btn-primary w-full btn-lg"
              >
                {submitMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Envoi en cours…
                  </span>
                ) : (
                  'Soumettre mon dossier'
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
