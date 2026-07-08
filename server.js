import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createTables, seedData } from './src/db/schema.js';
import apiRoutes from './src/api/routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// API routes
app.use('/api', apiRoutes);

// Serve static files from dist
app.use(express.static(join(__dirname, 'dist')));

// All other routes return index.html (React Router handles routing)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Transporteur National app running on port ${PORT}`);
  
  // Initialize database
  if (process.env.DATABASE_URL) {
    try {
      await createTables();
      await seedData();
      console.log('✅ Database ready');
    } catch (err) {
      console.error('❌ Database initialization error:', err);
    }
  } else {
    console.log('⚠️ No DATABASE_URL found - running without database');
  }
});
