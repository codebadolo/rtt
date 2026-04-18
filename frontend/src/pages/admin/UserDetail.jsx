import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  ArrowLeft, Mail, Phone, Calendar,
  ShoppingBag, ToggleLeft, ToggleRight,
  ClipboardList, User, CreditCard, MapPin, DoorOpen,
  KeyRound, Pencil, ShieldAlert,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import { usersApi } from '../../api/users'
import { sectorsApi } from '../../api/sectors'

/* ── Helpers ── */
const ROLE_STYLES = {
  ADMIN:        'bg-purple-100 text-purple-700',
  ETUDIANT:     'bg-blue-100 text-blue-700',
  CHEF_SECTEUR: 'bg-amber-100 text-amber-700',
  LIVREUR:      'bg-green-100 text-green-700',
}
const ROLE_LABELS = {
  ADMIN: 'Administrateur',
  ETUDIANT: 'Étudiant',
  CHEF_SECTEUR: 'Chef de Secteur',
  LIVREUR: 'Livreur',
}

const ORDER_STATUT_CONFIG = {
  EN_ATTENTE:  { cls: 'bg-amber-100 text-amber-700',   txt: 'En attente' },
  VALIDEE:     { cls: 'bg-blue-100 text-blue-700',     txt: 'Validée' },
  PRETE:       { cls: 'bg-indigo-100 text-indigo-700', txt: 'Prête' },
  DISTRIBUEE:  { cls: 'bg-green-100 text-green-700',   txt: 'Distribuée' },
  REJETEE:     { cls: 'bg-gray-100 text-gray-500',     txt: 'Rejetée' },
}

const METHODE_CONFIG = {
  ORANGE: { label: 'Orange Money', color: 'bg-orange-100 text-orange-700', emoji: '🟠' },
  MOOV:   { label: 'Moov Money',   color: 'bg-blue-100 text-blue-700',     emoji: '🟢' },
  SANK:   { label: 'Sank Money',   color: 'bg-indigo-100 text-indigo-700', emoji: '🔵' },
}

/* ── Small components ── */
function Avatar({ prenom, nom }) {
  const initials = `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase()
  return (
    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center flex-shrink-0">
      <span className="text-white font-bold text-2xl">{initials}</span>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800 truncate">{value}</p>
      </div>
    </div>
  )
}

function StatMini({ label, value, sub, color = 'text-gray-900' }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-extrabold ${color}`}>{value ?? '—'}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-500 font-medium">{sub}</p>}
    </div>
  )
}

function Tab({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
        active ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100',
      ].join(' ')}
    >
      {children}
      {count != null && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-5 w-5 text-orange-500" />
        <h2 className="font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  )
}

/* ── Role-specific panels ── */

