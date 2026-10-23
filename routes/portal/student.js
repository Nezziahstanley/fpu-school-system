// ============================================================
// FPU — Student portal API
// Mounted at /api/student
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// -------- Database & Schema --------
const { db, schema } = require('../../db');
const { eq, and, desc, sql, inArray } = require('drizzle-orm');

// -------- Destructure all tables --------
const { 
  users, 
  courses, 
  results, 
  courseRegistrations, 
  academicSessions,
  programmes,
  departments,
  courseMaterials,
  assignments,
  assignmentSubmissions,
  attendance,
  timetableSlots
} = schema;

// -------- Middleware --------
const { requireRole } = require('../../middleware/auth');

const only = requireRole('student', 'admin');

// -------- Upload setup for assignment submissions --------
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR });

// ============================================================
// GET /api/student/dashboard
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = req.user.currentSessionId || 1;

    // 1. Fetch student info
    const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });

    // 2. Registered courses
    const regs = await db
      .select({
        courseCode: courses.code,
        courseTitle: courses.title,
        unit: courses.unit,
        semester: courseRegistrations.semester,
        status: courseRegistrations.status,
      })
      .from(courseRegistrations)
      .innerJoin(courses, eq(courseRegistrations.courseId, courses.id))
      .where(and(
        eq(courseRegistrations.studentId, studentId),
        eq(courseRegistrations.sessionId, sessionId)
      ))
      .orderBy(courses.code);

    // 3. Published results
    const allResults = await db
      .select({
        courseCode: courses.code,
        courseTitle: courses.title,
        unit: courses.unit,
        score: results.score,
        grade: results.grade,
        points: results.points,
        semester: results.semester,
        sessionName: academicSessions.name,
      })
      .from(results)
      .innerJoin(courses, eq(results.courseId, courses.id))
      .leftJoin(academicSessions, eq(results.sessionId, academicSessions.id))
      .where(and(
        eq(results.studentId, studentId),
        eq(results.status, 'published')
      ))
      .orderBy(courses.code);

    // Deduplicate by course code
    const uniqueResults = [];
    const seen = new Set();
    allResults.forEach(r => {
      if (!seen.has(r.courseCode)) {
        seen.add(r.courseCode);
        uniqueResults.push(r);
      }
    });

    // 4. Calculate CGPA
    let totalPoints = 0;
    let totalUnits = 0;
    uniqueResults.forEach(r => {
      const unit = Number(r.unit) || 0;
      const points = Number(r.points) || 0;
      totalPoints += (points * unit);
      totalUnits += unit;
    });
    const cgpa = totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '0.00';

    // 5. Recent results (last 5)
    const recentResults = uniqueResults.slice(-5).reverse();

    return res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          matricNumber: (student.matricNumber || '').replace(/SMT/gi, '').trim(),
          level: student.level,
          programmeId: student.programmeId,
        },
        registeredCourses: regs,
        totalRegistered: regs.length,
        totalUnits: regs.reduce((sum, r) => sum + Number(r.unit || 0), 0),
        cgpa: cgpa,
        currentGpa: cgpa,
        recentResults: recentResults,
      }
    });
  } catch (err) {
    console.error('[student/dashboard] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/student/results
// ============================================================
router.get('/results', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const rows = await db
      .select({
        id: results.id,
        courseCode: courses.code,
        courseTitle: courses.title,
        unit: courses.unit,              // <-- Added
        score: results.score,
        grade: results.grade,
        points: results.points,
        semester: results.semester,
        sessionName: academicSessions.name,
      })
      .from(results)
      .innerJoin(courses, eq(results.courseId, courses.id))
      .leftJoin(academicSessions, eq(results.sessionId, academicSessions.id))
      .where(and(
        eq(results.studentId, studentId),
        eq(results.status, 'published')
      ))
      .orderBy(academicSessions.name, results.semester, courses.code);

    // Deduplicate results by course code (keep the most recent)
    const uniqueResults = [];
    const seen = new Set();
    rows.forEach(r => {
      const key = `${r.courseCode}-${r.semester}-${r.sessionName}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueResults.push(r);
      }
    });

    // Calculate CGPA
    let totalPoints = 0;
    let totalUnits = 0;
    uniqueResults.forEach(r => {
      const unit = Number(r.unit) || 0;
      const points = Number(r.points) || 0;
      totalPoints += (points * unit);
      totalUnits += unit;
    });
    const cgpa = totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '0.00';

    // Determine Classification
    let classification = '';
    const val = parseFloat(cgpa);
    if (val >= 3.50) classification = 'Distinction';
    else if (val >= 3.00) classification = 'Upper Credit';
    else if (val >= 2.50) classification = 'Lower Credit';
    else if (val >= 2.00) classification = 'Pass';
    else if (val >= 1.00) classification = 'Probation';
    else classification = 'Fail';

    return res.json({
      success: true,
      data: {
        results: uniqueResults,
        cgpa,
        currentGpa: cgpa,
        totalUnits,
        classification,
      }
    });
  } catch (err) {
    console.error('[student/results] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/student/transcript
// ============================================================
router.get('/transcript', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;

    // 1. Fetch student info (minimal, no joins that could fail)
    const [student] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        matricNumber: users.matricNumber,
        level: users.level,
      })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1);

    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });

    // 2. Fetch all published results
    const rows = await db
      .select({
        courseCode: courses.code,
        courseTitle: courses.title,
        unit: courses.unit,
        score: results.score,
        grade: results.grade,
        points: results.points,
        semester: results.semester,
        sessionName: academicSessions.name,
      })
      .from(results)
      .innerJoin(courses, eq(results.courseId, courses.id))
      .leftJoin(academicSessions, eq(results.sessionId, academicSessions.id))
      .where(and(
        eq(results.studentId, studentId),
        eq(results.status, 'published')
      ))
      .orderBy(academicSessions.name, results.semester, courses.code);

    // Deduplicate by course code
    const uniqueResults = [];
    const seen = new Set();
    rows.forEach(r => {
      if (!seen.has(r.courseCode)) {
        seen.add(r.courseCode);
        uniqueResults.push(r);
      }
    });

    // 3. Calculate CGPA
    let totalPoints = 0;
    let totalUnits = 0;
    uniqueResults.forEach(r => {
      const unit = Number(r.unit) || 0;
      const points = Number(r.points) || 0;
      totalPoints += (points * unit);
      totalUnits += unit;
    });
    const cgpa = totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '0.00';

    // 4. Classification
    let classification = '';
    const val = parseFloat(cgpa);
    if (val >= 3.50) classification = 'Distinction';
    else if (val >= 3.00) classification = 'Upper Credit';
    else if (val >= 2.50) classification = 'Lower Credit';
    else if (val >= 2.00) classification = 'Pass';
    else if (val >= 1.00) classification = 'Probation';
    else classification = 'Fail';

    return res.json({
      success: true,
      data: {
        student: {
          ...student,
          matricNumber: (student?.matricNumber || '').replace(/SMT/gi, '').trim(),
        },
        results: uniqueResults,
        cgpa,
        totalUnits,
        classification,
      }
    });
  } catch (err) {
    console.error('[student/transcript] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/student/courses
// ============================================================
router.get('/courses', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = req.user.currentSessionId || 1;

    const rows = await db
      .select({
        id: courseRegistrations.id,
        courseCode: courses.code,
        courseTitle: courses.title,
        unit: courses.unit,
        semester: courseRegistrations.semester,
        status: courseRegistrations.status,
      })
      .from(courseRegistrations)
      .innerJoin(courses, eq(courseRegistrations.courseId, courses.id))
      .where(and(
        eq(courseRegistrations.studentId, studentId),
        eq(courseRegistrations.sessionId, sessionId)
      ))
      .orderBy(courses.code);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[student/courses] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/student/register-course
// ============================================================
router.post('/register-course', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { courseId, semester } = req.body || {};
    const sessionId = req.user.currentSessionId || 1;

    if (!courseId || !semester) {
      return res.status(400).json({ success: false, error: 'courseId and semester are required.' });
    }

    const [row] = await db.insert(courseRegistrations).values({
      studentId,
      courseId: Number(courseId),
      sessionId,
      semester,
      status: 'pending',
    }).onConflictDoNothing().returning();

    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error('[student/register-course] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/student/materials
// ============================================================
router.get('/materials', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = req.user.currentSessionId || 1;

    // Get student's registered course IDs
    const regs = await db
      .select({ courseId: courseRegistrations.courseId })
      .from(courseRegistrations)
      .where(and(
        eq(courseRegistrations.studentId, studentId),
        eq(courseRegistrations.sessionId, sessionId)
      ));

    const courseIds = regs.map(r => r.courseId);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const rows = await db
      .select({
        id: courseMaterials.id,
        title: courseMaterials.title,
        description: courseMaterials.description,
        fileUrl: courseMaterials.fileUrl,
        materialType: courseMaterials.materialType,
        createdAt: courseMaterials.createdAt,
        courseCode: courses.code,
      })
      .from(courseMaterials)
      .innerJoin(courses, eq(courseMaterials.courseId, courses.id))
      .where(inArray(courseMaterials.courseId, courseIds))
      .orderBy(desc(courseMaterials.createdAt));

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[student/materials] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/student/assignments
// ============================================================
router.get('/assignments', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = req.user.currentSessionId || 1;

    const regs = await db
      .select({ courseId: courseRegistrations.courseId })
      .from(courseRegistrations)
      .where(and(
        eq(courseRegistrations.studentId, studentId),
        eq(courseRegistrations.sessionId, sessionId)
      ));

    const courseIds = regs.map(r => r.courseId);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const rows = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        dueDate: assignments.dueDate,
        maxScore: assignments.maxScore,
        attachmentUrl: assignments.attachmentUrl,
        courseCode: courses.code,
      })
      .from(assignments)
      .innerJoin(courses, eq(assignments.courseId, courses.id))
      .where(inArray(assignments.courseId, courseIds))
      .orderBy(desc(assignments.createdAt));

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[student/assignments] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/student/assignments/:id/submit
// ============================================================
router.post('/assignments/:id/submit', only, upload.single('file'), async (req, res, next) => {
  try {
    const assignmentId = Number(req.params.id);
    const studentId = req.user.id;

    const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
    if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found.' });

    const [registration] = await db.select().from(courseRegistrations)
      .where(and(
        eq(courseRegistrations.studentId, studentId),
        eq(courseRegistrations.courseId, assignment.courseId),
        eq(courseRegistrations.status, 'approved')
      )).limit(1);

    if (!registration) return res.status(403).json({ success: false, error: 'You are not registered for this course.' });

    let submissionUrl = null;
    if (req.file) {
      const ext = path.extname(req.file.originalname) || '';
      const newName = `submission-${studentId}-${Date.now()}${ext}`;
      fs.renameSync(req.file.path, path.join(UPLOAD_DIR, newName));
      submissionUrl = `/uploads/${newName}`;
    }

    const [row] = await db.insert(assignmentSubmissions).values({
      assignmentId: assignmentId,
      studentId: studentId,
      submissionText: req.body.text || null,
      submissionUrl: submissionUrl,
      submittedAt: new Date(),
    }).onConflictDoUpdate({
      target: [assignmentSubmissions.assignmentId, assignmentSubmissions.studentId],
      set: {
        submissionText: req.body.text || null,
        submissionUrl: submissionUrl || null,
        submittedAt: new Date(),
        score: null,
        feedback: null,
        gradedAt: null,
      }
    }).returning();

    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error('[student/submit-assignment] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/student/attendance
// ============================================================
router.get('/attendance', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = req.user.currentSessionId || 1;

    const rows = await db
      .select({
        id: attendance.id,
        date: attendance.date,
        status: attendance.status,
        courseCode: courses.code,
        courseTitle: courses.title,
      })
      .from(attendance)
      .innerJoin(courses, eq(attendance.courseId, courses.id))
      .where(and(
        eq(attendance.studentId, studentId),
        eq(attendance.sessionId, sessionId)
      ))
      .orderBy(desc(attendance.date))
      .limit(200);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[student/attendance] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/student/timetable
// ============================================================
router.get('/timetable', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = req.user.currentSessionId || 1;

    const regs = await db
      .select({ courseId: courseRegistrations.courseId })
      .from(courseRegistrations)
      .where(and(
        eq(courseRegistrations.studentId, studentId),
        eq(courseRegistrations.sessionId, sessionId)
      ));

    const courseIds = regs.map(r => r.courseId);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const rows = await db
      .select({
        id: timetableSlots.id,
        dayOfWeek: timetableSlots.dayOfWeek,
        startTime: timetableSlots.startTime,
        endTime: timetableSlots.endTime,
        venue: timetableSlots.venue,
        courseCode: courses.code,
        courseTitle: courses.title,
      })
      .from(timetableSlots)
      .innerJoin(courses, eq(timetableSlots.courseId, courses.id))
      .where(inArray(timetableSlots.courseId, courseIds))
      .orderBy(timetableSlots.dayOfWeek, timetableSlots.startTime);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[student/timetable] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/student/available-courses
// Returns courses the student can register for
// ============================================================
router.get('/available-courses', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });

    const rows = await db
      .select({
        id: courses.id,
        code: courses.code,
        title: courses.title,
        unit: courses.unit,
        level: courses.level,
        semesterName: courses.semesterName,
      })
      .from(courses)
      .where(and(
        eq(courses.departmentId, student.departmentId),
        eq(courses.level, student.level)
      ))
      .orderBy(courses.code);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[student/available-courses] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/student/registered-courses (Alias for existing /courses)
// ============================================================
router.get('/registered-courses', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = req.user.currentSessionId || 1;

    const rows = await db
      .select({
        id: courseRegistrations.id,
        courseCode: courses.code,
        courseTitle: courses.title,
        unit: courses.unit,
        semester: courseRegistrations.semester,
        status: courseRegistrations.status,
      })
      .from(courseRegistrations)
      .innerJoin(courses, eq(courseRegistrations.courseId, courses.id))
      .where(and(
        eq(courseRegistrations.studentId, studentId),
        eq(courseRegistrations.sessionId, sessionId)
      ))
      .orderBy(courses.code);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[student/registered-courses] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// DELETE /api/student/drop-course/:id
// ============================================================
router.delete('/drop-course/:id', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const regId = Number(req.params.id);

    // Verify the registration belongs to this student and is still pending
    const [reg] = await db.select().from(courseRegistrations)
      .where(and(
        eq(courseRegistrations.id, regId),
        eq(courseRegistrations.studentId, studentId),
        eq(courseRegistrations.status, 'pending')
      )).limit(1);

    if (!reg) {
      return res.status(403).json({ success: false, error: 'Cannot drop this course (already approved or not yours).' });
    }

    await db.delete(courseRegistrations).where(eq(courseRegistrations.id, regId));
    return res.json({ success: true, message: 'Course dropped.' });
  } catch (err) {
    console.error('[student/drop-course] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;