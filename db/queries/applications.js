// ============================================================
// FPU — Query helper: applications (admissions)
// ============================================================

'use strict';

const { db, sql, schema } = require('../index');
const { eq, and, or, ilike, inArray, desc, asc } = require('drizzle-orm');

const {
  applications, programmes, departments, schools, users,
} = schema;

// ------------------------------------------------------------
// list — paginated applications with joined names.
// Filters: status (string or array), type, search,
//          programmeId, departmentId, schoolId.
// ------------------------------------------------------------
async function list({
  status, type, search, programmeId, departmentId, schoolId,
  limit = 200, offset = 0,
} = {}) {
  const conds = [];

  if (status) {
    Array.isArray(status)
      ? conds.push(inArray(applications.status, status))
      : conds.push(eq(applications.status, status));
  }
  if (type) conds.push(eq(applications.type, type));
  if (programmeId) conds.push(eq(applications.programmeId, Number(programmeId)));
  if (departmentId) conds.push(eq(applications.departmentId, Number(departmentId)));
  if (schoolId) conds.push(eq(applications.schoolId, Number(schoolId)));

  if (search) {
    const term = `%${String(search).trim()}%`;
    conds.push(or(
      ilike(applications.firstName, term),
      ilike(applications.lastName, term),
      ilike(applications.email, term),
      ilike(applications.applicationNumber, term),
      ilike(applications.jambRegNo, term),
    ));
  }

  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({
      // app fields
      id: applications.id,
      applicationNumber: applications.applicationNumber,
      type: applications.type,
      firstName: applications.firstName,
      lastName: applications.lastName,
      middleName: applications.middleName,
      email: applications.email,
      phone: applications.phone,
      gender: applications.gender,
      dateOfBirth: applications.dateOfBirth,
      country: applications.country,
      stateOfOrigin: applications.stateOfOrigin,
      lga: applications.lga,
      address: applications.address,
      programmeId: applications.programmeId,
      schoolId: applications.schoolId,
      departmentId: applications.departmentId,
      level: applications.level,
      oLevelResult: applications.oLevelResult,
      jambScore: applications.jambScore,
      jambRegNo: applications.jambRegNo,
      passportUrl: applications.passportUrl,
      status: applications.status,
      reviewedBy: applications.reviewedBy,
      reviewedAt: applications.reviewedAt,
      rejectionReason: applications.rejectionReason,
      admittedAt: applications.admittedAt,
      matricNumber: applications.matricNumber,
      userId: applications.userId,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
      // joined names
      programmeName: programmes.name,
      programmeCode: programmes.code,
      departmentName: departments.name,
      departmentCode: departments.code,
      schoolName: schools.name,
    })
    .from(applications)
    .leftJoin(programmes, eq(applications.programmeId, programmes.id))
    .leftJoin(departments, eq(applications.departmentId, departments.id))
    .leftJoin(schools, eq(applications.schoolId, schools.id))
    .where(where)
    .orderBy(desc(applications.createdAt))
    .limit(Math.min(Number(limit) || 200, 500))
    .offset(Number(offset) || 0);
}

// ------------------------------------------------------------
// count — total matching the same filters as list()
// ------------------------------------------------------------
async function count({ status, type, search, programmeId, departmentId, schoolId } = {}) {
  const conds = [];
  if (status) {
    Array.isArray(status)
      ? conds.push(inArray(applications.status, status))
      : conds.push(eq(applications.status, status));
  }
  if (type) conds.push(eq(applications.type, type));
  if (programmeId) conds.push(eq(applications.programmeId, Number(programmeId)));
  if (departmentId) conds.push(eq(applications.departmentId, Number(departmentId)));
  if (schoolId) conds.push(eq(applications.schoolId, Number(schoolId)));
  if (search) {
    const term = `%${String(search).trim()}%`;
    conds.push(or(
      ilike(applications.firstName, term),
      ilike(applications.lastName, term),
      ilike(applications.email, term),
      ilike(applications.applicationNumber, term),
      ilike(applications.jambRegNo, term),
    ));
  }
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db.select({ id: applications.id }).from(applications).where(where);
  return rows.length;
}

