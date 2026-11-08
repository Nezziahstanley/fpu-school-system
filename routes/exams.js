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
const { db, schema, sql } = require('../db');
const { eq, and } = require('drizzle-orm');

const STAFF = ['admin', 'registrar', 'exam_officer', 'academic_officer', 'hod', 'lecturer', 'rector', 'librarian'];

// ============================================================
// 1. GET /api/admin/exams/periods
// ============================================================
router.get('/periods', requireRole(STAFF), async (req, res, next) => {
  try {
    const periods = [
      { id: 1, name: 'Morning', start: '09:00', end: '11:00' },
      { id: 2, name: 'Afternoon', start: '12:00', end: '14:00' },
      { id: 3, name: 'Evening', start: '15:00', end: '17:00' }
    ];
    return res.json({ success: true, data: periods });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// 2. GET /api/admin/exams/schools
// ============================================================
router.get('/schools', requireRole(STAFF), async (req, res, next) => {
  try {
    const { sessionId, semester } = req.query;

    const stats = await db
      .select({
        id: schema.schools.id,
        name: schema.schools.name,
        code: schema.schools.code,
        exams: sql`COUNT(DISTINCT ${schema.examSchedules.id})`,
        days: sql`COUNT(DISTINCT ${schema.examSchedules.examDate})`,
        venues: sql`COUNT(DISTINCT ${schema.examSchedules.venue})`
      })
      .from(schema.schools)
      .leftJoin(schema.departments, eq(schema.schools.id, schema.departments.schoolId))
      .leftJoin(schema.courses, eq(schema.departments.id, schema.courses.departmentId))
      .leftJoin(schema.examSchedules, eq(schema.courses.id, schema.examSchedules.courseId))
      .groupBy(schema.schools.id, schema.schools.name, schema.schools.code);

    return res.json({ success: true, data: stats });
  } catch (err) {
    console.error('Error fetching exam schools:', err);
    return next(err);
  }
});

// ============================================================
// 3. Schedules CRUD
// ============================================================
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

router.post('/', requireRole(['admin', 'exam_officer', 'academic_officer', 'hod']), async (req, res, next) => {
  try {
    const { courseId, sessionId, semester, examDate, startTime, endTime } = req.body || {};
    if (!courseId || !sessionId || !semester || !examDate || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'courseId, sessionId, semester, examDate, startTime, endTime are required.' });
    }

    // Validate status
    const validStatuses = ['draft', 'submitted', 'approved'];
    if (req.body.status && !validStatuses.includes(req.body.status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value.' });
    }

    const row = await examQueries.create(req.body);
    await logAudit({ req, action: 'exam.create', entity: 'exam_schedule', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', requireRole(['admin', 'exam_officer', 'academic_officer', 'hod']), async (req, res, next) => {
  try {
    const existing = await examQueries.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Exam schedule not found.' });

    const patch = { ...req.body };
    delete patch.id;

    // Validate status
    const validStatuses = ['draft', 'submitted', 'approved'];
    if (patch.status && !validStatuses.includes(patch.status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value.' });
    }

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

// ============================================================
// 4. Attendance
// ============================================================
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