// ============================================================
// FPU — User queries
// Used by: routes/adminAuth, routes/adminUsers, routes/students,
//          routes/staff, routes/hods, routes/lecturers,
//          routes/users, routes/portal/*
// ============================================================

'use strict';

const { db, schema, sql } = require('..');
const { eq, and, or, ilike, inArray, desc, asc, isNull } = require('drizzle-orm');
const { users, departments, programmes, schools, staffProfiles } = schema;

// ============================================================
// SAFE SELECT MAPS
// ============================================================

const USER_FIELDS = {
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

const SAFE_COLS = {
  ...USER_FIELDS,
  programmeName: programmes.name,
  programmeCode: programmes.code,
  departmentName: departments.name,
  departmentCode: departments.code,
};

const SAFE_COLS_FULL = {
  ...SAFE_COLS,
  schoolName: schools.name,
};

// ------------------------------------------------------------
// Helper: normalize a row from a join query.
// ------------------------------------------------------------
function unwrapJoin(row) {
  if (!row) return null;

  const base = row.users || row;
  const dept = row.departments || {};
  const prog = row.programmes || {};
  const sch  = row.schools || {};

  return {
    ...base,
    departmentName: base.departmentName || dept.name || null,
    departmentCode: base.departmentCode || dept.code || null,
    programmeName:  base.programmeName  || prog.name || null,
    programmeCode:  base.programmeCode  || prog.code || null,
    schoolName:     base.schoolName     || sch.name  || null,
  };
}

// ============================================================
// Lookups
// ============================================================

async function findById(id) {
  if (!id) return null;
  const rows = await db
    .select(SAFE_COLS_FULL)
    .from(users)
    .leftJoin(programmes, eq(users.programmeId, programmes.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(schools, eq(users.schoolId, schools.id))
    .where(eq(users.id, Number(id)))
    .limit(1);

  if (!rows.length) return null;
  return rows[0];
}

async function findByIdWithRelations(id) {
  if (!id) return null;

  const rows = await db
    .select({
      user: SAFE_COLS_FULL,
      staffProfile: staffProfiles, // Fetch the staff profile
    })
    .from(users)
    .leftJoin(programmes, eq(users.programmeId, programmes.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(schools, eq(users.schoolId, schools.id))
    .leftJoin(staffProfiles, eq(users.id, staffProfiles.userId)) // Join the table
    .where(eq(users.id, Number(id)))
    .limit(1);

  if (!rows.length) return null;
  
  const row = rows[0];
  const user = row.user;

  return {
    ...user,
    staffProfile: row.staffProfile || null, // Return it to the API
    department: user.departmentName
      ? { id: user.departmentId, name: user.departmentName, code: user.departmentCode }
      : null,
    programme: user.programmeName
      ? { id: user.programmeId, name: user.programmeName, code: user.programmeCode }
      : null,
    school: user.schoolName
      ? { id: user.schoolId, name: user.schoolName }
      : null,
  };
}

async function findByEmail(email) {
  if (!email) return null;
  const rows = await db
    .select()
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(programmes, eq(users.programmeId, programmes.id))
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  if (!rows.length) return null;
  return unwrapJoin(rows[0]);
}

async function emailExists(email, exceptId = null) {
  if (!email) return false;
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`);
  if (!rows.length) return false;
  if (exceptId) return rows.some((r) => r.id !== Number(exceptId));
  return true;
}

// ============================================================
// Lists
// ============================================================

async function list({
  role, departmentId, schoolId, programmeId, level, search, isActive,
  limit = 50, offset = 0,
} = {}) {
  const conds = [];
  
  if (role) {
    // Map 'principal' to 'rector' if that's what your DB uses
    const dbRole = role === 'principal' ? 'rector' : role;
    conds.push(eq(users.role, dbRole));
  }
  
  if (departmentId) conds.push(eq(users.departmentId, Number(departmentId)));
  if (schoolId) conds.push(eq(users.schoolId, Number(schoolId)));
  if (programmeId) conds.push(eq(users.programmeId, Number(programmeId)));
  if (level) conds.push(eq(users.level, level));
  
  if (search) {
    const like = `%${search}%`;
    conds.push(or(
      ilike(users.firstName, like),
      ilike(users.lastName, like),
      ilike(users.email, like),
      ilike(users.matricNumber, like),
    ));
  }
  
  if (isActive === true || isActive === 'true') conds.push(eq(users.isActive, true));
  if (isActive === false || isActive === 'false') conds.push(eq(users.isActive, false));

  const where = conds.length ? and(...conds) : undefined;

  const results = await db
    .select({
      user: SAFE_COLS,
      staffProfile: staffProfiles
    })
    .from(users)
    .leftJoin(programmes, eq(users.programmeId, programmes.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(staffProfiles, eq(users.id, staffProfiles.userId)) // Join profile
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(Math.min(Number(limit) || 50, 500))
    .offset(Number(offset) || 0);

  return results.map(r => ({
    ...r.user,
    staffProfile: r.staffProfile || null
  }));
}

async function listStaff({ departmentId, role } = {}) {
  const conds = [sql`${users.role} <> 'student'`];
  if (departmentId) conds.push(eq(users.departmentId, Number(departmentId)));
  if (role) {
    const dbRole = role === 'principal' ? 'rector' : role;
    conds.push(eq(users.role, dbRole));
  }

  return db
    .select(SAFE_COLS)
    .from(users)
    .leftJoin(programmes, eq(users.programmeId, programmes.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(...conds))
    .orderBy(asc(users.firstName), asc(users.lastName));
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
    .leftJoin(programmes, eq(users.programmeId, programmes.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(...conds))
    .orderBy(asc(users.lastName), asc(users.firstName));
}

async function count({ role, departmentId, schoolId, programmeId, level, isActive } = {}) {
  const conds = [];
  if (role) {
    const dbRole = role === 'principal' ? 'rector' : role;
    conds.push(eq(users.role, dbRole));
  }
  if (departmentId) conds.push(eq(users.departmentId, Number(departmentId)));
  if (schoolId) conds.push(eq(users.schoolId, Number(schoolId)));
  if (programmeId) conds.push(eq(users.programmeId, Number(programmeId)));
  if (level) conds.push(eq(users.level, level));
  if (isActive === true || isActive === 'true') conds.push(eq(users.isActive, true));
  else if (isActive === false || isActive === 'false') conds.push(eq(users.isActive, false));

  const where = conds.length ? and(...conds) : undefined;
  const rows = await db.select({ id: users.id }).from(users).where(where);
  return rows.length;
}

// ============================================================
// Writes
// ============================================================

async function create(payload) {
  const [row] = await db
    .insert(users)
    .values({
      email: payload.email,
      passwordHash: payload.passwordHash,
      role: payload.role,
      firstName: payload.firstName,
      lastName: payload.lastName,
      middleName: payload.middleName || null,
      phone: payload.phone || null,
      gender: payload.gender || null,
      dateOfBirth: payload.dateOfBirth || null,
      stateOfOrigin: payload.stateOfOrigin || null,
      nationality: payload.nationality || null,
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
  return row;
}

async function update(id, patch) {
  const allowed = [
    'firstName', 'lastName', 'middleName', 'email', 'phone',
    'gender', 'dateOfBirth', 'stateOfOrigin', 'nationality', 'address',
    'matricNumber', 'level', 'programmeId', 'departmentId', 'schoolId',
    'currentSessionId', 'isActive', 'mustChangePassword',
    'photoUrl', 'signatureUrl',
    'passwordHash',
  ];
  const clean = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) clean[k] = patch[k];
  }

  if (clean.programmeId !== undefined) clean.programmeId = clean.programmeId ? Number(clean.programmeId) : null;
  if (clean.departmentId !== undefined) clean.departmentId = clean.departmentId ? Number(clean.departmentId) : null;
  if (clean.schoolId !== undefined) clean.schoolId = clean.schoolId ? Number(clean.schoolId) : null;
  if (clean.currentSessionId !== undefined) clean.currentSessionId = clean.currentSessionId ? Number(clean.currentSessionId) : null;

  clean.updatedAt = new Date();

  const [row] = await db
    .update(users)
    .set(clean)
    .where(eq(users.id, Number(id)))
    .returning();
  return row || null;
}

async function updatePassword(id, passwordHash) {
  const [row] = await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, Number(id)))
    .returning();
  return row || null;
}

async function setActive(id, isActive) {
  const [row] = await db
    .update(users)
    .set({ isActive: !!isActive, updatedAt: new Date() })
    .where(eq(users.id, Number(id)))
    .returning();
  return row || null;
}

async function toggleActive(id) {
  const [row] = await db
    .update(users)
    .set({ isActive: sql`NOT ${users.isActive}`, updatedAt: new Date() })
    .where(eq(users.id, Number(id)))
    .returning();
  return row || null;
}

async function remove(id) {
  const [row] = await db
    .delete(users)
    .where(eq(users.id, Number(id)))
    .returning();
  return row || null;
}

async function touchLogin(id) {
  try {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, Number(id)));
  } catch { /* ignore */ }
}

async function findHodForDepartment(departmentId) {
  if (!departmentId) return null;
  const [row] = await db
    .select()
    .from(users)
    .where(and(
      eq(users.role, 'hod'),
      eq(users.departmentId, Number(departmentId))
    ))
    .limit(1);
  return row || null;
}

// ============================================================
// Exports
// ============================================================
module.exports = {
  findById,
  findByIdWithRelations,
  findHodForDepartment,
  findByEmail,
  emailExists,
  list,
  listStaff,
  listStudents,
  count,
  create,
  update,
  updatePassword,
  setActive,
  toggleActive,
  remove,
  touchLogin,
  SAFE_COLS,
  SAFE_COLS_FULL,
};