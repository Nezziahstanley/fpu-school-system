// ============================================================
// FPU — Exam schedules + exam attendance queries
// Used by: routes/exams, routes/portal/examOfficer,
//          routes/portal/student, routes/portal/adminLookups
// ============================================================

'use strict';

const { db, schema, sql } = require('..');
const { eq, and, asc, desc, inArray } = require('drizzle-orm');

const {
  examSchedules,
  examAttendance,
  courses,
  users,
  academicSessions,
} = schema;

// ============================================================
// EXAM SCHEDULES
// ============================================================

// ------------------------------------------------------------
// listWithCourse
// Returns each schedule joined to its course.
// Filters: sessionId, semester, courseId
// ------------------------------------------------------------
async function listWithCourse({ sessionId, semester, courseId } = {}) {
  const conds = [];
  if (sessionId) conds.push(eq(examSchedules.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(examSchedules.semester, semester));
  if (courseId) conds.push(eq(examSchedules.courseId, Number(courseId)));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({ exam: examSchedules, course: courses })
    .from(examSchedules)
    .leftJoin(courses, eq(examSchedules.courseId, courses.id))
    .where(where)
    .orderBy(asc(examSchedules.examDate), asc(examSchedules.startTime));
}

// ------------------------------------------------------------
// findById
// ------------------------------------------------------------
async function findById(id) {
  if (!id) return null;
  const [row] = await db
    .select()
    .from(examSchedules)
    .where(eq(examSchedules.id, Number(id)))
    .limit(1);
  return row || null;
}

// ------------------------------------------------------------
// findByIdWithRelations
// ------------------------------------------------------------
async function findByIdWithRelations(id) {
  if (!id) return null;
  const [row] = await db
    .select({
      exam: examSchedules,
      course: courses,
      session: academicSessions,
    })
    .from(examSchedules)
    .leftJoin(courses, eq(examSchedules.courseId, courses.id))
    .leftJoin(academicSessions, eq(examSchedules.sessionId, academicSessions.id))
    .where(eq(examSchedules.id, Number(id)))
    .limit(1);
  if (!row) return null;
  return {
    ...row.exam,
    course: row.course || null,
    session: row.session || null,
  };
}

// ------------------------------------------------------------
// create
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
      invigilators: payload.invigilators || null,
    })
    .returning();
  return row;
}

// ------------------------------------------------------------
// update — whitelisted fields only
// ------------------------------------------------------------
async function update(id, patch) {
  const allowed = [
    'examDate',
    'startTime',
    'endTime',
    'venue',
    'invigilators',
    'semester',
  ];
  const clean = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) clean[k] = patch[k];
  }

  const [row] = await db
    .update(examSchedules)
    .set(clean)
    .where(eq(examSchedules.id, Number(id)))
    .returning();
  return row || null;
}

// ------------------------------------------------------------
// remove
// ------------------------------------------------------------
async function remove(id) {
  const [row] = await db
    .delete(examSchedules)
    .where(eq(examSchedules.id, Number(id)))
    .returning();
  return row || null;
}

// ------------------------------------------------------------
// findConflicts
// Checks whether a proposed exam overlaps with an existing
// one for the same session + semester + date + time-range.
// Returns the list of conflicting rows.
// ------------------------------------------------------------
async function findConflicts({
  sessionId,
  semester,
  examDate,
  startTime,
  endTime,
  excludeId = null,
}) {
  if (!sessionId || !semester || !examDate || !startTime || !endTime) return [];

  const conds = [
    eq(examSchedules.sessionId, Number(sessionId)),
    eq(examSchedules.semester, semester),
    eq(examSchedules.examDate, examDate),
    sql`${examSchedules.startTime} < ${endTime} AND ${examSchedules.endTime} > ${startTime}`,
  ];
  if (excludeId) {
    conds.push(sql`${examSchedules.id} <> ${Number(excludeId)}`);
  }

  return db
    .select()
    .from(examSchedules)
    .where(and(...conds));
}

// ============================================================
// EXAM ATTENDANCE
// ============================================================

