'use strict';
require('dotenv').config(
  process.env.ENV_FILE ? { path: process.env.ENV_FILE } : undefined
);

const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { sql } = require('drizzle-orm');
const schema = require('./schema');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// Neon (and most managed Postgres) require SSL in production.
// DATABASE_SSL=true  -> enforce SSL
// localhost / docker -> no SSL
const useSSL =
  process.env.DATABASE_SSL === 'true' ||
  /neon\.tech|render\.com|sslmode=require/.test(connectionString);

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

const db = drizzle(pool, { schema });

async function close() {
  await pool.end();
}

module.exports = { db, pool, close, schema, sql };

