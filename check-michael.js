// check-michael.js
require('dotenv').config();
const { Pool } = require('pg');

// We force SSL here because this script is for Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkMichael() {
  console.log('--- CONNECTING TO NEON DATABASE ---');
  
  try {
    // 1. Find Michael
    const userRes = await pool.query(`
      SELECT id, first_name, last_name, role, email 
      FROM users 
      WHERE first_name ILIKE '%michael%' OR last_name ILIKE '%michael%' 
      LIMIT 5;
    `);

    if (userRes.rows.length === 0) {
      console.log('❌ No user named Michael found in the database.');
      return;
    }

    console.log(`✅ Found ${userRes.rows.length} user(s) matching "Michael":`);
    
    for (const user of userRes.rows) {
      console.log(`\n----------------------------------------`);
      console.log(`Name: ${user.first_name} ${user.last_name}`);
      console.log(`Role: ${user.role}`);
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email}`);

      // 2. Check allocations for this user
      const allocRes = await pool.query(`
        SELECT ca.course_id, c.code, c.title 
        FROM course_allocations ca
        LEFT JOIN courses c ON ca.course_id = c.id
        WHERE ca.lecturer_id = $1;
      `, [user.id]);

      if (allocRes.rows.length === 0) {
        console.log(`❌ Allocations: 0 courses allocated.`);
      } else {
        console.log(`✅ Allocations: Found ${allocRes.rows.length} course(s):`);
        allocRes.rows.forEach(row => {
          console.log(`   - Course ID: ${row.course_id} | ${row.code || 'Unknown Code'} - ${row.title || 'Unknown Title'}`);
        });
      }
    }

  } catch (err) {
    console.error('❌ Database Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkMichael();