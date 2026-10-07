// ============================================================
// FPU School Management System — Migration runner
// ------------------------------------------------------------
// Reads migrations/*.sql, applies them in filename order,
// tracks applied migrations in __drizzle_migrations.
//
// Usage:
//   npm run migrate              → node db/migrate.js
//   npm run migrate:cli          → node scripts/migrate.js (calls this)
//   node db/migrate.js --status  → show applied / pending, exit
//   node db/migrate.js --dry     → show what would run, no writes
// ============================================================

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { pool, close } = require('./index');

// ------------------------------------------------------------
// Config
// ------------------------------------------------------------
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const TRACKING_TABLE = '__fpu_migrations';
const DRY = process.argv.includes('--dry');
const STATUS_ONLY = process.argv.includes('--status');

// ------------------------------------------------------------
// Logging
// ------------------------------------------------------------
function log(msg, color) {
  const codes = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
    reset: '\x1b[0m',
  };
  console.log((codes[color] || '') + msg + codes.reset);
}
const ok = (m) => log('  ✓ ' + m, 'green');
const info = (m) => log('  · ' + m, 'dim');
const warn = (m) => log('  ⚠ ' + m, 'yellow');
const err = (m) => log('  ✗ ' + m, 'red');
const head = (m) => log('\n' + m, 'cyan');

// ------------------------------------------------------------
// Ensure the tracking table exists
// ------------------------------------------------------------
async function ensureTrackingTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
      id            SERIAL PRIMARY KEY,
      filename      TEXT NOT NULL UNIQUE,
      checksum      TEXT NOT NULL,
      applied_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      duration_ms   INTEGER
    )
  `);
}

// ------------------------------------------------------------
// SHA-256 checksum of a file's contents
// ------------------------------------------------------------
function checksum(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

// ------------------------------------------------------------
// Load every .sql file from migrations/, sorted by filename.
// Returns [{ filename, fullPath, sql, checksum }]
// ------------------------------------------------------------
function loadMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  return files.map((filename) => {
    const fullPath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(fullPath, 'utf8');
    return { filename, fullPath, sql, checksum: checksum(sql) };
  });
}

// ------------------------------------------------------------
// Fetch applied migrations from the tracking table
// ------------------------------------------------------------
async function fetchApplied() {
  const { rows } = await pool.query(
    `SELECT filename, checksum, applied_at FROM ${TRACKING_TABLE} ORDER BY id`
  );
  const map = new Map();
  for (const r of rows) {
    map.set(r.filename, {
      checksum: r.checksum,
      appliedAt: r.applied_at,
    });
  }
  return map;
}

// ------------------------------------------------------------
// Apply one migration inside a transaction.
// A file is assumed to be a single atomic unit; if it contains
// its own BEGIN/COMMIT, that's fine — Postgres will treat the
// outer BEGIN as the start of a fresh transaction and the inner
// COMMIT will end it. We only issue ROLLBACK on failure.
// ------------------------------------------------------------
async function applyMigration(migration) {
  const client = await pool.connect();
  const started = Date.now();
  try {
    await client.query('BEGIN');

    // Runs the entire file in one call. Postgres can handle
    // multi-statement SQL including DO blocks and functions.
    await client.query(migration.sql);

    const duration = Date.now() - started;
    await client.query(
      `INSERT INTO ${TRACKING_TABLE} (filename, checksum, duration_ms)
       VALUES ($1, $2, $3)
       ON CONFLICT (filename) DO NOTHING`,
      [migration.filename, migration.checksum, duration]
    );

    await client.query('COMMIT');
    return { ok: true, duration };
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore rollback errors */
    }
    return { ok: false, error: e };
  } finally {
    client.release();
  }
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
async function migrate() {
  head('══════════════════════════════════════════════════');
  log('  FPU — Migration runner', 'cyan');
  log('══════════════════════════════════════════════════', 'cyan');
  if (DRY) log('  DRY RUN — no changes will be written', 'yellow');
  console.log('');

  await ensureTrackingTable();

  const files = loadMigrationFiles();
  if (files.length === 0) {
    warn('No .sql files found in ' + path.relative(process.cwd(), MIGRATIONS_DIR));
    info('Create migrations/*.sql files and re-run.');
    return { total: 0, applied: 0, pending: 0, mismatched: [] };
  }

  const applied = await fetchApplied();
  info(`Found ${files.length} migration file(s), ${applied.size} already applied`);

  const pending = [];
  const mismatched = [];

  for (const f of files) {
    const a = applied.get(f.filename);
    if (!a) {
      pending.push(f);
    } else if (a.checksum !== f.checksum) {
      mismatched.push(f);
    }
  }

  // -------- STATUS-ONLY MODE --------
  if (STATUS_ONLY) {
    head('Status');
    for (const f of files) {
      const a = applied.get(f.filename);
      if (!a) {
        warn(`PENDING   ${f.filename}`);
      } else {
        ok(`APPLIED   ${f.filename}   (${a.appliedAt.toISOString()})`);
      }
    }
    if (mismatched.length) {
      head('⚠️  Checksum mismatches');
      for (const f of mismatched) {
        err(`${f.filename} — file changed since it was applied`);
      }
    }
    return {
      total: files.length,
      applied: applied.size,
      pending: pending.length,
      mismatched: mismatched.map((f) => f.filename),
    };
  }

  // -------- WARN ON TAMPERING --------
  if (mismatched.length) {
    head('⚠️  Checksum mismatches');
    for (const f of mismatched) {
      err(`${f.filename} — file changed since it was applied`);
    }
    warn('These will be skipped. Roll back manually if needed.');
  }

  // -------- NOTHING TO DO --------
  if (pending.length === 0) {
    head('Nothing to apply');
    info(`All ${files.length} migration(s) already applied.`);
    return {
      total: files.length,
      applied: applied.size,
      pending: 0,
      mismatched: mismatched.map((f) => f.filename),
    };
  }

  // -------- APPLY --------
  head(`Applying ${pending.length} migration(s)`);

  let appliedCount = 0;
  for (const m of pending) {
    if (DRY) {
      info(`[DRY] would apply ${m.filename}`);
      appliedCount++;
      continue;
    }
    const result = await applyMigration(m);
    if (result.ok) {
      appliedCount++;
      ok(`${m.filename}  (${result.duration}ms)`);
    } else {
      err(`${m.filename} FAILED — ${result.error.message}`);
      if (result.error.detail) info(`detail: ${result.error.detail}`);
      if (result.error.hint) info(`hint:   ${result.error.hint}`);
      head('Aborted');
      warn('Stopped at the first failed migration. Nothing after it was applied.');
      return {
        total: files.length,
        applied: applied.size + appliedCount,
        pending: pending.length - appliedCount,
        mismatched: mismatched.map((f) => f.filename),
        failed: m.filename,
      };
    }
  }

  head('DONE');
  console.log('');
  ok(`Applied: ${appliedCount}`);
  info(`Total migrations: ${files.length}`);
  console.log('');

  return {
    total: files.length,
    applied: applied.size + appliedCount,
    pending: 0,
    mismatched: mismatched.map((f) => f.filename),
  };
}

// ------------------------------------------------------------
// Exports + direct-run entry point
// ------------------------------------------------------------
module.exports = { migrate };

if (require.main === module) {
  migrate()
    .then(async (result) => {
      await close();
      if (result && result.failed) process.exit(1);
      process.exit(0);
    })
    .catch(async (e) => {
      console.error('\n❌ Migration runner crashed:', e);
      try {
        await close();
      } catch (_) {
        /* ignore */
      }
      process.exit(1);
    });
}