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
    const { date, driver_id, client_id, days, date_from, date_to, all } = req.query;
    let query = `
      SELECT o.*,
             c.name as client_name, c.address as client_address,
             c.email as client_email,
             d.name as driver_name, d.initials as driver_initials, d.color as driver_color
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      WHERE 1=1
    `;
    const params = [];
    if (all === 'true') {
      // No date filter — return everything
      if (date_from) { params.push(date_from); query += ` AND o.date >= $${params.length}`; }
      if (date_to)   { params.push(date_to);   query += ` AND o.date <= $${params.length}`; }
    } else if (days) {
      query += ` AND o.date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'`;
    } else if (date) {
      params.push(date); query += ` AND o.date = $${params.length}`;
    } else {
      query += ` AND o.date = CURRENT_DATE`;
    }
    if (driver_id) { params.push(driver_id); query += ` AND o.driver_id = $${params.length}`; }
    if (client_id) { params.push(client_id); query += ` AND o.client_id = $${params.length}`; }
    query += ' ORDER BY o.date DESC, o.created_at DESC';
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
    console.log('WooCommerce webhook received:', JSON.stringify(order).substring(0, 500));

    const wcOrderId = order.id || order.number || Date.now();
    const orderId = `DEL-${new Date().getFullYear()}-${String(wcOrderId).padStart(4, '0')}`;

    // Extract custom fields from meta_data
    const meta = {};
    if (order.meta_data && Array.isArray(order.meta_data)) {
      order.meta_data.forEach(m => { meta[m.key] = m.value; });
    }

    // Also check line items meta
    const lineItemMeta = {};
    if (order.line_items && order.line_items.length > 0) {
      order.line_items.forEach(item => {
        if (item.meta_data) item.meta_data.forEach(m => { lineItemMeta[m.key] = m.value; });
      });
    }

    const billing = order.billing || {};
    const shipping = order.shipping || {};

    // Delivery address — use To_dropoff_location if available, fallback to shipping/billing
    const dropoffLocation = meta['To_dropoff_location'] || lineItemMeta['To_dropoff_location'];
    const shippingAddr = [shipping.address_1, shipping.address_2, shipping.city, shipping.state, shipping.postcode].filter(Boolean).join(', ');
    const billingAddr = [billing.address_1, billing.address_2, billing.city, billing.state, billing.postcode].filter(Boolean).join(', ');
    const address = dropoffLocation || shippingAddr || billingAddr || 'Address pending';

    // Pickup location
    const pickupLocation = meta['From_pickup_location'] || lineItemMeta['From_pickup_location'] || '';

    // People
    const fromAssociateName = meta['From_associate_name'] || lineItemMeta['From_associate_name'] || '';
    const fromAssociatePhone = meta['From_associate_phone'] || lineItemMeta['From_associate_phone'] || '';
    const toAssociateName = meta['To_associate_name'] || lineItemMeta['To_associate_name'] || '';
    const toBusinessName = meta['To_business_name'] || lineItemMeta['To_business_name'] || '';
    const toBusinessPhone = meta['To_business_phone'] || lineItemMeta['To_business_phone'] || '';
    const toDeliveredTime = meta['To_delivered_time'] || lineItemMeta['To_delivered_time'] || '';
    const toDropoffDate = meta['To_dropoff_date'] || lineItemMeta['To_dropoff_date'] || '';
    const fromPickupDate = meta['From_pickup_date'] || lineItemMeta['From_pickup_date'] || '';

    // Order details
    const storeNumber = meta['Store_number'] || lineItemMeta['Store_number'] || '';
    const poNumber = meta['Po_number'] || lineItemMeta['Po_number'] || '';
    const typeBoite = meta['Type_boite'] || lineItemMeta['Type_boite'] || '';
    const villePrix = meta['Ville_prix'] || lineItemMeta['Ville_prix'] || '';
    const deliveryNotes = meta['Delivery_order_notes'] || lineItemMeta['Delivery_order_notes'] || order.customer_note || '';
    const quantite = parseInt(meta['Quantite'] || lineItemMeta['Quantite'] || '1');

    const amount = parseFloat(villePrix || order.total) || 0;
    const boxes = quantite || order.line_items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1;

    // Billing info
    const billingName = `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || billing.company || '';
    const billingEmail = meta['Email'] || billing.email || '';
    const billingPhone = fromAssociatePhone || billing.phone || '';

    // Build notes string with all relevant info
    const notesArray = [
      deliveryNotes && `Notes: ${deliveryNotes}`,
      storeNumber && `Store: ${storeNumber}`,
      poNumber && `PO#: ${poNumber}`,
      typeBoite && `Box type: ${typeBoite}`,
      toDeliveredTime && `Requested delivery time: ${toDeliveredTime}`,
      fromAssociateName && `From: ${fromAssociateName}${fromAssociatePhone ? ` (${fromAssociatePhone})` : ''}`,
      pickupLocation && `Pickup: ${pickupLocation}`,
      fromPickupDate && `Pickup date: ${fromPickupDate}`,
      toDropoffDate && `Dropoff date: ${toDropoffDate}`,
    ].filter(Boolean);
    const notes = notesArray.join(' | ');

    // Try to match client by store number or email
    let clientId = null;
    if (storeNumber) {
      const { rows } = await pool.query("SELECT id FROM clients WHERE name ILIKE $1", [`%${storeNumber}%`]);
      if (rows.length > 0) clientId = rows[0].id;
    }
    if (!clientId && billingEmail) {
      const { rows } = await pool.query('SELECT id FROM clients WHERE email = $1', [billingEmail]);
      if (rows.length > 0) clientId = rows[0].id;
    }

    // Create new client if no match
    if (!clientId) {
      const clientName = toBusinessName || billing.company || billingName || billingEmail || 'New Client';
      const newClientId = `client_${wcOrderId}`;
      await pool.query(`
        INSERT INTO clients (id, name, address, email, language, signoff)
        VALUES ($1, $2, $3, $4, 'fr', 'MERCI DE VOTRE CONFIANCE!')
        ON CONFLICT (id) DO NOTHING
      `, [newClientId, clientName, address, billingEmail]);
      clientId = newClientId;
    }

    // Ensure extra columns exist
    try {
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS from_associate_name VARCHAR(100)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_name VARCHAR(100)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_email VARCHAR(100)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_phone VARCHAR(50)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_location TEXT`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS to_associate_name VARCHAR(100)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS to_business_name VARCHAR(100)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS to_business_phone VARCHAR(50)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS po_number VARCHAR(50)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS requested_delivery_time VARCHAR(20)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_number VARCHAR(50)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS type_boite VARCHAR(50)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS to_dropoff_date VARCHAR(20)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS from_pickup_date VARCHAR(20)`);
    } catch(e) { console.log('Column add note:', e.message); }

    await pool.query(`
      INSERT INTO orders (id, client_id, address, boxes, amount, status, date, notes,
        billing_name, billing_email, billing_phone, pickup_location,
        from_associate_name,
        to_associate_name, to_business_name, to_business_phone,
        po_number, requested_delivery_time, store_number, type_boite,
        to_dropoff_date, from_pickup_date)
      VALUES ($1,$2,$3,$4,$5,'waiting',CURRENT_DATE,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT (id) DO NOTHING
    `, [orderId, clientId, address, boxes, amount, notes,
        billingName, billingEmail, billingPhone, pickupLocation,
        fromAssociateName,
        toAssociateName, toBusinessName, toBusinessPhone,
        poNumber, toDeliveredTime, storeNumber, typeBoite,
        toDropoffDate, fromPickupDate]);

    console.log(`✅ Order: ${orderId} | To: ${toAssociateName} at ${address} | Store: ${storeNumber} | PO: ${poNumber}`);
    res.json({ success: true, order_id: orderId, client_id: clientId, to: address, store: storeNumber });
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
    const { name, pin, role, color, initials, active } = req.body;
    const { rows } = await pool.query(`
      UPDATE drivers SET
        name     = COALESCE($1, name),
        pin      = COALESCE($2, pin),
        role     = COALESCE($3, role),
        color    = COALESCE($4, color),
        initials = COALESCE($5, initials),
        active   = COALESCE($6, active)
      WHERE id = $7 RETURNING *
    `, [name, pin, role, color, initials, active, req.params.id]);
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

