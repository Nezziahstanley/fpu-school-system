// ============================================================
// FPU — HOD portal API
// Mounted at /api/hod
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries    = require('../../db/queries/users');
const courseQueries  = require('../../db/queries/courses');
const resultQueries  = require('../../db/queries/results');
const regQueries     = require('../../db/queries/registrations');
const ttQueries      = require('../../db/queries/timetable');
const notifQueries   = require('../../db/queries/notifications');
const sessionQueries = require('../../db/queries/sessions');
const { db, schema } = require('../../db');
const { eq, and, sql, desc } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');
const { logAudit } = require('../../utils/audit');

const { 
  users, courses, courseRegistrations, results, staffProfiles, 
  programmes, departments, courseAllocations, academicSessions,
  examSchedules
} = schema;

const only = requireRole('hod', 'admin');

function deptId(req) {
  const id = req.user.departmentId;
  if (!id) {
    const err = new Error('No department assigned to this HOD account.');
    err.status = 400;
    throw err;
  }
  return id;
}

// ============================================================
// GET /api/hod/dashboard
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const sessionId = req.user.currentSessionId || 1;

    const [dept] = await db.select().from(departments).where(eq(departments.id, departmentId)).limit(1);

    const studentRows = await db.select({
      id: users.id, level: users.level, gender: users.gender, programmeName: programmes.name,
    })
    .from(users)
    .leftJoin(programmes, eq(users.programmeId, programmes.id))
    .where(and(eq(users.departmentId, departmentId), eq(users.role, 'student')));

    const totalStudents = studentRows.length;
    const studentsByLevel = {};
    const studentsByProgramme = {};
    const studentsByGender = {};

    studentRows.forEach(s => {
      const lvl = s.level || 'Unknown';
      studentsByLevel[lvl] = (studentsByLevel[lvl] || 0) + 1;
      const prog = s.programmeName || 'Unknown';
      studentsByProgramme[prog] = (studentsByProgramme[prog] || 0) + 1;
      const g = s.gender || 'Unknown';
      studentsByGender[g] = (studentsByGender[g] || 0) + 1;
    });

    const staffRows = await db.select({ id: users.id })
      .from(users)
      .where(and(eq(users.departmentId, departmentId), sql`${users.role} IN ('lecturer', 'hod')`));
    const totalStaff = staffRows.length;

    const courseRows = await db.select({ id: courses.id })
      .from(courses)
      .where(eq(courses.departmentId, departmentId));
    const activeCourses = courseRows.length;
    const courseIds = courseRows.map(c => c.id);

    let pendingResults = 0, verifiedResults = 0, publishedResults = 0;
    if (courseIds.length > 0) {
      const resRows = await db.select({ status: results.status })
        .from(results)
        .where(sql`${results.courseId} IN ${courseIds}`);
      
      resRows.forEach(r => {
        if (r.status === 'draft' || r.status === 'submitted') pendingResults++;
        else if (r.status === 'hod_verified') verifiedResults++;
        else if (r.status === 'published') publishedResults++;
      });
    }

    let registeredThisSession = 0;
    if (courseIds.length > 0) {
      const regs = await db.select({ id: courseRegistrations.id })
        .from(courseRegistrations)
        .where(and(
          sql`${courseRegistrations.courseId} IN ${courseIds}`,
          eq(courseRegistrations.sessionId, sessionId),
          eq(courseRegistrations.status, 'approved')
        ));
      registeredThisSession = regs.length;
    }

    return res.json({
      success: true,
      data: {
        departmentName: dept?.name || 'Department',
        totalStudents, totalStaff, activeCourses,
        pendingResults, verifiedResults, publishedResults,
        registeredThisSession, noRegistration: 0,
        studentsByLevel, studentsByProgramme, studentsByGender
      }
    });
  } catch (err) {
    console.error('[hod/dashboard] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/hod/students
// ============================================================
router.get('/students', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const { level } = req.query;

    const conditions = [
      eq(users.departmentId, departmentId),
      eq(users.role, 'student')
    ];

    if (level) {
      conditions.push(eq(users.level, level.toUpperCase()));
    }

    const rows = await db
      .select({
        id: users.id,
        matricNumber: users.matricNumber,
        firstName: users.firstName,
        lastName: users.lastName,
        level: users.level,
        isActive: users.isActive,
        programmeName: programmes.name,
      })
      .from(users)
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .where(and(...conditions))
      .orderBy(users.matricNumber);

    const data = rows.map(r => ({
      ...r,
      matricNumber: (r.matricNumber || '').replace(/SMT/gi, '').replace(/\/+/g, '/').trim()
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[hod/students] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/hod/staff
// ============================================================
router.get('/staff', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);

    const staff = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(and(
        eq(users.departmentId, departmentId),
        sql`${users.role} IN ('lecturer', 'hod')`
      ))
      .orderBy(users.lastName);

    const counts = await db
      .select({
        lecturerId: courseAllocations.lecturerId,
        count: sql`count(*)::int`
      })
      .from(courseAllocations)
      .groupBy(courseAllocations.lecturerId);

    const countMap = {};
    counts.forEach(c => { countMap[c.lecturerId] = c.count; });

    const data = staff.map(s => ({
      ...s,
      courseCount: countMap[s.id] || 0
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[hod/staff] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/hod/pending-results
// ============================================================
router.get('/pending-results', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const { semester, level } = req.query;

    const conditions = [
      eq(courses.departmentId, departmentId),
      eq(results.status, 'submitted')
    ];

    if (semester) {
      conditions.push(eq(results.semester, semester.toLowerCase())); 
    }
    if (level) {
      conditions.push(eq(courses.level, level.toUpperCase()));
    }

    const rows = await db
      .select({
        id: results.id,
        courseId: results.courseId,
        courseCode: courses.code,
        courseTitle: courses.title,
        level: courses.level,
        semester: results.semester,
        status: results.status,
        submittedAt: results.submittedAt,
        lecturerName: sql`${users.firstName} || ' ' || ${users.lastName}`,
        sessionName: academicSessions.name,
      })
      .from(results)
      .innerJoin(courses, eq(results.courseId, courses.id))
      .leftJoin(users, eq(results.submittedBy, users.id))
      .leftJoin(academicSessions, eq(results.sessionId, academicSessions.id))
      .where(and(...conditions))
      .orderBy(desc(results.submittedAt));

    const data = await Promise.all(rows.map(async (r) => {
      const studs = await db.select({ count: sql`count(*)::int` })
        .from(courseRegistrations)
        .where(and(
          eq(courseRegistrations.courseId, r.courseId),
          eq(courseRegistrations.status, 'approved')
        ));
      
      return {
        ...r,
        studentCount: studs[0]?.count || 0
      };
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[hod/pending-results] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/hod/pending-results/:id/verify
// ============================================================
router.post('/pending-results/:id/verify', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const result = await resultQueries.findById(req.params.id);
    if (!result) return res.status(404).json({ success: false, error: 'Result not found.' });

    const course = await courseQueries.findById(result.courseId);
    if (!course || Number(course.departmentId) !== Number(departmentId)) {
      return res.status(403).json({ success: false, error: 'Not in your department.' });
    }

    const row = await resultQueries.hodVerify(result.id, req.user.id);
    await logAudit({ req, action: 'hod.result_verify', entity: 'result', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/hod/pending-results/:id/reject
// ============================================================
router.post('/pending-results/:id/reject', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const result = await resultQueries.findById(req.params.id);
    if (!result) return res.status(404).json({ success: false, error: 'Result not found.' });

    const course = await courseQueries.findById(result.courseId);
    if (!course || Number(course.departmentId) !== Number(departmentId)) {
      return res.status(403).json({ success: false, error: 'Not in your department.' });
    }

    const row = await resultQueries.hodReject(result.id, req.user.id, req.body?.reason);
    await logAudit({ req, action: 'hod.result_reject', entity: 'result', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/hod/results/course/:courseId
// ============================================================
router.get('/results/course/:courseId', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const courseId = Number(req.params.courseId);

    const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
    if (!course || Number(course.departmentId) !== Number(departmentId)) {
      return res.status(403).json({ success: false, error: 'Not in your department.' });
    }

    const rows = await db
      .select({
        id: results.id,
        studentId: users.id,
        studentName: sql`${users.firstName} || ' ' || ${users.lastName}`,
        matricNumber: users.matricNumber,
        score: results.score,
        grade: results.grade,
        status: results.status,
        semester: results.semester,
      })
      .from(results)
      .innerJoin(users, eq(results.studentId, users.id))
      .where(and(
        eq(results.courseId, courseId),
        eq(results.status, 'submitted')
      ))
      .orderBy(users.lastName);

    return res.json({ success: true, data: rows, course });
  } catch (err) {
    console.error('[hod/results-course] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/hod/results/bulk-approve
// ============================================================
router.post('/results/bulk-approve', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const { resultIds } = req.body || {};

    if (!Array.isArray(resultIds) || resultIds.length === 0) {
      return res.status(400).json({ success: false, error: 'resultIds[] is required.' });
    }

    const allResults = await db.select({
      id: results.id,
      courseId: results.courseId,
    }).from(results).where(sql`${results.id} IN ${resultIds}`);

    if (allResults.length !== resultIds.length) {
      return res.status(404).json({ success: false, error: 'Some results were not found.' });
    }

    const courseIds = [...new Set(allResults.map(r => r.courseId))];
    const deptCourses = await db.select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.departmentId, departmentId), sql`${courses.id} IN ${courseIds}`));

    if (deptCourses.length !== courseIds.length) {
      return res.status(403).json({ success: false, error: 'Results are not in your department.' });
    }

    await db.update(results)
      .set({ 
        status: 'hod_verified', 
        hodVerifiedAt: new Date(), 
        hodVerifiedBy: req.user.id 
      })
      .where(sql`${results.id} IN ${resultIds}`);

    await logAudit({ 
      req, 
      action: 'hod.bulk_verify_results', 
      after: { count: resultIds.length, resultIds } 
    });

    return res.json({ success: true, message: `${resultIds.length} results approved successfully.` });
  } catch (err) {
    console.error('[hod/bulk-approve] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/hod/courses-with-allocations
// ============================================================
router.get('/courses-with-allocations', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);

    const rows = await db
      .select({
        id: courses.id,
        code: courses.code,
        title: courses.title,
        courseCode: courses.code,
        courseTitle: courses.title,
        level: courses.level,
        unit: courses.unit,
        semesterName: courses.semesterName,
        allocationId: courseAllocations.id,
        lecturerId: courseAllocations.lecturerId,
        lecturerName: sql`${users.firstName} || ' ' || ${users.lastName}`,
        status: courseAllocations.status,
        flagReason: courseAllocations.flagReason,
      })
      .from(courses)
      .leftJoin(
        courseAllocations,
        eq(courseAllocations.courseId, courses.id)
      )
      .leftJoin(users, eq(courseAllocations.lecturerId, users.id))
      .where(eq(courses.departmentId, departmentId))
      .orderBy(courses.level, courses.code);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[hod/courses-with-allocations] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/hod/allocations/history
// ============================================================
router.get('/allocations/history', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);

    const rows = await db
      .select({
        id: courseAllocations.id,
        courseCode: courses.code,
        courseTitle: courses.title,
        level: courses.level,
        lecturerName: sql`${users.firstName} || ' ' || ${users.lastName}`,
        sessionName: sql`COALESCE(${academicSessions.name}, (SELECT name FROM academic_sessions WHERE is_current = true LIMIT 1))`,
        semester: courseAllocations.semester,
        status: courseAllocations.status,
        assignedAt: courseAllocations.createdAt,
      })
      .from(courseAllocations)
      .innerJoin(courses, eq(courseAllocations.courseId, courses.id))
      .innerJoin(users, eq(courseAllocations.lecturerId, users.id))
      .leftJoin(academicSessions, eq(courseAllocations.sessionId, academicSessions.id))
      .where(eq(courses.departmentId, departmentId))
      .orderBy(desc(courseAllocations.createdAt));

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[hod/allocations-history] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/hod/verified-results
// ============================================================
router.get('/verified-results', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);

    const rows = await db
      .select({
        id: results.id,
        courseCode: courses.code,
        courseTitle: courses.title,
        studentName: sql`${users.firstName} || ' ' || ${users.lastName}`,
        matricNumber: users.matricNumber,
        score: results.score,
        grade: results.grade,
        semester: results.semester,
        sessionName: academicSessions.name,
        verifiedAt: results.hodVerifiedAt,
      })
      .from(results)
      .innerJoin(courses, eq(results.courseId, courses.id))
      .innerJoin(users, eq(results.studentId, users.id))
      .leftJoin(academicSessions, eq(results.sessionId, academicSessions.id))
      .where(and(
        eq(courses.departmentId, departmentId),
        eq(results.status, 'hod_verified')
      ))
      .orderBy(users.lastName);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[hod/verified-results] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/hod/allocate/:id/force-accept
// ============================================================
router.post('/allocate/:id/force-accept', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const allocationId = Number(req.params.id);

    const [alloc] = await db.select({
      id: courseAllocations.id,
      courseId: courseAllocations.courseId,
    })
    .from(courseAllocations)
    .where(eq(courseAllocations.id, allocationId))
    .limit(1);

    if (!alloc) return res.status(404).json({ success: false, error: 'Allocation not found.' });

    const [course] = await db.select({ departmentId: courses.departmentId })
      .from(courses)
      .where(eq(courses.id, alloc.courseId))
      .limit(1);

    if (!course || Number(course.departmentId) !== Number(departmentId)) {
      return res.status(403).json({ success: false, error: 'Not in your department.' });
    }

    await db.update(courseAllocations)
      .set({ 
        status: 'accepted', 
        respondedAt: new Date(),
        flagReason: null,
      })
      .where(eq(courseAllocations.id, allocationId));

    await logAudit({ req, action: 'hod.force_accept_allocation', entity: 'course_allocations', entityId: allocationId });

    return res.json({ success: true, message: 'Allocation force-accepted.' });
  } catch (err) {
    console.error('[hod/force-accept] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// DELETE /api/hod/allocate/:id
// ============================================================
router.delete('/allocate/:id', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const allocationId = Number(req.params.id);

    const [alloc] = await db.select({
      id: courseAllocations.id,
      courseId: courseAllocations.courseId,
    })
    .from(courseAllocations)
    .where(eq(courseAllocations.id, allocationId))
    .limit(1);

    if (!alloc) return res.status(404).json({ success: false, error: 'Allocation not found.' });

    const [course] = await db.select({ departmentId: courses.departmentId })
      .from(courses)
      .where(eq(courses.id, alloc.courseId))
      .limit(1);

    if (!course || Number(course.departmentId) !== Number(departmentId)) {
      return res.status(403).json({ success: false, error: 'Not in your department.' });
    }

    await db.delete(courseAllocations).where(eq(courseAllocations.id, allocationId));
    await logAudit({ req, action: 'hod.delete_allocation', entity: 'course_allocations', entityId: allocationId });

    return res.json({ success: true, message: 'Allocation deleted.' });
  } catch (err) {
    console.error('[hod/delete-allocation] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/hod/exams
// Create a new exam
// ============================================================
router.post('/exams', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const { courseId, examDate, startTime, endTime, venue } = req.body;

    if (!courseId || !examDate || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    const [course] = await db.select().from(courses).where(eq(courses.id, Number(courseId))).limit(1);
    if (!course || Number(course.departmentId) !== Number(departmentId)) {
      return res.status(403).json({ success: false, error: 'Course not in your department.' });
    }

    const [row] = await db.insert(examSchedules).values({
      courseId: Number(courseId),
      sessionId: req.user.currentSessionId || 1,
      semester: course.semesterName || 'first',
      examDate: new Date(examDate),
      startTime,
      endTime,
      venue,
    }).returning();

    await logAudit({ req, action: 'hod.create_exam', entity: 'exam_schedule', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error('[hod/create-exam] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// PUT /api/hod/exams/:id
// ============================================================
router.put('/exams/:id', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const examId = Number(req.params.id);
    const { examDate, startTime, endTime, venue } = req.body;

    const [existing] = await db.select({
      id: examSchedules.id,
      courseId: examSchedules.courseId
    }).from(examSchedules).where(eq(examSchedules.id, examId)).limit(1);

    if (!existing) return res.status(404).json({ success: false, error: 'Exam not found.' });

    const [course] = await db.select().from(courses).where(eq(courses.id, existing.courseId)).limit(1);
    if (!course || Number(course.departmentId) !== Number(departmentId)) {
      return res.status(403).json({ success: false, error: 'Not in your department.' });
    }

    const [row] = await db.update(examSchedules)
      .set({
        examDate: new Date(examDate),
        startTime,
        endTime,
        venue,
      })
      .where(eq(examSchedules.id, examId))
      .returning();

    await logAudit({ req, action: 'hod.update_exam', entity: 'exam_schedule', entityId: row.id, after: row });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[hod/update-exam] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// DELETE /api/hod/exams/:id
// ============================================================
router.delete('/exams/:id', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const examId = Number(req.params.id);

    const [existing] = await db.select({
      id: examSchedules.id,
      courseId: examSchedules.courseId
    }).from(examSchedules).where(eq(examSchedules.id, examId)).limit(1);

    if (!existing) return res.status(404).json({ success: false, error: 'Exam not found.' });

    const [course] = await db.select().from(courses).where(eq(courses.id, existing.courseId)).limit(1);
    if (!course || Number(course.departmentId) !== Number(departmentId)) {
      return res.status(403).json({ success: false, error: 'Not in your department.' });
    }

    await db.delete(examSchedules).where(eq(examSchedules.id, examId));
    await logAudit({ req, action: 'hod.delete_exam', entity: 'exam_schedule', entityId: examId });

    return res.json({ success: true, message: 'Exam deleted.' });
  } catch (err) {
    console.error('[hod/delete-exam] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/hod/exams
// ============================================================
router.get('/exams', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);

    const rows = await db
      .select({
        id: examSchedules.id,
        examDate: examSchedules.examDate,
        startTime: examSchedules.startTime,
        endTime: examSchedules.endTime,
        venue: examSchedules.venue,
        courseCode: courses.code,
        courseTitle: courses.title,
        level: courses.level,
      })
      .from(examSchedules)
      .innerJoin(courses, eq(examSchedules.courseId, courses.id))
      .where(eq(courses.departmentId, departmentId))
      .orderBy(examSchedules.examDate);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[hod/exams] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/hod/transcript
// Get students in the HOD's department (for the transcript page)
// ============================================================
router.get('/transcript', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);

    const students = await db
      .select({
        id: users.id,
        matricNumber: users.matricNumber,
        firstName: users.firstName,
        lastName: users.lastName,
        level: users.level,
        programmeName: programmes.name,
      })
      .from(users)
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .where(and(
        eq(users.departmentId, departmentId),
        eq(users.role, 'student')
      ))
      .orderBy(users.lastName);

    const data = students.map(s => ({
      ...s,
      matricNumber: (s.matricNumber || '').replace(/SMT/gi, '').trim()
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[hod/transcript] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/hod/student-results/:id
// ============================================================
router.get('/student-results/:id', only, async (req, res, next) => {
  try {
    const studentId = Number(req.params.id);

    const rows = await db
      .select({
        id: results.id,
        courseCode: courses.code,
        courseTitle: courses.title,
        score: results.score,
        grade: results.grade,
        status: results.status,
        semester: results.semester,
      })
      .from(results)
      .innerJoin(courses, eq(results.courseId, courses.id))
      .where(and(
        eq(results.studentId, studentId),
        sql`${results.status} IN ('hod_verified', 'published')`
      ))
      .orderBy(results.semester, courses.code);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[hod/student-results] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/hod/courses
// ============================================================
router.get('/courses', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const rows = await courseQueries.list({
      departmentId, level: req.query.level, semester: req.query.semester, limit: 1000,
    });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/hod/profile
// ============================================================
router.get('/profile', only, async (req, res, next) => {
  try {
    const user = await userQueries.findByIdWithRelations(req.user.id);
    return res.json({ success: true, data: user });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/hod/security
// ============================================================
router.get('/security', only, async (req, res, next) => {
  try {
    const sessions = await sessionQueries.listUserSessions(req.user.id);
    const logins = await require('../../db/queries/audit').listLogins({ userId: req.user.id, limit: 30 });
    return res.json({ success: true, sessions, logins });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/hod/lecturers
// ============================================================
router.get('/lecturers', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const rows = await userQueries.listStaff({ departmentId });
    const lecturers = (rows || []).filter(function (u) {
      return String(u.role || '').toLowerCase() === 'lecturer';
    });
    return res.json({ success: true, data: lecturers });
  } catch (err) { return next(err); }
});

module.exports = router;