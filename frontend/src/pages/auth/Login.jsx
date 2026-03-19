import { useForm } from 'react-hook-form'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import AuthLayout from '../../layouts/AuthLayout'
import useAuthStore from '../../stores/authStore'

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (data) => {
    try {
      const user = await login({ email: data.email, password: data.password })
      toast.success(`Bienvenue, ${user.prenom} !`)

      const from = location.state?.from?.pathname
      const redirects = {
        ETUDIANT:     '/etudiant',
        ADMIN:        '/admin',
        CHEF_SECTEUR: '/chef',
        LIVREUR:      '/livreur',
      }
      navigate(from ?? redirects[user.role] ?? '/', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.detail
        ?? err.response?.data?.non_field_errors?.[0]
        ?? 'Identifiants incorrects'
      toast.error(msg)
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Connexion</h2>
      <p className="text-gray-500 text-sm mb-6">Connectez-vous à votre compte</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Adresse email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="email"
              placeholder="vous@exemple.com"
              className={`input pl-10 ${errors.email ? 'border-red-400' : ''}`}
              {...register('email', {
                required: 'Email requis',
                pattern: { value: /\S+@\S+\.\S+/, message: 'Email invalide' },
              })}
            />
          </div>
          {errors.email && (
            <p className="form-error">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="label">Mot de passe</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className={`input pl-10 pr-10 ${errors.password ? 'border-red-400' : ''}`}
              {...register('password', { required: 'Mot de passe requis' })}
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

        <div className="flex justify-end">
          <Link
            to="/mot-de-passe-oublie"
            className="text-sm text-primary-500 hover:text-primary-600 font-medium"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full btn-lg"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Connexion…
            </span>
          ) : (
            'Se connecter'
          )}
        </button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-5">
        Pas encore de compte ?{' '}
        <Link to="/inscription" className="text-orange-500 font-semibold hover:text-orange-600">
          S'inscrire gratuitement
        </Link>
      </p>
    </AuthLayout>
  )
}
