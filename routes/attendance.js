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
const { eq, and, desc, ilike, or, inArray } = require('drizzle-orm');

const STAFF = ['admin', 'registrar', 'hod', 'lecturer', 'academic_officer'];

// ============================================================
// 1. GET /api/admin/attendance/departments
// For the main dashboard grid (Overview)
// ============================================================
router.get('/departments', requireRole(STAFF), async (req, res, next) => {
  try {
    const { sessionId, semester, schoolId, search } = req.query;
    
    // Base query: Join departments -> courses -> attendance
    const conds = [];
    if (sessionId) conds.push(eq(schema.attendance.sessionId, Number(sessionId)));
    if (semester) conds.push(eq(schema.attendance.semester, semester));
    if (schoolId) conds.push(eq(schema.departments.schoolId, Number(schoolId)));
    if (search) {
      conds.push(or(
        ilike(schema.departments.name, `%${search}%`),
        ilike(schema.departments.code, `%${search}%`)
      ));
    }
    const where = conds.length ? and(...conds) : undefined;

    const stats = await db
      .select({
        id: schema.departments.id,
        name: schema.departments.name,
        code: schema.departments.code,
        schoolName: schema.schools.name,
        
        // Counts
        courses: sql`COUNT(DISTINCT ${schema.attendance.courseId})`,
        students: sql`COUNT(DISTINCT ${schema.attendance.studentId})`,
        records: sql`COUNT(${schema.attendance.id})`,
        present: sql`COUNT(CASE WHEN ${schema.attendance.status} = 'present' THEN 1 END)`,
        late: sql`COUNT(CASE WHEN ${schema.attendance.status} = 'late' THEN 1 END)`
      })
      .from(schema.departments)
      .leftJoin(schema.schools, eq(schema.departments.schoolId, schema.schools.id))
      .leftJoin(schema.courses, eq(schema.departments.id, schema.courses.departmentId))
      .leftJoin(schema.attendance, and(eq(schema.courses.id, schema.attendance.courseId), where))
      .groupBy(schema.departments.id, schema.departments.name, schema.departments.code, schema.schools.name)
      .orderBy(schema.departments.name);

    // Calculate overall totals
    let totalRecords = 0, totalCourses = 0, totalPresent = 0, totalLate = 0;
    
    const formatted = stats.map(row => {
      const records = Number(row.records) || 0;
      const present = Number(row.present) || 0;
      const late = Number(row.late) || 0;
      
      totalRecords += records;
      totalCourses += Number(row.courses) || 0;
      totalPresent += present;
      totalLate += late;

      const rate = records > 0 ? Math.round(((present + late) / records) * 100) : 0;

      return {
        ...row,
        records,
        courses: Number(row.courses),
        students: Number(row.students),
        rate
      };
    });

    const overallRate = totalRecords > 0 ? Math.round(((totalPresent + totalLate) / totalRecords) * 100) : 0;

    return res.json({
      success: true,
      data: {
        departments: formatted,
        totals: {
          departmentsCount: formatted.length,
          coursesCount: totalCourses,
          recordsCount: totalRecords,
          overallRate
        }
      }
    });
  } catch (err) {
    console.error('Attendance Departments Error:', err);
    return next(err);
  }
});

