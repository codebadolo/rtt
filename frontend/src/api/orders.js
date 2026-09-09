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

  cancel: (id, data = {}) =>
    client.post(`/commandes/${id}/annuler/`, data).then((r) => r.data),

  historique: (id) =>
    client.get(`/commandes/${id}/historique/`).then((r) => r.data),

  getQrCode: (id) =>
    client.get(`/commandes/${id}/qr-code/`).then((r) => r.data),

  validateQr: (token) =>
    client.post('/commandes/valider-qr/', { token }).then((r) => r.data),

  // Vendeur
  accepterVendeur: (id) =>
    client.post(`/commandes/${id}/accepter-vendeur/`).then((r) => r.data),
  marquerEnPreparation: (id) =>
    client.post(`/commandes/${id}/en-preparation/`).then((r) => r.data),

  // Livreur
  accepterMission: (id) =>
    client.post(`/commandes/${id}/accepter-mission/`).then((r) => r.data),

  // Notation (§10)
  noterVendeur: (data) =>
    client.post('/commandes/noter-vendeur/', data).then((r) => r.data),
  noterLivreur: (data) =>
    client.post('/commandes/noter-livreur/', data).then((r) => r.data),
}

export const walletApi = {
  get: () => client.get('/wallet/').then((r) => r.data),
  transactions: (params) => client.get('/wallet/transactions/', { params }).then((r) => r.data),
}

export const remboursementsApi = {
  list: (params) => client.get('/remboursements/', { params }).then((r) => r.data),
  marquerTraite: (id) => client.post(`/remboursements/${id}/marquer-traite/`).then((r) => r.data),
}

export const profilsApi = {
  getVendeur: () => client.get('/profil/vendeur/').then((r) => r.data),
  createVendeur: (data) => {
    const isFormData = data instanceof FormData
    return client.post('/profil/vendeur/', data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}).then((r) => r.data)
  },
  updateVendeur: (data) => {
    const isFormData = data instanceof FormData
    return client.patch('/profil/vendeur/', data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}).then((r) => r.data)
  },
  getLivreur: () => client.get('/profil/livreur/').then((r) => r.data),
  updateLivreur: (data) => client.patch('/profil/livreur/', data).then((r) => r.data),
  basculerService: () => client.post('/utilisateurs/basculer-service/').then((r) => r.data),

  listVendeurs: (params) => client.get('/admin/vendeurs/', { params }).then((r) => r.data),
  getVendeurAdmin: (id) => client.get(`/admin/vendeurs/${id}/`).then((r) => r.data),
  validerVendeur: (id) => client.post(`/admin/vendeurs/${id}/valider/`).then((r) => r.data),
  rejeterVendeur: (id, data) => client.post(`/admin/vendeurs/${id}/rejeter/`, data).then((r) => r.data),

  listLivreurs: (params) => client.get('/admin/livreurs/', { params }).then((r) => r.data),
  getLivreurAdmin: (id) => client.get(`/admin/livreurs/${id}/`).then((r) => r.data),
  validerLivreur: (id) => client.post(`/admin/livreurs/${id}/valider/`).then((r) => r.data),
  rejeterLivreur: (id, data) => client.post(`/admin/livreurs/${id}/rejeter/`, data).then((r) => r.data),
  assignerBoutiques: (id, boutiques) => client.patch(`/admin/livreurs/${id}/boutiques/`, { boutiques }).then((r) => r.data),

  livreursEnService: () => client.get('/admin/livreurs-en-service/').then((r) => r.data),
}

export const creneauxApi = {
  list: (params) => client.get('/creneaux/', { params }).then((r) => r.data),
  create: (data) => client.post('/creneaux/', data).then((r) => r.data),
  update: (id, data) => client.patch(`/creneaux/${id}/`, data).then((r) => r.data),
  delete: (id) => client.delete(`/creneaux/${id}/`).then((r) => r.data),
}

export const journalAuditApi = {
  list: (params) => client.get('/admin/journal-audit/', { params }).then((r) => r.data),
}
