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

async function assertAllocationScope(req, res, allocation) {
  if (req.user?.role === 'hod') {
    if (!req.user.departmentId || Number(allocation?.course?.departmentId) !== Number(req.user.departmentId)) {
      res.status(403).json({ success: false, error: 'You can only manage allocations for your assigned department.' });
      return false;
    }
  }
  if (req.user?.role === 'lecturer' && Number(allocation?.lecturerId ?? allocation?.allocation?.lecturerId) !== Number(req.user.id)) {
    res.status(403).json({ success: false, error: 'You can only view your own course allocations.' });
    return false;
  }
  return true;
}

const STAFF = ['admin', 'registrar', 'academic_officer', 'hod', 'lecturer'];

// Allocations belong only to active courses and teaching staff.
// This validation applies to administrators as well as HODs.
async function validateTeachingAllocation(courseId, lecturerId) {
  const course = await courseQueries.findById(courseId);
  if (!course) return { error: 'The selected course was not found.' };
  if (course.isActive === false) return { error: 'Only active courses can be allocated.' };

  const lecturer = await userQueries.findById(lecturerId);
  const role = String(lecturer?.role || '').toLowerCase();
  if (!lecturer || !['lecturer', 'hod'].includes(role)) {
    return { error: 'Only lecturer or HOD accounts can receive course allocations. Student accounts are not permitted.' };
  }
  return { course, lecturer };
}

// GET /api/admin/allocations
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { sessionId, courseId, semester } = req.query;
    let lecturerId = req.query.lecturerId;
    let departmentId;
    if (req.user?.role === 'hod') {
      if (!req.user.departmentId) return res.status(403).json({ success: false, error: 'Your HOD account has no assigned department.' });
      departmentId = req.user.departmentId;
    }
    if (req.user?.role === 'lecturer') lecturerId = req.user.id;
    const rows = await courseQueries.listAllocationsWithRelations({ sessionId, lecturerId, courseId, semester, departmentId });
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
    if (!(await assertAllocationScope(req, res, row))) return;
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
    const pair = await validateTeachingAllocation(courseId, lecturerId);
    if (pair.error) return res.status(400).json({ success: false, error: pair.error });

    if (req.user?.role === 'hod') {
      if (!req.user.departmentId) return res.status(403).json({ success: false, error: 'Your HOD account has no assigned department.' });
      if (Number(pair.course.departmentId) !== Number(req.user.departmentId)) {
        return res.status(403).json({ success: false, error: 'You can only allocate courses in your assigned department.' });
      }
      if (Number(pair.lecturer.departmentId) !== Number(req.user.departmentId)) {
        return res.status(403).json({ success: false, error: 'You can only assign courses to teaching staff in your department.' });
      }
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
    for (let i = 0; i < rows.length; i++) {
      const item = rows[i] || {};
      if (!item.courseId || !item.lecturerId || !item.sessionId || !item.semester) {
        return res.status(400).json({ success: false, error: `Allocation row ${i + 1} is missing course, lecturer, session or semester.` });
      }
      const pair = await validateTeachingAllocation(item.courseId, item.lecturerId);
      if (pair.error) {
        return res.status(400).json({ success: false, error: `Allocation row ${i + 1}: ${pair.error}` });
      }
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
    if (!(await assertAllocationScope(req, res, existing))) return;
    const patch = { ...req.body };
    delete patch.id;
    if (patch.courseId !== undefined || patch.lecturerId !== undefined) {
      const targetCourseId = patch.courseId !== undefined ? patch.courseId : (existing.course?.id || existing.courseId);
      const targetLecturerId = patch.lecturerId !== undefined ? patch.lecturerId : (existing.lecturer?.id || existing.lecturerId);
      const pair = await validateTeachingAllocation(targetCourseId, targetLecturerId);
      if (pair.error) return res.status(400).json({ success: false, error: pair.error });

      if (req.user?.role === 'hod') {
        if (!req.user.departmentId || Number(pair.course.departmentId) !== Number(req.user.departmentId)) {
          return res.status(403).json({ success: false, error: 'You cannot move an allocation outside your department.' });
        }
        if (Number(pair.lecturer.departmentId) !== Number(req.user.departmentId)) {
          return res.status(403).json({ success: false, error: 'You can only assign courses to teaching staff in your department.' });
        }
      }
    }
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
    if (!(await assertAllocationScope(req, res, existing))) return;
    await courseQueries.removeAllocation(existing.id);
    await logAudit({ req, action: 'allocation.delete', entity: 'course_allocation', entityId: existing.id, before: existing });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;