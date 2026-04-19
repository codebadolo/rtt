import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  Phone,
  Printer,
  Smartphone,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ordersApi } from '../../api/orders'
import { paymentsApi } from '../../api/payments'
import Badge from '../../components/Badge'
import Breadcrumb from '../../components/Breadcrumb'
import LoadingSpinner from '../../components/LoadingSpinner'
import DashboardLayout from '../../layouts/DashboardLayout'
import { printReceipt } from '../../utils/receipt'
import { formatDateTime } from '../../utils/dates'

const METHODE_CFG = {
  ORANGE: { label: 'Orange Money', emoji: '🟠', color: 'bg-orange-100 text-orange-700' },
  MOOV:   { label: 'Moov Money',   emoji: '🟢', color: 'bg-green-100 text-green-700'  },
  SANK:   { label: 'Sank Money',   emoji: '🔵', color: 'bg-blue-100 text-blue-700'    },
}

const PAY_STATUS = {
  pending:         { icon: Loader2,      cls: 'text-amber-500',  bg: 'bg-amber-50 border-amber-200',   label: 'En attente',       spin: true  },
  send_otp:        { icon: Loader2,      cls: 'text-blue-500',   bg: 'bg-blue-50 border-blue-200',     label: 'En attente OTP',   spin: true  },
  pending_payment: { icon: Loader2,      cls: 'text-indigo-500', bg: 'bg-indigo-50 border-indigo-200', label: 'Paiement en cours', spin: true  },
  success:         { icon: CheckCircle2, cls: 'text-green-600',  bg: 'bg-green-50 border-green-200',   label: 'Paiement réussi',  spin: false },
  failed:          { icon: AlertCircle,  cls: 'text-red-500',    bg: 'bg-red-50 border-red-200',       label: 'Paiement échoué',  spin: false },
  cancelled:       { icon: AlertCircle,  cls: 'text-gray-400',   bg: 'bg-gray-50 border-gray-200',     label: 'Annulé',           spin: false },
}

