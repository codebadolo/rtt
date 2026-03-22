import client from './client'

export const authApi = {
  register: (data) =>
    client.post('/auth/inscription/', data).then((r) => r.data),

  registerWithGoogle: (data) =>
    client.post('/auth/inscription-google/', data).then((r) => r.data),

  login: (data) =>
    client.post('/auth/connexion/', data).then((r) => r.data),

  loginWithGoogle: (token) =>
    client.post('/auth/connexion-google/', { token }).then((r) => r.data),

  logout: () =>
    client.post('/auth/deconnexion/').then((r) => r.data),

  getProfile: () =>
    client.get('/auth/profil/').then((r) => r.data),

  changePassword: (data) =>
    client.post('/auth/changer-mot-de-passe/', data).then((r) => r.data),

  requestPasswordReset: (data) =>
    client.post('/auth/demande-reinitialisation/', data).then((r) => r.data),

  resetPassword: (data) =>
    client.post('/auth/reinitialiser-mot-de-passe/', data).then((r) => r.data),
}
