// ============================================================
// FPU — Query helper: attendance (class attendance)
// ============================================================

'use strict';

const { db, sql, schema } = require('../index');
const { eq, and, desc, asc, gte, lte, inArray } = require('drizzle-orm');

const { attendance, courses, users, academicSessions } = schema;

async function findById(id) {
  if (!id) return null;
  const [row] = await db.select().from(attendance).where(eq(attendance.id, Number(id))).limit(1);
  return row || null;
}

async function list({ courseId, studentId, sessionId, semester, date, from, to, status } = {}) {
  const conds = [];
  if (courseId) conds.push(eq(attendance.courseId, Number(courseId)));
  if (studentId) conds.push(eq(attendance.studentId, Number(studentId)));
  if (sessionId) conds.push(eq(attendance.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(attendance.semester, semester));
  if (date) conds.push(eq(attendance.date, date));
  if (from) conds.push(gte(attendance.date, from));
  if (to) conds.push(lte(attendance.date, to));
  if (status) conds.push(eq(attendance.status, status));
  const where = conds.length ? and(...conds) : undefined;
  return db.select().from(attendance).where(where).orderBy(desc(attendance.date));
}

async function listWithStudent({ courseId, date, sessionId, semester } = {}) {
  const conds = [];
  if (courseId) conds.push(eq(attendance.courseId, Number(courseId)));
  if (date) conds.push(eq(attendance.date, date));
  if (sessionId) conds.push(eq(attendance.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(attendance.semester, semester));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({
      record: attendance,
      student: users,
    })
    .from(attendance)
    .leftJoin(users, eq(attendance.studentId, users.id))
    .where(where)
    .orderBy(asc(users.matricNumber));
}

async function upsert(data) {
  const [row] = await db
    .insert(attendance)
    .values({
      courseId: Number(data.courseId),
      studentId: Number(data.studentId),
      lecturerId: data.lecturerId ? Number(data.lecturerId) : null,
      sessionId: Number(data.sessionId),
      semester: data.semester,
      date: data.date,
      status: data.status || 'present',
      remarks: data.remarks || null,
    })
    .onConflictDoUpdate({
      target: [attendance.courseId, attendance.studentId, attendance.date],
      set: {
        status: data.status || 'present',
        remarks: data.remarks || null,
        lecturerId: data.lecturerId ? Number(data.lecturerId) : null,
      },
    })
    .returning();
  return row;
}

async function bulkUpsert(rows) {
  if (!rows.length) return [];
  return db
    .insert(attendance)
    .values(rows)
    .onConflictDoUpdate({
      target: [attendance.courseId, attendance.studentId, attendance.date],
      set: {
        status: sql`EXCLUDED.status`,
        remarks: sql`EXCLUDED.remarks`,
      },
    })
    .returning();
}

async function remove(id) {
  const [row] = await db.delete(attendance).where(eq(attendance.id, Number(id))).returning();
  return row || null;
}

async function studentSummary({ studentId, courseId, sessionId, semester }) {
  const conds = [eq(attendance.studentId, Number(studentId))];
  if (courseId) conds.push(eq(attendance.courseId, Number(courseId)));
  if (sessionId) conds.push(eq(attendance.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(attendance.semester, semester));

  const rows = await db
    .select({
      total: sql`count(*)::int`,
      present: sql`sum(case when ${attendance.status} = 'present' then 1 else 0 end)::int`,
      absent: sql`sum(case when ${attendance.status} = 'absent' then 1 else 0 end)::int`,
      late: sql`sum(case when ${attendance.status} = 'late' then 1 else 0 end)::int`,
      excused: sql`sum(case when ${attendance.status} = 'excused' then 1 else 0 end)::int`,
    })
    .from(attendance)
    .where(and(...conds));

  return rows[0] || { total: 0, present: 0, absent: 0, late: 0, excused: 0 };
}

async function courseSummary({ courseId, sessionId, semester }) {
  const conds = [eq(attendance.courseId, Number(courseId))];
  if (sessionId) conds.push(eq(attendance.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(attendance.semester, semester));

  const rows = await db
    .select({ status: attendance.status, c: sql`count(*)::int` })
    .from(attendance)
    .where(and(...conds))
    .groupBy(attendance.status);
  return rows;
}

module.exports = {
  findById,
  list,
  listWithStudent,
  upsert,
  bulkUpsert,
  remove,
  studentSummary,
  courseSummary,
};