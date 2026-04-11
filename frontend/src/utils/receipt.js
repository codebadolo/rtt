const METHODE_LABEL = {
  ORANGE: 'Orange Money',
  MOOV:   'Moov Money',
  SANK:   'Sank Money',
}

const STATUT_LABEL = {
  BROUILLON:  'Brouillon',
  EN_ATTENTE: 'En attente',
  VALIDEE:    'Validée',
  REJETEE:    'Rejetée',
  PRETE:      'Prête',
  DISTRIBUEE: 'Distribuée',
  ANNULEE:    'Annulée',
}

export function printReceipt(order) {
  const lignes       = order.lignes ?? []
  const methodeLabel = METHODE_LABEL[order.methode_paiement] ?? order.methode_paiement ?? ''
  const statutLabel  = STATUT_LABEL[order.statut] ?? order.statut ?? ''
  const totalHT      = parseFloat(order.total_ht      || 0)
  const fraisService = parseFloat(order.frais_service || 0)
  const totalTTC     = parseFloat(order.total_ttc     || 0)

  const dateStr = new Date(order.date_creation).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const articlesRows = lignes.map((l) => `
    <tr>
      <td>${l.produit_nom ?? '—'}${l.variante_nom ? ` <small>(${l.variante_nom})</small>` : ''}</td>
      <td class="center">${l.quantite ?? 1}</td>
      <td class="right">${Number(l.prix_unitaire ?? 0).toLocaleString('fr-FR')} F</td>
      <td class="right bold">${Number(l.sous_total ?? 0).toLocaleString('fr-FR')} F</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Reçu — ${order.numero_commande}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:28px 20px;color:#1f2937;font-size:13px;line-height:1.5}
    .brand{text-align:center;margin-bottom:18px}
    .brand-name{font-size:24px;font-weight:800;color:#f97316;letter-spacing:-0.5px}
    .brand-sub{font-size:11px;color:#9ca3af;margin-top:2px}
    h2{text-align:center;font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#374151;margin:14px 0 4px}
    .num{text-align:center;font-family:monospace;font-size:13px;color:#6b7280}
    .date{text-align:center;font-size:11px;color:#9ca3af;margin-top:3px}
    hr{border:none;border-top:1px dashed #d1d5db;margin:14px 0}
    .label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:6px}
    table{width:100%;border-collapse:collapse}
    th{font-size:10px;text-transform:uppercase;color:#9ca3af;padding:4px 0;border-bottom:1px solid #e5e7eb;text-align:left}
    th.center,td.center{text-align:center}
    th.right,td.right{text-align:right}
    td{padding:5px 0;font-size:12px;border-bottom:1px solid #f3f4f6}
    td.bold{font-weight:700}
    .summary-row{display:flex;justify-content:space-between;margin:4px 0;font-size:12px}
    .summary-row.muted{color:#6b7280}
    .summary-row.total{font-size:16px;font-weight:800;color:#f97316;margin-top:6px;padding-top:6px;border-top:2px solid #f97316}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .info-item .lbl{font-size:10px;color:#9ca3af}
    .info-item .val{font-size:12px;font-weight:600;color:#111827}
    .mono{font-family:monospace}
    .badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;background:#dcfce7;color:#166534}
    .footer{text-align:center;font-size:10px;color:#9ca3af;margin-top:22px;line-height:1.8}
    @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style>
</head>
<body>
  <div class="brand">
    <div class="brand-name">Ritoto Campus</div>
    <div class="brand-sub">Livraison express sur le campus</div>
  </div>

  <h2>Reçu de commande</h2>
  <div class="num">${order.numero_commande}</div>
  <div class="date">${dateStr}</div>

  <hr>

  <div class="label">Articles</div>
  <table>
    <thead>
      <tr>
        <th>Produit</th>
        <th class="center">Qté</th>
        <th class="right">P.U</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${articlesRows || '<tr><td colspan="4" style="text-align:center;color:#9ca3af">Aucun article</td></tr>'}
    </tbody>
  </table>

  <hr>

  <div class="label">Récapitulatif</div>
  <div class="summary-row muted">
    <span>Sous-total produits</span>
    <span>${totalHT.toLocaleString('fr-FR')} FCFA</span>
  </div>
  <div class="summary-row muted"><span>Frais de service</span><span>+ ${fraisService.toLocaleString('fr-FR')} FCFA</span></div>
  <div class="summary-row total">
    <span>Total payé</span>
    <span>${totalTTC.toLocaleString('fr-FR')} FCFA</span>
  </div>

  <hr>

  <div class="label">Livraison</div>
  <div class="info-grid">
    ${order.etudiant_nom ? `<div class="info-item"><div class="lbl">Étudiant</div><div class="val">${order.etudiant_nom}</div></div>` : ''}
    ${order.secteur_nom  ? `<div class="info-item"><div class="lbl">Secteur</div><div class="val">${order.secteur_nom}</div></div>` : ''}
    ${order.salle_nom    ? `<div class="info-item"><div class="lbl">Salle</div><div class="val">${order.salle_nom}</div></div>` : ''}
    ${order.heure_souhaitee ? `<div class="info-item"><div class="lbl">Heure souhaitée</div><div class="val">${order.heure_souhaitee}</div></div>` : ''}
  </div>

  <hr>

  <div class="label">Paiement</div>
  <div class="info-grid">
    <div class="info-item"><div class="lbl">Méthode</div><div class="val">${methodeLabel}</div></div>
    <div class="info-item"><div class="lbl">Téléphone</div><div class="val mono">${order.telephone_paiement ?? '—'}</div></div>
    ${order.reference_paiement ? `<div class="info-item" style="grid-column:span 2"><div class="lbl">Référence transaction</div><div class="val mono">${order.reference_paiement}</div></div>` : ''}
    <div class="info-item"><div class="lbl">Statut</div><div class="val"><span class="badge">${statutLabel}</span></div></div>
  </div>

  <hr>

  <div class="footer">
    Merci de votre commande !<br>
    Conservez ce reçu comme preuve de paiement.<br>
    <strong>Ritoto Campus</strong> — Campus
  </div>

  <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=500,height=750,scrollbars=yes')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
