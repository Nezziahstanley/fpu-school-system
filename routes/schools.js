// ============================================================
// FPU — Admin schools API
// Mounted at /api/admin/schools
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const courseQueries = require('../db/queries/courses');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const STAFF = ['admin', 'registrar', 'academic_officer', 'rector'];

router.get('/', requireRole(STAFF), async (_req, res, next) => {
  try {
    return res.json({ success: true, data: await courseQueries.listSchools() });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await courseQueries.findSchoolById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'School not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const { code, name, description } = req.body || {};
    if (!code || !name) return res.status(400).json({ success: false, error: 'code and name are required.' });
    const row = await courseQueries.createSchool({ code, name, description });
    await logAudit({ req, action: 'school.create', entity: 'school', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const existing = await courseQueries.findSchoolById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'School not found.' });
    const patch = { ...req.body };
    delete patch.id;
    const row = await courseQueries.updateSchool(existing.id, patch);
    await logAudit({ req, action: 'school.update', entity: 'school', entityId: existing.id, before: existing, after: row });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const existing = await courseQueries.findSchoolById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'School not found.' });
    await courseQueries.removeSchool(existing.id);
    await logAudit({ req, action: 'school.delete', entity: 'school', entityId: existing.id, before: existing });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;