import client from './client'

export const ordersApi = {
  list: (params) =>
    client.get('/commandes/', { params }).then((r) => r.data),

  create: (data) =>
    client.post('/commandes/', data).then((r) => r.data),

  get: (id) =>
    client.get(`/commandes/${id}/`).then((r) => r.data),

  update: (id, data) =>
    client.patch(`/commandes/${id}/`, data).then((r) => r.data),

  validate: (id) =>
    client.post(`/commandes/${id}/valider/`).then((r) => r.data),

  reject: (id, data) =>
    client.post(`/commandes/${id}/rejeter/`, data).then((r) => r.data),

  markReady: (id) =>
    client.post(`/commandes/${id}/marquer-prete/`).then((r) => r.data),

  distribute: (id) =>
    client.post(`/commandes/${id}/distribuer/`).then((r) => r.data),

  cancel: (id) =>
    client.post(`/commandes/${id}/annuler/`).then((r) => r.data),

  historique: (id) =>
    client.get(`/commandes/${id}/historique/`).then((r) => r.data),

  getQrCode: (id) =>
    client.get(`/commandes/${id}/qr-code/`).then((r) => r.data),

  validateQr: (token) =>
    client.post('/commandes/valider-qr/', { token }).then((r) => r.data),
}
