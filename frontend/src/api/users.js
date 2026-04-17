import client from './client'

export const usersApi = {
  list: (params) =>
    client.get('/utilisateurs/', { params }).then((r) => r.data),

  create: (data) =>
    client.post('/utilisateurs/', data).then((r) => r.data),

  get: (id) =>
    client.get(`/utilisateurs/${id}/`).then((r) => r.data),

  update: (id, data) =>
    client.patch(`/utilisateurs/${id}/`, data).then((r) => r.data),

  delete: (id) =>
    client.delete(`/utilisateurs/${id}/`).then((r) => r.data),

  byRole: (role) =>
    client.get('/utilisateurs/par-role/', { params: { role } }).then((r) => r.data),

  getOrders: (id) =>
    client.get(`/utilisateurs/${id}/commandes/`).then((r) => r.data),

  getSalles: (id) =>
    client.get(`/utilisateurs/${id}/salles/`).then((r) => r.data),

  getSecteurs: (id) =>
    client.get(`/utilisateurs/${id}/secteurs/`).then((r) => r.data),

  toggleStatus: (id) =>
    client.post(`/utilisateurs/${id}/toggle-status/`).then((r) => r.data),

  resetPassword: (id) =>
    client.post(`/utilisateurs/${id}/reset-password/`).then((r) => r.data),

  changeRole: (id, role) =>
    client.post(`/utilisateurs/${id}/changer-role/`, { role }).then((r) => r.data),
}
