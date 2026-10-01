import pool from '../db/index.js';

const TPS = 0.05;
const TVQ = 0.09975;

export async function generateLocalInvoices(dateFrom, dateTo, clientGroup) {
  try {
    console.log(`📄 Generating local invoices from ${dateFrom} to ${dateTo}`);

    const cgQuery = clientGroup
      ? `SELECT DISTINCT ON (c.client_group) c.client_group, c.name, c.id FROM clients c WHERE c.client_group = $1 AND c.role = 'ops' AND c.active = true`
      : `SELECT DISTINCT ON (c.client_group) c.client_group, c.name, c.id FROM clients c WHERE c.role = 'ops' AND c.active = true AND c.client_group IS NOT NULL ORDER BY c.client_group, c.id`;

    const cgParams = clientGroup ? [clientGroup] : [];
    const { rows: clientGroups } = await pool.query(cgQuery, cgParams);
    const results = [];

    for (const { client_group, name, id: clientId } of clientGroups) {
      const { rows: orders } = await pool.query(`
        SELECT o.* FROM orders o
        LEFT JOIN clients c ON o.client_id = c.id
        WHERE c.client_group = $1
          AND o.status = 'delivered'
          AND o.date >= $2
          AND o.date <= $3
        ORDER BY o.date ASC
      `, [client_group, dateFrom, dateTo]);

      if (orders.length === 0) continue;

      const subtotal = orders.reduce((sum, o) => sum + parseFloat(o.amount || 0), 0);
      if (subtotal === 0) continue;

      const tps   = subtotal * TPS;
      const tvq   = subtotal * TVQ;
      const total = subtotal + tps + tvq;

      // Get next invoice number continuing from highest existing
      const { rows: lastInv } = await pool.query(`SELECT MAX(id) as last_id FROM invoices`);
      const nextId = (parseInt(lastInv[0].last_id) || 599) + 1;

      const { rows: inv } = await pool.query(`
        INSERT INTO invoices (id, client_id, type, date_from, date_to, subtotal, tps, tvq, total, status)
        VALUES ($1, $2, 'local', $3, $4, $5, $6, $7, $8, 'pending')
        RETURNING id
      `, [nextId, clientId, dateFrom, dateTo,
          subtotal.toFixed(2), tps.toFixed(2), tvq.toFixed(2), total.toFixed(2)]);

      results.push({
        invoiceId:   inv[0].id,
        client_group,
        clientName:  name,
        orderCount:  orders.length,
        subtotal:    subtotal.toFixed(2),
        total:       total.toFixed(2),
        period:      `${dateFrom} – ${dateTo}`,
      });

      console.log(`✅ Invoice #${inv[0].id} for ${name}: $${total.toFixed(2)} (${orders.length} orders)`);
    }

    return { success: true, invoices: results };
  } catch(err) {
    console.error('Auto-invoice error:', err);
    return { success: false, error: err.message };
  }
}

export function getInvoicePeriods(date = new Date()) {
  const year    = date.getFullYear();
  const month   = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    period1: {
      from: new Date(year, month, 1).toISOString().split('T')[0],
      to:   new Date(year, month, 15).toISOString().split('T')[0],
    },
    period2: {
      from: new Date(year, month, 16).toISOString().split('T')[0],
      to:   new Date(year, month, lastDay).toISOString().split('T')[0],
    },
  };
}
export async function generateUAPInvoice(dateFrom, dateTo) {
  try {
    const HOURLY_RATE = 24;
    const HOURS_PER_DAY = 9; // Change to 8 if break is unpaid

    // Count working days (Mon-Fri) in the period
    const start = new Date(dateFrom);
    const end   = new Date(dateTo);
    let workDays = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day >= 1 && day <= 5) workDays++;
    }

    const subtotal = workDays * HOURS_PER_DAY * HOURLY_RATE;
    const tps      = subtotal * TPS;
    const tvq      = subtotal * TVQ;
    const total    = subtotal + tps + tvq;

    const { rows: lastInv } = await pool.query(`SELECT MAX(id) as last_id FROM invoices`);
    const nextId = (parseInt(lastInv[0].last_id) || 599) + 1;

    const { rows: inv } = await pool.query(`
      INSERT INTO invoices (id, client_id, type, route, date_from, date_to, days, subtotal, tps, tvq, total, status)
      VALUES ($1, 'uap', 'contract', 'UAP St-Sauveur', $2, $3, $4, $5, $6, $7, $8, 'pending')
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `, [nextId, dateFrom, dateTo, workDays,
        subtotal.toFixed(2), tps.toFixed(2), tvq.toFixed(2), total.toFixed(2)]);

    console.log(`✅ UAP Invoice #${nextId}: ${workDays} days × ${HOURS_PER_DAY}h × $${HOURLY_RATE} = $${total.toFixed(2)}`);
    return { success: true, invoiceId: nextId, workDays, subtotal, total };
  } catch(err) {
    console.error('UAP invoice error:', err);
    return { success: false, error: err.message };
  }
}
