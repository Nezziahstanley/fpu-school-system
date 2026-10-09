// ============================================================
// FPU — Courses API
// Mounted at /api/admin/courses AND /api/courses
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const courseQueries = require('../db/queries/courses');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// Read-only access — everyone who needs to see the course list
const STAFF = ['admin', 'registrar', 'academic_officer', 'hod', 'lecturer', 'exam_officer', 'librarian', 'bursar'];
// Write access — only these roles can create/edit/delete
const WRITERS = ['admin', 'registrar', 'academic_officer'];

// ============================================================
// GET /courses — list with filters
// Query: departmentId, programmeId, level, search, limit, offset
// ============================================================
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const filters = { ...req.query };

    // Auto-scope HODs to their own department
    if (req.user && req.user.role === 'hod' && req.user.departmentId) {
      filters.departmentId = req.user.departmentId;
    }

    const rows = await courseQueries.list({
      departmentId: filters.departmentId,
      programmeId: filters.programmeId,
      level: filters.level,
      search: filters.search,
      limit: Number(filters.limit) || 500,
      offset: Number(filters.offset) || 0,
    });
    const total = await courseQueries.count({
      departmentId: filters.departmentId,
      programmeId: filters.programmeId,
      level: filters.level,
      search: filters.search,
    });

    return res.json({ success: true, data: rows, total });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /courses/:id — single course
// ============================================================
router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await courseQueries.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Course not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /courses — create (writers only)
// ============================================================
router.post('/', requireRole(WRITERS), async (req, res, next) => {
  try {
    const { code, title } = req.body || {};
    if (!code || !title) {
      return res.status(400).json({ success: false, error: 'code and title are required.' });
    }
    const row = await courseQueries.create(req.body);
    await logAudit({
      req,
      action: 'course.create',
      entity: 'course',
      entityId: row.id,
      after: row,
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// PUT /courses/:id — update (writers only)
// ============================================================
router.put('/:id', requireRole(WRITERS), async (req, res, next) => {
  try {
    const existing = await courseQueries.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Course not found.' });
    const row = await courseQueries.update(existing.id, req.body);
    await logAudit({
      req,
      action: 'course.update',
      entity: 'course',
      entityId: existing.id,
      before: existing,
      after: row,
    });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// DELETE /courses/:id — remove (admin only)
// ============================================================
router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const existing = await courseQueries.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Course not found.' });
    await courseQueries.remove(existing.id);
    await logAudit({
      req,
      action: 'course.delete',
      entity: 'course',
      entityId: existing.id,
      before: existing,
    });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;