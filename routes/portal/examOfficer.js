// ============================================================
// FPU — Exam Officer portal API
// Mounted at /api/exam-officer
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

// -------- Database & Schema --------
const { db, schema } = require('../../db');
const { eq, and, sql, desc, asc, inArray } = require('drizzle-orm');

// -------- Query Helpers --------
const userQueries    = require('../../db/queries/users');
const examQueries    = require('../../db/queries/exams');
const regQueries     = require('../../db/queries/registrations');
const paymentQueries = require('../../db/queries/payments');
const clearQueries   = require('../../db/queries/clearances');
const sessionQueries = require('../../db/queries/sessions');
const courseQueries  = require('../../db/queries/courses');

// -------- Middleware --------
const { requireRole } = require('../../middleware/auth');
const { logAudit }     = require('../../utils/audit');

// -------- Schema Tables --------
const {
  users,
  courses,
  results,
  departments,
  programmes,
  schools,
  examSchedules,
  academicSessions,
} = schema;

// -------- Auth --------
const only = requireRole(
  'exam_officer',
  'academic_officer',
  'registrar',
  'rector',
  'librarian',
  'admin'
);

// Resolve the approved student roster for an exam. Attendance must never be
// recorded for students outside the approved course/session/semester roster.
async function getApprovedExamRoster(examScheduleId) {
  const schedule = await examQueries.findById(examScheduleId);
  if (!schedule) return { error: 'Exam schedule not found.', status: 404 };
  if (!schedule.courseId || !schedule.sessionId || !schedule.semester) {
    return { error: 'The exam schedule is missing its course, session, or semester details.', status: 400 };
  }
  const registrations = await regQueries.listWithStudent({
    courseId: schedule.courseId,
    sessionId: schedule.sessionId,
    semester: schedule.semester,
    status: 'approved',
  });
  const studentIds = new Set(registrations.map((row) => Number(row.student?.id)).filter(Boolean));
  return { schedule, studentIds };
}

