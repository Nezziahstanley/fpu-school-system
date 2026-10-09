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
const { eq, and, inArray, desc, ne, gte } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');

const {
  users, applications, results, payments, complaints,
  courseRegistrations, departments, programmes, courses,
  borrowRecords, books, libraryFines, graduations,
} = schema;

const only = requireRole('rector', 'admin');

const STAFF_ROLES = [
  'lecturer', 'hod', 'bursar', 'rector', 'registrar',
  'librarian', 'exam_officer', 'academic_officer',
  'admission_officer', 'admin',
];

// ============================================================
// GET /api/rector/dashboard
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
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
    const [resultsCount]    = await db.select({ c: sql`count(*)::int` }).from(results).where(eq(results.status, 'published'));

    const [revenue] = await db
      .select({ total: sql`COALESCE(SUM(${payments.amount}), 0)::numeric` })
      .from(payments)
      .where(eq(payments.status, 'verified'));

    const [outstanding] = await db
      .select({ total: sql`COALESCE(SUM(${payments.amount}), 0)::numeric` })
      .from(payments)
      .where(eq(payments.status, 'pending'));

    const trend = await db
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
      .limit(6);

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

    const levelEnrollment = await db
      .select({ level: users.level, count: sql`count(*)::int` })
      .from(users)
      .where(eq(users.role, 'student'))
      .groupBy(users.level);

    const revenueTrend = await db
      .select({
        month: sql`to_char(date_trunc('month', ${payments.createdAt}), 'Mon YYYY')`,
        total: sql`COALESCE(SUM(${payments.amount}), 0)::numeric`,
      })
      .from(payments)
      .where(eq(payments.status, 'verified'))
      .groupBy(
        sql`date_trunc('month', ${payments.createdAt})`,
        sql`to_char(date_trunc('month', ${payments.createdAt}), 'Mon YYYY')`
      )
      .orderBy(desc(sql`date_trunc('month', ${payments.createdAt})`))
      .limit(6);

    const [overdueBooks] = await db
      .select({ c: sql`count(*)::int` })
      .from(borrowRecords)
      .where(and(eq(borrowRecords.status, 'borrowed'), sql`${borrowRecords.dueAt} < NOW()`));

    return res.json({
      success: true,
      data: {
        students: students.c,
        lecturers: lecturers.c,
        staff: staff.c,
        departments: deptCount.c,
        programmes: progCount.c,
        courses: courseCount.c,
        resultsPublished: resultsCount.c,
        pendingApplications: pendingApps.c,
        pendingResults: pendingResults.c,
        pendingPayments: pendingPayments.c,
        openComplaints: openComplaints.c,
        totalRegistrations: totalRegs.c,
        overdueBooks: overdueBooks.c,
        revenue: Number(revenue.total || 0),
        outstandingFees: Number(outstanding.total || 0),
        admissionTrend: trend.map((t) => ({ month: t.month, applications: t.applications })),
        enrollmentByDepartment: enrollment,
        enrollmentByLevel: levelEnrollment,
        revenueTrend: revenueTrend.map((r) => ({ month: r.month, total: Number(r.total || 0) })),
        currentSession: await sessionQueries.getCurrentAcademic(),
      },
    });
  } catch (err) {
    console.error('[rector/dashboard]', err);
    return next(err);
  }
});

