import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  MapPin,
  Minus,
  Package,
  Printer,
  RefreshCw,
  Truck,
  User,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'
import { ordersApi } from '../../api/orders'
import { printReceipt } from '../../utils/receipt'
import Badge from '../../components/Badge'
import Breadcrumb from '../../components/Breadcrumb'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import DashboardLayout from '../../layouts/DashboardLayout'

/* ─── Config ─── */
const METHODE_CFG = {
  ORANGE: { label: 'Orange Money', color: 'bg-orange-100 text-orange-700', emoji: '🟠' },
  MOOV:   { label: 'Moov Money',   color: 'bg-blue-100 text-blue-700',     emoji: '🟢' },
  SANK:   { label: 'Sank Money',   color: 'bg-indigo-100 text-indigo-700', emoji: '🔵' },
}

const SENFENICO_CFG = {
  send_otp:    { cls: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400',  label: 'En attente OTP'  },
  pay_offline: { cls: 'bg-sky-100 text-sky-700',      dot: 'bg-sky-400',    label: 'Hors ligne'      },
  success:     { cls: 'bg-green-100 text-green-700',  dot: 'bg-green-400',  label: 'Succès'          },
  failed:      { cls: 'bg-red-100 text-red-700',      dot: 'bg-red-400',    label: 'Échoué'          },
  pending:     { cls: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-300',   label: 'En attente'      },
}

const HIST_CFG = {
  BROUILLON:  { dot: 'bg-gray-300',   label: 'Brouillon'  },
  EN_ATTENTE: { dot: 'bg-amber-400',  label: 'En attente' },
  VALIDEE:    { dot: 'bg-blue-400',   label: 'Validée'    },
  REJETEE:    { dot: 'bg-red-400',    label: 'Rejetée'    },
  PRETE:      { dot: 'bg-indigo-400', label: 'Prête'      },
  DISTRIBUEE: { dot: 'bg-green-400',  label: 'Distribuée' },
  ANNULEE:    { dot: 'bg-rose-300',   label: 'Annulée'    },
}

/* ─── Timeline ─── */
const STEPS = [
  { key: 'created',      label: 'Créée',     sub: 'En attente paiement' },
  { key: 'payment_init', label: 'Paiement',  sub: 'Charge initiée'      },
  { key: 'payment_ok',   label: 'Confirmé',  sub: 'Transaction validée' },
  { key: 'validated',    label: 'Validée',   sub: 'Commande acceptée'   },
  { key: 'ready',        label: 'Prête',     sub: 'Distribution'        },
  { key: 'delivered',    label: 'Distribuée',sub: 'Livrée'              },
]

function getStepState(order) {
  const done = new Set()
  const current = new Set()
  const error = new Set()
  if (!order) return { done, current, error }

  const { statut } = order
  const paiement = order.paiement_senfenico
  const sf = paiement?.statut

  done.add('created')

  if (paiement) done.add('payment_init')

  if (sf === 'success' || ['VALIDEE', 'PRETE', 'DISTRIBUEE'].includes(statut)) {
    done.add('payment_ok')
  } else if (sf === 'failed') {
    error.add('payment_ok')
  } else if (paiement && ['send_otp', 'pay_offline'].includes(sf)) {
    current.add('payment_ok')
  }

  if (['VALIDEE', 'PRETE', 'DISTRIBUEE'].includes(statut)) {
    done.add('validated')
  } else if (statut === 'REJETEE') {
    error.add('validated')
  } else if (sf === 'success') {
    current.add('validated')
  }

  if (['PRETE', 'DISTRIBUEE'].includes(statut)) {
    done.add('ready')
  } else if (statut === 'VALIDEE') {
    current.add('ready')
  }

  if (statut === 'DISTRIBUEE') {
    done.add('delivered')
  } else if (statut === 'PRETE') {
    current.add('delivered')
  }

  return { done, current, error }
}

function Timeline({ order }) {
  const { done, current, error } = getStepState(order)
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-5">Progression</p>
      <div className="relative flex justify-between">
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-100 z-0" />
        {STEPS.map((step) => {
          const isDone    = done.has(step.key)
          const isCurrent = current.has(step.key)
          const isError   = error.has(step.key)
          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center gap-1.5 flex-1">
              <div className={[
                'w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white transition-all',
                isDone    ? 'border-green-500 bg-green-500 text-white' :
                isError   ? 'border-red-500 bg-red-500 text-white' :
                isCurrent ? 'border-orange-400 text-orange-400' :
                'border-gray-200 text-gray-300',
              ].join(' ')}>
                {isDone    ? <CheckCircle2 className="h-4 w-4" /> :
                 isError   ? <XCircle      className="h-4 w-4" /> :
                 isCurrent ? <Clock        className="h-3.5 w-3.5" /> :
                             <Minus        className="h-3 w-3" />}
              </div>
              <p className={`text-xs font-semibold hidden sm:block ${
                isDone ? 'text-green-600' : isError ? 'text-red-500' :
                isCurrent ? 'text-orange-500' : 'text-gray-300'
              }`}>{step.label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Petits composants ─── */
function InfoBlock({ label, value, mono = false }) {
  if (value == null || value === '') return null
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold text-gray-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

function ActionBtn({ onClick, color, icon: Icon, label, loading }) {
  const COLORS = {
    green:  'bg-green-500 hover:bg-green-600 text-white',
    red:    'bg-red-500   hover:bg-red-600   text-white',
    blue:   'bg-blue-500  hover:bg-blue-600  text-white',
    orange: 'bg-orange-500 hover:bg-orange-600 text-white',
    gray:   'bg-gray-100  hover:bg-gray-200  text-gray-700',
  }
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${COLORS[color]}`}
    >
      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  )
}

function HistoryLine({ entry }) {
  const ancien  = HIST_CFG[entry.ancien_statut]  ?? { dot: 'bg-gray-300', label: entry.ancien_statut ?? '—' }
  const nouveau = HIST_CFG[entry.nouveau_statut] ?? { dot: 'bg-gray-300', label: entry.nouveau_statut }
  const date = new Date(entry.date_modification)
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${nouveau.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">{ancien.label}</span>
          <ChevronRight className="h-3 w-3 text-gray-300" />
          <span className="text-sm font-semibold text-gray-800">{nouveau.label}</span>
          {entry.modifie_par_nom && (
            <span className="text-xs text-gray-400">par {entry.modifie_par_nom}</span>
          )}
        </div>
        {entry.commentaire && (
          <p className="text-xs text-gray-500 mt-0.5">{entry.commentaire}</p>
        )}
      </div>
      <div className="text-xs text-gray-400 flex-shrink-0 text-right">
        <p>{date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</p>
        <p>{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    </div>
  )
}

/* ─── Main ─── */
export default function AdminOrderDetail() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [rejectModal, setRejectModal] = useState(false)
  const [motif, setMotif] = useState('')

  const { data: order, isLoading } = useQuery({
    queryKey: ['admin-order', id],
    queryFn: () => ordersApi.get(id),
  })

  const { data: historique = [] } = useQuery({
    queryKey: ['admin-order-historique', id],
    queryFn: () => ordersApi.historique(id),
    enabled: !!id,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-order', id] })
    queryClient.invalidateQueries({ queryKey: ['admin-order-historique', id] })
    queryClient.invalidateQueries({ queryKey: ['all-orders'] })
  }

  const validateMutation = useMutation({
    mutationFn: () => ordersApi.validate(id),
    onSuccess: () => { invalidate(); toast.success('Commande validée') },
    onError: () => toast.error('Impossible de valider'),
  })
  const rejectMutation = useMutation({
    mutationFn: () => ordersApi.reject(id, { motif }),
    onSuccess: () => { invalidate(); setRejectModal(false); setMotif(''); toast.success('Commande rejetée') },
    onError: () => toast.error('Impossible de rejeter'),
  })
  const readyMutation = useMutation({
    mutationFn: () => ordersApi.markReady(id),
    onSuccess: () => { invalidate(); toast.success('Commande marquée prête') },
    onError: () => toast.error('Erreur'),
  })
  const distributeMutation = useMutation({
    mutationFn: () => ordersApi.distribute(id),
    onSuccess: () => { invalidate(); toast.success('Commande distribuée') },
    onError: () => toast.error('Erreur'),
  })
  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancel(id),
    onSuccess: () => { invalidate(); toast.success('Commande annulée') },
    onError: () => toast.error('Erreur'),
  })

  if (isLoading) return (
    <DashboardLayout>
      <LoadingSpinner className="py-20" size="lg" />
    </DashboardLayout>
  )

  if (!order) return (
    <DashboardLayout>
      <div className="text-center py-20">
        <p className="text-gray-400">Commande introuvable</p>
        <Link to="/admin/commandes" className="mt-4 inline-flex items-center gap-2 text-sm text-orange-500 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour aux commandes
        </Link>
      </div>
    </DashboardLayout>
  )

  const lignes   = order.lignes ?? []
  const paiement = order.paiement_senfenico
  const methode  = METHODE_CFG[order.methode_paiement]
  const sfCfg    = paiement ? (SENFENICO_CFG[paiement.statut] ?? SENFENICO_CFG.pending) : null

  const canValidate   = order.statut === 'EN_ATTENTE'
  const canReject     = order.statut === 'EN_ATTENTE'
  const canMarkReady  = order.statut === 'VALIDEE'
  const canDistribute = order.statut === 'PRETE'
  const canCancel     = ['BROUILLON', 'EN_ATTENTE'].includes(order.statut)
  const hasActions    = canValidate || canReject || canMarkReady || canDistribute || canCancel

  return (
    <DashboardLayout>
      <div className=" mx-auto space-y-6">
        <Breadcrumb items={[
          { label: 'Dashboard', to: '/admin' },
          { label: 'Commandes', to: '/admin/commandes' },
          { label: order.numero_commande },
        ]} />

        {/* ── Header ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start gap-4 flex-wrap">
            <Link to="/admin/commandes" className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 flex-shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 font-mono">{order.numero_commande}</h1>
                <Badge status={order.statut} />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Créée le {new Date(order.date_creation).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
            <div className="text-right flex-shrink-0 space-y-2">
              <p className="text-2xl font-extrabold text-gray-900">
                {Number(order.total_ttc).toLocaleString('fr-FR')} FCFA
              </p>
              <p className="text-xs text-gray-400">{lignes.length} article{lignes.length > 1 ? 's' : ''}</p>
              <button
                onClick={() => printReceipt(order)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimer le reçu
              </button>
            </div>
          </div>
        </div>

        {/* ── Alerte rejet ── */}
        {order.statut === 'REJETEE' && order.motif_rejet && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Commande rejetée</p>
              <p className="text-sm text-red-600 mt-1">Motif : {order.motif_rejet}</p>
            </div>
          </div>
        )}

        {/* ── Timeline ── */}
        <Timeline order={order} />

        {/* ── Grille contenu ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Articles */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm h-full">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-gray-400" />
                Articles ({lignes.length})
              </h3>
              {lignes.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">Aucun article</p>
              ) : (
                <div className="space-y-0.5">
                  {lignes.map((ligne, i) => (
                    <div key={ligne.id ?? i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-orange-50 text-orange-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {ligne.quantite}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{ligne.produit_nom}</p>
                          {ligne.variante_nom && (
                            <p className="text-xs text-gray-400">{ligne.variante_nom}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">
                          {Number(ligne.sous_total).toLocaleString('fr-FR')} F
                        </p>
                        <p className="text-xs text-gray-400">
                          {Number(ligne.prix_unitaire).toLocaleString('fr-FR')} F/u
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 space-y-1.5 border-t border-gray-100">
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Sous-total produits</span>
                      <span>{Number(order.total_ht || 0).toLocaleString('fr-FR')} FCFA</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-400">
                      <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> Frais de service</span>
                      <span>+ {Number(order.frais_service || 0).toLocaleString('fr-FR')} FCFA</span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-900 pt-1">
                      <span>Total TTC</span>
                      <span className="text-orange-500">
                        {Number(order.total_ttc).toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Infos droite */}
          <div className="lg:col-span-2 space-y-4">

            {/* Étudiant & livraison */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                Étudiant
              </h3>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">
                    {order.etudiant_nom?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{order.etudiant_nom}</p>
                  <p className="text-xs text-gray-400">{order.etudiant_email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-50">
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
                  <InfoBlock label="Secteur" value={order.secteur_nom} />
                </div>
                <div className="flex items-start gap-2">
                  <Package className="h-3.5 w-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
                  <InfoBlock label="Salle" value={order.salle_nom} />
                </div>
                {order.heure_souhaitee && (
                  <InfoBlock label="Heure souhaitée" value={order.heure_souhaitee} />
                )}
              </div>
            </div>

            {/* Paiement */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-gray-400" />
                Paiement
              </h3>
              <div className="space-y-3">
                {methode && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${methode.color}`}>
                    {methode.emoji} {methode.label}
                  </span>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <InfoBlock label="Téléphone" value={order.telephone_paiement} mono />
                  {order.reference_paiement && (
                    <InfoBlock label="Référence" value={order.reference_paiement} mono />
                  )}
                </div>

                {/* Charge Senfenico */}
                {paiement ? (
                  <div className="pt-3 border-t border-gray-50">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">
                      Charge Senfenico
                    </p>
                    <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-gray-600 truncate">
                          {paiement.charge_reference}
                        </span>
                        {sfCfg && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${sfCfg.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sfCfg.dot}`} />
                            {sfCfg.label}
                          </span>
                        )}
                      </div>
                      {paiement.display_text && (
                        <p className="text-xs text-gray-500 leading-relaxed">
                          {paiement.display_text}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        Initiée le {new Date(paiement.date_creation).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'short',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic pt-2 border-t border-gray-50">
                    Aucune charge Senfenico initiée
                  </p>
                )}

                {order.description_besoin && (
                  <div className="pt-3 border-t border-gray-50">
                    <p className="text-xs text-gray-400 mb-1">Instructions</p>
                    <p className="text-sm text-gray-700">{order.description_besoin}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        {hasActions && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Actions disponibles</h3>
            <div className="flex items-center gap-3 flex-wrap">
              {canValidate && (
                <ActionBtn color="green" icon={CheckCircle2} label="Valider le paiement"
                  loading={validateMutation.isPending} onClick={() => validateMutation.mutate()} />
              )}
              {canReject && (
                <ActionBtn color="red" icon={XCircle} label="Rejeter"
                  onClick={() => setRejectModal(true)} />
              )}
              {canMarkReady && (
                <ActionBtn color="blue" icon={Package} label="Marquer prête"
                  loading={readyMutation.isPending} onClick={() => readyMutation.mutate()} />
              )}
              {canDistribute && (
                <ActionBtn color="orange" icon={Truck} label="Distribuer"
                  loading={distributeMutation.isPending} onClick={() => distributeMutation.mutate()} />
              )}
              {canCancel && (
                <ActionBtn color="gray" icon={Ban} label="Annuler"
                  loading={cancelMutation.isPending} onClick={() => cancelMutation.mutate()} />
              )}
            </div>
          </div>
        )}

        {/* ── Historique ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            Historique ({historique.length})
          </h3>
          {historique.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Aucun historique pour le moment</p>
          ) : (
            historique.map((entry) => <HistoryLine key={entry.id} entry={entry} />)
          )}
        </div>
      </div>

      {/* ── Modal rejet ── */}
      <Modal
        isOpen={rejectModal}
        onClose={() => { setRejectModal(false); setMotif('') }}
        title="Rejeter la commande"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Motif du rejet <span className="text-red-500">*</span>
            </label>
            <textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
              placeholder="Expliquez pourquoi la commande est rejetée…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-400 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setRejectModal(false); setMotif('') }}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={() => rejectMutation.mutate()}
              disabled={!motif.trim() || rejectMutation.isPending}
              className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {rejectMutation.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
              Confirmer le rejet
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
