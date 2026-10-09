// ============================================================
// FPU — Student portal API
// Mounted at /api/student
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
const { eq, and, desc, inArray, sql, or } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');
const { computeStudentCGPA, classifyDegree } = require('../../utils/gpa');
const { logSecurity } = require('../../utils/audit');
const { scoreToGrade } = require('../../utils/gradeScale');

const {
  courseMaterials, assignments, assignmentSubmissions, documents,
  graduations, academicSessions, users, books, borrowRecords,
  bookReservations, libraryFines,
} = schema;

const only = requireRole('student');

// ============================================================
// Helpers
// ============================================================

// ------------------------------------------------------------
// computeYearOfStudy — derive year (1–4) from matric + session.
//   Matric format: FPU/SST/CSC/ND/26/001  → "/26/" = entry year
//   Session name:  "2025/2026"            → first 4 digits = current academic year
// If year can't be derived, defaults to 1.
// ------------------------------------------------------------
function computeYearOfStudy(matricNumber, sessionName) {
  try {
    const matricYear = String(matricNumber || '').match(/\/(\d{2})\//)?.[1];
    const sessionStart = String(sessionName || '').match(/(\d{4})/)?.[1];
    if (!matricYear || !sessionStart) return 1;
    const entryYear = 2000 + parseInt(matricYear, 10);
    const currentYear = parseInt(sessionStart, 10);
    return Math.max(1, Math.min(4, currentYear - entryYear + 1));
  } catch {
    return 1;
  }
}

// ------------------------------------------------------------
// buildLevelDisplay — ND1, ND2, HND1, HND2, etc.
// ------------------------------------------------------------
function buildLevelDisplay(level, yearOfStudy) {
  if (!level) return '—';
  return `${level}${yearOfStudy || 1}`;
}

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
// GET /api/student/library/catalogue
// ============================================================
router.get('/library/catalogue', only, async (req, res, next) => {
  try {
    const deptId = req.user.departmentId ? Number(req.user.departmentId) : null;
    const scopes = [eq(books.isGeneral, true)];
    if (deptId) scopes.push(eq(books.departmentId, deptId));

    const rows = await db
      .select()
      .from(books)
      .where(or(...scopes))
      .orderBy(books.title);

    const data = rows.map((b) => ({
      ...b,
      _scope: b.isGeneral ? 'general' : 'department',
    }));
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[library/catalogue]', err);
    return next(err);
  }
});

// ============================================================
// POST /api/student/library/borrow
// ============================================================
router.post('/library/borrow', only, async (req, res, next) => {
  try {
    const bookId = Number(req.body && req.body.bookId);
    if (!bookId) return res.status(400).json({ success: false, error: 'bookId is required.' });

    const deptId = req.user.departmentId ? Number(req.user.departmentId) : null;
    const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
    if (!book) return res.status(404).json({ success: false, error: 'Book not found.' });

    const inScope =
      book.isGeneral === true ||
      (deptId && book.departmentId && Number(book.departmentId) === deptId);

    if (!inScope) {
      return res.status(403).json({ success: false, error: 'This book is not available for your department.' });
    }
    if (Number(book.copiesAvailable) <= 0) {
      return res.status(409).json({ success: false, error: 'No copies available.' });
    }

    const existing = await db
      .select({ id: borrowRecords.id })
      .from(borrowRecords)
      .where(and(
        eq(borrowRecords.userId, req.user.id),
        eq(borrowRecords.bookId, bookId),
        eq(borrowRecords.status, 'borrowed')
      ))
      .limit(1);
    if (existing.length) {
      return res.status(409).json({ success: false, error: 'You already have this book borrowed.' });
    }

    const LOAN_DAYS = Number(process.env.LIBRARY_LOAN_DAYS || 14);
    const dueAt = new Date(Date.now() + LOAN_DAYS * 24 * 60 * 60 * 1000);

    const row = await db.transaction(async (tx) => {
      const [borrow] = await tx
        .insert(borrowRecords)
        .values({ bookId, userId: req.user.id, dueAt, status: 'borrowed', issuedBy: null })
        .returning();
      await tx
        .update(books)
        .set({ copiesAvailable: sql`${books.copiesAvailable} - 1` })
        .where(eq(books.id, bookId));
      return borrow;
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error('[library/borrow]', err);
    return next(err);
  }
});

// ============================================================
// GET /api/student/exams
// ============================================================
router.get('/exams', only, async (req, res, next) => {
  try {
    const { sessionId, semester } = req.query;
    const regs = await regQueries.list({ studentId: req.user.id, sessionId, semester });
    const courseIds = regs
      .filter((r) => ['pending', 'approved'].includes(r.status))
      .map((r) => r.courseId);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const allExams = await examQueries.listWithCourse({ sessionId, semester });
    const filtered = allExams.filter((e) => {
      const exam = e.exam || e;
      return courseIds.includes(exam.courseId);
    });
    return res.json({ success: true, data: filtered });
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
// ------------------------------------------------------------
// Returns materials for courses the student is registered for,
// joined with course code + title so the UI can group by course.
// ============================================================
router.get('/materials', only, async (req, res, next) => {
  try {
    const { courses, courseRegistrations } = schema;

    // Which courses is this student registered for?
    const regs = await regQueries.list({
      studentId: req.user.id,
      sessionId: req.query.sessionId,
      semester: req.query.semester,
    });
    const courseIds = regs
      .filter((r) => ['pending', 'approved'].includes(r.status))
      .map((r) => r.courseId);

    if (!courseIds.length) return res.json({ success: true, data: [] });

    const rows = await db
      .select({
        id: courseMaterials.id,
        courseId: courseMaterials.courseId,
        lecturerId: courseMaterials.lecturerId,
        title: courseMaterials.title,
        description: courseMaterials.description,
        fileUrl: courseMaterials.fileUrl,
        materialType: courseMaterials.materialType,
        createdAt: courseMaterials.createdAt,
        courseCode: courses.code,
        courseTitle: courses.title,
      })
      .from(courseMaterials)
      .leftJoin(courses, eq(courses.id, courseMaterials.courseId))
      .where(inArray(courseMaterials.courseId, courseIds))
      .orderBy(courses.code, desc(courseMaterials.createdAt));

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[student/materials]', err);
    return next(err);
  }
});
// ============================================================
// GET /api/student/assignments
// ------------------------------------------------------------
// Returns assignments for courses the student is registered
// for, plus their submission (if any) and joined course code.
// ============================================================
router.get('/assignments', only, async (req, res, next) => {
  try {
    const { courses } = schema;

    const regs = await regQueries.list({
      studentId: req.user.id,
      sessionId: req.query.sessionId,
      semester: req.query.semester,
    });
    const courseIds = regs
      .filter((r) => ['pending', 'approved'].includes(r.status))
      .map((r) => r.courseId);

    if (!courseIds.length) return res.json({ success: true, data: [] });

    const assigns = await db
      .select({
        id: assignments.id,
        courseId: assignments.courseId,
        lecturerId: assignments.lecturerId,
        sessionId: assignments.sessionId,
        semester: assignments.semester,
        title: assignments.title,
        description: assignments.description,
        dueDate: assignments.dueDate,
        maxScore: assignments.maxScore,
        attachmentUrl: assignments.attachmentUrl,
        createdAt: assignments.createdAt,
        courseCode: courses.code,
        courseTitle: courses.title,
      })
      .from(assignments)
      .leftJoin(courses, eq(courses.id, assignments.courseId))
      .where(inArray(assignments.courseId, courseIds))
      .orderBy(desc(assignments.createdAt));

    const assignIds = assigns.map((a) => a.id);
    const subs = assignIds.length
      ? await db
          .select()
          .from(assignmentSubmissions)
          .where(and(
            eq(assignmentSubmissions.studentId, req.user.id),
            inArray(assignmentSubmissions.assignmentId, assignIds)
          ))
      : [];
    const subMap = new Map(subs.map((s) => [s.assignmentId, s]));

    const data = assigns.map((a) => ({
      assignment: a,
      submission: subMap.get(a.id) || null,
    }));
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[student/assignments]', err);
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
        .values({ assignmentId, studentId: req.user.id, submissionText: submissionText || null, submissionUrl: submissionUrl || null })
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
    if (req.user.programmeId) {
      feeStructure = await paymentQueries.findFeeStructureWithFallback({
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
// ------------------------------------------------------------
// Returns:
//   - student details (name, matric, programme, dept)
//   - levelDisplay = ND1 / ND2 / HND1 / HND2 (derived)
//   - photoUrl = permanent ID-card photo (idCardPhotoUrl) or
//     falls back to profile photo
//   - qrDataUrl = pre-rendered QR (data URL) encoding the
//     public lookup URL
// ============================================================
router.get('/id-card', only, async (req, res, next) => {
  try {
    const student = await userQueries.findByIdWithRelations(req.user.id);
    const session = req.user.currentSessionId
      ? await sessionQueries.findAcademicById(req.user.currentSessionId)
      : await sessionQueries.getCurrentAcademic();

    const barcodeData = student.matricNumber || `STU-${student.id}`;
    const baseUrl = process.env.PUBLIC_URL || 'https://fpu-school-systems.onrender.com';
    const lookupUrl = `${baseUrl}/id-lookup.html?matric=${encodeURIComponent(barcodeData)}`;

    // Derive level display (ND1 / ND2 / HND1 / HND2)
    const yearOfStudy = computeYearOfStudy(student.matricNumber, session?.name);
    const levelDisplay = buildLevelDisplay(student.level, yearOfStudy);

    // Prefer permanent ID-card photo over profile photo
    const idPhoto = student.idCardPhotoUrl || student.photoUrl || null;

    // Server-side QR — more reliable than client CDN
    let qrDataUrl = null;
    try {
      const QRCode = require('qrcode');
      qrDataUrl = await QRCode.toDataURL(lookupUrl, {
        width: 180,
        margin: 0,
        errorCorrectionLevel: 'M',
        color: { dark: '#0f172a', light: '#ffffff' },
      });
    } catch (qrErr) {
      console.error('[id-card] QR generation failed:', qrErr.message);
    }

    return res.json({
      success: true,
      data: {
        id: student.id,
        matricNumber: student.matricNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        middleName: student.middleName,
        level: student.level,
        levelDisplay,             // ← ND1 / ND2 / HND1 / HND2
        yearOfStudy,              // ← 1, 2, 3, 4
        department: student.department,
        departmentName: student.departmentName,
        programme: student.programme,
        programmeName: student.programmeName,
        school: student.school,
        schoolName: student.schoolName,
        photoUrl: idPhoto,        // ← permanent ID photo (or current profile photo)
        session: session?.name || null,
        institution: await settingsQueries.getInstitution(),
        barcodeData,
        lookupUrl,
        qrDataUrl,
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

    if (!row) return res.json({ success: true, data: null });

    const results = await resultQueries.publishedForStudent(req.user.id, {});
    const summary = computeStudentCGPA(
      results.map((r) => ({
        unit: Number(r.course?.unit) || 0,
        points: Number(r.result?.points) || 0,
        sessionId: r.result?.sessionId,
        semester: r.result?.semester,
      }))
    );
    const student = await userQueries.findByIdWithRelations(req.user.id);

    let sessionName = null;
    if (row.sessionId) {
      const sess = await sessionQueries.findAcademicById(row.sessionId);
      sessionName = sess?.name || null;
    }

    return res.json({
      success: true,
      data: {
        ...row,
        cgpa: summary.cgpa ?? row.cgpa,
        classification: classifyDegree(summary.cgpa) ?? row.classification,
        totalUnits: summary.totalUnits,
        programmeName:  student?.programmeName  || null,
        departmentName: student?.departmentName || null,
        level:          student?.level          || row.level,
        sessionName,
      },
    });
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
// GET /api/student/available-courses
// ============================================================
router.get('/available-courses', only, async (req, res, next) => {
  try {
    const { courses, courseRegistrations } = schema;

    const registeredRows = await db
      .select({ courseId: courseRegistrations.courseId })
      .from(courseRegistrations)
      .where(eq(courseRegistrations.studentId, req.user.id));

    const registeredIds = new Set(registeredRows.map((r) => Number(r.courseId)));
    const allCourses = await db
      .select()
      .from(courses)
      .where(eq(courses.level, req.user.level || 'ND'))
      .orderBy(courses.code);

    const SHARED_PREFIXES = ['GNS', 'MTH', 'EED', 'ENT', 'STA'];

    const available = allCourses.filter((c) => {
      if (registeredIds.has(Number(c.id))) return false;
      if (c.isActive === false) return false;
      if (c.programmeId && Number(c.programmeId) === Number(req.user.programmeId)) return true;
      const code = String(c.code || '').split(' ')[0].toUpperCase();
      return SHARED_PREFIXES.includes(code);
    });

    return res.json({ success: true, data: available });
  } catch (err) {
    console.error('[available-courses] error:', err);
    return next(err);
  }
});

// ============================================================
// POST /api/student/register-course
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