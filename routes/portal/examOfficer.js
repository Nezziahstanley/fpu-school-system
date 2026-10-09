// ============================================================
// FPU — Exam Officer portal API
// Mounted at /api/exam-officer
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries = require('../../db/queries/users');
const examQueries = require('../../db/queries/exams');
const regQueries = require('../../db/queries/registrations');
const paymentQueries = require('../../db/queries/payments');
const clearQueries = require('../../db/queries/clearances');
const sessionQueries = require('../../db/queries/sessions');
const { requireRole } = require('../../middleware/auth');

// Academic roles that share the exam officer portal endpoints
const only = requireRole(
  'exam_officer',
  'academic_officer',
  'registrar',
  'rector',
  'librarian',
  'admin'
);

// ============================================================
// GET /api/exam-officer/lookups
// ------------------------------------------------------------
// Cascading pickers need: departments, courses, programmes,
// schools. All in one call, available to all academic roles.
// ============================================================
router.get('/lookups', only, async (req, res, next) => {
  try {
    const { db, schema } = require('../../db');
    const { departments, courses, programmes, schools } = schema;
    const { asc } = require('drizzle-orm');

    const [depts, crs, progs, schs] = await Promise.all([
      db.select().from(departments).orderBy(asc(departments.name)),
      db.select().from(courses).orderBy(asc(courses.code)),
      db.select().from(programmes).orderBy(asc(programmes.code)),
      db.select().from(schools).orderBy(asc(schools.name)),
    ]);

    return res.json({
      success: true,
      departments: depts,
      courses: crs,
      programmes: progs,
      schools: schs,
    });
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

    const data = rows.map((r) => ({
      student: r.student,
      registration: r.registration,
    }));

    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/exam-officer/attendance
// ============================================================
router.get('/attendance', only, async (req, res, next) => {
  try {
    const { examScheduleId } = req.query;
    if (!examScheduleId) {
      return res.status(400).json({ success: false, error: 'examScheduleId is required.' });
    }
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
    if (!examScheduleId || !studentId || !status) {
      return res.status(400).json({ success: false, error: 'examScheduleId, studentId, status are required.' });
    }
    const row = await examQueries.upsertAttendance({
      examScheduleId,
      studentId,
      status,
      invigilatorId: req.user.id,
      remarks,
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
    const rows = records.map((r) => ({
      examScheduleId: Number(examScheduleId),
      studentId: Number(r.studentId),
      status: r.status || 'present',
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
      status: 'approved',
    });

    const results = [];
    for (const r of regs) {
      const studentId = r.registration.studentId;

      const totalPaid = effectiveSession
        ? await paymentQueries.totalVerifiedForStudent(studentId, effectiveSession)
        : 0;

      const feeStructure = r.student?.programmeId
        ? await paymentQueries.findFeeStructureWithFallback({
            programmeId: r.student.programmeId,
            level: r.student.level || 'ND',
            sessionId: effectiveSession,
          })
        : null;

      const totalDue = Number(feeStructure?.total || 0);
      const cleared = totalDue === 0 || Number(totalPaid) >= totalDue;

      const clear = effectiveSession
        ? await clearQueries.findOne({ studentId, sessionId: effectiveSession })
        : null;
      const clearanceOk = !clear || clear.status === 'cleared';

      results.push({
        student: r.student,
        registration: r.registration,
        totalPaid: Number(totalPaid),
        totalDue,
        cleared,
        clearanceOk,
        eligible: cleared && clearanceOk,
      });
    }

    const eligible = results.filter((r) => r.eligible).length;
    return res.json({
      success: true,
      data: results,
      summary: { total: results.length, eligible, ineligible: results.length - eligible },
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

    return res.json({
      success: true,
      data: {
        schedules,
        attendanceTotals,
        coveredSchedules,
        attendanceBySchedule: {},
      },
    });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/exam-officer/profile, /security
// ============================================================
router.get('/profile', only, async (req, res, next) => {
  try { return res.json({ success: true, data: await userQueries.findByIdWithRelations(req.user.id) }); }
  catch (err) { return next(err); }
});

router.get('/security', only, async (req, res, next) => {
  try {
    const sessions = await sessionQueries.listUserSessions(req.user.id);
    const logins = await require('../../db/queries/audit').listLogins({ userId: req.user.id, limit: 30 });
    return res.json({ success: true, sessions, logins });
  } catch (err) { return next(err); }
});

module.exports = router;