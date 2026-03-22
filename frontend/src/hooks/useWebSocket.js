import { useEffect, useRef, useCallback } from 'react'

/**
 * Hook WebSocket avec reconnexion automatique.
 *
 * @param {string|null} url  - URL WebSocket (null = désactivé)
 * @param {Function}    onMessage - Callback appelé à chaque message reçu
 *
 * Fonctionnement :
 * - Ouvre la connexion WS dès que `url` est non-null
 * - Reconnecte automatiquement si la connexion se ferme (backoff exponentiel)
 * - Se déconnecte proprement quand le composant est démonté ou `url` change
 */
export default function useWebSocket(url, onMessage) {
  const wsRef       = useRef(null)
  const retriesRef  = useRef(0)
  const timerRef    = useRef(null)
  const onMsgRef    = useRef(onMessage)

  // Garder la référence du callback à jour sans recréer la connexion
  useEffect(() => { onMsgRef.current = onMessage }, [onMessage])

  const connect = useCallback(() => {
    if (!url) return

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      retriesRef.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMsgRef.current?.(data)
      } catch {
        // message non-JSON ignoré
      }
    }

    ws.onclose = (event) => {
      // Ne pas reconnecter si fermeture volontaire (code 1000 ou 4001 = non autorisé)
      if (event.code === 1000 || event.code === 4001) return

      // Backoff exponentiel : 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(1000 * 2 ** retriesRef.current, 30000)
      retriesRef.current += 1
      timerRef.current = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [url])

  useEffect(() => {
    connect()

    return () => {
      clearTimeout(timerRef.current)
      wsRef.current?.close(1000)
    }
  }, [connect])
}
