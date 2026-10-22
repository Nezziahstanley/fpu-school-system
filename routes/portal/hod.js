// ============================================================
// FPU — HOD portal API
// Mounted at /api/hod
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries    = require('../../db/queries/users');
const courseQueries  = require('../../db/queries/courses');
const resultQueries  = require('../../db/queries/results');
const regQueries     = require('../../db/queries/registrations');
const ttQueries      = require('../../db/queries/timetable');
const notifQueries   = require('../../db/queries/notifications');
const sessionQueries = require('../../db/queries/sessions');
const { db, schema } = require('../../db');
const { eq, and, sql, desc } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');
const { logAudit } = require('../../utils/audit');

const { 
  users, courses, courseRegistrations, results, staffProfiles, 
  programmes, departments, courseAllocations, academicSessions
} = schema;

const only = requireRole('hod', 'admin');

function deptId(req) {
  const id = req.user.departmentId;
  if (!id) {
    const err = new Error('No department assigned to this HOD account.');
    err.status = 400;
    throw err;
  }
  return id;
}

// ============================================================
// GET /api/hod/dashboard
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const sessionId = req.user.currentSessionId || 1;

    const [dept] = await db.select().from(departments).where(eq(departments.id, departmentId)).limit(1);

    const studentRows = await db.select({
      id: users.id, level: users.level, gender: users.gender, programmeName: programmes.name,
    })
    .from(users)
    .leftJoin(programmes, eq(users.programmeId, programmes.id))
    .where(and(eq(users.departmentId, departmentId), eq(users.role, 'student')));

    const totalStudents = studentRows.length;
    const studentsByLevel = {};
    const studentsByProgramme = {};
    const studentsByGender = {};

    studentRows.forEach(s => {
      const lvl = s.level || 'Unknown';
      studentsByLevel[lvl] = (studentsByLevel[lvl] || 0) + 1;
      const prog = s.programmeName || 'Unknown';
      studentsByProgramme[prog] = (studentsByProgramme[prog] || 0) + 1;
      const g = s.gender || 'Unknown';
      studentsByGender[g] = (studentsByGender[g] || 0) + 1;
    });

    const staffRows = await db.select({ id: users.id })
      .from(users)
      .where(and(eq(users.departmentId, departmentId), sql`${users.role} IN ('lecturer', 'hod')`));
    const totalStaff = staffRows.length;

    const courseRows = await db.select({ id: courses.id })
      .from(courses)
      .where(eq(courses.departmentId, departmentId));
    const activeCourses = courseRows.length;
    const courseIds = courseRows.map(c => c.id);

    let pendingResults = 0, verifiedResults = 0, publishedResults = 0;
    if (courseIds.length > 0) {
      const resRows = await db.select({ status: results.status })
        .from(results)
        .where(sql`${results.courseId} IN ${courseIds}`);
      resRows.forEach(r => {
        if (r.status === 'draft') pendingResults++;
        if (r.status === 'submitted') verifiedResults++;
        if (r.status === 'published') publishedResults++;
      });
    }

    let registeredThisSession = 0;
    if (courseIds.length > 0) {
      const regs = await db.select({ id: courseRegistrations.id })
        .from(courseRegistrations)
        .where(and(
          sql`${courseRegistrations.courseId} IN ${courseIds}`,
          eq(courseRegistrations.sessionId, sessionId),
          eq(courseRegistrations.status, 'approved')
        ));
      registeredThisSession = regs.length;
    }

    return res.json({
      success: true,
      data: {
        departmentName: dept?.name || 'Department',
        totalStudents, totalStaff, activeCourses,
        pendingResults, verifiedResults, publishedResults,
        registeredThisSession, noRegistration: 0,
        studentsByLevel, studentsByProgramme, studentsByGender
      }
    });
  } catch (err) {
    console.error('[hod/dashboard] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/hod/pending-results
// ============================================================
router.get('/pending-results', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);

    const rows = await db
      .select({
        id: results.id,
        courseId: results.courseId,
        courseCode: courses.code,
        courseTitle: courses.title,
        level: courses.level,
        semester: results.semester,
        status: results.status,
        submittedAt: results.submittedAt,
        lecturerName: sql`${users.firstName} || ' ' || ${users.lastName}`,
        sessionName: academicSessions.name,
      })
      .from(results)
      .innerJoin(courses, eq(results.courseId, courses.id))
      .leftJoin(users, eq(results.submittedBy, users.id))
      .leftJoin(academicSessions, eq(results.sessionId, academicSessions.id))
      .where(and(
        eq(courses.departmentId, departmentId),
        eq(results.status, 'submitted')
      ))
      .orderBy(desc(results.submittedAt));

    const data = await Promise.all(rows.map(async (r) => {
      const studs = await db.select({ count: sql`count(*)::int` })
        .from(courseRegistrations)
        .where(and(
          eq(courseRegistrations.courseId, r.courseId),
          eq(courseRegistrations.status, 'approved')
        ));
      
      return {
        ...r,
        studentCount: studs[0]?.count || 0
      };
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[hod/pending-results] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/hod/pending-results/:id/verify
// ============================================================
router.post('/pending-results/:id/verify', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const result = await resultQueries.findById(req.params.id);
    if (!result) return res.status(404).json({ success: false, error: 'Result not found.' });

    const course = await courseQueries.findById(result.courseId);
    if (!course || Number(course.departmentId) !== Number(departmentId)) {
      return res.status(403).json({ success: false, error: 'Not in your department.' });
    }

    const row = await resultQueries.hodVerify(result.id, req.user.id);
    await logAudit({ req, action: 'hod.result_verify', entity: 'result', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/hod/pending-results/:id/reject
// ============================================================
router.post('/pending-results/:id/reject', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const result = await resultQueries.findById(req.params.id);
    if (!result) return res.status(404).json({ success: false, error: 'Result not found.' });

    const course = await courseQueries.findById(result.courseId);
    if (!course || Number(course.departmentId) !== Number(departmentId)) {
      return res.status(403).json({ success: false, error: 'Not in your department.' });
    }

    const row = await resultQueries.hodReject(result.id, req.user.id, req.body?.reason);
    await logAudit({ req, action: 'hod.result_reject', entity: 'result', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/hod/courses
// ============================================================
router.get('/courses', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const rows = await courseQueries.list({
      departmentId, level: req.query.level, semester: req.query.semester, limit: 1000,
    });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/hod/students
// ============================================================
router.get('/students', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const rows = await userQueries.listStudents({
      departmentId, programmeId: req.query.programmeId, level: req.query.level, sessionId: req.query.sessionId,
    });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/hod/staff
// ============================================================
router.get('/staff', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const rows = await userQueries.listStaff({ departmentId });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/hod/profile
// ============================================================
router.get('/profile', only, async (req, res, next) => {
  try {
    const user = await userQueries.findByIdWithRelations(req.user.id);
    return res.json({ success: true, data: user });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/hod/security
// ============================================================
router.get('/security', only, async (req, res, next) => {
  try {
    const sessions = await sessionQueries.listUserSessions(req.user.id);
    const logins = await require('../../db/queries/audit').listLogins({ userId: req.user.id, limit: 30 });
    return res.json({ success: true, sessions, logins });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/hod/lecturers
// ============================================================
router.get('/lecturers', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const rows = await userQueries.listStaff({ departmentId });
    const lecturers = (rows || []).filter(function (u) {
      return String(u.role || '').toLowerCase() === 'lecturer';
    });
    return res.json({ success: true, data: lecturers });
  } catch (err) { return next(err); }
});

module.exports = router;