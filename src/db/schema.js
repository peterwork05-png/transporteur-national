import pool from './index.js';

export async function createTables() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Drivers table
      CREATE TABLE IF NOT EXISTS drivers (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        initials VARCHAR(5) NOT NULL,
        color VARCHAR(20) NOT NULL,
        pin VARCHAR(10) NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Clients table
      CREATE TABLE IF NOT EXISTS clients (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        address TEXT,
        email VARCHAR(100),
        password VARCHAR(100),
        language VARCHAR(5) DEFAULT 'fr',
        signoff TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Orders table
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(50) PRIMARY KEY,
        client_id VARCHAR(50) REFERENCES clients(id),
        driver_id VARCHAR(50) REFERENCES drivers(id),
        address TEXT NOT NULL,
        boxes INTEGER DEFAULT 1,
        amount DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'waiting',
        date DATE DEFAULT CURRENT_DATE,
        picked_up_at VARCHAR(20),
        on_way_at VARCHAR(20),
        delivered_at VARCHAR(20),
        photo_url TEXT,
        signature_url TEXT,
        recipient_name VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Invoices table
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        client_id VARCHAR(50) REFERENCES clients(id),
        route VARCHAR(20),
        date_from DATE,
        date_to DATE,
        days INTEGER,
        subtotal DECIMAL(10,2),
        tps DECIMAL(10,2),
        tvq DECIMAL(10,2),
        total DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'pending',
        eft_number VARCHAR(50),
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Payments table
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        eft_number VARCHAR(50) NOT NULL,
        client_id VARCHAR(50) REFERENCES clients(id),
        amount DECIMAL(10,2) NOT NULL,
        payment_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Payment invoices junction table
      CREATE TABLE IF NOT EXISTS payment_invoices (
        payment_id INTEGER REFERENCES payments(id),
        invoice_id INTEGER REFERENCES invoices(id),
        PRIMARY KEY (payment_id, invoice_id)
      );

      -- Route tracking table
      CREATE TABLE IF NOT EXISTS route_days (
        id SERIAL PRIMARY KEY,
        route VARCHAR(20) NOT NULL,
        driver_id VARCHAR(50) REFERENCES drivers(id),
        date DATE DEFAULT CURRENT_DATE,
        started_at VARCHAR(20),
        completed BOOLEAN DEFAULT false,
        holiday BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Route stops table
      CREATE TABLE IF NOT EXISTS route_stops (
        id SERIAL PRIMARY KEY,
        route_day_id INTEGER REFERENCES route_days(id),
        stop_index INTEGER NOT NULL,
        stop_name VARCHAR(100) NOT NULL,
        stop_address TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        arrived_at VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Admin users table
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        pin VARCHAR(10),
        access_level VARCHAR(20) DEFAULT 'full',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Database tables created successfully');
  } catch (err) {
    console.error('❌ Error creating tables:', err);
  } finally {
    client.release();
  }
}

export async function seedData() {
  const client = await pool.connect();
  try {
    // Check if already seeded
    const { rows } = await client.query('SELECT COUNT(*) FROM drivers');
    if (parseInt(rows[0].count) > 0) {
      console.log('✅ Database already seeded');
      return;
    }

    // Seed drivers
    await client.query(`
      INSERT INTO drivers (id, name, role, initials, color, pin) VALUES
      ('marc',    'Marc Dumont',       'local',   'MD', '#C0392B', '1111'),
      ('peter',   'Peter',             'local',   'PE', '#7C3AED', '2222'),
      ('jeanluc', 'Jean-Luc Bergeron', 'ontario', 'JL', '#8B4513', '3333'),
      ('pierre',  'Pierre Tremblay',   'quebec',  'PT', '#0F6E56', '4444')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Seed clients
    await client.query(`
      INSERT INTO clients (id, name, address, email, password, language, signoff) VALUES
      ('beg',     'Bureau en Gros #299',  '4141, aut. 440, Laval, Québec H7P 4W6', 'beg@staples.ca',      'staples2026',  'fr', 'MERCI DE VOTRE CONFIANCE!'),
      ('jonarts', 'JONARTS Printing',     '9010 Ave du Parc, Montreal, QC H7N1Y8', 'orders@jonarts.ca',   'jonarts2026',  'fr', 'MERCI DE VOTRE CONFIANCE!'),
      ('aebath',  'A&E Bath and Shower',  '',                                       'aebath@gmail.com',    'aebath2026',   'en', 'THANK YOU FOR USING TRANSPORTOR INC!')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Seed admin
    await client.query(`
      INSERT INTO admin_users (name, role, pin, access_level) VALUES
      ('Admin', 'Owner', '1234', 'full')
      ON CONFLICT DO NOTHING;
    `);

    // Seed sample orders for today
    const today = new Date().toISOString().split('T')[0];
    await client.query(`
      INSERT INTO orders (id, client_id, driver_id, address, boxes, amount, status, date) VALUES
      ('DEL-2026-0847', 'beg',     'marc',  '2485 Ontario St E, Montréal',              3, 79.99, 'enroute',   $1),
      ('DEL-2026-0848', 'beg',     'marc',  '3434 Masson St, Montréal',                 4, 79.99, 'picked',    $1),
      ('DEL-2026-0849', 'beg',     'marc',  '4545 Wellington St, Montréal',             2, 59.99, 'picked',    $1),
      ('DEL-2026-0844', 'jonarts', 'marc',  '1375 Bd Lionel-Boulet, Varennes',          6, 57.49, 'delivered', $1),
      ('DEL-2026-0843', 'aebath',  'marc',  '77 Rue Principale, Chnville, QC',          1, 49.99, 'delivered', $1),
      ('DEL-2026-0850', 'jonarts', 'peter', '658 QC-219, Saint-Jean-sur-Richelieu',    15, 87.49, 'enroute',   $1),
      ('DEL-2026-0851', 'beg',     'peter', '1190 Rue Principale E, Sainte-Agathe',   10, 147.49,'picked',    $1),
      ('DEL-2026-0852', 'aebath',  'peter', '245 Promenade du Centropolis, Laval',      2, 49.99, 'waiting',   $1)
      ON CONFLICT (id) DO NOTHING;
    `, [today]);

    console.log('✅ Database seeded successfully');
  } catch (err) {
    console.error('❌ Error seeding data:', err);
  } finally {
    client.release();
  }
}
