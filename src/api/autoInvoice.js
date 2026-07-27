import pool from '../db/index.js';

const TPS = 0.05;
const TVQ = 0.09975;

// Generate local invoices for a given period
export async function generateLocalInvoices(dateFrom, dateTo, clientGroup) {
  try {
    console.log(`📄 Generating local invoices from ${dateFrom} to ${dateTo}`);

    // Get all client groups to process
    const cgQuery = clientGroup
      ? `SELECT DISTINCT c.client_group, c.name FROM clients c WHERE c.client_group = $1 AND c.role = 'ops' AND c.active = true`
      : `SELECT DISTINCT c.client_group, c.name FROM clients c WHERE c.role = 'ops' AND c.active = true AND c.client_group IS NOT NULL`;

    const cgParams = clientGroup ? [clientGroup] : [];
    const { rows: clientGroups } = await pool.query(cgQuery, cgParams);
    const results = [];

    for (const { client_group, name } of clientGroups) {
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

      const { rows: clients } = await pool.query(
        `SELECT id FROM clients WHERE client_group = $1 AND role = 'ops' LIMIT 1`,
        [client_group]
      );
      if (clients.length === 0) continue;

      const { rows: inv } = await pool.query(`
        INSERT INTO invoices (client_id, type, date_from, date_to, subtotal, tps, tvq, total, status)
        VALUES ($1, 'local', $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING id
      `, [clients[0].id, dateFrom, dateTo,
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