// ============================================================
// 2. GET /api/admin/attendance/department/:id
// For the "By Department" page (list of courses)
// ============================================================
router.get('/department/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const deptId = Number(req.params.id);
    const { level, semester, search, sessionId } = req.query;

    const conds = [eq(schema.courses.departmentId, deptId)];
    if (level) conds.push(eq(schema.courses.level, level));
    if (semester) conds.push(eq(schema.courses.semesterName, semester)); // Adjust based on your courses schema
    if (sessionId) conds.push(eq(schema.attendance.sessionId, Number(sessionId)));
    if (search) {
      conds.push(or(
        ilike(schema.courses.code, `%${search}%`),
        ilike(schema.courses.title, `%${search}%`)
      ));
    }

    const courses = await db
      .select({
        id: schema.courses.id,
        code: schema.courses.code,
        title: schema.courses.title,
        level: schema.courses.level,
        records: sql`COUNT(${schema.attendance.id})`,
        students: sql`COUNT(DISTINCT ${schema.attendance.studentId})`,
        present: sql`COUNT(CASE WHEN ${schema.attendance.status} = 'present' THEN 1 END)`,
        late: sql`COUNT(CASE WHEN ${schema.attendance.status} = 'late' THEN 1 END)`,
        lastDate: sql`MAX(${schema.attendance.date})`
      })
      .from(schema.courses)
      .leftJoin(schema.attendance, eq(schema.courses.id, schema.attendance.courseId))
      .where(and(...conds))
      .groupBy(schema.courses.id, schema.courses.code, schema.courses.title, schema.courses.level)
      .orderBy(schema.courses.code);

    const formatted = courses.map(row => {
      const recs = Number(row.records) || 0;
      const p = Number(row.present) || 0;
      const l = Number(row.late) || 0;
      return {
        ...row,
        records: recs,
        students: Number(row.students),
        rate: recs > 0 ? Math.round(((p + l) / recs) * 100) : 0,
        lastDate: row.lastDate ? String(row.lastDate).split('T')[0] : null
      };
    });

    return res.json({ success: true, data: formatted });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// 3. GET /api/admin/attendance/course/:id
// For the "By Course" page (student roster)
// ============================================================
router.get('/course/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const courseId = Number(req.params.id);
    const { status, from, to, search } = req.query;

    const conds = [eq(schema.attendance.courseId, courseId)];
    if (status) conds.push(eq(schema.attendance.status, status));
    if (from) conds.push(sql`${schema.attendance.date} >= ${from}`);
    if (to) conds.push(sql`${schema.attendance.date} <= ${to}`);
    if (search) {
      conds.push(or(
        ilike(schema.users.matricNumber, `%${search}%`),
        ilike(schema.users.firstName, `%${search}%`),
        ilike(schema.users.lastName, `%${search}%`)
      ));
    }

    const roster = await db
      .select({
        studentId: schema.users.id,
        matric: schema.users.matricNumber,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        level: schema.users.level,
        totalClasses: sql`COUNT(${schema.attendance.id})`,
        present: sql`COUNT(CASE WHEN ${schema.attendance.status} = 'present' THEN 1 END)`,
        absent: sql`COUNT(CASE WHEN ${schema.attendance.status} = 'absent' THEN 1 END)`,
        late: sql`COUNT(CASE WHEN ${schema.attendance.status} = 'late' THEN 1 END)`,
        excused: sql`COUNT(CASE WHEN ${schema.attendance.status} = 'excused' THEN 1 END)`
      })
      .from(schema.attendance)
      .innerJoin(schema.users, eq(schema.attendance.studentId, schema.users.id))
      .where(and(...conds))
      .groupBy(schema.users.id, schema.users.matricNumber, schema.users.firstName, schema.users.lastName, schema.users.level);

    const formatted = roster.map(row => {
      const total = Number(row.totalClasses);
      const p = Number(row.present);
      const l = Number(row.late);
      return {
        ...row,
        totalClasses: total,
        present: p,
        absent: Number(row.absent),
        late: l,
        excused: Number(row.excused),
        rate: total > 0 ? Math.round(((p + l) / total) * 100) : 0
      };
    });

    return res.json({ success: true, data: formatted });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// 4. GET /api/admin/attendance/student/:studentId/course/:courseId
// For the "Student x Course" breakdown page
// ============================================================
router.get('/student/:studentId/course/:courseId', requireRole(STAFF), async (req, res, next) => {
  try {
    const studentId = Number(req.params.studentId);
    const courseId = Number(req.params.courseId);

    const records = await db
      .select()
      .from(schema.attendance)
      .where(and(
        eq(schema.attendance.studentId, studentId),
        eq(schema.attendance.courseId, courseId)
      ))
      .orderBy(desc(schema.attendance.date));

    return res.json({ success: true, data: records });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// Standard Attendance Routes (CRUD)
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
router.get('/with-student', async (req, res, next) => {
  try {
    const { courseId, date, sessionId, semester } = req.query;
    const rows = await attQueries.listWithStudent({ courseId, date, sessionId, semester });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

module.exports = router;