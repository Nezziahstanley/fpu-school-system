// ============================================================
// FPU — HOD portal API
// Mounted at /api/hod
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries    = require('../../db/queries/users');
const courseQueries  = require('../../db/queries/courses');
const resultQueries  = require('../../db/queries/results');
const regQueries     = require('../../db/queries/registrations');
const ttQueries      = require('../../db/queries/timetable');
const notifQueries   = require('../../db/queries/notifications');
const sessionQueries = require('../../db/queries/sessions');
const { requireRole } = require('../../middleware/auth');
const { logAudit } = require('../../utils/audit');

const only = requireRole('hod', 'admin');

function deptId(req) {
  const id = req.user.departmentId;
  if (!id) {
    const err = new Error('No department assigned to this HOD account.');
    err.status = 400;
    throw err;
  }
  return id;
}

// ------------------------------------------------------------
// Helper: does this result belong to the HOD's department?
// Returns the result row if yes, or null if no/not-found.
// ------------------------------------------------------------
async function getOwnedResult(req, resultId) {
  const result = await resultQueries.findById(resultId);
  if (!result) return { found: false, owned: false };

  const course = await courseQueries.findById(result.courseId);
  if (!course) return { found: true, owned: false, result };

  const owned = Number(course.departmentId) === Number(req.user.departmentId);
  return { found: true, owned, result, course };
}

// ============================================================
// GET /api/hod/dashboard
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const sessionId = req.user.currentSessionId;

    const courses = await courseQueries.list({ departmentId, limit: 1000 });
    const pendingResults = await resultQueries.listPendingForHod(departmentId, { sessionId });
    const staff = await userQueries.listStaff({ departmentId });
    const students = await userQueries.listStudents({ departmentId, sessionId });
    const unreadNotifications = await notifQueries.countUnreadNotifications(req.user.id);

    return res.json({
      success: true,
      data: {
        department: await courseQueries.findDepartmentById(departmentId),
        totalCourses: courses.length,
        pendingResults: pendingResults.length,
        totalStaff: staff.length,
        totalStudents: students.length,
        unreadNotifications,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/hod/pending-results
// ============================================================
router.get('/pending-results', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const rows = await resultQueries.listPendingForHod(departmentId, {
      sessionId: req.query.sessionId,
      semester: req.query.semester,
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /api/hod/pending-results/:id/verify
// Scoped to the HOD's department.
// ============================================================
router.post('/pending-results/:id/verify', only, async (req, res, next) => {
  try {
    const check = await getOwnedResult(req, req.params.id);
    if (!check.found) {
      return res.status(404).json({ success: false, error: 'Result not found.' });
    }
    if (!check.owned) {
      return res.status(403).json({ success: false, error: 'This result is not in your department.' });
    }

    const row = await resultQueries.hodVerify(check.result.id, req.user.id);
    await logAudit({ req, action: 'hod.result_verify', entity: 'result', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /api/hod/pending-results/:id/reject
// Scoped to the HOD's department.
// ============================================================
router.post('/pending-results/:id/reject', only, async (req, res, next) => {
  try {
    const check = await getOwnedResult(req, req.params.id);
    if (!check.found) {
      return res.status(404).json({ success: false, error: 'Result not found.' });
    }
    if (!check.owned) {
      return res.status(403).json({ success: false, error: 'This result is not in your department.' });
    }

    const row = await resultQueries.hodReject(check.result.id, req.user.id, req.body?.reason);
    await logAudit({ req, action: 'hod.result_reject', entity: 'result', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/hod/courses
// ============================================================
router.get('/courses', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const rows = await courseQueries.list({
      departmentId,
      level: req.query.level,
      semester: req.query.semester,
      limit: 1000,
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/hod/students
// ============================================================
router.get('/students', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const rows = await userQueries.listStudents({
      departmentId,
      programmeId: req.query.programmeId,
      level: req.query.level,
      sessionId: req.query.sessionId,
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/hod/staff
// ============================================================
router.get('/staff', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const rows = await userQueries.listStaff({ departmentId });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/hod/profile
// ============================================================
router.get('/profile', only, async (req, res, next) => {
  try {
    const user = await userQueries.findByIdWithRelations(req.user.id);
    return res.json({ success: true, data: user });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/hod/security
// ============================================================
router.get('/security', only, async (req, res, next) => {
  try {
    const sessions = await sessionQueries.listUserSessions(req.user.id);
    const logins = await require('../../db/queries/audit').listLogins({ userId: req.user.id, limit: 30 });
    return res.json({ success: true, sessions, logins });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;