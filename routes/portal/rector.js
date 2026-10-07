// ============================================================
// FPU — Rector portal API (high-level overview)
// Mounted at /api/rector
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries = require('../../db/queries/users');
const sessionQueries = require('../../db/queries/sessions');
const { db, schema, sql } = require('../../db');
const { eq, inArray } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');

const { users, applications, results, payments, complaints, courseRegistrations } = schema;
const only = requireRole('rector', 'admin');

// ============================================================
// GET /api/rector/dashboard
// ============================================================
router.get('/dashboard', only, async (_req, res, next) => {
  try {
    const [students] = await db.select({ c: sql`count(*)::int` }).from(users).where(eq(users.role, 'student'));
    const [lecturers] = await db.select({ c: sql`count(*)::int` }).from(users).where(eq(users.role, 'lecturer'));
    const [staff] = await db
      .select({ c: sql`count(*)::int` })
      .from(users)
      .where(inArray(users.role, ['lecturer','hod','bursar','rector','registrar','librarian','exam_officer','academic_officer','admission_officer','admin']));
    const [pendingApps] = await db.select({ c: sql`count(*)::int` }).from(applications).where(inArray(applications.status, ['pending','under_review']));
    const [pendingResults] = await db.select({ c: sql`count(*)::int` }).from(results).where(inArray(results.status, ['submitted','hod_verified']));
    const [pendingPayments] = await db.select({ c: sql`count(*)::int` }).from(payments).where(eq(payments.status, 'pending'));
    const [openComplaints] = await db.select({ c: sql`count(*)::int` }).from(complaints).where(inArray(complaints.status, ['open','in_review']));
    const [totalRegistrations] = await db.select({ c: sql`count(*)::int` }).from(courseRegistrations);

    return res.json({
      success: true,
      data: {
        students: students.c,
        lecturers: lecturers.c,
        staff: staff.c,
        pendingApplications: pendingApps.c,
        pendingResults: pendingResults.c,
        pendingPayments: pendingPayments.c,
        openComplaints: openComplaints.c,
        totalRegistrations: totalRegistrations.c,
        currentSession: await sessionQueries.getCurrentAcademic(),
      },
    });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/rector/students, /staff
// ============================================================
router.get('/students', only, async (req, res, next) => {
  try {
    const rows = await userQueries.listStudents({ departmentId: req.query.departmentId, level: req.query.level });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

router.get('/staff', only, async (req, res, next) => {
  try {
    const rows = await userQueries.listStaff({ departmentId: req.query.departmentId, role: req.query.role });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/rector/reports
// ============================================================
router.get('/reports', only, async (_req, res, next) => {
  try {
    const apps = await db
      .select({ status: applications.status, count: sql`count(*)::int` })
      .from(applications)
      .groupBy(applications.status);
    const resu = await db
      .select({ status: results.status, count: sql`count(*)::int` })
      .from(results)
      .groupBy(results.status);
    const pay = await db
      .select({ status: payments.status, count: sql`count(*)::int`, total: sql`coalesce(sum(${payments.amount}),0)::numeric` })
      .from(payments)
      .groupBy(payments.status);
    return res.json({ success: true, data: { applications: apps, results: resu, payments: pay } });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/rector/profile, /security
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