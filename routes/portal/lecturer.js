// ============================================================
// FPU — Lecturer portal API
// Mounted at /api/lecturer
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const userQueries    = require('../../db/queries/users');
const courseQueries  = require('../../db/queries/courses');
const regQueries     = require('../../db/queries/registrations');
const resultQueries  = require('../../db/queries/results');
const ttQueries      = require('../../db/queries/timetable');
const attQueries     = require('../../db/queries/attendance');
const libQueries     = require('../../db/queries/library');
const notifQueries   = require('../../db/queries/notifications');
const sessionQueries = require('../../db/queries/sessions');
const { db, schema } = require('../../db');
const { eq, and, desc, inArray, sql } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');
const { logAudit } = require('../../utils/audit');
const { scoreToGrade, getActiveGradeScale } = require('../../utils/gradeScale');

const { 
  courseAllocations, courses, courseRegistrations, users, 
  academicSessions, results, courseMaterials, assignments, 
  departments, assignmentSubmissions, programmes, timetableSlots,
  attendance
} = schema;

const only = requireRole('lecturer', 'hod');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR });

// ------------------------------------------------------------
// Helper: list the course IDs the current lecturer is allocated to
// ------------------------------------------------------------
async function getAllocatedCourseIds(userId, sessionId) {
  const allocations = await courseQueries.listAllocationsWithRelations({
    lecturerId: userId,
    sessionId,
  });
  return allocations.map((a) => a.course?.id).filter(Boolean);
}

// ============================================================
// GET /api/lecturer/dashboard
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    const lecturerId = req.user.id;
    const [currentSession] = await db.select().from(academicSessions).where(eq(academicSessions.isCurrent, true)).limit(1);

    const allocatedCourses = await db
      .select({ course: courses })
      .from(courseAllocations)
      .leftJoin(courses, eq(courseAllocations.courseId, courses.id))
      .where(eq(courseAllocations.lecturerId, lecturerId));

    const courseIds = allocatedCourses.map(c => c.course?.id).filter(Boolean);

    const courseStats = [];
    let uniqueStudentIds = new Set();
    let totalRegistrations = 0;

    for (const c of allocatedCourses) {
      if (!c.course) continue;
      const regs = await db
        .select({ studentId: courseRegistrations.studentId })
        .from(courseRegistrations)
        .where(and(eq(courseRegistrations.courseId, c.course.id), eq(courseRegistrations.status, 'approved')));
      
      regs.forEach(r => uniqueStudentIds.add(r.studentId));
      courseStats.push({ code: c.course.code, title: c.course.title, students: regs.length });
      totalRegistrations += regs.length;
    }
    const totalStudents = uniqueStudentIds.size;

    let pendingResults = 0;
    if (courseIds.length > 0) {
      const pend = await db.select({ count: sql`count(*)::int` }).from(results).where(and(inArray(results.courseId, courseIds), eq(results.status, 'draft')));
      pendingResults = pend[0]?.count || 0;
    }

    let materialsCount = 0, assignmentsCount = 0;
    if (courseIds.length > 0) {
      const mats = await db.select({ count: sql`count(*)::int` }).from(courseMaterials).where(inArray(courseMaterials.courseId, courseIds));
      materialsCount = mats[0]?.count || 0;
      const ass = await db.select({ count: sql`count(*)::int` }).from(assignments).where(inArray(assignments.courseId, courseIds));
      assignmentsCount = ass[0]?.count || 0;
    }

    const [dept] = await db.select({ name: departments.name }).from(users).leftJoin(departments, eq(users.departmentId, departments.id)).where(eq(users.id, lecturerId)).limit(1);

    return res.json({
      success: true,
      data: {
        coursesCount: allocatedCourses.length, totalStudents, totalRegistrations, pendingResults,
        activeSession: currentSession?.name || '—', materialsCount, assignmentsCount,
        departmentName: dept?.name || '—', coursesList: allocatedCourses.map(c => c.course).filter(Boolean), courseStats
      }
    });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/lecturer/students-list
