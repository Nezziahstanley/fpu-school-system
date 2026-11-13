// ============================================================
// FPU — Admin timetable API
// Mounted at /api/admin/timetable
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const ttQueries = require('../db/queries/timetable');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

async function assertHodCourseScope(req, res, courseId) {
  if (req.user?.role !== 'hod') return true;
  if (!req.user.departmentId) {
    res.status(403).json({ success: false, error: 'Your HOD account has no assigned department.' });
    return false;
  }
  const course = await ttQueries.findCourseDepartment(courseId);
  if (!course || Number(course.departmentId) !== Number(req.user.departmentId)) {
    res.status(403).json({ success: false, error: 'You can only manage timetable entries for your assigned department.' });
    return false;
  }
  return true;
}

const STAFF = ['admin', 'registrar', 'academic_officer', 'hod', 'lecturer'];

// ============================================
// GET / — List slots (with department filter)
// ============================================
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { courseId, lecturerId, sessionId, semester, dayOfWeek, status } = req.query;
    let departmentId = req.query.departmentId;
    if (req.user?.role === 'hod') {
      if (!req.user.departmentId) return res.status(403).json({ success: false, error: 'Your HOD account has no assigned department.' });
      departmentId = req.user.departmentId;
    }
    const rows = await ttQueries.listWithRelations({ courseId, lecturerId, sessionId, semester, dayOfWeek, departmentId, status });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await ttQueries.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Slot not found.' });
    if (!(await assertHodCourseScope(req, res, row.courseId))) return;
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

    if (!(await assertHodCourseScope(req, res, courseId))) return;
    // HOD-created slots always start as drafts; approval is a separate workflow.
    const row = await ttQueries.create({ ...req.body, status: 'draft' });
    await logAudit({ req, action: 'timetable.create', entity: 'timetable_slot', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', requireRole(['admin', 'registrar', 'academic_officer', 'exam_officer', 'hod']), async (req, res, next) => {
  try {
    const existing = await ttQueries.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Slot not found.' });
    if (!(await assertHodCourseScope(req, res, existing.courseId))) return;

    const patch = { ...req.body };
    delete patch.id;
    const requestedStatus = patch.status;
    delete patch.status;

    if (req.user?.role === 'hod') {
      if (existing.status !== 'draft') return res.status(409).json({ success: false, error: 'Only draft timetable slots can be edited or submitted by an HOD.' });
      if (requestedStatus !== undefined) {
        if (!['pending', 'submitted'].includes(requestedStatus)) {
          return res.status(403).json({ success: false, error: 'HODs may only submit draft slots for approval.' });
        }
        patch.status = 'pending';
      }
    } else if (requestedStatus !== undefined) {
      if (!['admin', 'registrar', 'exam_officer'].includes(req.user?.role)) {
        return res.status(403).json({ success: false, error: 'Only an HOD can submit a draft timetable; an administrator or examiner approves it.' });
      } else {
        if (requestedStatus !== 'approved' || !['pending', 'submitted'].includes(String(existing.status || '').toLowerCase())) {
          return res.status(409).json({ success: false, error: 'Only pending timetable slots can be approved.' });
        }
        patch.status = 'approved';
      }
    }

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
    if (!(await assertHodCourseScope(req, res, existing.courseId))) return;
    if (req.user?.role === 'hod' && existing.status !== 'draft') {
      return res.status(409).json({ success: false, error: 'HODs may only delete draft timetable slots.' });
    }
    await ttQueries.remove(existing.id);
    await logAudit({ req, action: 'timetable.delete', entity: 'timetable_slot', entityId: existing.id, before: existing });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ============================================
// HOD: Submit all their drafts for approval
// POST /api/admin/timetable/submit
// Body: { departmentId, sessionId, semester }
// ============================================
async function submitTimetableForApproval(req, res, next) {
  try {
    const { sessionId, semester } = req.body || {};
    const departmentId = req.user?.role === 'hod' ? req.user.departmentId : req.body?.departmentId;
    if (!departmentId || !sessionId || !semester) {
      return res.status(400).json({ success: false, error: 'departmentId, sessionId and semester are required.' });
    }
    if (req.user?.role === 'hod' && !req.user.departmentId) {
      return res.status(403).json({ success: false, error: 'Your HOD account has no assigned department.' });
    }
    const count = await ttQueries.submitDraftsForApproval(Number(departmentId), Number(sessionId), semester);
    await logAudit({ req, action: 'timetable.submit', entity: 'timetable_slots', entityId: departmentId, after: { departmentId, sessionId, semester, submittedCount: count } });
    return res.json({ success: true, message: `Submitted ${count} slot(s) for approval.`, count });
  } catch (err) { return next(err); }
}
router.post('/submit', requireRole(['hod', 'admin', 'academic_officer']), submitTimetableForApproval);
// Compatibility with the HOD dashboard's existing endpoint.
router.post('/submit-for-approval', requireRole(['hod', 'admin', 'academic_officer']), submitTimetableForApproval);

router.post('/approve', requireRole(['admin', 'registrar', 'exam_officer']), async (req, res, next) => {
  try {
    const { departmentId, sessionId, semester } = req.body || {};
    if (!departmentId || !sessionId || !semester) {
      return res.status(400).json({ success: false, error: 'departmentId, sessionId and semester are required to approve a timetable.' });
    }
    const count = await ttQueries.approvePendingByDept(Number(departmentId), Number(sessionId), semester);
    await logAudit({ req, action: 'timetable.approve_all', entity: 'timetable_slots', entityId: departmentId, after: { departmentId, sessionId, semester, approvedCount: count } });
    return res.json({ success: true, message: `Approved ${count} pending slot(s).`, count });
  } catch (err) { return next(err); }
});

module.exports = router;