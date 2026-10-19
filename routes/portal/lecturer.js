// ============================================================
// FPU — Lecturer portal API
// Mounted at /api/lecturer
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

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

// Extract all needed tables from schema
const { 
  courseAllocations, courses, courseRegistrations, users, 
  academicSessions, results, courseMaterials, assignments, 
  departments, assignmentSubmissions 
} = schema;

const only = requireRole('lecturer', 'hod');

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

    // 1. Get current session for display
    const [currentSession] = await db.select().from(academicSessions).where(eq(academicSessions.isCurrent, true)).limit(1);

    // 2. Fetch ALL allocated courses (ignoring session restriction to ensure data shows)
    const allocatedCourses = await db
      .select({ course: courses })
      .from(courseAllocations)
      .leftJoin(courses, eq(courseAllocations.courseId, courses.id))
      .where(eq(courseAllocations.lecturerId, lecturerId));

    const courseIds = allocatedCourses.map(c => c.course?.id).filter(Boolean);

    // 3. Get student count per course
    const courseStats = [];
    let totalStudents = 0;
    
    for (const c of allocatedCourses) {
      if (!c.course) continue;
      
      const regs = await db
        .select({ count: sql`count(*)::int` })
        .from(courseRegistrations)
        .where(and(
          eq(courseRegistrations.courseId, c.course.id),
          eq(courseRegistrations.status, 'approved')
        ));
      
      const count = regs[0]?.count || 0;
      totalStudents += count;
      
      courseStats.push({
        code: c.course.code,
        title: c.course.title,
        students: count
      });
    }

    // 4. Get pending results
    let pendingResults = 0;
    if (courseIds.length > 0) {
      const pend = await db
        .select({ count: sql`count(*)::int` })
        .from(results)
        .where(and(
          inArray(results.courseId, courseIds),
          eq(results.status, 'draft')
        ));
      pendingResults = pend[0]?.count || 0;
    }

    // 5. Get materials & assignments
    let materialsCount = 0;
    let assignmentsCount = 0;
    if (courseIds.length > 0) {
      const mats = await db.select({ count: sql`count(*)::int` }).from(courseMaterials).where(inArray(courseMaterials.courseId, courseIds));
      materialsCount = mats[0]?.count || 0;
      
      const ass = await db.select({ count: sql`count(*)::int` }).from(assignments).where(inArray(assignments.courseId, courseIds));
      assignmentsCount = ass[0]?.count || 0;
    }

    // 6. Get Department Name
    const [dept] = await db.select({ name: departments.name })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(eq(users.id, lecturerId))
      .limit(1);

    return res.json({
      success: true,
      data: {
        coursesCount: allocatedCourses.length,
        totalStudents,
        pendingResults,
        activeSession: currentSession?.name || '—',
        materialsCount,
        assignmentsCount,
        departmentName: dept?.name || '—',
        coursesList: allocatedCourses.map(c => c.course).filter(Boolean),
        courseStats, // <-- New data for the chart
      }
    });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/lecturer/courses
