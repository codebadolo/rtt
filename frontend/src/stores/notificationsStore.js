import { create } from 'zustand'

/**
 * Store des notifications temps réel (WebSocket).
 * Chaque notification a la forme :
 * {
 *   id:          string   (timestamp unique)
 *   type:        'commande_update' | 'notification'
 *   commande_id: number
 *   numero:      string
 *   statut:      string
 *   message:     string
 *   lu:          boolean
 *   createdAt:   Date
 * }
 */
const useNotificationsStore = create((set, get) => ({
  notifications: [],

  /** Ajouter une notification reçue du WebSocket */
  addNotification: (data) => {
    const notif = {
      ...data,
      id: `${Date.now()}-${Math.random()}`,
      lu: false,
      createdAt: new Date(),
    }
    set((state) => ({
      notifications: [notif, ...state.notifications].slice(0, 50), // max 50
    }))
    return notif
  },

  /** Marquer une notification comme lue */
  markRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, lu: true } : n
      ),
    }))
  },

  /** Marquer toutes comme lues */
  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, lu: true })),
    }))
  },

  /** Supprimer une notification */
  remove: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }))
  },

  /** Vider toutes les notifications */
  clear: () => set({ notifications: [] }),

  /** Nombre de notifications non lues */
  get unreadCount() {
    return get().notifications.filter((n) => !n.lu).length
  },
}))

export default useNotificationsStore
