// ============================================================
// FPU — Admin courses API
// Mounted at /api/admin/courses
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const courseQueries = require('../db/queries/courses');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const STAFF = ['admin', 'registrar', 'academic_officer', 'hod', 'lecturer', 'exam_officer', 'librarian', 'bursar'];

router.get('/', requireRole(STAFF), async (req, res, next) => {
  // Auto-scope HODs to their own department
  if (req.user && req.user.role === 'hod' && req.user.departmentId) {
    req.query.departmentId = req.user.departmentId;
  }
  try {
    const { programmeId, departmentId, level, semester, search, limit = 200, offset = 0 } = req.query;
    const rows = await courseQueries.list({
      programmeId, departmentId, level, semester, search,
      limit: Number(limit), offset: Number(offset),
    });
    const total = await courseQueries.count({ programmeId, departmentId, level, semester });
    return res.json({ success: true, data: rows, total });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await courseQueries.findByIdWithRelations(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Course not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireRole(['admin', 'registrar', 'academic_officer']), async (req, res, next) => {
  try {
    const { code, title, unit, level, semester, programmeId, departmentId, description, isElective } = req.body || {};
    if (!code || !title || !programmeId || !departmentId) {
      return res.status(400).json({ success: false, error: 'code, title, programmeId, departmentId are required.' });
    }
    const exists = await courseQueries.codeExists(code, level || 'ND', semester || 'first');
    if (exists) return res.status(409).json({ success: false, error: 'A course with this code/level/semester already exists.' });

    const row = await courseQueries.create({ code, title, unit, level, semester, programmeId, departmentId, description, isElective });
    await logAudit({ req, action: 'course.create', entity: 'course', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', requireRole(['admin', 'registrar', 'academic_officer']), async (req, res, next) => {
  try {
    const existing = await courseQueries.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Course not found.' });
    const patch = { ...req.body };
    delete patch.id;
    const row = await courseQueries.update(existing.id, patch);
    await logAudit({ req, action: 'course.update', entity: 'course', entityId: existing.id, before: existing, after: row });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const existing = await courseQueries.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Course not found.' });
    await courseQueries.remove(existing.id);
    await logAudit({ req, action: 'course.delete', entity: 'course', entityId: existing.id, before: existing });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;