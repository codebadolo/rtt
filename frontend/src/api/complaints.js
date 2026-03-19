import client from './client'

export const plaintesApi = {
  list: (params) =>
    client.get('/plaintes/', { params }).then((r) => r.data),

  create: (data) =>
    client.post('/plaintes/', data).then((r) => r.data),

  get: (id) =>
    client.get(`/plaintes/${id}/`).then((r) => r.data),

  update: (id, data) =>
    client.patch(`/plaintes/${id}/`, data).then((r) => r.data),

  delete: (id) =>
    client.delete(`/plaintes/${id}/`).then((r) => r.data),
}
