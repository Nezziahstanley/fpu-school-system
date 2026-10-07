'use strict';
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { db, pool } = require('../db');

/**
 * Seeds one HOD user per department.
 * Email format: hod.<dept-code-lowercase>@fedpolyugep.edu.ng
 * Default password: Admin@12345
 *
 * Safe to run multiple times — uses upsert.
 */

const DEFAULT_PASSWORD = process.env.HOD_SEED_PASSWORD || 'Admin@12345';

(async () => {
  try {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
    const hash = await bcrypt.hash(DEFAULT_PASSWORD, rounds);

    console.log('\n══════════════════════════════════════════════════');
    console.log('  FPU — Seeding HOD users for all departments');
    console.log('══════════════════════════════════════════════════\n');

    const depts = await db.execute(
      `SELECT id, code, name FROM departments ORDER BY code`
    );

    if (!depts.rows.length) {
      console.log('❌ No departments found. Run migrations first.');
      process.exit(1);
    }

    console.log(`Found ${depts.rows.length} department(s)\n`);

    let created = 0;
    let updated = 0;

    for (const dept of depts.rows) {
      const code = String(dept.code || '').toLowerCase().trim();
      const email = `hod.${code}@fedpolyugep.edu.ng`;

      // Split "Computer Science" → first="Computer", last="Science"
      const parts = String(dept.name || 'Department').trim().split(/\s+/);
      const firstName = parts[0] || 'Head';
      const lastName = parts.slice(1).join(' ') || 'Of Department';

      // Check if exists
      const existing = await db.execute(
        `SELECT id FROM users WHERE email = $1`,
        [email]
      );

      if (existing.rows.length) {
        await db.execute(
          `UPDATE users
           SET password_hash = $1,
               first_name = $2,
               last_name = $3,
               role = 'hod',
               department_id = $4,
               is_active = true,
               must_change_password = false,
               updated_at = NOW()
           WHERE email = $5`,
          [hash, firstName, lastName, dept.id, email]
        );
        updated++;
        console.log(`  ↻ Updated: ${email}  →  ${dept.name} (dept ${dept.id})`);
      } else {
        await db.execute(
          `INSERT INTO users
             (email, password_hash, first_name, last_name, role,
              department_id, is_active, must_change_password,
              created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'hod', $5, true, false, NOW(), NOW())`,
          [email, hash, firstName, lastName, dept.id]
        );
        created++;
        console.log(`  + Created: ${email}  →  ${dept.name} (dept ${dept.id})`);
      }
    }

    console.log(`\n✔ Done. Created ${created}, updated ${updated}.`);
    console.log(`\n📋 Login credentials for all HODs:`);
    console.log(`   Password: ${DEFAULT_PASSWORD}`);
    console.log(`   Email pattern: hod.<dept-code-lowercase>@fedpolyugep.edu.ng`);
    console.log(`\nExamples:`);
    console.log(`   hod.csc@fedpolyugep.edu.ng   (Computer Science)`);
    console.log(`   hod.acc@fedpolyugep.edu.ng   (Accountancy)`);
    console.log(`   hod.bam@fedpolyugep.edu.ng   (Business Administration)`);
    console.log('');
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    if (err.detail) console.error('   detail:', err.detail);
    process.exitCode = 1;
  } finally {
    try { await pool.end(); } catch {}
  }
})();
