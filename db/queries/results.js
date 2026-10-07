// ============================================================
// FPU — Results + grade-scale queries
// Used by: routes/results, routes/transcript, routes/graduation,
//          routes/gradeScales, routes/portal/student
// ============================================================

'use strict';

const { db, schema, sql } = require('..');
const { eq, and, or, inArray, asc, desc } = require('drizzle-orm');

const { results, courses, users, gradeScales, academicSessions } = schema;

// ------------------------------------------------------------
// list (flat)
// ------------------------------------------------------------
async function list({ studentId, courseId, sessionId, semester, status, limit = 500, offset = 0 } = {}) {
  const conds = [];
  if (studentId) conds.push(eq(results.studentId, Number(studentId)));
  if (courseId) conds.push(eq(results.courseId, Number(courseId)));
  if (sessionId) conds.push(eq(results.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(results.semester, semester));
  if (status) conds.push(eq(results.status, status));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select()
    .from(results)
    .where(where)
    .orderBy(desc(results.updatedAt))
    .limit(Number(limit))
    .offset(Number(offset));
}

// ------------------------------------------------------------
// listWithCourse — joins course
// ------------------------------------------------------------
async function listWithCourse({ studentId, sessionId, semester, status } = {}) {
  const conds = [];
  if (studentId) conds.push(eq(results.studentId, Number(studentId)));
  if (sessionId) conds.push(eq(results.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(results.semester, semester));
  if (status) conds.push(eq(results.status, status));
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({ result: results, course: courses })
    .from(results)
    .leftJoin(courses, eq(results.courseId, courses.id))
    .where(where)
    .orderBy(asc(courses.code));
  return rows;
}

// ------------------------------------------------------------
// listWithStudent — joins student
// ------------------------------------------------------------
async function listWithStudent({ courseId, sessionId, semester, status } = {}) {
  const conds = [];
  if (courseId) conds.push(eq(results.courseId, Number(courseId)));
  if (sessionId) conds.push(eq(results.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(results.semester, semester));
  if (status) conds.push(eq(results.status, status));
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({ result: results, student: users })
    .from(results)
    .leftJoin(users, eq(results.studentId, users.id))
    .where(where)
    .orderBy(asc(users.matricNumber));
  return rows;
}

// ------------------------------------------------------------
// findById
// ------------------------------------------------------------
async function findById(id) {
  if (!id) return null;
  const [row] = await db.select().from(results).where(eq(results.id, Number(id))).limit(1);
  return row || null;
}

// ------------------------------------------------------------
// upsert — used by POST /api/admin/results
// ------------------------------------------------------------
async function upsert(payload) {
  const [row] = await db
    .insert(results)
    .values({
      studentId: Number(payload.studentId),
      courseId: Number(payload.courseId),
      sessionId: Number(payload.sessionId),
      semester: payload.semester,
      score: String(payload.score),
      grade: payload.grade || null,
      points: payload.points !== undefined ? String(payload.points) : null,
      status: payload.status || 'draft',
    })
    .onConflictDoUpdate({
      target: [results.studentId, results.courseId, results.sessionId, results.semester],
      set: {
        score: String(payload.score),
        grade: payload.grade || null,
        points: payload.points !== undefined ? String(payload.points) : null,
        status: payload.status || 'draft',
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

// ------------------------------------------------------------
// update — whitelisted
// ------------------------------------------------------------
async function update(id, patch) {
  const allowed = ['score', 'grade', 'points', 'status', 'rejectionReason'];
  const clean = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) clean[k] = patch[k];
  }
  if (clean.score !== undefined) clean.score = String(clean.score);
  if (clean.points !== undefined && clean.points !== null) clean.points = String(clean.points);
  clean.updatedAt = new Date();
  const [row] = await db.update(results).set(clean).where(eq(results.id, Number(id))).returning();
  return row || null;
}

// ------------------------------------------------------------
// Workflow transitions
// ------------------------------------------------------------
async function submit(id, userId) {
  const [row] = await db
    .update(results)
    .set({ status: 'submitted', submittedBy: Number(userId), submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(results.id, Number(id)))
    .returning();
  return row || null;
}

async function hodVerify(id, userId) {
  const [row] = await db
    .update(results)
    .set({ status: 'hod_verified', hodVerifiedBy: Number(userId), hodVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(results.id, Number(id)))
    .returning();
  return row || null;
}

async function hodReject(id, userId, reason) {
  const [row] = await db
    .update(results)
    .set({
      status: 'hod_rejected',
      hodVerifiedBy: Number(userId),
      hodVerifiedAt: new Date(),
      rejectionReason: reason || 'Rejected by HOD.',
      updatedAt: new Date(),
    })
    .where(eq(results.id, Number(id)))
    .returning();
  return row || null;
}

async function adminApprove(id, userId) {
  const [row] = await db
    .update(results)
    .set({ status: 'approved', approvedBy: Number(userId), approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(results.id, Number(id)))
    .returning();
  return row || null;
}

async function adminReject(id, userId, reason) {
  const [row] = await db
    .update(results)
    .set({
      status: 'admin_rejected',
      approvedBy: Number(userId),
      approvedAt: new Date(),
      rejectionReason: reason || 'Rejected by admin.',
      updatedAt: new Date(),
    })
    .where(eq(results.id, Number(id)))
    .returning();
  return row || null;
}

async function publish(id) {
  const [row] = await db
    .update(results)
    .set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(results.id, Number(id)))
    .returning();
  return row || null;
}

async function publishBatch(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  return db
    .update(results)
    .set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() })
    .where(inArray(results.id, ids.map(Number)))
    .returning();
}

// ------------------------------------------------------------
// Pending lists for HOD / Admin
// ------------------------------------------------------------
async function listPendingForHod(departmentId, { sessionId, semester } = {}) {
  const conds = [
    eq(results.status, 'submitted'),
    eq(courses.departmentId, Number(departmentId)),
  ];
  if (sessionId) conds.push(eq(results.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(results.semester, semester));

  const rows = await db
    .select({ result: results, student: users, course: courses })
    .from(results)
    .leftJoin(courses, eq(results.courseId, courses.id))
    .leftJoin(users, eq(results.studentId, users.id))
    .where(and(...conds))
    .orderBy(asc(courses.code));
  return rows;
}

async function listPendingAdmin({ sessionId, semester } = {}) {
  const conds = [eq(results.status, 'hod_verified')];
  if (sessionId) conds.push(eq(results.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(results.semester, semester));

  const rows = await db
    .select({ result: results, student: users, course: courses })
    .from(results)
    .leftJoin(courses, eq(results.courseId, courses.id))
    .leftJoin(users, eq(results.studentId, users.id))
    .where(and(...conds))
    .orderBy(asc(courses.code));
  return rows;
}

// ------------------------------------------------------------
// Published results for a student (used by transcript + graduation)
// ------------------------------------------------------------
async function publishedForStudent(studentId, { sessionId } = {}) {
  const conds = [
    eq(results.studentId, Number(studentId)),
    eq(results.status, 'published'),
  ];
  if (sessionId) conds.push(eq(results.sessionId, Number(sessionId)));

  const rows = await db
    .select({
      result: results,
      course: courses,
      session: academicSessions,
    })
    .from(results)
    .leftJoin(courses, eq(results.courseId, courses.id))
    .leftJoin(academicSessions, eq(results.sessionId, academicSessions.id))
    .where(and(...conds))
    .orderBy(asc(results.sessionId), asc(results.semester), asc(courses.code));
  return rows;
}

// ------------------------------------------------------------
// Grade scales
// ------------------------------------------------------------
async function listGradeScales({ isActive } = {}) {
  const conds = [];
  if (isActive !== undefined) conds.push(eq(gradeScales.isActive, !!isActive));
  const where = conds.length ? and(...conds) : undefined;
  return db.select().from(gradeScales).where(where).orderBy(asc(gradeScales.minScore));
}

async function findGradeScaleById(id) {
  if (!id) return null;
  const [row] = await db.select().from(gradeScales).where(eq(gradeScales.id, Number(id))).limit(1);
  return row || null;
}

async function createGradeScale(payload) {
  const [row] = await db
    .insert(gradeScales)
    .values({
      grade: String(payload.grade).trim().toUpperCase(),
      minScore: Number(payload.minScore),
      maxScore: Number(payload.maxScore),
      points: String(payload.points),
      remark: payload.remark || null,
      isActive: payload.isActive !== false,
    })
    .returning();
  return row;
}

async function updateGradeScale(id, patch) {
  const clean = {};
  if (patch.grade !== undefined) clean.grade = String(patch.grade).trim().toUpperCase();
  if (patch.minScore !== undefined) clean.minScore = Number(patch.minScore);
  if (patch.maxScore !== undefined) clean.maxScore = Number(patch.maxScore);
  if (patch.points !== undefined) clean.points = String(patch.points);
  if (patch.remark !== undefined) clean.remark = patch.remark || null;
  if (patch.isActive !== undefined) clean.isActive = !!patch.isActive;
  const [row] = await db.update(gradeScales).set(clean).where(eq(gradeScales.id, Number(id))).returning();
  return row || null;
}

async function removeGradeScale(id) {
  const [row] = await db.delete(gradeScales).where(eq(gradeScales.id, Number(id))).returning({ id: gradeScales.id });
  return !!row;
}

async function remove(id) {
  const [row] = await db.delete(results).where(eq(results.id, Number(id))).returning();
  return row || null;
}

module.exports = {
  list,
  listWithCourse,
  listWithStudent,
  findById,
  upsert,
  update,
  submit,
  hodVerify,
  hodReject,
  adminApprove,
  adminReject,
  publish,
  publishBatch,
  listPendingForHod,
  listPendingAdmin,
  publishedForStudent,
  listGradeScales,
  findGradeScaleById,
  createGradeScale,
  updateGradeScale,
  removeGradeScale,
  remove,
};