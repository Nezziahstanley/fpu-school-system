// check-db.js — print books that have an e-book URL
const { db } = require('./db');
const { sql } = require('drizzle-orm');

(async () => {
  try {
    const r = await db.execute(sql`
      SELECT id, title, ebook_url AS "ebookUrl", external_url AS "externalUrl"
      FROM books
      WHERE ebook_url IS NOT NULL
      LIMIT 10
    `);
    if (!r.rows.length) {
      console.log('No books have ebook_url set.');
    } else {
      console.table(r.rows);
    }
  } catch (e) {
    console.error('ERR:', e.message);
  } finally {
    process.exit(0);
  }
})();