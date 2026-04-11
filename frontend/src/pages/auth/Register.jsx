import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ShoppingBag, Mail, Lock, User, Phone, CreditCard, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { useGoogleLogin } from '@react-oauth/google'
import useAuthStore from '../../stores/authStore'
import { authApi } from '../../api/auth'
import { setStoredToken } from '../../api/client'

const ROLE_REDIRECTS = {
  ETUDIANT: '/etudiant',
}

export default function Register() {
  const [showPassword, setShowPassword] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleProfile, setGoogleProfile] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser, loginWithGoogle } = useAuthStore()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { role: 'ETUDIANT' } })

  // Pré-remplir si on arrive depuis Login avec un profil Google
  useEffect(() => {
    if (location.state?.googleProfile) {
      const p = location.state.googleProfile
      setGoogleProfile(p)
      if (p.prenom || p.given_name) setValue('prenom', p.prenom ?? p.given_name ?? '')
      if (p.nom || p.family_name) setValue('nom', p.nom ?? p.family_name ?? '')
      if (p.email) setValue('email', p.email)
    }
  }, [location.state, setValue])

  const onSubmit = async (data) => {
    try {
      let res
      if (googleProfile?.token) {
        // Inscription via Google (token déjà vérifié)
        res = await authApi.registerWithGoogle({
          token: googleProfile.token,
          nom: data.nom,
          prenom: data.prenom,
          telephone: data.telephone,
          role: 'ETUDIANT',
          matricule: data.matricule,
        })
      } else {
        res = await authApi.register({
          email: data.email,
          password: data.password,
          nom: data.nom,
          prenom: data.prenom,
          telephone: data.telephone,
          role: 'ETUDIANT',
          matricule: data.matricule,
        })
      }
      setStoredToken(res.token)
      setUser({ id: res.user_id, email: res.email, nom_complet: res.nom_complet, role: res.role })
      toast.success('Compte créé avec succès ! Bienvenue 🎉')
      navigate(ROLE_REDIRECTS[res.role] ?? '/')
    } catch (err) {
      const d = err.response?.data
      const msg = typeof d === 'string'
        ? d
        : d?.email?.[0] ?? d?.non_field_errors?.[0] ?? d?.detail ?? 'Erreur lors de l\'inscription'
      toast.error(msg)
    }
  }

  const handleGoogleSignup = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true)
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        const userinfo = await res.json()

        // Vérifier si le compte existe déjà
        const result = await loginWithGoogle(tokenResponse.access_token)
        if (result.action === 'login') {
          toast.success(`Bienvenue, ${result.user.nom_complet} !`)
          navigate(ROLE_REDIRECTS[result.user.role] ?? '/')
          return
        }

        // Compte inexistant → pré-remplir
        const profile = { ...result.profile, ...userinfo, token: tokenResponse.access_token }
        setGoogleProfile(profile)
        setValue('prenom', profile.prenom ?? profile.given_name ?? '')
        setValue('nom', profile.nom ?? profile.family_name ?? '')
        setValue('email', profile.email ?? '')
        toast.success('Profil Google récupéré. Complétez votre inscription.')
      } catch (err) {
        toast.error('Erreur lors de la connexion Google')
      } finally {
        setGoogleLoading(false)
      }
    },
    onError: () => toast.error('Connexion Google annulée'),
  })

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
            <p className="text-gray-400 text-sm mb-6">Rejoignez Ritoto Campus gratuitement</p>

            {/* Bouton Google */}
            {!googleProfile && (
              <>
                <button
                  type="button"
                  onClick={() => handleGoogleSignup()}
                  disabled={googleLoading}
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
                  S'inscrire avec Google
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">ou</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              </>
            )}

            {/* Badge Google connecté */}
            {googleProfile && (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
                {googleProfile.picture && (
                  <img src={googleProfile.picture} alt="" className="w-8 h-8 rounded-full" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800 truncate">{googleProfile.email}</p>
                  <p className="text-xs text-green-600">Compte Google lié</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGoogleProfile(null)
                    setValue('prenom', '')
                    setValue('nom', '')
                    setValue('email', '')
                  }}
                  className="text-xs text-green-700 hover:text-green-900 underline flex-shrink-0"
                >
                  Changer
                </button>
              </div>
            )}

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
                        errors.prenom ? 'border-red-400' : 'border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
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

              {/* Email — masqué si Google */}
              {!googleProfile && (
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
              )}

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

              {/* Password — masqué si Google */}
              {!googleProfile && (
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
                        required: !googleProfile ? 'Mot de passe requis' : false,
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
              )}

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
