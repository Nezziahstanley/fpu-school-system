// ============================================================
// FPU — Registrar portal API
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();
const { eq, and, sql, desc } = require('drizzle-orm');

const { requireRole } = require('../../middleware/auth');
const { db, schema } = require('../../db');
const { users, applications, programmes, academicSessions, courseRegistrations, clearances } = schema;

const only = requireRole('registrar', 'admin');

// ============================================================
// GET /api/registrar/dashboard
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    // 1. Basic counts
    const allStudents = await db.select({ id: users.id, level: users.level, gender: users.gender, departmentId: users.departmentId }).from(users).where(eq(users.role, 'student'));
    
    const totalStudents = allStudents.length;
    const ndStudents = allStudents.filter(s => s.level === 'ND').length;
    const hndStudents = allStudents.filter(s => s.level === 'HND').length;

    // 2. Current Session
    const [currentSession] = await db.select().from(academicSessions).where(eq(academicSessions.isCurrent, true)).limit(1);

    // 3. Pending Applications
    const pendingApps = await db.select({ count: sql`count(*)::int` }).from(applications).where(eq(applications.status, 'pending'));
    
    // 4. Pending Registrations
    const pendingRegs = await db.select({ count: sql`count(*)::int` }).from(courseRegistrations).where(eq(courseRegistrations.status, 'pending'));

    // 5. Pending Clearances
    const pendingClears = await db.select({ count: sql`count(*)::int` }).from(clearances).where(eq(clearances.status, 'pending'));

    // 6. Programmes count
    const progCount = await db.select({ count: sql`count(*)::int` }).from(programmes);

    // 7. Demographics: Students by Department
    const depts = await db.select({ id: schema.departments.id, name: schema.departments.name }).from(schema.departments);
    const deptMap = {};
    depts.forEach(d => { deptMap[d.id] = d.name; });

    const byDept = {};
    allStudents.forEach(s => {
      if (s.departmentId) {
        const name = deptMap[s.departmentId] || 'Unknown';
        byDept[name] = (byDept[name] || 0) + 1;
      }
    });

    // 8. Demographics: Gender
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
  } catch (err) {
    return next(err);
  }
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
        programmeId: users.programmeId,
        departmentId: users.departmentId,
        createdAt: users.createdAt,
        programmeName: programmes.name,
        departmentName: schema.departments.name,
      })
      .from(users)
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .leftJoin(schema.departments, eq(users.departmentId, schema.departments.id))
      .where(eq(users.role, 'student'))
      .orderBy(desc(users.createdAt));

    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;