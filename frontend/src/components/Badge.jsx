const STATUS_COLORS = {
  // Commandes
  BROUILLON:      'bg-gray-100 text-gray-600',
  EN_ATTENTE:     'bg-yellow-100 text-yellow-700',
  ACCEPTEE:       'bg-cyan-100 text-cyan-700',
  EN_PREPARATION: 'bg-orange-100 text-orange-700',
  PRETE:          'bg-purple-100 text-purple-700',
  EN_LIVRAISON:   'bg-blue-100 text-blue-700',
  LIVREE:         'bg-green-100 text-green-700',
  // Compat anciens statuts
  VALIDEE:        'bg-blue-100 text-blue-700',
  DISTRIBUEE:     'bg-green-100 text-green-700',
  REJETEE:        'bg-red-100 text-red-700',
  ANNULEE:        'bg-gray-100 text-gray-500 line-through',
  // User status
  ACTIF:          'bg-green-100 text-green-700',
  INACTIF:        'bg-gray-100 text-gray-500',
  // Validation
  true:           'bg-green-100 text-green-700',
  false:          'bg-red-100 text-red-700',
}

const STATUS_LABELS = {
  BROUILLON:          'Brouillon',
  EN_ATTENTE:         'En attente',
  ACCEPTEE:           'Acceptée',
  EN_PREPARATION:     'En préparation',
  PRETE:              'Prête',
  EN_LIVRAISON:       'En livraison',
  LIVREE:             'Livrée',
  VALIDEE:            'Validée',
  DISTRIBUEE:         'Distribuée',
  REJETEE:            'Rejetée',
  ANNULEE:            'Annulée',
  REJETE:             'Rejeté',
  ACTIF:              'Actif',
  INACTIF:            'Inactif',
  ETUDIANT:           'Étudiant',
  LIVREUR:            'Livreur',
  VENDEUR_INTERIEUR:  'Vendeur',
  VENDEUR_EXTERIEUR:  'Vendeur ext.',
  CHEF_SECTEUR:       'Chef Secteur',
  ADMIN_UNIVERSITAIRE:'Admin Univ.',
  ADMIN:              'Super Admin',
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
