// ============================================================
// FPU — Exam queries
// Used by: routes/exams, routes/portal/*, routes/reports
// ============================================================

'use strict';

const { db, schema, sql } = require('..');
const { eq, and, or, asc, desc, inArray } = require('drizzle-orm');
const { examSchedules, courses, sessions, users, departments, programmes } = schema;

// ------------------------------------------------------------
// SAFE SELECT — joins course info
// ------------------------------------------------------------
const EXAM_WITH_COURSE = {
  exam: examSchedules,
  course: courses,
};

// ------------------------------------------------------------
// List all exams with their course info
// Supports: sessionId, semester, courseId, departmentId filters
// ------------------------------------------------------------
async function listWithCourse({ sessionId, semester, courseId, departmentId } = {}) {
  const conds = [];

  if (sessionId) conds.push(eq(examSchedules.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(examSchedules.semester, semester));
  if (courseId) conds.push(eq(examSchedules.courseId, Number(courseId)));

  // ⬇ Department scoping — filter by the course's department.
  //   HODs are auto-scoped to their own department by middleware.
  if (departmentId) conds.push(eq(courses.departmentId, Number(departmentId)));

  const where = conds.length ? and(...conds) : undefined;

  return db
    .select(EXAM_WITH_COURSE)
    .from(examSchedules)
    .leftJoin(courses, eq(examSchedules.courseId, courses.id))
    .where(where)
    .orderBy(asc(examSchedules.examDate), asc(examSchedules.startTime));
}

// ------------------------------------------------------------
// List exams (without course join) — raw rows
// ------------------------------------------------------------
async function list({ sessionId, semester, courseId } = {}) {
  const conds = [];
  if (sessionId) conds.push(eq(examSchedules.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(examSchedules.semester, semester));
  if (courseId) conds.push(eq(examSchedules.courseId, Number(courseId)));

  const where = conds.length ? and(...conds) : undefined;

  return db
    .select()
    .from(examSchedules)
    .where(where)
    .orderBy(asc(examSchedules.examDate), asc(examSchedules.startTime));
}

// ------------------------------------------------------------
// Find by ID with course info
// ------------------------------------------------------------
async function findById(id) {
  if (!id) return null;
  const [row] = await db
    .select(EXAM_WITH_COURSE)
    .from(examSchedules)
    .leftJoin(courses, eq(examSchedules.courseId, courses.id))
    .where(eq(examSchedules.id, Number(id)))
    .limit(1);
  return row || null;
}

// ------------------------------------------------------------
// Create
// ------------------------------------------------------------
async function create(payload) {
  const [row] = await db
    .insert(examSchedules)
    .values({
      courseId: Number(payload.courseId),
      sessionId: Number(payload.sessionId),
      semester: payload.semester,
      examDate: payload.examDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      venue: payload.venue || null,
    })
    .returning();
  return row;
}

// ------------------------------------------------------------
// Update
// ------------------------------------------------------------
async function update(id, patch) {
  const allowed = ['courseId', 'sessionId', 'semester', 'examDate', 'startTime', 'endTime', 'venue'];
  const clean = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) {
      if (k === 'courseId' || k === 'sessionId') {
        clean[k] = patch[k] ? Number(patch[k]) : null;
      } else {
        clean[k] = patch[k];
      }
    }
  }
  clean.updatedAt = new Date();

  const [row] = await db
    .update(examSchedules)
    .set(clean)
    .where(eq(examSchedules.id, Number(id)))
    .returning();
  return row || null;
}

// ------------------------------------------------------------
// Delete
// ------------------------------------------------------------
async function remove(id) {
  const [row] = await db
    .delete(examSchedules)
    .where(eq(examSchedules.id, Number(id)))
    .returning();
  return row || null;
}

// ------------------------------------------------------------
// Count (with optional department scoping)
// ------------------------------------------------------------
async function count({ sessionId, semester, courseId, departmentId } = {}) {
  const conds = [];
  if (sessionId) conds.push(eq(examSchedules.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(examSchedules.semester, semester));
  if (courseId) conds.push(eq(examSchedules.courseId, Number(courseId)));

  if (departmentId) {
    const rows = await db
      .select({ id: examSchedules.id })
      .from(examSchedules)
      .leftJoin(courses, eq(examSchedules.courseId, courses.id))
      .where(and(...conds, eq(courses.departmentId, Number(departmentId))));
    return rows.length;
  }

  const where = conds.length ? and(...conds) : undefined;
  const rows = await db.select({ id: examSchedules.id }).from(examSchedules).where(where);
  return rows.length;
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  listWithCourse,
  list,
  findById,
  create,
  update,
  remove,
  count,
};