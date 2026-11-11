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
  assignmentSubmissions, attendance, timetableSlots, examSchedules,
  clearances, documents
} = schema;

const only = requireRole('student', 'admin');

// Resolve the active academic session from the database. A user's cached session
// is only used when no session is marked current and that session still exists.
async function resolveCurrentAcademicSessionId(req) {
  const [activeSession] = await db
    .select({ id: academicSessions.id })
    .from(academicSessions)
    .where(eq(academicSessions.isCurrent, true))
    .limit(1);

  if (activeSession?.id) return activeSession.id;

  const userSessionId = Number(req.user?.currentSessionId);
  if (!Number.isInteger(userSessionId) || userSessionId <= 0) return null;

  const [userSession] = await db
    .select({ id: academicSessions.id })
    .from(academicSessions)
    .where(eq(academicSessions.id, userSessionId))
    .limit(1);

  return userSession?.id || null;
}

// ============================================================
// GET /api/student/dashboard
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = await resolveCurrentAcademicSessionId(req);
    if (!sessionId) return res.status(409).json({ success: false, error: 'There is no active academic session. Please contact the Academic Office.' });

    const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });

    const regs = sessionId ? await db
      .select({
        courseCode: courses.code, courseTitle: courses.title, unit: courses.unit,
        semester: courseRegistrations.semester, status: courseRegistrations.status,
      })
      .from(courseRegistrations)
      .innerJoin(courses, eq(courseRegistrations.courseId, courses.id))
      .where(and(eq(courseRegistrations.studentId, studentId), eq(courseRegistrations.sessionId, sessionId)))
      .orderBy(courses.code) : [];

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
      const key = `${r.courseCode}-${r.semester}-${r.sessionName || ''}`;
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
// FEES & PAYMENTS
// ============================================================
router.get('/fees', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = await resolveCurrentAcademicSessionId(req);
    if (!sessionId) return res.status(409).json({ success: false, error: 'There is no active academic session. Please contact the Academic Office.' });

    // 1. Get the Student's Programme and Level
    const userResult = await db.execute(sql`
      SELECT programme_id AS "programmeId", level 
      FROM users 
      WHERE id = ${studentId} 
      LIMIT 1
    `);
    const student = userResult.rows?.[0];
    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });

    // 2. Calculate Total Due
    let totalDue = 0;
    try {
      const feeResult = await db.execute(sql`
        SELECT SUM(amount)::int AS total
        FROM fee_structures
        WHERE session_id = ${sessionId} 
          AND (programme_id = ${student.programmeId} OR programme_id IS NULL)
          AND (level = ${student.level} OR level IS NULL)
      `);
      totalDue = feeResult.rows?.[0]?.total || 0;
    } catch (e) {
      console.warn('[fees] fee_structures table error:', e.message);
    }

    // 3. Get Payments
    const paymentsResult = await db.execute(sql`
      SELECT 
        id, 
        amount, 
        reference, 
        status, 
        COALESCE(bank_name, 'Bank Transfer') AS "method",
        COALESCE(created_at, NOW()) AS "date"
      FROM payments
      WHERE student_id = ${studentId} AND session_id = ${sessionId}
      ORDER BY created_at DESC
    `);
    
    const payments = paymentsResult.rows || [];

    // 4. Count only canonical verified payments as paid. Pending, rejected
    // and refunded records remain visible in history but never reduce the balance.
    const paymentQueries = require('../../db/queries/payments');
    const totalPaid = Number(await paymentQueries.totalVerifiedForStudent(studentId, sessionId)) || 0;

    // 5. Calculate Balance
    const balance = Math.max(0, totalDue - totalPaid);

    return res.json({
      success: true,
      data: { totalDue, totalPaid, balance, payments }
    });

  } catch (err) {
    console.error('[student/fees] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// COURSES & REGISTRATION
// ============================================================
router.get('/courses', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = await resolveCurrentAcademicSessionId(req);

    const rows = sessionId ? await db
      .select({
        id: courseRegistrations.id, courseCode: courses.code, courseTitle: courses.title,
        unit: courses.unit, semester: courseRegistrations.semester, status: courseRegistrations.status,
      })
      .from(courseRegistrations)
      .innerJoin(courses, eq(courseRegistrations.courseId, courses.id))
      .where(and(eq(courseRegistrations.studentId, studentId), eq(courseRegistrations.sessionId, sessionId)))
      .orderBy(courses.code) : [];

    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.get('/registered-courses', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = await resolveCurrentAcademicSessionId(req);

    const rows = sessionId ? await db
      .select({
        id: courseRegistrations.id, courseCode: courses.code, courseTitle: courses.title,
        unit: courses.unit, semester: courseRegistrations.semester, status: courseRegistrations.status,
      })
      .from(courseRegistrations)
      .innerJoin(courses, eq(courseRegistrations.courseId, courses.id))
      .where(and(eq(courseRegistrations.studentId, studentId), eq(courseRegistrations.sessionId, sessionId)))
      .orderBy(courses.code) : [];

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
    const sessionId = await resolveCurrentAcademicSessionId(req);
    if (!sessionId) return res.status(409).json({ success: false, error: 'There is no active academic session. Please contact the Academic Office.' });

    const numericCourseId = Number(courseId);
    const normalizedSemester = String(semester || '').toLowerCase();
    if (!Number.isInteger(numericCourseId) || numericCourseId <= 0 || !['first', 'second'].includes(normalizedSemester)) {
      return res.status(400).json({ success: false, error: 'A valid course and semester (first or second) are required.' });
    }

    const [student] = await db.select({
      departmentId: users.departmentId,
      level: users.level,
      programmeId: users.programmeId
    }).from(users).where(eq(users.id, studentId)).limit(1);
    if (!student) return res.status(404).json({ success: false, error: 'Student account not found.' });

    const [course] = await db.select({
      id: courses.id,
      departmentId: courses.departmentId,
      level: courses.level
    }).from(courses).where(eq(courses.id, numericCourseId)).limit(1);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found.' });
    if (Number(course.departmentId) !== Number(student.departmentId) || String(course.level) !== String(student.level)) {
      return res.status(403).json({ success: false, error: 'You can only register courses assigned to your department and level.' });
    }

    const [existing] = await db.select({ id: courseRegistrations.id })
      .from(courseRegistrations)
      .where(and(
        eq(courseRegistrations.studentId, studentId),
        eq(courseRegistrations.courseId, numericCourseId),
        eq(courseRegistrations.sessionId, sessionId),
        eq(courseRegistrations.semester, normalizedSemester),
        inArray(courseRegistrations.status, ['pending', 'approved'])
      ))
      .limit(1);
    if (existing) return res.status(409).json({ success: false, error: 'You already have a pending or approved registration for this course in this semester.' });

    const [row] = await db.insert(courseRegistrations).values({
      studentId, courseId: numericCourseId, sessionId, semester: normalizedSemester, status: 'pending',
    }).onConflictDoNothing().returning();

    if (!row) return res.status(409).json({ success: false, error: 'This course registration already exists. Refresh your registrations.' });
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
    const sessionId = await resolveCurrentAcademicSessionId(req);
    if (!sessionId) return res.json({ success: true, data: [] });

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
// ASSIGNMENTS
// ============================================================
router.get('/assignments', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = await resolveCurrentAcademicSessionId(req);
    if (!sessionId) return res.json({ success: true, data: [] });

    const regs = await db
      .select({ courseId: courseRegistrations.courseId })
      .from(courseRegistrations)
      .where(and(eq(courseRegistrations.studentId, studentId), eq(courseRegistrations.sessionId, sessionId)));

    const courseIds = regs.map(r => r.courseId);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const assignmentsList = await db
      .select({
        id: assignments.id, title: assignments.title, description: assignments.description,
        dueDate: assignments.dueDate, maxScore: assignments.maxScore,
        attachmentUrl: assignments.attachmentUrl, courseCode: courses.code, courseTitle: courses.title,
      })
      .from(assignments)
      .innerJoin(courses, eq(assignments.courseId, courses.id))
      .where(inArray(assignments.courseId, courseIds))
      .orderBy(desc(assignments.createdAt));

    const submissions = await db
      .select({
        assignmentId: assignmentSubmissions.assignmentId,
        submissionText: assignmentSubmissions.submissionText,
        submissionUrl: assignmentSubmissions.submissionUrl,
        score: assignmentSubmissions.score, feedback: assignmentSubmissions.feedback,
        submittedAt: assignmentSubmissions.submittedAt, gradedAt: assignmentSubmissions.gradedAt,
      })
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.studentId, studentId));

    const submissionMap = {};
    submissions.forEach(s => { submissionMap[s.assignmentId] = s; });

    const data = assignmentsList.map(a => ({ ...a, submission: submissionMap[a.id] || null }));
    return res.json({ success: true, data });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
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
    if (req.file) { submissionUrl = req.file.path; }

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
    const sessionId = await resolveCurrentAcademicSessionId(req);
    if (!sessionId) return res.json({ success: true, data: [] });

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
    const sessionId = await resolveCurrentAcademicSessionId(req);
    if (!sessionId) return res.json({ success: true, data: [] });

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
// CLEARANCE
// ============================================================
router.get('/clearance', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    
    const clearancesResult = await db.execute(sql`
      SELECT c.id, c.type, c.status, c.session_id AS "sessionId",
             s.name AS "sessionName", c.created_at AS "createdAt",
             c.cleared_by AS "clearedBy", c.cleared_at AS "clearedAt",
             signer.first_name AS "signerFirstName", signer.last_name AS "signerLastName",
             signer.role AS "signerRole", signer.signature_url AS "signerSignatureUrl"
      FROM clearances c
      LEFT JOIN academic_sessions s ON c.session_id = s.id
      LEFT JOIN users signer ON signer.id = c.cleared_by
      WHERE c.student_id = ${studentId}
      ORDER BY c.created_at DESC
    `);
    
    const clearances = clearancesResult.rows || [];

    const studentResult = await db.execute(sql`
      SELECT first_name AS "firstName", last_name AS "lastName", matric_number AS "matricNumber", level
      FROM users
      WHERE id = ${studentId}
      LIMIT 1
    `);
    
    const student = studentResult.rows?.[0] || {};

    const data = clearances.map(c => ({ ...c, ...student }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[student/clearance] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/clearance/request', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { type } = req.body || {};
    const sessionId = await resolveCurrentAcademicSessionId(req);
    if (!sessionId) return res.status(409).json({ success: false, error: 'There is no active academic session. Please contact the Academic Office.' });

    if (!type) return res.status(400).json({ success: false, error: 'Clearance type is required.' });

    const existing = await db.execute(sql`
      SELECT id FROM clearances WHERE student_id = ${studentId} AND type = ${type} AND session_id = ${sessionId}
    `);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: `You have already requested a ${type} for this session.` });
    }

    const row = await db.execute(sql`
      INSERT INTO clearances (student_id, session_id, type, status, created_at)
      VALUES (${studentId}, ${sessionId}, ${type}, 'pending', NOW())
      RETURNING id, type, status, session_id AS "sessionId", created_at AS "createdAt"
    `);

    return res.status(201).json({ success: true, data: row.rows[0] });
  } catch (err) {
    console.error('[student/clearance/request] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// DOCUMENTS
// ============================================================
router.get('/documents', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const result = await db.execute(sql`
      SELECT d.id, d.type, d.title, d.status,
             d.requested_at AS "createdAt", d.file_url AS "fileUrl",
             d.issued_by AS "issuedBy", d.issued_at AS "issuedAt",
             issuer.first_name AS "issuerFirstName", issuer.last_name AS "issuerLastName",
             issuer.role AS "issuerRole", issuer.signature_url AS "issuerSignatureUrl"
      FROM documents d
      LEFT JOIN users issuer ON issuer.id = d.issued_by
      WHERE d.user_id = ${studentId}
      ORDER BY d.requested_at DESC
    `);
    return res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    console.error('[student/documents] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/documents/request', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { type, title } = req.body || {};

    if (!type || !title) return res.status(400).json({ success: false, error: 'Document type and title are required.' });

    const result = await db.execute(sql`
      INSERT INTO documents (user_id, type, title, status, requested_at)
      VALUES (${studentId}, ${type}, ${title}, 'pending', NOW())
      RETURNING id, type, title, status, requested_at AS "createdAt"
    `);

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[student/documents/request] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// ID CARD
// ============================================================
router.get('/id-card', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const [student] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        matricNumber: users.matricNumber,
        level: users.level,
        photoUrl: users.photoUrl,
        departmentName: departments.name,
        programmeName: programmes.name,
        email: users.email,
        phone: users.phone,
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .where(eq(users.id, studentId))
      .limit(1);

    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });

    const [session] = await db.select().from(academicSessions).where(eq(academicSessions.isCurrent, true)).limit(1);

    const regs = session ? await db
      .select({ code: courses.code })
      .from(courseRegistrations)
      .innerJoin(courses, eq(courseRegistrations.courseId, courses.id))
      .where(and(
        eq(courseRegistrations.studentId, studentId),
        eq(courseRegistrations.sessionId, session.id),
        eq(courseRegistrations.status, 'approved')
      ))
      .orderBy(courses.code) : [];

    const cleanMatric = (student.matricNumber || '').replace(/SMT/gi, '').trim();
    const verifyUrl = `https://fpu-school-systems.onrender.com/portal/verify.html?matric=${encodeURIComponent(cleanMatric)}`;

    return res.json({
      success: true,
      data: {
        ...student,
        matricNumber: cleanMatric,
        sessionName: session?.name || 'No active session',
        courses: regs.map(r => r.code),
        verifyUrl: verifyUrl,
      }
    });
  } catch (err) {
    console.error('[student/id-card] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// PUBLIC STUDENT VERIFICATION (for QR code scanning)
// ============================================================
router.get('/verify/student/:matric', async (req, res, next) => {
  try {
    const { matric } = req.params;

    const [student] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        matricNumber: users.matricNumber,
        level: users.level,
        photoUrl: users.photoUrl,
        email: users.email,
        departmentName: departments.name,
        programmeName: programmes.name,
        isActive: users.isActive,
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .where(eq(users.matricNumber, matric))
      .limit(1);

    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });

    return res.json({ success: true, data: student });
  } catch (err) {
    console.error('[verify/student] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/student/graduation
// ============================================================
router.get('/graduation', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });

    const existingResult = await db.execute(sql`
      SELECT id, session_id AS "sessionId", level, cgpa, classification, status, approved_at AS "approvedAt"
      FROM graduations
      WHERE student_id = ${studentId}
      ORDER BY id DESC
      LIMIT 1
    `);
    const existing = existingResult.rows?.[0] || null;

    const resultsRows = await db
      .select({ unit: courses.unit, points: results.points })
      .from(results)
      .innerJoin(courses, eq(results.courseId, courses.id))
      .where(and(eq(results.studentId, studentId), eq(results.status, 'published')));

    let totalPoints = 0, totalUnits = 0;
    resultsRows.forEach(r => {
      const unit = Number(r.unit) || 0;
      totalPoints += ((Number(r.points) || 0) * unit);
      totalUnits += unit;
    });
    const cgpa = totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '0.00';
    const cgpaNum = parseFloat(cgpa);

    let feesCleared = false;
    try {
      const paymentQueries = require('../../db/queries/payments');
      const sessionId = await resolveCurrentAcademicSessionId(req);
      if (sessionId) {
        const feeStructure = await paymentQueries.findFeeStructureWithFallback({
          programmeId: student.programmeId, level: student.level || 'ND', sessionId,
        });
        const totalDue = Number(feeStructure?.total || 0);
        const totalPaid = Number(await paymentQueries.totalVerifiedForStudent(studentId, sessionId)) || 0;
        feesCleared = totalDue === 0 || totalPaid >= totalDue;
      } else {
        feesCleared = false;
      }
    } catch (e) { console.warn('[graduation/fees]', e.message); }

    let clearancesOk = false;
    try {
      const clrResult = await db.execute(sql`SELECT status FROM clearances WHERE student_id = ${studentId}`);
      const clrRows = clrResult.rows || [];
      const approved = clrRows.filter(c => c.status === 'approved' || c.status === 'cleared').length;
      clearancesOk = clrRows.length === 0 || approved === clrRows.length;
    } catch (e) { console.warn('[graduation/clearances]', e.message); }

    let classification = 'Fail';
    if (cgpaNum >= 3.50) classification = 'Distinction';
    else if (cgpaNum >= 3.00) classification = 'Upper Credit';
    else if (cgpaNum >= 2.50) classification = 'Lower Credit';
    else if (cgpaNum >= 2.00) classification = 'Pass';

    const isEligible = cgpaNum >= 2.00 && feesCleared && clearancesOk;

    return res.json({
      success: true,
      data: {
        student: {
          firstName: student.firstName,
          lastName: student.lastName,
          matricNumber: (student.matricNumber || '').replace(/SMT/gi, '').trim(),
          level: student.level,
        },
        cgpa,
        classification,
        eligibility: { cgpa: cgpaNum >= 2.00, fees: feesCleared, clearances: clearancesOk, overall: isEligible },
        application: existing,
      }
    });
  } catch (err) {
    console.error('[student/graduation] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/student/graduation/apply
// ============================================================
router.post('/graduation/apply', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const sessionId = await resolveCurrentAcademicSessionId(req);
    if (!sessionId) return res.status(409).json({ success: false, error: 'There is no active academic session. Please contact the Academic Office.' });

    const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });

    const existing = await db.execute(sql`
      SELECT id FROM graduations WHERE student_id = ${studentId} LIMIT 1
    `);
    if (existing.rows.length) {
      return res.status(400).json({ success: false, error: 'You have already applied for graduation.' });
    }

    const results = await db
      .select({ unit: courses.unit, points: results.points })
      .from(results)
      .innerJoin(courses, eq(results.courseId, courses.id))
      .where(and(eq(results.studentId, studentId), eq(results.status, 'published')));

    let totalPoints = 0, totalUnits = 0;
    results.forEach(r => {
      const unit = Number(r.unit) || 0;
      totalPoints += ((Number(r.points) || 0) * unit);
      totalUnits += unit;
    });
    const cgpa = totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '0.00';
    const cgpaNum = parseFloat(cgpa);

    if (cgpaNum < 2.00) {
      return res.status(400).json({ success: false, error: 'Minimum CGPA of 2.00 required to apply for graduation.' });
    }

    let classification = 'Fail';
    if (cgpaNum >= 3.50) classification = 'Distinction';
    else if (cgpaNum >= 3.00) classification = 'Upper Credit';
    else if (cgpaNum >= 2.50) classification = 'Lower Credit';
    else if (cgpaNum >= 2.00) classification = 'Pass';

    const row = await db.execute(sql`
      INSERT INTO graduations (student_id, session_id, programme_id, level, cgpa, classification, status)
      VALUES (${studentId}, ${sessionId}, ${student.programmeId || null}, ${student.level}, ${cgpa}, ${classification}, 'pending')
      RETURNING id, session_id AS "sessionId", level, cgpa, classification, status
    `);

    return res.status(201).json({ success: true, data: row.rows[0] });
  } catch (err) {
    console.error('[student/graduation/apply] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// LIBRARY ROUTES
// ============================================================

router.get('/library/catalogue', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const result = await db.execute(sql`
      SELECT b.id, b.title, b.author, b.isbn, b.category, b.publisher, b.year,
             b.copies_total AS "copiesTotal", b.copies_available AS "copiesAvailable",
             b.ebook_url AS "ebookUrl", b.external_url AS "externalUrl",
             b.external_source AS "externalSource", b.description,
             b.is_digital AS "isDigital", b.is_physical AS "isPhysical",
             EXISTS(SELECT 1 FROM book_borrows WHERE book_id = b.id AND user_id = ${studentId} AND status = 'active') AS "alreadyBorrowed",
             EXISTS(SELECT 1 FROM book_reservations WHERE book_id = b.id AND user_id = ${studentId} AND status = 'pending') AS "alreadyReserved"
      FROM books b
      ORDER BY b.title ASC
    `);
    return res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/library/borrows', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const result = await db.execute(sql`
      SELECT bb.id, bb.book_id AS "bookId", bb.borrowed_at AS "borrowedAt", bb.due_at AS "dueAt",
             bb.returned_at AS "returnedAt", bb.status,
             b.title, b.author, b.isbn, b.ebook_url AS "ebookUrl"
      FROM book_borrows bb
      INNER JOIN books b ON bb.book_id = b.id
      WHERE bb.user_id = ${studentId}
      ORDER BY bb.borrowed_at DESC
    `);
    return res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/library/reservations', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const result = await db.execute(sql`
      SELECT br.id, br.reserved_at AS "reservedAt", br.status,
             b.title, b.author
      FROM book_reservations br
      INNER JOIN books b ON br.book_id = b.id
      WHERE br.user_id = ${studentId}
      ORDER BY br.reserved_at DESC
    `);
    return res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/library/borrow', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { bookId } = req.body || {};
    if (!bookId) return res.status(400).json({ success: false, error: 'bookId required.' });

    const bookResult = await db.execute(sql`
      SELECT id, copies_available AS "copiesAvailable" FROM books WHERE id = ${Number(bookId)} LIMIT 1
    `);
    const book = bookResult.rows?.[0];
    if (!book) return res.status(404).json({ success: false, error: 'Book not found.' });
    if (book.copiesAvailable <= 0) return res.status(400).json({ success: false, error: 'No copies available. Reserve it instead.' });

    const existing = await db.execute(sql`
      SELECT id FROM book_borrows WHERE user_id = ${studentId} AND book_id = ${Number(bookId)} AND status = 'active' LIMIT 1
    `);
    if (existing.rows?.length) return res.status(400).json({ success: false, error: 'Already borrowed.' });

    const activeCount = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM book_borrows WHERE user_id = ${studentId} AND status = 'active'
    `);
    if ((activeCount.rows?.[0]?.count || 0) >= 3) {
      return res.status(400).json({ success: false, error: 'Max 3 active borrows.' });
    }

    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 14);

    await db.execute(sql`
      INSERT INTO book_borrows (book_id, user_id, due_at, status)
      VALUES (${Number(bookId)}, ${studentId}, ${dueAt.toISOString()}, 'active')
    `);

    await db.execute(sql`
      UPDATE books SET copies_available = copies_available - 1 WHERE id = ${Number(bookId)}
    `);

    return res.status(201).json({ success: true, dueAt });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/library/return/:id', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const borrowId = Number(req.params.id);

    const borrowResult = await db.execute(sql`
      SELECT id, book_id AS "bookId", due_at AS "dueAt"
      FROM book_borrows
      WHERE id = ${borrowId} AND user_id = ${studentId} AND status = 'active'
      LIMIT 1
    `);
    const borrow = borrowResult.rows?.[0];
    if (!borrow) return res.status(404).json({ success: false, error: 'Borrow not found.' });

    await db.execute(sql`
      UPDATE book_borrows SET returned_at = NOW(), status = 'returned' WHERE id = ${borrowId}
    `);

    await db.execute(sql`
      UPDATE books SET copies_available = copies_available + 1 WHERE id = ${borrow.bookId}
    `);

    const now = new Date();
    const dueDate = new Date(borrow.dueAt);
    let fine = null;
    if (now > dueDate) {
      const daysLate = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      const amount = daysLate * 100;
      const fineResult = await db.execute(sql`
        INSERT INTO library_fines (user_id, borrow_id, amount, reason, is_paid)
        VALUES (${studentId}, ${borrowId}, ${amount}, ${'Overdue by ' + daysLate + ' day(s)'}, false)
        RETURNING id, amount
      `);
      fine = fineResult.rows?.[0];
    }

    return res.json({ success: true, fine });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/library/reserve', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { bookId } = req.body || {};
    if (!bookId) return res.status(400).json({ success: false, error: 'bookId required.' });

    const existing = await db.execute(sql`
      SELECT id FROM book_reservations
      WHERE user_id = ${studentId} AND book_id = ${Number(bookId)} AND status = 'pending'
      LIMIT 1
    `);
    if (existing.rows?.length) return res.status(400).json({ success: false, error: 'Already reserved.' });

    await db.execute(sql`
      INSERT INTO book_reservations (book_id, user_id, status)
      VALUES (${Number(bookId)}, ${studentId}, 'pending')
    `);

    return res.status(201).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/library/reserve/:id', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    await db.execute(sql`
      DELETE FROM book_reservations WHERE id = ${Number(req.params.id)} AND user_id = ${studentId}
    `);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/library/fines', only, async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const result = await db.execute(sql`
      SELECT lf.id, lf.amount, lf.reason, lf.is_paid AS "isPaid", lf.paid_at AS "paidAt", lf.created_at AS "createdAt",
             b.title
      FROM library_fines lf
      LEFT JOIN book_borrows bb ON lf.borrow_id = bb.id
      LEFT JOIN books b ON bb.book_id = b.id
      WHERE lf.user_id = ${studentId}
      ORDER BY lf.created_at DESC
    `);
    return res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

module.exports = router;