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
const { eq, and, inArray, desc, ne } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');

const {
  users, applications, results, payments, complaints,
  courseRegistrations, departments, programmes, courses,
} = schema;

const only = requireRole('rector', 'admin');

// Roles that count as "staff" (non-student)
const STAFF_ROLES = [
  'lecturer', 'hod', 'bursar', 'rector', 'registrar',
  'librarian', 'exam_officer', 'academic_officer',
  'admission_officer', 'admin',
];

// ============================================================
// GET /api/rector/dashboard
// ------------------------------------------------------------
// Returns all top-level KPIs in a single call.
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    // -- Row counts --
    const [students]  = await db.select({ c: sql`count(*)::int` }).from(users).where(eq(users.role, 'student'));
    const [lecturers] = await db.select({ c: sql`count(*)::int` }).from(users).where(eq(users.role, 'lecturer'));
    const [staff]     = await db.select({ c: sql`count(*)::int` }).from(users).where(inArray(users.role, STAFF_ROLES));
    const [pendingApps]     = await db.select({ c: sql`count(*)::int` }).from(applications).where(inArray(applications.status, ['pending', 'under_review']));
    const [pendingResults]  = await db.select({ c: sql`count(*)::int` }).from(results).where(inArray(results.status, ['submitted', 'hod_verified']));
    const [pendingPayments] = await db.select({ c: sql`count(*)::int` }).from(payments).where(eq(payments.status, 'pending'));
    const [openComplaints]  = await db.select({ c: sql`count(*)::int` }).from(complaints).where(inArray(complaints.status, ['open', 'in_review']));
    const [totalRegs]       = await db.select({ c: sql`count(*)::int` }).from(courseRegistrations);
    const [deptCount]       = await db.select({ c: sql`count(*)::int` }).from(departments);
    const [progCount]       = await db.select({ c: sql`count(*)::int` }).from(programmes);
    const [courseCount]     = await db.select({ c: sql`count(*)::int` }).from(courses);

    // -- Revenue: sum of verified payments --
    const [revenue] = await db
      .select({ total: sql`COALESCE(SUM(${payments.amount}), 0)::numeric` })
      .from(payments)
      .where(eq(payments.status, 'verified'));

    // -- Monthly applications (last 6 months) --
    const trend = await db
      .select({
        month: sql`to_char(date_trunc('month', ${applications.createdAt}), 'Mon YYYY')`,
        applications: sql`count(*)::int`,
        monthKey: sql`date_trunc('month', ${applications.createdAt})`,
      })
      .from(applications)
      .groupBy(
        sql`date_trunc('month', ${applications.createdAt})`,
        sql`to_char(date_trunc('month', ${applications.createdAt}), 'Mon YYYY')`
      )
      .orderBy(desc(sql`date_trunc('month', ${applications.createdAt})`))
      .limit(6);

    // -- Enrollment by department --
    const enrollment = await db
      .select({
        code: departments.code,
        name: departments.name,
        students: sql`count(${users.id})::int`,
      })
      .from(departments)
      .leftJoin(users, and(eq(users.departmentId, departments.id), eq(users.role, 'student')))
      .groupBy(departments.code, departments.name)
      .orderBy(desc(sql`count(${users.id})`));

    return res.json({
      success: true,
      data: {
        students: students.c,
        lecturers: lecturers.c,
        staff: staff.c,
        departments: deptCount.c,
        programmes: progCount.c,
        courses: courseCount.c,
        pendingApplications: pendingApps.c,
        pendingResults: pendingResults.c,
        pendingPayments: pendingPayments.c,
        openComplaints: openComplaints.c,
        totalRegistrations: totalRegs.c,
        revenue: Number(revenue.total || 0),
        admissionTrend: trend.map((t) => ({ month: t.month, applications: t.applications })),
        enrollmentByDepartment: enrollment,
        currentSession: await sessionQueries.getCurrentAcademic(),
      },
    });
  } catch (err) {
    console.error('[rector/dashboard]', err);
    return next(err);
  }
});

// ============================================================
// GET /api/rector/enrollment-by-department
// ============================================================
router.get('/enrollment-by-department', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        code: departments.code,
        name: departments.name,
        students: sql`count(${users.id})::int`,
      })
      .from(departments)
      .leftJoin(users, and(eq(users.departmentId, departments.id), eq(users.role, 'student')))
      .groupBy(departments.code, departments.name)
      .orderBy(desc(sql`count(${users.id})`));
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/rector/admission-trend
// ============================================================
router.get('/admission-trend', only, async (req, res, next) => {
  try {
    const limit = Number(req.query.months) || 6;
    const rows = await db
      .select({
        month: sql`to_char(date_trunc('month', ${applications.createdAt}), 'Mon YYYY')`,
        applications: sql`count(*)::int`,
      })
      .from(applications)
      .groupBy(
        sql`date_trunc('month', ${applications.createdAt})`,
        sql`to_char(date_trunc('month', ${applications.createdAt}), 'Mon YYYY')`
      )
      .orderBy(desc(sql`date_trunc('month', ${applications.createdAt})`))
      .limit(limit);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
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
      .select({
        status: payments.status,
        count: sql`count(*)::int`,
        total: sql`coalesce(sum(${payments.amount}),0)::numeric`,
      })
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