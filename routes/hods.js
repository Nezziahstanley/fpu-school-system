// ============================================================
// FPU — Admin HODs API
// Mounted at /api/admin/hods
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries = require('../db/queries/users');
const courseQueries = require('../db/queries/courses');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const STAFF = ['admin', 'registrar', 'rector'];

// GET /api/admin/hods
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const rows = await userQueries.list({ role: 'hod', limit: 500, offset: 0 });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/hods/:id
router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const user = await userQueries.findByIdWithRelations(req.params.id);
    if (!user || user.role !== 'hod') return res.status(404).json({ success: false, error: 'HOD not found.' });
    return res.json({ success: true, data: user });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/hods/:id/assign-department
router.post('/:id/assign-department', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const { departmentId } = req.body || {};
    if (!departmentId) return res.status(400).json({ success: false, error: 'departmentId is required.' });

    const user = await userQueries.findById(req.params.id);
    if (!user || user.role !== 'hod') return res.status(404).json({ success: false, error: 'HOD not found.' });

    const dept = await courseQueries.findDepartmentById(departmentId);
    if (!dept) return res.status(400).json({ success: false, error: 'Invalid departmentId.' });

    // Point department.hod_user_id at this HOD and set user.departmentId
    await courseQueries.updateDepartment(dept.id, { hodUserId: user.id });
    await userQueries.update(user.id, { departmentId: dept.id, schoolId: dept.schoolId });

    await logAudit({ req, action: 'hod.assign_department', entity: 'user', entityId: user.id, after: { departmentId: dept.id } });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;