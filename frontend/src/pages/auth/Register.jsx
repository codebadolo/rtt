import { ArrowLeft, ArrowRight, Building2, CheckCircle, Eye, EyeOff, Lock, Mail, MapPin, Phone, ShoppingBag, Store, Truck, User, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { authApi, universitesApi } from '../../api/auth'
import { setStoredToken } from '../../api/client'
import useAuthStore from '../../stores/authStore'

const ROLE_OPTIONS = [
  {
    value: 'ETUDIANT',
    label: 'Client étudiant',
    desc: 'Commander des repas et produits',
    icon: Users,
    color: 'blue',
  },
  {
    value: 'LIVREUR',
    label: 'Livreur',
    desc: 'Livrer les commandes sur le campus',
    icon: Truck,
    color: 'orange',
  },
  {
    value: 'VENDEUR_INTERIEUR',
    label: 'Vendeur intérieur',
    desc: 'Vendre depuis votre stand sur le campus',
    icon: Store,
    color: 'green',
  },
  {
    value: 'VENDEUR_EXTERIEUR',
    label: 'Vendeur extérieur',
    desc: 'Vendre depuis votre commerce extérieur',
    icon: ShoppingBag,
    color: 'purple',
  },
]

const COLOR_CLASSES = {
  blue:   { ring: 'ring-blue-500 border-blue-500 bg-blue-50', icon: 'bg-blue-100 text-blue-600', dot: 'bg-blue-500' },
  orange: { ring: 'ring-orange-500 border-orange-500 bg-orange-50', icon: 'bg-orange-100 text-orange-600', dot: 'bg-orange-500' },
  green:  { ring: 'ring-green-500 border-green-500 bg-green-50', icon: 'bg-green-100 text-green-600', dot: 'bg-green-500' },
  purple: { ring: 'ring-purple-500 border-purple-500 bg-purple-50', icon: 'bg-purple-100 text-purple-600', dot: 'bg-purple-500' },
}

const ROLE_REDIRECTS = {
  ETUDIANT:          '/etudiant',
  LIVREUR:           '/livreur',
  VENDEUR_INTERIEUR: '/vendeur',
  VENDEUR_EXTERIEUR: '/vendeur',
}

const NIVEAUX = ['Licence 1', 'Licence 2', 'Licence 3', 'Master 1', 'Master 2', 'Doctorat', 'BTS', 'DUT', 'Autre']

export default function Register() {
  const [step, setStep] = useState(1) // 1=rôle, 2=infos communes, 3=infos spécifiques
  const [selectedRole, setSelectedRole] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [universites, setUniversites] = useState([])
  const navigate = useNavigate()
  const { setUser } = useAuthStore()

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm()

  useEffect(() => {
    universitesApi.list()
      .then((data) => setUniversites(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => {})
  }, [])

  const onSubmit = async (data) => {
    try {
      const payload = {
        email: data.email,
        password: data.password,
        nom: data.nom,
        prenom: data.prenom,
        telephone: data.telephone,
        role: selectedRole,
        universite: data.universite || undefined,
        filiere: data.filiere || undefined,
        niveau_etude: data.niveau_etude || undefined,
      }
      const res = await authApi.register(payload)
      setStoredToken(res.token)
      setUser({ id: res.user_id, email: res.email, nom_complet: res.nom_complet, role: res.role })
      toast.success('Compte créé avec succès ! Bienvenue 🎉')
      navigate(ROLE_REDIRECTS[res.role] ?? '/')
    } catch (err) {
      const d = err.response?.data
      const msg = typeof d === 'string'
        ? d
        : d?.email?.[0] ?? d?.telephone?.[0] ?? d?.non_field_errors?.[0] ?? d?.detail ?? "Erreur lors de l'inscription"
      toast.error(msg)
    }
  }

  const roleInfo = ROLE_OPTIONS.find((r) => r.value === selectedRole)

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
          <span className="font-bold text-gray-900">Ritoto <span className="text-orange-500">Campus</span></span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">

          {/* Stepper */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  s < step ? 'bg-orange-500 text-white' :
                  s === step ? 'bg-orange-500 text-white ring-4 ring-orange-100' :
                  'bg-gray-200 text-gray-400'
                }`}>
                  {s < step ? <CheckCircle className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <div className={`w-12 h-0.5 transition-all ${s < step ? 'bg-orange-500' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">

            {/* ── ÉTAPE 1 : Choix du rôle ── */}
            {step === 1 && (
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Je suis…</h1>
                <p className="text-gray-400 text-sm mb-6">Choisissez votre type de compte</p>
                <div className="grid grid-cols-1 gap-3">
                  {ROLE_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    const c = COLOR_CLASSES[opt.color]
                    const selected = selectedRole === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSelectedRole(opt.value)}
                        className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                          selected ? `${c.ring} ring-2` : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className={`p-2.5 rounded-xl flex-shrink-0 ${c.icon}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">{opt.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all ${
                          selected ? `${c.dot} border-transparent` : 'border-gray-300'
                        }`} />
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => selectedRole && setStep(2)}
                  disabled={!selectedRole}
                  className="w-full mt-6 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
                >
                  Continuer <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ── ÉTAPE 2 : Infos communes ── */}
            {step === 2 && (
              <form onSubmit={handleSubmit(() => setStep(3))}>
                <div className="flex items-center gap-3 mb-5">
                  <button type="button" onClick={() => setStep(1)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h1 className="text-xl font-extrabold text-gray-900">Informations personnelles</h1>
                    <p className="text-gray-400 text-xs mt-0.5">{roleInfo?.label}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Prénom" error={errors.prenom}>
                      <InputIcon icon={User} placeholder="Jean" {...register('prenom', { required: 'Requis' })} error={errors.prenom} />
                    </Field>
                    <Field label="Nom" error={errors.nom}>
                      <InputIcon icon={User} placeholder="Koffi" {...register('nom', { required: 'Requis' })} error={errors.nom} />
                    </Field>
                  </div>

                  <Field label="Adresse email" error={errors.email}>
                    <InputIcon icon={Mail} type="email" placeholder="jean@exemple.com"
                      {...register('email', { required: 'Requis', pattern: { value: /\S+@\S+\.\S+/, message: 'Email invalide' } })}
                      error={errors.email}
                    />
                  </Field>

                  <Field label="Téléphone" error={errors.telephone}>
                    <InputIcon icon={Phone} type="tel" placeholder="07 XX XX XX XX"
                      {...register('telephone', { required: 'Requis' })}
                      error={errors.telephone}
                    />
                  </Field>

                  <Field label="Université" error={errors.universite}>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select
                        className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none bg-white transition-colors ${
                          errors.universite ? 'border-red-400' : 'border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
                        }`}
                        {...register('universite', { required: 'Veuillez choisir une université' })}
                      >
                        <option value="">Choisir votre université</option>
                        {universites.map((u) => (
                          <option key={u.id} value={u.id}>{u.nom}</option>
                        ))}
                      </select>
                    </div>
                  </Field>

                  <Field label="Mot de passe" error={errors.password}>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min. 8 caractères"
                        className={`w-full pl-9 pr-10 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                          errors.password ? 'border-red-400' : 'border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
                        }`}
                        {...register('password', {
                          required: 'Requis',
                          minLength: { value: 8, message: 'Minimum 8 caractères' },
                        })}
                      />
                      <button type="button" onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                </div>

                <button type="submit"
                  className="w-full mt-6 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2">
                  Continuer <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* ── ÉTAPE 3 : Infos spécifiques au rôle ── */}
            {step === 3 && (
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="flex items-center gap-3 mb-5">
                  <button type="button" onClick={() => setStep(2)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h1 className="text-xl font-extrabold text-gray-900">
                      {selectedRole === 'ETUDIANT' && 'Informations académiques'}
                      {(selectedRole === 'VENDEUR_INTERIEUR' || selectedRole === 'VENDEUR_EXTERIEUR') && 'Informations boutique'}
                      {selectedRole === 'LIVREUR' && 'Informations livreur'}
                    </h1>
                    <p className="text-gray-400 text-xs mt-0.5">Dernière étape</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Étudiant */}
                  {selectedRole === 'ETUDIANT' && (
                    <>
                      <Field label="Filière" error={errors.filiere}>
                        <InputIcon icon={Building2} placeholder="Ex: Informatique, Gestion..."
                          {...register('filiere')} error={errors.filiere} />
                      </Field>
                      <Field label="Niveau d'étude" error={errors.niveau_etude}>
                        <div className="relative">
                          <select
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                            {...register('niveau_etude')}
                          >
                            <option value="">Choisir votre niveau</option>
                            {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                      </Field>
                      <div className="p-4 bg-blue-50 rounded-xl text-sm text-blue-700">
                        <p className="font-semibold mb-1">Compte créé immédiatement</p>
                        <p className="text-xs text-blue-600">Vous pouvez commander dès la création de votre compte.</p>
                      </div>
                    </>
                  )}

                  {/* Vendeur */}
                  {(selectedRole === 'VENDEUR_INTERIEUR' || selectedRole === 'VENDEUR_EXTERIEUR') && (
                    <>
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                        <p className="font-semibold mb-1">Validation requise</p>
                        <p className="text-xs text-amber-600">Votre compte sera activé après vérification par un administrateur universitaire.</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Vous pourrez compléter les informations de votre boutique (nom, photos, produits) depuis votre tableau de bord.
                      </p>
                    </>
                  )}

                  {/* Livreur */}
                  {selectedRole === 'LIVREUR' && (
                    <>
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                        <p className="font-semibold mb-1">Validation requise</p>
                        <p className="text-xs text-amber-600">Votre compte doit être validé par un administrateur universitaire. Vous devrez fournir une photo de votre CNIB et une photo de votre visage.</p>
                      </div>
                      <p className="text-xs text-gray-400">
                        Vous pourrez uploader vos documents KYC depuis votre tableau de bord après inscription.
                      </p>
                    </>
                  )}
                </div>

                <button type="submit" disabled={isSubmitting}
                  className="w-full mt-6 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2">
                  {isSubmitting ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Création…</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> Créer mon compte</>
                  )}
                </button>
              </form>
            )}

            <p className="text-center text-sm text-gray-500 mt-5">
              Déjà un compte ?{' '}
              <Link to="/connexion" className="text-orange-500 font-semibold hover:text-orange-600">Se connecter</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
    </div>
  )
}

function InputIcon({ icon: Icon, error, className = '', ...props }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
          error ? 'border-red-400' : 'border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
        } ${className}`}
        {...props}
      />
    </div>
  )
}
