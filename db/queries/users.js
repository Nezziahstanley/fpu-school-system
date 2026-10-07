// ============================================================
// FPU — User queries
// Used by: routes/adminAuth, routes/adminUsers, routes/students,
//          routes/staff, routes/hods, routes/lecturers,
//          routes/users, routes/portal/*
// ============================================================

'use strict';

const { db, schema, sql } = require('..');
const { eq, and, or, ilike, inArray, desc, asc, isNull } = require('drizzle-orm');
const { users, departments, programmes, schools } = schema;

// ------------------------------------------------------------
// Safe select — never leaks password_hash
// ------------------------------------------------------------
const SAFE_COLS = {
  id: users.id,
  email: users.email,
  role: users.role,
  firstName: users.firstName,
  lastName: users.lastName,
  middleName: users.middleName,
  phone: users.phone,
  gender: users.gender,
  dateOfBirth: users.dateOfBirth,
  stateOfOrigin: users.stateOfOrigin,
  nationality: users.nationality,
  address: users.address,
  photoUrl: users.photoUrl,
  matricNumber: users.matricNumber,
  level: users.level,
  programmeId: users.programmeId,
  departmentId: users.departmentId,
  schoolId: users.schoolId,
  currentSessionId: users.currentSessionId,
  isActive: users.isActive,
  mustChangePassword: users.mustChangePassword,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

// ------------------------------------------------------------
// findById — includes passwordHash (internal use: auth)
// ------------------------------------------------------------
async function findById(id) {
  if (!id) return null;
  const [row] = await db.select().from(users).where(eq(users.id, Number(id))).limit(1);
  return row || null;
}

// ------------------------------------------------------------
// findByIdSafe — no password hash
// ------------------------------------------------------------
async function findByIdSafe(id) {
  if (!id) return null;
  const [row] = await db.select(SAFE_COLS).from(users).where(eq(users.id, Number(id))).limit(1);
  return row || null;
}

// ------------------------------------------------------------
// findByIdWithRelations — user + department/programme/school
// ------------------------------------------------------------
async function findByIdWithRelations(id) {
  if (!id) return null;
  const [row] = await db
    .select({
      user: users,
      department: departments,
      programme: programmes,
      school: schools,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(programmes, eq(users.programmeId, programmes.id))
    .leftJoin(schools, eq(users.schoolId, schools.id))
    .where(eq(users.id, Number(id)))
    .limit(1);

  if (!row) return null;

  const u = row.user;
  delete u.passwordHash;
  return {
    ...u,
    department: row.department || null,
    programme: row.programme || null,
    school: row.school || null,
  };
}

// ------------------------------------------------------------
// findByEmail — includes passwordHash (login)
// ------------------------------------------------------------
async function findByEmail(email) {
  if (!email) return null;
  const [row] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);
  return row || null;
}async function findByEmail(email) {
  if (!email) return null;
  const [row] = await db
    .select()
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  if (!row) return null;

  // Drizzle returns joined rows nested: { users: {...}, departments: {...} }
  const base = row.users || row;
  const dept = row.departments || {};

  return {
    ...base,
    departmentName: dept.name || null,
    departmentCode: dept.code || null,
  };
}

// ------------------------------------------------------------
// emailExists
// ------------------------------------------------------------
async function emailExists(email) {
  if (!email) return false;
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);
  return !!row;
}

// ------------------------------------------------------------
// list — flexible filter used by every admin list endpoint
// ------------------------------------------------------------
async function list({
  role,
  departmentId,
  schoolId,
  programmeId,
  level,
  search,
  isActive,
  limit = 100,
  offset = 0,
} = {}) {
  const conds = [];
  if (role) conds.push(eq(users.role, role));
  if (departmentId) conds.push(eq(users.departmentId, Number(departmentId)));
  if (schoolId) conds.push(eq(users.schoolId, Number(schoolId)));
  if (programmeId) conds.push(eq(users.programmeId, Number(programmeId)));
  if (level) conds.push(eq(users.level, level));

  if (isActive === true || isActive === 'true') conds.push(eq(users.isActive, true));
  else if (isActive === false || isActive === 'false') conds.push(eq(users.isActive, false));

  if (search) {
    const term = `%${String(search).trim()}%`;
    conds.push(
      or(
        ilike(users.firstName, term),
        ilike(users.lastName, term),
        ilike(users.email, term),
        ilike(users.matricNumber, term)
      )
    );
  }

  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select(SAFE_COLS)
    .from(users)
    .where(where)
    .orderBy(asc(users.lastName), asc(users.firstName))
    .limit(Number(limit))
    .offset(Number(offset));

  return rows;
}

// ------------------------------------------------------------
// count
// ------------------------------------------------------------
async function count({ role, departmentId, schoolId, programmeId, level, isActive } = {}) {
  const conds = [];
  if (role) conds.push(eq(users.role, role));
  if (departmentId) conds.push(eq(users.departmentId, Number(departmentId)));
  if (schoolId) conds.push(eq(users.schoolId, Number(schoolId)));
  if (programmeId) conds.push(eq(users.programmeId, Number(programmeId)));
  if (level) conds.push(eq(users.level, level));
  if (isActive === true || isActive === 'true') conds.push(eq(users.isActive, true));
  else if (isActive === false || isActive === 'false') conds.push(eq(users.isActive, false));

  const where = conds.length ? and(...conds) : undefined;
  const [row] = await db.select({ c: sql`count(*)::int` }).from(users).where(where);
  return row?.c ?? 0;
}

// ------------------------------------------------------------
// listStaff / listStudents — convenience wrappers
// ------------------------------------------------------------
async function listStaff({ departmentId, role } = {}) {
  const conds = [sql`${users.role} <> 'student'`];
  if (departmentId) conds.push(eq(users.departmentId, Number(departmentId)));
  if (role) conds.push(eq(users.role, role));
  return db
    .select(SAFE_COLS)
    .from(users)
    .where(and(...conds))
    .orderBy(asc(users.lastName));
}

async function listStudents({ departmentId, programmeId, level, sessionId } = {}) {
  const conds = [eq(users.role, 'student')];
  if (departmentId) conds.push(eq(users.departmentId, Number(departmentId)));
  if (programmeId) conds.push(eq(users.programmeId, Number(programmeId)));
  if (level) conds.push(eq(users.level, level));
  if (sessionId) conds.push(eq(users.currentSessionId, Number(sessionId)));
  return db
    .select(SAFE_COLS)
    .from(users)
    .where(and(...conds))
    .orderBy(asc(users.matricNumber));
}

// ------------------------------------------------------------
// create — callers must hash the password themselves
// ------------------------------------------------------------
async function create(payload) {
  const [row] = await db
    .insert(users)
    .values({
      email: String(payload.email).trim().toLowerCase(),
      passwordHash: payload.passwordHash,
      role: payload.role || 'student',
      firstName: payload.firstName,
      lastName: payload.lastName,
      middleName: payload.middleName || null,
      phone: payload.phone || null,
      gender: payload.gender || null,
      dateOfBirth: payload.dateOfBirth || null,
      stateOfOrigin: payload.stateOfOrigin || null,
      nationality: payload.nationality || 'Nigerian',
      address: payload.address || null,
      photoUrl: payload.photoUrl || null,
      matricNumber: payload.matricNumber || null,
      level: payload.level || null,
      programmeId: payload.programmeId ? Number(payload.programmeId) : null,
      departmentId: payload.departmentId ? Number(payload.departmentId) : null,
      schoolId: payload.schoolId ? Number(payload.schoolId) : null,
      currentSessionId: payload.currentSessionId ? Number(payload.currentSessionId) : null,
      isActive: payload.isActive !== false,
      mustChangePassword: !!payload.mustChangePassword,
    })
    .returning();

  const out = { ...row };
  delete out.passwordHash;
  return out;
}

// ------------------------------------------------------------
// update — whitelisted fields only
// ------------------------------------------------------------
async function update(id, patch) {
  const allowed = [
    'email', 'firstName', 'lastName', 'middleName', 'phone', 'gender',
    'dateOfBirth', 'stateOfOrigin', 'nationality', 'address', 'photoUrl',
    'matricNumber', 'level', 'programmeId', 'departmentId', 'schoolId',
    'currentSessionId', 'isActive', 'mustChangePassword',
  ];
  const clean = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) clean[k] = patch[k];
  }
  if (clean.email) clean.email = String(clean.email).trim().toLowerCase();
  if (clean.programmeId !== undefined) clean.programmeId = clean.programmeId ? Number(clean.programmeId) : null;
  if (clean.departmentId !== undefined) clean.departmentId = clean.departmentId ? Number(clean.departmentId) : null;
  if (clean.schoolId !== undefined) clean.schoolId = clean.schoolId ? Number(clean.schoolId) : null;
  if (clean.currentSessionId !== undefined) clean.currentSessionId = clean.currentSessionId ? Number(clean.currentSessionId) : null;
  clean.updatedAt = new Date();

  const [row] = await db.update(users).set(clean).where(eq(users.id, Number(id))).returning();
  if (!row) return null;
  const out = { ...row };
  delete out.passwordHash;
  return out;
}

// ------------------------------------------------------------
// updatePassword
// ------------------------------------------------------------
async function updatePassword(id, passwordHash) {
  const [row] = await db
    .update(users)
    .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
    .where(eq(users.id, Number(id)))
    .returning({ id: users.id });
  return !!row;
}

// ------------------------------------------------------------
// setActive
// ------------------------------------------------------------
async function setActive(id, isActive) {
  const [row] = await db
    .update(users)
    .set({ isActive: !!isActive, updatedAt: new Date() })
    .where(eq(users.id, Number(id)))
    .returning(SAFE_COLS);
  return row || null;
}

// ------------------------------------------------------------
// touchLogin
// ------------------------------------------------------------
async function touchLogin(id) {
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, Number(id)));
}

// ------------------------------------------------------------
// remove — hard delete
// ------------------------------------------------------------
async function remove(id) {
  const [row] = await db.delete(users).where(eq(users.id, Number(id))).returning({ id: users.id });
  return !!row;
}

module.exports = {
  SAFE_COLS,
  findById,
  findByIdSafe,
  findByIdWithRelations,
  findByEmail,
  emailExists,
  list,
  count,
  listStaff,
  listStudents,
  create,
  update,
  updatePassword,
  setActive,
  touchLogin,
  remove,
};