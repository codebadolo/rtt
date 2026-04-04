import client from './client'

export const adminApi = {
  stats: () =>
    client.get('/admin/dashboard/stats/').then((r) => r.data),

  tendances: (period = 'week') =>
    client.get('/admin/dashboard/tendances/', { params: { period } }).then((r) => r.data),
}

export const configApi = {
  get: () =>
    client.get('/configuration/').then((r) => r.data),

  update: (data) =>
    client.patch('/configuration/', data).then((r) => r.data),
}

export const comptabiliteApi = {
  get: (periode = 'month') =>
    client.get('/admin/comptabilite/', { params: { periode } }).then((r) => r.data),
}

export const soldeApi = {
  get: () =>
    client.get('/admin/solde/').then((r) => r.data),
}

export const settlementsApi = {
  list: () =>
    client.get('/admin/settlements/').then((r) => r.data),

  create: (data) =>
    client.post('/admin/settlements/', data).then((r) => r.data),

  sync: (reference) =>
    client.post(`/admin/settlements/${reference}/sync/`).then((r) => r.data),
}
