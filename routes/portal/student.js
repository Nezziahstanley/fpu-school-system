// ============================================================
// FPU — Student portal API
// Mounted at /api/student
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');

// Cloudinary setup
const { storage } = require('../../utils/cloudinary');
const upload = multer({ storage });

const { db, schema } = require('../../db');
const { eq, and, desc, sql, inArray } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');

const { 
  users, courses, results, courseRegistrations, academicSessions,
  programmes, departments, courseMaterials, assignments,
  assignmentSubmissions, attendance, timetableSlots, examSchedules
} = schema;

const only = requireRole('student', 'admin');

// ============================================================
// GET /api/student/dashboard
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = req.user.currentSessionId || 1;

    const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });

    const regs = await db
      .select({
        courseCode: courses.code, courseTitle: courses.title, unit: courses.unit,
        semester: courseRegistrations.semester, status: courseRegistrations.status,
      })
      .from(courseRegistrations)
      .innerJoin(courses, eq(courseRegistrations.courseId, courses.id))
      .where(and(eq(courseRegistrations.studentId, studentId), eq(courseRegistrations.sessionId, sessionId)))
      .orderBy(courses.code);

    const allResults = await db
      .select({
        courseCode: courses.code, courseTitle: courses.title, unit: courses.unit,
        score: results.score, grade: results.grade, points: results.points,
        semester: results.semester, sessionName: academicSessions.name,
      })
      .from(results)
      .innerJoin(courses, eq(results.courseId, courses.id))
      .leftJoin(academicSessions, eq(results.sessionId, academicSessions.id))
      .where(and(eq(results.studentId, studentId), eq(results.status, 'published')))
      .orderBy(courses.code);

    const uniqueResults = [];
    const seen = new Set();
    allResults.forEach(r => {
      if (!seen.has(r.courseCode)) { seen.add(r.courseCode); uniqueResults.push(r); }
    });

    let totalPoints = 0, totalUnits = 0;
    uniqueResults.forEach(r => {
      const unit = Number(r.unit) || 0;
      const points = Number(r.points) || 0;
      totalPoints += (points * unit);
      totalUnits += unit;
    });
    const cgpa = totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '0.00';

    const recentResults = uniqueResults.slice(-5).reverse();

    return res.json({
      success: true,
      data: {
        student: {
          id: student.id, firstName: student.firstName, lastName: student.lastName,
          matricNumber: (student.matricNumber || '').replace(/SMT/gi, '').trim(),
          level: student.level, programmeId: student.programmeId,
        },
        registeredCourses: regs,
        totalRegistered: regs.length,
        totalUnits: regs.reduce((sum, r) => sum + Number(r.unit || 0), 0),
        cgpa, currentGpa: cgpa, recentResults,
      }
    });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// GET /api/student/results
