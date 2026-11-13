'use strict';

const express = require('express');
const router = express.Router();
const { db, schema, sql } = require('../db');
const { eq, and, or, ilike, desc, inArray } = require('drizzle-orm');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const STAFF = ['admin', 'registrar', 'hod', 'lecturer', 'academic_officer'];

async function resolveAttendanceSession(requestedSessionId) {
  if (requestedSessionId) {
    const id = Number(requestedSessionId);
    if (!Number.isInteger(id) || id <= 0) throw Object.assign(new Error('Invalid academic session.'), { status: 400 });
    return id;
  }
  const [current] = await db.select({ id: schema.academicSessions.id })
    .from(schema.academicSessions)
    .where(eq(schema.academicSessions.isCurrent, true)).limit(1);
  if (current) return Number(current.id);
  const [latest] = await db.select({ id: schema.academicSessions.id })
    .from(schema.academicSessions).orderBy(desc(schema.academicSessions.id)).limit(1);
  return latest ? Number(latest.id) : null;
}


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
      if (currentSession) {
        selectedSessionId = Number(currentSession.id);
      } else {
        const [latestSession] = await db
          .select({ id: schema.academicSessions.id })
          .from(schema.academicSessions)
          .orderBy(desc(schema.academicSessions.id))
          .limit(1);
        selectedSessionId = latestSession ? Number(latestSession.id) : null;
      }
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
        courses: sql`COUNT(DISTINCT ${schema.courses.id})`,
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

    // School totals are calculated independently so students are distinct across
    // the entire school (rather than summing department-level student counts).
    const schoolStats = await db
      .select({
        id: schema.schools.id,
        name: schema.schools.name,
        departments: sql`COUNT(DISTINCT ${schema.departments.id})`,
        courses: sql`COUNT(DISTINCT ${schema.courses.id})`,
        students: sql`COUNT(DISTINCT ${schema.attendance.studentId})`,
        records: sql`COUNT(${schema.attendance.id})`,
        present: sql`COUNT(CASE WHEN ${schema.attendance.status} = 'present' THEN 1 END)`,
        late: sql`COUNT(CASE WHEN ${schema.attendance.status} = 'late' THEN 1 END)`
      })
      .from(schema.schools)
      .leftJoin(schema.departments, eq(schema.departments.schoolId, schema.schools.id))
      .leftJoin(schema.courses, eq(schema.courses.departmentId, schema.departments.id))
      .leftJoin(schema.attendance, and(eq(schema.attendance.courseId, schema.courses.id), attendanceWhere))
      .where(departmentWhere)
      .groupBy(schema.schools.id, schema.schools.name)
      .orderBy(schema.schools.name);

    const formattedSchools = schoolStats.map(row => {
      const records = Number(row.records) || 0;
      const present = Number(row.present) || 0;
      const late = Number(row.late) || 0;
      return {
        ...row,
        departments: Number(row.departments) || 0,
        courses: Number(row.courses) || 0,
        students: Number(row.students) || 0,
        records,
        rate: records ? Math.round(((present + late) / records) * 100) : 0
      };
    });

    const formatted = stats.map(row => {
      const recs = Number(row.records) || 0;
      const p = Number(row.present) || 0;
      const l = Number(row.late) || 0;
      return {
        ...row,
        courses: Number(row.courses) || 0,
        students: Number(row.students) || 0,
        records: recs,
        rate: recs > 0 ? Math.round(((p + l) / recs) * 100) : 0
      };
    });

    return res.json({ success: true, sessionId: selectedSessionId, schools: formattedSchools, data: formatted });
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

    const selectedSessionId = await resolveAttendanceSession(sessionId);

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

    const summaryConditions = [...conditions, ...attendanceConditions];
    const [summaryRow] = await db
      .select({
        students: sql`COUNT(DISTINCT ${schema.attendance.studentId})`,
        records: sql`COUNT(${schema.attendance.id})`,
        present: sql`COUNT(CASE WHEN ${schema.attendance.status} = 'present' THEN 1 END)`,
        late: sql`COUNT(CASE WHEN ${schema.attendance.status} = 'late' THEN 1 END)`
      })
      .from(schema.attendance)
      .innerJoin(schema.courses, eq(schema.attendance.courseId, schema.courses.id))
      .where(and(...summaryConditions));
    const summaryRecords = Number(summaryRow?.records) || 0;
    const summaryPresent = Number(summaryRow?.present) || 0;
    const summaryLate = Number(summaryRow?.late) || 0;
    const summary = {
      students: Number(summaryRow?.students) || 0,
      records: summaryRecords,
      rate: summaryRecords ? Math.round(((summaryPresent + summaryLate) / summaryRecords) * 100) : 0
    };

    return res.json({ success: true, sessionId: selectedSessionId, summary, data });
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
    if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).json({ success: false, error: 'A valid course is required.' });
    const { status, from, to, search, sessionId, semester } = req.query;
    const selectedSessionId = await resolveAttendanceSession(sessionId);
    const attendanceConds = [eq(schema.attendance.courseId, courseId)];
    if (selectedSessionId) attendanceConds.push(eq(schema.attendance.sessionId, selectedSessionId));
    if (semester) attendanceConds.push(eq(schema.attendance.semester, String(semester)));
    if (status) attendanceConds.push(eq(schema.attendance.status, String(status)));
    if (from) attendanceConds.push(sql`${schema.attendance.date} >= ${from}`);
    if (to) attendanceConds.push(sql`${schema.attendance.date} <= ${to}`);
    const studentConds = [eq(schema.courseRegistrations.courseId, courseId)];
    if (selectedSessionId) studentConds.push(eq(schema.courseRegistrations.sessionId, selectedSessionId));
    if (semester) studentConds.push(eq(schema.courseRegistrations.semester, String(semester)));
    if (search) studentConds.push(or(
      ilike(schema.users.matricNumber, `%${search}%`),
      ilike(schema.users.firstName, `%${search}%`),
      ilike(schema.users.lastName, `%${search}%`)
    ));

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
      .from(schema.courseRegistrations)
      .innerJoin(schema.users, eq(schema.courseRegistrations.studentId, schema.users.id))
      .leftJoin(schema.attendance, and(
        ...attendanceConds,
        eq(schema.attendance.studentId, schema.users.id)
      ))
      .where(and(...studentConds))
      .groupBy(schema.users.id, schema.users.matricNumber, schema.users.firstName, schema.users.lastName, schema.users.level)
      .orderBy(schema.users.matricNumber);

    const formatted = roster.map(row => {
      const total = Number(row.totalClasses) || 0;
      const p = Number(row.present) || 0;
      const l = Number(row.late) || 0;
      return {
        ...row,
        totalClasses: total,
        present: p,
        absent: Number(row.absent) || 0,
        late: l,
        excused: Number(row.excused) || 0,
        rate: total ? Math.round(((p + l) / total) * 100) : 0
      };
    });
    const [dayRow] = await db
      .select({ classDays: sql`COUNT(DISTINCT ${schema.attendance.date})` })
      .from(schema.attendance)
      .where(and(...attendanceConds));
    return res.json({ success: true, sessionId: selectedSessionId, classDays: Number(dayRow?.classDays) || 0, data: formatted });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/admin/attendance/course/:courseId/students
