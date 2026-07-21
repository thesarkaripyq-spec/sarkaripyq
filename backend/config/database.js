const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '' : '?pgbouncer=true'),
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true, ca: process.env.SUPABASE_CA_CERT || undefined }
    : { rejectUnauthorized: false },
  max: process.env.NODE_ENV === 'production' ? 25 : 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Set statement timeout (10s for dev, 30s for production) on new connections
pool.on('connect', (client) => {
  const timeoutMs = process.env.NODE_ENV === 'production' ? 30000 : 10000;
  client.query(`SET statement_timeout = ${timeoutMs}`);
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = { pool };
