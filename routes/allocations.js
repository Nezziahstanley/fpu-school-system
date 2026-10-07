// ============================================================
// FPU — Admin course-allocations API
// Mounted at /api/admin/allocations
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const courseQueries = require('../db/queries/courses');
const userQueries = require('../db/queries/users');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const STAFF = ['admin', 'registrar', 'academic_officer', 'hod', 'lecturer'];

// GET /api/admin/allocations
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { sessionId, lecturerId, courseId, semester } = req.query;
    const rows = await courseQueries.listAllocationsWithRelations({ sessionId, lecturerId, courseId, semester });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/allocations/my
router.get('/my', requireRole(['lecturer', 'hod']), async (req, res, next) => {
  try {
    const rows = await courseQueries.listAllocationsWithRelations({ lecturerId: req.user.id });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/allocations/:id
router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await courseQueries.findAllocationById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Allocation not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/allocations
router.post('/', requireRole(['admin', 'registrar', 'academic_officer', 'hod']), async (req, res, next) => {
  try {
    const { courseId, lecturerId, sessionId, semester } = req.body || {};
    if (!courseId || !lecturerId || !sessionId || !semester) {
      return res.status(400).json({ success: false, error: 'courseId, lecturerId, sessionId, semester are required.' });
    }
    const row = await courseQueries.createAllocation({ courseId, lecturerId, sessionId, semester });
    await logAudit({ req, action: 'allocation.create', entity: 'course_allocation', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/allocations/bulk
router.post('/bulk', requireRole(['admin', 'registrar', 'academic_officer']), async (req, res, next) => {
  try {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'rows[] is required.' });
    }
    const inserted = await courseQueries.bulkAllocate(rows);
    await logAudit({ req, action: 'allocation.bulk_create', entity: 'course_allocation', after: { count: inserted.length } });
    return res.status(201).json({ success: true, data: inserted });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/admin/allocations/:id
router.put('/:id', requireRole(['admin', 'registrar', 'academic_officer', 'hod']), async (req, res, next) => {
  try {
    const existing = await courseQueries.findAllocationById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Allocation not found.' });
    const patch = { ...req.body };
    delete patch.id;
    const row = await courseQueries.updateAllocation(existing.id, patch);
    await logAudit({ req, action: 'allocation.update', entity: 'course_allocation', entityId: existing.id, before: existing, after: row });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/admin/allocations/:id
router.delete('/:id', requireRole(['admin', 'registrar', 'hod']), async (req, res, next) => {
  try {
    const existing = await courseQueries.findAllocationById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Allocation not found.' });
    await courseQueries.removeAllocation(existing.id);
    await logAudit({ req, action: 'allocation.delete', entity: 'course_allocation', entityId: existing.id, before: existing });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;