// ============================================================
// GET /api/exam-officer/lookups
// ============================================================
router.get('/lookups', only, async (req, res, next) => {
  try {
    const [depts, crs, progs, schs, sessions] = await Promise.all([
      db.select().from(departments).orderBy(asc(departments.name)),
      db.select().from(courses).orderBy(asc(courses.code)),
      db.select().from(programmes).orderBy(asc(programmes.code)),
      db.select().from(schools).orderBy(asc(schools.name)),
      db.select().from(academicSessions).orderBy(desc(academicSessions.startDate)),
    ]);
    return res.json({ success: true, departments: depts, courses: crs, programmes: progs, schools: schs, sessions });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/exam-officer/dashboard
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    const sessionId = req.query.sessionId || null;
    const schedules = await examQueries.listWithCourse({ sessionId });
    const upcoming = await examQueries.listUpcoming({ sessionId, limit: 100 });
    const attendanceTotals = await examQueries.countAttendanceAggregate({ sessionId });
    const coveredSchedules = await examQueries.countCoveredSchedules({ sessionId });

    let present = 0, absent = 0, late = 0, excused = 0;
    for (const t of attendanceTotals) {
      const c = Number(t.c || 0);
      if (t.status === 'present') present += c;
      else if (t.status === 'absent') absent += c;
      else if (t.status === 'late') late += c;
      else if (t.status === 'excused') excused += c;
    }

    return res.json({
      success: true,
      data: {
        totalSchedules: schedules.length,
        upcoming: upcoming.length,
        coveredSchedules,
        attendance: { present, absent, late, excused, total: present + absent + late + excused },
        currentSession: await sessionQueries.getCurrentAcademic(),
      },
    });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/exam-officer/schedules
// ============================================================
router.get('/schedules', only, async (req, res, next) => {
  try {
    const rows = await examQueries.listWithCourse(req.query);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/exam-officer/schedules/:id
// ============================================================
router.get('/schedules/:id', only, async (req, res, next) => {
  try {
    const row = await examQueries.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Exam schedule not found.' });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/exam-officer/registrations
// ============================================================
router.get('/registrations', only, async (req, res, next) => {
  try {
    const { courseId, sessionId, semester, status = 'approved' } = req.query;
    if (!courseId) {
      return res.status(400).json({ success: false, error: 'courseId is required.' });
    }
    const rows = await regQueries.listWithStudent({
      courseId,
      ...(sessionId ? { sessionId } : {}),
      ...(semester ? { semester } : {}),
      status,
    });
    return res.json({ success: true, data: rows.map(r => ({ student: r.student, registration: r.registration })) });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/exam-officer/attendance
// ============================================================
router.get('/attendance', only, async (req, res, next) => {
  try {
    const { examScheduleId } = req.query;
    if (!examScheduleId) return res.status(400).json({ success: false, error: 'examScheduleId is required.' });
    const rows = await examQueries.listAttendanceWithStudent({ examScheduleId });
    const counts = await examQueries.countAttendance({ examScheduleId });
    return res.json({ success: true, data: rows, counts });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/exam-officer/attendance
// ============================================================
router.post('/attendance', only, async (req, res, next) => {
  try {
    const { examScheduleId, studentId, status, remarks } = req.body || {};
    const allowedStatuses = new Set(['present', 'absent', 'late', 'excused']);
    if (!examScheduleId || !studentId || !status) {
      return res.status(400).json({ success: false, error: 'examScheduleId, studentId, status are required.' });
    }
    if (!Number.isInteger(Number(studentId)) || Number(studentId) <= 0 || !allowedStatuses.has(status)) {
      return res.status(400).json({ success: false, error: 'A valid student and attendance status are required.' });
    }
    const roster = await getApprovedExamRoster(examScheduleId);
    if (roster.error) return res.status(roster.status).json({ success: false, error: roster.error });
    if (!roster.studentIds.has(Number(studentId))) {
      return res.status(403).json({ success: false, error: 'This student is not on the approved registration list for this exam.' });
    }
    const row = await examQueries.upsertAttendance({
      examScheduleId, studentId, status, invigilatorId: req.user.id, remarks,
    });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/exam-officer/attendance/bulk
// ============================================================
router.post('/attendance/bulk', only, async (req, res, next) => {
  try {
    const { examScheduleId, records } = req.body || {};
    if (!examScheduleId || !Array.isArray(records) || !records.length) {
      return res.status(400).json({ success: false, error: 'examScheduleId and records[] are required.' });
    }
    const allowedStatuses = new Set(['present', 'absent', 'late', 'excused']);
    const studentIds = records.map((record) => Number(record && record.studentId));
    if (studentIds.some((id) => !Number.isInteger(id) || id <= 0) ||
        records.some((record) => !record || typeof record !== 'object' || !allowedStatuses.has(record.status)) ||
        new Set(studentIds).size !== studentIds.length) {
      return res.status(400).json({ success: false, error: 'Each attendance entry must contain a unique valid student and status.' });
    }
    const roster = await getApprovedExamRoster(examScheduleId);
    if (roster.error) return res.status(roster.status).json({ success: false, error: roster.error });
    const unregisteredIds = studentIds.filter((id) => !roster.studentIds.has(id));
    if (unregisteredIds.length) {
      return res.status(403).json({
        success: false,
        error: 'Attendance was not saved because one or more students are not approved for this exam.',
        rejectedStudentIds: unregisteredIds,
      });
    }
    const rows = records.map(r => ({
      examScheduleId: Number(examScheduleId),
      studentId: Number(r.studentId),
      status: r.status,
      invigilatorId: req.user.id,
      remarks: r.remarks || null,
    }));
    const saved = await examQueries.bulkUpsertAttendance(rows);
    return res.json({ success: true, data: saved, saved: saved.length });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/exam-officer/eligibility
// ============================================================
router.get('/eligibility', only, async (req, res, next) => {
  try {
    const { sessionId, courseId, semester } = req.query;
    if (!courseId) return res.status(400).json({ success: false, error: 'courseId is required.' });

    let effectiveSession = Number(sessionId || req.user.currentSessionId) || null;
    if (!effectiveSession) {
      const current = await sessionQueries.getCurrentAcademic();
      effectiveSession = current ? current.id : null;
    }

    const regs = await regQueries.listWithStudent({
      courseId,
      ...(effectiveSession ? { sessionId: effectiveSession } : {}),
      ...(semester ? { semester } : {}),
      status: 'active',
    });

    const resultsList = [];
    for (const r of regs) {
      const studentId = r.registration.studentId;
      const totalPaid = effectiveSession ? await paymentQueries.totalVerifiedForStudent(studentId, effectiveSession) : 0;
      const feeStructure = r.student?.programmeId
        ? await paymentQueries.findFeeStructureWithFallback({
            programmeId: r.student.programmeId, level: r.student.level || 'ND', sessionId: effectiveSession,
          })
        : null;
      const feeStructureFound = Boolean(feeStructure);
      const totalDue = Number(feeStructure?.total || 0);
      const cleared = feeStructureFound && Number(totalPaid) >= totalDue;
      const clear = effectiveSession ? await clearQueries.findOne({ studentId, sessionId: effectiveSession }) : null;
      const clearanceOk = !clear || clear.status === 'cleared';
      const reasons = [];
      if (!feeStructureFound) reasons.push('Fee structure is not configured for this programme, level and session. Manual review required.');
      else if (!cleared) reasons.push('Verified fee payments are below the configured fee total.');
      if (clear && clear.status !== 'cleared') reasons.push(clear.status === 'rejected' ? 'Clearance was rejected.' : 'Clearance is pending.');
      if (!clear) reasons.push('No separate clearance record is recorded for this session; fee verification remains required.');
      const eligible = feeStructureFound && cleared && clearanceOk;

      resultsList.push({
        student: r.student, registration: r.registration,
        totalPaid: Number(totalPaid), totalDue, feeStructureFound,
        clearanceStatus: clear?.status || 'not_required_or_not_recorded',
        cleared, clearanceOk, eligible, reasons,
      });
    }

    const eligible = resultsList.filter(r => r.eligible).length;
    return res.json({
      success: true,
      data: resultsList,
      summary: { total: resultsList.length, eligible, ineligible: resultsList.length - eligible },
    });
  } catch (err) {
    console.error('[exam-officer/eligibility]', err);
    return next(err);
  }
});

// ============================================================
// GET /api/exam-officer/reports
// ============================================================
router.get('/reports', only, async (req, res, next) => {
  try {
    const sessionId = req.query.sessionId || null;
    const schedules = await examQueries.listWithCourse({ sessionId });
    const attendanceTotals = await examQueries.countAttendanceAggregate({ sessionId });
    const coveredSchedules = await examQueries.countCoveredSchedules({ sessionId });
    const scheduleIds = schedules.map((row) => Number((row.exam || row).id)).filter(Boolean);
    let attendanceBySchedule = [];
    if (scheduleIds.length) {
      const grouped = await db.select({
        examScheduleId: schema.examAttendance.examScheduleId,
        status: schema.examAttendance.status,
        count: sql`count(*)::int`,
      }).from(schema.examAttendance)
        .where(inArray(schema.examAttendance.examScheduleId, scheduleIds))
        .groupBy(schema.examAttendance.examScheduleId, schema.examAttendance.status);
      const byId = new Map();
      grouped.forEach((row) => {
        const id = Number(row.examScheduleId);
        if (!byId.has(id)) byId.set(id, { marked: 0, present: 0, absent: 0, late: 0, excused: 0 });
        const item = byId.get(id), status = String(row.status || '').toLowerCase(), count = Number(row.count || 0);
        item.marked += count;
        if (Object.prototype.hasOwnProperty.call(item, status)) item[status] += count;
      });
      const registrationCounts = await db.select({
        examScheduleId: schema.examSchedules.id,
        registered: sql`count(${schema.courseRegistrations.id})::int`,
      }).from(schema.examSchedules)
        .leftJoin(schema.courseRegistrations, and(
          eq(schema.courseRegistrations.courseId, schema.examSchedules.courseId),
          eq(schema.courseRegistrations.sessionId, schema.examSchedules.sessionId),
          eq(schema.courseRegistrations.semester, schema.examSchedules.semester),
          eq(schema.courseRegistrations.status, 'approved')
        ))
        .where(inArray(schema.examSchedules.id, scheduleIds))
        .groupBy(schema.examSchedules.id);
      const regMap = new Map(registrationCounts.map((row) => [Number(row.examScheduleId), Number(row.registered || 0)]));
      const departmentRows = await db.select({ id: departments.id, name: departments.name }).from(departments);
      const departmentMap = new Map(departmentRows.map((row) => [Number(row.id), row.name]));
      attendanceBySchedule = schedules.map((row) => {
        const exam = row.exam || row, course = row.course || {};
        const counts = byId.get(Number(exam.id)) || { marked: 0, present: 0, absent: 0, late: 0, excused: 0 };
        return {
          examScheduleId: exam.id, examDate: exam.examDate, venue: exam.venue,
          courseCode: course.code, courseTitle: course.title,
          departmentName: departmentMap.get(Number(course.departmentId)) || '—',
          registered: regMap.get(Number(exam.id)) || 0,
          ...counts,
        };
      });
    }
    return res.json({
      success: true,
      data: { schedules, attendanceTotals, coveredSchedules, attendanceBySchedule },
    });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/exam-officer/profile
// ============================================================
router.get('/profile', only, async (req, res, next) => {
  try { return res.json({ success: true, data: await userQueries.findByIdWithRelations(req.user.id) }); }
  catch (err) { return next(err); }
});

// ============================================================
// GET /api/exam-officer/security
// ============================================================
router.get('/security', only, async (req, res, next) => {
  try {
    const sessions = await sessionQueries.listUserSessions(req.user.id);
    const logins = await require('../../db/queries/audit').listLogins({ userId: req.user.id, limit: 30 });
    return res.json({ success: true, sessions, logins });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/exam-officer/pending-publication
// ============================================================
router.get('/pending-publication', only, async (req, res, next) => {
  try {
    const rows = await db.select({
      id: results.id,
      studentName: sql`${users.firstName} || ' ' || ${users.lastName}`,
      matricNumber: users.matricNumber,
      courseCode: courses.code,
      courseTitle: courses.title,
      score: results.score,
      grade: results.grade,
      level: courses.level,
      departmentName: departments.name,
      programmeName: programmes.name,
    })
    .from(results)
    .innerJoin(users, eq(results.studentId, users.id))
    .innerJoin(courses, eq(results.courseId, courses.id))
    .innerJoin(programmes, eq(users.programmeId, programmes.id))
    .leftJoin(departments, eq(courses.departmentId, departments.id))
    .where(eq(results.status, 'hod_verified'))
    .orderBy(departments.name, programmes.name, users.lastName);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[exam-officer/pending] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/exam-officer/publish
// ============================================================
router.post('/publish', only, async (req, res, next) => {
  try {
    const { resultIds } = req.body || {};
    if (!Array.isArray(resultIds) || resultIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Select at least one result to publish.' });
    }
    const ids = resultIds.map(Number);
    if (ids.some((id) => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
      return res.status(400).json({ success: false, error: 'Result IDs must be unique valid numbers.' });
    }

    // Only results verified by the HOD and still awaiting publication may
    // transition to published. The update condition also protects against
    // stale requests if another officer publishes a result at the same time.
    const updated = await db.update(results)
      .set({ status: 'published', publishedAt: new Date() })
      .where(and(eq(results.status, 'hod_verified'), inArray(results.id, ids)))
      .returning({ id: results.id });

    if (updated.length !== ids.length) {
      return res.status(409).json({
        success: false,
        error: 'Some selected results are no longer awaiting publication. Refresh the list and review the remaining pending results.',
        publishedCount: updated.length,
      });
    }

    await logAudit({
      req,
      action: 'exam_officer.publish_results',
      after: { count: updated.length, resultIds: updated.map((row) => row.id) },
    });

    return res.json({ success: true, message: `${updated.length} results published successfully.`, publishedCount: updated.length });
  } catch (err) {
    console.error('[exam-officer/publish] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/exam-officer/published-results
// ============================================================
router.get('/published-results', only, async (req, res, next) => {
  try {
    const rows = await db.select({
      id: results.id,
      studentName: sql`${users.firstName} || ' ' || ${users.lastName}`,
      matricNumber: users.matricNumber,
      programmeName: programmes.name,
      courseCode: courses.code,
      courseTitle: courses.title,
      courseUnit: courses.unit,
      level: courses.level,
      score: results.score,
      grade: results.grade,
      points: results.points,
      semester: results.semester,
      sessionName: academicSessions.name,
      publishedAt: sql`coalesce(${results.publishedAt}, ${results.updatedAt}, ${results.createdAt})`,
      createdAt: results.createdAt,
      updatedAt: results.updatedAt,
      departmentName: departments.name,
    })
    .from(results)
    .innerJoin(users, eq(results.studentId, users.id))
    .innerJoin(courses, eq(results.courseId, courses.id))
    .leftJoin(programmes, eq(users.programmeId, programmes.id))
    .leftJoin(academicSessions, eq(results.sessionId, academicSessions.id))
    .leftJoin(departments, eq(courses.departmentId, departments.id))
    .where(eq(results.status, 'published'))
    .orderBy(desc(results.publishedAt));

    // Group by Department
    const grouped = {};
    rows.forEach(r => {
      const dept = r.departmentName || 'Unassigned Department';
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push(r);
    });

    return res.json({ success: true, data: rows, grouped });
  } catch (err) {
    console.error('[exam-officer/published-results] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;