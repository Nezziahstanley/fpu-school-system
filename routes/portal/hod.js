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
const { eq, and, sql, desc, inArray } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');
const { logAudit } = require('../../utils/audit');
const { scoreToGrade, getActiveGradeScale } = require('../../utils/gradeScale');

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
      const resRows = await db.execute(sql`
        SELECT status, COUNT(*)::int AS count
        FROM results
        WHERE course_id IN (${sql.join(courseIds, sql`, `)})
          AND deleted_at IS NULL
        GROUP BY status
      `);
      
      resRows.rows.forEach(r => {
        if (r.status === 'submitted') pendingResults += Number(r.count);
        else if (r.status === 'hod_verified') verifiedResults += Number(r.count);
        else if (r.status === 'published') publishedResults += Number(r.count);
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

    let sqlQuery = sql`
      SELECT 
        r.course_id AS "courseId",
        c.code AS "courseCode",
        c.title AS "courseTitle",
        c.level AS "level",
        c.semester_name AS "semester",
        COUNT(r.id) AS "studentCount",
        MAX(r.submitted_at) AS "submittedAt",
        u.first_name || ' ' || u.last_name AS "lecturerName",
        s.name AS "sessionName"
      FROM results r
      INNER JOIN courses c ON r.course_id = c.id
      LEFT JOIN users u ON r.submitted_by = u.id
      LEFT JOIN academic_sessions s ON r.session_id = s.id
      WHERE c.department_id = ${departmentId} 
        AND r.status IN ('submitted', 'draft')
        AND r.deleted_at IS NULL
    `;

    if (semester) {
      sqlQuery = sql`${sqlQuery} AND r.semester = ${semester.toLowerCase()}`;
    }
    if (level) {
      sqlQuery = sql`${sqlQuery} AND c.level = ${level.toUpperCase()}`;
    }

    sqlQuery = sql`
      ${sqlQuery}
      GROUP BY r.course_id, c.code, c.title, c.level, c.semester_name, u.first_name, u.last_name, s.name
      ORDER BY MAX(r.submitted_at) DESC
    `;

    const rows = await db.execute(sqlQuery);

    return res.json({ success: true, data: rows.rows || [] });
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

    if (result.submittedBy) {
      await db.execute(sql`
        INSERT INTO notifications (user_id, title, body, type, link, is_read, created_at)
        VALUES (
          ${result.submittedBy},
          'Result Approved',
          ${'Your ' + (course.code || 'course') + ' result was approved by the HOD.'},
          'result_approved',
          '/portal/app.html#lecturer-results',
          false,
          NOW()
        )
      `);
    }

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

    const reason = req.body?.reason || 'Rejected by HOD';
    const row = await resultQueries.hodReject(result.id, req.user.id, reason);

    if (result.submittedBy) {
      await db.execute(sql`
        INSERT INTO notifications (user_id, title, body, type, link, is_read, created_at)
        VALUES (
          ${result.submittedBy},
          'Result Rejected',
          ${'Your ' + (course.code || 'course') + ' result was rejected. Reason: ' + reason},
          'result_rejected',
          '/portal/app.html#lecturer-results',
          false,
          NOW()
        )
      `);
    }

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

    const rows = await db.execute(sql`
      SELECT 
        r.id, 
        r.student_id AS "studentId",
        u.first_name || ' ' || u.last_name AS "studentName",
        u.matric_number AS "matricNumber",
        c.unit,
        r.score, 
        r.grade, 
        r.points,
        r.status,
        r.rejection_reason AS "rejectionReason",
        r.deleted_at AS "deletedAt",
        r.session_id AS "sessionId",
        r.semester
      FROM results r
      INNER JOIN users u ON r.student_id = u.id
      INNER JOIN courses c ON r.course_id = c.id
      WHERE r.course_id = ${courseId} 
        AND r.status IN ('submitted', 'draft', 'hod_rejected')
      ORDER BY 
        CASE r.status 
          WHEN 'submitted' THEN 1 
          WHEN 'draft' THEN 2 
          WHEN 'hod_rejected' THEN 3 
          ELSE 4 
        END,
        u.last_name
    `);

    return res.json({ success: true, data: rows.rows || [], course });
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
      submittedBy: results.submittedBy,
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

    const lecturerIds = [...new Set(allResults.map(r => r.submittedBy).filter(Boolean))];
    for (const lecturerId of lecturerIds) {
      await db.execute(sql`
        INSERT INTO notifications (user_id, title, body, type, link, is_read, created_at)
        VALUES (
          ${lecturerId},
          'Results Approved',
          'Your submitted results have been approved by the HOD.',
          'results_approved',
          '/portal/app.html#lecturer-results',
          false,
          NOW()
        )
      `);
    }

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
        eq(results.status, 'hod_verified'),
        sql`${results.deletedAt} IS NULL`
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
// ============================================================
router.get('/transcript', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const programmeId = req.query.programmeId;

    const conditions = [
      eq(users.departmentId, departmentId),
      eq(users.role, 'student')
    ];

    if (search) {
      conditions.push(sql`(${users.firstName} ILIKE ${'%' + search + '%'} OR ${users.lastName} ILIKE ${'%' + search + '%'} OR ${users.matricNumber} ILIKE ${'%' + search + '%'})`);
    }
    if (programmeId) {
      conditions.push(eq(users.programmeId, Number(programmeId)));
    }

    const [{ count }] = await db
      .select({ count: sql`count(*)::int` })
      .from(users)
      .where(and(...conditions));

    const students = await db
      .select({
        id: users.id,
        matricNumber: users.matricNumber,
        firstName: users.firstName,
        lastName: users.lastName,
        level: users.level,
        programmeId: users.programmeId,
        programmeName: programmes.name,
      })
      .from(users)
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .where(and(...conditions))
      .orderBy(users.lastName)
      .limit(limit)
      .offset(offset);

    const data = students.map(s => ({
      ...s,
      matricNumber: (s.matricNumber || '').replace(/SMT/gi, '').trim()
    }));

    const programmeList = await db
      .select({ id: programmes.id, name: programmes.name })
      .from(programmes)
      .where(eq(programmes.departmentId, departmentId))
      .orderBy(programmes.name);

    return res.json({ 
      success: true, 
      data, 
      pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
      programmes: programmeList
    });
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
    const departmentId = deptId(req);
    const studentId = Number(req.params.id);

    const [student] = await db.select()
      .from(users)
      .where(and(eq(users.id, studentId), eq(users.departmentId, departmentId)))
      .limit(1);

    if (!student) return res.status(403).json({ success: false, error: 'Student not in your department.' });

    const rows = await db.execute(sql`
      SELECT 
        r.id,
        c.code AS "courseCode",
        c.title AS "courseTitle",
        c.unit,
        r.score,
        r.grade,
        r.points,
        r.semester,
        r.status,
        s.name AS "sessionName"
      FROM results r
      JOIN courses c ON r.course_id = c.id
      LEFT JOIN academic_sessions s ON r.session_id = s.id
      WHERE r.student_id = ${studentId}
        AND r.status IN ('hod_verified', 'published')
        AND r.deleted_at IS NULL
      ORDER BY r.session_id ASC, r.semester ASC, c.code ASC
    `);

    return res.json({ 
      success: true, 
      data: rows.rows || [],
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        matricNumber: (student.matricNumber || '').replace(/SMT/gi, '').trim(),
        level: student.level,
      }
    });
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

// ============================================================
// GET /api/hod/results/ready-to-publish
// ============================================================
router.get('/results/ready-to-publish', only, async (req, res, next) => {
  try {
    const departmentId = Number(deptId(req));
    if (isNaN(departmentId)) {
      return res.status(400).json({ success: false, error: 'Invalid department ID.' });
    }

    const rows = await db
      .select({
        courseId: results.courseId,
        courseCode: courses.code,
        courseTitle: courses.title,
        level: courses.level,
        studentCount: sql`count(${results.id})::int`,
        verifiedAt: sql`max(${results.hodVerifiedAt})`,
      })
      .from(results)
      .innerJoin(courses, eq(results.courseId, courses.id))
      .where(and(
        eq(courses.departmentId, departmentId),
        eq(results.status, 'hod_verified'),
        sql`${results.deletedAt} IS NULL`
      ))
      .groupBy(results.courseId, courses.code, courses.title, courses.level)
      .orderBy(desc(sql`max(${results.hodVerifiedAt})`));

    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    console.error('[hod/ready-to-publish] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/hod/results/:courseId
// ============================================================
router.get('/results/:courseId', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const courseId = Number(req.params.courseId);
    
    if (isNaN(courseId)) {
      return res.status(400).json({ success: false, error: 'Invalid course ID.' });
    }

    const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
    if (!course || Number(course.departmentId) !== Number(departmentId)) {
      return res.status(403).json({ success: false, error: 'Course not in your department.' });
    }

    const sessResult = await db.execute(sql`
      SELECT DISTINCT session_id 
      FROM course_registrations 
      WHERE course_id = ${courseId} 
      LIMIT 1
    `);
    const sessionId = sessResult.rows[0]?.session_id;

    if (!sessionId) return res.json({ success: true, data: [] });

    const rows = await db.execute(sql`
      SELECT 
        u.id AS "studentId", u.first_name AS "firstName", u.last_name AS "lastName", 
        u.matric_number AS "matricNumber", r.id AS "resultId", r.score, r.grade, r.points, r.status AS "resultStatus"
      FROM course_registrations cr
      JOIN users u ON cr.student_id = u.id
      LEFT JOIN results r ON r.student_id = u.id AND r.course_id = cr.course_id AND r.session_id = cr.session_id
      WHERE cr.course_id = ${courseId} AND cr.session_id = ${sessionId} AND u.department_id = ${departmentId}
      ORDER BY u.last_name, u.first_name
    `);

    return res.json({ success: true, data: rows.rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/hod/results/:courseId
// ============================================================
router.post('/results/:courseId', only, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    
    const sessionResult = await db.execute(sql`SELECT id FROM academic_sessions WHERE is_current = true LIMIT 1`);
    const sessionId = sessionResult.rows[0]?.id || 1;

    const { results } = req.body; 

    if (!Array.isArray(results)) {
      return res.status(400).json({ success: false, error: 'Invalid results data.' });
    }

    const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found.' });

    const { calculateGrade } = require('../../utils/gpa');

    for (const r of results) {
      const ca = Number(r.caScore) || 0;
      const exam = Number(r.examScore) || 0;
      const total = ca + exam;
      
      const { grade, points } = calculateGrade(total, course.unit);

      await db.execute(sql`
        INSERT INTO results (
          student_id, course_id, session_id, semester, score, grade, points, status
        )
        VALUES (
          ${r.studentId}, ${courseId}, ${sessionId}, ${course.semesterName || 'First'}, 
          ${total}, ${grade}, ${points}, 'draft'
        )
        ON CONFLICT (student_id, course_id, session_id) 
        DO UPDATE SET
          score = EXCLUDED.score,
          grade = EXCLUDED.grade,
          points = EXCLUDED.points,
          status = 'draft'
      `);
    }

    return res.json({ success: true, message: 'Results saved as draft.' });
  } catch (err) {
    console.error('[hod/results/submit] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/hod/results/:courseId/approve
// ============================================================
router.post('/results/:courseId/approve', only, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    
    const sessionResult = await db.execute(sql`SELECT id FROM academic_sessions WHERE is_current = true LIMIT 1`);
    const sessionId = sessionResult.rows[0]?.id || 1;

    const { results } = req.body; 

    if (!Array.isArray(results)) {
      return res.status(400).json({ success: false, error: 'Invalid results data.' });
    }

    const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found.' });

    const { calculateGrade } = require('../../utils/gpa');

    for (const r of results) {
      const ca = Number(r.caScore) || 0;
      const exam = Number(r.examScore) || 0;
      const total = ca + exam;
      
      const { grade, points } = calculateGrade(total, course.unit);

      await db.execute(sql`
        INSERT INTO results (
          student_id, course_id, session_id, semester, score, grade, points, status, hod_verified_by, hod_verified_at
        )
        VALUES (
          ${r.studentId}, ${courseId}, ${sessionId}, ${course.semesterName || 'First'}, 
          ${total}, ${grade}, ${points}, 'hod_verified', ${req.user.id}, NOW()
        )
        ON CONFLICT (student_id, course_id, session_id) 
        DO UPDATE SET
          score = EXCLUDED.score,
          grade = EXCLUDED.grade,
          points = EXCLUDED.points,
          status = 'hod_verified',
          hod_verified_by = ${req.user.id},
          hod_verified_at = NOW()
      `);
    }

    return res.json({ success: true, message: 'Results saved and approved successfully.' });
  } catch (err) {
    console.error('[hod/results/approve] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/hod/results/:courseId/publish
// ============================================================
router.post('/results/:courseId/publish', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const courseId = Number(req.params.courseId);

    const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
    if (!course || Number(course.departmentId) !== Number(departmentId)) {
      return res.status(403).json({ success: false, error: 'Not in your department.' });
    }

    await db.execute(sql`
      UPDATE results 
      SET status = 'published', published_at = NOW()
      WHERE course_id = ${courseId} AND status = 'hod_verified'
    `);

    await logAudit({ req, action: 'hod.publish_results', entity: 'course', entityId: courseId });

    return res.json({ success: true, message: 'Results published successfully to students.' });
  } catch (err) {
    console.error('[hod/publish-results] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/hod/broad-sheet
// ============================================================
router.get('/broad-sheet', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const { level, semester, year } = req.query;

    if (!level || !semester || !year) {
      return res.status(400).json({ success: false, error: 'level, semester, and year are required.' });
    }

    const baseLevel = String(level).toUpperCase();
    const yearNum = Number(year);
    const isBoth = semester === 'both';

    const [dept] = await db.select().from(departments).where(eq(departments.id, departmentId)).limit(1);

    const studentsResult = await db.execute(sql`
      SELECT id, matric_number AS "matricNumber", first_name AS "firstName", last_name AS "lastName"
      FROM users 
      WHERE department_id = ${departmentId} 
        AND role = 'student' 
        AND level = ${baseLevel}
        AND (year_of_study = ${yearNum} OR year_of_study IS NULL)
      ORDER BY matric_number
    `);
    const students = studentsResult.rows || [];

    if (!students.length) {
      return res.json({ success: true, data: [], coursesFirst: [], coursesSecond: [], department: dept?.name, levelLabel: `${baseLevel} ${yearNum}` });
    }

    let coursesFirst = [], coursesSecond = [];

    if (isBoth) {
      const cRes = await db.execute(sql`
        SELECT id, code, title, unit, semester_name
        FROM courses 
        WHERE department_id = ${departmentId} 
          AND level = ${baseLevel}
          AND year_of_study = ${yearNum}
        ORDER BY semester_name, code
      `);
      const all = cRes.rows || [];
      coursesFirst  = all.filter(c => String(c.semester_name).toLowerCase() === 'first');
      coursesSecond = all.filter(c => String(c.semester_name).toLowerCase() === 'second');
    } else {
      const cRes = await db.execute(sql`
        SELECT id, code, title, unit, semester_name
        FROM courses 
        WHERE department_id = ${departmentId} 
          AND level = ${baseLevel}
          AND year_of_study = ${yearNum}
          AND LOWER(semester_name) LIKE ${'%' + semester.toLowerCase() + '%'}
        ORDER BY code
      `);
      if (semester === 'first') coursesFirst = cRes.rows || [];
      else coursesSecond = cRes.rows || [];
    }

    if (!coursesFirst.length && !coursesSecond.length) {
      return res.json({ success: true, data: [], coursesFirst: [], coursesSecond: [], department: dept?.name, levelLabel: `${baseLevel} ${yearNum}` });
    }

    const studentIds = students.map(s => s.id);
    const resultsResult = await db.execute(sql`
      SELECT student_id AS "studentId", course_id AS "courseId", score, grade, points
      FROM results 
      WHERE student_id IN (${sql.join(studentIds, sql`, `)})
        AND deleted_at IS NULL
    `);
    const allResults = resultsResult.rows || [];

    const data = students.map(s => {
      const myResults = allResults.filter(r => r.studentId === s.id);

      const computeSem = (courses) => {
        let tci = 0, tgp = 0;
        const grades = {};
        courses.forEach(c => {
          const r = myResults.find(x => x.courseId === c.id);
          if (r) {
            grades[c.code] = { grade: r.grade, score: r.score, points: r.points };
            if (r.grade && r.grade !== 'F') {
              tci += Number(c.unit);
              tgp += (Number(r.points) * Number(c.unit));
            }
          } else {
            grades[c.code] = { grade: '-', score: '-', points: 0 };
          }
        });
        const gpa = tci > 0 ? (tgp / tci).toFixed(2) : '0.00';
        return { grades, tci, tgp, gpa };
      };

      const first = computeSem(coursesFirst);
      const second = computeSem(coursesSecond);

      const tciTotal = first.tci + second.tci;
      const tgpTotal = first.tgp + second.tgp;
      const cgpa = tciTotal > 0 ? (tgpTotal / tciTotal).toFixed(2) : '0.00';

      let remark = 'PASS';
      if (Number(cgpa) >= 3.50) remark = 'DISTINCTION';
      else if (Number(cgpa) >= 3.00) remark = 'UPPER CREDIT';
      else if (Number(cgpa) >= 2.50) remark = 'LOWER CREDIT';
      else if (Number(cgpa) >= 2.00) remark = 'PASS';
      else remark = 'FAIL';

      return {
        id: s.id,
        matricNumber: (s.matricNumber || '').replace(/SMT/gi, '').trim(),
        name: `${s.lastName}, ${s.firstName}`,
        first,
        second,
        cgpa,
        tciTotal,
        tgpTotal,
        remark
      };
    });

    return res.json({
      success: true,
      department: dept?.name || 'Department',
      levelLabel: `${baseLevel} ${yearNum}`,
      semester,
      coursesFirst,
      coursesSecond,
      data
    });

  } catch (err) {
    console.error('[hod/broad-sheet] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/hod/results/:resultId/reject
// ============================================================
router.post('/results/:resultId/reject', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const resultId = Number(req.params.resultId);
    const reason = (req.body && req.body.reason) ? String(req.body.reason).trim() : null;

    if (!resultId || isNaN(resultId)) {
      return res.status(400).json({ success: false, error: 'Invalid result ID.' });
    }
    if (!reason) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required.' });
    }

    const check = await db.execute(sql`
      SELECT r.id, r.submitted_by AS "submittedBy", c.code AS "courseCode"
      FROM results r
      INNER JOIN courses c ON r.course_id = c.id
      WHERE r.id = ${resultId} AND c.department_id = ${departmentId}
      LIMIT 1
    `);

    if (!check.rows || !check.rows.length) {
      return res.status(404).json({ success: false, error: 'Result not found in your department.' });
    }

    const submittedBy = check.rows[0].submittedBy;
    const courseCode = check.rows[0].courseCode || 'a course';

    await db.execute(sql`
      UPDATE results 
      SET status = 'hod_rejected', 
          rejection_reason = ${reason}
      WHERE id = ${resultId}
    `);

    if (submittedBy) {
      await db.execute(sql`
        INSERT INTO notifications (user_id, title, body, type, link, is_read, created_at)
        VALUES (
          ${submittedBy},
          'Result Rejected',
          ${'Your ' + courseCode + ' result was rejected. Reason: ' + reason},
          'result_rejected',
          '/portal/app.html#lecturer-results',
          false,
          NOW()
        )
      `);
    }

    await logAudit({ req, action: 'hod.reject_single_result', entity: 'result', entityId: resultId, after: { reason } });
    return res.json({ success: true, message: 'Result rejected.' });
  } catch (err) {
    console.error('[hod/reject-result] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// DELETE /api/hod/results/:resultId (soft delete)
// ============================================================
router.delete('/results/:resultId', only, async (req, res, next) => {
  try {
    const departmentId = deptId(req);
    const resultId = Number(req.params.resultId);

    const check = await db.execute(sql`
      SELECT r.id, r.submitted_by AS "submittedBy", c.code AS "courseCode"
      FROM results r
      INNER JOIN courses c ON r.course_id = c.id
      WHERE r.id = ${resultId} AND c.department_id = ${departmentId}
      LIMIT 1
    `);
    if (!check.rows.length) return res.status(404).json({ success: false, error: 'Result not found.' });

    const submittedBy = check.rows[0].submittedBy;
    const courseCode = check.rows[0].courseCode || 'a course';

    await db.execute(sql`
      UPDATE results 
      SET status = 'hod_rejected',
          rejection_reason = 'Deleted by HOD',
          deleted_at = NOW()
      WHERE id = ${resultId}
    `);

    if (submittedBy) {
      await db.execute(sql`
        INSERT INTO notifications (user_id, title, body, type, link, is_read, created_at)
        VALUES (
          ${submittedBy},
          'Result Deleted',
          ${'Your ' + courseCode + ' result was deleted by the HOD. Contact the department office to resubmit.'},
          'result_deleted',
          '/portal/app.html#lecturer-results',
          false,
          NOW()
        )
      `);
    }

    await logAudit({ req, action: 'hod.delete_result', entity: 'result', entityId: resultId });
    return res.json({ success: true, message: 'Result deleted.' });
  } catch (err) {
    console.error('[hod/delete-result] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// TIMETABLE: HOD Fetch, Submit, Delete
// ============================================================

// GET /api/hod/timetable
router.get('/timetable', requireRole(['hod']), async (req, res, next) => {
  try {
    const { sessionId, semester } = req.query;
    const departmentId = req.user.departmentId;
    
    if (!departmentId) {
      return res.status(400).json({ success: false, error: 'Not assigned to a department.' });
    }

    const rows = await ttQueries.listWithRelations({ 
      sessionId: Number(sessionId), 
      semester 
    });
    
    // Filter strictly to this HOD's department
    const filtered = rows.filter(r => {
      const c = r.course || {};
      return Number(c.departmentId) === Number(departmentId);
    });

    res.json({ success: true, data: filtered });
  } catch (err) { next(err); }
});

// POST /api/hod/timetable/submit-for-approval
router.post('/timetable/submit-for-approval', requireRole(['hod']), async (req, res, next) => {
  try {
    const { sessionId, semester } = req.body || {};
    const departmentId = req.user.departmentId;

    if (!sessionId || !semester) {
      return res.status(400).json({ success: false, error: 'sessionId and semester are required.' });
    }

    const count = await ttQueries.submitDraftsForApproval(departmentId, sessionId, semester);
    
    if (count === 0) {
      return res.status(400).json({ success: false, error: 'No draft timetable slots found to submit.' });
    }

    await logAudit({
      req,
      action: 'timetable.submit_for_approval',
      entity: 'timetable_slots',
      entityId: departmentId,
      after: { departmentId, sessionId, semester, submittedCount: count },
    });

    res.json({ success: true, message: `Submitted ${count} slot(s) for approval.`, count });
  } catch (err) { next(err); }
});

// ============================================
// HOD: Create a New Timetable Slot
// ============================================
router.post('/timetable', requireRole(['hod']), async (req, res, next) => {
  try {
    const departmentId = req.user.departmentId;
    const { courseId, sessionId, semester, dayOfWeek, startTime, endTime, venue } = req.body || {};

    if (!courseId || !sessionId || !semester || !dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    // Verify the course belongs to this HOD's department
    const [course] = await db.select().from(courses).where(eq(courses.id, Number(courseId))).limit(1);
    if (!course || Number(course.departmentId) !== Number(departmentId)) {
      return res.status(403).json({ success: false, error: 'Course is not in your department.' });
    }

    const row = await ttQueries.create({
      courseId: Number(courseId),
      sessionId: Number(sessionId),
      semester,
      dayOfWeek,
      startTime,
      endTime,
      venue: venue || null,
    });

    await logAudit({ req, action: 'hod.create_timetable_slot', entity: 'timetable_slot', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

// DELETE /api/hod/timetable/:id
router.delete('/timetable/:id', requireRole(['hod']), async (req, res, next) => {
  try {
    const slot = await ttQueries.findById(req.params.id);
    if (!slot) return res.status(404).json({ success: false, error: 'Slot not found.' });
    await ttQueries.remove(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ============================================
// HOD: Get Academic Sessions
// ============================================
router.get('/sessions', only, async (req, res, next) => {
  try {
    const rows = await db.select().from(academicSessions).orderBy(desc(academicSessions.name));
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[hod/sessions] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// HOD: Submit Timetable for Approval
// ============================================
router.post('/timetable/submit-for-approval', only, async (req, res, next) => {
  try {
    const { sessionId, semester } = req.body || {};
    const departmentId = deptId(req);

    if (!sessionId || !semester) {
      return res.status(400).json({ success: false, error: 'sessionId and semester are required.' });
    }

    // Call the query function we created earlier
    const count = await ttQueries.submitDraftsForApproval(departmentId, sessionId, semester);
    
    if (count === 0) {
      return res.status(400).json({ success: false, error: 'No draft timetable slots found to submit.' });
    }

    await logAudit({
      req,
      action: 'timetable.submit_for_approval',
      entity: 'timetable_slots',
      entityId: departmentId,
      after: { departmentId, sessionId, semester, submittedCount: count },
    });

    return res.json({ 
      success: true, 
      message: `Submitted ${count} slot(s) for approval.`, 
      count 
    });
  } catch (err) { 
    console.error('[hod/timetable/submit] Error:', err);
    next(err); 
  }
});

module.exports = router;