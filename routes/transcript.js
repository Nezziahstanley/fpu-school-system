// ============================================================
// FPU — Admin transcript API
// Mounted at /api/admin/transcript
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const resultQueries = require('../db/queries/results');
const userQueries = require('../db/queries/users');
const { db, schema } = require('../db');
const { eq, asc } = require('drizzle-orm');
const { requireRole } = require('../middleware/auth');
const { computeStudentCGPA, classifyDegree, resolveResultPoints } = require('../utils/gpa');
const { getActiveGradeScale } = require('../utils/gradeScale');

const { users, departments, programmes } = schema;

const STAFF = ['admin', 'registrar', 'academic_officer', 'rector', 'hod', 'bursar'];

// ------------------------------------------------------------
// GET /api/admin/transcript/students
// List all students with their computed CGPA
// ------------------------------------------------------------
router.get('/students', requireRole(STAFF), async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        matricNumber: users.matricNumber,
        email: users.email,
        isActive: users.isActive,
        level: users.level,
        departmentId: users.departmentId,
        programmeId: users.programmeId,
        departmentName: departments.name,
        programmeName: programmes.name,
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .where(eq(users.role, 'student'))
      .orderBy(asc(users.matricNumber));

    // Use the active scale to backfill points for legacy published results.
    const gradeScale = await getActiveGradeScale();
    const enriched = await Promise.all(rows.map(async (stu) => {
      try {
        const results = await resultQueries.publishedForStudent(stu.id, {});
        if (!results || results.length === 0) {
          return { ...stu, cgpa: null, classification: null, hasResults: false };
        }
        const cgpaRows = results.map(r => ({
          unit: Number(r.course?.unit) || 0,
          points: resolveResultPoints(r.result, gradeScale),
          sessionId: r.result?.sessionId,
          semester: r.result?.semester,
        }));
        const { cgpa } = computeStudentCGPA(cgpaRows);
        return {
          ...stu,
          cgpa,
          classification: classifyDegree(cgpa),
          hasResults: true,
        };
      } catch (e) {
        console.warn(`[transcript] CGPA failed for student ${stu.id}:`, e.message);
        return { ...stu, cgpa: null, classification: null, hasResults: false };
      }
    }));

    return res.json({ success: true, data: enriched });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// GET /api/admin/transcript/:studentId
// Single-student transcript with full results
// ------------------------------------------------------------
router.get('/:studentId', requireRole(STAFF), async (req, res, next) => {
  try {
    const student = await userQueries.findById(req.params.studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }

    const rows = await resultQueries.publishedForStudent(student.id, {});

    const gradeScale = await getActiveGradeScale();
    const cgpaRows = rows.map((r) => ({
      unit: Number(r.course?.unit) || 0,
      points: resolveResultPoints(r.result, gradeScale),
      sessionId: r.result?.sessionId,
      semester: r.result?.semester,
    }));

    const summary = computeStudentCGPA(cgpaRows);
    const classification = classifyDegree(summary.cgpa);

    return res.json({
      success: true,
      student: {
        id: student.id,
        matricNumber: student.matricNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        level: student.level,
        department: student.department,
        departmentName: student.departmentName,
        programme: student.programme,
        programmeName: student.programmeName,
        school: student.school,
      },
      summary: {
        cgpa: summary.cgpa,
        totalUnits: summary.totalUnits,
        totalPoints: summary.totalPoints,
        classification,
        perSession: summary.perSession,
      },
      rows: rows.map((r) => ({
        course: r.course,
        result: r.result,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;