'use strict';

const express = require('express');
const router = express.Router();
const { db, schema, sql } = require('../db');
const { eq, and, or, ilike, desc, inArray } = require('drizzle-orm');
const { requireRole } = require('../middleware/auth');

const STAFF = ['admin', 'registrar', 'hod', 'lecturer', 'academic_officer'];

// ============================================================
// GET /api/admin/attendance/departments
// Returns a flat array of departments with their stats
// ============================================================
router.get('/departments', requireRole(STAFF), async (req, res, next) => {
  try {
    const { sessionId, semester, schoolId, search } = req.query;

    // Keep department filters on the department query itself. Putting them in
    // the attendance LEFT JOIN would leave unrelated departments in the list.
    const departmentConds = [];
    if (schoolId) departmentConds.push(eq(schema.departments.schoolId, Number(schoolId)));
    if (search) {
      departmentConds.push(or(
        ilike(schema.departments.name, `%${search}%`),
        ilike(schema.departments.code, `%${search}%`)
      ));
    }

    const attendanceConds = [];
    let selectedSessionId = sessionId ? Number(sessionId) : null;
    if (!selectedSessionId) {
      const [currentSession] = await db
        .select({ id: schema.academicSessions.id })
        .from(schema.academicSessions)
        .where(eq(schema.academicSessions.isCurrent, true))
        .limit(1);
      selectedSessionId = currentSession ? Number(currentSession.id) : null;
    }
    if (selectedSessionId) attendanceConds.push(eq(schema.attendance.sessionId, selectedSessionId));
    if (semester) attendanceConds.push(eq(schema.attendance.semester, semester));

    const departmentWhere = departmentConds.length ? and(...departmentConds) : undefined;
    const attendanceWhere = attendanceConds.length ? and(...attendanceConds) : undefined;

    const stats = await db
      .select({
        id: schema.departments.id,
        name: schema.departments.name,
        code: schema.departments.code,
        schoolName: schema.schools.name,
        courses: sql`COUNT(DISTINCT ${schema.attendance.courseId})`,
        students: sql`COUNT(DISTINCT ${schema.attendance.studentId})`,
        records: sql`COUNT(${schema.attendance.id})`,
        present: sql`COUNT(CASE WHEN ${schema.attendance.status} = 'present' THEN 1 END)`,
        late: sql`COUNT(CASE WHEN ${schema.attendance.status} = 'late' THEN 1 END)`
      })
      .from(schema.departments)
      .leftJoin(schema.schools, eq(schema.departments.schoolId, schema.schools.id))
      .leftJoin(schema.courses, eq(schema.departments.id, schema.courses.departmentId))
      .leftJoin(schema.attendance, and(eq(schema.courses.id, schema.attendance.courseId), attendanceWhere))
      .where(departmentWhere)
      .groupBy(schema.departments.id, schema.departments.name, schema.departments.code, schema.schools.name)
      .orderBy(schema.departments.name);

    const formatted = stats.map(row => {
      const recs = Number(row.records) || 0;
      const p = Number(row.present) || 0;
      const l = Number(row.late) || 0;
      return {
        ...row,
        courses: Number(row.courses),
        students: Number(row.students),
        records: recs,
        rate: recs > 0 ? Math.round(((p + l) / recs) * 100) : 0
      };
    });

    return res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('Attendance Departments Error:', err);
    return next(err);
  }
});


