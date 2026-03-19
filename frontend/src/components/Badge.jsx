const STATUS_COLORS = {
  BROUILLON:  'bg-gray-100 text-gray-600',
  EN_ATTENTE: 'bg-yellow-100 text-yellow-700',
  VALIDEE:    'bg-blue-100 text-blue-700',
  REJETEE:    'bg-red-100 text-red-700',
  PRETE:      'bg-purple-100 text-purple-700',
  DISTRIBUEE: 'bg-green-100 text-green-700',
  ANNULEE:    'bg-gray-100 text-gray-500 line-through',
  // KYC statuses
  EN_COURS:   'bg-yellow-100 text-yellow-700',
  APPROUVE:   'bg-green-100 text-green-700',
  REJETE:     'bg-red-100 text-red-700',
  // User status
  ACTIF:      'bg-green-100 text-green-700',
  INACTIF:    'bg-gray-100 text-gray-500',
  // Generic
  true:       'bg-green-100 text-green-700',
  false:      'bg-red-100 text-red-700',
}

const STATUS_LABELS = {
  BROUILLON:  'Brouillon',
  EN_ATTENTE: 'En attente',
  VALIDEE:    'Validée',
  REJETEE:    'Rejetée',
  PRETE:      'Prête',
  DISTRIBUEE: 'Distribuée',
  ANNULEE:    'Annulée',
  EN_COURS:   'En cours',
  APPROUVE:   'Approuvé',
  REJETE:     'Rejeté',
  ACTIF:      'Actif',
  INACTIF:    'Inactif',
  ETUDIANT:   'Étudiant',
  ADMIN:      'Admin',
  CHEF_SECTEUR: 'Chef Secteur',
  LIVREUR:    'Livreur',
}

export default function Badge({ status, label, className = '' }) {
  const colorClass = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'
  const displayLabel = label ?? STATUS_LABELS[status] ?? status

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass} ${className}`}
    >
      {displayLabel}
    </span>
  )
}
