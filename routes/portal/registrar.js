// ============================================================
// FPU — Registrar portal API
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();
const { eq, and, sql, desc, inArray } = require('drizzle-orm');

const { requireRole } = require('../../middleware/auth');
const { db, schema } = require('../../db');
const { 
  users, 
  applications, 
  programmes, 
  academicSessions, 
  courseRegistrations, 
  clearances,
  departments,
  courses
} = schema;

const only = requireRole('registrar', 'admin');

// ============================================================
// GET /api/registrar/dashboard
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    const allStudents = await db.select({ id: users.id, level: users.level, gender: users.gender, departmentId: users.departmentId }).from(users).where(eq(users.role, 'student'));
    
    const totalStudents = allStudents.length;
    const ndStudents = allStudents.filter(s => s.level === 'ND').length;
    const hndStudents = allStudents.filter(s => s.level === 'HND').length;

    const [currentSession] = await db.select().from(academicSessions).where(eq(academicSessions.isCurrent, true)).limit(1);

    const pendingApps = await db.select({ count: sql`count(*)::int` }).from(applications).where(eq(applications.status, 'pending'));
    const pendingRegs = await db.select({ count: sql`count(*)::int` }).from(courseRegistrations).where(eq(courseRegistrations.status, 'pending'));
    const pendingClears = await db.select({ count: sql`count(*)::int` }).from(clearances).where(eq(clearances.status, 'pending'));
    const progCount = await db.select({ count: sql`count(*)::int` }).from(programmes);

    const depts = await db.select({ id: departments.id, name: departments.name }).from(departments);
    const deptMap = {};
    depts.forEach(d => { deptMap[d.id] = d.name; });

    const byDept = {};
    allStudents.forEach(s => {
      if (s.departmentId) {
        const name = deptMap[s.departmentId] || 'Unknown';
        byDept[name] = (byDept[name] || 0) + 1;
      }
    });

    const byGender = { Male: 0, Female: 0, Other: 0 };
    allStudents.forEach(s => {
      if (s.gender === 'male') byGender.Male++;
      else if (s.gender === 'female') byGender.Female++;
      else byGender.Other++;
    });

    return res.json({
      success: true,
      data: {
        totalStudents,
        ndStudents,
        hndStudents,
        activeSession: currentSession?.name || '—',
        pendingApplications: pendingApps[0]?.count || 0,
        pendingRegistrations: pendingRegs[0]?.count || 0,
        pendingClearances: pendingClears[0]?.count || 0,
        totalProgrammes: progCount[0]?.count || 0,
        demographics: {
          byLevel: { ND: ndStudents, HND: hndStudents },
          byDept: byDept,
          byGender: byGender
        }
      }
    });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/trends
// ============================================================
router.get('/trends', only, async (req, res, next) => {
  try {
    const students = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.role, 'student'));
    const enrollments = {};
    students.forEach(s => {
      if (!s.createdAt) return;
      const d = new Date(s.createdAt);
      const key = d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' });
      enrollments[key] = (enrollments[key] || 0) + 1;
    });
    
    const sortedEnrollKeys = Object.keys(enrollments).sort((a, b) => new Date(a) - new Date(b));
    let cumSum = 0;
    const enrollmentData = sortedEnrollKeys.map(k => {
      cumSum += enrollments[k];
      return cumSum;
    });

    const apps = await db.select({ createdAt: applications.createdAt }).from(applications);
    const admissions = {};
    apps.forEach(a => {
      if (!a.createdAt) return;
      const d = new Date(a.createdAt);
      const key = d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' });
      admissions[key] = (admissions[key] || 0) + 1;
    });
    const sortedAdmKeys = Object.keys(admissions).sort((a, b) => new Date(a) - new Date(b));
    const admissionData = sortedAdmKeys.map(k => admissions[k]);

    const regs = await db.select({ status: courseRegistrations.status }).from(courseRegistrations);
    const regStats = { pending: 0, approved: 0, rejected: 0 };
    regs.forEach(r => {
      if (regStats[r.status] !== undefined) regStats[r.status]++;
    });

    return res.json({
      success: true,
      data: {
        enrollment: { labels: sortedEnrollKeys, values: enrollmentData },
        admission: { labels: sortedAdmKeys, values: admissionData },
        registrations: regStats
      }
    });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/students
// ============================================================
router.get('/students', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        matricNumber: users.matricNumber,
        firstName: users.firstName,
        lastName: users.lastName,
        level: users.level,
        email: users.email,
        phone: users.phone,
        programmeName: programmes.name,
        departmentName: departments.name,
        isActive: users.isActive,
      })
      .from(users)
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(eq(users.role, 'student'))
      .orderBy(desc(users.createdAt));

    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/recent-students