// Returns the roster of students registered for a specific course
// ============================================================
// ============================================================
// POST /api/admin/attendance/course/:courseId/mark
// Create or update one attendance register for a course/date.
// ============================================================
router.post('/course/:courseId/mark', requireRole(['admin', 'registrar', 'academic_officer', 'hod', 'lecturer']), async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const sessionId = Number(req.body?.sessionId);
    const semester = String(req.body?.semester || '').toLowerCase();
    const date = String(req.body?.date || '');
    const records = Array.isArray(req.body?.records) ? req.body.records : [];
    const validStatuses = ['present', 'absent', 'late', 'excused'];

    if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).json({ success: false, error: 'A valid course is required.' });
    if (!Number.isInteger(sessionId) || sessionId <= 0) return res.status(400).json({ success: false, error: 'Select an academic session.' });
    if (!['first', 'second'].includes(semester)) return res.status(400).json({ success: false, error: 'Select a valid semester.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return res.status(400).json({ success: false, error: 'Enter a valid attendance date.' });
    if (!records.length || records.length > 500) return res.status(400).json({ success: false, error: 'Select attendance status for at least one student (maximum 500 per register).' });

    const [course] = await db.select({ id: schema.courses.id, departmentId: schema.courses.departmentId })
      .from(schema.courses).where(eq(schema.courses.id, courseId)).limit(1);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found.' });

    const [session] = await db.select({ id: schema.academicSessions.id })
      .from(schema.academicSessions).where(eq(schema.academicSessions.id, sessionId)).limit(1);
    if (!session) return res.status(404).json({ success: false, error: 'Academic session not found.' });

    if (req.user?.role === 'hod' && Number(req.user.departmentId) !== Number(course.departmentId)) {
      return res.status(403).json({ success: false, error: 'You can only mark attendance for courses in your assigned department.' });
    }
    if (req.user?.role === 'lecturer') {
      const [allocation] = await db.select({ id: schema.courseAllocations.id })
        .from(schema.courseAllocations)
        .where(and(
          eq(schema.courseAllocations.courseId, courseId),
          eq(schema.courseAllocations.lecturerId, Number(req.user.id)),
          eq(schema.courseAllocations.sessionId, sessionId),
          eq(schema.courseAllocations.semester, semester),
          inArray(schema.courseAllocations.status, ['assigned', 'accepted'])
        )).limit(1);
      if (!allocation) return res.status(403).json({ success: false, error: 'You are not assigned to this course for the selected session and semester.' });
    }

    const normalized = [];
    const seen = new Set();
    for (const item of records) {
      const studentId = Number(item?.studentId);
      const status = String(item?.status || '').toLowerCase();
      if (!Number.isInteger(studentId) || studentId <= 0) return res.status(400).json({ success: false, error: 'An attendance row contains an invalid student.' });
      if (seen.has(studentId)) return res.status(400).json({ success: false, error: 'A student appears more than once in this attendance register.' });
      if (!validStatuses.includes(status)) return res.status(400).json({ success: false, error: 'Choose Present, Absent, Late or Excused for every student.' });
      seen.add(studentId);
      normalized.push({ studentId, status, remarks: String(item?.remarks || '').trim().slice(0, 1000) || null });
    }

    const registrations = await db.select({ studentId: schema.courseRegistrations.studentId })
      .from(schema.courseRegistrations)
      .where(and(
        eq(schema.courseRegistrations.courseId, courseId),
        eq(schema.courseRegistrations.sessionId, sessionId),
        eq(schema.courseRegistrations.semester, semester),
        eq(schema.courseRegistrations.status, 'approved'),
        inArray(schema.courseRegistrations.studentId, normalized.map(item => item.studentId))
      ));
    const registeredIds = new Set(registrations.map(row => Number(row.studentId)));
    const unregistered = normalized.filter(item => !registeredIds.has(item.studentId));
    if (unregistered.length) {
      return res.status(400).json({ success: false, error: 'Some selected students are not approved course registrants for this session and semester.', invalidStudentIds: unregistered.map(item => item.studentId) });
    }

    const saved = await db.transaction(async tx => {
      const rows = [];
      for (const item of normalized) {
        const [row] = await tx.insert(schema.attendance).values({
          courseId,
          studentId: item.studentId,
          lecturerId: Number(req.user.id),
          sessionId,
          semester,
          date,
          status: item.status,
          remarks: item.remarks
        }).onConflictDoUpdate({
          target: [schema.attendance.courseId, schema.attendance.studentId, schema.attendance.date],
          set: {
            lecturerId: Number(req.user.id),
            sessionId,
            semester,
            status: item.status,
            remarks: item.remarks
          }
        }).returning();
        rows.push(row);
      }
      return rows;
    });

    await logAudit({
      req,
      action: 'attendance.mark',
      entity: 'attendance_register',
      entityId: courseId,
      after: { courseId, sessionId, semester, date, recordCount: saved.length }
    });
    return res.json({ success: true, message: `Attendance saved for ${saved.length} student(s).`, count: saved.length });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/admin/attendance/course/:courseId/students
// Registered student roster, scoped to session/semester and date.
// ============================================================
router.get('/course/:courseId/students', requireRole(STAFF), async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).json({ success: false, error: 'A valid course is required.' });
    const sessionId = await resolveAttendanceSession(req.query.sessionId);
    const semester = req.query.semester ? String(req.query.semester) : '';
    const date = req.query.date ? String(req.query.date) : '';

    const registrationConditions = [
      eq(schema.courseRegistrations.courseId, courseId),
      eq(schema.courseRegistrations.status, 'approved')
    ];
    if (sessionId) registrationConditions.push(eq(schema.courseRegistrations.sessionId, sessionId));
    if (semester) registrationConditions.push(eq(schema.courseRegistrations.semester, semester));

    const registrations = await db.select({ studentId: schema.courseRegistrations.studentId })
      .from(schema.courseRegistrations).where(and(...registrationConditions));
    const studentIds = [...new Set(registrations.map(r => Number(r.studentId)))];
    if (!studentIds.length) return res.json({ success: true, sessionId, data: [] });

    const students = await db.select({
      id: schema.users.id,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      matricNumber: schema.users.matricNumber,
      level: schema.users.level
    }).from(schema.users).where(inArray(schema.users.id, studentIds));

    const recordConditions = [
      eq(schema.attendance.courseId, courseId),
      inArray(schema.attendance.studentId, studentIds)
    ];
    if (sessionId) recordConditions.push(eq(schema.attendance.sessionId, sessionId));
    if (semester) recordConditions.push(eq(schema.attendance.semester, semester));
    const attendanceRows = await db.select({
      studentId: schema.attendance.studentId,
      date: schema.attendance.date,
      status: schema.attendance.status,
      remarks: schema.attendance.remarks
    }).from(schema.attendance).where(and(...recordConditions));

    const data = students.map(student => {
      const rows = attendanceRows.filter(row => Number(row.studentId) === Number(student.id));
      const totalClasses = rows.length;
      const present = rows.filter(row => row.status === 'present').length;
      const late = rows.filter(row => row.status === 'late').length;
      const absent = rows.filter(row => row.status === 'absent').length;
      const excused = rows.filter(row => row.status === 'excused').length;
      const today = date ? rows.find(row => String(row.date).slice(0, 10) === date) : null;
      return {
        ...student,
        totalClasses,
        present,
        late,
        absent,
        excused,
        rate: totalClasses ? Math.round(((present + late) / totalClasses) * 100) : 0,
        todayStatus: today?.status || '',
        todayRemarks: today?.remarks || ''
      };
    }).sort((a, b) => String(a.matricNumber || '').localeCompare(String(b.matricNumber || '')));

    return res.json({ success: true, sessionId, data });
  } catch (err) {
    return next(err);
  }
});

router.get('/student/:studentId/course/:courseId', requireRole(STAFF), async (req, res, next) => {
  try {
    const studentId = Number(req.params.studentId);
    const courseId = Number(req.params.courseId);
    const selectedSessionId = await resolveAttendanceSession(req.query.sessionId);
    const conditions = [eq(schema.attendance.studentId, studentId), eq(schema.attendance.courseId, courseId)];
    if (selectedSessionId) conditions.push(eq(schema.attendance.sessionId, selectedSessionId));
    if (req.query.semester) conditions.push(eq(schema.attendance.semester, String(req.query.semester)));

    const records = await db
      .select({
        id: schema.attendance.id,
        date: schema.attendance.date,
        status: schema.attendance.status,
        remarks: schema.attendance.remarks,
      })
      .from(schema.attendance)
      .where(and(...conditions))
      .orderBy(desc(schema.attendance.date));

    return res.json({ success: true, sessionId: selectedSessionId, data: records });
  } catch (err) {
    console.error('Error fetching student attendance:', err);
    return next(err);
  }
});

module.exports = router;