// ============================================================
// FPU — Lecturer portal API
// Mounted at /api/lecturer
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries    = require('../../db/queries/users');
const courseQueries  = require('../../db/queries/courses');
const regQueries     = require('../../db/queries/registrations');
const resultQueries  = require('../../db/queries/results');
const ttQueries      = require('../../db/queries/timetable');
const attQueries     = require('../../db/queries/attendance');
const libQueries     = require('../../db/queries/library');
const notifQueries   = require('../../db/queries/notifications');
const sessionQueries = require('../../db/queries/sessions');
const { db, schema } = require('../../db');
const { eq, and, desc, inArray, sql } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');
const { logAudit } = require('../../utils/audit');
const { scoreToGrade, getActiveGradeScale } = require('../../utils/gradeScale');

const { 
  courseAllocations, courses, courseRegistrations, users, 
  academicSessions, results, courseMaterials, assignments, 
  departments, assignmentSubmissions, programmes, timetableSlots,
  attendance
} = schema;

const only = requireRole('lecturer', 'hod');

// ------------------------------------------------------------
// Helper: list the course IDs the current lecturer is allocated to
// ------------------------------------------------------------
async function getAllocatedCourseIds(userId, sessionId) {
  const allocations = await courseQueries.listAllocationsWithRelations({
    lecturerId: userId,
    sessionId,
  });
  return allocations.map((a) => a.course?.id).filter(Boolean);
}

// ============================================================
// GET /api/lecturer/dashboard
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    const lecturerId = req.user.id;
    const [currentSession] = await db.select().from(academicSessions).where(eq(academicSessions.isCurrent, true)).limit(1);

    const allocatedCourses = await db
      .select({ course: courses })
      .from(courseAllocations)
      .leftJoin(courses, eq(courseAllocations.courseId, courses.id))
      .where(eq(courseAllocations.lecturerId, lecturerId));

    const courseIds = allocatedCourses.map(c => c.course?.id).filter(Boolean);

    const courseStats = [];
    let uniqueStudentIds = new Set();
    let totalRegistrations = 0;

    for (const c of allocatedCourses) {
      if (!c.course) continue;
      const regs = await db
        .select({ studentId: courseRegistrations.studentId })
        .from(courseRegistrations)
        .where(and(eq(courseRegistrations.courseId, c.course.id), eq(courseRegistrations.status, 'approved')));
      
      regs.forEach(r => uniqueStudentIds.add(r.studentId));
      courseStats.push({ code: c.course.code, title: c.course.title, students: regs.length });
      totalRegistrations += regs.length;
    }
    const totalStudents = uniqueStudentIds.size;

    let pendingResults = 0;
    if (courseIds.length > 0) {
      const pend = await db.select({ count: sql`count(*)::int` }).from(results).where(and(inArray(results.courseId, courseIds), eq(results.status, 'draft')));
      pendingResults = pend[0]?.count || 0;
    }

    let materialsCount = 0, assignmentsCount = 0;
    if (courseIds.length > 0) {
      const mats = await db.select({ count: sql`count(*)::int` }).from(courseMaterials).where(inArray(courseMaterials.courseId, courseIds));
      materialsCount = mats[0]?.count || 0;
      const ass = await db.select({ count: sql`count(*)::int` }).from(assignments).where(inArray(assignments.courseId, courseIds));
      assignmentsCount = ass[0]?.count || 0;
    }

    const [dept] = await db.select({ name: departments.name }).from(users).leftJoin(departments, eq(users.departmentId, departments.id)).where(eq(users.id, lecturerId)).limit(1);

    return res.json({
      success: true,
      data: {
        coursesCount: allocatedCourses.length, totalStudents, totalRegistrations, pendingResults,
        activeSession: currentSession?.name || '—', materialsCount, assignmentsCount,
        departmentName: dept?.name || '—', coursesList: allocatedCourses.map(c => c.course).filter(Boolean), courseStats
      }
    });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/lecturer/courses
