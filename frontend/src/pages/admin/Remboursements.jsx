import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, CheckCircle, Clock, Zap, UserCog } from 'lucide-react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import DataTable from '../../components/DataTable'
import { remboursementsApi } from '../../api/orders'

const FILTERS = [
  { value: '',            label: 'Tous' },
  { value: 'EN_ATTENTE',  label: 'En attente' },
  { value: 'TRAITE',      label: 'Traités' },
]

export default function AdminRemboursements() {
  const [statut, setStatut] = useState('EN_ATTENTE')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-remboursements', statut],
    queryFn: () => remboursementsApi.list({ statut: statut || undefined }),
  })
  const items = Array.isArray(data) ? data : data?.results ?? []

  const traiterMut = useMutation({
    mutationFn: (id) => remboursementsApi.marquerTraite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-remboursements'] })
      toast.success('Remboursement marqué comme traité')
    },
    onError: () => toast.error('Erreur'),
  })

  const columns = [
    { key: 'numero_commande', label: 'Commande', render: (v) => <span className="font-mono text-sm font-semibold">{v}</span> },
    { key: 'montant', label: 'Montant', render: (v) => `${parseFloat(v).toLocaleString('fr-FR')} FCFA` },
    { key: 'motif', label: 'Motif', className: 'max-w-xs truncate' },
    { key: 'automatique', label: 'Origine', render: (v) => v ? (
      <span className="inline-flex items-center gap-1 text-xs text-blue-600"><Zap className="h-3.5 w-3.5" />Automatique</span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs text-purple-600"><UserCog className="h-3.5 w-3.5" />Admin</span>
    ) },
    { key: 'statut', label: 'Statut', render: (v) => v === 'TRAITE' ? (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700"><CheckCircle className="h-3.5 w-3.5" />Traité</span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700"><Clock className="h-3.5 w-3.5" />En attente</span>
    ) },
    { key: 'date_creation', label: 'Date', render: (v) => new Date(v).toLocaleDateString('fr-FR') },
    { key: 'id', label: 'Action', headerClass: 'text-right', className: 'text-right', render: (id, row) => row.statut === 'EN_ATTENTE' ? (
      <button onClick={(e) => { e.stopPropagation(); traiterMut.mutate(id) }} disabled={traiterMut.isPending}
        className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-green-500 hover:bg-green-600 text-white disabled:opacity-60">
        Marquer traité
      </button>
    ) : null },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Remboursements' }]} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Remboursements</h1>
          <p className="text-gray-500 mt-1">
            Filet de sécurité manuel — aucune API de remboursement automatique n'est branchée côté agrégateur (§5.2/§14).
            Traitez le remboursement via Senfenico puis marquez-le ici comme fait.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => setStatut(f.value)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                statut === f.value ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
              }`}>{f.label}</button>
          ))}
        </div>

        <DataTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          emptyIcon={<RotateCcw className="h-12 w-12" />}
          emptyText="Aucun remboursement"
          searchable={false}
        />
      </div>
    </DashboardLayout>
  )
}
