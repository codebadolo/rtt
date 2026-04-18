import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import AuthLayout from '../../layouts/AuthLayout'
import { authApi } from '../../api/auth'

export default function ResetPassword() {
  const [showPassword, setShowPassword] = useState(false)
  const [done, setDone] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (data) => {
    if (!token) {
      toast.error('Token de réinitialisation manquant')
      return
    }
    try {
      await authApi.resetPassword({
        token,
        nouveau_mot_de_passe: data.password,
      })
      setDone(true)
      toast.success('Mot de passe réinitialisé avec succès')
      setTimeout(() => navigate('/connexion'), 3000)
    } catch (err) {
      const d = err.response?.data
      const msg = typeof d === 'string'
        ? d
        : d?.detail
          ?? d?.nouveau_mot_de_passe?.[0]
          ?? d?.non_field_errors?.[0]
          ?? d?.[0]
          ?? 'Lien invalide ou expiré'
      toast.error(msg)
    }
  }

  return (
    <AuthLayout>
      {done ? (
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-7 w-7 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Mot de passe modifié !</h2>
          <p className="text-gray-500 text-sm">
            Vous allez être redirigé vers la page de connexion…
          </p>
          <Link to="/connexion" className="btn-primary mt-6 inline-flex">
            Se connecter
          </Link>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">
            Nouveau mot de passe
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Choisissez un nouveau mot de passe sécurisé.
          </p>

          {!token && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-600 text-sm">
              Token de réinitialisation manquant. Veuillez utiliser le lien reçu par email.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Nouveau mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={`input pl-10 pr-10 ${errors.password ? 'border-red-400' : ''}`}
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
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="form-error">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="label">Confirmer le mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={`input pl-10 ${errors.confirmPassword ? 'border-red-400' : ''}`}
                  {...register('confirmPassword', {
                    required: 'Confirmation requise',
                    validate: (val) =>
                      val === watch('password') || 'Les mots de passe ne correspondent pas',
                  })}
                />
              </div>
              {errors.confirmPassword && (
                <p className="form-error">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !token}
              className="btn-primary w-full btn-lg"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Réinitialisation…
                </span>
              ) : (
                'Réinitialiser le mot de passe'
              )}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
