import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import {
  Users, UserCheck, GraduationCap, Truck, ShieldCheck,
  UserPlus, ToggleLeft, ToggleRight, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardLayout from '../../layouts/DashboardLayout'
import Breadcrumb from '../../components/Breadcrumb'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import { usersApi } from '../../api/users'

/* ── Stats card ── */
function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
      <div className={`p-3 rounded-2xl ${color} flex-shrink-0`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold text-gray-900">{value ?? <span className="text-gray-200 text-lg">…</span>}</p>
        <p className="text-sm text-gray-500 truncate">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

/* ── Role pill ── */
const ROLE_STYLES = {
  ADMIN:        'bg-purple-100 text-purple-700',
  ETUDIANT:     'bg-blue-100 text-blue-700',
  CHEF_SECTEUR: 'bg-amber-100 text-amber-700',
  LIVREUR:      'bg-green-100 text-green-700',
}
const ROLE_LABELS = {
  ADMIN: 'Admin', ETUDIANT: 'Étudiant', CHEF_SECTEUR: 'Chef secteur', LIVREUR: 'Livreur',
}
function RolePill({ role }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_STYLES[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

/* ── Avatar ── */
function Avatar({ prenom, nom }) {
  const initials = `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center flex-shrink-0">
      <span className="text-white font-bold text-xs">{initials}</span>
    </div>
  )
}

/* ── Create modal ── */
function CreateUserModal({ isOpen, onClose }) {
  const qc = useQueryClient()
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({ defaultValues: { role: 'ETUDIANT' } })
  const role = watch('role')

  const mut = useMutation({
    mutationFn: (d) => usersApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['users-all'] })
      toast.success('Utilisateur créé')
      reset()
      onClose()
    },
    onError: (e) => {
      const d = e.response?.data
      toast.error(d?.email?.[0] ?? d?.detail ?? Object.values(d ?? {})[0]?.[0] ?? 'Erreur')
    },
  })

  const field = (name, label, opts = {}) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{opts.required ? ' *' : ''}</label>
      <input
        {...opts}
        className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:border-orange-400 focus:ring-2 focus:ring-orange-100 ${errors[name] ? 'border-red-400' : 'border-gray-200'}`}
        {...register(name, opts.rules)}
      />
      {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name].message}</p>}
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouvel utilisateur">
      <form onSubmit={handleSubmit((d) => mut.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {field('prenom', 'Prénom', { required: true, rules: { required: 'Requis' } })}
          {field('nom', 'Nom', { required: true, rules: { required: 'Requis' } })}
        </div>
        {field('email', 'Email', { type: 'email', required: true, rules: { required: 'Requis' } })}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
            <select className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" {...register('role')}>
              <option value="ETUDIANT">Étudiant</option>
              <option value="ADMIN">Admin</option>
              <option value="CHEF_SECTEUR">Chef de secteur</option>
              <option value="LIVREUR">Livreur</option>
            </select>
          </div>
          {field('telephone', 'Téléphone', { type: 'tel' })}
        </div>
        {role === 'ETUDIANT' && field('matricule', 'Matricule')}
        {field('password', 'Mot de passe', { type: 'password', required: true, rules: { required: 'Requis', minLength: { value: 8, message: 'Min. 8 caractères' } } })}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Annuler</button>
          <button type="submit" disabled={mut.isPending} className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-60 transition-colors">
            {mut.isPending ? 'Création…' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Role filter pills ── */
const ROLE_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'ETUDIANT', label: 'Étudiants' },
  { value: 'ADMIN', label: 'Admins' },
  { value: 'CHEF_SECTEUR', label: 'Chefs secteur' },
  { value: 'LIVREUR', label: 'Livreurs' },
]

/* ── Main ── */
export default function AdminUsers() {
  const [page, setPage] = useState(1)
  const [role, setRole] = useState('')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, role, search],
    queryFn: () => usersApi.list({ page, role: role || undefined, search: search || undefined }),
  })
  const { data: allUsers } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => usersApi.list(),
    staleTime: 30_000,
  })

  const users = Array.isArray(data) ? data : data?.results ?? []
  const total = data?.count ?? users.length
  const totalPages = data?.count ? Math.ceil(data.count / 10) : 1

  const all = Array.isArray(allUsers) ? allUsers : allUsers?.results ?? []
  const stats = {
    total:     all.length,
    etudiants: all.filter((u) => u.role === 'ETUDIANT').length,
    livreurs:  all.filter((u) => u.role === 'LIVREUR').length,
    chefs:     all.filter((u) => u.role === 'CHEF_SECTEUR').length,
    actifs:    all.filter((u) => u.est_actif).length,
  }

  const toggleMut = useMutation({
    mutationFn: (id) => usersApi.toggleStatus(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['users-all'] }); toast.success('Statut modifié') },
    onError: () => toast.error('Erreur'),
  })
  const deleteMut = useMutation({
    mutationFn: (id) => usersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['users-all'] }); toast.success('Utilisateur supprimé') },
    onError: () => toast.error('Erreur'),
  })

  const columns = [
    {
      key: 'nom',
      label: 'Utilisateur',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <Avatar prenom={row.prenom} nom={row.nom} />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{row.prenom} {row.nom}</p>
            <p className="text-xs text-gray-400 truncate">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'telephone',
      label: 'Téléphone',
      className: 'text-gray-500 tabular-nums text-sm',
      render: (v) => v || <span className="text-gray-300">—</span>,
    },
    {
      key: 'role',
      label: 'Rôle',
      sortable: true,
      render: (v) => <RolePill role={v} />,
    },
    {
      key: 'est_actif',
      label: 'Statut',
      render: (v) => (
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${v ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${v ? 'bg-emerald-500' : 'bg-gray-400'}`} />
          {v ? 'Actif' : 'Inactif'}
        </span>
      ),
    },
    {
      key: 'date_inscription',
      label: 'Inscrit le',
      sortable: true,
      className: 'text-gray-400 text-xs tabular-nums whitespace-nowrap',
      render: (v) => v ? new Date(v).toLocaleDateString('fr-FR') : '—',
    },
    {
      key: 'id',
      label: '',
      headerClass: 'w-20',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); toggleMut.mutate(row.id) }}
            title={row.est_actif ? 'Désactiver' : 'Activer'}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {row.est_actif
              ? <ToggleRight className="h-5 w-5 text-emerald-500" />
              : <ToggleLeft className="h-5 w-5 text-gray-400" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm(`Supprimer ${row.prenom} ${row.nom} ?`)) deleteMut.mutate(row.id) }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Utilisateurs' }]} />

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Utilisateurs</h1>
            <p className="text-gray-400 text-sm mt-0.5">Gestion des comptes de la plateforme</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            Nouvel utilisateur
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard icon={Users}         label="Total"          value={stats.total}     color="bg-slate-700" />
          <StatCard icon={GraduationCap} label="Étudiants"      value={stats.etudiants} color="bg-blue-500" />
          <StatCard icon={Truck}         label="Livreurs"        value={stats.livreurs}  color="bg-green-500" />
          <StatCard icon={ShieldCheck}   label="Chefs secteur"   value={stats.chefs}     color="bg-amber-500" />
          <StatCard icon={UserCheck}     label="Comptes actifs"  value={stats.actifs}    color="bg-emerald-500"
            sub={stats.total > 0 ? `${Math.round((stats.actifs / stats.total) * 100)}% du total` : ''} />
        </div>

        {/* Role filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setRole(f.value); setPage(1) }}
              className={[
                'px-4 py-1.5 rounded-xl text-sm font-medium transition-colors border',
                role === f.value
                  ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={users}
          isLoading={isLoading}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Rechercher par nom ou email…"
          total={total}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          emptyIcon={<Users className="w-12 h-12" />}
          emptyText="Aucun utilisateur trouvé"
          onRowClick={(row) => navigate(`/admin/utilisateurs/${row.id}`)}
        />
      </div>

      <CreateUserModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </DashboardLayout>
  )
}
