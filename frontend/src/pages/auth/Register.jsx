import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ShoppingBag, Mail, Lock, User, Phone, CreditCard, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import useAuthStore from '../../stores/authStore'
import { authApi } from '../../api/auth'
import { setStoredToken } from '../../api/client'

const ROLE_REDIRECTS = {
  ETUDIANT: '/etudiant',
}

export default function Register() {
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { role: 'ETUDIANT' } })

  const onSubmit = async (data) => {
    try {
      const res = await authApi.register({
        email: data.email,
        password: data.password,
        nom: data.nom,
        prenom: data.prenom,
        telephone: data.telephone,
        role: data.role,
        ...(data.role === 'ETUDIANT' ? { matricule: data.matricule } : {}),
      })
      setStoredToken(res.token)
      setUser({
        id: res.user_id,
        email: res.email,
        nom_complet: res.nom_complet,
        role: res.role,
        statut_kyc: res.statut_kyc,
      })
      toast.success('Compte créé avec succès ! Bienvenue 🎉')
      navigate(ROLE_REDIRECTS[res.role] ?? '/')
    } catch (err) {
      const data = err.response?.data
      const msg = typeof data === 'string'
        ? data
        : data?.email?.[0] ?? data?.non_field_errors?.[0] ?? data?.detail ?? 'Erreur lors de l\'inscription'
      toast.error(msg)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Accueil</span>
        </Link>
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-amber-400 rounded-lg flex items-center justify-center">
            <ShoppingBag className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-gray-900">Ritoto <span className="text-orange-500">Express</span></span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
            <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Créer un compte</h1>
            <p className="text-gray-400 text-sm mb-6">Rejoignez Ritoto Express gratuitement</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <input type="hidden" value="ETUDIANT" {...register('role')} />

              {/* Names */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Prénom</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      placeholder="Jean"
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                        errors.prenom ? 'border-red-400 focus:ring-red-200' : 'border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
                      }`}
                      {...register('prenom', { required: 'Prénom requis' })}
                    />
                  </div>
                  {errors.prenom && <p className="text-red-500 text-xs mt-1">{errors.prenom.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      placeholder="Koffi"
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                        errors.nom ? 'border-red-400' : 'border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
                      }`}
                      {...register('nom', { required: 'Nom requis' })}
                    />
                  </div>
                  {errors.nom && <p className="text-red-500 text-xs mt-1">{errors.nom.message}</p>}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    placeholder="jean@exemple.com"
                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                      errors.email ? 'border-red-400' : 'border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
                    }`}
                    {...register('email', {
                      required: 'Email requis',
                      pattern: { value: /\S+@\S+\.\S+/, message: 'Email invalide' },
                    })}
                  />
                </div>
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              {/* Telephone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="07 XX XX XX XX"
                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                      errors.telephone ? 'border-red-400' : 'border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
                    }`}
                    {...register('telephone', { required: 'Téléphone requis' })}
                  />
                </div>
                {errors.telephone && <p className="text-red-500 text-xs mt-1">{errors.telephone.message}</p>}
              </div>

              {/* Matricule */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Matricule étudiant</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    placeholder="ETU-2024-XXXXX"
                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                      errors.matricule ? 'border-red-400' : 'border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
                    }`}
                    {...register('matricule', { required: 'Matricule requis' })}
                  />
                </div>
                {errors.matricule && <p className="text-red-500 text-xs mt-1">{errors.matricule.message}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 caractères"
                    className={`w-full pl-9 pr-10 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                      errors.password ? 'border-red-400' : 'border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
                    }`}
                    {...register('password', {
                      required: 'Mot de passe requis',
                      minLength: { value: 8, message: 'Minimum 8 caractères' },
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>

              {/* Info banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                📋 Après inscription, vous devrez soumettre votre <strong>numéro de carte étudiant</strong> pour vérification KYC avant de pouvoir commander.
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-2xl transition-colors shadow-md shadow-orange-100 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Création du compte…
                  </>
                ) : (
                  'Créer mon compte'
                )}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Déjà un compte ?{' '}
              <Link to="/connexion" className="text-orange-500 font-semibold hover:text-orange-600">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