// ============================================================
router.get('/courses', only, async (req, res, next) => {
  try {
    const rows = await courseQueries.listAllocationsWithRelations({
      lecturerId: req.user.id,
      sessionId: req.query.sessionId,
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/lecturer/students?courseId=&sessionId=
// ============================================================
router.get('/students', only, async (req, res, next) => {
  try {
    const { courseId, sessionId } = req.query;
    if (!courseId) return res.status(400).json({ success: false, error: 'courseId is required.' });

    const rows = await regQueries.listWithStudent({
      courseId,
      sessionId,
      status: ['pending', 'approved'],
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/lecturer/timetable
// ============================================================
router.get('/timetable', only, async (req, res, next) => {
  try {
    const rows = await ttQueries.listWithRelations({
      lecturerId: req.user.id,
      sessionId: req.query.sessionId,
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/lecturer/attendance?courseId=&date=
// ============================================================
router.get('/attendance', only, async (req, res, next) => {
  try {
    const { courseId, date, sessionId, semester } = req.query;
    const rows = await attQueries.list({ courseId, date, sessionId, semester });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
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

    const allocated = await getAllocatedCourseIds(req.user.id, req.user.currentSessionId);
    const allowedSet = new Set(allocated.map(Number));

    const payload = rows
      .filter((r) => allowedSet.has(Number(r.courseId)))
      .map((r) => ({
        courseId: Number(r.courseId),
        studentId: Number(r.studentId),
        lecturerId: req.user.id,
        sessionId: Number(r.sessionId) || req.user.currentSessionId,
        semester: r.semester,
        date: r.date,
        status: r.status || 'present',
        remarks: r.remarks || null,
      }));

    if (payload.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'None of the provided rows belong to your allocated courses.',
      });
    }

    const inserted = await attQueries.bulkUpsert(payload);
    await logAudit({
      req,
      action: 'lecturer.attendance_bulk',
      after: { count: inserted.length, requested: rows.length },
    });
    return res.json({ success: true, data: inserted });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/lecturer/assessments
// ============================================================
router.get('/assessments', only, async (req, res, next) => {
  try {
    const sessionId = req.user.currentSessionId;
    const courseIds = await getAllocatedCourseIds(req.user.id, sessionId);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const rows = await resultQueries.list({
      status: ['draft', 'submitted', 'hod_rejected'],
      sessionId,
      limit: 2000,
    });
    return res.json({ success: true, data: rows.filter((r) => courseIds.includes(r.courseId)) });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /api/lecturer/results
// ============================================================
router.post('/results', only, async (req, res, next) => {
  try {
    const { studentId, courseId, score, sessionId, semester } = req.body || {};
    if (!studentId || !courseId || score === undefined) {
      return res.status(400).json({ success: false, error: 'studentId, courseId, score are required.' });
    }

    const sid = Number(sessionId) || req.user.currentSessionId;
    const allocated = await getAllocatedCourseIds(req.user.id, sid);
    if (!allocated.map(Number).includes(Number(courseId))) {
      return res.status(403).json({ success: false, error: 'You are not allocated to this course.' });
    }

    const sem = semester || 'first';
    const scale = await getActiveGradeScale();
    const { grade, points } = await scoreToGrade(score, scale);

    const row = await resultQueries.upsert({
      studentId, courseId, sessionId: sid, semester: sem,
      score, grade, points, status: 'draft',
    });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /api/lecturer/results/submit
// ============================================================
router.post('/results/submit', only, async (req, res, next) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids[] is required.' });
    }

    const sessionId = req.user.currentSessionId;
    const allocated = await getAllocatedCourseIds(req.user.id, sessionId);
    const allowedSet = new Set(allocated.map(Number));

    const all = await resultQueries.list({ sessionId, limit: 5000 });
    const requestedIds = new Set(ids.map(Number));
    const safeIds = all
      .filter((r) => requestedIds.has(Number(r.id)) && allowedSet.has(Number(r.courseId)))
      .map((r) => r.id);

    if (safeIds.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'None of the provided result IDs belong to your allocated courses.',
      });
    }

    const rows = await resultQueries.submitBatch(safeIds, req.user.id);
    await logAudit({
      req,
      action: 'lecturer.results_submit',
      after: { count: rows.length, requested: ids.length },
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/lecturer/results
// ============================================================
router.get('/results', only, async (req, res, next) => {
  try {
    const sessionId = req.user.currentSessionId;
    const courseIds = await getAllocatedCourseIds(req.user.id, sessionId);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const rows = await resultQueries.list({ sessionId, limit: 2000 });
    return res.json({ success: true, data: rows.filter((r) => courseIds.includes(r.courseId)) });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/lecturer/materials
// ============================================================
router.get('/materials', only, async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(courseMaterials)
      .where(eq(courseMaterials.lecturerId, req.user.id))
      .orderBy(desc(courseMaterials.createdAt));
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /api/lecturer/materials
// ============================================================
router.post('/materials', only, async (req, res, next) => {
  try {
    const { courseId, title, description, fileUrl, materialType } = req.body || {};
    if (!courseId || !title) {
      return res.status(400).json({ success: false, error: 'courseId and title are required.' });
    }

    const allocated = await getAllocatedCourseIds(req.user.id, req.user.currentSessionId);
    if (!allocated.map(Number).includes(Number(courseId))) {
      return res.status(403).json({ success: false, error: 'You are not allocated to this course.' });
    }

    const [row] = await db.insert(courseMaterials).values({
      courseId: Number(courseId),
      lecturerId: req.user.id,
      title,
      description: description || null,
      fileUrl: fileUrl || null,
      materialType: materialType || 'note',
    }).returning();
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/lecturer/assignments
// ============================================================
router.get('/assignments', only, async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(assignments)
      .where(eq(assignments.lecturerId, req.user.id))
      .orderBy(desc(assignments.createdAt));
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /api/lecturer/assignments
// ============================================================
router.post('/assignments', only, async (req, res, next) => {
  try {
    const { courseId, title, description, dueDate, maxScore, attachmentUrl, sessionId, semester } = req.body || {};
    if (!courseId || !title) {
      return res.status(400).json({ success: false, error: 'courseId and title are required.' });
    }

    const allocated = await getAllocatedCourseIds(req.user.id, req.user.currentSessionId);
    if (!allocated.map(Number).includes(Number(courseId))) {
      return res.status(403).json({ success: false, error: 'You are not allocated to this course.' });
    }

    const [row] = await db.insert(assignments).values({
      courseId: Number(courseId),
      lecturerId: req.user.id,
      sessionId: Number(sessionId) || req.user.currentSessionId || 1,
      semester: semester || 'first',
      title,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      maxScore: Number(maxScore) || 100,
      attachmentUrl: attachmentUrl || null,
    }).returning();
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/lecturer/assignments/:id/submissions
// ============================================================
router.get('/assignments/:id/submissions', only, async (req, res, next) => {
  try {
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, Number(req.params.id)))
      .limit(1);
    if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found.' });
    if (assignment.lecturerId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'This assignment is not yours.' });
    }

    const rows = await db
      .select({
        submission: assignmentSubmissions,
        student: users,
      })
      .from(assignmentSubmissions)
      .leftJoin(users, eq(assignmentSubmissions.studentId, users.id))
      .where(eq(assignmentSubmissions.assignmentId, Number(req.params.id)))
      .orderBy(desc(assignmentSubmissions.submittedAt));
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /api/lecturer/assignments/submissions/:id/grade
// ============================================================
router.post('/assignments/submissions/:id/grade', only, async (req, res, next) => {
  try {
    const { score, feedback } = req.body || {};
    if (score === undefined) return res.status(400).json({ success: false, error: 'score is required.' });

    const [sub] = await db
      .select()
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.id, Number(req.params.id)))
      .limit(1);
    if (!sub) return res.status(404).json({ success: false, error: 'Submission not found.' });

    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, sub.assignmentId))
      .limit(1);
    if (!assignment || assignment.lecturerId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'This submission is not yours to grade.' });
    }

    const [row] = await db
      .update(assignmentSubmissions)
      .set({
        score: String(score),
        feedback: feedback || null,
        gradedAt: new Date(),
        gradedBy: req.user.id,
      })
      .where(eq(assignmentSubmissions.id, Number(req.params.id)))
      .returning();
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/lecturer/requests
// ============================================================
router.get('/requests', only, async (req, res, next) => {
  try {
    const rows = await notifQueries.listComplaints({ userId: req.user.id });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /api/lecturer/requests
// ============================================================
router.post('/requests', only, async (req, res, next) => {
  try {
    const { subject, body, category } = req.body || {};
    if (!subject || !body) {
      return res.status(400).json({ success: false, error: 'subject and body are required.' });
    }
    const row = await notifQueries.createComplaint({
      userId: req.user.id, subject, body, category,
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/lecturer/reports
// ============================================================
router.get('/reports', only, async (req, res, next) => {
  try {
    const sessionId = req.user.currentSessionId;
    const allocations = await courseQueries.listAllocationsWithRelations({
      lecturerId: req.user.id, sessionId,
    });
    const courseIds = allocations.map((a) => a.course?.id).filter(Boolean);

    const resultRows = courseIds.length
      ? await resultQueries.list({ sessionId, limit: 5000 })
      : [];
    const myResults = resultRows.filter((r) => courseIds.includes(r.courseId));

    const summary = {
      totalCourses: allocations.length,
      totalResultRows: myResults.length,
      byStatus: myResults.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {}),
    };
    return res.json({ success: true, data: { allocations, summary } });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/lecturer/profile
// ============================================================
router.get('/profile', only, async (req, res, next) => {
  try {
    const user = await userQueries.findByIdWithRelations(req.user.id);
    return res.json({ success: true, data: user });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/lecturer/security
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
// ALLOCATION ACCEPTANCE WORKFLOW (Design B)
// ============================================================

// POST /api/lecturer/allocations/:id/accept
router.post('/allocations/:id/accept', requireRole('lecturer', 'hod'), async (req, res, next) => {
  try {
    const row = await courseQueries.acceptAllocation(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Allocation not found.' });
    await logAudit({ req, action: 'lecturer.allocation_accept', entity: 'course_allocation', entityId: row.id });

    try {
      const course = await courseQueries.findById(row.courseId);
      const hod = await userQueries.findHodForDepartment(course.departmentId);
      if (hod) {
        await notifQueries.createNotification({
          userId: hod.id,
          title: 'Course assignment accepted',
          body: (course.code || '') + ' — ' + (course.title || '') + ' accepted by lecturer.',
          type: 'success',
          link: '/portal/app.html#hod-courses',
        });
      }
    } catch (e) { /* best-effort */ }

    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// POST /api/lecturer/allocations/:id/flag
router.post('/allocations/:id/flag', requireRole('lecturer', 'hod'), async (req, res, next) => {
  try {
    const { reason, note } = req.body || {};
    if (!reason) return res.status(400).json({ success: false, error: 'reason is required.' });
    const row = await courseQueries.flagAllocation(req.params.id, req.user.id, reason, note);
    if (!row) return res.status(404).json({ success: false, error: 'Allocation not found.' });
    await logAudit({
      req,
      action: 'lecturer.allocation_flag',
      entity: 'course_allocation',
      entityId: row.id,
      after: { reason, note },
    });

    try {
      const course = await courseQueries.findById(row.courseId);
      const hod = await userQueries.findHodForDepartment(course.departmentId);
      if (hod) {
        await notifQueries.createNotification({
          userId: hod.id,
          title: 'Course assignment flagged',
          body: (course.code || '') + ' — ' + (course.title || '') + ' was flagged: ' + reason,
          type: 'warning',
          link: '/portal/app.html#hod-courses',
        });
      }
    } catch (e) { /* best-effort */ }

    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

module.exports = router;