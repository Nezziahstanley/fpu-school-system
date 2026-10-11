// ============================================================
// FPU — Query helper: applications
// Used by: routes/public (POST /apply), routes/portal/admissionOfficer,
//          routes/applications (admin), routes/portal/student
// ============================================================

'use strict';

const { db, schema, sql } = require('..');
const {
  eq, and, or, ilike, inArray, desc, asc, gte, lte, isNull, isNotNull,
} = require('drizzle-orm');

const { applications, users, programmes, departments, schools } = schema;

// ------------------------------------------------------------
// list — filter by status / type / search / programme / dept
// ------------------------------------------------------------
async function list({
  status, type, search, programmeId, departmentId, schoolId,
  sessionId, fromDate, toDate,
  limit = 500, offset = 0,
} = {}) {
  const conds = [];

  if (status) {
    Array.isArray(status)
      ? conds.push(inArray(applications.status, status))
      : conds.push(eq(applications.status, status));
  }
  if (type)        conds.push(eq(applications.type, type));
  if (programmeId) conds.push(eq(applications.programmeId, Number(programmeId)));
  if (departmentId) conds.push(eq(applications.departmentId, Number(departmentId)));
  if (schoolId)    conds.push(eq(applications.schoolId, Number(schoolId)));
  if (sessionId)   conds.push(eq(applications.sessionId, Number(sessionId)));
  if (fromDate)    conds.push(gte(applications.createdAt, new Date(fromDate)));
  if (toDate)      conds.push(lte(applications.createdAt, new Date(toDate)));

  if (search) {
    const term = `%${String(search).trim()}%`;
    conds.push(or(
      ilike(applications.firstName, term),
      ilike(applications.lastName, term),
      ilike(applications.middleName, term),
      ilike(applications.email, term),
      ilike(applications.phone, term),
      ilike(applications.applicationNumber, term),
      ilike(applications.matricNumber, term),
    ));
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
// listWithRelations — joins programme / dept / school for views
// ------------------------------------------------------------
async function listWithRelations(opts = {}) {
  const conds = [];
  if (opts.status) {
    Array.isArray(opts.status)
      ? conds.push(inArray(applications.status, opts.status))
      : conds.push(eq(applications.status, opts.status));
  }
  if (opts.type) conds.push(eq(applications.type, opts.type));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({
      application: applications,
      programme: programmes,
      department: departments,
      school: schools,
    })
    .from(applications)
    .leftJoin(programmes, eq(applications.programmeId, programmes.id))
    .leftJoin(departments, eq(applications.departmentId, departments.id))
    .leftJoin(schools, eq(applications.schoolId, schools.id))
    .where(where)
    .orderBy(desc(applications.createdAt));
}

// ------------------------------------------------------------
// findById
// ------------------------------------------------------------
async function findById(id) {
  if (!id) return null;
  const [row] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, Number(id)))
    .limit(1);
  return row || null;
}

// ------------------------------------------------------------
// findByNumber — for /api/apply-status lookup
// ------------------------------------------------------------
async function findByNumber(applicationNumber) {
  if (!applicationNumber) return null;
  const [row] = await db
    .select()
    .from(applications)
    .where(eq(applications.applicationNumber, String(applicationNumber).trim()))
    .limit(1);
  return row || null;
}

// ------------------------------------------------------------
// findByEmail — used to check duplicate submissions
// ------------------------------------------------------------
async function findByEmail(email, { type } = {}) {
  if (!email) return null;
  const conds = [eq(applications.email, String(email).toLowerCase().trim())];
  if (type) conds.push(eq(applications.type, type));
  const rows = await db
    .select()
    .from(applications)
    .where(and(...conds))
    .orderBy(desc(applications.createdAt))
    .limit(1);
  return rows[0] || null;
}

