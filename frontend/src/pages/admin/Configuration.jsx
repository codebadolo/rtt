import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Settings, Percent, Save, Clock } from 'lucide-react'
import { useEffect } from 'react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import { configApi } from '../../api/admin'

export default function AdminConfiguration() {
  const queryClient = useQueryClient()

  const { data: config, isLoading } = useQuery({
    queryKey: ['configuration'],
    queryFn: () => configApi.get(),
  })

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm({ defaultValues: { taux_service: 10 } })

  useEffect(() => {
    if (config) {
      reset({
        taux_service: config.taux_service,
        commandes_actives: config.commandes_actives,
        heure_ouverture: config.heure_ouverture ?? '',
        heure_fermeture: config.heure_fermeture ?? '',
        horaires_actifs: config.horaires_actifs ?? true,
      })
    }
  }, [config, reset])

  const mutation = useMutation({
    mutationFn: (data) => configApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuration'] })
      toast.success('Configuration sauvegardée')
    },
    onError: () => toast.error('Erreur lors de la sauvegarde'),
  })

  const taux = parseFloat(watch('taux_service') || 0)
  const horairesActifs = watch('horaires_actifs')
  const exemple = 1000
  const fraisService = Math.round(exemple * taux / 100)

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
        <div className="space-y-6 max-w-2xl">
          <Breadcrumb
            items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Configuration' }]}
          />

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Configuration tarifaire</h1>
              <p className="text-gray-500 mt-1">
                Définissez le taux de frais de service appliqué aux commandes
              </p>
            </div>
            <button
              type="submit"
              disabled={mutation.isPending || !isDirty}
              className="btn-primary"
            >
              <Save className="h-4 w-4" />
              {mutation.isPending ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </div>

          {/* Frais de service */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 text-primary-600">
              <Percent className="h-5 w-5" />
              <h2 className="font-semibold text-base">Frais de service</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">
                Ce pourcentage est appliqué sur le sous-total produits de chaque commande.
                Il couvre les frais de livraison et de transaction mobile. Les clients voient
                uniquement <strong>«&nbsp;Frais de service&nbsp;»</strong>.
              </p>

              <div className="flex items-center gap-4">
                <div className="flex-1 max-w-xs">
                  <label className="label">Taux de frais de service</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="0.5"
                      className={`input w-28 ${errors.taux_service ? 'border-red-400' : ''}`}
                      placeholder="10"
                      {...register('taux_service', {
                        required: 'Requis',
                        min: { value: 0, message: 'Minimum 0%' },
                        max: { value: 50, message: 'Maximum 50%' },
                      })}
                    />
                    <span className="text-sm text-gray-500 font-medium">%</span>
                  </div>
                  {errors.taux_service && (
                    <p className="form-error">{errors.taux_service.message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Horaires d'ouverture */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 text-primary-600">
              <Clock className="h-5 w-5" />
              <h2 className="font-semibold text-base">Horaires d'ouverture</h2>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Accepter les commandes</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Désactivez pour bloquer immédiatement toutes les commandes
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    {...register('commandes_actives')}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:bg-primary-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Appliquer les horaires</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Désactivez pour ignorer les horaires sans les supprimer
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    {...register('horaires_actifs')}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:bg-primary-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
                </label>
              </div>

              <p className="text-sm text-gray-500">
                Définissez une plage horaire pendant laquelle les commandes sont acceptées.
                En dehors de cette plage, les commandes seront automatiquement bloquées.
                Laissez les deux champs vides pour ne pas appliquer de restriction horaire.
              </p>

              <div className={`grid grid-cols-2 gap-4 transition-opacity ${horairesActifs ? '' : 'opacity-40 pointer-events-none'}`}>
                <div>
                  <label className="label">Heure d'ouverture</label>
                  <input
                    type="time"
                    className="input"
                    {...register('heure_ouverture')}
                  />
                </div>
                <div>
                  <label className="label">Heure de fermeture</label>
                  <input
                    type="time"
                    className="input"
                    {...register('heure_fermeture')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="h-4 w-4 text-orange-500" />
              <p className="text-sm font-semibold text-orange-700">Exemple de calcul pour 1 000 FCFA de produits</p>
            </div>
            <div className="text-sm space-y-1">
              <div className="flex justify-between text-gray-600">
                <span>Sous-total produits</span>
                <span>{exemple.toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Frais de service ({taux}%)</span>
                <span>+ {fraisService.toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div className="flex justify-between font-bold text-gray-800 pt-1 border-t border-orange-200">
                <span>Total facturé au client</span>
                <span className="text-primary-600">{(exemple + fraisService).toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </DashboardLayout>
  )
}
