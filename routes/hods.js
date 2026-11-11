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

// ============================================
// HOD: Fetch Lecture Timetable Slots
// ============================================
router.get('/timetable', requireRole(['hod']), async (req, res, next) => {
  try {
    const { sessionId, semester } = req.query;
    const departmentId = req.user.departmentId;
    
    if (!departmentId) {
      return res.status(400).json({ success: false, error: 'Not assigned to a department.' });
    }

    const ttQueries = require('../../db/queries/timetable');
    const rows = await ttQueries.listWithRelations({ 
      sessionId: Number(sessionId), 
      semester 
    });
    
    // Filter strictly to this HOD's department
    const filtered = rows.filter(r => {
      const c = r.course || {};
      return Number(c.departmentId) === Number(departmentId);
    });

    res.json({ success: true, data: filtered });
  } catch (err) { next(err); }
});

// ============================================
// HOD: Submit Timetable for Approval
// ============================================
router.post('/timetable/submit-for-approval', requireRole(['hod']), async (req, res, next) => {
  try {
    const { sessionId, semester } = req.body || {};
    const departmentId = req.user.departmentId;

    if (!sessionId || !semester) {
      return res.status(400).json({ success: false, error: 'sessionId and semester are required.' });
    }

    const ttQueries = require('../../db/queries/timetable');
    const count = await ttQueries.submitDraftsForApproval(departmentId, sessionId, semester);
    
    if (count === 0) {
      return res.status(400).json({ success: false, error: 'No draft slots found to submit.' });
    }

    res.json({ success: true, message: `Submitted ${count} slot(s) for approval.`, count });
  } catch (err) { next(err); }
});

// ============================================
// HOD: Delete a Draft Slot
// ============================================
router.delete('/timetable/:id', requireRole(['hod']), async (req, res, next) => {
  try {
    const ttQueries = require('../../db/queries/timetable');
    const slot = await ttQueries.findById(req.params.id);
    if (!slot) return res.status(404).json({ success: false, error: 'Slot not found.' });
    await ttQueries.remove(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;