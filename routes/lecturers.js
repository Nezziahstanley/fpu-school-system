// ============================================================
// FPU — Admin lecturers API
// Mounted at /api/admin/lecturers
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries = require('../db/queries/users');
const courseQueries = require('../db/queries/courses');
const { requireRole } = require('../middleware/auth');

const STAFF = ['admin', 'registrar', 'academic_officer', 'hod'];

router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { departmentId } = req.query;
    const rows = await userQueries.list({ role: 'lecturer', departmentId, limit: 500, offset: 0 });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const user = await userQueries.findByIdWithRelations(req.params.id);
    if (!user || user.role !== 'lecturer') return res.status(404).json({ success: false, error: 'Lecturer not found.' });
    return res.json({ success: true, data: user });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/courses', requireRole(STAFF), async (req, res, next) => {
  try {
    const rows = await courseQueries.listAllocationsWithRelations({ lecturerId: req.params.id, sessionId: req.query.sessionId });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;