// ------------------------------------------------------------
// countByStatus — [{ status, c }]
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
// countByDepartment — [{ departmentId, departmentName, c }]
// Used by the dashboard's "top departments" widget.
// ------------------------------------------------------------
async function countByDepartment({ type, status } = {}) {
  const conds = [];
  if (type) conds.push(eq(applications.type, type));
  if (status) conds.push(eq(applications.status, status));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({
      departmentId: applications.departmentId,
      departmentName: departments.name,
      departmentCode: departments.code,
      c: sql`count(*)::int`,
    })
    .from(applications)
    .leftJoin(departments, eq(applications.departmentId, departments.id))
    .where(where)
    .groupBy(applications.departmentId, departments.name, departments.code)
    .orderBy(desc(sql`count(*)`))
    .limit(15);
}

// ------------------------------------------------------------
// countByState — [{ stateOfOrigin, c }]
// ------------------------------------------------------------
async function countByState() {
  return db
    .select({
      stateOfOrigin: applications.stateOfOrigin,
      c: sql`count(*)::int`,
    })
    .from(applications)
    .where(sql`${applications.stateOfOrigin} IS NOT NULL`)
    .groupBy(applications.stateOfOrigin)
    .orderBy(desc(sql`count(*)`))
    .limit(15);
}

// ------------------------------------------------------------
// countByDay — applications created per day over last N days.
// Returns [{ day, c }]. "day" is a date string YYYY-MM-DD.
// ------------------------------------------------------------
async function countByDay({ days = 30, type } = {}) {
  const conds = [sql`${applications.createdAt} >= NOW() - (${Number(days)} || ' days')::interval`];
  if (type) conds.push(eq(applications.type, type));
  const where = and(...conds);

  const rows = await db
    .select({
      day: sql`to_char(date_trunc('day', ${applications.createdAt}), 'YYYY-MM-DD')`,
      c: sql`count(*)::int`,
    })
    .from(applications)
    .where(where)
    .groupBy(sql`date_trunc('day', ${applications.createdAt})`)
    .orderBy(asc(sql`date_trunc('day', ${applications.createdAt})`));

  return rows;
}

// ------------------------------------------------------------
// findById — full row (no joins)
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
// findByIdWithRelations — full row + programme/dept/school names
// ------------------------------------------------------------
async function findByIdWithRelations(id) {
  if (!id) return null;
  const [row] = await db
    .select({
      id: applications.id,
      applicationNumber: applications.applicationNumber,
      type: applications.type,
      firstName: applications.firstName,
      lastName: applications.lastName,
      middleName: applications.middleName,
      email: applications.email,
      phone: applications.phone,
      gender: applications.gender,
      dateOfBirth: applications.dateOfBirth,
      country: applications.country,
      stateOfOrigin: applications.stateOfOrigin,
      lga: applications.lga,
      address: applications.address,
      programmeId: applications.programmeId,
      schoolId: applications.schoolId,
      departmentId: applications.departmentId,
      level: applications.level,
      oLevelResult: applications.oLevelResult,
      jambScore: applications.jambScore,
      jambRegNo: applications.jambRegNo,
      passportUrl: applications.passportUrl,
      status: applications.status,
      reviewedBy: applications.reviewedBy,
      reviewedAt: applications.reviewedAt,
      rejectionReason: applications.rejectionReason,
      admittedAt: applications.admittedAt,
      matricNumber: applications.matricNumber,
      userId: applications.userId,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
      programmeName: programmes.name,
      programmeCode: programmes.code,
      departmentName: departments.name,
      departmentCode: departments.code,
      schoolName: schools.name,
    })
    .from(applications)
    .leftJoin(programmes, eq(applications.programmeId, programmes.id))
    .leftJoin(departments, eq(applications.departmentId, departments.id))
    .leftJoin(schools, eq(applications.schoolId, schools.id))
    .where(eq(applications.id, Number(id)))
    .limit(1);
  return row || null;
}

