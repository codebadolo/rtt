import axios from 'axios'

const TOKEN_KEY = 'ritoto_token'

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY)
export const setStoredToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const removeStoredToken = () => localStorage.removeItem(TOKEN_KEY)

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

client.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      removeStoredToken()
      // Les pages publiques (campus, boutiques, panier, parcours de commande
      // et d'inscription vendeur) restent accessibles sans compte.
      const currentPath = window.location.pathname
      const estPrive = /^\/(etudiant|admin|chef|livreur|vendeur)(\/|$)/.test(currentPath)
        && !currentPath.startsWith('/vendeur/inscription')
      if (estPrive) {
        window.location.href = '/connexion'
      }
    }
    return Promise.reject(error)
  }
)

export default client
