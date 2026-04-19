import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Truck, CheckCircle, XCircle, RefreshCw, MapPin, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import useAuthStore from '../../stores/authStore'
import { usersApi } from '../../api/users'
import { roomsApi } from '../../api/sectors'

// ── Create Livreur Modal ─────────────────────────────────────────────────────
function CreateLivreurModal({ isOpen, onClose }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ prenom: '', nom: '', email: '', telephone: '', password: '' })

  const createMutation = useMutation({
    mutationFn: () => usersApi.create({ ...form, role: 'LIVREUR' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chef-livreurs'] })
      toast.success('Livreur créé avec succès !')
      setForm({ prenom: '', nom: '', email: '', telephone: '', password: '' })
      onClose()
    },
    onError: (err) => {
      const data = err.response?.data
      const msg = typeof data === 'string' ? data
        : data?.email?.[0] ?? data?.detail ?? 'Erreur lors de la création'
      toast.error(msg)
    },
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter un livreur">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
            <input
              value={form.prenom} onChange={set('prenom')}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              placeholder="Prénom"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input
              value={form.nom} onChange={set('nom')}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              placeholder="Nom"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email" value={form.email} onChange={set('email')}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            placeholder="email@exemple.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
          <input
            value={form.telephone} onChange={set('telephone')}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            placeholder="+221 77 000 00 00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
          <input
            type="password" value={form.password} onChange={set('password')}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            placeholder="Mot de passe temporaire"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !form.prenom || !form.nom || !form.email || !form.password}
            className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold disabled:opacity-60"
          >
            {createMutation.isPending ? 'Création…' : 'Créer'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Assign Livreur Modal ─────────────────────────────────────────────────────
function AssignModal({ livreur, isOpen, onClose }) {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [selectedRoom, setSelectedRoom] = useState('')
  const [slot, setSlot] = useState('livreur_1')

  const { data: secteurs } = useQuery({
    queryKey: ['chef-secteurs', user?.id],
    queryFn: () => usersApi.getSecteurs(user.id),
    enabled: isOpen && !!user?.id,
  })

  const sectorIds = Array.isArray(secteurs) ? secteurs.map((s) => s.id) : []

  const { data: sallesData, isLoading: sallesLoading } = useQuery({
    queryKey: ['chef-salles-assign'],
    queryFn: () => roomsApi.list(),
    enabled: isOpen,
  })

  const salles = (Array.isArray(sallesData) ? sallesData : sallesData?.results ?? [])
    .filter((s) => sectorIds.length === 0 || sectorIds.includes(s.secteur ?? s.secteur_id))

  const assignMutation = useMutation({
    mutationFn: () => roomsApi.assignLivreurs(selectedRoom, { [slot]: livreur.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chef-livreurs'] })
      queryClient.invalidateQueries({ queryKey: ['chef-salles-assign'] })
      toast.success(`${livreur.prenom} assigné à la salle !`)
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.error ?? 'Erreur lors de l\'assignation'),
  })

  if (!livreur) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assigner ${livreur.prenom} ${livreur.nom}`}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Salle</label>
          {sallesLoading ? (
            <LoadingSpinner size="sm" />
          ) : (
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              <option value="">Choisir une salle…</option>
              {salles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom} {s.secteur_nom ? `(${s.secteur_nom})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Emplacement</label>
          <div className="flex gap-3">
            {['livreur_1', 'livreur_2'].map((s) => (
              <button
                key={s}
                onClick={() => setSlot(s)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                  slot === s
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {s === 'livreur_1' ? 'Livreur principal' : 'Livreur secondaire'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Annuler
          </button>
          <button
            onClick={() => assignMutation.mutate()}
            disabled={assignMutation.isPending || !selectedRoom}
            className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold disabled:opacity-60"
          >
            {assignMutation.isPending ? 'Assignation…' : 'Assigner'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ChefLivreurs() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [assignLivreur, setAssignLivreur] = useState(null)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['chef-livreurs'],
    queryFn: () => usersApi.list({ role: 'LIVREUR', page_size: 200 }),
    refetchInterval: 30000,
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => usersApi.toggleStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chef-livreurs'] })
      toast.success('Statut mis à jour')
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })

  const resetMutation = useMutation({
    mutationFn: (id) => usersApi.resetPassword(id),
    onSuccess: (data) => {
      toast.success(`Nouveau mot de passe : ${data.new_password ?? data.password ?? '(envoyé par email)'}`, {
        duration: 8000,
      })
    },
    onError: () => toast.error('Erreur lors de la réinitialisation'),
  })

  const livreurs = (Array.isArray(data) ? data : data?.results ?? [])
    .filter((l) => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        l.prenom?.toLowerCase().includes(q) ||
        l.nom?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q)
      )
    })

  const activeCount = livreurs.filter((l) => l.is_active).length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des livreurs</h1>
            <p className="text-gray-500 mt-1 text-sm">
              {activeCount} actif{activeCount !== 1 ? 's' : ''} · {livreurs.length} total
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold shadow-sm transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Ajouter un livreur
          </button>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un livreur…"
          className="w-full max-w-sm border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
        />

        {/* List */}
        {isLoading ? (
          <LoadingSpinner className="py-20" size="lg" />
        ) : livreurs.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl text-center py-16 shadow-sm">
            <Truck className="h-14 w-14 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aucun livreur trouvé</p>
            <p className="text-gray-400 text-sm mt-1">Ajoutez votre premier livreur ci-dessus.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Livreur</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Contact</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Statut</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {livreurs.map((livreur) => (
                  <tr key={livreur.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-orange-600 font-bold text-sm">
                            {livreur.prenom?.[0]}{livreur.nom?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{livreur.prenom} {livreur.nom}</p>
                          <p className="text-xs text-gray-400 sm:hidden">{livreur.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <p className="text-sm text-gray-600">{livreur.email}</p>
                      {livreur.telephone && (
                        <p className="text-xs text-gray-400">{livreur.telephone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        livreur.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${livreur.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {livreur.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setAssignLivreur(livreur)}
                          title="Assigner à une salle"
                          className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
                        >
                          <MapPin className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleMutation.mutate(livreur.id)}
                          disabled={toggleMutation.isPending}
                          title={livreur.is_active ? 'Désactiver' : 'Activer'}
                          className={`p-2 rounded-lg transition-colors ${
                            livreur.is_active
                              ? 'text-red-400 hover:bg-red-50'
                              : 'text-green-500 hover:bg-green-50'
                          }`}
                        >
                          {livreur.is_active
                            ? <XCircle className="h-4 w-4" />
                            : <CheckCircle className="h-4 w-4" />
                          }
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Réinitialiser le mot de passe de ${livreur.prenom} ?`)) {
                              resetMutation.mutate(livreur.id)
                            }
                          }}
                          disabled={resetMutation.isPending}
                          title="Réinitialiser le mot de passe"
                          className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateLivreurModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
      <AssignModal
        livreur={assignLivreur}
        isOpen={!!assignLivreur}
        onClose={() => setAssignLivreur(null)}
      />
    </DashboardLayout>
  )
}
