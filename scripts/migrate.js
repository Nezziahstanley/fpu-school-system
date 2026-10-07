// ============================================================
// FPU — CLI wrapper for db/migrate.js
// ------------------------------------------------------------
// Run: npm run migrate:cli
//
// Same behaviour as `npm run migrate` (which runs
// `node db/migrate.js`), but exposed as its own script so it can
// be called via `npm run migrate:cli` from CI or one-off shells.
// ============================================================

'use strict';

require('dotenv').config();

const { migrate } = require('../db/migrate');
const { close } = require('../db');

async function main() {
  console.log('🚀  Running migrations…\n');
  const result = await migrate();
  // migrate() already prints its own summary.
  // This line is here only as a fallback for CI logs.
  if (result && typeof result.applied === 'number') {
    console.log(
      `\n✨  ${result.applied} of ${result.total} migration(s) applied. ` +
      `Pending: ${result.pending ?? 0}.\n`
    );
  }
}

main()
  .then(async () => {
    await close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌  Migration failed:', err.message);
    try {
      await close();
    } catch (_) {
      /* ignore */
    }
    process.exit(1);
  });