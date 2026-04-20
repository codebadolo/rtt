import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Plus, Pencil, Trash2, MapPin, Building2, DoorOpen,
  Users, CheckCircle, AlertCircle, UserCog,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import { sectorsApi, roomsApi } from '../../api/sectors'
import { usersApi } from '../../api/users'

/* ── Stat card ── */
function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
      <div className={`p-3 rounded-2xl ${color} flex-shrink-0`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-extrabold text-gray-900">{value ?? <span className="text-gray-300">—</span>}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

/* ── Tab button ── */
function Tab({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
        active
          ? 'bg-orange-500 text-white shadow-sm'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
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

/* ── Sector form ── */
function SectorForm({ sector, onSubmit, onCancel, isLoading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      nom: sector?.nom ?? '',
      code: sector?.code ?? '',
      description: sector?.description ?? '',
      est_actif: sector?.est_actif ?? true,
    },
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Nom *</label>
          <input className={`input ${errors.nom ? 'border-red-400' : ''}`} {...register('nom', { required: 'Requis' })} />
          {errors.nom && <p className="form-error">{errors.nom.message}</p>}
        </div>
        <div>
          <label className="label">Code *</label>
          <input className={`input uppercase ${errors.code ? 'border-red-400' : ''}`} placeholder="EX: ISIG" {...register('code', { required: 'Requis' })} />
          {errors.code && <p className="form-error">{errors.code.message}</p>}
        </div>
      </div>
      <div>
        <label className="label">Description</label>
        <textarea rows={2} className="input resize-none" {...register('description')} />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="sect_actif" className="w-4 h-4 accent-orange-500" {...register('est_actif')} />
        <label htmlFor="sect_actif" className="text-sm text-gray-700">Secteur actif</label>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Annuler</button>
        <button type="submit" disabled={isLoading} className="btn-primary flex-1">
          {isLoading ? 'Sauvegarde…' : sector ? 'Modifier' : 'Créer'}
        </button>
      </div>
    </form>
  )
}

/* ── Room form ── */
function RoomForm({ sectors, room, onSubmit, onCancel, isLoading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      nom: room?.nom ?? '',
      code: room?.code ?? '',
      secteur: room?.secteur ?? (sectors[0]?.id ?? ''),
      batiment: room?.batiment ?? '',
      etage: room?.etage ?? '',
      capacite: room?.capacite ?? '',
      est_actif: room?.est_actif ?? true,
    },
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Nom *</label>
          <input className={`input ${errors.nom ? 'border-red-400' : ''}`} {...register('nom', { required: 'Requis' })} />
          {errors.nom && <p className="form-error">{errors.nom.message}</p>}
        </div>
        <div>
          <label className="label">Code *</label>
          <input className={`input ${errors.code ? 'border-red-400' : ''}`} placeholder="EX: S01" {...register('code', { required: 'Requis' })} />
          {errors.code && <p className="form-error">{errors.code.message}</p>}
        </div>
      </div>
      <div>
        <label className="label">Secteur *</label>
        <select className="input" {...register('secteur', { required: true })}>
          {sectors.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Bâtiment</label>
          <input className="input" {...register('batiment')} />
        </div>
        <div>
          <label className="label">Étage</label>
          <input className="input" {...register('etage')} />
        </div>
      </div>
      <div>
        <label className="label">Capacité</label>
        <input type="number" min="1" className="input" {...register('capacite')} />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="room_actif" className="w-4 h-4 accent-orange-500" {...register('est_actif')} />
        <label htmlFor="room_actif" className="text-sm text-gray-700">Salle active</label>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Annuler</button>
        <button type="submit" disabled={isLoading} className="btn-primary flex-1">
          {isLoading ? 'Sauvegarde…' : room ? 'Modifier' : 'Créer'}
        </button>
      </div>
    </form>
  )
}

/* ── Manage Chefs Modal ── */
function ManageChefsModal({ sector, isOpen, onClose }) {
  const qc = useQueryClient()

  const { data: chefsData } = useQuery({
    queryKey: ['chefs-list'],
    queryFn: () => usersApi.byRole('CHEF_SECTEUR'),
    enabled: isOpen,
  })
  const availableChefs = Array.isArray(chefsData) ? chefsData : chefsData?.results ?? []

  const [selected, setSelected] = useState(sector?.chefs ?? [])

  useEffect(() => {
    if (isOpen) setSelected(sector?.chefs ?? [])
  }, [isOpen, sector?.id])

  const mutation = useMutation({
    mutationFn: () => sectorsApi.assignChefs(sector.id, selected),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sectors'] })
      toast.success('Chefs mis à jour')
      onClose()
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })

  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Chefs — ${sector?.nom ?? ''}`}>
      <div className="space-y-4">
        <p className="text-sm text-gray-500">Sélectionnez un ou plusieurs chefs de secteur.</p>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {availableChefs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Aucun chef de secteur disponible</p>
          ) : (
            availableChefs.map((chef) => (
              <label
                key={chef.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-orange-500"
                  checked={selected.includes(chef.id)}
                  onChange={() => toggle(chef.id)}
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {chef.prenom} {chef.nom}
                  </p>
                  <p className="text-xs text-gray-400">{chef.email}</p>
                </div>
              </label>
            ))
          )}
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn-primary flex-1"
          >
            {mutation.isPending ? 'Sauvegarde…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ── Sectors DataTable ── */
function SectorsTable({ sectors, isLoading, onEdit, onDelete, onManageChefs }) {
  const [search, setSearch] = useState('')
  const columns = [
    {
      key: 'code',
      label: 'Code',
      sortable: true,
      render: (v) => (
        <span className="inline-block bg-orange-50 text-orange-700 font-mono font-bold text-xs px-2.5 py-1 rounded-lg">
          {v}
        </span>
      ),
    },
    {
      key: 'nom',
      label: 'Nom',
      sortable: true,
      render: (v, row) => (
        <div>
          <p className="font-semibold text-gray-800">{v}</p>
          {row.description && <p className="text-xs text-gray-400 truncate max-w-xs">{row.description}</p>}
        </div>
      ),
    },
    {
      key: 'chefs_noms',
      label: 'Chefs',
      render: (v) => {
        const noms = Array.isArray(v) ? v : []
        return noms.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {noms.map((nom, i) => (
              <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                {nom}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-red-400">Aucun chef</span>
        )
      },
    },
    {
      key: 'nombre_salles_actives',
      label: 'Salles',
      render: (v) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
          <DoorOpen className="h-3.5 w-3.5 text-gray-400" />
          {v ?? '—'}
        </span>
      ),
    },
    {
      key: 'est_actif',
      label: 'Statut',
      render: (v) => (
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${v !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${v !== false ? 'bg-green-500' : 'bg-gray-400'}`} />
          {v !== false ? 'Actif' : 'Inactif'}
        </span>
      ),
    },
    {
      key: 'id',
      label: '',
      headerClass: 'w-28',
      render: (_, row) => (
        <div className="flex justify-end gap-1">
          <button onClick={(e) => { e.stopPropagation(); onManageChefs(row) }} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors" title="Gérer les chefs">
            <UserCog className="h-4 w-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(row) }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(row) }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  const filtered = sectors.filter((s) =>
    !search || s.nom?.toLowerCase().includes(search.toLowerCase()) || s.code?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <DataTable
      columns={columns}
      data={filtered}
      isLoading={isLoading}
      emptyIcon={<MapPin className="h-12 w-12" />}
      emptyText="Aucun secteur trouvé"
      searchable
      searchPlaceholder="Rechercher un secteur…"
      search={search}
      onSearchChange={setSearch}
      total={filtered.length}
    />
  )
}

