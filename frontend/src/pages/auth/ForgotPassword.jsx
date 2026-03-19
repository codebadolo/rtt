import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import AuthLayout from '../../layouts/AuthLayout'
import { authApi } from '../../api/auth'

export default function ForgotPassword() {
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (data) => {
    try {
      await authApi.requestPasswordReset({ email: data.email })
      setSent(true)
      toast.success('Email de réinitialisation envoyé')
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Une erreur est survenue'
      toast.error(msg)
    }
  }

  return (
    <AuthLayout>
      <Link
        to="/connexion"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la connexion
      </Link>

      {sent ? (
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-7 w-7 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Email envoyé !</h2>
          <p className="text-gray-500 text-sm">
            Si un compte existe avec cet email, vous recevrez un lien de
            réinitialisation sous peu.
          </p>
          <Link
            to="/connexion"
            className="btn-primary mt-6 inline-flex"
          >
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">
            Mot de passe oublié
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Saisissez votre email pour recevoir un lien de réinitialisation.
          </p>

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

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full btn-lg"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Envoi…
                </span>
              ) : (
                'Envoyer le lien'
              )}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
