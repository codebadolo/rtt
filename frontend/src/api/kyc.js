import client from './client'

export const kycApi = {
  list: (params) =>
    client.get('/kyc/', { params }).then((r) => r.data),

  submit: (data) =>
    client.post('/kyc/', data).then((r) => r.data),

  get: (id) =>
    client.get(`/kyc/${id}/`).then((r) => r.data),

  validate: (id) =>
    client.post(`/kyc/${id}/valider/`).then((r) => r.data),

  reject: (id, data) =>
    client.post(`/kyc/${id}/rejeter/`, data).then((r) => r.data),

  stats: () =>
    client.get('/kyc/statistiques/').then((r) => r.data),
}