// ------------------------------------------------------------
// findByNumber / findByEmail
// ------------------------------------------------------------
async function findByNumber(applicationNumber) {
  if (!applicationNumber) return null;
  const [row] = await db
    .select()
    .from(applications)
    .where(eq(applications.applicationNumber, applicationNumber))
    .limit(1);
  return row || null;
}

async function findByEmail(email) {
  if (!email) return null;
  const [row] = await db
    .select()
    .from(applications)
    .where(sql`lower(${applications.email}) = lower(${email})`)
    .limit(1);
  return row || null;
}

// ------------------------------------------------------------
// generateApplicationNumber — FPU/APP/YYYY/NNNNN
// ------------------------------------------------------------
async function generateApplicationNumber() {
  const year = new Date().getFullYear();
  const prefix = `FPU/APP/${year}/`;
  const rows = await db
    .select({ n: applications.applicationNumber })
    .from(applications)
    .where(sql`${applications.applicationNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(applications.applicationNumber))
    .limit(1);
  const last = rows[0]?.n || '';
  const lastSeq = parseInt(last.split('/').pop(), 10) || 0;
  const next = String(lastSeq + 1).padStart(5, '0');
  return `${prefix}${next}`;
}

// ------------------------------------------------------------
// create
// ------------------------------------------------------------
async function create(payload) {
  const applicationNumber = payload.applicationNumber || await generateApplicationNumber();
  const [row] = await db
    .insert(applications)
    .values({
      applicationNumber,
      type: payload.type || 'ND',
      firstName: payload.firstName,
      lastName: payload.lastName,
      middleName: payload.middleName || null,
      email: payload.email,
      phone: payload.phone,
      gender: payload.gender || null,
      dateOfBirth: payload.dateOfBirth || null,
      country: payload.country || 'Nigeria',
      stateOfOrigin: payload.stateOfOrigin || null,
      lga: payload.lga || null,
      address: payload.address || null,
      programmeId: payload.programmeId ? Number(payload.programmeId) : null,
      schoolId: payload.schoolId ? Number(payload.schoolId) : null,
      departmentId: payload.departmentId ? Number(payload.departmentId) : null,
      level: payload.level || 'ND',
      oLevelResult: payload.oLevelResult || null,
      jambScore: payload.jambScore ? Number(payload.jambScore) : null,
      jambRegNo: payload.jambRegNo || null,
      passportUrl: payload.passportUrl || null,
      status: payload.status || 'pending',
    })
    .returning();
  return row;
}

// ------------------------------------------------------------
// setStatus — update status + optional extras
// ------------------------------------------------------------
async function setStatus(id, status, extras = {}) {
  const patch = {
    status,
    reviewedBy: extras.reviewedBy ? Number(extras.reviewedBy) : undefined,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  };
  if (extras.rejectionReason !== undefined) patch.rejectionReason = extras.rejectionReason;
  if (status === 'approved') patch.admittedAt = new Date();

  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

  const [row] = await db
    .update(applications)
    .set(patch)
    .where(eq(applications.id, Number(id)))
    .returning();
  return row || null;
}

// ------------------------------------------------------------
// markRegistered — link to a user + assign matric
// ------------------------------------------------------------
async function markRegistered(id, { userId, matricNumber } = {}) {
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

// ------------------------------------------------------------
// remove
// ------------------------------------------------------------
async function remove(id) {
  const [row] = await db
    .delete(applications)
    .where(eq(applications.id, Number(id)))
    .returning();
  return row || null;
}

module.exports = {
  // reads
  list,
  count,
  countByStatus,
  countByDepartment,
  countByState,
  countByDay,
  findById,
  findByIdWithRelations,
  findByNumber,
  findByEmail,

  // writes
  generateApplicationNumber,
  create,
  setStatus,
  markRegistered,
  remove,
};