// Returns courses allocated to the lecturer
// ============================================================
router.get('/courses', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: courses.id,
        code: courses.code,
        title: courses.title,
        level: courses.level,
        unit: courses.unit,
        semesterName: courses.semesterName,
      })
      .from(courseAllocations)
      .leftJoin(courses, eq(courseAllocations.courseId, courses.id))
      .where(eq(courseAllocations.lecturerId, req.user.id));

    // Filter out any nulls just in case
    const data = rows.filter(r => r.id !== null);

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[lecturer/courses] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/lecturer/students-list
// ============================================================
router.get('/students-list', only, async (req, res, next) => {
  try {
    const allocations = await db.select({ courseId: courseAllocations.courseId }).from(courseAllocations).where(eq(courseAllocations.lecturerId, req.user.id));
    const courseIds = allocations.map(a => a.courseId).filter(Boolean);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const regs = await db.select({ studentId: courseRegistrations.studentId }).from(courseRegistrations).where(and(inArray(courseRegistrations.courseId, courseIds), eq(courseRegistrations.status, 'approved')));
    const studentIds = [...new Set(regs.map(r => r.studentId))];
    if (!studentIds.length) return res.json({ success: true, data: [] });

    const students = await db
      .select({
        id: users.id, matricNumber: users.matricNumber, firstName: users.firstName, lastName: users.lastName,
        level: users.level, email: users.email, programmeName: programmes.name, departmentName: departments.name
      })
      .from(users)
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(inArray(users.id, studentIds))
      .orderBy(users.lastName);

    return res.json({ success: true, data: students });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// GET /api/lecturer/attendance
// ============================================================
router.get('/attendance', only, async (req, res, next) => {
  try {
    const allocations = await db.select({ courseId: courseAllocations.courseId }).from(courseAllocations).where(eq(courseAllocations.lecturerId, req.user.id));
    const courseIds = allocations.map(a => a.courseId).filter(Boolean);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const rows = await db
      .select({
        id: attendance.id, date: attendance.date, status: attendance.status,
        studentFirstName: users.firstName, studentLastName: users.lastName,
        matricNumber: users.matricNumber, courseCode: courses.code, courseTitle: courses.title,
      })
      .from(attendance)
      .leftJoin(users, eq(attendance.studentId, users.id))
      .leftJoin(courses, eq(attendance.courseId, courses.id))
      .where(inArray(attendance.courseId, courseIds))
      .orderBy(desc(attendance.date))
      .limit(500);

    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// GET /api/lecturer/results
// ============================================================
router.get('/results', only, async (req, res, next) => {
  try {
    const allocations = await db.select({ courseId: courseAllocations.courseId }).from(courseAllocations).where(eq(courseAllocations.lecturerId, req.user.id));
    const courseIds = allocations.map(a => a.courseId).filter(Boolean);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const rows = await db
      .select({
        id: results.id, score: results.score, grade: results.grade, points: results.points, status: results.status,
        studentFirstName: users.firstName, studentLastName: users.lastName, matricNumber: users.matricNumber,
        courseCode: courses.code, courseTitle: courses.title,
      })
      .from(results)
      .leftJoin(users, eq(results.studentId, users.id))
      .leftJoin(courses, eq(results.courseId, courses.id))
      .where(inArray(results.courseId, courseIds))
      .orderBy(users.lastName, courses.code)
      .limit(2000);

    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// GET /api/lecturer/materials
// ============================================================
router.get('/materials', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: courseMaterials.id, title: courseMaterials.title, description: courseMaterials.description,
        fileUrl: courseMaterials.fileUrl, materialType: courseMaterials.materialType, createdAt: courseMaterials.createdAt,
        courseCode: courses.code,
      })
      .from(courseMaterials)
      .leftJoin(courses, eq(courseMaterials.courseId, courses.id))
      .where(eq(courseMaterials.lecturerId, req.user.id))
      .orderBy(desc(courseMaterials.createdAt));
    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// GET /api/lecturer/assignments
// ============================================================
router.get('/assignments', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: assignments.id, title: assignments.title, description: assignments.description,
        dueDate: assignments.dueDate, maxScore: assignments.maxScore, createdAt: assignments.createdAt,
        courseCode: courses.code,
      })
      .from(assignments)
      .leftJoin(courses, eq(assignments.courseId, courses.id))
      .where(eq(assignments.lecturerId, req.user.id))
      .orderBy(desc(assignments.createdAt));
    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// GET /api/lecturer/requests
// ============================================================
router.get('/requests', only, async (req, res, next) => {
  try {
    const rows = await notifQueries.listComplaints({ userId: req.user.id });
    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// GET /api/lecturer/reports
// ============================================================
router.get('/reports', only, async (req, res, next) => {
  try {
    const sessionId = req.user.currentSessionId;
    const allocations = await courseQueries.listAllocationsWithRelations({ lecturerId: req.user.id, sessionId });
    const courseIds = allocations.map((a) => a.course?.id).filter(Boolean);

    const resultRows = courseIds.length ? await resultQueries.list({ sessionId, limit: 5000 }) : [];
    const myResults = resultRows.filter((r) => courseIds.includes(r.courseId));

    const summary = {
      totalCourses: allocations.length,
      totalResultRows: myResults.length,
      byStatus: myResults.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {}),
    };
    return res.json({ success: true, data: { allocations, summary } });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// GET /api/lecturer/timetable
// ============================================================
router.get('/timetable', only, async (req, res, next) => {
  try {
    const allocations = await db.select({ courseId: courseAllocations.courseId }).from(courseAllocations).where(eq(courseAllocations.lecturerId, req.user.id));
    const courseIds = allocations.map(a => a.courseId).filter(Boolean);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const slots = await db
      .select({
        id: timetableSlots.id, dayOfWeek: timetableSlots.dayOfWeek, startTime: timetableSlots.startTime,
        endTime: timetableSlots.endTime, venue: timetableSlots.venue, semester: timetableSlots.semester,
        courseCode: courses.code, courseTitle: courses.title, level: courses.level,
      })
      .from(timetableSlots)
      .leftJoin(courses, eq(timetableSlots.courseId, courses.id))
      .where(inArray(timetableSlots.courseId, courseIds))
      .orderBy(timetableSlots.dayOfWeek, timetableSlots.startTime);

    return res.json({ success: true, data: slots });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// GET /api/lecturer/profile
// ============================================================
router.get('/profile', only, async (req, res, next) => {
  try { return res.json({ success: true, data: await userQueries.findByIdWithRelations(req.user.id) }); }
  catch (err) { return next(err); }
});

// ============================================================
// GET /api/lecturer/security
// ============================================================
router.get('/security', only, async (req, res, next) => {
  try {
    const sessions = await sessionQueries.listUserSessions(req.user.id);
    const logins = await require('../../db/queries/audit').listLogins({ userId: req.user.id, limit: 30 });
    return res.json({ success: true, sessions, logins });
  } catch (err) { return next(err); }
});

module.exports = router;