// Generate a professional invoice PDF using HTML + print
export function generateInvoicePDF(invoice, clientInfo) {
  const TPS_RATE = 0.05;
  const TVQ_RATE = 0.09975;

  const total = parseFloat(invoice.amount || 0);
  const sub   = total / (1 + TPS_RATE + TVQ_RATE);
  const tps   = sub * TPS_RATE;
  const tvq   = sub * TVQ_RATE;

  const fmt = n => `$${parseFloat(n).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const today = new Date().toLocaleDateString('fr-CA');
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-CA');

  const isContract = invoice.type === 'contract';
  const routeLabel = invoice.route === 'ontario' ? 'Ontario / Gatineau' : invoice.route === 'quebec' ? 'Québec' : '';
  const ratePerDay = invoice.route === 'ontario' ? 749.99 : 585.00;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture #${invoice.id} — Transporteur National MC INC</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; font-size: 13px; color: #1A1208; background: white; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #C0392B; padding-bottom: 20px; }
    .company-name { font-size: 22px; font-weight: bold; color: #C0392B; }
    .company-sub { font-size: 11px; color: #8B6914; margin-top: 2px; }
    .invoice-title { text-align: right; }
    .invoice-title h1 { font-size: 28px; font-weight: bold; color: #1A1208; }
    .invoice-num { font-size: 14px; color: #8B6914; margin-top: 4px; }
    .invoice-date { font-size: 12px; color: #666; margin-top: 2px; }
    .bill-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .bill-to h3 { font-size: 11px; text-transform: uppercase; color: #8B6914; letter-spacing: 0.5px; margin-bottom: 8px; }
    .bill-to p { font-size: 13px; line-height: 1.6; }
    .bill-from { text-align: right; }
    .bill-from h3 { font-size: 11px; text-transform: uppercase; color: #8B6914; letter-spacing: 0.5px; margin-bottom: 8px; }
    .bill-from p { font-size: 12px; color: #555; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead { background: #1A1208; color: white; }
    thead th { padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 600; }
    tbody tr { border-bottom: 1px solid #F0EBE0; }
    tbody tr:nth-child(even) { background: #FAF7F0; }
    tbody td { padding: 12px 14px; font-size: 13px; }
    .totals { margin-left: auto; width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .totals-row.total { border-top: 2px solid #1A1208; margin-top: 8px; padding-top: 10px; font-weight: bold; font-size: 16px; color: #C0392B; }
    .tax-info { margin-top: 30px; padding-top: 16px; border-top: 1px solid #F0EBE0; }
    .tax-info p { font-size: 11px; color: #888; margin-bottom: 3px; }
    .footer { margin-top: 40px; text-align: center; padding-top: 20px; border-top: 1px solid #F0EBE0; }
    .footer p { font-size: 11px; color: #8B6914; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; }
    .status-paid { background: #E8F5EF; color: #0F6E56; }
    .status-pending { background: #FEF3C7; color: #92400E; }
    @media print {
      body { padding: 20px; }
      @page { margin: 20px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">🦅 Transporteur National MC INC</div>
      <div class="company-sub">Terrebonne, Québec</div>
      <div class="company-sub" style="margin-top:8px">transporteurnationalmc@gmail.com</div>
    </div>
    <div class="invoice-title">
      <h1>FACTURE</h1>
      <div class="invoice-num">#${invoice.id}</div>
      <div class="invoice-date">Date: ${today}</div>
      <div class="invoice-date">Échéance: ${dueDate}</div>
      <div style="margin-top:8px">
        <span class="status-badge ${invoice.status === 'paid' ? 'status-paid' : 'status-pending'}">
          ${invoice.status === 'paid' ? '✓ PAYÉE' : '⏳ EN ATTENTE'}
        </span>
      </div>
    </div>
  </div>

  <div class="bill-section">
    <div class="bill-to">
      <h3>Facturé à</h3>
      <p><strong>${clientInfo?.name || invoice.client_name || '—'}</strong></p>
      ${clientInfo?.address ? `<p>${clientInfo.address}</p>` : ''}
      ${clientInfo?.email ? `<p>${clientInfo.email}</p>` : ''}
    </div>
    <div class="bill-from">
      <h3>De</h3>
      <p><strong>Transporteur National MC INC</strong></p>
      <p>Terrebonne, Québec</p>
      <p>TPS: 784789315RT0001</p>
      <p>TVQ: 1224260784TQ0001</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Période</th>
        ${isContract ? '<th>Jours</th><th>Tarif/jour</th>' : ''}
        <th style="text-align:right">Montant</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          ${isContract
            ? `Service de livraison contractuel — Route ${routeLabel}`
            : 'Service de livraison local'}
        </td>
        <td>${invoice.dates || '—'}</td>
        ${isContract ? `<td>${invoice.days || '—'}</td><td>${fmt(ratePerDay)}</td>` : ''}
        <td style="text-align:right">${fmt(sub)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Sous-total</span>
      <span>${fmt(sub)}</span>
    </div>
    <div class="totals-row">
      <span>TPS (5%)</span>
      <span>${fmt(tps)}</span>
    </div>
    <div class="totals-row">
      <span>TVQ (9.975%)</span>
      <span>${fmt(tvq)}</span>
    </div>
    <div class="totals-row total">
      <span>TOTAL</span>
      <span>${fmt(total)}</span>
    </div>
    ${invoice.eft ? `<div class="totals-row" style="color:#0F6E56;font-size:12px;margin-top:8px"><span>✓ Paiement reçu</span><span>EFT #${invoice.eft}</span></div>` : ''}
  </div>

  <div class="tax-info">
    <p>No. TPS: 784789315RT0001 | No. TVQ: 1224260784TQ0001</p>
    <p>Paiement par EFT. Merci de votre confiance!</p>
  </div>

  <div class="footer">
    <p>Transporteur National MC INC — Terrebonne, Québec</p>
    <p>transporteurnationalmc@gmail.com</p>
  </div>
</body>
</html>`;

  // Open in new tab and trigger print dialog
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 500);
}
