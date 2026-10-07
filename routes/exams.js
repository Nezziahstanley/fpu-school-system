// ============================================================
// FPU — Admin exams API (schedules + attendance)
// Mounted at /api/admin/exams
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const examQueries = require('../db/queries/exams');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const STAFF = ['admin', 'registrar', 'exam_officer', 'academic_officer', 'hod', 'lecturer'];

// ---------------- Schedules ----------------
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const filters = { ...req.query };

    // Force HOD to only see their own department's exams
    if (req.user && req.user.role === 'hod' && req.user.departmentId) {
      filters.departmentId = String(req.user.departmentId);
    }

    const rows = await examQueries.listWithCourse(filters);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await examQueries.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Exam schedule not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireRole(['admin', 'exam_officer', 'academic_officer']), async (req, res, next) => {
  try {
    const { courseId, sessionId, semester, examDate, startTime, endTime } = req.body || {};
    if (!courseId || !sessionId || !semester || !examDate || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'courseId, sessionId, semester, examDate, startTime, endTime are required.' });
    }
    const row = await examQueries.create(req.body);
    await logAudit({ req, action: 'exam.create', entity: 'exam_schedule', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', requireRole(['admin', 'exam_officer', 'academic_officer']), async (req, res, next) => {
  try {
    const existing = await examQueries.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Exam schedule not found.' });
    const patch = { ...req.body };
    delete patch.id;
    const row = await examQueries.update(existing.id, patch);
    await logAudit({ req, action: 'exam.update', entity: 'exam_schedule', entityId: existing.id, before: existing, after: row });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireRole(['admin', 'exam_officer']), async (req, res, next) => {
  try {
    const existing = await examQueries.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Exam schedule not found.' });
    await examQueries.remove(existing.id);
    await logAudit({ req, action: 'exam.delete', entity: 'exam_schedule', entityId: existing.id, before: existing });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ---------------- Attendance ----------------
router.get('/:id/attendance', requireRole(STAFF), async (req, res, next) => {
  try {
    const rows = await examQueries.listAttendanceWithStudent({ examScheduleId: req.params.id });
    const counts = await examQueries.countAttendance({ examScheduleId: req.params.id });
    return res.json({ success: true, data: rows, counts });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/attendance', requireRole(['admin', 'exam_officer', 'lecturer']), async (req, res, next) => {
  try {
    const { studentId, status, remarks } = req.body || {};
    if (!studentId || !status) return res.status(400).json({ success: false, error: 'studentId and status are required.' });
    const row = await examQueries.upsertAttendance({
      examScheduleId: req.params.id,
      studentId,
      status,
      invigilatorId: req.user.id,
      remarks,
    });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/attendance/bulk', requireRole(['admin', 'exam_officer', 'lecturer']), async (req, res, next) => {
  try {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'rows[] is required.' });
    }
    const payload = rows.map((r) => ({
      examScheduleId: Number(req.params.id),
      studentId: Number(r.studentId),
      status: r.status,
      invigilatorId: req.user.id,
      remarks: r.remarks || null,
    }));
    const inserted = await examQueries.bulkUpsertAttendance(payload);
    await logAudit({ req, action: 'exam.attendance_bulk', entity: 'exam_schedule', entityId: req.params.id, after: { count: inserted.length } });
    return res.json({ success: true, data: inserted });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;