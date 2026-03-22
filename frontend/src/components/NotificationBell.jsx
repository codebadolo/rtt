import { useState } from 'react'
import { Bell, X, CheckCheck, Package } from 'lucide-react'
import { Link } from 'react-router-dom'
import useNotificationsStore from '../stores/notificationsStore'
import Badge from './Badge'

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, markAllRead, markRead, remove } =
    useNotificationsStore()

  const handleOpen = () => {
    setOpen((v) => !v)
  }

  return (
    <div className="relative">
      {/* Bouton cloche */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Overlay pour fermer au clic extérieur */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl z-40 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-semibold text-gray-800 text-sm">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 bg-red-100 text-red-600 text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Tout lire
                </button>
              )}
            </div>

            {/* Liste */}
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Aucune notification</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <NotifItem
                    key={notif.id}
                    notif={notif}
                    onRead={() => markRead(notif.id)}
                    onRemove={() => remove(notif.id)}
                    onClose={() => setOpen(false)}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function NotifItem({ notif, onRead, onRemove, onClose }) {
  const handleClick = () => {
    onRead()
    onClose()
  }

  return (
    <div className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${notif.lu ? 'opacity-60' : ''}`}>
      {/* Icône statut */}
      <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${notif.lu ? 'bg-gray-100' : 'bg-primary-50'}`}>
        <Package className={`h-4 w-4 ${notif.lu ? 'text-gray-400' : 'text-primary-500'}`} />
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        {notif.commande_id ? (
          <Link
            to={`/etudiant/commandes/${notif.commande_id}`}
            onClick={handleClick}
            className="block"
          >
            {!notif.lu && (
              <span className="inline-block w-2 h-2 bg-primary-500 rounded-full mr-1.5 mb-0.5 align-middle" />
            )}
            <p className="text-sm text-gray-800 leading-snug">{notif.message}</p>
            {notif.statut && (
              <span className="mt-1 inline-block">
                <Badge status={notif.statut} />
              </span>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              {notif.createdAt
                ? new Date(notif.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                : ''}
            </p>
          </Link>
        ) : (
          <div onClick={onRead}>
            <p className="text-sm text-gray-800">{notif.message}</p>
          </div>
        )}
      </div>

      {/* Bouton supprimer */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="flex-shrink-0 p-1 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
