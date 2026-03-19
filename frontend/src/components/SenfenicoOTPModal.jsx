import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Smartphone, CheckCircle, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { paymentsApi } from '../api/payments'

/**
 * Modal affiché après qu'une charge Senfenico est créée.
 * Gère les deux cas :
 *  - send_otp    : l'étudiant saisit son OTP
 *  - pay_offline : l'étudiant valide depuis son téléphone (pas d'OTP)
 */
export default function SenfenicoOTPModal({ commandeId, chargeInfo, onSuccess, onClose }) {
  const [otp, setOtp] = useState('')

  const otpMutation = useMutation({
    mutationFn: () => paymentsApi.soumettreOtp(commandeId, otp),
    onSuccess: () => {
      toast.success('Paiement confirmé ! Commande validée.')
      onSuccess()
    },
    onError: (err) => {
      const msg = err.response?.data?.error ?? 'OTP invalide, réessayez.'
      toast.error(msg)
    },
  })

  const isPending = chargeInfo?.statut === 'pay_offline'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-primary-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Confirmation de paiement</h2>
              <p className="text-xs text-gray-400">Paiement mobile via Senfenico</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Instructions */}
          {chargeInfo?.display_text && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800 leading-relaxed">
                {chargeInfo.display_text}
              </p>
            </div>
          )}

          {isPending ? (
            /* pay_offline : pas d'OTP, juste attente */
            <div className="text-center py-4">
              <Loader2 className="h-8 w-8 text-primary-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-600">
                Validez le paiement depuis votre téléphone puis fermez cette fenêtre.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Votre commande sera validée automatiquement après confirmation.
              </p>
            </div>
          ) : (
            /* send_otp : saisie de l'OTP */
            <div className="space-y-3">
              <label className="label">Entrez votre code OTP *</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                placeholder="Ex : 123456"
                className="input text-center text-lg font-mono tracking-widest"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                disabled={otpMutation.isPending}
                autoFocus
              />
              <button
                onClick={() => otpMutation.mutate()}
                disabled={otp.length < 4 || otpMutation.isPending}
                className="btn-primary w-full"
              >
                {otpMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Vérification…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Confirmer le paiement
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="btn-ghost w-full text-sm text-gray-500"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
