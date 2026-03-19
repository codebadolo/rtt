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
      const currentPath = window.location.pathname
      if (currentPath !== '/connexion') {
        window.location.href = '/connexion'
      }
    }
    return Promise.reject(error)
  }
)

export default client