// ------------------------------------------------------------
// create — called by POST /api/apply and /api/apply-hnd
// ------------------------------------------------------------
async function create(data) {
  const [row] = await db
    .insert(applications)
    .values({
      applicationNumber: data.applicationNumber,
      type: data.type,
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName || null,
      email: String(data.email || '').toLowerCase().trim(),
      phone: data.phone,
      gender: data.gender || null,
      dateOfBirth: data.dateOfBirth || null,
      country: data.country || 'Nigeria',
      stateOfOrigin: data.stateOfOrigin || null,
      lga: data.lga || null,
      address: data.address || null,
      programmeId: Number(data.programmeId),
      departmentId: Number(data.departmentId),
      schoolId: data.schoolId ? Number(data.schoolId) : null,
      level: data.level || data.type || 'ND',
      sessionId: data.sessionId ? Number(data.sessionId) : null,
      oLevelResult: data.oLevelResult || null,
      jambScore: data.jambScore != null ? Number(data.jambScore) : null,
      jambRegNo: data.jambRegNo || null,
      passportUrl: data.passportUrl || null,
      status: data.status || 'pending',
    })
    .returning();
  return row;
}

// ------------------------------------------------------------
// setStatus — generic status transition
// ------------------------------------------------------------
async function setStatus(id, status, extras = {}) {
  const patch = { status };

  if (status === 'under_review' && !extras.reviewedAt) {
    patch.reviewedBy = extras.reviewedBy ?? null;
    patch.reviewedAt = new Date();
  }
  if (status === 'approved') {
    patch.reviewedBy = extras.reviewedBy ?? null;
    patch.reviewedAt = new Date();
    patch.admittedAt = new Date();
    patch.letter1SentAt = extras.letter1SentAt ?? new Date();
  }
  if (status === 'rejected') {
    patch.reviewedBy = extras.reviewedBy ?? null;
    patch.reviewedAt = new Date();
    patch.rejectionReason = extras.rejectionReason || 'Application did not meet requirements.';
  }
  if (status === 'registered') {
    if (extras.matricNumber) patch.matricNumber = extras.matricNumber;
    patch.letter2SentAt = extras.letter2SentAt ?? new Date();
  }
  if (status === 'matriculated') {
    if (extras.matricNumber) patch.matricNumber = extras.matricNumber;
    patch.matriculatedAt = new Date();
    patch.letter3SentAt = extras.letter3SentAt ?? new Date();
  }
  if (extras.notes !== undefined) patch.notes = extras.notes;

  const [row] = await db
    .update(applications)
    .set(patch)
    .where(eq(applications.id, Number(id)))
    .returning();
  return row || null;
}

// ------------------------------------------------------------
// markRegistered — legacy helper (kept for backwards compat)
// ------------------------------------------------------------
async function markRegistered(id, { userId, matricNumber } = {}) {
  const patch = {
    status: 'registered',
    letter2SentAt: new Date(),
  };
  if (matricNumber) patch.matricNumber = matricNumber;
  const [row] = await db
    .update(applications)
    .set(patch)
    .where(eq(applications.id, Number(id)))
    .returning();
  return row || null;
}

// ------------------------------------------------------------
// verifyDocuments — records who verified & when
// ------------------------------------------------------------
async function verifyDocuments(id, userId) {
  const [row] = await db
    .update(applications)
    .set({
      documentsVerifiedAt: new Date(),
      documentsVerifiedBy: Number(userId),
    })
    .where(eq(applications.id, Number(id)))
    .returning();
  return row || null;
}

// ------------------------------------------------------------
// markLetterSent — sets the appropriate *_sent_at column
//   which = 1 | 2 | 3
// ------------------------------------------------------------
async function markLetterSent(id, which) {
  const patch = {};
  if (which === 1) patch.letter1SentAt = new Date();
  if (which === 2) patch.letter2SentAt = new Date();
  if (which === 3) patch.letter3SentAt = new Date();
  if (!Object.keys(patch).length) return null;

  const [row] = await db
    .update(applications)
    .set(patch)
    .where(eq(applications.id, Number(id)))
    .returning();
  return row || null;
}

