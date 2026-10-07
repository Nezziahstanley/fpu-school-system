'use strict';
require('dotenv').config();
const { db, pool } = require('./db');

(async () => {
  try {
    const depts = await db.execute(`SELECT id, code, name FROM departments ORDER BY name`);
    console.log('\n=== Departments available ===');
    console.table(depts.rows);

    const hod = await db.execute(`SELECT id, email, role, department_id FROM users WHERE email = $1`, ['hod.csc@fedpolyugep.edu.ng']);
    console.log('\n=== Current HOD user ===');
    console.table(hod.rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