function EtudiantPanel({ user, orders, ordersLoading }) {
  const [tab, setTab] = useState('commandes')

  const livrees      = orders.filter((o) => o.statut === 'DISTRIBUEE' || o.statut === 'LIVREE').length
  const rejetees     = orders.filter((o) => o.statut === 'REJETEE').length
  const montantTotal = orders.reduce((s, o) => s + Number(o.total_ttc ?? o.total ?? 0), 0)

  const orderColumns = [
    { key: 'numero', label: 'N° Commande', render: (v, row) => <span className="font-mono text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">{v ?? row.numero ?? '—'}</span> },
    { key: 'date_creation', label: 'Date', render: (v, row) => { const d = v ?? row.date; return d ? new Date(d).toLocaleDateString('fr-FR') : '—' } },
    { key: 'salle_nom', label: 'Salle', render: (v, row) => <span className="text-sm text-gray-600">{v ?? row.salle?.nom ?? '—'}</span> },
    { key: 'total_ttc', label: 'Montant', render: (v, row) => { const n = v ?? row.total; return n ? `${Number(n).toLocaleString('fr-FR')} FCFA` : '—' } },
    { key: 'statut', label: 'Statut', render: (v) => { const cfg = ORDER_STATUT_CONFIG[v] ?? { cls: 'bg-gray-100 text-gray-500', txt: v }; return <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>{cfg.txt}</span> } },
  ]

  const paymentColumns = [
    { key: 'numero', label: 'N° Commande', render: (v, row) => <span className="font-mono text-xs font-bold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">{v ?? row.numero ?? '—'}</span> },
    { key: 'date_creation', label: 'Date', render: (v, row) => { const d = v ?? row.date; return d ? new Date(d).toLocaleDateString('fr-FR') : '—' } },
    { key: 'methode_paiement', label: 'Méthode', render: (v) => { const cfg = METHODE_CONFIG[v] ?? { label: v ?? '—', color: 'bg-gray-100 text-gray-600', emoji: '💰' }; return <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>{cfg.emoji} {cfg.label}</span> } },
    { key: 'telephone_paiement', label: 'Tél. paiement', render: (v) => <span className="font-mono text-xs text-gray-600">{v || '—'}</span> },
    { key: 'total_ttc', label: 'Montant', render: (v, row) => { const n = v ?? row.total; return n ? `${Number(n).toLocaleString('fr-FR')} FCFA` : '—' } },
    { key: 'statut', label: 'Statut', render: (v) => { const cfg = ORDER_STATUT_CONFIG[v] ?? { cls: 'bg-gray-100 text-gray-500', txt: v }; return <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>{cfg.txt}</span> } },
  ]

  return (
    <>
      {/* Activity stats */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatMini label="Commandes" value={orders.length} />
          <StatMini label="Distribuées" value={livrees} color="text-green-600" />
          <StatMini label="Rejetées" value={rejetees} color="text-red-500" />
          <StatMini label="Total dépensé" value={`${montantTotal.toLocaleString('fr-FR')} F`} color="text-orange-500" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-gray-100/60 rounded-2xl p-1.5 w-fit flex-wrap">
        <Tab active={tab === 'commandes'} onClick={() => setTab('commandes')} count={orders.length}>
          <ShoppingBag className="h-4 w-4" /> Commandes
        </Tab>
        <Tab active={tab === 'paiements'} onClick={() => setTab('paiements')}>
          <CreditCard className="h-4 w-4" /> Paiements
        </Tab>
      </div>

      {tab === 'commandes' && (
        <DataTable columns={orderColumns} data={orders} isLoading={ordersLoading}
          emptyIcon={<ClipboardList className="h-12 w-12" />} emptyText="Aucune commande" searchable={false} total={orders.length} />
      )}
      {tab === 'paiements' && (
        <DataTable columns={paymentColumns} data={orders} isLoading={ordersLoading}
          emptyIcon={<CreditCard className="h-12 w-12" />} emptyText="Aucun paiement" searchable={false} total={orders.length} />
      )}
    </>
  )
}

function ChefSecteurPanel({ userId, allSectors }) {
  const { data, isLoading } = useQuery({
    queryKey: ['user-secteurs', userId],
    queryFn: () => usersApi.getSecteurs(userId),
    enabled: !!userId,
  })
  const secteurs = Array.isArray(data) ? data : []

  // All available sectors for assignment
  const available = Array.isArray(allSectors) ? allSectors : []

  const qc = useQueryClient()
  const [showAssign, setShowAssign] = useState(false)
  const [selected, setSelected] = useState([])

  const assignMut = useMutation({
    mutationFn: (sectorId) => {
      // Get current chefs for that sector, add this user
      const sec = available.find((s) => s.id === sectorId)
      const currentChefs = sec?.chefs ?? []
      const newChefs = currentChefs.includes(Number(userId))
        ? currentChefs
        : [...currentChefs, Number(userId)]
      return sectorsApi.assignChefs(sectorId, newChefs)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-secteurs', userId] })
      qc.invalidateQueries({ queryKey: ['sectors'] })
      toast.success('Secteur assigné')
      setShowAssign(false)
    },
    onError: () => toast.error('Erreur'),
  })

  const removeMut = useMutation({
    mutationFn: (sectorId) => {
      const sec = available.find((s) => s.id === sectorId)
      const newChefs = (sec?.chefs ?? []).filter((c) => c !== Number(userId))
      return sectorsApi.assignChefs(sectorId, newChefs)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-secteurs', userId] })
      qc.invalidateQueries({ queryKey: ['sectors'] })
      toast.success('Retiré du secteur')
    },
    onError: () => toast.error('Erreur'),
  })

  const unassignedSectors = available.filter(
    (s) => !secteurs.some((ss) => ss.id === s.id)
  )

  return (
    <>
      <SectionCard title="Secteurs supervisés" icon={MapPin}>
        {isLoading ? (
          <LoadingSpinner className="py-8" />
        ) : secteurs.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="h-10 w-10 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Aucun secteur assigné</p>
          </div>
        ) : (
          <div className="space-y-2">
            {secteurs.map((sec) => (
              <div key={sec.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{sec.code}</span>
                    <p className="font-semibold text-sm text-gray-800">{sec.nom}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{sec.nombre_salles} salle(s)</p>
                </div>
                <button
                  onClick={() => removeMut.mutate(sec.id)}
                  disabled={removeMut.isPending}
                  className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50"
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
        )}
        {unassignedSectors.length > 0 && (
          <button onClick={() => setShowAssign(true)} className="mt-4 btn-secondary w-full text-sm">
            + Assigner à un secteur
          </button>
        )}
      </SectionCard>

      <Modal isOpen={showAssign} onClose={() => setShowAssign(false)} title="Assigner un secteur">
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {unassignedSectors.map((sec) => (
            <button
              key={sec.id}
              onClick={() => assignMut.mutate(sec.id)}
              disabled={assignMut.isPending}
              className="w-full text-left p-3 rounded-xl border border-gray-100 hover:bg-orange-50 hover:border-orange-200 transition-colors"
            >
              <span className="text-xs font-mono font-bold text-gray-500 mr-2">{sec.code}</span>
              <span className="font-semibold text-sm text-gray-800">{sec.nom}</span>
            </button>
          ))}
        </div>
        <button onClick={() => setShowAssign(false)} className="btn-secondary w-full mt-4">Annuler</button>
      </Modal>
    </>
  )
}

function LivreurPanel({ userId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['user-salles', userId],
    queryFn: () => usersApi.getSalles(userId),
    enabled: !!userId,
  })
  const salles = Array.isArray(data) ? data : []

  const distribuees = salles.length // just a placeholder; real stat below
  const sec1 = salles.length > 0 ? [...new Set(salles.map((s) => s.secteur_nom))].join(', ') : '—'

  return (
    <>
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <StatMini label="Salles assignées" value={salles.length} color="text-green-600" />
          <StatMini label="Secteur(s)" value={[...new Set(salles.map((s) => s.secteur_code))].join(', ') || '—'} />
        </div>
      </div>

      <SectionCard title="Salles assignées" icon={DoorOpen}>
        {isLoading ? (
          <LoadingSpinner className="py-8" />
        ) : salles.length === 0 ? (
          <div className="text-center py-8">
            <DoorOpen className="h-10 w-10 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Aucune salle assignée</p>
            <p className="text-xs text-gray-400 mt-1">Assignez ce livreur via Secteurs &amp; Salles</p>
          </div>
        ) : (
          <div className="space-y-2">
            {salles.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">{s.code}</span>
                    <p className="font-semibold text-sm text-gray-800">{s.nom}</p>
                    <span className="text-xs bg-white border border-green-200 text-green-600 px-2 py-0.5 rounded-full">{s.role}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {s.secteur_nom}{s.batiment ? ` · ${s.batiment}` : ''}{s.etage ? ` · ${s.etage}` : ''}
                  </p>
                </div>
                <Link
                  to="/admin/secteurs"
                  className="text-xs text-orange-500 hover:text-orange-700 font-medium"
                >
                  Gérer →
                </Link>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  )
}

function AdminPanel({ user }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 text-gray-500">
        <User className="h-5 w-5" />
        <p className="text-sm">Compte administrateur — accès complet à la plateforme.</p>
      </div>
    </div>
  )
}

/* ── Change role modal ── */
const ROLE_OPTIONS = [
  { value: 'ETUDIANT',     label: 'Étudiant' },
  { value: 'CHEF_SECTEUR', label: 'Chef de secteur' },
  { value: 'LIVREUR',      label: 'Livreur' },
  { value: 'ADMIN',        label: 'Administrateur' },
]

function ChangeRoleModal({ user, isOpen, onClose }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm({ values: { role: user?.role ?? 'ETUDIANT' } })

  const mut = useMutation({
    mutationFn: ({ role }) => usersApi.changeRole(user.id, role),
    onSuccess: (_, { role }) => {
      qc.invalidateQueries({ queryKey: ['user', String(user.id)] })
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Rôle modifié')
      onClose()
    },
    onError: (e) => toast.error(e.response?.data?.error ?? 'Erreur'),
  })

  if (!user) return null
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Changer le rôle">
      <form onSubmit={handleSubmit((d) => mut.mutate(d))} className="space-y-4">
        <p className="text-sm text-gray-500">
          Rôle actuel de <strong>{user.prenom} {user.nom}</strong> :{' '}
          <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_STYLES[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
            {ROLE_LABELS[user.role]}
          </span>
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau rôle</label>
          <select className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" {...register('role')}>
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Annuler</button>
          <button type="submit" disabled={mut.isPending} className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-60 transition-colors">
            {mut.isPending ? 'Modification…' : 'Confirmer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Edit user modal ── */
function EditUserModal({ user, isOpen, onClose }) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm({
    values: {
      prenom:    user?.prenom ?? '',
      nom:       user?.nom ?? '',
      email:     user?.email ?? '',
      telephone: user?.telephone ?? '',
    },
  })

  const mut = useMutation({
    mutationFn: (d) => usersApi.update(user.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', String(user.id)] })
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Profil mis à jour')
      onClose()
    },
    onError: (e) => {
      const d = e.response?.data
      toast.error(d?.email?.[0] ?? d?.detail ?? Object.values(d ?? {})[0]?.[0] ?? 'Erreur')
    },
  })

  const field = (name, label, opts = {}) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        {...register(name, opts.rules)}
        type={opts.type ?? 'text'}
        className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:border-orange-400 focus:ring-2 focus:ring-orange-100 ${errors[name] ? 'border-red-400' : 'border-gray-200'}`}
      />
      {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name].message}</p>}
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Modifier le profil">
      <form onSubmit={handleSubmit((d) => mut.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {field('prenom', 'Prénom', { rules: { required: 'Requis' } })}
          {field('nom', 'Nom', { rules: { required: 'Requis' } })}
        </div>
        {field('email', 'Email', { type: 'email', rules: { required: 'Requis' } })}
        {field('telephone', 'Téléphone', { type: 'tel' })}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Annuler</button>
          <button type="submit" disabled={mut.isPending} className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-60 transition-colors">
            {mut.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Reset password modal ── */
function ResetPasswordModal({ userId, isOpen, onClose }) {
  const [result, setResult] = useState(null)
  const mut = useMutation({
    mutationFn: () => usersApi.resetPassword(userId),
    onSuccess: (data) => setResult(data.temp_password),
    onError: () => toast.error('Erreur lors de la réinitialisation'),
  })

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); setResult(null) }} title="Réinitialiser le mot de passe">
      {result ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm text-green-700 font-medium mb-2">Mot de passe temporaire généré :</p>
            <p className="font-mono text-lg font-bold text-green-800 tracking-widest">{result}</p>
          </div>
          <p className="text-xs text-gray-400">Transmettez ce mot de passe à l'utilisateur de façon sécurisée.</p>
          <button onClick={() => { onClose(); setResult(null) }} className="btn-primary w-full">Fermer</button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Un mot de passe temporaire sera généré. L'utilisateur devra le changer à sa prochaine connexion.</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button onClick={() => mut.mutate()} disabled={mut.isPending} className="btn-primary flex-1">
              {mut.isPending ? 'Génération…' : 'Générer'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ── Main ── */
export default function AdminUserDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const [showReset, setShowReset] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showRole, setShowRole] = useState(false)

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => usersApi.get(id),
    enabled: !!id,
  })

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['user-orders', id],
    queryFn: () => usersApi.getOrders(id),
    enabled: !!id && user?.role === 'ETUDIANT',
  })
  const orders = Array.isArray(ordersData) ? ordersData : []

  const { data: allSectors } = useQuery({
    queryKey: ['sectors'],
    queryFn: () => import('../../api/sectors').then((m) => m.sectorsApi.list()),
    enabled: user?.role === 'CHEF_SECTEUR',
  })

  const toggleMut = useMutation({
    mutationFn: () => usersApi.toggleStatus(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', id] })
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Statut mis à jour')
    },
    onError: () => toast.error('Erreur'),
  })

  if (userLoading) return <DashboardLayout><LoadingSpinner className="py-32" size="lg" /></DashboardLayout>

  if (!user) return (
    <DashboardLayout>
      <div className="text-center py-32">
        <User className="h-12 w-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400">Utilisateur introuvable</p>
        <Link to="/admin/utilisateurs" className="mt-4 inline-flex items-center gap-2 text-orange-500 hover:underline text-sm">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[
          { label: 'Dashboard', to: '/admin' },
          { label: 'Utilisateurs', to: '/admin/utilisateurs' },
          { label: `${user.prenom} ${user.nom}` },
        ]} />

        {/* Profile card */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-orange-400 to-amber-400" />
          <div className="px-6 pb-6">
            <div className="flex items-end gap-5 -mt-10 flex-wrap">
              <Avatar prenom={user.prenom} nom={user.nom} />
              <div className="flex-1 min-w-0 mb-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold text-gray-900">{user.prenom} {user.nom}</h1>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${ROLE_STYLES[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${user.est_actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${user.est_actif ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {user.est_actif ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mt-0.5">{user.email}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <button
                  onClick={() => setShowEdit(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                  Modifier
                </button>
                <button
                  onClick={() => setShowRole(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors"
                >
                  <ShieldAlert className="h-4 w-4" />
                  Rôle
                </button>
                <button
                  onClick={() => setShowReset(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <KeyRound className="h-4 w-4" />
                  Réinitialiser MDP
                </button>
                <button
                  onClick={() => toggleMut.mutate()}
                  disabled={toggleMut.isPending}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    user.est_actif
                      ? 'border-red-200 text-red-600 hover:bg-red-50'
                      : 'border-green-200 text-green-600 hover:bg-green-50'
                  }`}
                >
                  {user.est_actif ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  {user.est_actif ? 'Désactiver' : 'Activer'}
                </button>
              </div>
            </div>

            {/* Common info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
              <InfoRow icon={Mail}     label="Email"              value={user.email} />
              <InfoRow icon={Phone}    label="Téléphone"          value={user.telephone} />
              <InfoRow icon={Calendar} label="Inscrit le"         value={user.date_inscription ? new Date(user.date_inscription).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : null} />
              <InfoRow icon={Calendar} label="Dernière connexion" value={user.derniere_connexion ? new Date(user.derniere_connexion).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Jamais'} />
            </div>
          </div>
        </div>

        {/* Role-specific content */}
        {user.role === 'ETUDIANT' && (
          <EtudiantPanel user={user} orders={orders} ordersLoading={ordersLoading} />
        )}
        {user.role === 'CHEF_SECTEUR' && (
          <ChefSecteurPanel userId={id} allSectors={Array.isArray(allSectors) ? allSectors : allSectors?.results ?? []} />
        )}
        {user.role === 'LIVREUR' && (
          <LivreurPanel userId={id} />
        )}
        {user.role === 'ADMIN' && (
          <AdminPanel user={user} />
        )}
      </div>

      <EditUserModal user={user} isOpen={showEdit} onClose={() => setShowEdit(false)} />
      <ChangeRoleModal user={user} isOpen={showRole} onClose={() => setShowRole(false)} />
      <ResetPasswordModal userId={id} isOpen={showReset} onClose={() => setShowReset(false)} />
    </DashboardLayout>
  )
}