// ============================================================
router.get('/recent-students', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        matricNumber: users.matricNumber,
        firstName: users.firstName,
        lastName: users.lastName,
        level: users.level,
        programmeName: programmes.name,
      })
      .from(users)
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .where(eq(users.role, 'student'))
      .orderBy(desc(users.createdAt))
      .limit(5);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/recent-applications
// ============================================================
router.get('/recent-applications', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: applications.id,
        applicationNumber: applications.applicationNumber,
        firstName: applications.firstName,
        lastName: applications.lastName,
        type: applications.type,
        status: applications.status,
      })
      .from(applications)
      .orderBy(desc(applications.createdAt))
      .limit(5);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/sessions
// ============================================================
router.get('/sessions', only, async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(academicSessions)
      .orderBy(desc(academicSessions.startDate));

    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/applications
// ============================================================
router.get('/applications', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        application: applications,
        programme: programmes,
        department: departments,
      })
      .from(applications)
      .leftJoin(programmes, eq(applications.programmeId, programmes.id))
      .leftJoin(departments, eq(applications.departmentId, departments.id))
      .orderBy(desc(applications.createdAt));

    const data = rows.map((r) => ({
      ...r.application,
      programmeName: r.programme?.name || null,
      departmentName: r.department?.name || null,
    }));

    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/applications/:id
// ============================================================
router.get('/applications/:id', only, async (req, res, next) => {
  try {
    const [row] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, Number(req.params.id)))
      .limit(1);

    if (!row) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/admitted
// ============================================================
router.get('/admitted', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        application: applications,
        programme: programmes,
        department: departments,
      })
      .from(applications)
      .leftJoin(programmes, eq(applications.programmeId, programmes.id))
      .leftJoin(departments, eq(applications.departmentId, departments.id))
      .where(inArray(applications.status, ['approved', 'registered', 'matriculated']))
      .orderBy(desc(applications.admittedAt));

    const data = rows.map((r) => ({
      ...r.application,
      programmeName: r.programme?.name || null,
      departmentName: r.department?.name || null,
    }));

    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/registrations
// ============================================================
router.get('/registrations', only, async (req, res, next) => {
  try {
    const { status, sessionId, semester } = req.query;
    
    const conds = [];
    if (status) conds.push(eq(courseRegistrations.status, status));
    if (sessionId) conds.push(eq(courseRegistrations.sessionId, Number(sessionId)));
    if (semester) conds.push(eq(courseRegistrations.semester, semester));

    const where = conds.length ? and(...conds) : undefined;

    const rows = await db
      .select({
        registration: courseRegistrations,
        student: users,
        course: courses,
        session: academicSessions,
      })
      .from(courseRegistrations)
      .leftJoin(users, eq(courseRegistrations.studentId, users.id))
      .leftJoin(courses, eq(courseRegistrations.courseId, courses.id))
      .leftJoin(academicSessions, eq(courseRegistrations.sessionId, academicSessions.id))
      .where(where)
      .orderBy(desc(courseRegistrations.createdAt));

    const data = rows.map((r) => ({
      id: r.registration.id,
      registration: r.registration,
      student: r.student,
      course: r.course,
      session: r.session,
    }));

    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/registrar/registrations/:id/status
// ============================================================
router.post('/registrations/:id/status', only, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status.' });
    }

    const [row] = await db
      .update(courseRegistrations)
      .set({ status, approvedAt: status === 'approved' ? new Date() : null, approvedBy: req.user.id })
      .where(eq(courseRegistrations.id, Number(req.params.id)))
      .returning();

    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

module.exports = router;