// ------------------------------------------------------------
// listAttendance
// Raw rows for one exam schedule.
// ------------------------------------------------------------
async function listAttendance({ examScheduleId } = {}) {
  if (!examScheduleId) return [];
  return db
    .select()
    .from(examAttendance)
    .where(eq(examAttendance.examScheduleId, Number(examScheduleId)))
    .orderBy(asc(examAttendance.id));
}

// ------------------------------------------------------------
// listAttendanceWithStudent
// Joins student user record.
// ------------------------------------------------------------
async function listAttendanceWithStudent({ examScheduleId } = {}) {
  if (!examScheduleId) return [];
  return db
    .select({
      record: examAttendance,
      student: users,
    })
    .from(examAttendance)
    .leftJoin(users, eq(examAttendance.studentId, users.id))
    .where(eq(examAttendance.examScheduleId, Number(examScheduleId)))
    .orderBy(asc(users.matricNumber));
}

// ------------------------------------------------------------
// upsertAttendance
// Insert or update a single row. Unique key is
// (exam_schedule_id, student_id).
// ------------------------------------------------------------
async function upsertAttendance({
  examScheduleId,
  studentId,
  status,
  invigilatorId,
  remarks,
}) {
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
// bulkUpsertAttendance
// Accepts an array of { examScheduleId, studentId, status,
// invigilatorId, remarks }.
// ------------------------------------------------------------
async function bulkUpsertAttendance(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const values = rows.map((r) => ({
    examScheduleId: Number(r.examScheduleId),
    studentId: Number(r.studentId),
    status: r.status || 'present',
    invigilatorId: r.invigilatorId ? Number(r.invigilatorId) : null,
    remarks: r.remarks || null,
  }));

  return db
    .insert(examAttendance)
    .values(values)
    .onConflictDoUpdate({
      target: [examAttendance.examScheduleId, examAttendance.studentId],
      set: {
        status: sql`EXCLUDED.status`,
        invigilatorId: sql`EXCLUDED.invigilator_id`,
        remarks: sql`EXCLUDED.remarks`,
      },
    })
    .returning();
}

// ------------------------------------------------------------
// countAttendance
// Grouped counts by status for one exam schedule.
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
// removeAttendance
// ------------------------------------------------------------
async function removeAttendance(id) {
  const [row] = await db
    .delete(examAttendance)
    .where(eq(examAttendance.id, Number(id)))
    .returning();
  return row || null;
}

// ------------------------------------------------------------
// listForProgramme
// Used by the student portal — pull every exam that belongs
// to courses offered by a given programme.
// ------------------------------------------------------------
async function listForProgramme({ programmeId, sessionId, semester } = {}) {
  if (!programmeId) return [];

  const conds = [eq(courses.programmeId, Number(programmeId))];
  if (sessionId) conds.push(eq(examSchedules.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(examSchedules.semester, semester));

  return db
    .select({ exam: examSchedules, course: courses })
    .from(examSchedules)
    .leftJoin(courses, eq(examSchedules.courseId, courses.id))
    .where(and(...conds))
    .orderBy(asc(examSchedules.examDate), asc(examSchedules.startTime));
}

// ------------------------------------------------------------
// findByCourseIds
// Used by the exam officer to bulk-load schedules.
// ------------------------------------------------------------
async function findByCourseIds(courseIds = [], { sessionId, semester } = {}) {
  if (!Array.isArray(courseIds) || courseIds.length === 0) return [];

  const conds = [inArray(examSchedules.courseId, courseIds.map(Number))];
  if (sessionId) conds.push(eq(examSchedules.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(examSchedules.semester, semester));

  return db
    .select()
    .from(examSchedules)
    .where(and(...conds))
    .orderBy(asc(examSchedules.examDate), asc(examSchedules.startTime));
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  // schedules
  listWithCourse,
  findById,
  findByIdWithRelations,
  create,
  update,
  remove,
  findConflicts,
  listForProgramme,
  findByCourseIds,

  // attendance
  listAttendance,
  listAttendanceWithStudent,
  upsertAttendance,
  bulkUpsertAttendance,
  countAttendance,
  removeAttendance,
};