// ============================================================
// FPU — Admin course-registrations API
// Mounted at /api/admin/registrations
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const regQueries = require('../db/queries/registrations');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const STAFF = ['admin', 'registrar', 'academic_officer', 'hod'];

router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { studentId, courseId, sessionId, semester, status, limit = 500, offset = 0 } = req.query;
    const rows = await regQueries.list({
      studentId, courseId, sessionId, semester, status,
      limit: Number(limit), offset: Number(offset),
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/with-course', requireRole(STAFF), async (req, res, next) => {
  try {
    const { studentId, sessionId, semester, status } = req.query;
    const rows = await regQueries.listWithCourse({ studentId, sessionId, semester, status });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/with-student', requireRole(STAFF), async (req, res, next) => {
  try {
    const { courseId, sessionId, semester, status } = req.query;
    const rows = await regQueries.listWithStudent({ courseId, sessionId, semester, status });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/stats', requireRole(STAFF), async (req, res, next) => {
  try {
    const { sessionId, semester } = req.query;
    const rows = await regQueries.countByStatus({ sessionId, semester });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// Approve / reject
router.post('/:id/approve', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await regQueries.updateStatus(req.params.id, 'approved', { approvedBy: req.user.id });
    if (!row) return res.status(404).json({ success: false, error: 'Registration not found.' });
    await logAudit({ req, action: 'registration.approve', entity: 'course_registration', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/reject', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await regQueries.updateStatus(req.params.id, 'rejected', {
      approvedBy: req.user.id,
      rejectionReason: req.body?.reason || null,
    });
    if (!row) return res.status(404).json({ success: false, error: 'Registration not found.' });
    await logAudit({ req, action: 'registration.reject', entity: 'course_registration', entityId: row.id, after: { reason: req.body?.reason } });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const row = await regQueries.remove(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Registration not found.' });
    await logAudit({ req, action: 'registration.delete', entity: 'course_registration', entityId: row.id, before: row });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;