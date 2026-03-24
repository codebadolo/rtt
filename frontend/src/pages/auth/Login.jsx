import { useForm } from 'react-hook-form'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useGoogleLogin } from '@react-oauth/google'
import AuthLayout from '../../layouts/AuthLayout'
import useAuthStore from '../../stores/authStore'

const ROLE_REDIRECTS = {
  ETUDIANT:     '/etudiant',
  ADMIN:        '/admin',
  CHEF_SECTEUR: '/chef',
  LIVREUR:      '/livreur',
}

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { login, loginWithGoogle } = useAuthStore()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm()

  const from = location.state?.from?.pathname

  const onSubmit = async (data) => {
    try {
      const user = await login({ email: data.email, password: data.password })
      toast.success(`Bienvenue, ${user.prenom ?? user.nom_complet} !`)
      navigate(from ?? ROLE_REDIRECTS[user.role] ?? '/', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.detail
        ?? err.response?.data?.non_field_errors?.[0]
        ?? 'Identifiants incorrects'
      toast.error(msg)
    }
  }

  // useGoogleLogin donne accès au token via la réponse "credential"
  const handleGoogleSuccess = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      // tokenResponse.access_token pour le flux implicite
      // On utilise id_token via credential — ici on reçoit access_token
      // On doit récupérer l'id_token via userinfo ou utiliser le credential
      setGoogleLoading(true)
      try {
        // Récupérer le id_token depuis Google userinfo
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        const userinfo = await res.json()
        // userinfo contient sub, email, name, picture...
        // On envoie l'access_token comme token d'identification
        const result = await loginWithGoogle(tokenResponse.access_token)

        if (result.action === 'register') {
          // Compte inexistant → rediriger vers inscription avec données pré-remplies
          navigate('/inscription', {
            state: { googleProfile: { ...result.profile, ...userinfo, token: tokenResponse.access_token } },
          })
        } else {
          toast.success(`Bienvenue, ${result.user.nom_complet} !`)
          navigate(from ?? ROLE_REDIRECTS[result.user.role] ?? '/', { replace: true })
        }
      } catch (err) {
        const msg = err.response?.data?.error ?? 'Connexion Google échouée'
        toast.error(msg)
      } finally {
        setGoogleLoading(false)
      }
    },
    onError: () => {
      toast.error('Connexion Google annulée ou échouée')
    },
  })

  return (
    <AuthLayout>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Connexion</h2>
      <p className="text-gray-500 text-sm mb-6">Connectez-vous à votre compte</p>

      {/* Bouton Google */}
      <button
        type="button"
        onClick={() => handleGoogleSuccess()}
        disabled={googleLoading || !import.meta.env.VITE_GOOGLE_CLIENT_ID}
        className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-4 disabled:opacity-60"
      >
        {googleLoading ? (
          <span className="h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        ) : (
          <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        Continuer avec Google
      </button>

      {/* Séparateur */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">ou</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

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
          {errors.email && <p className="form-error">{errors.email.message}</p>}
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
          {errors.password && <p className="form-error">{errors.password.message}</p>}
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
