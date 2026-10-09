// ============================================================
// FPU — Query helper: exams (schedules + attendance)
// ============================================================

'use strict';

const { db, sql, schema } = require('../index');
const { eq, and, or, inArray, asc, desc, isNull } = require('drizzle-orm');

const {
  examSchedules, examAttendance, courses, users, academicSessions,
} = schema;

// ============================================================
// SELECT MAPS
// ============================================================

// Exam schedule + joined course info
const EXAM_WITH_COURSE = {
  exam: examSchedules,
  course: courses,
};

// Exam schedule (flat) with course code/title
const EXAM_FLAT = {
  id: examSchedules.id,
  courseId: examSchedules.courseId,
  sessionId: examSchedules.sessionId,
  semester: examSchedules.semester,
  examDate: examSchedules.examDate,
  startTime: examSchedules.startTime,
  endTime: examSchedules.endTime,
  venue: examSchedules.venue,
  invigilators: examSchedules.invigilators,
  createdAt: examSchedules.createdAt,
  courseCode: courses.code,
  courseTitle: courses.title,
  courseUnit: courses.unit,
};

// Exam attendance + joined student info
const ATT_WITH_STUDENT = {
  record: examAttendance,
  student: users,
};

// ============================================================
// LIST
// ============================================================

// ------------------------------------------------------------
// listWithCourse — schedules joined with course (nested shape)
// ------------------------------------------------------------
async function listWithCourse({ sessionId, semester, courseId, departmentId } = {}) {
  const conds = [];

  if (sessionId) conds.push(eq(examSchedules.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(examSchedules.semester, semester));
  if (courseId) conds.push(eq(examSchedules.courseId, Number(courseId)));
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
// list — schedules joined with course (flat shape)
// ------------------------------------------------------------
async function list({ sessionId, semester, courseId } = {}) {
  const conds = [];
  if (sessionId) conds.push(eq(examSchedules.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(examSchedules.semester, semester));
  if (courseId) conds.push(eq(examSchedules.courseId, Number(courseId)));

  const where = conds.length ? and(...conds) : undefined;

  return db
    .select(EXAM_FLAT)
    .from(examSchedules)
    .leftJoin(courses, eq(examSchedules.courseId, courses.id))
    .where(where)
    .orderBy(asc(examSchedules.examDate), asc(examSchedules.startTime));
}

// ------------------------------------------------------------
// findById — single exam schedule with course
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
// listUpcoming — schedules with exam_date >= today, sorted
// ------------------------------------------------------------
async function listUpcoming({ sessionId, limit = 10 } = {}) {
  const conds = [sql`${examSchedules.examDate} >= CURRENT_DATE`];
  if (sessionId) conds.push(eq(examSchedules.sessionId, Number(sessionId)));
  const where = and(...conds);

  return db
    .select(EXAM_WITH_COURSE)
    .from(examSchedules)
    .leftJoin(courses, eq(examSchedules.courseId, courses.id))
    .where(where)
    .orderBy(asc(examSchedules.examDate), asc(examSchedules.startTime))
    .limit(Number(limit));
}

// ------------------------------------------------------------
// listForStudent — exams for courses the student is registered for
// ------------------------------------------------------------
async function listForStudent({ programmeId, sessionId, semester } = {}) {
  const conds = [];
  if (programmeId) conds.push(eq(courses.programmeId, Number(programmeId)));
  if (sessionId) conds.push(eq(examSchedules.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(examSchedules.semester, semester));

  const where = conds.length ? and(...conds) : undefined;

  return db
    .select(EXAM_WITH_COURSE)
    .from(examSchedules)
    .leftJoin(courses, eq(examSchedules.courseId, courses.id))
    .where(where)
    .orderBy(asc(examSchedules.examDate), asc(examSchedules.startTime));
}

// ============================================================
// SCHEDULE WRITES
// ============================================================

async function create(data) {
  const [row] = await db
    .insert(examSchedules)
    .values({
      courseId: Number(data.courseId),
      sessionId: Number(data.sessionId),
      semester: data.semester || 'first',
      examDate: data.examDate,
      startTime: data.startTime,
      endTime: data.endTime,
      venue: data.venue || null,
      invigilators: data.invigilators || null,
    })
    .returning();
  return row;
}

async function update(id, data) {
  const allowed = ['courseId', 'sessionId', 'semester', 'examDate', 'startTime', 'endTime', 'venue', 'invigilators'];
  const clean = {};
  for (const k of allowed) {
    if (data[k] !== undefined) clean[k] = data[k];
  }
  const [row] = await db
    .update(examSchedules)
    .set(clean)
    .where(eq(examSchedules.id, Number(id)))
    .returning();
  return row || null;
}

async function remove(id) {
  const [row] = await db
    .delete(examSchedules)
    .where(eq(examSchedules.id, Number(id)))
    .returning();
  return row || null;
}

// ============================================================
// ATTENDANCE
// ============================================================

// ------------------------------------------------------------
// listAttendanceWithStudent — attendance + student per schedule
// ------------------------------------------------------------
async function listAttendanceWithStudent({ examScheduleId } = {}) {
  if (!examScheduleId) return [];
  return db
    .select(ATT_WITH_STUDENT)
    .from(examAttendance)
    .leftJoin(users, eq(examAttendance.studentId, users.id))
    .where(eq(examAttendance.examScheduleId, Number(examScheduleId)))
    .orderBy(asc(users.lastName), asc(users.firstName));
}

// ------------------------------------------------------------
// countAttendance — grouped totals for one schedule
// ------------------------------------------------------------
async function countAttendance({ examScheduleId } = {}) {
  if (!examScheduleId) return [];
  return db
    .select({
      status: examAttendance.status,
      c: sql`count(*)::int`,
    })
    .from(examAttendance)
    .where(eq(examAttendance.examScheduleId, Number(examScheduleId)))
    .groupBy(examAttendance.status);
}

// ------------------------------------------------------------
// countAttendanceAggregate — one query, totals across all schedules
// ------------------------------------------------------------
async function countAttendanceAggregate({ sessionId } = {}) {
  const conds = [];
  if (sessionId) conds.push(eq(examSchedules.sessionId, Number(sessionId)));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({
      status: examAttendance.status,
      c: sql`count(*)::int`,
    })
    .from(examAttendance)
    .leftJoin(examSchedules, eq(examAttendance.examScheduleId, examSchedules.id))
    .where(where)
    .groupBy(examAttendance.status);
}

// ------------------------------------------------------------
// countCoveredSchedules — how many schedules have any attendance
// ------------------------------------------------------------
async function countCoveredSchedules({ sessionId } = {}) {
  const conds = [];
  if (sessionId) conds.push(eq(examSchedules.sessionId, Number(sessionId)));
  const where = conds.length ? and(...conds) : undefined;

  const [row] = await db
    .select({ c: sql`count(distinct ${examAttendance.examScheduleId})::int` })
    .from(examAttendance)
    .leftJoin(examSchedules, eq(examAttendance.examScheduleId, examSchedules.id))
    .where(where);

  return row?.c || 0;
}

// ------------------------------------------------------------
// upsertAttendance — insert or update a single attendance record
// ------------------------------------------------------------
async function upsertAttendance({ examScheduleId, studentId, status, invigilatorId, remarks } = {}) {
  const [row] = await db
    .insert(examAttendance)
    .values({
      examScheduleId: Number(examScheduleId),
      studentId: Number(studentId),
      status: status || 'present',
      invigilatorId: invigilatorId ? Number(invigilatorId) : null,
      remarks: remarks || null,
    })
    .onConflictDoUpdate({
      target: [examAttendance.examScheduleId, examAttendance.studentId],
      set: {
        status: status || 'present',
        invigilatorId: invigilatorId ? Number(invigilatorId) : null,
        remarks: remarks || null,
      },
    })
    .returning();
  return row;
}

// ------------------------------------------------------------
// bulkUpsertAttendance — insert/update many at once
// ------------------------------------------------------------
async function bulkUpsertAttendance(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const values = rows.map((r) => ({
    examScheduleId: Number(r.examScheduleId),
    studentId: Number(r.studentId),
    status: r.status || 'present',
    invigilatorId: r.invigilatorId ? Number(r.invigilatorId) : null,
    remarks: r.remarks || null,
  }));

  // Drizzle doesn't support multi-row upsert directly — do it in a loop
  const results = [];
  for (const v of values) {
    const row = await upsertAttendance(v);
    results.push(row);
  }
  return results;
}

// ------------------------------------------------------------
// removeAttendance — delete a single record
// ------------------------------------------------------------
async function removeAttendance(id) {
  const [row] = await db
    .delete(examAttendance)
    .where(eq(examAttendance.id, Number(id)))
    .returning();
  return row || null;
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  // schedules
  list,
  listWithCourse,
  listUpcoming,
  listForStudent,
  findById,
  create,
  update,
  remove,

  // attendance
  listAttendanceWithStudent,
  countAttendance,
  countAttendanceAggregate,
  countCoveredSchedules,
  upsertAttendance,
  bulkUpsertAttendance,
  removeAttendance,
};