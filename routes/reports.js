// ============================================================
// FPU — Admin reports API
// Mounted at /api/admin/reports
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const { db, schema, sql, pool } = require('../db');
const { eq, and, inArray } = require('drizzle-orm');
const { requireRole } = require('../middleware/auth');

const {
  users, payments, applications, results, courses,
  courseRegistrations, clearances, borrowRecords, libraryFines,
  complaints, programmes, departments,
} = schema;

const STAFF = ['admin', 'registrar', 'rector', 'bursar', 'academic_officer', 'hod', 'librarian'];

// ------------------------------------------------------------
// GET /api/admin/reports/overview
// ------------------------------------------------------------
router.get('/overview', requireRole(STAFF), async (_req, res, next) => {
  try {
    const [students]        = await db.select({ c: sql`count(*)::int` }).from(users).where(eq(users.role, 'student'));
    const [lecturers]       = await db.select({ c: sql`count(*)::int` }).from(users).where(eq(users.role, 'lecturer'));
    const [pendingApps]     = await db.select({ c: sql`count(*)::int` }).from(applications).where(inArray(applications.status, ['pending', 'under_review']));
    const [pendingResults]  = await db.select({ c: sql`count(*)::int` }).from(results).where(inArray(results.status, ['submitted', 'hod_verified']));
    const [pendingPayments] = await db.select({ c: sql`count(*)::int` }).from(payments).where(eq(payments.status, 'pending'));
    const [pendingClear]    = await db.select({ c: sql`count(*)::int` }).from(clearances).where(eq(clearances.status, 'pending'));
    const [openComplaints]  = await db.select({ c: sql`count(*)::int` }).from(complaints).where(inArray(complaints.status, ['open', 'in_review']));
    const [activeBorrows]   = await db.select({ c: sql`count(*)::int` }).from(borrowRecords).where(inArray(borrowRecords.status, ['borrowed', 'overdue']));
    const [unpaidFines]     = await db.select({ c: sql`count(*)::int` }).from(libraryFines).where(eq(libraryFines.isPaid, false));

    const [totalApps]       = await db.select({ c: sql`count(*)::int` }).from(applications);
    const [totalPays]       = await db.select({ c: sql`count(*)::int` }).from(payments);
    const [totalRevenue]    = await db
      .select({ total: sql`coalesce(sum(${payments.amount}), 0)::numeric` })
      .from(payments)
      .where(eq(payments.status, 'verified'));
    const [totalProgrammes] = await db.select({ c: sql`count(*)::int` }).from(programmes);

    return res.json({
      success: true,
      data: {
        students: students.c,
        lecturers: lecturers.c,
        pendingApplications: pendingApps.c,
        pendingResults: pendingResults.c,
        pendingPayments: pendingPayments.c,
        pendingClearances: pendingClear.c,
        openComplaints: openComplaints.c,
        activeBorrows: activeBorrows.c,
        unpaidFines: unpaidFines.c,
        totalApplications: totalApps.c,
        totalPayments: totalPays.c,
        totalRevenue: Number(totalRevenue.total || 0),
        totalProgrammes: totalProgrammes.c,
      },
    });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/reports/enrollment-by-department
// ------------------------------------------------------------
router.get('/enrollment-by-department', requireRole(STAFF), async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        name: sql`coalesce(${departments.name}, 'Unassigned')`,
        code: sql`coalesce(${departments.code}, '—')`,
        count: sql`count(*)::int`,
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(eq(users.role, 'student'))
      .groupBy(departments.name, departments.code)
      .orderBy(sql`count(*) desc`);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/reports/enrollment-by-programme
// ------------------------------------------------------------
router.get('/enrollment-by-programme', requireRole(STAFF), async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        name: sql`coalesce(${programmes.name}, 'Unassigned')`,
        code: sql`coalesce(${programmes.code}, '—')`,
        count: sql`count(*)::int`,
      })
      .from(users)
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .where(eq(users.role, 'student'))
      .groupBy(programmes.name, programmes.code)
      .orderBy(sql`count(*) desc`);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/reports/enrollment-by-level
// ------------------------------------------------------------
router.get('/enrollment-by-level', requireRole(STAFF), async (_req, res, next) => {
  try {
    const rows = await db
      .select({ level: users.level, count: sql`count(*)::int` })
      .from(users)
      .where(eq(users.role, 'student'))
      .groupBy(users.level);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/reports/admission-trend?days=365
// ------------------------------------------------------------
router.get('/admission-trend', requireRole(STAFF), async (req, res, next) => {
  try {
    const days = Math.min(3650, Math.max(1, Number(req.query.days) || 365));
    const rows = await db
      .select({
        month: sql`to_char(date_trunc('month', ${users.createdAt}), 'Mon YYYY')`,
        sortKey: sql`date_trunc('month', ${users.createdAt})`,
        count: sql`count(*)::int`,
      })
      .from(users)
      .where(and(
        eq(users.role, 'student'),
        sql`${users.createdAt} >= now() - interval '${sql.raw(String(days))} days'`,
      ))
      .groupBy(sql`date_trunc('month', ${users.createdAt})`)
      .orderBy(sql`date_trunc('month', ${users.createdAt})`);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/reports/population-trend?days=365
// ------------------------------------------------------------
router.get('/population-trend', requireRole(STAFF), async (req, res, next) => {
  try {
    const days = Math.min(3650, Math.max(1, Number(req.query.days) || 365));
    const months = Math.max(1, Math.round(days / 30));

    const { rows } = await pool.query(`
      WITH months AS (
        SELECT date_trunc('month', generate_series(
          now() - ($1::int || ' months')::interval,
          now(),
          interval '1 month'
        )) AS m
      )
      SELECT
        to_char(m.m, 'Mon YYYY') AS month,
        m.m AS sort_key,
        (
          SELECT count(*) FROM users u
          WHERE u.role = 'student' AND u.created_at <= m.m + interval '1 month'
        )::int AS total
      FROM months m
      ORDER BY m.m
    `, [months]);

    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/reports/revenue-trend?days=365
// ------------------------------------------------------------
router.get('/revenue-trend', requireRole(STAFF), async (req, res, next) => {
  try {
    const days = Math.min(3650, Math.max(1, Number(req.query.days) || 365));
    const rows = await db
      .select({
        month: sql`to_char(date_trunc('month', ${payments.createdAt}), 'Mon YYYY')`,
        sortKey: sql`date_trunc('month', ${payments.createdAt})`,
        total: sql`coalesce(sum(${payments.amount}), 0)::numeric`,
        count: sql`count(*)::int`,
      })
      .from(payments)
      .where(and(
        eq(payments.status, 'verified'),
        sql`${payments.createdAt} >= now() - interval '${sql.raw(String(days))} days'`,
      ))
      .groupBy(sql`date_trunc('month', ${payments.createdAt})`)
      .orderBy(sql`date_trunc('month', ${payments.createdAt})`);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/reports/applications-by-status
// ------------------------------------------------------------
router.get('/applications-by-status', requireRole(STAFF), async (_req, res, next) => {
  try {
    const rows = await db
      .select({ status: applications.status, count: sql`count(*)::int` })
      .from(applications)
      .groupBy(applications.status);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/reports/payments-by-status
// ------------------------------------------------------------
router.get('/payments-by-status', requireRole(STAFF), async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        status: payments.status,
        count: sql`count(*)::int`,
        total: sql`coalesce(sum(${payments.amount}),0)::numeric`,
      })
      .from(payments)
      .groupBy(payments.status);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/reports/results-by-status
// ------------------------------------------------------------
router.get('/results-by-status', requireRole(STAFF), async (_req, res, next) => {
  try {
    const rows = await db
      .select({ status: results.status, count: sql`count(*)::int` })
      .from(results)
      .groupBy(results.status);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/reports/courses-by-department
// ------------------------------------------------------------
router.get('/courses-by-department', requireRole(STAFF), async (_req, res, next) => {
  try {
    const rows = await db
      .select({ departmentId: courses.departmentId, count: sql`count(*)::int` })
      .from(courses)
      .groupBy(courses.departmentId);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/reports/registrations-by-status
// ------------------------------------------------------------
router.get('/registrations-by-status', requireRole(STAFF), async (_req, res, next) => {
  try {
    const rows = await db
      .select({ status: courseRegistrations.status, count: sql`count(*)::int` })
      .from(courseRegistrations)
      .groupBy(courseRegistrations.status);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/reports/enrollment
// ------------------------------------------------------------
router.get('/enrollment', requireRole(STAFF), async (_req, res, next) => {
  try {
    const rows = await db
      .select({ level: users.level, count: sql`count(*)::int` })
      .from(users)
      .where(eq(users.role, 'student'))
      .groupBy(users.level);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

module.exports = router;