// ============================================================
router.get('/students-list', only, async (req, res, next) => {
  try {
    const allocations = await db.select({ courseId: courseAllocations.courseId }).from(courseAllocations).where(eq(courseAllocations.lecturerId, req.user.id));
    const courseIds = allocations.map(a => a.courseId).filter(Boolean);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const regs = await db.select({ studentId: courseRegistrations.studentId }).from(courseRegistrations).where(and(inArray(courseRegistrations.courseId, courseIds), eq(courseRegistrations.status, 'approved')));
    const studentIds = [...new Set(regs.map(r => r.studentId))];
    if (!studentIds.length) return res.json({ success: true, data: [] });

    const students = await db
      .select({
        id: users.id, matricNumber: users.matricNumber, firstName: users.firstName, lastName: users.lastName,
        level: users.level, email: users.email, programmeName: programmes.name, departmentName: departments.name
      })
      .from(users)
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(inArray(users.id, studentIds))
      .orderBy(users.lastName);

    return res.json({ success: true, data: students });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// GET /api/lecturer/courses
// ============================================================
router.get('/courses', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: courses.id,
        code: courses.code,
        title: courses.title,
        level: courses.level,
        unit: courses.unit,
        semesterName: courses.semesterName,
      })
      .from(courseAllocations)
      .leftJoin(courses, eq(courseAllocations.courseId, courses.id))
      .where(eq(courseAllocations.lecturerId, req.user.id));

    const data = rows.filter(r => r.id !== null);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/lecturer/students?courseId=X
// ============================================================
router.get('/students', only, async (req, res, next) => {
  try {
    const { courseId } = req.query;
    if (!courseId) {
      return res.status(400).json({ success: false, error: 'courseId is required.' });
    }

    const allocation = await db
      .select({ id: courseAllocations.id })
      .from(courseAllocations)
      .where(and(
        eq(courseAllocations.lecturerId, req.user.id),
        eq(courseAllocations.courseId, Number(courseId))
      ))
      .limit(1);

    if (!allocation.length) {
      return res.status(403).json({ success: false, error: 'You are not allocated to this course.' });
    }

    const rows = await db
      .select({
        registration: courseRegistrations,
        student: users,
      })
      .from(courseRegistrations)
      .leftJoin(users, eq(courseRegistrations.studentId, users.id))
      .where(and(
        eq(courseRegistrations.courseId, Number(courseId)),
        eq(courseRegistrations.status, 'approved')
      ))
      .orderBy(users.lastName);

    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/lecturer/attendance
// ============================================================
router.get('/attendance', only, async (req, res, next) => {
  try {
    const allocations = await db.select({ courseId: courseAllocations.courseId }).from(courseAllocations).where(eq(courseAllocations.lecturerId, req.user.id));
    const courseIds = allocations.map(a => a.courseId).filter(Boolean);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const rows = await db
      .select({
        id: attendance.id, date: attendance.date, status: attendance.status,
        studentFirstName: users.firstName, studentLastName: users.lastName,
        matricNumber: users.matricNumber, courseCode: courses.code, courseTitle: courses.title,
      })
      .from(attendance)
      .leftJoin(users, eq(attendance.studentId, users.id))
      .leftJoin(courses, eq(attendance.courseId, courses.id))
      .where(inArray(attendance.courseId, courseIds))
      .orderBy(desc(attendance.date))
      .limit(500);

    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// POST /api/lecturer/attendance/bulk
// ============================================================
router.post('/attendance/bulk', only, async (req, res, next) => {
  try {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'rows[] is required.' });
    }

    const courseId = Number(rows[0].courseId);
    const allocation = await db
      .select({ id: courseAllocations.id })
      .from(courseAllocations)
      .where(and(
        eq(courseAllocations.lecturerId, req.user.id),
        eq(courseAllocations.courseId, courseId)
      ))
      .limit(1);

    if (!allocation.length) {
      return res.status(403).json({ success: false, error: 'You are not allocated to this course.' });
    }

    const insertData = rows.map(r => ({
      courseId: Number(r.courseId),
      studentId: Number(r.studentId),
      lecturerId: req.user.id,
      sessionId: Number(r.sessionId) || req.user.currentSessionId || 1,
      semester: r.semester,
      date: r.date,
      status: r.status || 'present',
      remarks: r.remarks || null,
    }));

    let savedCount = 0;
    for (const r of insertData) {
      await db.delete(attendance).where(and(
        eq(attendance.courseId, r.courseId),
        eq(attendance.studentId, r.studentId),
        eq(attendance.date, r.date)
      ));
      await db.insert(attendance).values(r);
      savedCount++;
    }

    await logAudit({
      req,
      action: 'lecturer.attendance_bulk',
      after: { count: savedCount, courseId },
    });

    return res.json({ success: true, saved: savedCount });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/lecturer/results
// ============================================================
router.get('/results', only, async (req, res, next) => {
  try {
    const allocations = await db.select({ courseId: courseAllocations.courseId }).from(courseAllocations).where(eq(courseAllocations.lecturerId, req.user.id));
    const courseIds = allocations.map(a => a.courseId).filter(Boolean);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const rows = await db
      .select({
        id: results.id, score: results.score, grade: results.grade, points: results.points, status: results.status,
        studentFirstName: users.firstName, studentLastName: users.lastName, matricNumber: users.matricNumber,
        courseCode: courses.code, courseTitle: courses.title,
      })
      .from(results)
      .leftJoin(users, eq(results.studentId, users.id))
      .leftJoin(courses, eq(results.courseId, courses.id))
      .where(inArray(results.courseId, courseIds))
      .orderBy(users.lastName, courses.code)
      .limit(2000);

    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// MATERIALS
// ============================================================
router.get('/materials', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: courseMaterials.id, title: courseMaterials.title, description: courseMaterials.description,
        fileUrl: courseMaterials.fileUrl, materialType: courseMaterials.materialType, createdAt: courseMaterials.createdAt,
        courseCode: courses.code,
      })
      .from(courseMaterials)
      .leftJoin(courses, eq(courseMaterials.courseId, courses.id))
      .where(eq(courseMaterials.lecturerId, req.user.id))
      .orderBy(desc(courseMaterials.createdAt));
    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.post('/materials', only, upload.single('file'), async (req, res, next) => {
  try {
    const { courseId, title, description, materialType } = req.body || {};
    let fileUrl = req.body.fileUrl || null;

    if (!courseId || !title) return res.status(400).json({ success: false, error: 'courseId and title are required.' });

    if (req.file) {
      const ext = path.extname(req.file.originalname) || '';
      const newName = `material-${Date.now()}${ext}`;
      fs.renameSync(req.file.path, path.join(UPLOAD_DIR, newName));
      fileUrl = `/uploads/${newName}`;
    }

    const [row] = await db.insert(courseMaterials).values({
      courseId: Number(courseId), lecturerId: req.user.id, title, description: description || null, fileUrl, materialType: materialType || 'note',
    }).returning();
    return res.status(201).json({ success: true, data: row });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.put('/materials/:id', only, async (req, res, next) => {
  try {
    const { title, description, materialType } = req.body || {};
    const [row] = await db.update(courseMaterials).set({ title, description, materialType }).where(and(eq(courseMaterials.id, Number(req.params.id)), eq(courseMaterials.lecturerId, req.user.id))).returning();
    return res.json({ success: true, data: row });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/materials/:id', only, async (req, res, next) => {
  try {
    await db.delete(courseMaterials).where(and(eq(courseMaterials.id, Number(req.params.id)), eq(courseMaterials.lecturerId, req.user.id)));
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// ASSIGNMENTS
// ============================================================
router.get('/assignments', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        dueDate: assignments.dueDate,
        maxScore: assignments.maxScore,
        createdAt: assignments.createdAt,
        courseCode: courses.code,
      })
      .from(assignments)
      .leftJoin(courses, eq(assignments.courseId, courses.id))
      .where(eq(assignments.lecturerId, req.user.id))
      .orderBy(desc(assignments.createdAt));

    const data = rows.map(r => ({
      ...r,
      courseCode: r.courseCode || '—',
      title: r.title || 'Untitled',
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[lecturer/assignments] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/assignments', only, upload.single('file'), async (req, res, next) => {
  try {
    const { courseId, title, description, dueDate, maxScore } = req.body || {};
    let attachmentUrl = null;

    if (!courseId || !title) return res.status(400).json({ success: false, error: 'courseId and title are required.' });

    if (req.file) {
      const ext = path.extname(req.file.originalname) || '';
      const newName = `assignment-${Date.now()}${ext}`;
      fs.renameSync(req.file.path, path.join(UPLOAD_DIR, newName));
      attachmentUrl = `/uploads/${newName}`;
    }

    const [row] = await db.insert(assignments).values({
      courseId: Number(courseId),
      lecturerId: req.user.id,
      sessionId: req.user.currentSessionId || 1,
      semester: 'first',
      title: title,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      maxScore: maxScore ? Number(maxScore) : 100,
      attachmentUrl: attachmentUrl,
    }).returning();

    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error('[lecturer/assignments] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/assignments/:id', only, async (req, res, next) => {
  try {
    const { title, description, dueDate, maxScore } = req.body || {};
    const [row] = await db.update(assignments).set({ title, description, dueDate: dueDate ? new Date(dueDate) : null, maxScore: Number(maxScore) }).where(and(eq(assignments.id, Number(req.params.id)), eq(assignments.lecturerId, req.user.id))).returning();
    return res.json({ success: true, data: row });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/assignments/:id', only, async (req, res, next) => {
  try {
    await db.delete(assignments).where(and(eq(assignments.id, Number(req.params.id)), eq(assignments.lecturerId, req.user.id)));
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// OTHER ROUTES
// ============================================================
router.get('/requests', only, async (req, res, next) => {
  try { return res.json({ success: true, data: await notifQueries.listComplaints({ userId: req.user.id }) }); }
  catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.get('/reports', only, async (req, res, next) => {
  try {
    const sessionId = req.user.currentSessionId;
    const allocations = await courseQueries.listAllocationsWithRelations({ lecturerId: req.user.id, sessionId });
    const courseIds = allocations.map((a) => a.course?.id).filter(Boolean);
    const resultRows = courseIds.length ? await resultQueries.list({ sessionId, limit: 5000 }) : [];
    const myResults = resultRows.filter((r) => courseIds.includes(r.courseId));
    const summary = { totalCourses: allocations.length, totalResultRows: myResults.length, byStatus: myResults.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {}) };
    return res.json({ success: true, data: { allocations, summary } });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.get('/timetable', only, async (req, res, next) => {
  try {
    const allocations = await db.select({ courseId: courseAllocations.courseId }).from(courseAllocations).where(eq(courseAllocations.lecturerId, req.user.id));
    const courseIds = allocations.map(a => a.courseId).filter(Boolean);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const slots = await db
      .select({
        id: timetableSlots.id, dayOfWeek: timetableSlots.dayOfWeek, startTime: timetableSlots.startTime,
        endTime: timetableSlots.endTime, venue: timetableSlots.venue, semester: timetableSlots.semester,
        courseCode: courses.code, courseTitle: courses.title, level: courses.level,
      })
      .from(timetableSlots)
      .leftJoin(courses, eq(timetableSlots.courseId, courses.id))
      .where(inArray(timetableSlots.courseId, courseIds))
      .orderBy(timetableSlots.dayOfWeek, timetableSlots.startTime);

    return res.json({ success: true, data: slots });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

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

// ============================================================
// GET /api/lecturer/assignments/:id/submissions
// ============================================================
router.get('/assignments/:id/submissions', only, async (req, res, next) => {
  try {
    const assignmentId = Number(req.params.id);

    // Verify the assignment belongs to this lecturer
    const [assignment] = await db.select()
      .from(assignments)
      .where(and(eq(assignments.id, assignmentId), eq(assignments.lecturerId, req.user.id)))
      .limit(1);

    if (!assignment) return res.status(403).json({ success: false, error: 'Assignment not found or not yours.' });

    // Get submissions with student details
    const rows = await db
      .select({
        submission: assignmentSubmissions,
        student: users,
      })
      .from(assignmentSubmissions)
      .leftJoin(users, eq(assignmentSubmissions.studentId, users.id))
      .where(eq(assignmentSubmissions.assignmentId, assignmentId))
      .orderBy(users.lastName);

    const data = rows.map(r => ({
      id: r.submission.id,
      studentName: `${r.student?.firstName || ''} ${r.student?.lastName || ''}`.trim(),
      matricNumber: r.student?.matricNumber || '—',
      submissionText: r.submission.submissionText,
      submissionUrl: r.submission.submissionUrl,
      score: r.submission.score,
      feedback: r.submission.feedback,
      submittedAt: r.submission.submittedAt,
    }));

    return res.json({ success: true, data, assignment });
  } catch (err) {
    console.error('[lecturer/submissions] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/lecturer/submissions/:id/grade
// ============================================================
router.post('/submissions/:id/grade', only, async (req, res, next) => {
  try {
    const { score, feedback } = req.body || {};
    if (score === undefined) return res.status(400).json({ success: false, error: 'Score is required.' });

    const [row] = await db.update(assignmentSubmissions)
      .set({ score: String(score), feedback: feedback || null, gradedAt: new Date(), gradedBy: req.user.id })
      .where(eq(assignmentSubmissions.id, Number(req.params.id)))
      .returning();

    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[lecturer/grade] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
// ============================================================
// POST /api/lecturer/requests
// ============================================================
router.post('/requests', only, async (req, res, next) => {
  try {
    const { subject, body, category } = req.body || {};
    if (!subject || !body) {
      return res.status(400).json({ success: false, error: 'Subject and Message are required.' });
    }

    const row = await notifQueries.createComplaint({
      userId: req.user.id,
      subject,
      body,
      category: category || 'general',
    });

    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error('[lecturer/requests] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
// ============================================================
// POST /api/lecturer/results
// ============================================================
router.post('/results', only, async (req, res, next) => {
  try {
    const { studentId, courseId, score, semester } = req.body || {};
    if (!studentId || !courseId || score === undefined) {
      return res.status(400).json({ success: false, error: 'studentId, courseId, and score are required.' });
    }

    // Verify allocation
    const allocation = await db.select({ id: courseAllocations.id })
      .from(courseAllocations)
      .where(and(eq(courseAllocations.lecturerId, req.user.id), eq(courseAllocations.courseId, Number(courseId))))
      .limit(1);
    if (!allocation.length) return res.status(403).json({ success: false, error: 'Not your course.' });

    const numericScore = Number(score);
    const scale = await getActiveGradeScale();
    const { grade, points } = await scoreToGrade(numericScore, scale);

    const [row] = await db.insert(results).values({
      studentId: Number(studentId),
      courseId: Number(courseId),
      sessionId: req.user.currentSessionId || 1,
      semester: semester || 'first',
      score: String(numericScore),
      grade: grade,
      points: String(points),
      status: 'draft',
    }).onConflictDoUpdate({
      target: [results.studentId, results.courseId, results.sessionId, results.semester],
      set: {
        score: String(numericScore),
        grade: grade,
        points: String(points),
        status: 'draft', // Overwrite if it existed, but reset to draft
      }
    }).returning();

    return res.status(201).json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// DELETE /api/lecturer/results/:id
// ============================================================
router.delete('/results/:id', only, async (req, res, next) => {
  try {
    await db.delete(results).where(eq(results.id, Number(req.params.id)));
    return res.json({ success: true });
  } catch (err) { return next(err); }
});
// ============================================================
// GET /api/lecturer/reports
// ============================================================
router.get('/reports', only, async (req, res, next) => {
  try {
    const lecturerId = req.user.id;

    // 1. Fetch allocated courses
    const allocatedCourses = await db
      .select({ courseId: courseAllocations.courseId })
      .from(courseAllocations)
      .where(eq(courseAllocations.lecturerId, lecturerId));

    const courseIds = allocatedCourses.map(c => c.courseId).filter(Boolean);
    const coursesCount = courseIds.length;

    if (!coursesCount) {
      return res.json({ 
        success: true, 
        data: { coursesCount: 0, totalStudents: 0, totalResults: 0, attendanceSessions: 0, stats: {}, gradeDist: {}, statusDist: {}, levelDist: {} } 
      });
    }

    // 2. Fetch all results for these courses (Removed the leftJoin to users to prevent crashes)
    const allResults = await db
      .select({
        score: results.score,
        grade: results.grade,
        status: results.status,
        studentId: results.studentId,
      })
      .from(results)
      .where(inArray(results.courseId, courseIds));

    // 3. Calculate Stats
    const uniqueStudents = new Set(allResults.map(r => r.studentId)).size;
    const totalResults = allResults.length;
    
    let totalScore = 0;
    let highest = -1;
    let lowest = 101;
    let passCount = 0;

    const gradeDist = {};
    const statusDist = {};
    const levelDist = { "100": 0, "200": 0, "300": 0, "400": 0 }; // Fallback for level

    allResults.forEach(r => {
      const score = Number(r.score) || 0;
      totalScore += score;
      if (score > highest) highest = score;
      if (score < lowest) lowest = score;
      if (score >= 40) passCount++;

      // Grade
      const grade = r.grade || 'N/A';
      gradeDist[grade] = (gradeDist[grade] || 0) + 1;

      // Status
      const status = r.status || 'draft';
      statusDist[status] = (statusDist[status] || 0) + 1;
    });

    const avgScore = totalResults > 0 ? (totalScore / totalResults).toFixed(1) : 0;
    const passRate = totalResults > 0 ? Math.round((passCount / totalResults) * 100) : 0;

    // 4. Attendance Count
    const attRows = await db
      .select({ id: attendance.id })
      .from(attendance)
      .where(inArray(attendance.courseId, courseIds));
    const attendanceSessions = attRows.length;

    return res.json({
      success: true,
      data: {
        coursesCount,
        totalStudents: uniqueStudents,
        totalResults,
        attendanceSessions,
        stats: {
          averageScore: avgScore,
          highestScore: highest === -1 ? 0 : highest,
          lowestScore: lowest === 101 ? 0 : lowest,
          passRate,
        },
        gradeDist,
        statusDist,
        levelDist // Will be all 0s for now, but won't crash
      }
    });
  } catch (err) {
    console.error('[lecturer/reports] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
module.exports = router;