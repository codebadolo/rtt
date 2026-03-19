import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'

/* ── Skeleton row ── */
function SkeletonRow({ cols }) {
  return (
    <tr className="border-b border-gray-100 animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 bg-gray-100 rounded-full" style={{ width: `${60 + Math.random() * 30}%` }} />
        </td>
      ))}
    </tr>
  )
}

/* ── Sort icon ── */
function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col)
    return <ChevronsUpDown className="w-3.5 h-3.5 text-gray-300 ml-1 inline" />
  return sortDir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 text-orange-500 ml-1 inline" />
    : <ChevronDown className="w-3.5 h-3.5 text-orange-500 ml-1 inline" />
}

/**
 * DataTable props:
 *   columns : [{ key, label, sortable?, render?, className?, headerClass? }]
 *   data    : array of row objects
 *   isLoading
 *   emptyIcon  : React node
 *   emptyText
 *   searchable : bool (default true)
 *   searchPlaceholder
 *   filters    : additional filter node rendered next to search
 *   total      : total row count (for footer)
 *   page / totalPages / onPageChange  (for pagination)
 *   rowKey     : field used as key (default 'id')
 *   onRowClick : (row) => void  – makes rows clickable
 */
export default function DataTable({
  columns = [],
  data = [],
  isLoading = false,
  emptyIcon,
  emptyText = 'Aucun résultat',
  searchable = true,
  searchPlaceholder = 'Rechercher…',
  filters,
  total,
  page,
  totalPages,
  onPageChange,
  rowKey = 'id',
  onRowClick,
  search,
  onSearchChange,
}) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  /* client-side sort (only used when no server-side sort) */
  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    const cmp = String(av).localeCompare(String(bv), 'fr', { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  })

  const colCount = columns.length

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      {/* ── Toolbar ── */}
      {(searchable || filters) && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-4 py-3.5 border-b border-gray-100 bg-gray-50/50">
          {searchable && (
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search ?? ''}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white transition-colors"
              />
              {search && (
                <button
                  onClick={() => onSearchChange?.('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          {filters && <div className="flex items-center gap-2 flex-wrap">{filters}</div>}
          {total != null && (
            <span className="ml-auto text-xs text-gray-400 whitespace-nowrap hidden sm:block">
              {total} résultat{total > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  className={[
                    'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap',
                    col.sortable ? 'cursor-pointer select-none hover:text-gray-700 hover:bg-gray-100 transition-colors' : '',
                    col.headerClass ?? '',
                  ].join(' ')}
                >
                  {col.label}
                  {col.sortable && <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={colCount} />)
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3 text-gray-300">
                    {emptyIcon && <div className="opacity-40">{emptyIcon}</div>}
                    <p className="text-sm text-gray-400">{emptyText}</p>
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={row[rowKey]}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={[
                    'border-b border-gray-50 transition-colors group',
                    onRowClick ? 'cursor-pointer hover:bg-orange-50/40' : 'hover:bg-gray-50/60',
                  ].join(' ')}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={['px-4 py-3.5 text-gray-700', col.className ?? ''].join(' ')}
                    >
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination footer ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/30">
          <span className="text-xs text-gray-400">
            Page {page} / {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let p
              if (totalPages <= 5) p = i + 1
              else if (page <= 3) p = i + 1
              else if (page >= totalPages - 2) p = totalPages - 4 + i
              else p = page - 2 + i
              return (
                <button
                  key={p}
                  onClick={() => onPageChange?.(p)}
                  className={[
                    'w-7 h-7 rounded-lg text-xs font-medium transition-colors',
                    p === page
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-500 hover:bg-gray-100',
                  ].join(' ')}
                >
                  {p}
                </button>
              )
            })}

            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
