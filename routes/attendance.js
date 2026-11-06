// ============================================================
// FPU — Admin attendance API
// Mounted at /api/admin/attendance
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const attQueries = require('../db/queries/attendance');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { db, schema, sql } = require('../db');
const { eq, and, desc } = require('drizzle-orm');

const STAFF = ['admin', 'registrar', 'hod', 'lecturer', 'academic_officer'];

// ============================================================
// GET /api/admin/attendance/stats
// Dashboard statistics (departments, courses, records)
// ============================================================
router.get('/stats', requireRole(STAFF), async (req, res, next) => {
  try {
    // This query aggregates data from your departments, courses, and attendance tables
    const stats = await db
      .select({
        departmentId: schema.departments.id,
        departmentName: schema.departments.name,
        departmentCode: schema.departments.code,
        
        // Count of unique courses with attendance
        courses: sql`COUNT(DISTINCT ${schema.attendance.courseId})`,
        
        // Count of unique students with attendance
        students: sql`COUNT(DISTINCT ${schema.attendance.studentId})`,
        
        // Total attendance records
        records: sql`COUNT(${schema.attendance.id})`
      })
      .from(schema.departments)
      .leftJoin(schema.courses, eq(schema.departments.id, schema.courses.departmentId))
      .leftJoin(schema.attendance, eq(schema.courses.id, schema.attendance.courseId))
      .groupBy(schema.departments.id, schema.departments.name, schema.departments.code);

    // Calculate overall totals
    let totalRecords = 0;
    let totalStudents = 0;
    let totalCourses = 0;

    stats.forEach(row => {
      totalRecords += Number(row.records) || 0;
      totalStudents += Number(row.students) || 0;
      totalCourses += Number(row.courses) || 0;
    });

    return res.json({
      success: true,
      data: {
        departments: stats,
        totals: {
          departmentsCount: stats.length,
          coursesCount: totalCourses,
          studentsCount: totalStudents,
          recordsCount: totalRecords
        }
      }
    });
  } catch (err) {
    console.error('Attendance Stats Error:', err);
    return next(err);
  }
});

// ============================================================
// Standard Attendance Routes
// ============================================================

router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const rows = await attQueries.listWithStudent(req.query);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/summary/student', requireRole(STAFF), async (req, res, next) => {
  try {
    const { studentId, courseId, sessionId, semester } = req.query;
    if (!studentId) return res.status(400).json({ success: false, error: 'studentId is required.' });
    const summary = await attQueries.studentSummary({ studentId, courseId, sessionId, semester });
    return res.json({ success: true, data: summary });
  } catch (err) {
    return next(err);
  }
});

router.get('/summary/course', requireRole(STAFF), async (req, res, next) => {
  try {
    const { courseId, sessionId, semester } = req.query;
    if (!courseId) return res.status(400).json({ success: false, error: 'courseId is required.' });
    const summary = await attQueries.courseSummary({ courseId, sessionId, semester });
    return res.json({ success: true, data: summary });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireRole(['admin', 'lecturer', 'hod']), async (req, res, next) => {
  try {
    const row = await attQueries.upsert({ ...req.body, lecturerId: req.user.id });
    await logAudit({ req, action: 'attendance.upsert', entity: 'attendance', entityId: row.id });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/bulk', requireRole(['admin', 'lecturer', 'hod']), async (req, res, next) => {
  try {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'rows[] is required.' });
    }
    const payload = rows.map((r) => ({
      courseId: Number(r.courseId),
      studentId: Number(r.studentId),
      lecturerId: req.user.id,
      sessionId: Number(r.sessionId),
      semester: r.semester,
      date: r.date,
      status: r.status || 'present',
      remarks: r.remarks || null,
    }));
    const inserted = await attQueries.bulkUpsert(payload);
    await logAudit({ req, action: 'attendance.bulk', after: { count: inserted.length } });
    return res.status(201).json({ success: true, data: inserted });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireRole(['admin', 'lecturer', 'hod']), async (req, res, next) => {
  try {
    const row = await attQueries.remove(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Attendance record not found.' });
    await logAudit({ req, action: 'attendance.delete', entity: 'attendance', entityId: row.id, before: row });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ---- /with-student route ----
// MUST come before any router.get('/:id') handler.
router.get('/with-student', async (req, res, next) => {
  try {
    const { courseId, date, sessionId, semester } = req.query;
    const rows = await attQueries.listWithStudent({ courseId, date, sessionId, semester });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

module.exports = router;