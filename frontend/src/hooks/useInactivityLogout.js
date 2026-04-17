import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import useAuthStore from '../stores/authStore'

const INACTIVITY_MS = 20 * 60 * 1000 // 20 minutes

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

export default function useInactivityLogout() {
  const { isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()
  const timerRef = useRef(null)

  useEffect(() => {
    if (!isAuthenticated) return

    const handleLogout = async () => {
      await logout()
      toast('Session expirée après 20 minutes d\'inactivité.', { icon: '⏱️', duration: 5000 })
      navigate('/connexion')
    }

    const reset = () => {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(handleLogout, INACTIVITY_MS)
    }

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, reset, { passive: true }))
    reset()

    return () => {
      clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, reset))
    }
  }, [isAuthenticated, logout, navigate])
}