function InfoRow({ icon: Icon, label, value, mono = false }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-gray-50 rounded-lg flex-shrink-0">
        <Icon className="h-4 w-4 text-gray-400" />
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className={`text-sm font-medium text-gray-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  )
}

export default function StudentOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [otpCode, setOtpCode] = useState('')

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.get(id),
    refetchInterval: (data) => {
      const s = data?.paiement_senfenico?.statut
      return (s === 'send_otp' || s === 'pay_offline' || s === 'pending') ? 8000 : false
    },
  })

  const otpMutation = useMutation({
    mutationFn: () => paymentsApi.soumettreOtp(id, otpCode),
    onSuccess: () => {
      toast.success('Paiement confirmé ! Commande validée.')
      setOtpCode('')
      queryClient.invalidateQueries({ queryKey: ['order', id] })
    },
    onError: (err) => {
      toast.error(err.response?.data?.error ?? 'Code OTP invalide, réessayez.')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      queryClient.invalidateQueries({ queryKey: ['student-orders'] })
      toast.success('Commande annulée')
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "Impossible d'annuler"),
  })

  if (isLoading) {
    return (
      <DashboardLayout>
        <Breadcrumb items={[{ label: 'Mes commandes', to: '/etudiant/commandes' }, { label: 'Détail' }]} />
        <LoadingSpinner className="py-20" size="lg" />
      </DashboardLayout>
    )
  }

  if (!order) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-gray-500">Commande introuvable</p>
          <Link to="/etudiant/commandes" className="btn-secondary mt-4 inline-flex">
            Retour aux commandes
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const lignes      = order.lignes ?? []
  const canCancel   = ['BROUILLON', 'EN_ATTENTE'].includes(order.statut)
  const canPrint    = ['VALIDEE', 'PRETE', 'DISTRIBUEE'].includes(order.statut)
  const paiement    = order.paiement_senfenico
  const canSaisirOtp = order.statut === 'EN_ATTENTE' && paiement?.statut === 'send_otp'
  const methode     = METHODE_CFG[order.methode_paiement]
  const totalHT      = parseFloat(order.total_ht     || 0)
  const fraisService = parseFloat(order.frais_service || 0)
  const totalTTC     = parseFloat(order.total_ttc    || 0)

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: 'Mes commandes', to: '/etudiant/commandes' }, { label: order.numero_commande }]} />

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/etudiant/commandes" className="p-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 font-mono">{order.numero_commande}</h1>
              <Badge status={order.statut} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Passée le {formatDateTime(order.date_creation)}
            </p>
          </div>
          {/* Print button — visible seulement si commande validée/distribuée */}
          {canPrint && (
            <button
              onClick={() => printReceipt(order)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              title="Imprimer / Télécharger le reçu"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Reçu</span>
            </button>
          )}
        </div>

        {/* Rejection notice */}
        {order.statut === 'REJETEE' && order.motif_rejet && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="font-medium text-red-800 mb-1">Commande rejetée</p>
            <p className="text-red-600 text-sm">Motif : {order.motif_rejet}</p>
          </div>
        )}

        {/* Articles */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">
            Articles ({lignes.length})
          </h2>
          {lignes.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucun article</p>
          ) : (
            <div className="space-y-0">
              {lignes.map((ligne, idx) => (
                <div
                  key={ligne.id ?? idx}
                  className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-orange-50 text-orange-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {ligne.quantite ?? 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {ligne.produit_nom ?? 'Produit'}
                      </p>
                      {ligne.variante_nom && (
                        <p className="text-xs text-gray-400">{ligne.variante_nom}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800">
                      {Number(ligne.sous_total ?? 0).toLocaleString('fr-FR')} FCFA
                    </p>
                    <p className="text-xs text-gray-400">
                      {Number(ligne.prix_unitaire ?? 0).toLocaleString('fr-FR')} F/u
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Récapitulatif financier */}
          <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Sous-total produits</span>
              <span>{totalHT.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5" />
                Frais de service
              </span>
              <span>+ {fraisService.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100">
              <span>Total payé</span>
              <span className="text-primary-500">{totalTTC.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>
        </div>

        {/* Détails livraison & paiement */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Détails</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow icon={MapPin}    label="Secteur"         value={order.secteur_nom} />
            <InfoRow icon={Package}   label="Salle"           value={order.salle_nom} />
            <InfoRow icon={Clock}     label="Heure souhaitée" value={order.heure_souhaitee} />
            <InfoRow icon={Phone}     label="Téléphone"       value={order.telephone_paiement} mono />
            {order.reference_paiement && (
              <InfoRow icon={CreditCard} label="Référence paiement" value={order.reference_paiement} mono />
            )}
            {methode && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-50 rounded-lg flex-shrink-0">
                  <CreditCard className="h-4 w-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Méthode de paiement</p>
                  <span className={`inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${methode.color}`}>
                    {methode.emoji} {methode.label}
                  </span>
                </div>
              </div>
            )}
          </div>

          {order.description_besoin && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Instructions spéciales</p>
              <p className="text-sm text-gray-700">{order.description_besoin}</p>
            </div>
          )}
        </div>

        {/* Section paiement Senfenico */}
        {paiement && (() => {
          const cfg  = PAY_STATUS[paiement.statut] ?? PAY_STATUS.pending
          const Icon = cfg.icon

          // Cas OTP : saisie directe inline
          if (canSaisirOtp) {
            return (
              <div className="border-2 border-blue-300 bg-blue-50 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Smartphone className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-blue-800">Confirmez votre paiement</p>
                    <p className="text-xs text-blue-500 font-mono">{paiement.charge_reference}</p>
                  </div>
                </div>

                {paiement.display_text && (
                  <div className="bg-white border border-blue-200 rounded-xl px-4 py-3">
                    <p className="text-sm text-gray-700 leading-relaxed">{paiement.display_text}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-blue-800">
                    Entrez le code OTP reçu par SMS *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    placeholder="Ex : 123456"
                    className="w-full px-4 py-3 rounded-xl border-2 border-blue-300 bg-white text-center text-xl font-mono tracking-widest outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    disabled={otpMutation.isPending}
                    autoFocus
                  />
                </div>

                <button
                  onClick={() => otpMutation.mutate()}
                  disabled={otpCode.length < 4 || otpMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {otpMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Vérification…</>
                  ) : (
                    <><CheckCircle className="h-4 w-4" /> Confirmer le paiement</>
                  )}
                </button>
              </div>
            )
          }

          // Cas pay_offline : validation depuis le téléphone
          if (paiement.statut === 'pay_offline' || paiement.statut === 'pending_payment') {
            return (
              <div className={`border rounded-2xl p-5 ${cfg.bg}`}>
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className={`h-5 w-5 flex-shrink-0 animate-spin ${cfg.cls}`} />
                  <div>
                    <p className={`font-semibold text-sm ${cfg.cls}`}>Validation en attente</p>
                    <p className="text-xs text-gray-400 font-mono">{paiement.charge_reference}</p>
                  </div>
                </div>
                {paiement.display_text && (
                  <p className="text-sm text-gray-700 leading-relaxed">{paiement.display_text}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">Cette page se met à jour automatiquement.</p>
              </div>
            )
          }

          // Autres statuts : juste le badge
          return (
            <div className={`border rounded-xl p-4 ${cfg.bg}`}>
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 flex-shrink-0 ${cfg.cls} ${cfg.spin ? 'animate-spin' : ''}`} />
                <div>
                  <p className={`font-semibold text-sm ${cfg.cls}`}>{cfg.label}</p>
                  <p className="text-xs text-gray-400 font-mono">{paiement.charge_reference}</p>
                </div>
              </div>
              {paiement.display_text && (
                <p className="text-sm text-gray-700 leading-relaxed mt-2">{paiement.display_text}</p>
              )}
            </div>
          )
        })()}

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          {canPrint && (
            <button
              onClick={() => printReceipt(order)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Printer className="h-4 w-4" />
              Imprimer le reçu
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              {cancelMutation.isPending ? 'Annulation…' : 'Annuler la commande'}
            </button>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
