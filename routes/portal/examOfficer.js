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

const only = requireRole('exam_officer', 'admin');

// ============================================================
// GET /api/exam-officer/dashboard
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    const sessionId = req.query.sessionId || req.user.currentSessionId;
    const schedules = await examQueries.listWithCourse({ sessionId });
    return res.json({
      success: true,
      data: {
        totalSchedules: schedules.length,
        upcoming: schedules.filter((s) => new Date(s.exam.examDate) >= new Date()).length,
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
    if (!examScheduleId || !studentId || !status) {
      return res.status(400).json({ success: false, error: 'examScheduleId, studentId, status are required.' });
    }
    const row = await examQueries.upsertAttendance({
      examScheduleId, studentId, status,
      invigilatorId: req.user.id, remarks,
    });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/exam-officer/eligibility
// Query: sessionId, courseId — computes which students are eligible
// ============================================================
router.get('/eligibility', only, async (req, res, next) => {
  try {
    const { sessionId, courseId, semester } = req.query;
    if (!courseId) return res.status(400).json({ success: false, error: 'courseId is required.' });

    const regs = await regQueries.listWithStudent({ courseId, sessionId, semester, status: 'approved' });
    const results = [];

    for (const r of regs) {
      const studentId = r.registration.studentId;
      const totalPaid = await paymentQueries.totalVerifiedForStudent(studentId, sessionId || req.user.currentSessionId);
      const feeStructure = r.student?.programmeId
        ? await paymentQueries.findFeeStructure({
            programmeId: r.student.programmeId,
            level: r.student.level || 'ND',
            sessionId: sessionId || req.user.currentSessionId,
          })
        : null;

      const totalDue = Number(feeStructure?.total || 0);
      const cleared = totalDue === 0 || totalPaid >= totalDue;

      const clear = await clearQueries.findOne({ studentId, sessionId: sessionId || req.user.currentSessionId });
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
    return res.json({ success: true, data: results });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/exam-officer/reports
// ============================================================
router.get('/reports', only, async (req, res, next) => {
  try {
    const sessionId = req.query.sessionId || req.user.currentSessionId;
    const schedules = await examQueries.listWithCourse({ sessionId });
    const byStatus = {};
    for (const s of schedules) {
      const counts = await examQueries.countAttendance({ examScheduleId: s.exam.id });
      byStatus[s.exam.id] = counts;
    }
    return res.json({ success: true, data: { schedules, attendanceBySchedule: byStatus } });
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