import { Check } from 'lucide-react'

/**
 * Progression par niveaux (dossier V1 §10) : chaque niveau affiche
 * clairement s'il est validé, en cours ou restant à compléter. Un niveau
 * validé est cliquable pour y revenir sans perdre les données saisies.
 *
 * niveaux : [{ label, valide: bool }]
 */
export default function ParcoursSteps({ niveaux, courant, onSelect }) {
  const nbValides = niveaux.filter((n) => n.valide).length

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
        <span>
          Niveau <span className="font-semibold text-gray-800">{courant + 1}</span> sur {niveaux.length}
        </span>
        <span>{nbValides} validé{nbValides > 1 ? 's' : ''} · {niveaux.length - nbValides} à compléter</span>
      </div>
      <ol className="flex items-center gap-1">
        {niveaux.map((niveau, i) => {
          const actif = i === courant
          const cliquable = onSelect && (niveau.valide || i < courant) && !actif
          return (
            <li key={niveau.label} className="flex-1 min-w-0">
              <button
                type="button"
                disabled={!cliquable}
                onClick={() => cliquable && onSelect(i)}
                title={`${niveau.label} — ${niveau.valide ? 'validé' : actif ? 'en cours' : 'à compléter'}`}
                className="w-full group text-left disabled:cursor-default"
              >
                <div
                  className={`h-1.5 rounded-full transition-colors ${
                    niveau.valide ? 'bg-green-500' : actif ? 'bg-orange-500' : 'bg-gray-200'
                  } ${cliquable ? 'group-hover:opacity-70' : ''}`}
                />
                <div className="hidden sm:flex items-center gap-1 mt-1.5">
                  {niveau.valide && <Check className="w-3 h-3 text-green-600 flex-shrink-0" />}
                  <span
                    className={`text-[11px] truncate ${
                      actif ? 'font-semibold text-gray-900' : niveau.valide ? 'text-green-700' : 'text-gray-400'
                    }`}
                  >
                    {niveau.label}
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="sm:hidden mt-2 text-sm font-semibold text-gray-900">{niveaux[courant]?.label}</p>
    </div>
  )
}