// ============================================================
// GET /api/rector/graduation-pipeline
// ============================================================
router.get('/graduation-pipeline', only, async (req, res, next) => {
  try {
    const [queued]    = await db.select({ c: sql`count(*)::int` }).from(graduations).where(eq(graduations.status, 'pending'));
    const [approved]  = await db.select({ c: sql`count(*)::int` }).from(graduations).where(eq(graduations.status, 'approved'));
    const [graduated] = await db.select({ c: sql`count(*)::int` }).from(graduations).where(eq(graduations.status, 'graduated'));
    const [rejected]  = await db.select({ c: sql`count(*)::int` }).from(graduations).where(eq(graduations.status, 'rejected'));

    return res.json({
      success: true,
      data: {
        queued: queued.c,
        approved: approved.c,
        graduated: graduated.c,
        rejected: rejected.c,
        total: queued.c + approved.c + graduated.c + rejected.c,
      },
    });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/rector/staff-composition
// ------------------------------------------------------------
// Staff grouped by role
// ============================================================
router.get('/staff-composition', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        role: users.role,
        c: sql`count(*)::int`,
      })
      .from(users)
      .where(inArray(users.role, STAFF_ROLES))
      .groupBy(users.role)
      .orderBy(desc(sql`count(*)`));

    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/rector/recent-activity
// ============================================================
router.get('/recent-activity', only, async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 10;

    const recentApps = await db
      .select({
        type: sql`'application'`,
        id: applications.id,
        title: sql`'New application submitted'`,
        description: sql`${applications.firstName} || ' ' || ${applications.lastName} || ' applied for ' || COALESCE(${applications.type}, 'ND')`,
        at: applications.createdAt,
      })
      .from(applications)
      .orderBy(desc(applications.createdAt))
      .limit(3);

    const recentPays = await db
      .select({
        type: sql`'payment'`,
        id: payments.id,
        title: sql`'Payment verified'`,
        description: sql`'₦' || to_char(${payments.amount}, 'FM999,999,999') || ' for ' || COALESCE(${users.firstName}, '') || ' ' || COALESCE(${users.lastName}, '')`,
        at: payments.verifiedAt,
      })
      .from(payments)
      .leftJoin(users, eq(payments.studentId, users.id))
      .where(eq(payments.status, 'verified'))
      .orderBy(desc(payments.verifiedAt))
      .limit(3);

    const recentReg = await db
      .select({
        type: sql`'student'`,
        id: users.id,
        title: sql`'New student registered'`,
        description: sql`${users.firstName} || ' ' || ${users.lastName} || ' (' || COALESCE(${users.matricNumber}, '') || ')'`,
        at: users.createdAt,
      })
      .from(users)
      .where(eq(users.role, 'student'))
      .orderBy(desc(users.createdAt))
      .limit(3);

    const recentComplaints = await db
      .select({
        type: sql`'complaint'`,
        id: complaints.id,
        title: sql`'New complaint filed'`,
        description: complaints.subject,
        at: complaints.createdAt,
      })
      .from(complaints)
      .orderBy(desc(complaints.createdAt))
      .limit(3);

    const all = [...recentApps, ...recentPays, ...recentReg, ...recentComplaints]
      .filter((x) => x.at)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, limit);

    return res.json({ success: true, data: all });
  } catch (err) {
    console.error('[rector/recent-activity]', err);
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
// GET /api/rector/reports/summary
// ============================================================
router.get('/reports/summary', only, async (req, res, next) => {
  try {
    const byLevel = await db
      .select({ level: users.level, c: sql`count(*)::int` })
      .from(users)
      .where(eq(users.role, 'student'))
      .groupBy(users.level);

    const byGender = await db
      .select({ gender: users.gender, c: sql`count(*)::int` })
      .from(users)
      .where(eq(users.role, 'student'))
      .groupBy(users.gender);

    const byState = await db
      .select({ state: users.stateOfOrigin, c: sql`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, 'student'), sql`${users.stateOfOrigin} IS NOT NULL`))
      .groupBy(users.stateOfOrigin)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    const [gradQueue] = await db.select({ c: sql`count(*)::int` }).from(graduations).where(eq(graduations.status, 'pending'));
    const [gradApproved] = await db.select({ c: sql`count(*)::int` }).from(graduations).where(eq(graduations.status, 'approved'));
    const [gradGraduated] = await db.select({ c: sql`count(*)::int` }).from(graduations).where(eq(graduations.status, 'graduated'));

    const revenueByStatus = await db
      .select({
        status: payments.status,
        count: sql`count(*)::int`,
        total: sql`COALESCE(SUM(${payments.amount}), 0)::numeric`,
      })
      .from(payments)
      .groupBy(payments.status);

    const appsByStatus = await db
      .select({ status: applications.status, c: sql`count(*)::int` })
      .from(applications)
      .groupBy(applications.status);

    const resultsByStatus = await db
      .select({ status: results.status, c: sql`count(*)::int` })
      .from(results)
      .groupBy(results.status);

    return res.json({
      success: true,
      data: {
        byLevel,
        byGender,
        byState,
        graduation: {
          queue: gradQueue.c,
          approved: gradApproved.c,
          graduated: gradGraduated.c,
        },
        revenueByStatus: revenueByStatus.map((r) => ({
          status: r.status,
          count: r.count,
          total: Number(r.total || 0),
        })),
        appsByStatus,
        resultsByStatus,
      },
    });
  } catch (err) {
    console.error('[rector/reports]', err);
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