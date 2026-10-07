'use strict';
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { db, pool } = require('../db');

const EMAIL    = process.env.ADMIN_EMAIL_TO_CREATE || 'admin@fedpolyugep.edu.ng';
const PASSWORD = process.env.ADMIN_PASSWORD_TO_CREATE || 'Admin@12345';
const FIRST    = process.env.ADMIN_FIRST_NAME || 'System';
const LAST     = process.env.ADMIN_LAST_NAME  || 'Administrator';
const ROLE     = process.env.ADMIN_ROLE       || 'superadmin';

(async () => {
  try {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
    const hash = await bcrypt.hash(PASSWORD, rounds);

    console.log(`\n→ Creating/resetting user: ${EMAIL}  (role: ${ROLE})\n`);

    // Upsert by email
    const sql = `
      INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, must_change_password, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, true, false, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            role          = EXCLUDED.role,
            is_active     = true,
            must_change_password = false,
            updated_at    = NOW()
      RETURNING id, email, role;
    `;

    const result = await db.execute(sql, [EMAIL, hash, FIRST, LAST, ROLE]);
    console.log('✔ Done:', result.rows[0]);
    console.log(`\nLogin credentials:\n  Email:    ${EMAIL}\n  Password: ${PASSWORD}\n`);
  } catch (err) {
    console.error('\n❌ Failed:', err.message);
    if (err.detail) console.error('   detail:', err.detail);
    if (err.hint)   console.error('   hint:  ', err.hint);
    process.exitCode = 1;
  } finally {
    try { await pool.end(); } catch {}
  }
})();
