import client from './client'

export const productsApi = {
  list: (params) =>
    client.get('/produits/', { params }).then((r) => r.data),

  create: (data) => {
    const isFormData = data instanceof FormData
    return client.post('/produits/', data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}).then((r) => r.data)
  },

  get: (id) =>
    client.get(`/produits/${id}/`).then((r) => r.data),

  update: (id, data) => {
    const isFormData = data instanceof FormData
    return client.patch(`/produits/${id}/`, data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}).then((r) => r.data)
  },

  delete: (id) =>
    client.delete(`/produits/${id}/`).then((r) => r.data),

  byCategory: () =>
    client.get('/produits/par-categorie/').then((r) => r.data),

  popular: () =>
    client.get('/produits/populaires/').then((r) => r.data),

  search: (q) =>
    client.get('/produits/recherche/', { params: { q } }).then((r) => r.data),
}

export const variantsApi = {
  list: (params) =>
    client.get('/variantes/', { params }).then((r) => r.data),

  create: (data) =>
    client.post('/variantes/', data).then((r) => r.data),

  get: (id) =>
    client.get(`/variantes/${id}/`).then((r) => r.data),

  update: (id, data) =>
    client.patch(`/variantes/${id}/`, data).then((r) => r.data),

  delete: (id) =>
    client.delete(`/variantes/${id}/`).then((r) => r.data),
}

export const optionsApi = {
  list: (params) =>
    client.get('/options/', { params }).then((r) => r.data),

  create: (data) =>
    client.post('/options/', data).then((r) => r.data),

  get: (id) =>
    client.get(`/options/${id}/`).then((r) => r.data),

  update: (id, data) =>
    client.patch(`/options/${id}/`, data).then((r) => r.data),

  delete: (id) =>
    client.delete(`/options/${id}/`).then((r) => r.data),
}
