import { create } from 'zustand'
import { authApi } from '../api/auth'
import { setStoredToken, removeStoredToken, getStoredToken } from '../api/client'

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) =>
    set({ user, isAuthenticated: !!user, isLoading: false }),

  login: async (credentials) => {
    const data = await authApi.login(credentials)
    // Backend returns { token, user_id, email, nom_complet, role, statut_kyc }
    setStoredToken(data.token)
    const user = {
      id: data.user_id,
      email: data.email,
      nom_complet: data.nom_complet,
      role: data.role,
      statut_kyc: data.statut_kyc,
    }
    set({ user, isAuthenticated: true, isLoading: false })
    return user
  },

  logout: async () => {
    try {
      await authApi.logout()
    } catch (_) {
      // ignore errors on logout
    }
    removeStoredToken()
    set({ user: null, isAuthenticated: false, isLoading: false })
  },

  fetchProfile: async () => {
    if (!getStoredToken()) {
      set({ user: null, isAuthenticated: false, isLoading: false })
      return null
    }
    set({ isLoading: true })
    try {
      const user = await authApi.getProfile()
      set({ user, isAuthenticated: true, isLoading: false })
      return user
    } catch (_) {
      removeStoredToken()
      set({ user: null, isAuthenticated: false, isLoading: false })
      return null
    }
  },

  getRole: () => get().user?.role,
}))

export default useAuthStore
