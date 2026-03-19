import client from './client'

export const paymentsApi = {
  list: (params) =>
    client.get('/commandes/', { params }).then((r) => r.data),

  stats: () =>
    client.get('/commandes/paiements/stats/').then((r) => r.data),

  // Senfenico : initier le paiement mobile pour une commande
  initierPaiement: (commandeId) =>
    client.post(`/commandes/${commandeId}/initier-paiement/`).then((r) => r.data),

  // Senfenico : soumettre l'OTP
  soumettreOtp: (commandeId, otp) =>
    client.post(`/commandes/${commandeId}/soumettre-otp/`, { otp }).then((r) => r.data),

  // Liste des charges Senfenico (admin)
  charges: (params) =>
    client.get('/paiements/charges/', { params }).then((r) => r.data),
}