// ============================================================
// GET /api/admin/attendance/department/:departmentId
// Course-level attendance summary for a department.
// Supports session, semester, level and search filters.
// ============================================================
router.get('/department/:departmentId', requireRole(STAFF), async (req, res, next) => {
  try {
    const departmentId = Number(req.params.departmentId);
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      return res.status(400).json({ success: false, error: 'A valid department is required.' });
    }

    const { sessionId, semester, level, search } = req.query;
    const conditions = [eq(schema.courses.departmentId, departmentId)];

    if (level) conditions.push(eq(schema.courses.level, String(level)));
    if (search) {
      conditions.push(or(
        ilike(schema.courses.code, `%${String(search).trim()}%`),
        ilike(schema.courses.title, `%${String(search).trim()}%`)
      ));
    }

    let selectedSessionId = sessionId ? Number(sessionId) : null;
    if (sessionId && (!Number.isInteger(selectedSessionId) || selectedSessionId <= 0)) {
      return res.status(400).json({ success: false, error: 'Invalid academic session.' });
    }
    if (!selectedSessionId) {
      const [currentSession] = await db
        .select({ id: schema.academicSessions.id })
        .from(schema.academicSessions)
        .where(eq(schema.academicSessions.isCurrent, true))
        .limit(1);
      selectedSessionId = currentSession ? Number(currentSession.id) : null;
    }

    const attendanceConditions = [];
    if (selectedSessionId) attendanceConditions.push(eq(schema.attendance.sessionId, selectedSessionId));
    if (semester) attendanceConditions.push(eq(schema.attendance.semester, String(semester)));

    const rows = await db
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
      .leftJoin(
        schema.attendance,
        attendanceConditions.length
          ? and(eq(schema.attendance.courseId, schema.courses.id), ...attendanceConditions)
          : eq(schema.attendance.courseId, schema.courses.id)
      )
      .where(and(...conditions))
      .groupBy(schema.courses.id, schema.courses.code, schema.courses.title, schema.courses.level)
      .orderBy(schema.courses.code);

    const data = rows.map((row) => {
      const records = Number(row.records) || 0;
      const students = Number(row.students) || 0;
      const present = Number(row.present) || 0;
      const late = Number(row.late) || 0;
      return {
        ...row,
        id: Number(row.id),
        records,
        students,
        present,
        late,
        rate: records ? Math.round(((present + late) / records) * 100) : 0
      };
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Attendance Department Courses Error:', err);
    return next(err);
  }
});

// ============================================================
// GET /api/admin/attendance/course/:id (Legacy route)
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
// GET /api/admin/attendance/course/:courseId/students
// Returns the roster of students registered for a specific course
// ============================================================
router.get('/course/:courseId/students', requireRole(STAFF), async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);

    // 1. Fetch all students registered for this course
    const registrations = await db
      .select({ studentId: schema.courseRegistrations.studentId })
      .from(schema.courseRegistrations)
      .where(eq(schema.courseRegistrations.courseId, courseId));

    if (!registrations.length) return res.json({ success: true, data: [] });

    const studentIds = registrations.map(r => r.studentId);

    // 2. Fetch student details
    const students = await db
      .select({
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        matricNumber: schema.users.matricNumber,
      })
      .from(schema.users)
      .where(inArray(schema.users.id, studentIds));

    // 3. Fetch all attendance records for this course
    const records = await db
      .select({
        studentId: schema.attendance.studentId,
        status: schema.attendance.status
      })
      .from(schema.attendance)
      .where(eq(schema.attendance.courseId, courseId));

    // 4. Map stats per student
    const data = students.map(s => {
      const studentRecords = records.filter(r => Number(r.studentId) === Number(s.id));
      const totalClasses = studentRecords.length;
      const present = studentRecords.filter(r => r.status === 'present' || r.status === 'late').length;
      const absent = studentRecords.filter(r => r.status === 'absent').length;
      const rate = totalClasses > 0 ? Math.round((present / totalClasses) * 100) : 0;

      return { ...s, totalClasses, present, absent, rate };
    });

    return res.json({ success: true, data });

  } catch (err) {
    console.error('Error fetching course roster:', err);
    return next(err);
  }
});

// ============================================================
// GET /api/admin/attendance/student/:studentId/course/:courseId
// Returns day-by-day attendance for a specific student in a course
// ============================================================
router.get('/student/:studentId/course/:courseId', requireRole(STAFF), async (req, res, next) => {
  try {
    const studentId = Number(req.params.studentId);
    const courseId = Number(req.params.courseId);

    const records = await db
      .select({
        id: schema.attendance.id,
        date: schema.attendance.date,
        status: schema.attendance.status,
        remarks: schema.attendance.remarks,
      })
      .from(schema.attendance)
      .where(and(
        eq(schema.attendance.studentId, studentId),
        eq(schema.attendance.courseId, courseId)
      ))
      .orderBy(desc(schema.attendance.date));

    return res.json({ success: true, data: records });
  } catch (err) {
    console.error('Error fetching student attendance:', err);
    return next(err);
  }
});

module.exports = router;