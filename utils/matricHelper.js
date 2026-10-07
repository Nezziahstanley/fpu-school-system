// ============================================================
// FPU — Matric number helper (FIFO serial per programme/year)
// ------------------------------------------------------------
// Assigns the next available 3-digit serial for a given
// (prefix, schoolCode, deptCode, level, year) combination.
// Uses `users.matric_number` as the source of truth.
// ============================================================

'use strict';

const { db, sql, schema } = require('../db');
const { buildMatricNumber, getYearShort, parseMatric } = require('../config/departments');

const { users } = schema;

// ------------------------------------------------------------
// Find the highest serial in use for a programme/year tuple.
// Scans existing matric numbers matching the fixed segments.
// ------------------------------------------------------------
async function getNextMatricSerial({
  prefix = 'FPU',
  schoolCode,
  deptCode,
  level,
  year,
}) {
  if (!schoolCode || !deptCode || !level || !year) {
    throw new Error('getNextMatricSerial: schoolCode, deptCode, level, year are required');
  }

  const y = String(year).length === 4 ? String(year).slice(-2) : String(year).padStart(2, '0');
  const pattern = `${prefix}/${schoolCode}/${deptCode}/${level}/${y}/%`;

  const rows = await db
    .select({ matric: users.matricNumber })
    .from(users)
    .where(sql`${users.matricNumber} LIKE ${pattern}`);

  let maxSerial = 0;
  for (const row of rows) {
    const parsed = parseMatric(row.matric);
    if (parsed && parsed.serial > maxSerial) {
      maxSerial = parsed.serial;
    }
  }
  return maxSerial + 1;
}

// ------------------------------------------------------------
// Assign the next FIFO matric number for a new student.
// Pass `tx` (a Drizzle transaction handle) if you want it to
// run inside an outer transaction.
// ------------------------------------------------------------
async function assignFIFOMatric({
  prefix = 'FPU',
  schoolCode,
  deptCode,
  level,
  year,
  tx = null,
}) {
  const client = tx || db;
  const y = String(year).length === 4 ? String(year).slice(-2) : String(year).padStart(2, '0');
  const pattern = `${prefix}/${schoolCode}/${deptCode}/${level}/${y}/%`;

  // Fetch existing serials under the same tuple (within tx if provided)
  const rows = await client
    .select({ matric: users.matricNumber })
    .from(users)
    .where(sql`${users.matricNumber} LIKE ${pattern}`);

  let maxSerial = 0;
  for (const row of rows) {
    const parsed = parseMatric(row.matric);
    if (parsed && parsed.serial > maxSerial) maxSerial = parsed.serial;
  }

  const serial = maxSerial + 1;
  return buildMatricNumber({
    prefix,
    schoolCode,
    deptCode,
    level,
    year: y,
    serial,
  });
}

// ------------------------------------------------------------
// Convenience: current year short ("26")
// ------------------------------------------------------------
function currentYearShort() {
  return getYearShort(new Date());
}

module.exports = {
  getNextMatricSerial,
  assignFIFOMatric,
  currentYearShort,
};