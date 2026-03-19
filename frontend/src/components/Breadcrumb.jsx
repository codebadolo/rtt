import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

/**
 * Usage:
 *   <Breadcrumb items={[
 *     { label: 'Dashboard', to: '/admin' },
 *     { label: 'Utilisateurs' },          // last item = current, no link
 *   ]} />
 */
export default function Breadcrumb({ items = [] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm mb-6">
      <Link
        to="/"
        className="text-gray-400 hover:text-orange-500 transition-colors flex-shrink-0"
      >
        <Home className="w-4 h-4" />
      </Link>

      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
            {isLast || !item.to ? (
              <span className={`truncate ${isLast ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>
                {item.label}
              </span>
            ) : (
              <Link
                to={item.to}
                className="text-gray-500 hover:text-orange-500 transition-colors truncate"
              >
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
