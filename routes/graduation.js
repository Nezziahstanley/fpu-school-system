// ============================================================
// FPU — Admin graduation API
// Mounted at /api/admin/graduation (via routes/index.js)
// File lives at: routes/graduation.js
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const { db, schema } = require('../db');
const { eq, and, desc, inArray } = require('drizzle-orm');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const resultQueries = require('../db/queries/results');
const userQueries = require('../db/queries/users');
const { computeStudentCGPA, classifyDegree } = require('../utils/gpa');

const { graduations, users, programmes, academicSessions } = schema;

const STAFF = ['admin', 'registrar', 'rector', 'academic_officer'];

// ============================================================
// GET /api/admin/graduation
// List all graduation records with student + programme.
// ============================================================
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { status, sessionId, limit = 500, offset = 0 } = req.query;

    const conds = [];
    if (status) conds.push(eq(graduations.status, status));
    if (sessionId) conds.push(eq(graduations.sessionId, Number(sessionId)));
    const where = conds.length ? and(...conds) : undefined;

    const rows = await db
      .select({
        graduation: graduations,
        student: users,
        programme: programmes,
        session: academicSessions,
      })
      .from(graduations)
      .leftJoin(users, eq(graduations.studentId, users.id))
      .leftJoin(programmes, eq(graduations.programmeId, programmes.id))
      .leftJoin(academicSessions, eq(graduations.sessionId, academicSessions.id))
      .where(where)
      .orderBy(desc(graduations.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/admin/graduation/:id
// ============================================================
router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const [row] = await db
      .select()
      .from(graduations)
      .where(eq(graduations.id, Number(req.params.id)))
      .limit(1);
    if (!row) return res.status(404).json({ success: false, error: 'Graduation record not found.' });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/admin/graduation/queue
// Queue a student for graduation using their published results.
// ============================================================
router.post('/queue', requireRole(['admin', 'registrar', 'academic_officer']), async (req, res, next) => {
  try {
    const { studentId, sessionId, programmeId, level } = req.body || {};
    if (!studentId || !sessionId || !programmeId || !level) {
      return res.status(400).json({
        success: false,
        error: 'studentId, sessionId, programmeId, level are required.',
      });
    }

    const student = await userQueries.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }

    // Pull all published results for this student and compute CGPA
    const rows = await resultQueries.publishedForStudent(studentId, {});
    const cgpaRows = rows.map((r) => ({
      unit: Number(r.course?.unit) || 0,
      points: Number(r.result?.points) || 0,
      sessionId: r.result?.sessionId,
      semester: r.result?.semester,
    }));

    const { cgpa } = computeStudentCGPA(cgpaRows);
    const classification = classifyDegree(cgpa);

    const [row] = await db
      .insert(graduations)
      .values({
        studentId: Number(studentId),
        sessionId: Number(sessionId),
        programmeId: Number(programmeId),
        level,
        cgpa: String(cgpa),
        classification,
        status: 'pending',
      })
      .onConflictDoUpdate({
        target: [graduations.studentId, graduations.sessionId],
        set: { cgpa: String(cgpa), classification },
      })
      .returning();

    await logAudit({
      req,
      action: 'graduation.queue',
      entity: 'graduation',
      entityId: row.id,
      after: { cgpa, classification },
    });

    return res.status(201).json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/admin/graduation/:id/approve
// ============================================================
router.post('/:id/approve', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const [row] = await db
      .update(graduations)
      .set({ status: 'approved', approvedBy: req.user.id, approvedAt: new Date() })
      .where(eq(graduations.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Graduation record not found.' });
    await logAudit({ req, action: 'graduation.approve', entity: 'graduation', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/admin/graduation/:id/reject
// ============================================================
router.post('/:id/reject', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const [row] = await db
      .update(graduations)
      .set({ status: 'rejected', remarks: req.body?.remarks || null })
      .where(eq(graduations.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Graduation record not found.' });
    await logAudit({ req, action: 'graduation.reject', entity: 'graduation', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/admin/graduation/:id/graduate
// ============================================================
router.post('/:id/graduate', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const [row] = await db
      .update(graduations)
      .set({ status: 'graduated', approvedAt: new Date() })
      .where(eq(graduations.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Graduation record not found.' });
    await logAudit({ req, action: 'graduation.graduate', entity: 'graduation', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// DELETE /api/admin/graduation/:id
// ============================================================
router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const [row] = await db
      .delete(graduations)
      .where(eq(graduations.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Graduation record not found.' });
    await logAudit({ req, action: 'graduation.delete', entity: 'graduation', entityId: row.id, before: row });
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

module.exports = router;