/* ── Rooms DataTable ── */
function RoomsTable({ sectors, onEdit, onDelete }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [secteurFilter, setSecteurFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['all-rooms', page, search, secteurFilter],
    queryFn: () => roomsApi.list({
      page,
      page_size: 20,
      search: search || undefined,
      secteur: secteurFilter || undefined,
    }),
  })
  const rooms = Array.isArray(data) ? data : data?.results ?? []
  const total = data?.count ?? rooms.length
  const totalPages = Math.ceil(total / 20)

  const columns = [
    {
      key: 'code',
      label: 'Code',
      sortable: true,
      render: (v) => (
        <span className="font-mono font-bold text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg">
          {v}
        </span>
      ),
    },
    {
      key: 'nom',
      label: 'Salle',
      sortable: true,
      render: (v, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
            <DoorOpen className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-800">{v}</p>
            {row.etage && <p className="text-xs text-gray-400">{row.etage}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'secteur_nom',
      label: 'Secteur',
      render: (_, row) => (
        <span className="text-sm text-gray-600">
          {row.secteur_nom ?? row.secteur?.nom ?? '—'}
        </span>
      ),
    },
    {
      key: 'batiment',
      label: 'Bâtiment',
      render: (v) => <span className="text-sm text-gray-500">{v || <span className="text-gray-300">—</span>}</span>,
    },
    {
      key: 'capacite',
      label: 'Capacité',
      render: (v) => (
        <span className="text-sm text-gray-500">{v ?? <span className="text-gray-300">—</span>}</span>
      ),
    },
    {
      key: 'est_actif',
      label: 'Statut',
      render: (v) => (
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${v !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${v !== false ? 'bg-green-500' : 'bg-gray-400'}`} />
          {v !== false ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'id',
      label: '',
      headerClass: 'w-20',
      render: (_, row) => (
        <div className="flex justify-end gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEdit(row) }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(row) }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  const sectorFilter = (
    <select
      value={secteurFilter}
      onChange={(e) => { setSecteurFilter(e.target.value); setPage(1) }}
      className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-orange-400 bg-white transition-colors"
    >
      <option value="">Tous les secteurs</option>
      {sectors.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
    </select>
  )

  return (
    <DataTable
      columns={columns}
      data={rooms}
      isLoading={isLoading}
      emptyIcon={<Building2 className="h-12 w-12" />}
      emptyText="Aucune salle trouvée"
      searchable
      searchPlaceholder="Rechercher une salle…"
      search={search}
      onSearchChange={(v) => { setSearch(v); setPage(1) }}
      filters={sectorFilter}
      total={total}
      page={page}
      totalPages={totalPages}
      onPageChange={setPage}
    />
  )
}

/* ── Main ── */
export default function AdminSectors() {
  const [tab, setTab] = useState('salles')
  const [showCreateSector, setShowCreateSector] = useState(false)
  const [editSector, setEditSector] = useState(null)
  const [manageChefsSector, setManageChefsSector] = useState(null)
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [editRoom, setEditRoom] = useState(null)
  const qc = useQueryClient()

  const { data: sectorsData, isLoading: sectorsLoading } = useQuery({
    queryKey: ['sectors'],
    queryFn: () => sectorsApi.list(),
  })
  const sectors = Array.isArray(sectorsData) ? sectorsData : sectorsData?.results ?? []

  const { data: roomsStats } = useQuery({
    queryKey: ['rooms-stats'],
    queryFn: () => roomsApi.list({ page_size: 1 }),
    staleTime: 30_000,
  })
  const { data: roomsActive } = useQuery({
    queryKey: ['rooms-active-count'],
    queryFn: () => roomsApi.list({ est_actif: true, page_size: 1 }),
    staleTime: 30_000,
  })

  const totalRooms  = roomsStats?.count ?? 0
  const activeRooms = roomsActive?.count ?? 0
  const activeSectors = sectors.filter((s) => s.est_actif !== false).length

  /* Sector mutations */
  const createSectorMut = useMutation({
    mutationFn: (d) => sectorsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sectors'] }); toast.success('Secteur créé'); setShowCreateSector(false) },
    onError: () => toast.error('Erreur création secteur'),
  })
  const updateSectorMut = useMutation({
    mutationFn: ({ id, ...d }) => sectorsApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sectors'] }); toast.success('Secteur modifié'); setEditSector(null) },
    onError: () => toast.error('Erreur'),
  })
  const deleteSectorMut = useMutation({
    mutationFn: (id) => sectorsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sectors'] }); toast.success('Secteur supprimé') },
    onError: () => toast.error('Erreur'),
  })

  /* Room mutations */
  const createRoomMut = useMutation({
    mutationFn: (d) => roomsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-rooms'] }); qc.invalidateQueries({ queryKey: ['rooms-stats'] }); qc.invalidateQueries({ queryKey: ['rooms-active-count'] }); toast.success('Salle créée'); setShowCreateRoom(false) },
    onError: () => toast.error('Erreur création salle'),
  })
  const updateRoomMut = useMutation({
    mutationFn: ({ id, ...d }) => roomsApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-rooms'] }); toast.success('Salle modifiée'); setEditRoom(null) },
    onError: () => toast.error('Erreur'),
  })
  const deleteRoomMut = useMutation({
    mutationFn: (id) => roomsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-rooms'] }); qc.invalidateQueries({ queryKey: ['rooms-stats'] }); qc.invalidateQueries({ queryKey: ['rooms-active-count'] }); toast.success('Salle supprimée') },
    onError: () => toast.error('Erreur'),
  })

  const handleDeleteSector = (s) => {
    if (confirm(`Supprimer le secteur "${s.nom}" ?`)) deleteSectorMut.mutate(s.id)
  }
  const handleDeleteRoom = (r) => {
    if (confirm(`Supprimer la salle "${r.nom}" ?`)) deleteRoomMut.mutate(r.id)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Secteurs & Salles' }]} />

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Secteurs & Salles</h1>
            <p className="text-gray-500 mt-1">Gérer les secteurs de livraison et leurs salles</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCreateRoom(true)} className="btn-secondary">
              <Plus className="h-4 w-4" />
              Nouvelle salle
            </button>
            <button onClick={() => setShowCreateSector(true)} className="btn-primary">
              <Plus className="h-4 w-4" />
              Nouveau secteur
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={MapPin}      label="Secteurs total"   value={sectors.length}  color="bg-orange-500" />
          <StatCard icon={CheckCircle} label="Secteurs actifs"  value={activeSectors}   color="bg-green-500" />
          <StatCard icon={DoorOpen}    label="Salles total"     value={totalRooms}      color="bg-blue-500" />
          <StatCard icon={Building2}   label="Salles actives"   value={activeRooms}     color="bg-purple-500"
            sub={totalRooms > 0 ? `${Math.round((activeRooms / totalRooms) * 100)}%` : ''} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 bg-gray-100/60 rounded-2xl p-1.5 w-fit">
          <Tab active={tab === 'secteurs'} onClick={() => setTab('secteurs')} count={sectors.length}>
            <MapPin className="h-4 w-4" />
            Secteurs
          </Tab>
          <Tab active={tab === 'salles'} onClick={() => setTab('salles')} count={totalRooms}>
            <DoorOpen className="h-4 w-4" />
            Salles
          </Tab>
        </div>

        {/* Content */}
        {tab === 'secteurs' ? (
          <SectorsTable
            sectors={sectors}
            isLoading={sectorsLoading}
            onEdit={setEditSector}
            onDelete={handleDeleteSector}
            onManageChefs={setManageChefsSector}
          />
        ) : (
          <RoomsTable
            sectors={sectors}
            onEdit={setEditRoom}
            onDelete={handleDeleteRoom}
          />
        )}
      </div>

      {/* Sector modals */}
      <Modal isOpen={showCreateSector} onClose={() => setShowCreateSector(false)} title="Nouveau secteur">
        <SectorForm onSubmit={(d) => createSectorMut.mutate(d)} onCancel={() => setShowCreateSector(false)} isLoading={createSectorMut.isPending} />
      </Modal>
      <Modal isOpen={!!editSector} onClose={() => setEditSector(null)} title="Modifier le secteur">
        <SectorForm sector={editSector} onSubmit={(d) => updateSectorMut.mutate({ id: editSector.id, ...d })} onCancel={() => setEditSector(null)} isLoading={updateSectorMut.isPending} />
      </Modal>
      <ManageChefsModal
        sector={manageChefsSector}
        isOpen={!!manageChefsSector}
        onClose={() => setManageChefsSector(null)}
      />

      {/* Room modals */}
      <Modal isOpen={showCreateRoom} onClose={() => setShowCreateRoom(false)} title="Nouvelle salle">
        <RoomForm sectors={sectors} onSubmit={(d) => createRoomMut.mutate(d)} onCancel={() => setShowCreateRoom(false)} isLoading={createRoomMut.isPending} />
      </Modal>
      <Modal isOpen={!!editRoom} onClose={() => setEditRoom(null)} title="Modifier la salle">
        <RoomForm sectors={sectors} room={editRoom} onSubmit={(d) => updateRoomMut.mutate({ id: editRoom.id, ...d })} onCancel={() => setEditRoom(null)} isLoading={updateRoomMut.isPending} />
      </Modal>
    </DashboardLayout>
  )
}
