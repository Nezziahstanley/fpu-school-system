// ============================================================
// FPU — Seed bank account details into settings
// ------------------------------------------------------------
// Run: npm run seed:bank
// ============================================================

'use strict';

require('dotenv').config();

const { db, schema, close } = require('../db');
const { eq } = require('drizzle-orm');

const { settings } = schema;

const BANKS = [
  { bank: 'ECOBANK', accountName: 'VINCENT STANLEY AZUBUIKE', accountNumber: '2520020404' },
  { bank: 'MONIEPOINT / OPAY', accountName: 'VINCENT STANLEY AZUBUIKE', accountNumber: '8025990411' },
  { bank: 'OPAY', accountName: 'VINCENT STANLEY AZUBUIKE', accountNumber: '7041145338' },
];

async function main() {
  console.log('🏦  Seeding bank accounts…\n');

  for (let i = 0; i < BANKS.length; i++) {
    const key = `bank_account_${i + 1}`;
    const value = JSON.stringify(BANKS[i]);

    await db
      .insert(settings)
      .values({ key, value, category: 'bank' })
      .onConflictDoUpdate({ target: settings.key, set: { value, category: 'bank' } });

    console.log(`   ✓ ${BANKS[i].bank} → ${BANKS[i].accountNumber}`);
  }

  console.log('\n✨  Bank seeding complete.\n');
}

main()
  .then(async () => { await close(); process.exit(0); })
  .catch(async (err) => {
    console.error('❌ ', err);
    try { await close(); } catch {}
    process.exit(1);
  });