// fix-schema.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Removed the SSL block so it works with local Docker DB
});

async function fixSchema() {
  console.log('--- APPLYING SAFE SCHEMA FIXES ---');
  
  try {
    await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "id_card_photo_url" text;`);
    console.log('✅ Added "id_card_photo_url" to users table.');

    await pool.query(`ALTER TABLE "course_allocations" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'assigned' NOT NULL;`);
    await pool.query(`ALTER TABLE "course_allocations" ADD COLUMN IF NOT EXISTS "assigned_by" integer;`);
    await pool.query(`ALTER TABLE "course_allocations" ADD COLUMN IF NOT EXISTS "flag_reason" varchar(80);`);
    await pool.query(`ALTER TABLE "course_allocations" ADD COLUMN IF NOT EXISTS "flag_note" text;`);
    await pool.query(`ALTER TABLE "course_allocations" ADD COLUMN IF NOT EXISTS "responded_at" timestamp with time zone;`);
    console.log('✅ Added missing columns to course_allocations table.');

    await pool.query(`ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "department_id" integer;`);
    await pool.query(`ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "is_general" boolean DEFAULT false NOT NULL;`);
    console.log('✅ Added missing columns to books table.');

    console.log('\n🎉 ALL SCHEMA FIXES APPLIED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Error applying fixes:', err.message);
  } finally {
    await pool.end();
  }
}

fixSchema();