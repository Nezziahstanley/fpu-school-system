// ============================================================
// FPU — Admin transcript API
// Mounted at /api/admin/transcript
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const resultQueries = require('../db/queries/results');
const userQueries = require('../db/queries/users');
const { requireRole } = require('../middleware/auth');
const { computeStudentCGPA, classifyDegree } = require('../utils/gpa');

const STAFF = ['admin', 'registrar', 'academic_officer', 'rector', 'hod', 'bursar'];

// GET /api/admin/transcript/:studentId
router.get('/:studentId', requireRole(STAFF), async (req, res, next) => {
  try {
    const student = await userQueries.findById(req.params.studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }

    const rows = await resultQueries.publishedForStudent(student.id, {});

    const cgpaRows = rows.map((r) => ({
      unit: Number(r.course?.unit) || 0,
      points: Number(r.result?.points) || 0,
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
        programme: student.programme,
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