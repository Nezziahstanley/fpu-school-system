// ============================================================
// FPU — Course / programme / school / department queries
// Used by: routes/courses, routes/programmes, routes/schools,
//          routes/departments, routes/allocations, routes/adminLookups
// ============================================================

'use strict';

const { db, schema, sql } = require('..');
const { eq, and, or, ilike, asc, desc, inArray } = require('drizzle-orm');

const {
  courses,
  programmes,
  departments,
  schools,
  courseAllocations,
  users,
  academicSessions,
} = schema;

// ============================================================
// COURSES
// ============================================================
async function list({ programmeId, departmentId, level, semester, search, limit = 200, offset = 0 } = {}) {
  const conds = [];
  if (programmeId) conds.push(eq(courses.programmeId, Number(programmeId)));
  if (departmentId) conds.push(eq(courses.departmentId, Number(departmentId)));
  if (level) conds.push(eq(courses.level, level));
  if (semester) conds.push(eq(courses.semesterName, semester));
  if (search) {
    const term = `%${String(search).trim()}%`;
    conds.push(or(ilike(courses.code, term), ilike(courses.title, term)));
  }
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select()
    .from(courses)
    .where(where)
    .orderBy(asc(courses.code))
    .limit(Number(limit))
    .offset(Number(offset));
}

async function count({ programmeId, departmentId, level, semester } = {}) {
  const conds = [];
  if (programmeId) conds.push(eq(courses.programmeId, Number(programmeId)));
  if (departmentId) conds.push(eq(courses.departmentId, Number(departmentId)));
  if (level) conds.push(eq(courses.level, level));
  if (semester) conds.push(eq(courses.semesterName, semester));
  const where = conds.length ? and(...conds) : undefined;
  const [row] = await db.select({ c: sql`count(*)::int` }).from(courses).where(where);
  return row?.c ?? 0;
}

async function findById(id) {
  if (!id) return null;
  const [row] = await db.select().from(courses).where(eq(courses.id, Number(id))).limit(1);
  return row || null;
}

async function findByIdWithRelations(id) {
  if (!id) return null;
  const [row] = await db
    .select({
      course: courses,
      programme: programmes,
      department: departments,
    })
    .from(courses)
    .leftJoin(programmes, eq(courses.programmeId, programmes.id))
    .leftJoin(departments, eq(courses.departmentId, departments.id))
    .where(eq(courses.id, Number(id)))
    .limit(1);
  if (!row) return null;
  return { ...row.course, programme: row.programme, department: row.department };
}

async function codeExists(code, programmeId, level, semesterName) {
  if (!code) return false;
  const conds = [
    eq(courses.code, code),
    eq(courses.level, level || 'ND'),
    eq(courses.semesterName, semesterName || 'First'),
  ];
  if (programmeId) conds.push(eq(courses.programmeId, Number(programmeId)));
  const [row] = await db.select({ id: courses.id }).from(courses).where(and(...conds)).limit(1);
  return !!row;
}

async function create(payload) {
  const [row] = await db
    .insert(courses)
    .values({
      code: String(payload.code).trim().toUpperCase(),
      title: String(payload.title).trim(),
      unit: Number(payload.unit) || 2,
      level: payload.level || 'ND',
      semesterName: payload.semesterName || payload.semester || 'First',
      yearOfStudy: Number(payload.yearOfStudy) || 1,
      programmeId: Number(payload.programmeId),
      departmentId: Number(payload.departmentId),
      description: payload.description || null,
      isElective: !!payload.isElective,
      isActive: payload.isActive !== false,
    })
    .returning();
  return row;
}

async function update(id, patch) {
  const allowed = [
    'code', 'title', 'unit', 'level', 'semesterName', 'yearOfStudy',
    'programmeId', 'departmentId', 'description', 'isElective', 'isActive',
  ];
  const clean = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) clean[k] = patch[k];
  }
  if (clean.code) clean.code = String(clean.code).trim().toUpperCase();
  if (clean.title) clean.title = String(clean.title).trim();
  if (clean.unit !== undefined) clean.unit = Number(clean.unit);
  if (clean.programmeId !== undefined) clean.programmeId = Number(clean.programmeId);
  if (clean.departmentId !== undefined) clean.departmentId = Number(clean.departmentId);
  if (clean.yearOfStudy !== undefined) clean.yearOfStudy = Number(clean.yearOfStudy);

  const [row] = await db.update(courses).set(clean).where(eq(courses.id, Number(id))).returning();
  return row || null;
}