// ------------------------------------------------------------
// setMatricNumber — writes matric + transitions to matriculated
// ------------------------------------------------------------
async function setMatricNumber(id, matricNumber) {
  const [row] = await db
    .update(applications)
    .set({
      matricNumber,
      status: 'matriculated',
      matriculatedAt: new Date(),
      letter3SentAt: new Date(),
    })
    .where(eq(applications.id, Number(id)))
    .returning();
  return row || null;
}

// ------------------------------------------------------------
// setNotes — free-text internal notes
// ------------------------------------------------------------
async function setNotes(id, notes) {
  const [row] = await db
    .update(applications)
    .set({ notes: notes || null })
    .where(eq(applications.id, Number(id)))
    .returning();
  return row || null;
}

// ------------------------------------------------------------
// countByStatus — dashboard tiles
//   opts: { type?: 'ND'|'HND', sessionId?: number }
// ------------------------------------------------------------
async function countByStatus(opts = {}) {
  const conds = [];
  if (opts.type) conds.push(eq(applications.type, opts.type));
  if (opts.sessionId) conds.push(eq(applications.sessionId, Number(opts.sessionId)));
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      status: applications.status,
      c: sql`count(*)::int`,
    })
    .from(applications)
    .where(where)
    .groupBy(applications.status);

  return rows;
}

// ------------------------------------------------------------
// countByDepartment — for quota tracker / reports
// ------------------------------------------------------------
async function countByDepartment({ sessionId } = {}) {
  const conds = [eq(applications.status, 'approved')];
  if (sessionId) conds.push(eq(applications.sessionId, Number(sessionId)));

  return db
    .select({
      departmentId: applications.departmentId,
      c: sql`count(*)::int`,
    })
    .from(applications)
    .where(and(...conds))
    .groupBy(applications.departmentId);
}

// ------------------------------------------------------------
// generateApplicationNumber — sequential per type per year
//   Format:  FPU/APP/2026/00001
// ------------------------------------------------------------
async function generateApplicationNumber(type = 'ND') {
  const year = new Date().getFullYear();
  const prefix = `FPU/APP/${year}/`;

  const rows = await db
    .select({ applicationNumber: applications.applicationNumber })
    .from(applications)
    .where(ilike(applications.applicationNumber, `${prefix}%`))
    .orderBy(desc(applications.applicationNumber))
    .limit(1);

  let next = 1;
  if (rows.length) {
    const last = rows[0].applicationNumber || '';
    const tail = last.split('/').pop();
    const n = parseInt(tail, 10);
    if (!Number.isNaN(n)) next = n + 1;
  }

  return `${prefix}${String(next).padStart(5, '0')}`;
}

// ------------------------------------------------------------
// listPendingForOfficer — pending + under_review
// ------------------------------------------------------------
async function listPendingForOfficer({ type, limit = 500 } = {}) {
  const conds = [inArray(applications.status, ['pending', 'under_review'])];
  if (type) conds.push(eq(applications.type, type));
  return db
    .select()
    .from(applications)
    .where(and(...conds))
    .orderBy(asc(applications.createdAt))
    .limit(Number(limit));
}

// ------------------------------------------------------------
// listAdmitted — approved + registered + matriculated
// ------------------------------------------------------------
async function listAdmitted({ type, limit = 500 } = {}) {
  const conds = [inArray(applications.status, ['approved', 'registered', 'matriculated'])];
  if (type) conds.push(eq(applications.type, type));
  return db
    .select()
    .from(applications)
    .where(and(...conds))
    .orderBy(desc(applications.admittedAt))
    .limit(Number(limit));
}

// ------------------------------------------------------------
// EXPORTS
// ------------------------------------------------------------
module.exports = {
  list,
  listWithRelations,
  findById,
  findByNumber,
  findByEmail,
  create,
  setStatus,
  markRegistered,
  verifyDocuments,
  markLetterSent,
  setMatricNumber,
  setNotes,
  countByStatus,
  countByDepartment,
  generateApplicationNumber,
  listPendingForOfficer,
  listAdmitted,
};