// ============================================================
// FPU — Reset all staff passwords to seed defaults
// ------------------------------------------------------------
// Run: npm run reset:staff
// ------------------------------------------------------------
// - admin + any role='admin'    → admin1234
// - rector/registrar/bursar/... → principal1234
// - hod                         → hod1234
// - lecturer                    → lecturer1234
// ============================================================

'use strict';

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { db, schema, sql, close } = require('../db');
const { eq, inArray } = require('drizzle-orm');

const { users } = schema;

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;

async function main() {
  console.log('🔐  Resetting staff passwords…\n');

  const adminPwd = await bcrypt.hash('admin1234', await bcrypt.genSalt(BCRYPT_ROUNDS));
  const princPwd = await bcrypt.hash('principal1234', await bcrypt.genSalt(BCRYPT_ROUNDS));
  const hodPwd   = await bcrypt.hash('hod1234', await bcrypt.genSalt(BCRYPT_ROUNDS));
  const lectPwd  = await bcrypt.hash('lecturer1234', await bcrypt.genSalt(BCRYPT_ROUNDS));

  const updates = [
    { pwd: adminPwd, roles: ['admin'] },
    { pwd: princPwd, roles: ['rector','registrar','bursar','librarian','exam_officer','academic_officer','admission_officer'] },
    { pwd: hodPwd,   roles: ['hod'] },
    { pwd: lectPwd,  roles: ['lecturer'] },
  ];

  for (const u of updates) {
    const rows = await db.update(users)
      .set({ passwordHash: u.pwd, mustChangePassword: false })
      .where(inArray(users.role, u.roles))
      .returning({ id: users.id, email: users.email, role: users.role });
    console.log(`   ✓ ${rows.length} ${u.roles.join('/')} account(s) reset`);
  }

  console.log('\n✨  Password reset complete.\n');
}

main()
  .then(async () => { await close(); process.exit(0); })
  .catch(async (err) => {
    console.error('❌ ', err);
    try { await close(); } catch {}
    process.exit(1);
  });