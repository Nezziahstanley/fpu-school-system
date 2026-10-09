// ============================================================
// FPU — Academic Officer portal API
// Mounted at /api/academic-officer
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries = require('../../db/queries/users');
const sessionQueries = require('../../db/queries/sessions');
const courseQueries = require('../../db/queries/courses');
const resultQueries = require('../../db/queries/results');
const regQueries = require('../../db/queries/registrations');
const { db, schema, sql } = require('../../db');
const { eq, and, inArray, desc } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');
const { computeStudentCGPA, classifyDegree } = require('../../utils/gpa');

const {
  programmes, courses, departments, schools, results,
  graduations, users, academicSessions,
} = schema;

const only = requireRole('academic_officer', 'admin');

// ============================================================
// GET /api/academic-officer/dashboard
// ------------------------------------------------------------
// Returns all the stats the dashboard needs in one call.
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    // Row counts
    const [progCount]   = await db.select({ c: sql`count(*)::int` }).from(programmes);
    const [courseCount] = await db.select({ c: sql`count(*)::int` }).from(courses);
    const [deptCount]   = await db.select({ c: sql`count(*)::int` }).from(departments);
    const [schoolCount] = await db.select({ c: sql`count(*)::int` }).from(schools);
    const [studentCount]= await db.select({ c: sql`count(*)::int` }).from(users).where(eq(users.role, 'student'));
    const [publishedCount] = await db.select({ c: sql`count(*)::int` }).from(results).where(eq(results.status, 'published'));
    const [pendingResults] = await db.select({ c: sql`count(*)::int` }).from(results).where(inArray(results.status, ['submitted','hod_verified']));
    const [queuedGrads]    = await db.select({ c: sql`count(*)::int` }).from(graduations).where(eq(graduations.status, 'pending'));

    // Programmes by level
    const progByLevel = await db
      .select({ level: programmes.level, c: sql`count(*)::int` })
      .from(programmes)
      .groupBy(programmes.level);

    // Courses by semester (name may be 'First' / 'Second')
    const coursesBySem = await db
      .select({ semester: courses.semesterName, c: sql`count(*)::int` })
      .from(courses)
      .groupBy(courses.semesterName);

    // Courses by department (top 6)
    const coursesByDept = await db
      .select({
        departmentId: courses.departmentId,
        departmentName: departments.name,
        departmentCode: departments.code,
        c: sql`count(*)::int`,
      })
      .from(courses)
      .leftJoin(departments, eq(courses.departmentId, departments.id))
      .groupBy(courses.departmentId, departments.name, departments.code)
      .orderBy(desc(sql`count(*)`))
      .limit(6);

    // Recent published results
    const recentResults = await db
      .select({
        resultId: results.id,
        studentId: results.studentId,
        courseId: results.courseId,
        grade: results.grade,
        score: results.score,
        publishedAt: results.publishedAt,
        sessionId: results.sessionId,
        semester: results.semester,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentMatric: users.matricNumber,
        courseCode: courses.code,
        courseTitle: courses.title,
      })
      .from(results)
      .leftJoin(users, eq(results.studentId, users.id))
      .leftJoin(courses, eq(results.courseId, courses.id))
      .where(eq(results.status, 'published'))
      .orderBy(desc(results.publishedAt))
      .limit(10);

    return res.json({
      success: true,
      data: {
        programmes: progCount.c,
        courses: courseCount.c,
        departments: deptCount.c,
        schools: schoolCount.c,
        students: studentCount.c,
        resultsPublished: publishedCount.c,
        pendingResults: pendingResults.c,
        queuedGraduations: queuedGrads.c,
        byLevel: progByLevel.reduce((a, r) => ({ ...a, [r.level]: r.c }), {}),
        bySemester: coursesBySem.reduce((a, r) => ({ ...a, [r.semester || 'Unspecified']: r.c }), {}),
        topDepartments: coursesByDept,
        recentResults: recentResults.map((r) => ({
          id: r.resultId,
          studentName: `${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim(),
          studentMatric: r.studentMatric,
          courseCode: r.courseCode,
          courseTitle: r.courseTitle,
          grade: r.grade,
          score: r.score,
          semester: r.semester,
          publishedAt: r.publishedAt,
        })),
        currentSession: await sessionQueries.getCurrentAcademic(),
      },
    });
  } catch (err) {
    console.error('[academic-officer/dashboard]', err);
    return next(err);
  }
});

// ============================================================
// GET /api/academic-officer/sessions
// ============================================================
router.get('/sessions', only, async (req, res, next) => {
  try { return res.json({ success: true, data: await sessionQueries.listAcademic() }); }
  catch (err) { return next(err); }
});

// ============================================================
// GET /api/academic-officer/programmes
// ============================================================
router.get('/programmes', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: programmes.id,
        code: programmes.code,
        name: programmes.name,
        level: programmes.level,
        durationYears: programmes.durationYears,
        departmentId: programmes.departmentId,
        departmentName: departments.name,
        departmentCode: departments.code,
        createdAt: programmes.createdAt,
      })
      .from(programmes)
      .leftJoin(departments, eq(programmes.departmentId, departments.id))
      .orderBy(programmes.code);
    return res.json({ success: true, data: rows, total: rows.length });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/academic-officer/courses
// ============================================================
router.get('/courses', only, async (req, res, next) => {
  try {
    const { programmeId, departmentId, level, semester, search } = req.query;

    const conds = [];
    if (programmeId) conds.push(eq(courses.programmeId, Number(programmeId)));
    if (departmentId) conds.push(eq(courses.departmentId, Number(departmentId)));
    if (level) conds.push(eq(courses.level, level));
    if (semester) conds.push(eq(courses.semesterName, semester));
    if (search) {
      const like = `%${String(search).trim()}%`;
      conds.push(sql`(${courses.code} ILIKE ${like} OR ${courses.title} ILIKE ${like})`);
    }
    const where = conds.length ? and(...conds) : undefined;

    const rows = await db
      .select({
        id: courses.id,
        code: courses.code,
        title: courses.title,
        unit: courses.unit,
        level: courses.level,
        semesterName: courses.semesterName,
        yearOfStudy: courses.yearOfStudy,
        programmeId: courses.programmeId,
        departmentId: courses.departmentId,
        departmentName: departments.name,
        isElective: courses.isElective,
        isActive: courses.isActive,
      })
      .from(courses)
      .leftJoin(departments, eq(courses.departmentId, departments.id))
      .where(where)
      .orderBy(courses.code)
      .limit(1000);

    return res.json({ success: true, data: rows, total: rows.length });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/academic-officer/departments
// ============================================================
router.get('/departments', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: departments.id,
        code: departments.code,
        name: departments.name,
        schoolId: departments.schoolId,
        schoolName: schools.name,
      })
      .from(departments)
      .leftJoin(schools, eq(departments.schoolId, schools.id))
      .orderBy(departments.name);
    return res.json({ success: true, data: rows, total: rows.length });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/academic-officer/results  (recent published)
// ============================================================
router.get('/results', only, async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const conds = [eq(results.status, 'published')];
    if (req.query.sessionId) conds.push(eq(results.sessionId, Number(req.query.sessionId)));
    if (req.query.semester) conds.push(eq(results.semester, req.query.semester));

    const rows = await db
      .select({
        resultId: results.id,
        studentId: results.studentId,
        courseId: results.courseId,
        grade: results.grade,
        score: results.score,
        publishedAt: results.publishedAt,
        sessionId: results.sessionId,
        semester: results.semester,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentMatric: users.matricNumber,
        courseCode: courses.code,
        courseTitle: courses.title,
      })
      .from(results)
      .leftJoin(users, eq(results.studentId, users.id))
      .leftJoin(courses, eq(results.courseId, courses.id))
      .where(and(...conds))
      .orderBy(desc(results.publishedAt))
      .limit(limit);

    return res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.resultId,
        studentName: `${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim(),
        studentMatric: r.studentMatric,
        courseCode: r.courseCode,
        courseTitle: r.courseTitle,
        grade: r.grade,
        score: r.score,
        semester: r.semester,
        publishedAt: r.publishedAt,
      })),
      total: rows.length,
    });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/academic-officer/transcripts
// ============================================================
router.get('/transcripts', only, async (req, res, next) => {
  try {
    const { studentId } = req.query;
    if (!studentId) return res.status(400).json({ success: false, error: 'studentId is required.' });
    const rows = await resultQueries.publishedForStudent(studentId, {});
    const summary = computeStudentCGPA(
      rows.map((r) => ({
        unit: Number(r.course?.unit) || 0,
        points: Number(r.result?.points) || 0,
        sessionId: r.result?.sessionId,
        semester: r.result?.semester,
      }))
    );
    const student = await userQueries.findByIdWithRelations(studentId);
    return res.json({
      success: true,
      student,
      summary: { ...summary, classification: classifyDegree(summary.cgpa) },
      rows,
    });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/academic-officer/graduation
// ============================================================
router.get('/graduation', only, async (req, res, next) => {
  try {
    const conds = [];
    if (req.query.status) conds.push(eq(graduations.status, req.query.status));
    const where = conds.length ? and(...conds) : undefined;

    const rows = await db
      .select({ graduation: graduations, student: users })
      .from(graduations)
      .leftJoin(users, eq(graduations.studentId, users.id))
      .where(where)
      .orderBy(desc(graduations.createdAt));
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/academic-officer/reports
// ============================================================
router.get('/reports', only, async (req, res, next) => {
  try {
    const regs = await db
      .select({ status: schema.courseRegistrations.status, count: sql`count(*)::int` })
      .from(schema.courseRegistrations)
      .groupBy(schema.courseRegistrations.status);
    const resu = await db
      .select({ status: results.status, count: sql`count(*)::int` })
      .from(results)
      .groupBy(results.status);
    const grads = await db
      .select({ status: graduations.status, count: sql`count(*)::int` })
      .from(graduations)
      .groupBy(graduations.status);
    return res.json({ success: true, data: { registrations: regs, results: resu, graduations: grads } });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/academic-officer/profile, /security
// ============================================================
router.get('/profile', only, async (req, res, next) => {
  try { return res.json({ success: true, data: await userQueries.findByIdWithRelations(req.user.id) }); }
  catch (err) { return next(err); }
});

router.get('/security', only, async (req, res, next) => {
  try {
    const sessions = await sessionQueries.listUserSessions(req.user.id);
    const logins = await require('../../db/queries/audit').listLogins({ userId: req.user.id, limit: 30 });
    return res.json({ success: true, sessions, logins });
  } catch (err) { return next(err); }
});

module.exports = router;