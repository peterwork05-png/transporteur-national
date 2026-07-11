import express from 'express';
import pool from '../db/index.js';

const router = express.Router();

// ── ORDERS ──────────────────────────────────────────────

// Clean all orders
router.delete('/orders/clean', async (req, res) => {
  try {
    await pool.query('DELETE FROM orders');
    res.json({ success: true, message: 'All orders deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all orders
router.get('/orders', async (req, res) => {
  try {
    const { date, driver_id, client_id } = req.query;
    let query = `
      SELECT o.*, 
             c.name as client_name, c.address as client_address,
             c.email as client_email, c.phone as client_phone,
             d.name as driver_name, d.initials as driver_initials, d.color as driver_color
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      WHERE 1=1
    `;
    const params = [];
    if (date) { params.push(date); query += ` AND o.date = $${params.length}`; }
    if (driver_id) { params.push(driver_id); query += ` AND o.driver_id = $${params.length}`; }
    if (client_id) { params.push(client_id); query += ` AND o.client_id = $${params.length}`; }
    query += ' ORDER BY o.created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single order
router.get('/orders/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.*, 
             c.name as client_name, c.address as client_address,
             c.email as client_email, c.phone as client_phone,
             d.name as driver_name, d.initials as driver_initials, d.color as driver_color
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      WHERE o.id = $1
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update order status
router.patch('/orders/:id/status', async (req, res) => {
  try {
    const { status, picked_up_at, on_way_at, delivered_at, recipient_name, photo_url, signature_url } = req.body;
    const { rows } = await pool.query(`
      UPDATE orders SET
        status = COALESCE($1, status),
        picked_up_at = COALESCE($2, picked_up_at),
        on_way_at = COALESCE($3, on_way_at),
        delivered_at = COALESCE($4, delivered_at),
        recipient_name = COALESCE($5, recipient_name),
        photo_url = COALESCE($6, photo_url),
        signature_url = COALESCE($7, signature_url),
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [status, picked_up_at, on_way_at, delivered_at, recipient_name, photo_url, signature_url, req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign driver to order
router.patch('/orders/:id/assign', async (req, res) => {
  try {
    const { driver_id } = req.body;
    const { rows } = await pool.query(`
      UPDATE orders SET driver_id = $1, updated_at = NOW()
      WHERE id = $2 RETURNING *
    `, [driver_id, req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create order
router.post('/orders', async (req, res) => {
  try {
    const { id, client_id, driver_id, address, boxes, amount, date, notes, billing_name, billing_email, billing_phone } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO orders (id, client_id, driver_id, address, boxes, amount, date, notes, billing_name, billing_email, billing_phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO NOTHING
      RETURNING *
    `, [id, client_id, driver_id, address, boxes, amount, date || new Date().toISOString().split('T')[0], notes, billing_name, billing_email, billing_phone]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── WOOCOMMERCE WEBHOOK ──────────────────────────────────

router.post('/webhook/woocommerce', async (req, res) => {
  try {
    const order = req.body;
    console.log('WooCommerce webhook received:', JSON.stringify(order).substring(0, 300));

    const wcOrderId = order.id || order.number || Date.now();
    const orderId = `DEL-${new Date().getFullYear()}-${String(wcOrderId).padStart(4, '0')}`;

    const shipping = order.shipping || {};
    const billing = order.billing || {};
    const addr1 = shipping.address_1 || billing.address_1 || '';
    const addr2 = shipping.address_2 || billing.address_2 || '';
    const city = shipping.city || billing.city || '';
    const province = shipping.state || billing.state || '';
    const postal = shipping.postcode || billing.postcode || '';
    const address = [addr1, addr2, city, province, postal].filter(Boolean).join(', ') || 'Address pending';

    const amount = parseFloat(order.total) || 0;
    const boxes = order.line_items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1;
    const notes = order.customer_note || order.order_notes || '';

    // Billing info
    const billingName = `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || billing.company || '';
    const billingEmail = billing.email || '';
    const billingPhone = billing.phone || '';

    // Try to match client by email
    let clientId = null;
    if (billingEmail) {
      const { rows } = await pool.query('SELECT id FROM clients WHERE email = $1', [billingEmail]);
      if (rows.length > 0) clientId = rows[0].id;
    }

    // If no match, create new client
    if (!clientId) {
      const clientName = billing.company || billingName || billingEmail || 'New Client';
      const newClientId = `client_${wcOrderId}`;
      await pool.query(`
        INSERT INTO clients (id, name, address, email, phone, language, signoff)
        VALUES ($1, $2, $3, $4, $5, 'fr', 'MERCI DE VOTRE CONFIANCE!')
        ON CONFLICT (id) DO NOTHING
      `, [newClientId, clientName, address, billingEmail, billingPhone]);
      clientId = newClientId;
    }

    // Add phone to orders table if column exists
    try {
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_name VARCHAR(100)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_email VARCHAR(100)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_phone VARCHAR(50)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT`);
      await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`);
    } catch(e) {}

    await pool.query(`
      INSERT INTO orders (id, client_id, address, boxes, amount, status, date, notes, billing_name, billing_email, billing_phone)
      VALUES ($1, $2, $3, $4, $5, 'waiting', CURRENT_DATE, $6, $7, $8, $9)
      ON CONFLICT (id) DO NOTHING
    `, [orderId, clientId, address, boxes, amount, notes, billingName, billingEmail, billingPhone]);

    console.log(`✅ Order created: ${orderId} | Client: ${clientId} | ${billingName} | ${billingPhone}`);
    res.json({ success: true, order_id: orderId, client_id: clientId });
  } catch (err) {
    console.error('❌ Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DRIVERS ──────────────────────────────────────────────

router.get('/drivers', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM drivers WHERE active = true ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/drivers', async (req, res) => {
  try {
    const { id, name, role, initials, color, pin } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO drivers (id, name, role, initials, color, pin)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [id, name, role, initials, color, pin]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/drivers/:id', async (req, res) => {
  try {
    const { name, pin, role, color } = req.body;
    const { rows } = await pool.query(`
      UPDATE drivers SET
        name = COALESCE($1, name),
        pin = COALESCE($2, pin),
        role = COALESCE($3, role),
        color = COALESCE($4, color)
      WHERE id = $5 RETURNING *
    `, [name, pin, role, color, req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify PIN
router.post('/auth/verify-pin', async (req, res) => {
  try {
    const { type, id, pin } = req.body;
    if (type === 'admin') {
      const { rows } = await pool.query('SELECT * FROM admin_users WHERE pin = $1 AND active = true LIMIT 1', [pin]);
      return res.json({ success: rows.length > 0 });
    }
    if (type === 'driver') {
      const { rows } = await pool.query('SELECT * FROM drivers WHERE id = $1 AND pin = $2 AND active = true', [id, pin]);
      return res.json({ success: rows.length > 0, driver: rows[0] });
    }
    res.status(400).json({ error: 'Invalid type' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CLIENTS ──────────────────────────────────────────────

router.get('/clients', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, address, email, language, signoff, active FROM clients ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/clients', async (req, res) => {
  try {
    const { id, name, address, email, password, language, signoff } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO clients (id, name, address, email, password, language, signoff)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, address, email, language, signoff, active
    `, [id || name.toLowerCase().replace(/\s+/g, '_'), name, address, email, password, language || 'fr', signoff]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/auth/client-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query(
      'SELECT id, name, address, language, signoff FROM clients WHERE email = $1 AND password = $2 AND active = true',
      [email, password]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true, client: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── INVOICES ──────────────────────────────────────────────

router.get('/invoices', async (req, res) => {
  try {
    const { client_id } = req.query;
    let query = `
      SELECT i.*, c.name as client_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (client_id) { params.push(client_id); query += ` AND i.client_id = $${params.length}`; }
    query += ' ORDER BY i.created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/invoices', async (req, res) => {
  try {
    const { type, client_id, route, date_from, date_to, days, subtotal, tps, tvq, total } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO invoices (type, client_id, route, date_from, date_to, days, subtotal, tps, tvq, total)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [type, client_id, route, date_from, date_to, days, subtotal, tps, tvq, total]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/invoices/:id/pay', async (req, res) => {
  try {
    const { eft_number } = req.body;
    const { rows } = await pool.query(`
      UPDATE invoices SET status = 'paid', eft_number = $1, paid_at = NOW()
      WHERE id = $2 RETURNING *
    `, [eft_number, req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── STATS ────────────────────────────────────────────────

router.get('/stats/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { rows: orderStats } = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status IN ('picked','enroute')) as active
      FROM orders WHERE date = $1
    `, [today]);
    const { rows: invoiceStats } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        SUM(total) FILTER (WHERE status = 'pending') as pending_amount,
        COUNT(*) FILTER (WHERE status = 'overdue') as overdue
      FROM invoices
    `);
    res.json({ orders: orderStats[0], invoices: invoiceStats[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
