import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { otpApi, parcoursApi } from '../../api/auth'
import AuthLayout from '../../layouts/AuthLayout'
import useAuthStore from '../../stores/authStore'

const ESPACE = { ETUDIANT: '/etudiant', VENDEUR_INTERIEUR: '/vendeur', VENDEUR_EXTERIEUR: '/vendeur' }
const erreur = (err, defaut) => {
  const d = err?.response?.data
  const v = d && (d.detail ?? d.error ?? d.code ?? d.telephone ?? Object.values(d)[0])
  return (Array.isArray(v) ? v[0] : v) || defaut
}

/** Connexion des étudiants et vendeurs par numéro de téléphone + code SMS (sans mot de passe). */
export default function TelephoneLogin() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const [telephone, setTelephone] = useState('')
  const [code, setCode] = useState('')
  const [envoye, setEnvoye] = useState(false)
  const [debugCode, setDebugCode] = useState(null)

  const envoyer = useMutation({
    mutationFn: () => otpApi.envoyer(telephone),
    onSuccess: (res) => { setEnvoye(true); setDebugCode(res?.debug_code ?? null); toast.success('Code envoyé par SMS') },
    onError: (err) => toast.error(erreur(err, "Impossible d'envoyer le code")),
  })
  const verifier = useMutation({
    mutationFn: () => parcoursApi.verifierTelephone({ telephone, code, parcours: 'ETUDIANT' }),
    onSuccess: (res) => {
      setSession(res.token, res.user)
      const u = res.user
      // Nouveau numéro : compte étudiant créé, les informations seront demandées à la commande
      navigate(res.nouveau_compte ? '/campus' : ESPACE[u.role] ?? '/')
    },
    onError: (err) => { setCode(''); toast.error(erreur(err, 'Code invalide ou expiré')) },
  })

  return (
    <AuthLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Connexion par téléphone</h1>
        {!envoye ? (
          <form onSubmit={(e) => { e.preventDefault(); envoyer.mutate() }} className="space-y-4">
            <div>
              <label className="label" htmlFor="tl-tel">Numéro de téléphone</label>
              <div className="flex gap-2">
                <span className="input w-20 flex-shrink-0 text-center text-gray-500 bg-gray-50">+226</span>
                <input id="tl-tel" type="tel" inputMode="numeric" className="input" autoFocus placeholder="70 00 00 00"
                  value={telephone} onChange={(e) => setTelephone(e.target.value)} />
              </div>
            </div>
            <button type="submit" disabled={telephone.replace(/\D/g, '').length < 8 || envoyer.isPending} className="btn-primary w-full disabled:opacity-50">
              {envoyer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Recevoir le code par SMS'}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); verifier.mutate() }} className="space-y-4">
            {debugCode && (
              <p className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                Mode développement — code : <span className="font-mono font-bold">{debugCode}</span>
              </p>
            )}
            <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus aria-label="Code reçu par SMS"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-400 outline-none" />
            <button type="submit" disabled={code.length !== 6 || verifier.isPending} className="btn-primary w-full disabled:opacity-50">
              {verifier.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Se connecter'}
            </button>
            <button type="button" onClick={() => { setEnvoye(false); setCode('') }} className="w-full text-sm text-gray-500 hover:text-gray-800">
              Changer de numéro
            </button>
          </form>
        )}
        <p className="text-center text-sm text-gray-500">
          Compte avec email ? <Link to="/connexion" className="text-orange-600 font-semibold">Connexion par email</Link>
        </p>
      </div>
    </AuthLayout>
  )
}
