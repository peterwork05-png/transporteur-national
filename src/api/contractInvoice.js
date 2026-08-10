import pool from '../db/index.js';

const TPS = 0.05;
const TVQ = 0.09975;

const CONTRACT_RATES = {
  ontario: { daily: 749.99, client_id: 'beg_ops', route: 'ontario' },
  quebec:  { daily: 585.00, client_id: 'beg_ops', route: 'quebec'  },
};

// Get Monday and Friday of the previous week
export function getPreviousWeekDates(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  // Go back to last Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  // Friday is 4 days after Monday
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  return {
    from: monday.toISOString().split('T')[0],
    to:   friday.toISOString().split('T')[0],
  };
}

// Generate contract invoices for a week
export async function generateContractInvoices(dateFrom, dateTo, days = 5) {
  try {
    console.log(`📄 Generating contract invoices from ${dateFrom} to ${dateTo} (${days} days)`);
    const results = [];

    for (const [routeName, config] of Object.entries(CONTRACT_RATES)) {
      const subtotal = config.daily * days;
      const tps      = subtotal * TPS;
      const tvq      = subtotal * TVQ;
      const total    = subtotal + tps + tvq;

      // Get next invoice number
      const { rows: lastInv } = await pool.query(`SELECT MAX(id) as last_id FROM invoices`);
      const nextId = (parseInt(lastInv[0].last_id) || 599) + 1;

      const { rows: inv } = await pool.query(`
        INSERT INTO invoices (id, client_id, type, route, date_from, date_to, days, subtotal, tps, tvq, total, status)
        VALUES ($1, $2, 'contract', $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
        RETURNING id
      `, [nextId, config.client_id, routeName, dateFrom, dateTo, days,
          subtotal.toFixed(2), tps.toFixed(2), tvq.toFixed(2), total.toFixed(2)]);

      results.push({
        invoiceId:  inv[0].id,
        route:      routeName,
        clientId:   config.client_id,
        days,
        subtotal:   subtotal.toFixed(2),
        total:      total.toFixed(2),
        period:     `${dateFrom} – ${dateTo}`,
      });

      console.log(`✅ Contract invoice #${inv[0].id} for ${routeName}: $${total.toFixed(2)} (${days} days)`);
    }

    return { success: true, invoices: results };
  } catch(err) {
    console.error('Contract invoice error:', err);
    return { success: false, error: err.message };
  }
}
