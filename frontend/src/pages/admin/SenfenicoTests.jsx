import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  FlaskConical, Smartphone, CheckCircle2, XCircle, Clock,
  RefreshCw, Send, ChevronDown, ChevronUp, Wifi,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import client from '../../api/client'

/* ── API helpers ── */
const senfenicoApi = {
  charges: (params) =>
    client.get('/paiements/charges/', { params }).then((r) => r.data),
}

/* ── Config opérateurs ── */
const PROVIDERS = [
  { value: 'ORANGE', label: 'Orange Money', provider: 'orange_bf', color: 'bg-orange-500', light: 'bg-orange-50 text-orange-700 border-orange-200', emoji: '🟠' },
  { value: 'MOOV',   label: 'Moov Money',   provider: 'moov_bf',   color: 'bg-blue-500',   light: 'bg-blue-50 text-blue-700 border-blue-200',     emoji: '🟢' },
  { value: 'SANK',   label: 'Sank Money',   provider: 'sank_bf',   color: 'bg-indigo-500', light: 'bg-indigo-50 text-indigo-700 border-indigo-200',emoji: '🔵' },
]

/* ── Statut config ── */
const STATUT_CFG = {
  send_otp:    { cls: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400',   label: 'En attente OTP' },
  pay_offline: { cls: 'bg-sky-100 text-sky-700',       dot: 'bg-sky-400',     label: 'Hors ligne' },
  success:     { cls: 'bg-green-100 text-green-700',   dot: 'bg-green-400',   label: 'Succès' },
  failed:      { cls: 'bg-red-100 text-red-700',       dot: 'bg-red-400',     label: 'Échoué' },
  pending:     { cls: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-300',    label: 'En attente' },
}

function StatutBadge({ statut }) {
  const cfg = STATUT_CFG[statut] ?? { cls: 'bg-gray-100 text-gray-500', dot: 'bg-gray-300', label: statut }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

/* ── Expandable charge row ── */
function ChargeRow({ charge }) {
  const [open, setOpen] = useState(false)
  const prov = PROVIDERS.find((p) => p.value === charge.methode_paiement)

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        {/* Provider badge */}
        <span className={`text-lg flex-shrink-0`}>{prov?.emoji ?? '📱'}</span>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
              {charge.charge_reference}
            </span>
            <StatutBadge statut={charge.statut} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {charge.etudiant_nom} • {charge.numero_commande} • {charge.telephone}
          </p>
        </div>

        {/* Amount */}
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-gray-900">{Number(charge.montant).toLocaleString('fr-FR')} F</p>
          <p className="text-xs text-gray-400">
            {new Date(charge.date_creation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {open ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 bg-gray-50 space-y-2 pt-3">
          {charge.display_text && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-600 mb-1">Instructions affichées à l'étudiant</p>
              <p className="text-sm text-amber-800">{charge.display_text}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">Opérateur</p>
              <p className="font-medium text-gray-800">{prov?.label ?? charge.methode_paiement}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Téléphone</p>
              <p className="font-mono font-medium text-gray-800">{charge.telephone}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Dernière mise à jour</p>
              <p className="text-gray-800">
                {new Date(charge.date_modification).toLocaleString('fr-FR')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main ── */
export default function SenfenicoTests() {
  const [statutFilter, setStatutFilter] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['senfenico-charges', statutFilter],
    queryFn: () => senfenicoApi.charges({ statut: statutFilter || undefined }),
    refetchInterval: autoRefresh ? 5000 : false,
  })

  const charges = data?.results ?? []
  const count = data?.count ?? 0

  /* counts by status */
  const byStatut = charges.reduce((acc, c) => {
    acc[c.statut] = (acc[c.statut] ?? 0) + 1
    return acc
  }, {})

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Paiements', to: '/admin/paiements' }, { label: 'Tests Senfenico' }]} />

        {/* Header avec badge SANDBOX */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              <FlaskConical className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-gray-900">Tests Senfenico</h1>
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  SANDBOX
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5">
                Suivi des charges Senfenico — mode test activé
              </p>
            </div>
          </div>

          {/* Refresh controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                autoRefresh
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              <Wifi className={`h-4 w-4 ${autoRefresh ? 'text-green-500' : 'text-gray-400'}`} />
              {autoRefresh ? 'Live (5s)' : 'Live off'}
            </button>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-white text-gray-600 border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Rafraîchir
            </button>
          </div>
        </div>

        {/* Info sandbox */}
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 flex gap-3">
          <FlaskConical className="h-5 w-5 text-violet-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-violet-800">
            <p className="font-semibold mb-1">Mode Sandbox actif</p>
            <p className="text-violet-600">
              Les paiements effectués utilisent la clé <code className="bg-violet-100 px-1 rounded font-mono text-xs">sk_test_...</code>.
              Aucune transaction réelle n'est débitée.
              Pour Orange Money, composez le code USSD indiqué pour recevoir un OTP de test.
            </p>
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total charges', value: count, icon: Smartphone, color: 'bg-slate-700' },
            { label: 'Succès', value: byStatut.success ?? 0, icon: CheckCircle2, color: 'bg-green-500' },
            { label: 'En attente OTP', value: byStatut.send_otp ?? 0, icon: Clock, color: 'bg-amber-500' },
            { label: 'Échoués', value: byStatut.failed ?? 0, icon: XCircle, color: 'bg-red-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
              <div className={`p-2.5 rounded-xl ${color} flex-shrink-0`}>
                <Icon className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xl font-extrabold text-gray-900 tabular-nums">{value}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filtres statut */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { value: '', label: 'Toutes' },
            { value: 'send_otp',    label: 'En attente OTP' },
            { value: 'pay_offline', label: 'Hors ligne' },
            { value: 'success',     label: 'Succès' },
            { value: 'failed',      label: 'Échoués' },
            { value: 'pending',     label: 'Pending' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatutFilter(f.value)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                statutFilter === f.value
                  ? 'bg-violet-500 text-white border-violet-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Liste des charges */}
        {isLoading ? (
          <LoadingSpinner className="py-20" size="lg" />
        ) : charges.length === 0 ? (
          <div className="text-center py-20 bg-white border border-gray-100 rounded-2xl">
            <FlaskConical className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Aucune charge Senfenico</p>
            <p className="text-gray-300 text-sm mt-1">
              Les paiements initiés par les étudiants apparaîtront ici
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {charges.map((charge) => (
              <ChargeRow key={charge.id} charge={charge} />
            ))}
          </div>
        )}

        {/* Guide de test */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Send className="h-4 w-4 text-violet-500" />
            Guide de test rapide
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PROVIDERS.map((p) => (
              <div key={p.value} className={`border rounded-xl p-4 ${p.light}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{p.emoji}</span>
                  <span className="font-semibold text-sm">{p.label}</span>
                </div>
                <div className="space-y-1 text-xs">
                  <p><span className="font-medium">Provider API :</span> <code className="bg-white/60 px-1 rounded">{p.provider}</code></p>
                  {p.value === 'ORANGE' && (
                    <>
                      <p><span className="font-medium">Préfixes valides :</span> 04, 05, 06, 07, 74, 75, 76, 77</p>
                      <p className="italic opacity-75">L'étudiant compose un code USSD pour recevoir l'OTP</p>
                    </>
                  )}
                  {p.value === 'MOOV' && (
                    <>
                      <p><span className="font-medium">Préfixes valides :</span> 60, 61, 62, 63, 70, 71, 72, 73</p>
                      <p className="italic opacity-75">L'OTP est envoyé automatiquement par SMS</p>
                    </>
                  )}
                  {p.value === 'SANK' && (
                    <>
                      <p><span className="font-medium">Téléphone :</span> n'importe quel numéro BF</p>
                      <p className="italic opacity-75">L'OTP est envoyé automatiquement</p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