// ── GPS LOCATION ─────────────────────────────────────────

router.post('/drivers/:id/location', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    await pool.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS last_lat FLOAT`);
    await pool.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS last_lng FLOAT`);
    await pool.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP`);
    await pool.query(
      `UPDATE drivers SET last_lat = $1, last_lng = $2, location_updated_at = NOW() WHERE id = $3`,
      [lat, lng, req.params.id]
    );
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/drivers/:id/location', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT last_lat as lat, last_lng as lng, location_updated_at FROM drivers WHERE id = $1`,
      [req.params.id]
    );
    if (rows.length === 0 || !rows[0].lat) return res.json({ lat: null, lng: null });
    res.json(rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Get all portal clients (for settings page)
router.get('/clients/portal', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, email, password, role, client_group, active
      FROM clients 
      WHERE active = true 
      AND role IS NOT NULL
      AND email IS NOT NULL
      ORDER BY client_group, role DESC
    `);
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Disable/update a client
router.patch('/clients/:id', async (req, res) => {
  try {
    const { active, password, name, role } = req.body;
    const { rows } = await pool.query(`
      UPDATE clients SET
        active   = COALESCE($1, active),
        password = COALESCE($2, password),
        name     = COALESCE($3, name),
        role     = COALESCE($4, role)
      WHERE id = $5 RETURNING id, name, email, role, client_group, active
    `, [active, password, name, role, req.params.id]);
    res.json(rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Change admin PIN
router.post('/admin/change-pin', async (req, res) => {
  try {
    const { currentPin, newPin } = req.body;
    const { rows } = await pool.query(
      'SELECT * FROM admin_users WHERE pin = $1 AND active = true LIMIT 1',
      [currentPin]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Current PIN is incorrect' });
    await pool.query('UPDATE admin_users SET pin = $1 WHERE active = true', [newPin]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Update invoice type
router.patch('/invoices/:id/type', async (req, res) => {
  try {
    const { type } = req.body;
    const { rows } = await pool.query(
      `UPDATE invoices SET type = $1 WHERE id = $2 RETURNING *`,
      [type, req.params.id]
    );
    res.json(rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Stats for payments page
router.get('/stats/payments', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(SUM(total) FILTER (WHERE status = 'paid'), 0) as collected_ytd,
        COALESCE(SUM(total) FILTER (WHERE status = 'pending'), 0) as pending,
        COALESCE(SUM(total) FILTER (WHERE status = 'overdue'), 0) as overdue
      FROM invoices
      WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
    `);
    res.json(rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Preview reminder email
router.post('/invoices/reminder-preview', async (req, res) => {
  try {
    const { invoiceId } = req.body;

    const { rows } = await pool.query(`
      SELECT i.*, c.name as client_name, c.email as client_email, c.client_group
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.id = $1
    `, [invoiceId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const inv = rows[0];

    const { rows: contacts } = await pool.query(`
      SELECT email FROM clients 
      WHERE client_group = (SELECT client_group FROM clients WHERE id = $1 LIMIT 1)
      AND role = 'finance' AND active = true
    `, [inv.client_id]);

    if (contacts.length === 0) return res.status(400).json({ error: 'No finance contact found for this client' });

    const toEmails = contacts.map(c => c.email).join(', ');
    const total    = `$${parseFloat(inv.total || 0).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`;
    const dateFrom = inv.date_from ? new Date(inv.date_from).toISOString().split('T')[0] : '';
    const dateTo   = inv.date_to   ? new Date(inv.date_to).toISOString().split('T')[0]   : '';

    res.json({
      success: true,
      to: toEmails,
      subject: `Rappel de paiement / Payment Reminder — Invoice #${invoiceId}`,
      dateFrom,
      dateTo,
      total,
      hasPdf: !!inv.pdf_url,
      clientName: inv.client_name,
    });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Send payment reminder email
router.post('/invoices/send-reminder', async (req, res) => {
  try {
    const { invoiceId, to, subject, note } = req.body;

    const { rows } = await pool.query(`
      SELECT i.*, c.name as client_name, c.email as client_email
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.id = $1
    `, [invoiceId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const inv = rows[0];

    // Use provided 'to' or fall back to finance contacts
    let toEmails = to;
    if (!toEmails) {
      const { rows: contacts } = await pool.query(`
        SELECT email FROM clients 
        WHERE client_group = (SELECT client_group FROM clients WHERE id = $1 LIMIT 1)
        AND role = 'finance' AND active = true
      `, [inv.client_id]);
      if (contacts.length === 0) return res.status(400).json({ error: 'No finance contact found' });
      toEmails = contacts.map(c => c.email).join(', ');
    }

    const emailSubject = subject || `Rappel de paiement / Payment Reminder — Invoice #${invoiceId}`;
    const total    = `$${parseFloat(inv.total || 0).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`;
    const dateFrom = inv.date_from ? new Date(inv.date_from).toISOString().split('T')[0] : '';
    const dateTo   = inv.date_to   ? new Date(inv.date_to).toISOString().split('T')[0]   : '';

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
    });

    const noteHtml = note ? `
      <div style="background:#FEF3C7;border-radius:8px;padding:12px;margin-bottom:16px;border:1px solid #D97706">
        <p style="margin:0;color:#92400E;font-size:13px">${note}</p>
      </div>` : '';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1A1208;padding:20px;text-align:center;border-radius:12px 12px 0 0">
          <h1 style="color:#FAF7F0;margin:0;font-size:20px">🦅 Transporteur National MC INC.</h1>
        </div>
        <div style="padding:30px;background:#FAF7F0">
          ${noteHtml}
          <p style="color:#1A1208">Bonjour / Hello,</p>
          <p style="color:#1A1208">Ceci est un rappel amical concernant la facture suivante qui est toujours en attente de paiement.</p>
          <p style="color:#1A1208">This is a friendly reminder regarding the following invoice which is still pending payment.</p>
          
          <div style="background:white;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #e0d9cc">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="color:#8B6914;font-size:12px;padding:4px 0">Invoice #</td><td style="font-weight:bold;padding:4px 0">#${inv.id}</td></tr>
              <tr><td style="color:#8B6914;font-size:12px;padding:4px 0">Period</td><td style="padding:4px 0">${dateFrom} – ${dateTo}</td></tr>
              <tr><td style="color:#8B6914;font-size:12px;padding:4px 0">Type</td><td style="padding:4px 0">${inv.type === 'contract' ? `Contract · ${inv.route} route` : 'Local deliveries'}</td></tr>
              <tr style="border-top:1px solid #e0d9cc">
                <td style="color:#8B6914;font-size:12px;padding:8px 0 4px;font-weight:bold">TOTAL DUE</td>
                <td style="padding:8px 0 4px;font-weight:bold;font-size:18px;color:#C0392B">${total}</td>
              </tr>
            </table>
          </div>

          ${inv.pdf_url ? `<p style="color:#1A1208">📄 <a href="${inv.pdf_url}" style="color:#C0392B">Click here to view/download your invoice PDF</a></p>` : ''}

          <p style="color:#1A1208">Pour effectuer votre paiement par virement électronique / To make payment by EFT:</p>
          <div style="background:white;border-radius:8px;padding:12px;margin:10px 0;border:1px solid #e0d9cc">
            <p style="margin:0;color:#1A1208"><strong>Transporteur National MC INC.</strong></p>
            <p style="margin:4px 0;color:#8B6914;font-size:13px">TPS: 784789315RT0001 | TVQ: 1224260784TQ0001</p>
          </div>

          <p style="color:#1A1208">Si vous avez des questions, n'hésitez pas à nous contacter. / If you have any questions, please don't hesitate to contact us.</p>
          <p style="color:#1A1208">Merci / Thank you,<br><strong>Transporteur National MC INC.</strong><br>
          📧 transporteurnationalmc@gmail.com</p>
        </div>
        <div style="background:#1A1208;padding:12px;text-align:center;border-radius:0 0 12px 12px">
          <p style="color:rgba(250,247,240,0.4);font-size:11px;margin:0">MERCI DE VOTRE CONFIANCE!</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Transporteur National MC" <${process.env.GMAIL_USER}>`,
      to: toEmails,
      subject: emailSubject,
      html,
    });

    console.log(`📧 Reminder sent for invoice #${invoiceId} to ${toEmails}`);
    res.json({ success: true, sentTo: toEmails });
  } catch(err) {
    console.error('Send reminder error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

// ── GMAIL AUTO-MATCHING ───────────────────────────────────

router.post('/gmail/check', async (req, res) => {
  try {
    const { checkGmailRemittances } = await import('./gmail.js');
    const results = await checkGmailRemittances();
    res.json(results);
  } catch (err) {
    console.error('Gmail check error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/gmail/status', async (req, res) => {
  res.json({
    configured: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
    email: process.env.GMAIL_USER || null,
  });
});
// ── WOOCOMMERCE IMPORT ────────────────────────────────────

router.post('/import/woocommerce', async (req, res) => {
  try {
    const { month, year } = req.body;
    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear  = year  || new Date().getFullYear();

    const WC_URL     = 'https://transporteurnationalmc.com/wp-json/wc/v3';
    const WC_KEY     = 'ck_dbc25f00ebbcd23ae64695dbc38145ad50fd65a9';
    const WC_SECRET  = 'cs_ee1eaa98cacd62619dd0e67f2c719a848ae864c6';
    const auth       = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString('base64');

    // Date range for the month
    const dateMin = `${targetYear}-${String(targetMonth).padStart(2,'0')}-01T00:00:00`;
    const dateMax = `${targetYear}-${String(targetMonth).padStart(2,'0')}-31T23:59:59`;

    console.log(`📦 Importing WooCommerce orders for ${targetMonth}/${targetYear}...`);

    let allOrders = [];
    let page = 1;
    let hasMore = true;

    // Fetch all pages
    while (hasMore) {
      const url = `${WC_URL}/orders?after=${dateMin}&before=${dateMax}&per_page=100&page=${page}&status=any`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const err = await response.text();
        return res.status(400).json({ error: `WooCommerce API error: ${err}` });
      }

      const orders = await response.json();
      if (orders.length === 0) { hasMore = false; break; }
      allOrders = [...allOrders, ...orders];
      page++;
      if (orders.length < 100) hasMore = false;
    }

    console.log(`📦 Found ${allOrders.length} orders to import`);

    let imported = 0, skipped = 0, errors = 0;
    const results = [];

    // Ensure columns exist
    try {
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_name VARCHAR(100)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_email VARCHAR(100)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_phone VARCHAR(50)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_location TEXT`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS from_associate_name VARCHAR(100)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS to_associate_name VARCHAR(100)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS to_business_name VARCHAR(100)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS to_business_phone VARCHAR(50)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS po_number VARCHAR(50)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS requested_delivery_time VARCHAR(20)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_number VARCHAR(50)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS type_boite VARCHAR(50)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS to_dropoff_date VARCHAR(20)`);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS from_pickup_date VARCHAR(20)`);
    } catch(e) {}

    for (const order of allOrders) {
      try {
        const wcOrderId = order.id;
        const orderId   = `DEL-${targetYear}-${String(wcOrderId).padStart(4,'0')}`;

        // Extract meta_data custom fields
        const meta = {};
        if (order.meta_data) {
          order.meta_data.forEach(m => { meta[m.key] = m.value; });
        }

        const billing  = order.billing  || {};
        const shipping = order.shipping || {};

        // Delivery address — prefer To_dropoff_location
        const dropoff = meta['To_dropoff_location'] || '';
        const shippingAddr = [shipping.address_1, shipping.city, shipping.state].filter(Boolean).join(', ');
        const billingAddr  = [billing.address_1,  billing.city,  billing.state].filter(Boolean).join(', ');
        const address = dropoff || shippingAddr || billingAddr || 'Address pending';

        const amount   = parseFloat(meta['Ville_prix'] || order.total || 0);
        const boxes    = parseInt(meta['Quantite'] || '1') || 1;
        const notes    = meta['Delivery_order_notes'] || order.customer_note || '';
        const storeNum = meta['Store_number'] || '';
        const poNum    = meta['Po_number']    || '';
        const typeBoite= meta['Type_boite']   || '';
        const toTime   = meta['To_delivered_time'] || '';
        const toDate   = meta['To_dropoff_date']   || '';
        const fromDate = meta['From_pickup_date']   || '';
        const fromName = meta['From_associate_name']|| '';
        const fromPhone= meta['From_associate_phone']|| '';
        const toName   = meta['To_associate_name'] || '';
        const toBiz    = meta['To_business_name']  || '';
        const toBizPh  = meta['To_business_phone'] || '';
        const pickupLoc= meta['From_pickup_location'] || '';

        const billingName  = `${billing.first_name||''} ${billing.last_name||''}`.trim() || billing.company || '';
        const billingEmail = meta['Email'] || billing.email || '';
        const billingPhone = fromPhone || billing.phone || '';

        // Order date
        const orderDate = order.date_created
          ? order.date_created.split('T')[0]
          : new Date().toISOString().split('T')[0];

        // Map WC status to our status
        const statusMap = {
          'completed':  'delivered',
          'processing': 'waiting',
          'pending':    'waiting',
          'on-hold':    'waiting',
          'cancelled':  'waiting',
          'refunded':   'waiting',
        };
        const status = statusMap[order.status] || 'waiting';

        // Match client by store number first, then email
        let clientId = null;
        if (storeNum) {
          const { rows } = await pool.query("SELECT id FROM clients WHERE name ILIKE $1", [`%${storeNum}%`]);
          if (rows.length > 0) clientId = rows[0].id;
        }
        if (!clientId && billingEmail) {
          const { rows } = await pool.query('SELECT id FROM clients WHERE email = $1', [billingEmail]);
          if (rows.length > 0) clientId = rows[0].id;
        }
        if (!clientId) {
          const clientName = toBiz || billing.company || billingName || billingEmail || 'New Client';
          const newClientId = `client_wc_${wcOrderId}`;
          await pool.query(`
            INSERT INTO clients (id, name, address, email, language, signoff)
            VALUES ($1, $2, $3, $4, 'fr', 'MERCI DE VOTRE CONFIANCE!')
            ON CONFLICT (id) DO NOTHING
          `, [newClientId, clientName, address, billingEmail]);
          clientId = newClientId;
        }

        // Insert order — skip if already exists
        const { rows } = await pool.query(`
          INSERT INTO orders (
            id, client_id, address, boxes, amount, status, date, notes,
            billing_name, billing_email, billing_phone, pickup_location,
            from_associate_name, to_associate_name, to_business_name, to_business_phone,
            po_number, requested_delivery_time, store_number, type_boite,
            to_dropoff_date, from_pickup_date
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
          )
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `, [
          orderId, clientId, address, boxes, amount, status, orderDate, notes,
          billingName, billingEmail, billingPhone, pickupLoc,
          fromName, toName, toBiz, toBizPh,
          poNum, toTime, storeNum, typeBoite,
          toDate, fromDate
        ]);

        if (rows.length > 0) {
          imported++;
          results.push({ id: orderId, status, address, amount });
        } else {
          skipped++;
        }
      } catch(e) {
        console.error(`Error importing order ${order.id}:`, e.message);
        errors++;
      }
    }

    console.log(`✅ Import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);
    res.json({ success: true, total: allOrders.length, imported, skipped, errors, sample: results.slice(0,5) });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── CLIENT PORTAL SETUP ───────────────────────────────────

router.post('/setup/clients', async (req, res) => {
  try {
    // Add role column if not exists
    await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'ops'`);
    await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS password VARCHAR(100)`);

    const clients = [
      // Jonarts
      { id:'jonarts_ops',     name:'Jonarts Printing',     email:'tanya@jonarts.com',          password:'jonarts2026', role:'ops',     clientGroup:'jonarts' },
      { id:'jonarts_finance', name:'Jonarts Printing',     email:'accounting@jonarts.com',      password:'jonarts2026', role:'finance', clientGroup:'jonarts' },
      // Bureau en Gros
      { id:'beg_ops',         name:'Bureau en Gros #299',  email:'s299pc@staples.com',          password:'staples2026', role:'ops',     clientGroup:'beg' },
      { id:'beg_finance1',    name:'Bureau en Gros #299',  email:'yves.courteau@staples.ca',    password:'staples2026', role:'finance', clientGroup:'beg' },
      { id:'beg_finance2',    name:'Bureau en Gros #299',  email:'lise.fortin@staples.ca',      password:'staples2026', role:'finance', clientGroup:'beg' },
      // A&E Bath
      { id:'aebath_finance1', name:'A&E Bath and Shower',  email:'accounting@aebath.com',       password:'aebath2026',  role:'finance', clientGroup:'aebath' },
      { id:'aebath_finance2', name:'A&E Bath and Shower',  email:'nicolas@aebath.com',          password:'aebath2026',  role:'finance', clientGroup:'aebath' },
    ];

    for (const c of clients) {
      await pool.query(`
        INSERT INTO clients (id, name, email, password, role, language, signoff, active)
        VALUES ($1, $2, $3, $4, $5, 'fr', 'MERCI DE VOTRE CONFIANCE!', true)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          password = EXCLUDED.password,
          role = EXCLUDED.role,
          name = EXCLUDED.name
      `, [c.id, c.name, c.email, c.password, c.role]);
    }

    // Add client_group column to link logins to the same company
    await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_group VARCHAR(50)`);
    for (const c of clients) {
      await pool.query(`UPDATE clients SET client_group = $1 WHERE id = $2`, [c.clientGroup, c.id]);
    }

    res.json({ success: true, message: `${clients.length} client logins configured` });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Updated client login — returns role and client_group
router.post('/auth/client-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query(
      `SELECT id, name, email, role, client_group, language, signoff 
       FROM clients 
       WHERE LOWER(email) = LOWER($1) AND password = $2 AND active = true`,
      [email, password]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true, client: rows[0] });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Get orders for a client group
router.get('/client/orders', async (req, res) => {
  try {
    const { client_group, period } = req.query;
    let dateFilter = '';
    if (period === 'today')  dateFilter = `AND o.date = CURRENT_DATE`;
    if (period === '7days')  dateFilter = `AND o.date >= CURRENT_DATE - INTERVAL '7 days'`;
    if (period === 'month')  dateFilter = `AND o.date >= DATE_TRUNC('month', CURRENT_DATE)`;

    const { rows } = await pool.query(`
      SELECT o.*, d.name as driver_name, d.color as driver_color, d.initials as driver_initials
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN clients c ON o.client_id = c.id
      WHERE c.client_group = $1 ${dateFilter}
      ORDER BY o.date DESC, o.created_at DESC
    `, [client_group]);
    res.json(rows);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Get invoices for a client group
router.get('/client/invoices', async (req, res) => {
  try {
    const { client_group, status } = req.query;
    let statusFilter = '';
    if (status && status !== 'all') statusFilter = `AND i.status = '${status}'`;

    const { rows } = await pool.query(`
      SELECT i.*, c.name as client_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE c.client_group = $1 ${statusFilter}
      ORDER BY i.created_at DESC
    `, [client_group]);
    res.json(rows);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PDF UPLOAD ────────────────────────────────────────────

router.post('/invoices/:id/upload-pdf', async (req, res) => {
  try {
    const { pdfBase64 } = req.body;
    
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey    = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Cloudinary not configured' });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const publicId  = `invoices/invoice_${req.params.id}`;
    
    // SHA1 signature required by Cloudinary
    const { createHash } = await import('crypto');
    const sigStr   = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = createHash('sha1').update(sigStr).digest('hex');

    // Build multipart body manually
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const fields = {
      file: `data:application/pdf;base64,${pdfBase64}`,
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: apiKey,
      signature,
    };

    let body = '';
    for (const [key, value] of Object.entries(fields)) {
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
      body += `${value}\r\n`;
    }
    body += `--${boundary}--\r\n`;

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body,
      }
    );

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok || uploadData.error) {
      console.error('Cloudinary error:', JSON.stringify(uploadData));
      return res.status(400).json({ error: uploadData.error?.message || 'Upload failed' });
    }

    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_url TEXT`);
    await pool.query(`UPDATE invoices SET pdf_url = $1 WHERE id = $2`, [uploadData.secure_url, req.params.id]);

    res.json({ success: true, pdf_url: uploadData.secure_url });
  } catch(err) {
    console.error('PDF upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── CREATE JULY INVOICES ──────────────────────────────────
router.post('/setup/create-invoices', async (req, res) => {
  try {
    const invoices = [
      { id:586, client_id:'jonarts_ops',   type:'local',    route:null,       date_from:'2026-07-01', date_to:'2026-07-01', days:null, subtotal:254.97,  tps:12.75,  tvq:25.43,  total:293.15  },
      { id:590, client_id:'beg_ops',       type:'contract', route:'ontario',  date_from:'2026-06-29', date_to:'2026-07-03', days:5,    subtotal:3749.95, tps:187.50, tvq:374.06, total:4311.51 },
      { id:591, client_id:'beg_ops',       type:'contract', route:'quebec',   date_from:'2026-06-29', date_to:'2026-07-03', days:5,    subtotal:2925.00, tps:146.25, tvq:291.77, total:3363.02 },
      { id:592, client_id:'beg_ops',       type:'local',    route:null,       date_from:'2026-06-15', date_to:'2026-06-30', days:null, subtotal:1207.77, tps:60.39,  tvq:120.47, total:1388.63 },
      { id:593, client_id:'beg_ops',       type:'contract', route:'ontario',  date_from:'2026-07-06', date_to:'2026-07-10', days:5,    subtotal:3749.95, tps:187.50, tvq:374.06, total:4311.51 },
      { id:594, client_id:'beg_ops',       type:'contract', route:'quebec',   date_from:'2026-07-06', date_to:'2026-07-10', days:5,    subtotal:2925.00, tps:146.25, tvq:291.77, total:3363.02 },
      { id:595, client_id:'jonarts_ops',   type:'local',    route:null,       date_from:'2026-07-01', date_to:'2026-07-17', days:null, subtotal:127.48,  tps:6.37,   tvq:12.72,  total:146.57  },
      { id:597, client_id:'beg_ops',       type:'contract', route:'ontario',  date_from:'2026-07-13', date_to:'2026-07-17', days:5,    subtotal:3749.95, tps:187.50, tvq:374.06, total:4311.51 },
      { id:598, client_id:'beg_ops',       type:'contract', route:'quebec',   date_from:'2026-07-13', date_to:'2026-07-17', days:5,    subtotal:2925.00, tps:146.25, tvq:291.77, total:3363.02 },
      { id:599, client_id:'beg_ops',       type:'local',    route:null,       date_from:'2026-07-01', date_to:'2026-07-15', days:null, subtotal:864.83,  tps:43.24,  tvq:86.27,  total:994.34  },
    ];

    let created = 0;
    for (const inv of invoices) {
      const { rows } = await pool.query(`
        INSERT INTO invoices (id, client_id, type, route, date_from, date_to, days, subtotal, tps, tvq, total, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `, [inv.id, inv.client_id, inv.type, inv.route, inv.date_from, inv.date_to, inv.days, inv.subtotal, inv.tps, inv.tvq, inv.total]);
      if (rows.length > 0) created++;
    }

    res.json({ success: true, created, message: `${created} invoices created` });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});
