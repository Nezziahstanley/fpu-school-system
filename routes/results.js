// ============================================================
// FPU — Admin results API
// Mounted at /api/admin/results
// ------------------------------------------------------------
// Workflow: draft → submitted → hod_verified → approved → published
//           (+ hod_rejected, admin_rejected)
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const resultQueries = require('../db/queries/results');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { scoreToGrade, getActiveGradeScale, invalidateCache } = require('../utils/gradeScale');

const STAFF = ['admin', 'registrar', 'academic_officer', 'hod', 'lecturer'];

// GET /api/admin/results
router.get('/', requireRole(STAFF), async (req, res, next) => {
  // Auto-scope HODs to their own department for regular listing
  if (req.user && req.user.role === 'hod' && req.user.departmentId) {
    req.query.departmentId = req.user.departmentId;
  }
  try {
    const { studentId, courseId, sessionId, semester, status, limit = 500, offset = 0 } = req.query;
    const rows = await resultQueries.list({
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
    const rows = await resultQueries.listWithCourse({ studentId, sessionId, semester, status });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/with-student', requireRole(STAFF), async (req, res, next) => {
  try {
    const { courseId, sessionId, semester, status } = req.query;
    const rows = await resultQueries.listWithStudent({ courseId, sessionId, semester, status });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/pending-hod', requireRole(['hod', 'admin']), async (req, res, next) => {
  try {
    const departmentId = req.user.departmentId;
    if (!departmentId) return res.status(400).json({ success: false, error: 'No department assigned.' });
    const rows = await resultQueries.listPendingForHod(departmentId, { sessionId: req.query.sessionId, semester: req.query.semester });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/pending-admin', requireRole(['admin', 'academic_officer']), async (req, res, next) => {
  try {
    const rows = await resultQueries.listPendingAdmin({ sessionId: req.query.sessionId, semester: req.query.semester });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await resultQueries.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Result not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/results — create or upsert with auto-grade
router.post('/', requireRole(['admin', 'academic_officer', 'lecturer']), async (req, res, next) => {
  try {
    const { studentId, courseId, sessionId, semester, score } = req.body || {};
    if (!studentId || !courseId || !sessionId || !semester || score === undefined) {
      return res.status(400).json({ success: false, error: 'studentId, courseId, sessionId, semester, score are required.' });
    }
    const scale = await getActiveGradeScale();
    const { grade, points } = await scoreToGrade(score, scale);

    const row = await resultQueries.upsert({
      studentId, courseId, sessionId, semester,
      score, grade, points,
      status: 'draft',
    });
    await logAudit({ req, action: 'result.upsert', entity: 'result', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/admin/results/:id — edit score (recomputes grade)
router.put('/:id', requireRole(['admin', 'academic_officer', 'lecturer']), async (req, res, next) => {
  try {
    const existing = await resultQueries.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Result not found.' });

    const patch = { ...req.body };
    delete patch.id;

    if (patch.score !== undefined) {
      const scale = await getActiveGradeScale();
      const { grade, points } = await scoreToGrade(patch.score, scale);
      patch.grade = grade;
      patch.points = points;
    }

    const row = await resultQueries.update(existing.id, patch);
    await logAudit({ req, action: 'result.update', entity: 'result', entityId: existing.id, before: existing, after: row });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// Submit (lecturer or admin)
router.post('/:id/submit', requireRole(['lecturer', 'admin', 'academic_officer']), async (req, res, next) => {
  try {
    const row = await resultQueries.submit(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Result not found.' });
    await logAudit({ req, action: 'result.submit', entity: 'result', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// HOD verify / reject
router.post('/:id/hod-verify', requireRole(['hod', 'admin']), async (req, res, next) => {
  try {
    const row = await resultQueries.hodVerify(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Result not found.' });
    await logAudit({ req, action: 'result.hod_verify', entity: 'result', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/hod-reject', requireRole(['hod', 'admin']), async (req, res, next) => {
  try {
    const row = await resultQueries.hodReject(req.params.id, req.user.id, req.body?.reason);
    if (!row) return res.status(404).json({ success: false, error: 'Result not found.' });
    await logAudit({ req, action: 'result.hod_reject', entity: 'result', entityId: row.id, after: { reason: req.body?.reason } });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// Admin approve / reject
router.post('/:id/approve', requireRole(['admin', 'academic_officer']), async (req, res, next) => {
  try {
    const row = await resultQueries.adminApprove(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Result not found.' });
    await logAudit({ req, action: 'result.approve', entity: 'result', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/reject', requireRole(['admin', 'academic_officer']), async (req, res, next) => {
  try {
    const row = await resultQueries.adminReject(req.params.id, req.user.id, req.body?.reason);
    if (!row) return res.status(404).json({ success: false, error: 'Result not found.' });
    await logAudit({ req, action: 'result.admin_reject', entity: 'result', entityId: row.id, after: { reason: req.body?.reason } });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// Publish single or batch
router.post('/:id/publish', requireRole(['admin', 'academic_officer']), async (req, res, next) => {
  try {
    const row = await resultQueries.publish(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Result not found.' });
    await logAudit({ req, action: 'result.publish', entity: 'result', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/publish-batch', requireRole(['admin', 'academic_officer']), async (req, res, next) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids[] is required.' });
    }
    const rows = await resultQueries.publishBatch(ids);
    await logAudit({ req, action: 'result.publish_batch', entity: 'result', after: { count: rows.length } });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const row = await resultQueries.remove(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Result not found.' });
    await logAudit({ req, action: 'result.delete', entity: 'result', entityId: row.id, before: row });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// Force refresh of cached grade scale (handy after editing the scale)
router.post('/refresh-scale', requireRole(['admin']), async (_req, res) => {
  invalidateCache();
  return res.json({ success: true });
});

module.exports = router;