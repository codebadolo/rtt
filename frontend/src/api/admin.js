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
