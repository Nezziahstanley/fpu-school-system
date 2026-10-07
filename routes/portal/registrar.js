// ============================================================
// FPU — Registrar portal API
// Mounted at /api/registrar
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries = require('../../db/queries/users');
const sessionQueries = require('../../db/queries/sessions');
const courseQueries = require('../../db/queries/courses');
const resultQueries = require('../../db/queries/results');
const notifQueries = require('../../db/queries/notifications');
const { db, schema, sql } = require('../../db');
const { eq, and, desc, inArray } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');
const { computeStudentCGPA, classifyDegree } = require('../../utils/gpa');

const { documents, graduations, users } = schema;
const only = requireRole('registrar', 'admin');

// ============================================================
// GET /api/registrar/dashboard
// ============================================================
router.get('/dashboard', only, async (_req, res, next) => {
  try {
    const [students] = await db.select({ c: sql`count(*)::int` }).from(users).where(eq(users.role, 'student'));
    const [pendingDocs] = await db.select({ c: sql`count(*)::int` }).from(documents).where(eq(documents.status, 'pending'));
    const [queuedGrads] = await db.select({ c: sql`count(*)::int` }).from(graduations).where(eq(graduations.status, 'pending'));
    return res.json({
      success: true,
      data: {
        students: students.c,
        pendingDocuments: pendingDocs.c,
        queuedGraduations: queuedGrads.c,
        currentSession: await sessionQueries.getCurrentAcademic(),
      },
    });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/students
// ============================================================
router.get('/students', only, async (req, res, next) => {
  try {
    const rows = await userQueries.listStudents({
      departmentId: req.query.departmentId,
      programmeId: req.query.programmeId,
      level: req.query.level,
    });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/sessions, /programmes
// ============================================================
router.get('/sessions', only, async (_req, res, next) => {
  try { return res.json({ success: true, data: await sessionQueries.listAcademic() }); }
  catch (err) { return next(err); }
});

router.get('/programmes', only, async (_req, res, next) => {
  try { return res.json({ success: true, data: await courseQueries.listProgrammes({}) }); }
  catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/transcripts
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
// GET /api/registrar/documents
// ============================================================
router.get('/documents', only, async (req, res, next) => {
  try {
    const conds = [];
    if (req.query.status) conds.push(eq(documents.status, req.query.status));
    const where = conds.length ? and(...conds) : undefined;
    const rows = await db
      .select({ document: documents, user: users })
      .from(documents)
      .leftJoin(users, eq(documents.userId, users.id))
      .where(where)
      .orderBy(desc(documents.requestedAt));
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/graduation
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
// GET /api/registrar/profile, /security
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