async function remove(id) {
  const [row] = await db.delete(courses).where(eq(courses.id, Number(id))).returning({ id: courses.id });
  return !!row;
}

// ============================================================
// ALLOCATIONS
// ============================================================
async function listAllocationsWithRelations({ sessionId, lecturerId, courseId, semester } = {}) {
  const conds = [];
  if (sessionId) conds.push(eq(courseAllocations.sessionId, Number(sessionId)));
  if (lecturerId) conds.push(eq(courseAllocations.lecturerId, Number(lecturerId)));
  if (courseId) conds.push(eq(courseAllocations.courseId, Number(courseId)));
  if (semester) conds.push(eq(courseAllocations.semester, semester));
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      allocation: courseAllocations,
      course: courses,
      lecturer: users,
    })
    .from(courseAllocations)
    .leftJoin(courses, eq(courseAllocations.courseId, courses.id))
    .leftJoin(users, eq(courseAllocations.lecturerId, users.id))
    .where(where)
    .orderBy(desc(courseAllocations.createdAt));

  return rows.map((r) => ({
    id: r.allocation.id,
    allocation: r.allocation,
    course: r.course,
    lecturer: r.lecturer,
  }));
}

async function findAllocationById(id) {
  if (!id) return null;
  const [row] = await db
    .select({
      allocation: courseAllocations,
      course: courses,
      lecturer: users,
    })
    .from(courseAllocations)
    .leftJoin(courses, eq(courseAllocations.courseId, courses.id))
    .leftJoin(users, eq(courseAllocations.lecturerId, users.id))
    .where(eq(courseAllocations.id, Number(id)))
    .limit(1);
  if (!row) return null;
  return { id: row.allocation.id, ...row.allocation, course: row.course, lecturer: row.lecturer };
}

async function createAllocation({ courseId, lecturerId, sessionId, semester }) {
  const [row] = await db
    .insert(courseAllocations)
    .values({
      courseId: Number(courseId),
      lecturerId: Number(lecturerId),
      sessionId: Number(sessionId),
      semester,
    })
    .returning();
  return row;
}

async function bulkAllocate(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const values = rows.map((r) => ({
    courseId: Number(r.courseId),
    lecturerId: Number(r.lecturerId),
    sessionId: Number(r.sessionId),
    semester: r.semester,
  }));
  return db.insert(courseAllocations).values(values).onConflictDoNothing().returning();
}

async function updateAllocation(id, patch) {
  const clean = {};
  if (patch.courseId !== undefined) clean.courseId = Number(patch.courseId);
  if (patch.lecturerId !== undefined) clean.lecturerId = Number(patch.lecturerId);
  if (patch.sessionId !== undefined) clean.sessionId = Number(patch.sessionId);
  if (patch.semester !== undefined) clean.semester = patch.semester;

  const [row] = await db.update(courseAllocations).set(clean).where(eq(courseAllocations.id, Number(id))).returning();
  return row || null;
}

async function removeAllocation(id) {
  const [row] = await db.delete(courseAllocations).where(eq(courseAllocations.id, Number(id))).returning({ id: courseAllocations.id });
  return !!row;
}

// ============================================================
// PROGRAMMES
// ============================================================
async function listProgrammes({ departmentId, level } = {}) {
  const conds = [];
  if (departmentId) conds.push(eq(programmes.departmentId, Number(departmentId)));
  if (level) conds.push(eq(programmes.level, level));
  const where = conds.length ? and(...conds) : undefined;
  return db.select().from(programmes).where(where).orderBy(asc(programmes.code));
}

async function findProgrammeById(id) {
  if (!id) return null;
  const [row] = await db.select().from(programmes).where(eq(programmes.id, Number(id))).limit(1);
  return row || null;
}

async function findProgrammeByCode(code, level) {
  if (!code) return null;
  const conds = [eq(programmes.code, String(code).trim().toUpperCase())];
  if (level) conds.push(eq(programmes.level, level));
  const [row] = await db.select().from(programmes).where(and(...conds)).limit(1);
  return row || null;
}

async function createProgramme({ code, name, departmentId, level, durationYears }) {
  const [row] = await db
    .insert(programmes)
    .values({
      code: String(code).trim().toUpperCase(),
      name: String(name).trim(),
      departmentId: Number(departmentId),
      level: level || 'ND',
      durationYears: Number(durationYears) || 2,
    })
    .returning();
  return row;
}

