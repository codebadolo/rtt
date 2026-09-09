import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import DataTable from '../../components/DataTable'
import { journalAuditApi } from '../../api/orders'

const ACTION_COLORS = {
  VALIDATION_VENDEUR: 'bg-green-100 text-green-700',
  REJET_VENDEUR: 'bg-red-100 text-red-700',
  VALIDATION_LIVREUR: 'bg-green-100 text-green-700',
  REJET_LIVREUR: 'bg-red-100 text-red-700',
  VALIDATION_KYC_ETUDIANT: 'bg-green-100 text-green-700',
  REJET_KYC_ETUDIANT: 'bg-red-100 text-red-700',
}

export default function AdminJournalAudit() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-journal-audit', search],
    queryFn: () => journalAuditApi.list({ search: search || undefined }),
  })
  const items = Array.isArray(data) ? data : data?.results ?? []

  const columns = [
    { key: 'action', label: 'Action', render: (v) => (
      <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full ${ACTION_COLORS[v] ?? 'bg-gray-100 text-gray-600'}`}>
        {v.replaceAll('_', ' ')}
      </span>
    ) },
    { key: 'auteur_nom', label: 'Auteur' },
    { key: 'details', label: 'Détails', className: 'max-w-md truncate' },
    { key: 'date_creation', label: 'Date', render: (v) => new Date(v).toLocaleString('fr-FR') },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Dashboard', to: '/admin' }, { label: "Journal d'audit" }]} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal d'audit</h1>
          <p className="text-gray-500 mt-1">Chaque action administrative (validation, sanction, statut caché) avec auteur et date (§3.5/§12)</p>
        </div>

        <DataTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          emptyIcon={<ScrollText className="h-12 w-12" />}
          emptyText="Aucune entrée dans le journal"
          search={search}
          onSearchChange={setSearch}
        />
      </div>
    </DashboardLayout>
  )
}
