import { Eye, EyeOff, Lock, Save, ShieldCheck, User } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { authApi } from '../../api/auth'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import useAuthStore from '../../stores/authStore'

function ProfileSection({ user, onUpdate }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      prenom: user?.prenom ?? '',
      nom: user?.nom ?? '',
      jour_naissance: user?.jour_naissance ? String(user.jour_naissance) : '',
      mois_naissance: user?.mois_naissance ? String(user.mois_naissance) : '',
    },
  })
  const compteTelephone = user?.email?.endsWith('@tel.ritoto-campus.local')

  const onSubmit = async (data) => {
    try {
      await onUpdate({
        prenom: data.prenom,
        nom: data.nom,
        jour_naissance: data.jour_naissance ? Number(data.jour_naissance) : null,
        mois_naissance: data.mois_naissance ? Number(data.mois_naissance) : null,
      })
      toast.success('Profil mis à jour')
    } catch (err) {
      const d = err.response?.data
      const v = d?.detail ?? d?.jour_naissance ?? d?.mois_naissance
      toast.error((Array.isArray(v) ? v[0] : v) ?? 'Erreur lors de la mise à jour')
    }
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2.5 bg-primary-100 rounded-xl">
          <User className="h-5 w-5 text-primary-500" />
        </div>
        <h2 className="font-semibold text-gray-800">Informations personnelles</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Prénom</label>
            <input
              type="text"
              className={`input ${errors.prenom ? 'border-red-400' : ''}`}
              {...register('prenom', { required: 'Prénom requis' })}
            />
            {errors.prenom && <p className="form-error">{errors.prenom.message}</p>}
          </div>
          <div>
            <label className="label">Nom</label>
            <input
              type="text"
              className={`input ${errors.nom ? 'border-red-400' : ''}`}
              {...register('nom', { required: 'Nom requis' })}
            />
            {errors.nom && <p className="form-error">{errors.nom.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Jour de naissance</label>
            <select className="input" {...register('jour_naissance')}>
              <option value="">—</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Mois de naissance</label>
            <select className="input" {...register('mois_naissance')}>
              <option value="">—</option>
              {['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
                .map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>

        {!compteTelephone && (
          <div>
            <label className="label">Adresse email</label>
            <input type="email" className="input bg-gray-50" value={user?.email ?? ''} readOnly />
          </div>
        )}

        <div>
          <label className="label">Téléphone</label>
          <div className="flex items-center gap-3">
            <input type="tel" className="input bg-gray-50" value={user?.telephone ?? ''} readOnly />
            {user?.telephone_verifie ? (
              <span className="flex items-center gap-1 text-xs font-medium text-green-700 whitespace-nowrap">
                <ShieldCheck className="h-4 w-4" /> Vérifié
              </span>
            ) : (
              <span className="text-xs font-medium text-amber-700 whitespace-nowrap">Non vérifié</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Le numéro se vérifie (ou se change) par code SMS lors de votre prochaine commande.
          </p>
        </div>

        <div className="pt-2">
          <p className="text-sm text-gray-500 mb-1">Rôle</p>
          <div className="flex items-center gap-2">
            <span className="bg-primary-100 text-primary-700 text-sm font-medium px-3 py-1 rounded-full">
              {user?.role === 'ETUDIANT' ? 'Étudiant' :
               user?.role === 'ADMIN' ? 'Administrateur' :
               user?.role === 'CHEF_SECTEUR' ? 'Chef de Secteur' :
               user?.role === 'LIVREUR' ? 'Livreur' : user?.role}
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="btn-primary"
        >
          <Save className="h-4 w-4" />
          {isSubmitting ? 'Sauvegarde…' : 'Enregistrer les modifications'}
        </button>
      </form>
    </div>
  )
}

function PasswordSection() {
  const [showPasswords, setShowPasswords] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (data) => {
    try {
      await authApi.changePassword({
        ancien_mot_de_passe: data.current,
        nouveau_mot_de_passe: data.newPassword,
      })
      toast.success('Mot de passe modifié avec succès')
      reset()
    } catch (err) {
      const msg =
        err.response?.data?.detail ??
        err.response?.data?.ancien_mot_de_passe?.[0] ??
        'Erreur lors du changement'
      toast.error(msg)
    }
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2.5 bg-gray-100 rounded-xl">
          <Lock className="h-5 w-5 text-gray-500" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-800">Changer le mot de passe</h2>
          <p className="text-xs text-gray-400 mt-0.5">Minimum 8 caractères</p>
        </div>
        <button
          type="button"
          onClick={() => setShowPasswords(!showPasswords)}
          className="ml-auto text-gray-400 hover:text-gray-600"
        >
          {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Mot de passe actuel</label>
          <input
            type={showPasswords ? 'text' : 'password'}
            className={`input ${errors.current ? 'border-red-400' : ''}`}
            {...register('current', { required: 'Requis' })}
          />
          {errors.current && <p className="form-error">{errors.current.message}</p>}
        </div>

        <div>
          <label className="label">Nouveau mot de passe</label>
          <input
            type={showPasswords ? 'text' : 'password'}
            className={`input ${errors.newPassword ? 'border-red-400' : ''}`}
            {...register('newPassword', {
              required: 'Requis',
              minLength: { value: 8, message: 'Minimum 8 caractères' },
            })}
          />
          {errors.newPassword && <p className="form-error">{errors.newPassword.message}</p>}
        </div>

        <div>
          <label className="label">Confirmer le nouveau mot de passe</label>
          <input
            type={showPasswords ? 'text' : 'password'}
            className={`input ${errors.confirm ? 'border-red-400' : ''}`}
            {...register('confirm', {
              required: 'Requis',
              validate: (v) => v === watch('newPassword') || 'Les mots de passe ne correspondent pas',
            })}
          />
          {errors.confirm && <p className="form-error">{errors.confirm.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Modification…' : 'Changer le mot de passe'}
        </button>
      </form>
    </div>
  )
}

const homeByRole = {
  ETUDIANT: '/etudiant',
  ADMIN: '/admin',
  CHEF_SECTEUR: '/chef',
  LIVREUR: '/livreur',
}

export default function StudentProfile() {
  const { user, setUser } = useAuthStore()

  const handleProfileUpdate = async (data) => {
    const updated = await authApi.updateProfile(data)
    setUser({ ...user, ...updated })
  }

  const home = homeByRole[user?.role] ?? '/'

  return (
    <DashboardLayout>
      <Breadcrumb items={[{ label: 'Accueil', to: home }, { label: 'Mon profil' }]} />
      <div className=" mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon profil</h1>
          <p className="text-gray-500 mt-1">Gérez vos informations personnelles</p>
        </div>

        {/* Avatar */}
        <div className="card flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-primary-600 font-bold text-xl">
              {user?.prenom?.[0]}{user?.nom?.[0]}
            </span>
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-lg">
              {user?.prenom} {user?.nom}
            </p>
            <p className="text-gray-400 text-sm">
              {user?.email?.endsWith('@tel.ritoto-campus.local') ? user?.telephone : user?.email}
            </p>
          </div>
        </div>

        <ProfileSection user={user} onUpdate={handleProfileUpdate} />
        {!user?.email?.endsWith('@tel.ritoto-campus.local') && <PasswordSection />}
      </div>
    </DashboardLayout>
  )
}