// ============================================================
router.get('/results', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const rows = await db
      .select({
        id: results.id, courseCode: courses.code, courseTitle: courses.title, unit: courses.unit,
        score: results.score, grade: results.grade, points: results.points,
        semester: results.semester, sessionName: academicSessions.name,
      })
      .from(results)
      .innerJoin(courses, eq(results.courseId, courses.id))
      .leftJoin(academicSessions, eq(results.sessionId, academicSessions.id))
      .where(and(eq(results.studentId, studentId), eq(results.status, 'published')))
      .orderBy(academicSessions.name, results.semester, courses.code);

    const uniqueResults = [];
    const seen = new Set();
    rows.forEach(r => {
      const key = `${r.courseCode}-${r.semester}-${r.sessionName}`;
      if (!seen.has(key)) { seen.add(key); uniqueResults.push(r); }
    });

    let totalPoints = 0, totalUnits = 0;
    uniqueResults.forEach(r => {
      const unit = Number(r.unit) || 0;
      const points = Number(r.points) || 0;
      totalPoints += (points * unit);
      totalUnits += unit;
    });
    const cgpa = totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '0.00';

    let classification = '';
    const val = parseFloat(cgpa);
    if (val >= 3.50) classification = 'Distinction';
    else if (val >= 3.00) classification = 'Upper Credit';
    else if (val >= 2.50) classification = 'Lower Credit';
    else if (val >= 2.00) classification = 'Pass';
    else if (val >= 1.00) classification = 'Probation';
    else classification = 'Fail';

    return res.json({ success: true, data: { results: uniqueResults, cgpa, currentGpa: cgpa, totalUnits, classification } });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// GET /api/student/transcript
// ============================================================
router.get('/transcript', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const [student] = await db.select({
      id: users.id, firstName: users.firstName, lastName: users.lastName,
      matricNumber: users.matricNumber, level: users.level,
    }).from(users).where(eq(users.id, studentId)).limit(1);

    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });

    const rows = await db
      .select({
        courseCode: courses.code, courseTitle: courses.title, unit: courses.unit,
        score: results.score, grade: results.grade, points: results.points,
        semester: results.semester, sessionName: academicSessions.name,
      })
      .from(results)
      .innerJoin(courses, eq(results.courseId, courses.id))
      .leftJoin(academicSessions, eq(results.sessionId, academicSessions.id))
      .where(and(eq(results.studentId, studentId), eq(results.status, 'published')))
      .orderBy(academicSessions.name, results.semester, courses.code);

    const uniqueResults = [];
    const seen = new Set();
    rows.forEach(r => {
      if (!seen.has(r.courseCode)) { seen.add(r.courseCode); uniqueResults.push(r); }
    });

    let totalPoints = 0, totalUnits = 0;
    uniqueResults.forEach(r => {
      const unit = Number(r.unit) || 0;
      const points = Number(r.points) || 0;
      totalPoints += (points * unit);
      totalUnits += unit;
    });
    const cgpa = totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '0.00';

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
        student: { ...student, matricNumber: (student?.matricNumber || '').replace(/SMT/gi, '').trim() },
        results: uniqueResults, cgpa, totalUnits, classification,
      }
    });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// COURSES & REGISTRATION
