// ============================================================
// FPU — Admin grade-scales API
// Mounted at /api/admin/grade-scales
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const resultQueries = require('../db/queries/results');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { invalidateCache } = require('../utils/gradeScale');

const STAFF = ['admin', 'registrar', 'academic_officer', 'rector'];

router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const rows = await resultQueries.listGradeScales({
      isActive: isActive === undefined ? undefined : String(isActive).toLowerCase() === 'true',
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await resultQueries.findGradeScaleById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Grade scale not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireRole(['admin', 'academic_officer']), async (req, res, next) => {
  try {
    const { grade, minScore, maxScore, points, remark, isActive } = req.body || {};
    if (!grade || minScore === undefined || maxScore === undefined || points === undefined) {
      return res.status(400).json({ success: false, error: 'grade, minScore, maxScore, points are required.' });
    }
    const row = await resultQueries.createGradeScale({ grade, minScore, maxScore, points, remark, isActive });
    invalidateCache();
    await logAudit({ req, action: 'grade_scale.create', entity: 'grade_scale', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', requireRole(['admin', 'academic_officer']), async (req, res, next) => {
  try {
    const existing = await resultQueries.findGradeScaleById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Grade scale not found.' });
    const patch = { ...req.body };
    delete patch.id;
    const row = await resultQueries.updateGradeScale(existing.id, patch);
    invalidateCache();
    await logAudit({ req, action: 'grade_scale.update', entity: 'grade_scale', entityId: existing.id, before: existing, after: row });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const existing = await resultQueries.findGradeScaleById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Grade scale not found.' });
    await resultQueries.removeGradeScale(existing.id);
    invalidateCache();
    await logAudit({ req, action: 'grade_scale.delete', entity: 'grade_scale', entityId: existing.id, before: existing });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;