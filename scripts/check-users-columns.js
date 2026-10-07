'use strict';
require('dotenv').config();
const { db, pool } = require('../db');

(async () => {
  try {
    const r = await db.execute(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = $1
       ORDER BY ordinal_position`,
      ['users']
    );
    console.table(r.rows);
  } catch (e) {
    console.error('❌', e.message);
  } finally {
    await pool.end();
  }
})();
