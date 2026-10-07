// ============================================================
// FPU — Course registration queries
// Used by: routes/registrations, routes/portal/student
// ============================================================

'use strict';

const { db, schema, sql } = require('..');
const { eq, and, desc, asc } = require('drizzle-orm');

const { courseRegistrations, courses, users, academicSessions } = schema;

async function list({ studentId, courseId, sessionId, semester, status, limit = 500, offset = 0 } = {}) {
  const conds = [];
  if (studentId) conds.push(eq(courseRegistrations.studentId, Number(studentId)));
  if (courseId) conds.push(eq(courseRegistrations.courseId, Number(courseId)));
  if (sessionId) conds.push(eq(courseRegistrations.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(courseRegistrations.semester, semester));
  if (status) conds.push(eq(courseRegistrations.status, status));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select()
    .from(courseRegistrations)
    .where(where)
    .orderBy(desc(courseRegistrations.createdAt))
    .limit(Number(limit))
    .offset(Number(offset));
}

async function listWithCourse({ studentId, sessionId, semester, status } = {}) {
  const conds = [];
  if (studentId) conds.push(eq(courseRegistrations.studentId, Number(studentId)));
  if (sessionId) conds.push(eq(courseRegistrations.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(courseRegistrations.semester, semester));
  if (status) conds.push(eq(courseRegistrations.status, status));
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({ registration: courseRegistrations, course: courses })
    .from(courseRegistrations)
    .leftJoin(courses, eq(courseRegistrations.courseId, courses.id))
    .where(where)
    .orderBy(asc(courses.code));

  return rows.map((r) => ({
    id: r.registration.id,
    registration: r.registration,
    course: r.course,
  }));
}

async function listWithStudent({ courseId, sessionId, semester, status } = {}) {
  const conds = [];
  if (courseId) conds.push(eq(courseRegistrations.courseId, Number(courseId)));
  if (sessionId) conds.push(eq(courseRegistrations.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(courseRegistrations.semester, semester));
  if (status) conds.push(eq(courseRegistrations.status, status));
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({ registration: courseRegistrations, student: users, course: courses })
    .from(courseRegistrations)
    .leftJoin(users, eq(courseRegistrations.studentId, users.id))
    .leftJoin(courses, eq(courseRegistrations.courseId, courses.id))
    .where(where)
    .orderBy(asc(users.matricNumber));

  return rows.map((r) => ({
    id: r.registration.id,
    registration: r.registration,
    student: r.student,
    course: r.course,
  }));
}

async function countByStatus({ sessionId, semester } = {}) {
  const conds = [];
  if (sessionId) conds.push(eq(courseRegistrations.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(courseRegistrations.semester, semester));
  const where = conds.length ? and(...conds) : undefined;
  return db
    .select({ status: courseRegistrations.status, count: sql`count(*)::int` })
    .from(courseRegistrations)
    .where(where)
    .groupBy(courseRegistrations.status);
}

async function findById(id) {
  if (!id) return null;
  const [row] = await db.select().from(courseRegistrations).where(eq(courseRegistrations.id, Number(id))).limit(1);
  return row || null;
}

async function updateStatus(id, status, { approvedBy, rejectionReason } = {}) {
  const patch = { status };
  if (approvedBy) patch.approvedBy = Number(approvedBy);
  if (status === 'approved' || status === 'rejected') patch.approvedAt = new Date();
  if (rejectionReason !== undefined) patch.rejectionReason = rejectionReason;
  const [row] = await db.update(courseRegistrations).set(patch).where(eq(courseRegistrations.id, Number(id))).returning();
  return row || null;
}

async function remove(id) {
  const [row] = await db.delete(courseRegistrations).where(eq(courseRegistrations.id, Number(id))).returning();
  return row || null;
}

module.exports = {
  list,
  listWithCourse,
  listWithStudent,
  countByStatus,
  findById,
  updateStatus,
  remove,
};