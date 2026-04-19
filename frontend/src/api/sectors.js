import client from './client'

export const sectorsApi = {
  list: (params) =>
    client.get('/secteurs/', { params }).then((r) => r.data),

  create: (data) =>
    client.post('/secteurs/', data).then((r) => r.data),

  get: (id) =>
    client.get(`/secteurs/${id}/`).then((r) => r.data),

  update: (id, data) =>
    client.patch(`/secteurs/${id}/`, data).then((r) => r.data),

  delete: (id) =>
    client.delete(`/secteurs/${id}/`).then((r) => r.data),

  getRooms: (id) =>
    client.get(`/secteurs/${id}/salles/`).then((r) => r.data),

  stats: (id) =>
    client.get(`/secteurs/${id}/statistiques/`).then((r) => r.data),

  actifs: () =>
    client.get('/secteurs/actifs/').then((r) => r.data),

  assignChefs: (id, chefIds) =>
    client.post(`/secteurs/${id}/assigner-chefs/`, { chefs: chefIds }).then((r) => r.data),
}

export const roomsApi = {
  list: (params) =>
    client.get('/salles/', { params }).then((r) => r.data),

  create: (data) =>
    client.post('/salles/', data).then((r) => r.data),

  get: (id) =>
    client.get(`/salles/${id}/`).then((r) => r.data),

  update: (id, data) =>
    client.patch(`/salles/${id}/`, data).then((r) => r.data),

  delete: (id) =>
    client.delete(`/salles/${id}/`).then((r) => r.data),

  disponibles: () =>
    client.get('/salles/disponibles/').then((r) => r.data),

  getLivreurs: (id) =>
    client.get(`/salles/${id}/livreurs/`).then((r) => r.data),

  assignLivreurs: (id, data) =>
    client.patch(`/salles/${id}/assigner-livreurs/`, data).then((r) => r.data),
}

export const horairesApi = {
  list: (params) =>
    client.get('/horaires/', { params }).then((r) => r.data),

  create: (data) =>
    client.post('/horaires/', data).then((r) => r.data),

  get: (id) =>
    client.get(`/horaires/${id}/`).then((r) => r.data),

  update: (id, data) =>
    client.patch(`/horaires/${id}/`, data).then((r) => r.data),

  delete: (id) =>
    client.delete(`/horaires/${id}/`).then((r) => r.data),

  aujourdhui: () =>
    client.get('/horaires/aujourdhui/').then((r) => r.data),
}