async function updateProgramme(id, patch) {
  const clean = {};
  if (patch.code !== undefined) clean.code = String(patch.code).trim().toUpperCase();
  if (patch.name !== undefined) clean.name = String(patch.name).trim();
  if (patch.departmentId !== undefined) clean.departmentId = Number(patch.departmentId);
  if (patch.level !== undefined) clean.level = patch.level;
  if (patch.durationYears !== undefined) clean.durationYears = Number(patch.durationYears);

  const [row] = await db.update(programmes).set(clean).where(eq(programmes.id, Number(id))).returning();
  return row || null;
}

async function removeProgramme(id) {
  const [row] = await db.delete(programmes).where(eq(programmes.id, Number(id))).returning({ id: programmes.id });
  return !!row;
}

// ============================================================
// SCHOOLS
// ============================================================
async function listSchools() {
  return db.select().from(schools).orderBy(asc(schools.code));
}

async function findSchoolById(id) {
  if (!id) return null;
  const [row] = await db.select().from(schools).where(eq(schools.id, Number(id))).limit(1);
  return row || null;
}

async function createSchool({ code, name, description }) {
  const [row] = await db
    .insert(schools)
    .values({
      code: String(code).trim().toUpperCase(),
      name: String(name).trim(),
      description: description || null,
    })
    .returning();
  return row;
}

async function updateSchool(id, patch) {
  const clean = {};
  if (patch.code !== undefined) clean.code = String(patch.code).trim().toUpperCase();
  if (patch.name !== undefined) clean.name = String(patch.name).trim();
  if (patch.description !== undefined) clean.description = patch.description || null;
  const [row] = await db.update(schools).set(clean).where(eq(schools.id, Number(id))).returning();
  return row || null;
}

async function removeSchool(id) {
  const [row] = await db.delete(schools).where(eq(schools.id, Number(id))).returning({ id: schools.id });
  return !!row;
}

// ============================================================
// DEPARTMENTS
// ============================================================
async function listDepartments({ schoolId } = {}) {
  const conds = [];
  if (schoolId) conds.push(eq(departments.schoolId, Number(schoolId)));
  const where = conds.length ? and(...conds) : undefined;
  return db.select().from(departments).where(where).orderBy(asc(departments.code));
}

async function findDepartmentById(id) {
  if (!id) return null;
  const [row] = await db.select().from(departments).where(eq(departments.id, Number(id))).limit(1);
  return row || null;
}

async function createDepartment({ code, name, schoolId, hodUserId }) {
  const [row] = await db
    .insert(departments)
    .values({
      code: String(code).trim().toUpperCase(),
      name: String(name).trim(),
      schoolId: Number(schoolId),
      hodUserId: hodUserId ? Number(hodUserId) : null,
    })
    .returning();
  return row;
}

async function updateDepartment(id, patch) {
  const clean = {};
  if (patch.code !== undefined) clean.code = String(patch.code).trim().toUpperCase();
  if (patch.name !== undefined) clean.name = String(patch.name).trim();
  if (patch.schoolId !== undefined) clean.schoolId = Number(patch.schoolId);
  if (patch.hodUserId !== undefined) clean.hodUserId = patch.hodUserId ? Number(patch.hodUserId) : null;
  const [row] = await db.update(departments).set(clean).where(eq(departments.id, Number(id))).returning();
  return row || null;
}

async function removeDepartment(id) {
  const [row] = await db.delete(departments).where(eq(departments.id, Number(id))).returning({ id: departments.id });
  return !!row;
}

module.exports = {
  // courses
  list,
  count,
  findById,
  findByIdWithRelations,
  codeExists,
  create,
  update,
  remove,

  // allocations
  listAllocationsWithRelations,
  findAllocationById,
  createAllocation,
  bulkAllocate,
  updateAllocation,
  removeAllocation,

  // programmes
  listProgrammes,
  findProgrammeById,
  findProgrammeByCode,
  createProgramme,
  updateProgramme,
  removeProgramme,

  // schools
  listSchools,
  findSchoolById,
  createSchool,
  updateSchool,
  removeSchool,

  // departments
  listDepartments,
  findDepartmentById,
  createDepartment,
  updateDepartment,
  removeDepartment,
}; 