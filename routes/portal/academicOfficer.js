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
const { eq, inArray } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');
const { computeStudentCGPA, classifyDegree } = require('../../utils/gpa');

const { graduations, users } = schema;
const only = requireRole('academic_officer', 'admin');

// ============================================================
// GET /api/academic-officer/dashboard
// ============================================================
router.get('/dashboard', only, async (_req, res, next) => {
  try {
    const [students] = await db.select({ c: sql`count(*)::int` }).from(users).where(eq(users.role, 'student'));
    const [queuedGrads] = await db.select({ c: sql`count(*)::int` }).from(graduations).where(eq(graduations.status, 'pending'));
    const [pendingResults] = await db.select({ c: sql`count(*)::int` }).from(schema.results).where(inArray(schema.results.status, ['submitted','hod_verified']));
    return res.json({
      success: true,
      data: {
        students: students.c,
        queuedGraduations: queuedGrads.c,
        pendingResults: pendingResults.c,
        currentSession: await sessionQueries.getCurrentAcademic(),
      },
    });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/academic-officer/sessions, /programmes, /courses
// ============================================================
router.get('/sessions', only, async (_req, res, next) => {
  try { return res.json({ success: true, data: await sessionQueries.listAcademic() }); }
  catch (err) { return next(err); }
});

router.get('/programmes', only, async (_req, res, next) => {
  try { return res.json({ success: true, data: await courseQueries.listProgrammes({}) }); }
  catch (err) { return next(err); }
});

router.get('/courses', only, async (req, res, next) => {
  try {
    const rows = await courseQueries.list({
      programmeId: req.query.programmeId,
      departmentId: req.query.departmentId,
      level: req.query.level,
      semester: req.query.semester,
      limit: 1000,
    });
    return res.json({ success: true, data: rows });
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
    const where = conds.length ? require('drizzle-orm').and(...conds) : undefined;
    const rows = await db
      .select({ graduation: graduations, student: users })
      .from(graduations)
      .leftJoin(users, eq(graduations.studentId, users.id))
      .where(where)
      .orderBy(require('drizzle-orm').desc(graduations.createdAt));
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/academic-officer/reports
// ============================================================
router.get('/reports', only, async (_req, res, next) => {
  try {
    const regs = await db
      .select({ status: schema.courseRegistrations.status, count: sql`count(*)::int` })
      .from(schema.courseRegistrations)
      .groupBy(schema.courseRegistrations.status);
    const resu = await db
      .select({ status: schema.results.status, count: sql`count(*)::int` })
      .from(schema.results)
      .groupBy(schema.results.status);
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