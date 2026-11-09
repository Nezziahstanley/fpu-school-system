// ============================================================
// FPU — Admin timetable API
// Mounted at /api/admin/timetable
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const ttQueries = require('../../db/queries/timetable');
const { requireRole } = require('../../middleware/auth');
const { logAudit } = require('../../utils/audit');

const STAFF = ['admin', 'registrar', 'academic_officer', 'hod', 'lecturer'];

router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { courseId, lecturerId, sessionId, semester, dayOfWeek } = req.query;
    const rows = await ttQueries.listWithRelations({ courseId, lecturerId, sessionId, semester, dayOfWeek });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await ttQueries.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Slot not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireRole(['admin', 'registrar', 'academic_officer', 'hod']), async (req, res, next) => {
  try {
    const { courseId, sessionId, semester, dayOfWeek, startTime, endTime } = req.body || {};
    if (!courseId || !sessionId || !semester || !dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'courseId, sessionId, semester, dayOfWeek, startTime, endTime are required.' });
    }

    const conflicts = await ttQueries.findConflicts({
      sessionId, semester, dayOfWeek, startTime, endTime,
      lecturerId: req.body?.lecturerId,
      venue: req.body?.venue,
    });
    if (conflicts.length) {
      return res.status(409).json({ success: false, error: 'Slot conflicts with an existing timetable entry.', conflicts });
    }

    const row = await ttQueries.create(req.body);
    await logAudit({ req, action: 'timetable.create', entity: 'timetable_slot', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', requireRole(['admin', 'registrar', 'academic_officer', 'hod']), async (req, res, next) => {
  try {
    const existing = await ttQueries.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Slot not found.' });
    const patch = { ...req.body };
    delete patch.id;
    const row = await ttQueries.update(existing.id, patch);
    await logAudit({ req, action: 'timetable.update', entity: 'timetable_slot', entityId: existing.id, before: existing, after: row });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireRole(['admin', 'registrar', 'hod']), async (req, res, next) => {
  try {
    const existing = await ttQueries.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Slot not found.' });
    await ttQueries.remove(existing.id);
    await logAudit({ req, action: 'timetable.delete', entity: 'timetable_slot', entityId: existing.id, before: existing });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ============================================
// Admin: Approve All Pending Slots for a Dept
// ============================================
router.post('/approve', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const { departmentId } = req.body || {};
    if (!departmentId) {
      return res.status(400).json({ success: false, error: 'departmentId is required.' });
    }

    const count = await ttQueries.approvePendingByDept(Number(departmentId));

    await logAudit({
      req,
      action: 'timetable.approve_all',
      entity: 'timetable_slots',
      entityId: departmentId,
      after: { departmentId, approvedCount: count },
    });

    return res.json({ 
      success: true, 
      message: `Approved ${count} pending slot(s).`,
      count 
    });
  } catch (err) {
    return next(err);
  }
});

// ============================================
// HOD: Submit Timetable for Admin Approval
// ============================================
router.post('/submit-for-approval', requireRole(['hod']), async (req, res, next) => {
  try {
    // The HOD's department ID comes from their logged-in user session
    const departmentId = req.user.departmentId;
    
    if (!departmentId) {
      return res.status(400).json({ success: false, error: 'You are not assigned to a department.' });
    }

    const { sessionId, semester } = req.body || {};
    if (!sessionId || !semester) {
      return res.status(400).json({ success: false, error: 'sessionId and semester are required.' });
    }

    const count = await ttQueries.submitDraftsForApproval(departmentId, sessionId, semester);

    if (count === 0) {
      return res.status(400).json({ success: false, error: 'No draft timetable slots found to submit.' });
    }

    await logAudit({
      req,
      action: 'timetable.submit_for_approval',
      entity: 'timetable_slots',
      entityId: departmentId,
      after: { departmentId, sessionId, semester, submittedCount: count },
    });

    return res.json({ 
      success: true, 
      message: `Submitted ${count} timetable slot(s) for approval.`,
      count 
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;