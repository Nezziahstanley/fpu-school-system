// ============================================================
// FPU School Management System — Database connection
// ------------------------------------------------------------
// Creates a `pg` Pool, wraps it with Drizzle, exposes:
//   - db      : Drizzle instance (query builder)
//   - pool    : raw pg Pool (for shutdown / health checks)
//   - schema  : re-export of db/schema.js
//   - sql     : re-export of drizzle-orm sql tag
// ============================================================

'use strict';

require('dotenv').config();

const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { sql } = require('drizzle-orm');

const schema = require('./schema');

const {
  DATABASE_URL,
  DATABASE_SSL,
  DB_DEBUG,
  NODE_ENV,
} = process.env;

if (!DATABASE_URL) {
  throw new Error(
    '[db] DATABASE_URL is not set. ' +
    'Copy .env.example to .env and set DATABASE_URL.'
  );
}

// ------------------------------------------------------------
// Detect whether SSL should be enabled
// Neon / Render require SSL. Local Docker Postgres does not.
// ------------------------------------------------------------
const useSsl =
  String(DATABASE_SSL).toLowerCase() === 'true' ||
  /neon\.tech|render\.com|sslmode=require/i.test(DATABASE_URL);

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  // Sensible pool defaults for a small-to-medium deployment
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// ------------------------------------------------------------
// Pool error handler — log but never crash the process
// ------------------------------------------------------------
pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[db] idle client error:', err.message);
});

// ------------------------------------------------------------
// Drizzle instance
// ------------------------------------------------------------
const db = drizzle(pool, {
  schema,
  logger: String(DB_DEBUG).toLowerCase() === 'true'
    ? {
        logQuery(query, params) {
          // eslint-disable-next-line no-console
          console.log('[sql]', query, params?.length ? params : '');
        },
      }
    : false,
});

// ------------------------------------------------------------
// Helper: quick connectivity check
// ------------------------------------------------------------
async function ping() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    client.release();
  }
}

// ------------------------------------------------------------
// Helper: graceful shutdown
// ------------------------------------------------------------
async function close() {
  await pool.end();
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = {
  db,
  pool,
  schema,
  sql,
  ping,
  close,
  NODE_ENV: NODE_ENV || 'development',
  isProduction: (NODE_ENV || 'development') === 'production',
};