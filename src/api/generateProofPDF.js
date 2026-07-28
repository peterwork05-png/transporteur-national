export function generateProofHTML(order) {
  const fmt = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('fr-CA') : '—';
  const deliveredAt = order.delivered_at ? new Date(order.delivered_at).toLocaleString('fr-CA') : '—';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; color: #1A1208; background: white; }
  .page { width: 816px; min-height: 1056px; padding: 48px; }
  .section { margin-bottom: 24px; }
  .label { font-size: 11px; color: #8B6914; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .value { font-size: 13px; font-weight: 600; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .box { background: #FAF7F0; border-radius: 8px; padding: 12px; }
  img { width: 100%; border-radius: 8px; object-fit: cover; }
  .divider { height: 2px; background: #1A1208; margin: 24px 0; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <table width="100%" style="margin-bottom:32px">
    <tr>
      <td>
        <div style="font-size:26px;font-weight:bold">🦅 TRANSPORTEUR NATIONAL MC INC.</div>
        <div style="font-size:11px;color:#666;margin-top:6px;line-height:1.8">
          3405 Rue de la licorne, Terrebonne, Quebec J6X 3Z7<br>
          1-800-410-5330 · transporteurnationalmc@gmail.com
        </div>
      </td>
      <td style="text-align:right;vertical-align:top">
        <div style="font-size:20px;font-weight:bold;color:#C0392B">PREUVE DE LIVRAISON</div>
        <div style="font-size:12px;color:#666;margin-top:4px">PROOF OF DELIVERY</div>
        <div style="font-size:13px;font-weight:bold;margin-top:8px">${order.id}</div>
      </td>
    </tr>
  </table>

  <div class="divider"></div>

  <!-- Order Details -->
  <div class="section">
    <div class="grid">
      <div class="box">
        <div class="label">Adresse de livraison / Delivery address</div>
        <div class="value">${order.address || '—'}</div>
      </div>
      <div class="box">
        <div class="label">Date de livraison / Delivered on</div>
        <div class="value">${deliveredAt}</div>
      </div>
      <div class="box">
        <div class="label">Reçu par / Received by</div>
        <div class="value">${order.recipient_name || '—'}</div>
      </div>
      <div class="box">
        <div class="label">Nombre de boîtes / Boxes</div>
        <div class="value">${order.boxes || 1}</div>
      </div>
      ${order.store_number ? `<div class="box">
        <div class="label">Store #</div>
        <div class="value">${order.store_number}</div>
      </div>` : ''}
      ${order.po_number ? `<div class="box">
        <div class="label">PO #</div>
        <div class="value">${order.po_number}</div>
      </div>` : ''}
    </div>
  </div>

  <!-- Photo -->
  ${order.photo_url ? `
  <div class="section">
    <div class="label" style="margin-bottom:8px">📷 Photo de livraison / Delivery photo</div>
    <img src="${order.photo_url}" style="max-height:300px;width:auto" alt="Delivery photo" />
  </div>` : ''}

  <!-- Signature -->
  ${order.signature_url ? `
  <div class="section">
    <div class="label" style="margin-bottom:8px">✍️ Signature — ${order.recipient_name || ''}</div>
    <div style="background:white;border:1px solid #e0d9cc;border-radius:8px;padding:8px;display:inline-block">
      <img src="${order.signature_url}" style="max-height:120px;width:auto" alt="Signature" />
    </div>
  </div>` : ''}

  <!-- Footer -->
  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e0d9cc;text-align:center">
    <div style="font-size:13px;font-weight:bold;color:#8B6914;letter-spacing:2px">MERCI DE VOTRE CONFIANCE</div>
    <div style="font-size:11px;color:#999;margin-top:4px">Ce document constitue une preuve officielle de livraison.</div>
    <div style="font-size:11px;color:#999">This document constitutes official proof of delivery.</div>
  </div>

</div>
</body>
</html>`;
}