// ============================================================
router.get('/courses', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = req.user.currentSessionId || 1;

    const rows = await db
      .select({
        id: courseRegistrations.id, courseCode: courses.code, courseTitle: courses.title,
        unit: courses.unit, semester: courseRegistrations.semester, status: courseRegistrations.status,
      })
      .from(courseRegistrations)
      .innerJoin(courses, eq(courseRegistrations.courseId, courses.id))
      .where(and(eq(courseRegistrations.studentId, studentId), eq(courseRegistrations.sessionId, sessionId)))
      .orderBy(courses.code);

    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.get('/registered-courses', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = req.user.currentSessionId || 1;

    const rows = await db
      .select({
        id: courseRegistrations.id, courseCode: courses.code, courseTitle: courses.title,
        unit: courses.unit, semester: courseRegistrations.semester, status: courseRegistrations.status,
      })
      .from(courseRegistrations)
      .innerJoin(courses, eq(courseRegistrations.courseId, courses.id))
      .where(and(eq(courseRegistrations.studentId, studentId), eq(courseRegistrations.sessionId, sessionId)))
      .orderBy(courses.code);

    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.get('/available-courses', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });

    const rows = await db
      .select({ id: courses.id, code: courses.code, title: courses.title, unit: courses.unit, level: courses.level, semesterName: courses.semesterName })
      .from(courses)
      .where(and(eq(courses.departmentId, student.departmentId), eq(courses.level, student.level)))
      .orderBy(courses.code);

    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.post('/register-course', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { courseId, semester } = req.body || {};
    const sessionId = req.user.currentSessionId || 1;

    if (!courseId || !semester) return res.status(400).json({ success: false, error: 'courseId and semester are required.' });

    const [row] = await db.insert(courseRegistrations).values({
      studentId, courseId: Number(courseId), sessionId, semester, status: 'pending',
    }).onConflictDoNothing().returning();

    return res.status(201).json({ success: true, data: row });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/drop-course/:id', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const regId = Number(req.params.id);

    const [reg] = await db.select().from(courseRegistrations)
      .where(and(eq(courseRegistrations.id, regId), eq(courseRegistrations.studentId, studentId), eq(courseRegistrations.status, 'pending')))
      .limit(1);

    if (!reg) return res.status(403).json({ success: false, error: 'Cannot drop this course.' });

    await db.delete(courseRegistrations).where(eq(courseRegistrations.id, regId));
    return res.json({ success: true, message: 'Course dropped.' });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// MATERIALS
// ============================================================
router.get('/materials', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = req.user.currentSessionId || 1;

    const regs = await db.select({ courseId: courseRegistrations.courseId }).from(courseRegistrations)
      .where(and(eq(courseRegistrations.studentId, studentId), eq(courseRegistrations.sessionId, sessionId)));

    const courseIds = regs.map(r => r.courseId);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const rows = await db
      .select({
        id: courseMaterials.id, title: courseMaterials.title, description: courseMaterials.description,
        fileUrl: courseMaterials.fileUrl, materialType: courseMaterials.materialType,
        createdAt: courseMaterials.createdAt, courseCode: courses.code,
      })
      .from(courseMaterials)
      .innerJoin(courses, eq(courseMaterials.courseId, courses.id))
      .where(inArray(courseMaterials.courseId, courseIds))
      .orderBy(desc(courseMaterials.createdAt));

    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// ASSIGNMENTS (FULLY FIXED)
// ============================================================
router.get('/assignments', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = req.user.currentSessionId || 1;

    // 1. Get registered course IDs
    const regs = await db
      .select({ courseId: courseRegistrations.courseId })
      .from(courseRegistrations)
      .where(and(
        eq(courseRegistrations.studentId, studentId),
        eq(courseRegistrations.sessionId, sessionId)
      ));

    const courseIds = regs.map(r => r.courseId);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    // 2. Fetch assignments with course details
    const assignmentsList = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        dueDate: assignments.dueDate,
        maxScore: assignments.maxScore,
        attachmentUrl: assignments.attachmentUrl,
        courseCode: courses.code,
        courseTitle: courses.title,
      })
      .from(assignments)
      .innerJoin(courses, eq(assignments.courseId, courses.id))
      .where(inArray(assignments.courseId, courseIds))
      .orderBy(desc(assignments.createdAt));

    // 3. Fetch submissions for this student
    const submissions = await db
      .select({
        assignmentId: assignmentSubmissions.assignmentId,
        submissionText: assignmentSubmissions.submissionText,
        submissionUrl: assignmentSubmissions.submissionUrl,
        score: assignmentSubmissions.score,
        feedback: assignmentSubmissions.feedback,
        submittedAt: assignmentSubmissions.submittedAt,
        gradedAt: assignmentSubmissions.gradedAt,
      })
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.studentId, studentId));

    const submissionMap = {};
    submissions.forEach(s => {
      submissionMap[s.assignmentId] = s;
    });

    // 4. Merge assignment with submission info
    const data = assignmentsList.map(a => ({
      ...a,
      submission: submissionMap[a.id] || null,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[student/assignments] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/assignments/:id/submit', only, upload.single('file'), async (req, res, next) => {
  try {
    const assignmentId = Number(req.params.id);
    const studentId = req.user.id;

    const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
    if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found.' });

    const [registration] = await db.select().from(courseRegistrations)
      .where(and(eq(courseRegistrations.studentId, studentId), eq(courseRegistrations.courseId, assignment.courseId), eq(courseRegistrations.status, 'approved')))
      .limit(1);
    if (!registration) return res.status(403).json({ success: false, error: 'You are not registered for this course.' });

    let submissionUrl = null;
    if (req.file) {
      submissionUrl = req.file.path; // Cloudinary URL
    }

    const [row] = await db.insert(assignmentSubmissions).values({
      assignmentId, studentId, submissionText: req.body.text || null, submissionUrl, submittedAt: new Date(),
    }).onConflictDoUpdate({
      target: [assignmentSubmissions.assignmentId, assignmentSubmissions.studentId],
      set: { submissionText: req.body.text || null, submissionUrl: submissionUrl || null, submittedAt: new Date(), score: null, feedback: null, gradedAt: null }
    }).returning();

    return res.status(201).json({ success: true, data: row });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// ATTENDANCE
// ============================================================
router.get('/attendance', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const rows = await db
      .select({ id: attendance.id, date: attendance.date, status: attendance.status, courseId: attendance.courseId })
      .from(attendance)
      .where(eq(attendance.studentId, studentId))
      .orderBy(desc(attendance.date));

    const courseIds = [...new Set(rows.map(r => r.courseId))];
    let courseMap = {};
    if (courseIds.length > 0) {
      const courseList = await db.select({ id: courses.id, code: courses.code, title: courses.title }).from(courses).where(inArray(courses.id, courseIds));
      courseList.forEach(c => { courseMap[c.id] = c; });
    }

    const data = rows.map(r => ({
      id: r.id, date: r.date, status: r.status,
      courseCode: courseMap[r.courseId]?.code || '—',
      courseTitle: courseMap[r.courseId]?.title || '—',
    }));

    return res.json({ success: true, data });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// TIMETABLE
// ============================================================
router.get('/timetable', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = req.user.currentSessionId || 1;

    const regs = await db.select({ courseId: courseRegistrations.courseId }).from(courseRegistrations)
      .where(and(eq(courseRegistrations.studentId, studentId), eq(courseRegistrations.sessionId, sessionId)));

    const courseIds = regs.map(r => r.courseId);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const rows = await db
      .select({
        id: timetableSlots.id, dayOfWeek: timetableSlots.dayOfWeek, startTime: timetableSlots.startTime,
        endTime: timetableSlots.endTime, venue: timetableSlots.venue, semester: timetableSlots.semester,
        courseCode: courses.code, courseTitle: courses.title, level: courses.level, sessionName: academicSessions.name,
      })
      .from(timetableSlots)
      .innerJoin(courses, eq(timetableSlots.courseId, courses.id))
      .leftJoin(academicSessions, eq(timetableSlots.sessionId, academicSessions.id))
      .where(inArray(timetableSlots.courseId, courseIds))
      .orderBy(timetableSlots.dayOfWeek, timetableSlots.startTime);

    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// EXAM SCHEDULE
// ============================================================
router.get('/exam-schedule', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = req.user.currentSessionId || 1;

    const regs = await db.select({ courseId: courseRegistrations.courseId }).from(courseRegistrations)
      .where(and(eq(courseRegistrations.studentId, studentId), eq(courseRegistrations.sessionId, sessionId)));

    const courseIds = regs.map(r => r.courseId);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const rows = await db
      .select({
        id: examSchedules.id, examDate: examSchedules.examDate, startTime: examSchedules.startTime,
        endTime: examSchedules.endTime, venue: examSchedules.venue, semester: examSchedules.semester,
        courseCode: courses.code, courseTitle: courses.title, level: courses.level, sessionName: academicSessions.name,
      })
      .from(examSchedules)
      .innerJoin(courses, eq(examSchedules.courseId, courses.id))
      .leftJoin(academicSessions, eq(examSchedules.sessionId, academicSessions.id))
      .where(inArray(examSchedules.courseId, courseIds))
      .orderBy(examSchedules.examDate, examSchedules.startTime);

    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// GET /api/student/fees
// ============================================================
router.get('/fees', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = req.user.currentSessionId || 1;

    const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });

    // 1. Get fee structure for this student's programme + level + session
    let totalDue = 0;
    try {
      const feeQueries = require('../../db/queries/payments');
      const feeStructure = await feeQueries.findFeeStructureWithFallback({
        programmeId: student.programmeId,
        level: student.level || 'ND',
        sessionId,
      });
      totalDue = Number(feeStructure?.total || 0);
    } catch (e) {
      console.warn('[student/fees] Fee structure lookup failed:', e.message);
    }

    // 2. Get payment history
    let payments = [];
    try {
      const paymentQueries = require('../../db/queries/payments');
      const rows = await paymentQueries.listForStudent(studentId, sessionId);
      payments = (rows || []).map(p => ({
        id: p.id,
        date: p.paymentDate || p.createdAt,
        reference: p.reference || '—',
        amount: Number(p.amount || 0),
        method: p.method || '—',
        status: p.status || 'pending',
      }));
    } catch (e) {
      console.warn('[student/fees] Payment history lookup failed:', e.message);
    }

    const totalPaid = payments
      .filter(p => p.status === 'verified' || p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const balance = Math.max(0, totalDue - totalPaid);

    return res.json({
      success: true,
      data: {
        totalDue,
        totalPaid,
        balance,
        payments,
      }
    });
  } catch (err) {
    console.error('[student/fees] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/student/clearance
// ============================================================
router.get('/clearance', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const clearQueries = require('../../db/queries/clearances');
    const rows = await clearQueries.listForStudent(studentId);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    console.error('[student/clearance] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/student/clearance/request
// ============================================================
router.post('/clearance/request', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { type } = req.body || {};
    const sessionId = req.user.currentSessionId || 1;

    if (!type) {
      return res.status(400).json({ success: false, error: 'Clearance type is required.' });
    }

    const clearQueries = require('../../db/queries/clearances');
    const row = await clearQueries.create({
      studentId,
      sessionId,
      type,
      status: 'pending',
    });

    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error('[student/clearance/request] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;