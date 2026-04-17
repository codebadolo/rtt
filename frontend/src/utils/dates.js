const LOCALE = 'fr-FR'

export function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString(LOCALE, {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(LOCALE, {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function formatTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleTimeString(LOCALE, {
    hour: '2-digit', minute: '2-digit',
  })
}
