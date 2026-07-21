const { createClient } = require('@supabase/supabase-js');
const { pool } = require('./database');
const ws = require('ws');
const { logger } = require('../services/logger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws }
});

const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    logger.debug(`Executed query: ${text.substring(0, 60)} (${duration}ms, rows: ${res.rowCount})`);
  }
  return res;
};

const getClient = async () => {
  return await pool.connect();
};

module.exports = { pool, query, getClient, supabase, supabaseAdmin };
