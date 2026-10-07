// ============================================================
// FPU — Student portal API
// Mounted at /api/student
// ------------------------------------------------------------
// Every endpoint requires role=student. All ID resolution uses
// req.user.id — never trust client-supplied studentId.
// Route order: specific → generic.
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries = require('../../db/queries/users');
const regQueries = require('../../db/queries/registrations');
const resultQueries = require('../../db/queries/results');
const ttQueries = require('../../db/queries/timetable');
const examQueries = require('../../db/queries/exams');
const attQueries = require('../../db/queries/attendance');
const paymentQueries = require('../../db/queries/payments');
const clearQueries = require('../../db/queries/clearances');
const libQueries = require('../../db/queries/library');
const notifQueries = require('../../db/queries/notifications');
const sessionQueries = require('../../db/queries/sessions');
const settingsQueries = require('../../db/queries/settings');
const { db, schema } = require('../../db');
const { eq, and, desc, inArray } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');
const { computeStudentCGPA, classifyDegree } = require('../../utils/gpa');
const { logSecurity } = require('../../utils/audit');
const { scoreToGrade } = require('../../utils/gradeScale');

const { courseMaterials, assignments, assignmentSubmissions, documents, graduations, academicSessions, users } = schema;

const only = requireRole('student');

// ============================================================
// GET /api/student/registered-courses
// ============================================================
router.get('/registered-courses', only, async (req, res, next) => {
  try {
    const { sessionId, semester } = req.query;
    const rows = await regQueries.listWithCourse({
      studentId: req.user.id,
      sessionId,
      semester,
    });
    const totalUnits = rows
      .filter((r) => ['pending', 'approved'].includes(r.registration.status))
      .reduce((s, r) => s + (Number(r.course?.unit) || 0), 0);
    return res.json({ success: true, data: rows, totalUnits });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/student/results
// ============================================================
router.get('/results', only, async (req, res, next) => {
  try {
    const { sessionId, semester } = req.query;
    const rows = await resultQueries.publishedForStudent(req.user.id, { sessionId, semester });
    const summary = computeStudentCGPA(
      rows.map((r) => ({
        unit: Number(r.course?.unit) || 0,
        points: Number(r.result?.points) || 0,
        sessionId: r.result?.sessionId,
        semester: r.result?.semester,
      }))
    );
    return res.json({
      success: true,
      data: rows,
      summary: { ...summary, classification: classifyDegree(summary.cgpa) },
    });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/student/transcript
// ============================================================
router.get('/transcript', only, async (req, res, next) => {
  try {
    const rows = await resultQueries.publishedForStudent(req.user.id, {});
    const summary = computeStudentCGPA(
      rows.map((r) => ({
        unit: Number(r.course?.unit) || 0,
        points: Number(r.result?.points) || 0,
        sessionId: r.result?.sessionId,
        semester: r.result?.semester,
      }))
    );
    const student = await userQueries.findByIdWithRelations(req.user.id);
    return res.json({
      success: true,
      student,
      summary: { ...summary, classification: classifyDegree(summary.cgpa) },
      rows,
    });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/student/timetable
// ============================================================
router.get('/timetable', only, async (req, res, next) => {
  try {
    const { sessionId, semester } = req.query;
    const rows = await ttQueries.listForStudent({
      programmeId: req.user.programmeId,
      sessionId,
      semester,
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/student/exams
// ============================================================
router.get('/exams', only, async (req, res, next) => {
  try {
    const { sessionId, semester } = req.query;
    const rows = await examQueries.listWithCourse({
      sessionId,
      semester,
      programmeId: req.user.programmeId,
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/student/attendance
// ============================================================
router.get('/attendance', only, async (req, res, next) => {
  try {
    const { sessionId, semester } = req.query;
    const rows = await attQueries.list({ studentId: req.user.id, sessionId, semester });
    const summary = await attQueries.studentSummary({ studentId: req.user.id, sessionId, semester });
    return res.json({ success: true, data: rows, summary });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/student/materials
// ============================================================
router.get('/materials', only, async (req, res, next) => {
  try {
    const regs = await regQueries.list({ studentId: req.user.id, sessionId: req.query.sessionId, semester: req.query.semester });
    const courseIds = regs
      .filter((r) => ['pending', 'approved'].includes(r.status))
      .map((r) => r.courseId);
    if (!courseIds.length) return res.json({ success: true, data: [] });
    const rows = await db
      .select()
      .from(courseMaterials)
      .where(inArray(courseMaterials.courseId, courseIds))
      .orderBy(desc(courseMaterials.createdAt));
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/student/assignments
// ============================================================
router.get('/assignments', only, async (req, res, next) => {
  try {
    const regs = await regQueries.list({ studentId: req.user.id, sessionId: req.query.sessionId, semester: req.query.semester });
    const courseIds = regs
      .filter((r) => ['pending', 'approved'].includes(r.status))
      .map((r) => r.courseId);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const assigns = await db
      .select()
      .from(assignments)
      .where(inArray(assignments.courseId, courseIds))
      .orderBy(desc(assignments.createdAt));

    const assignIds = assigns.map((a) => a.id);
    const subs = assignIds.length
      ? await db
          .select()
          .from(assignmentSubmissions)
          .where(and(eq(assignmentSubmissions.studentId, req.user.id), inArray(assignmentSubmissions.assignmentId, assignIds)))
      : [];
    const subMap = new Map(subs.map((s) => [s.assignmentId, s]));

    const data = assigns.map((a) => ({
      assignment: a,
      submission: subMap.get(a.id) || null,
    }));
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /api/student/assignments/:id/submit
// ============================================================
router.post('/assignments/:id/submit', only, async (req, res, next) => {
  try {
    const assignmentId = Number(req.params.id);
    const { submissionText, submissionUrl } = req.body || {};
    if (!submissionText && !submissionUrl) {
      return res.status(400).json({ success: false, error: 'submissionText or submissionUrl is required.' });
    }

    const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
    if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found.' });

    const [existing] = await db
      .select()
      .from(assignmentSubmissions)
      .where(and(eq(assignmentSubmissions.assignmentId, assignmentId), eq(assignmentSubmissions.studentId, req.user.id)))
      .limit(1);

    let row;
    if (existing) {
      [row] = await db
        .update(assignmentSubmissions)
        .set({ submissionText: submissionText || null, submissionUrl: submissionUrl || null, submittedAt: new Date() })
        .where(eq(assignmentSubmissions.id, existing.id))
        .returning();
    } else {
      [row] = await db
        .insert(assignmentSubmissions)
        .values({
          assignmentId,
          studentId: req.user.id,
          submissionText: submissionText || null,
          submissionUrl: submissionUrl || null,
        })
        .returning();
    }
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/student/fees
// ============================================================
router.get('/fees', only, async (req, res, next) => {
  try {
    const sessionId = Number(req.query.sessionId) || req.user.currentSessionId;
    let feeStructure = null;
    if (sessionId && req.user.programmeId) {
      feeStructure = await paymentQueries.findFeeStructure({
        programmeId: req.user.programmeId,
        level: req.user.level || 'ND',
        sessionId,
      });
    }
    const payments = await paymentQueries.list({ studentId: req.user.id, sessionId });
    const totalPaid = await paymentQueries.totalVerifiedForStudent(req.user.id, sessionId);
    const totalDue = Number(feeStructure?.total || 0);
    return res.json({
      success: true,
      feeStructure,
      payments,
      totalDue,
      totalPaid: Number(totalPaid),
      balance: Math.max(0, totalDue - Number(totalPaid)),
    });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/student/clearance
// ============================================================
router.get('/clearance', only, async (req, res, next) => {
  try {
    const rows = await clearQueries.list({ studentId: req.user.id, sessionId: req.query.sessionId });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/student/documents
// ============================================================
router.get('/documents', only, async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.userId, req.user.id))
      .orderBy(desc(documents.requestedAt));
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/student/documents/:id/download
// ============================================================
router.get('/documents/:id/download', only, async (req, res, next) => {
  try {
    const [row] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, Number(req.params.id)), eq(documents.userId, req.user.id)))
      .limit(1);
    if (!row) return res.status(404).json({ success: false, error: 'Document not found.' });
    if (row.status !== 'issued' || !row.fileUrl) {
      return res.status(400).json({ success: false, error: 'Document is not yet available for download.' });
    }
    return res.json({ success: true, url: row.fileUrl });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/student/id-card
// ============================================================
router.get('/id-card', only, async (req, res, next) => {
  try {
    const student = await userQueries.findByIdWithRelations(req.user.id);
    const session = req.user.currentSessionId
      ? await sessionQueries.findAcademicById(req.user.currentSessionId)
      : await sessionQueries.getCurrentAcademic();
    return res.json({
      success: true,
      data: {
        matricNumber: student.matricNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        level: student.level,
        department: student.department,
        programme: student.programme,
        school: student.school,
        photoUrl: student.photoUrl,
        session: session?.name || null,
        institution: await settingsQueries.getInstitution(),
      },
    });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/student/graduation
// ============================================================
router.get('/graduation', only, async (req, res, next) => {
  try {
    const [row] = await db
      .select()
      .from(graduations)
      .where(eq(graduations.studentId, req.user.id))
      .orderBy(desc(graduations.createdAt))
      .limit(1);
    return res.json({ success: true, data: row || null });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/student/borrows
// ============================================================
router.get('/borrows', only, async (req, res, next) => {
  try {
    const borrows = await libQueries.listBorrowsWithRelations({ userId: req.user.id });
    const fines = await libQueries.listFines({ userId: req.user.id });
    const reservations = await libQueries.listReservations({ userId: req.user.id });
    return res.json({ success: true, borrows, fines, reservations });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/student/dashboard
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    const student = await userQueries.findByIdWithRelations(req.user.id);
    const sessionId = req.user.currentSessionId;

    const regs = await regQueries.listWithCourse({ studentId: req.user.id, sessionId });
    const results = await resultQueries.publishedForStudent(req.user.id, {});
    const summary = computeStudentCGPA(
      results.map((r) => ({
        unit: Number(r.course?.unit) || 0,
        points: Number(r.result?.points) || 0,
        sessionId: r.result?.sessionId,
        semester: r.result?.semester,
      }))
    );

    const totalDue = student.programmeId && student.level && sessionId
      ? Number((await paymentQueries.findFeeStructure({ programmeId: student.programmeId, level: student.level, sessionId }))?.total || 0)
      : 0;
    const totalPaid = sessionId ? Number(await paymentQueries.totalVerifiedForStudent(req.user.id, sessionId)) : 0;

    const unreadNotifications = await notifQueries.countUnreadNotifications(req.user.id);
    const unreadMessages = await notifQueries.countUnreadMessages(req.user.id);
    const clearance = await clearQueries.list({ studentId: req.user.id, sessionId });

    return res.json({
      success: true,
      data: {
        student,
        registration: {
          totalCourses: regs.length,
          totalUnits: regs
            .filter((r) => ['pending', 'approved'].includes(r.registration.status))
            .reduce((s, r) => s + (Number(r.course?.unit) || 0), 0),
          pending: regs.filter((r) => r.registration.status === 'pending').length,
        },
        academic: {
          cgpa: summary.cgpa,
          totalUnits: summary.totalUnits,
          classification: classifyDegree(summary.cgpa),
          publishedResults: results.length,
        },
        fees: {
          totalDue,
          totalPaid,
          balance: Math.max(0, totalDue - totalPaid),
        },
        clearance,
        unreadNotifications,
        unreadMessages,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/student/profile
// ============================================================
router.get('/profile', only, async (req, res, next) => {
  try {
    const student = await userQueries.findByIdWithRelations(req.user.id);
    return res.json({ success: true, data: student });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/student/security
// ============================================================
router.get('/security', only, async (req, res, next) => {
  try {
    const sessions = await sessionQueries.listUserSessions(req.user.id);
    const logins = await require('../../db/queries/audit').listLogins({ userId: req.user.id, limit: 30 });
    return res.json({ success: true, sessions, logins });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /api/student/register-course
// ------------------------------------------------------------
// Body: { courseId, sessionId?, semester? }
// Enforces: settings.max_units, no duplicate active registration.
// ============================================================
router.post('/register-course', only, async (req, res, next) => {
  try {
    const { courseId, sessionId, semester } = req.body || {};
    if (!courseId) return res.status(400).json({ success: false, error: 'courseId is required.' });

    const sid = Number(sessionId) || req.user.currentSessionId;
    const sem = semester || (await settingsQueries.getCurrentSemester());
    if (!sid) return res.status(400).json({ success: false, error: 'No current session available.' });

    const exists = await regQueries.existsActive(req.user.id, courseId, sid, sem);
    if (exists) return res.status(409).json({ success: false, error: 'You have already registered this course.' });

    const maxUnits = await settingsQueries.getMaxUnits();
    const currentUnits = await regQueries.totalUnits(req.user.id, sid, sem);
    const { findById } = require('../../db/queries/courses');
    const course = await findById(courseId);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found.' });
    if (currentUnits + Number(course.unit) > maxUnits) {
      return res.status(400).json({ success: false, error: `Adding this course exceeds the maximum allowed units (${maxUnits}).` });
    }

    const row = await regQueries.create({
      studentId: req.user.id,
      courseId,
      sessionId: sid,
      semester: sem,
      status: 'pending',
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /api/student/unregister-course/:id
// ============================================================
router.post('/unregister-course/:id', only, async (req, res, next) => {
  try {
    const reg = await regQueries.findById(req.params.id);
    if (!reg || reg.studentId !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Registration not found.' });
    }
    if (reg.status === 'approved') {
      return res.status(400).json({ success: false, error: 'Approved registrations cannot be removed.' });
    }
    await regQueries.remove(reg.id);
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /api/student/clearance/request
// ============================================================
router.post('/clearance/request', only, async (req, res, next) => {
  try {
    const sid = Number(req.body?.sessionId) || req.user.currentSessionId;
    if (!sid) return res.status(400).json({ success: false, error: 'sessionId required.' });

    const existing = await clearQueries.findOne({ studentId: req.user.id, sessionId: sid, type: req.body?.type || 'semester' });
    if (existing) return res.status(409).json({ success: false, error: 'Clearance already requested.' });

    const row = await clearQueries.create({
      studentId: req.user.id,
      sessionId: sid,
      type: req.body?.type || 'semester',
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;