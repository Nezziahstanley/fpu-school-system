'use strict';
require('dotenv').config();

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

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 5,                       // Neon free tier: keep pool small
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

const db = drizzle(pool, { schema });

async function close() {
  await pool.end();
}

module.exports = { db, pool, close, schema, sql };

