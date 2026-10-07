// ============================================================
// FPU — Applications queries
// Used by: routes/applications, routes/public
// ============================================================

'use strict';

const { db, schema, sql } = require('..');
const { eq, and, or, ilike, desc, asc } = require('drizzle-orm');

const { applications } = schema;

// ------------------------------------------------------------
// list
// ------------------------------------------------------------
async function list({
  status, type, search,
  programmeId, departmentId, schoolId,
  country, state,
  limit = 200, offset = 0,
} = {}) {
  const conds = [];
  if (status) conds.push(eq(applications.status, status));
  if (type) conds.push(eq(applications.type, type));
  if (programmeId) conds.push(eq(applications.programmeId, Number(programmeId)));
  if (departmentId) conds.push(eq(applications.departmentId, Number(departmentId)));
  if (schoolId) conds.push(eq(applications.schoolId, Number(schoolId)));
  if (country) conds.push(eq(applications.country, country));
  if (state) conds.push(eq(applications.stateOfOrigin, state));
  if (search) {
    const term = `%${String(search).trim()}%`;
    conds.push(
      or(
        ilike(applications.firstName, term),
        ilike(applications.lastName, term),
        ilike(applications.email, term),
        ilike(applications.applicationNumber, term)
      )
    );
  }
  const where = conds.length ? and(...conds) : undefined;
  return db
    .select()
    .from(applications)
    .where(where)
    .orderBy(desc(applications.createdAt))
    .limit(Number(limit))
    .offset(Number(offset));
}

// ------------------------------------------------------------
// count
// ------------------------------------------------------------
async function count({ status, type } = {}) {
  const conds = [];
  if (status) conds.push(eq(applications.status, status));
  if (type) conds.push(eq(applications.type, type));
  const where = conds.length ? and(...conds) : undefined;
  const [row] = await db.select({ c: sql`count(*)::int` }).from(applications).where(where);
  return row?.c ?? 0;
}

// ------------------------------------------------------------
// countByStatus
// ------------------------------------------------------------
async function countByStatus({ type } = {}) {
  const conds = [];
  if (type) conds.push(eq(applications.type, type));
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db
    .select({ status: applications.status, c: sql`count(*)::int` })
    .from(applications)
    .where(where)
    .groupBy(applications.status);
  return rows;
}

// ------------------------------------------------------------
// findById / findByNumber / findByEmail
// ------------------------------------------------------------
async function findById(id) {
  if (!id) return null;
  const [row] = await db.select().from(applications).where(eq(applications.id, Number(id))).limit(1);
  return row || null;
}

async function findByNumber(number) {
  if (!number) return null;
  const [row] = await db
    .select()
    .from(applications)
    .where(eq(applications.applicationNumber, String(number).trim()))
    .limit(1);
  return row || null;
}

async function findByEmail(email) {
  if (!email) return [];
  return db
    .select()
    .from(applications)
    .where(sql`lower(${applications.email}) = lower(${email})`)
    .orderBy(desc(applications.createdAt));
}

// ------------------------------------------------------------
// generateApplicationNumber
// ------------------------------------------------------------
async function generateApplicationNumber(type) {
  const year = new Date().getFullYear();
  const prefix = `FPU/${type || 'ND'}/${year}/`;

  const { rows } = await db.execute(
    sql`SELECT application_number FROM ${applications} WHERE application_number LIKE ${prefix + '%'} ORDER BY id DESC LIMIT 1`
  );
  let next = 1;
  if (rows.length && rows[0].application_number) {
    const m = String(rows[0].application_number).match(/\/(\d+)$/);
    if (m) next = Number(m[1]) + 1;
  }
  return `${prefix}${String(next).padStart(5, '0')}`;
}

// ------------------------------------------------------------
// create / setStatus / markRegistered / remove
// ------------------------------------------------------------
async function create(payload) {
  const [row] = await db
    .insert(applications)
    .values({
      applicationNumber: payload.applicationNumber,
      type: payload.type || 'ND',
      firstName: payload.firstName,
      lastName: payload.lastName,
      middleName: payload.middleName || null,
      email: String(payload.email).trim().toLowerCase(),
      phone: payload.phone,
      gender: payload.gender || null,
      dateOfBirth: payload.dateOfBirth || null,
      country: payload.country || 'Nigeria',
      stateOfOrigin: payload.stateOfOrigin || null,
      lga: payload.lga || null,
      address: payload.address || null,
      programmeId: payload.programmeId ? Number(payload.programmeId) : null,
      departmentId: payload.departmentId ? Number(payload.departmentId) : null,
      schoolId: payload.schoolId ? Number(payload.schoolId) : null,
      level: payload.level || 'ND',
      oLevelResult: payload.oLevelResult || null,
      jambScore: payload.jambScore ? Number(payload.jambScore) : null,
      jambRegNo: payload.jambRegNo || null,
      passportUrl: payload.passportUrl || null,
      status: 'pending',
    })
    .returning();
  return row;
}

async function setStatus(id, status, { reviewedBy, rejectionReason } = {}) {
  const patch = { status, updatedAt: new Date() };
  if (reviewedBy) patch.reviewedBy = Number(reviewedBy);
  if (status === 'approved') {
    patch.reviewedAt = new Date();
    patch.admittedAt = new Date();
    patch.rejectionReason = null;
  } else if (status === 'rejected') {
    patch.reviewedAt = new Date();
    patch.rejectionReason = rejectionReason || 'Application did not meet requirements.';
  } else if (status === 'under_review') {
    patch.reviewedAt = new Date();
  }

  const [row] = await db.update(applications).set(patch).where(eq(applications.id, Number(id))).returning();
  return row || null;
}

async function markRegistered(id, { userId, matricNumber }) {
  const [row] = await db
    .update(applications)
    .set({
      status: 'registered',
      userId: userId ? Number(userId) : null,
      matricNumber: matricNumber || null,
      updatedAt: new Date(),
    })
    .where(eq(applications.id, Number(id)))
    .returning();
  return row || null;
}

async function remove(id) {
  const [row] = await db.delete(applications).where(eq(applications.id, Number(id))).returning();
  return row || null;
}

module.exports = {
  list,
  count,
  countByStatus,
  findById,
  findByNumber,
  findByEmail,
  generateApplicationNumber,
  create,
  setStatus,
  markRegistered,
  remove,
};