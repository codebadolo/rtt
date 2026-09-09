import client from './client'

export const plaintesApi = {
  list: (params) =>
    client.get('/plaintes/', { params }).then((r) => r.data),

  create: (data) => {
    const isFormData = data instanceof FormData
    return client.post('/plaintes/', data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}).then((r) => r.data)
  },

  get: (id) =>
    client.get(`/plaintes/${id}/`).then((r) => r.data),

  update: (id, data) =>
    client.patch(`/plaintes/${id}/`, data).then((r) => r.data),

  delete: (id) =>
    client.delete(`/plaintes/${id}/`).then((r) => r.data),
}
