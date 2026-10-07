// ============================================================
// FPU School Management System — Drizzle Kit configuration
// Used by: `npx drizzle-kit generate|push|studio`
// Docs   : https://orm.drizzle.team/docs/drizzle-config-file
// ============================================================

require('dotenv').config();

const {
  DATABASE_URL,
  DATABASE_SSL,
} = process.env;

if (!DATABASE_URL) {
  throw new Error(
    '[drizzle.config] DATABASE_URL is not set. ' +
    'Copy .env.example to .env and set DATABASE_URL.'
  );
}

/** @type { import("drizzle-kit").Config } */
module.exports = {
  // Where the schema lives
  schema: './db/schema.js',

  // Where generated SQL migrations are written
  out: './migrations',

  // SQL dialect — this project is PostgreSQL-only
  dialect: 'postgresql',

  // Credentials for the CLI (generate / push / studio)
  dbCredentials: {
    url: DATABASE_URL,
    ssl: String(DATABASE_SSL).toLowerCase() === 'true' ? { rejectUnauthorized: false } : false,
  },

  // Print every SQL statement Drizzle Kit runs
  verbose: true,

  // Ask before destructive operations (push, drop)
  strict: true,

  // Also generate migrations for views / enums etc.
  migrations: {
    prefix: 'timestamp',
    table: '__drizzle_migrations',
    schema: 'public',
  },

  // Where drizzle-kit looks for the "breakpoints" file that
  // records which statements were already applied.
  breakpoints: true,
};