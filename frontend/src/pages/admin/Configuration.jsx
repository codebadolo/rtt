import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Settings, Truck, CreditCard, Save } from 'lucide-react'
import { useEffect } from 'react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import { configApi } from '../../api/admin'

function Section({ icon: Icon, title, color, children }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className={`flex items-center gap-3 px-6 py-4 border-b border-gray-100 ${color}`}>
        <Icon className="h-5 w-5" />
        <h2 className="font-semibold text-base">{title}</h2>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  )
}

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
  } = useForm()

  useEffect(() => {
    if (config) {
      reset({
        frais_livraison_actif: config.frais_livraison_actif,
        frais_livraison_montant: config.frais_livraison_montant,
        frais_livraison_type: config.frais_livraison_type,
        frais_orange: config.frais_orange,
        frais_moov: config.frais_moov,
        frais_sank: config.frais_sank,
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

  const livraisonActif = watch('frais_livraison_actif')
  const livraisonType = watch('frais_livraison_type')

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
                Définissez les frais de livraison et de paiement
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

          {/* Frais de livraison */}
          <Section icon={Truck} title="Frais de livraison" color="text-orange-600">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="livraison_actif"
                className="w-4 h-4 accent-primary-500"
                {...register('frais_livraison_actif')}
              />
              <label htmlFor="livraison_actif" className="text-sm text-gray-700 font-medium">
                Activer les frais de livraison
              </label>
            </div>

            {livraisonActif && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="label">Type de frais</label>
                  <select className="input" {...register('frais_livraison_type')}>
                    <option value="FIXE">Montant fixe (FCFA)</option>
                    <option value="POURCENTAGE">Pourcentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="label">
                    {livraisonType === 'FIXE' ? 'Montant (FCFA)' : 'Taux (%)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={livraisonType === 'FIXE' ? '1' : '0.01'}
                    className={`input ${errors.frais_livraison_montant ? 'border-red-400' : ''}`}
                    placeholder={livraisonType === 'FIXE' ? 'ex: 100' : 'ex: 5'}
                    {...register('frais_livraison_montant', { required: 'Requis', min: 0 })}
                  />
                  {errors.frais_livraison_montant && (
                    <p className="form-error">{errors.frais_livraison_montant.message}</p>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400">
              {livraisonActif
                ? livraisonType === 'FIXE'
                  ? `Un montant fixe sera ajouté à chaque commande.`
                  : `Un pourcentage du sous-total produits sera appliqué.`
                : 'Aucun frais de livraison ne sera appliqué.'}
            </p>
          </Section>

          {/* Frais de paiement */}
          <Section icon={CreditCard} title="Frais de paiement par opérateur" color="text-blue-600">
            <p className="text-sm text-gray-500 -mt-2">
              Ces frais sont calculés sur (sous-total + livraison) selon l'opérateur choisi.
            </p>

            {[
              { key: 'frais_orange', label: 'Orange Money', emoji: '🟠' },
              { key: 'frais_moov',   label: 'Moov Money',   emoji: '🟢' },
              { key: 'frais_sank',   label: 'Sank Money',   emoji: '🔵' },
            ].map(({ key, label, emoji }) => (
              <div key={key} className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-36 flex-shrink-0">
                  <span>{emoji}</span>
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className="input w-28"
                    placeholder="0"
                    {...register(key, { min: 0, max: 100 })}
                  />
                  <span className="text-sm text-gray-500 font-medium">%</span>
                </div>
              </div>
            ))}
          </Section>

          {/* Preview */}
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="h-4 w-4 text-orange-500" />
              <p className="text-sm font-semibold text-orange-700">Exemple de calcul</p>
            </div>
            <ExampleCalc config={watch()} />
          </div>
        </div>
      </form>
    </DashboardLayout>
  )
}

function ExampleCalc({ config }) {
  const exemple = 1000
  let fraisLivraison = 0
  if (config.frais_livraison_actif && parseFloat(config.frais_livraison_montant) > 0) {
    if (config.frais_livraison_type === 'FIXE') {
      fraisLivraison = parseFloat(config.frais_livraison_montant)
    } else {
      fraisLivraison = Math.round(exemple * parseFloat(config.frais_livraison_montant) / 100)
    }
  }
  const base = exemple + fraisLivraison
  const tauxOrange = parseFloat(config.frais_orange || 0)
  const fraisPaiement = Math.round(base * tauxOrange / 100)
  const total = exemple + fraisLivraison + fraisPaiement

  return (
    <div className="text-sm space-y-1">
      <div className="flex justify-between text-gray-600">
        <span>Sous-total produits</span>
        <span>{exemple.toLocaleString('fr-FR')} FCFA</span>
      </div>
      <div className="flex justify-between text-gray-600">
        <span>Frais de livraison</span>
        <span>+ {fraisLivraison.toLocaleString('fr-FR')} FCFA</span>
      </div>
      <div className="flex justify-between text-gray-600">
        <span>Frais Orange Money ({tauxOrange}%)</span>
        <span>+ {fraisPaiement.toLocaleString('fr-FR')} FCFA</span>
      </div>
      <div className="flex justify-between font-bold text-gray-800 pt-1 border-t border-orange-200">
        <span>Total facturé</span>
        <span className="text-primary-600">{total.toLocaleString('fr-FR')} FCFA</span>
      </div>
    </div>
  )
}
