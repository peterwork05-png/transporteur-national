const CLIENT_INFO = {
  beg:     { name: 'BUREAU EN GROS #299',  address: '4141, aut. 440\nLaval, Québec H7P 4W6' },
  beg_ops: { name: 'BUREAU EN GROS #299',  address: '4141, aut. 440\nLaval, Québec H7P 4W6' },
  jonarts: { name: 'JONARTS PRINTING',     address: '9010 Ave du Parc\nMontréal, QC H2N 1Y8\n1(514) 738-8224 ext 122' },
  aebath:  { name: 'A&E BATH AND SHOWER',  address: '' },
};

const ROUTE_LABELS = {
  ontario: 'Ontario / Gatineau',
  quebec:  'Québec',
};

export function generateInvoiceHTML(invoice, orders, clientGroup) {
  const client     = CLIENT_INFO[clientGroup] || CLIENT_INFO[invoice.client_id] || { name: (clientGroup||'').toUpperCase(), address: '' };
  const dateFrom   = invoice.date_from ? new Date(invoice.date_from).toISOString().split('T')[0] : '';
  const dateTo     = invoice.date_to   ? new Date(invoice.date_to).toISOString().split('T')[0]   : '';
  const fmt        = n => `$${parseFloat(n||0).toLocaleString('en-CA', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
  const isContract = invoice.type === 'contract';

  const tableRows = isContract ? `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ebe0;font-size:12px">${dateFrom} – ${dateTo}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ebe0;font-size:12px">Route ${ROUTE_LABELS[invoice.route] || invoice.route} — ${invoice.days || 5} jours / days</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ebe0;font-size:12px;text-align:center">${invoice.days || 5}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ebe0;font-size:12px;text-align:right">${fmt(invoice.subtotal)}</td>
    </tr>
  ` : (orders || []).map(o => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ebe0;font-size:12px">${o.date ? new Date(o.date).toISOString().split('T')[0] : ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ebe0;font-size:12px">${o.address || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ebe0;font-size:12px;text-align:center">${o.boxes || 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ebe0;font-size:12px;text-align:right">${fmt(o.amount)}</td>
    </tr>
  `).join('');

  const colHeader = isContract ? 'Jours / Days' : 'Boîtes';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; color: #1A1208; background: white; }
  .page { width: 816px; min-height: 1056px; padding: 48px; }
</style>
</head>
<body>
<div class="page">

  <table width="100%" style="margin-bottom:40px">
    <tr>
      <td style="vertical-align:top">
        <div style="font-size:28px;font-weight:bold;color:#1A1208;letter-spacing:1px">🦅</div>
        <div style="font-size:16px;font-weight:bold;color:#1A1208;margin-top:4px">TRANSPORTEUR NATIONAL MC INC.</div>
        <div style="font-size:11px;color:#666;margin-top:8px;line-height:1.8">
          No. d'entreprise 1179231510<br>
          3405 Rue de la licorne<br>
          Terrebonne, Quebec J6X 3Z7<br>
          1-800-410-5330<br>
          transporteurnationalmc@gmail.com
        </div>
      </td>
      <td style="vertical-align:top;text-align:right">
        <div style="font-size:22px;font-weight:bold;color:#C0392B">FACTURE</div>
        <div style="font-size:14px;font-weight:bold;margin-top:8px">No. ${invoice.id}</div>
        <div style="font-size:12px;color:#666;margin-top:4px">${dateFrom} – ${dateTo}</div>
        ${isContract ? `<div style="font-size:11px;color:#C0392B;margin-top:4px;font-weight:bold">Route ${ROUTE_LABELS[invoice.route] || invoice.route}</div>` : ''}
        <div style="font-size:11px;color:#666;margin-top:4px">TPS: 784789315RT0001</div>
        <div style="font-size:11px;color:#666">TVQ: 1224260784TQ0001</div>
      </td>
    </tr>
  </table>

  <div style="height:2px;background:#1A1208;margin-bottom:30px"></div>

  <div style="margin-bottom:30px">
    <div style="font-size:11px;color:#8B6914;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Facturer à / Bill To</div>
    <div style="font-size:14px;font-weight:bold">${client.name}</div>
    ${client.address ? `<div style="font-size:12px;color:#444;margin-top:4px;line-height:1.8;white-space:pre-line">${client.address}</div>` : ''}
  </div>

  <table width="100%" style="border-collapse:collapse;margin-bottom:30px">
    <thead>
      <tr style="background:#1A1208;color:white">
        <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600">Date</th>
        <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600">Description</th>
        <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:600">${colHeader}</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600">Montant</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <table style="margin-left:auto;min-width:280px">
    <tr>
      <td style="padding:6px 12px;font-size:12px;color:#666">Sous-total / Subtotal</td>
      <td style="padding:6px 12px;font-size:12px;text-align:right">${fmt(invoice.subtotal)}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px;font-size:12px;color:#666">TPS (5%)</td>
      <td style="padding:6px 12px;font-size:12px;text-align:right">${fmt(invoice.tps)}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px;font-size:12px;color:#666">TVQ (9.975%)</td>
      <td style="padding:6px 12px;font-size:12px;text-align:right">${fmt(invoice.tvq)}</td>
    </tr>
    <tr style="border-top:2px solid #1A1208">
      <td style="padding:10px 12px;font-size:14px;font-weight:bold">TOTAL</td>
      <td style="padding:10px 12px;font-size:16px;font-weight:bold;text-align:right;color:#C0392B">${fmt(invoice.total)}</td>
    </tr>
  </table>

  <div style="margin-top:60px;padding-top:20px;border-top:1px solid #e0d9cc;text-align:center">
    <div style="font-size:14px;font-weight:bold;color:#8B6914;letter-spacing:2px">MERCI DE VOTRE CONFIANCE</div>
    <div style="font-size:11px;color:#999;margin-top:8px">Payable par virement électronique (EFT)</div>
  </div>

</div>
</body>
</html>`;
}
