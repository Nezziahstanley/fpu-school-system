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

// Cloudinary setup
const { storage } = require('../../utils/cloudinary');
const upload = multer({ storage });

const userQueries    = require('../../db/queries/users');
const courseQueries  = require('../../db/queries/courses');
const resultQueries  = require('../../db/queries/results');
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
  attendance, examSchedules
} = schema;

const only = requireRole('lecturer', 'hod');

// ============================================================
// GET /api/lecturer/dashboard
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    const lecturerId = req.user.id;
    const [currentSession] = await db.select().from(academicSessions).where(eq(academicSessions.isCurrent, true)).limit(1);

    const allocatedCourses = await db
      .select({ 
        id: courses.id, 
        code: courses.code, 
        title: courses.title,
        level: courses.level,
        unit: courses.unit,
        semesterName: courses.semesterName
      })
      .from(courseAllocations)
      .leftJoin(courses, eq(courseAllocations.courseId, courses.id))
      .where(eq(courseAllocations.lecturerId, lecturerId))
      .groupBy(courses.id, courses.code, courses.title, courses.level, courses.unit, courses.semesterName);

    const courseIds = allocatedCourses.map(c => c.id).filter(Boolean);
    const coursesCount = courseIds.length;

    let uniqueStudentIds = new Set();
    let totalRegistrations = 0;
    const courseStats = [];

    for (const c of allocatedCourses) {
      if (!c.id) continue;
      const regs = await db
        .select({ studentId: courseRegistrations.studentId })
        .from(courseRegistrations)
        .where(and(eq(courseRegistrations.courseId, c.id), eq(courseRegistrations.status, 'approved')));
      
      regs.forEach(r => uniqueStudentIds.add(r.studentId));
      courseStats.push({ code: c.code, title: c.title, students: regs.length });
      totalRegistrations += regs.length;
    }
    const totalStudents = uniqueStudentIds.size;

    let pendingResults = 0, materialsCount = 0, assignmentsCount = 0, attendanceCount = 0;
    
    if (courseIds.length > 0) {
      const pend = await db.select({ count: sql`count(distinct ${results.id})::int` })
        .from(results)
        .where(and(inArray(results.courseId, courseIds), inArray(results.status, ['draft', 'submitted', 'hod_rejected'])));
      pendingResults = pend[0]?.count || 0;

      const mats = await db.select({ count: sql`count(distinct ${courseMaterials.id})::int` })
        .from(courseMaterials)
        .where(eq(courseMaterials.lecturerId, lecturerId));
      materialsCount = mats[0]?.count || 0;

      const ass = await db.select({ count: sql`count(distinct ${assignments.id})::int` })
        .from(assignments)
        .where(eq(assignments.lecturerId, lecturerId));
      assignmentsCount = ass[0]?.count || 0;

      const att = await db.select({ count: sql`count(distinct ${attendance.id})::int` })
        .from(attendance)
        .where(inArray(attendance.courseId, courseIds));
      attendanceCount = att[0]?.count || 0;
    }

    const [dept] = await db.select({ name: departments.name }).from(users).leftJoin(departments, eq(users.departmentId, departments.id)).where(eq(users.id, lecturerId)).limit(1);

    return res.json({
      success: true,
      data: {
        coursesCount, 
        totalStudents, 
        totalRegistrations, 
        pendingResults,
        attendanceCount,
        activeSession: currentSession?.name || '—', 
        materialsCount, 
        assignmentsCount,
        departmentName: dept?.name || '—', 
        coursesList: allocatedCourses, 
        courseStats
      }
    });
  } catch (err) { 
    console.error('[lecturer/dashboard] Error:', err);
    return next(err); 
  }
});

// ============================================================
// GET /api/lecturer/students-list
// ============================================================
router.get('/students-list', only, async (req, res, next) => {
  try {
    const [lecturer] = await db.select({ departmentId: users.departmentId })
      .from(users).where(eq(users.id, req.user.id)).limit(1);

    const allocations = await db.select({ courseId: courseAllocations.courseId }).from(courseAllocations).where(eq(courseAllocations.lecturerId, req.user.id));
    const courseIds = allocations.map(a => a.courseId).filter(Boolean);
    
    if (!courseIds.length) {
      return res.json({ success: true, data: [], lecturerDeptId: lecturer?.departmentId });
    }

    const regs = await db.select({ studentId: courseRegistrations.studentId }).from(courseRegistrations).where(and(inArray(courseRegistrations.courseId, courseIds), eq(courseRegistrations.status, 'approved')));
    const studentIds = [...new Set(regs.map(r => r.studentId))];
    
    if (!studentIds.length) {
      return res.json({ success: true, data: [], lecturerDeptId: lecturer?.departmentId });
    }

    const students = await db
      .select({
        id: users.id, 
        matricNumber: users.matricNumber, 
        firstName: users.firstName, 
        lastName: users.lastName,
        level: users.level, 
        email: users.email, 
        isActive: users.isActive,
        departmentId: users.departmentId,
        programmeName: programmes.name, 
        departmentName: departments.name
      })
      .from(users)
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(inArray(users.id, studentIds))
      .orderBy(users.lastName);

    return res.json({ success: true, data: students, lecturerDeptId: lecturer?.departmentId });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// GET /api/lecturer/courses
// ============================================================
router.get('/courses', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        allocationId: courseAllocations.id,
        status: courseAllocations.status,
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
    if (!courseId) return res.status(400).json({ success: false, error: 'courseId is required.' });

    const allocation = await db
      .select({ id: courseAllocations.id })
      .from(courseAllocations)
      .where(and(eq(courseAllocations.lecturerId, req.user.id), eq(courseAllocations.courseId, Number(courseId))))
      .limit(1);

    if (!allocation.length) return res.status(403).json({ success: false, error: 'You are not allocated to this course.' });

    const rows = await db
      .select({ registration: courseRegistrations, student: users })
      .from(courseRegistrations)
      .leftJoin(users, eq(courseRegistrations.studentId, users.id))
      .where(and(eq(courseRegistrations.courseId, Number(courseId)), eq(courseRegistrations.status, 'approved')))
      .orderBy(users.lastName);

    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// ATTENDANCE
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

router.post('/attendance/bulk', only, async (req, res, next) => {
  try {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ success: false, error: 'rows[] is required.' });

    const courseId = Number(rows[0].courseId);
    const allocation = await db
      .select({ id: courseAllocations.id })
      .from(courseAllocations)
      .where(and(eq(courseAllocations.lecturerId, req.user.id), eq(courseAllocations.courseId, courseId)))
      .limit(1);

    if (!allocation.length) return res.status(403).json({ success: false, error: 'You are not allocated to this course.' });

    const [currentSession] = await db.select({ id: academicSessions.id }).from(academicSessions).where(eq(academicSessions.isCurrent, true)).limit(1);
    const defaultSessionId = currentSession?.id || null;
    const insertData = rows.map(r => ({
      courseId: Number(r.courseId),
      studentId: Number(r.studentId),
      lecturerId: req.user.id,
      sessionId: Number(r.sessionId) || defaultSessionId,
      semester: r.semester,
      date: r.date,
      status: r.status || 'present',
      remarks: r.remarks || null,
    }));

    if (insertData.some(row => !row.sessionId)) return res.status(409).json({ success: false, error: 'Select an academic session before recording attendance.' });

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

    await logAudit({ req, action: 'lecturer.attendance_bulk', after: { count: savedCount, courseId } });
    return res.json({ success: true, saved: savedCount });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// RESULTS
// ============================================================
router.get('/results', only, async (req, res, next) => {
  try {
    const [lecturer] = await db.select({ departmentId: users.departmentId })
      .from(users).where(eq(users.id, req.user.id)).limit(1);

    const allocations = await db.select({ courseId: courseAllocations.courseId })
      .from(courseAllocations).where(eq(courseAllocations.lecturerId, req.user.id));
      
    const courseIds = allocations.map(a => a.courseId).filter(Boolean);
    if (!courseIds.length) return res.json({ success: true, data: [], lecturerDeptId: lecturer?.departmentId });

    const rows = await db.execute(sql`
      SELECT DISTINCT ON (r.student_id, r.course_id) 
        r.id, r.score, r.grade, r.points, r.status, r.assignment_score AS "assignmentScore",
        u.first_name AS "studentFirstName", 
        u.last_name AS "studentLastName", 
        u.matric_number AS "matricNumber",
        u.department_id AS "studentDeptId",
        c.id AS "courseId",
        c.code AS "courseCode", 
        c.title AS "courseTitle",
        c.department_id AS "courseDeptId", 
        d.name AS "courseDepartment"
      FROM results r
      JOIN courses c ON r.course_id = c.id
      JOIN users u ON r.student_id = u.id
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE r.course_id IN (${sql.join(courseIds, sql`, `)})
      ORDER BY r.student_id, r.course_id, r.updated_at DESC, u.last_name, c.code
      LIMIT 2000
    `);

    return res.json({ 
      success: true, 
      data: rows.rows || [],
      lecturerDeptId: lecturer?.departmentId 
    });
  } catch (err) { 
    return res.status(500).json({ success: false, error: err.message }); 
  }
});

router.get('/results/pending', only, async (req, res, next) => {
  try {
    const allocations = await db.select({ courseId: courseAllocations.courseId })
      .from(courseAllocations).where(eq(courseAllocations.lecturerId, req.user.id));
    const courseIds = allocations.map(a => a.courseId).filter(Boolean);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const rows = await db.execute(sql`
      SELECT 
        r.course_id AS "courseId",
        c.code AS "courseCode",
        c.title AS "courseTitle",
        COUNT(r.id) AS "totalStudents",
        MAX(r.submitted_at) AS "submittedAt"
      FROM results r
      JOIN courses c ON r.course_id = c.id
      WHERE r.course_id IN (${sql.join(courseIds, sql`, `)}) AND r.status = 'submitted'
      GROUP BY r.course_id, c.code, c.title
      ORDER BY MAX(r.submitted_at) DESC
    `);

    return res.json({ success: true, data: rows.rows || [] });
  } catch (err) { 
    return res.status(500).json({ success: false, error: err.message }); 
  }
});

router.get('/results/:courseId', only, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    
    const allocation = await db
      .select({ id: courseAllocations.id })
      .from(courseAllocations)
      .where(and(eq(courseAllocations.lecturerId, req.user.id), eq(courseAllocations.courseId, courseId)))
      .limit(1);
    if (!allocation.length) return res.status(403).json({ success: false, error: 'Not your course.' });

    const rows = await db.execute(sql`
      SELECT DISTINCT ON (u.id)
             u.id AS "studentId", 
             u.first_name AS "firstName", 
             u.last_name AS "lastName", 
             u.matric_number AS "matricNumber",
             r.id AS "resultId", 
             r.score, 
             r.grade, 
             r.points, 
             COALESCE(r.assignment_score, 0) AS "assignmentScore", 
             r.status AS "resultStatus"
      FROM course_registrations cr
      JOIN users u ON cr.student_id = u.id
      LEFT JOIN results r ON r.student_id = u.id AND r.course_id = cr.course_id
      WHERE cr.course_id = ${courseId}
      ORDER BY u.id, r.updated_at DESC
    `);

    return res.json({ success: true, data: rows.rows || [] });
  } catch (err) {
    console.error('[lecturer/results] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/results/:courseId', only, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    
    const allocation = await db
      .select({ id: courseAllocations.id })
      .from(courseAllocations)
      .where(and(eq(courseAllocations.lecturerId, req.user.id), eq(courseAllocations.courseId, courseId)))
      .limit(1);
    if (!allocation.length) return res.status(403).json({ success: false, error: 'Not your course.' });

    const { results } = req.body; 
    if (!Array.isArray(results)) return res.status(400).json({ success: false, error: 'Invalid results data.' });

    const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found.' });

    const gradeScale = await getActiveGradeScale();

    for (const r of results) {
      const regResult = await db.execute(sql`
        SELECT session_id FROM course_registrations 
        WHERE student_id = ${r.studentId} AND course_id = ${courseId} 
        LIMIT 1
      `);
      const studentSessionId = regResult.rows[0]?.session_id || 1;

      const assign = Number(r.assignmentScore) || 0;
      const cw = Number(r.classworkScore) || 0;
      const exam = Number(r.examScore) || 0;
      const total = assign + cw + exam;
      
      const { grade, points } = await scoreToGrade(total, gradeScale);

      const semesterValue = (course.semesterName || 'first').toLowerCase();

      const savedResult = await db.execute(sql`
        INSERT INTO results (student_id, course_id, session_id, semester, score, grade, points, status, assignment_score)
        VALUES (
          ${r.studentId}, ${courseId}, ${studentSessionId}, ${semesterValue}, 
          ${total}, ${grade}, ${points}, 'draft', ${assign}
        )
        ON CONFLICT (student_id, course_id, session_id) 
        DO UPDATE SET
          score = EXCLUDED.score,
          grade = EXCLUDED.grade,
          points = EXCLUDED.points,
          assignment_score = EXCLUDED.assignment_score,
          status = 'draft',
          rejection_reason = NULL,
          updated_at = NOW()
        WHERE results.status IN ('draft', 'hod_rejected')
        RETURNING id
      `);
      if (!savedResult.rows[0] || !savedResult.rows[0].id) {
        return res.status(409).json({ success: false, error: 'A result has already moved beyond the editable stage. Refresh the page and contact your HOD if a correction is required.' });
      }
    }

    return res.json({ success: true, message: 'Results saved successfully.' });
  } catch (err) {
    console.error('[lecturer/results/submit] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/results/:id', only, async (req, res, next) => {
  try {
    const resultId = Number(req.params.id);
    const { score, grade, points } = req.body;

    const [result] = await db.select({ courseId: results.courseId, status: results.status })
      .from(results).where(eq(results.id, resultId)).limit(1);
    if (!result) return res.status(404).json({ success: false, error: 'Result not found.' });

    const alloc = await db.select({ id: courseAllocations.id }).from(courseAllocations)
      .where(and(eq(courseAllocations.lecturerId, req.user.id), eq(courseAllocations.courseId, result.courseId)))
      .limit(1);
    if (!alloc.length) return res.status(403).json({ success: false, error: 'Not your course.' });
    if (!['draft', 'hod_rejected'].includes(result.status)) {
      return res.status(409).json({ success: false, error: 'Only draft or HOD-rejected results can be edited.' });
    }

    const [updated] = await db.update(results)
      .set({ score: String(score), grade, points, status: 'draft', rejectionReason: null, updatedAt: new Date() })
      .where(and(eq(results.id, resultId), inArray(results.status, ['draft', 'hod_rejected'])))
      .returning({ id: results.id });
    if (!updated) return res.status(409).json({ success: false, error: 'Result status changed. Refresh and try again.' });

    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/results/:id', only, async (req, res, next) => {
  try {
    const resultId = Number(req.params.id);
    
    const [result] = await db.select({ courseId: results.courseId, status: results.status })
      .from(results).where(eq(results.id, resultId)).limit(1);
    if (!result) return res.status(404).json({ success: false, error: 'Result not found.' });

    const alloc = await db.select({ id: courseAllocations.id }).from(courseAllocations)
      .where(and(eq(courseAllocations.lecturerId, req.user.id), eq(courseAllocations.courseId, result.courseId)))
      .limit(1);
    if (!alloc.length) return res.status(403).json({ success: false, error: 'Not your course.' });
    if (!['draft', 'hod_rejected'].includes(result.status)) {
      return res.status(409).json({ success: false, error: 'Only draft or HOD-rejected results can be deleted.' });
    }

    const deleted = await db.delete(results)
      .where(and(eq(results.id, resultId), inArray(results.status, ['draft', 'hod_rejected'])))
      .returning({ id: results.id });
    if (!deleted.length) return res.status(409).json({ success: false, error: 'Result status changed. Refresh and try again.' });
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.post('/results/:courseId/submit-all', only, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    
    const alloc = await db.select({ id: courseAllocations.id }).from(courseAllocations)
      .where(and(eq(courseAllocations.lecturerId, req.user.id), eq(courseAllocations.courseId, courseId)))
      .limit(1);
    if (!alloc.length) return res.status(403).json({ success: false, error: 'Not your course.' });

    await db.execute(sql`
      UPDATE results 
      SET status = 'submitted', submitted_at = NOW(), submitted_by = ${req.user.id}
      WHERE course_id = ${courseId} AND status = 'draft'
    `);

    return res.json({ success: true, message: 'Results submitted to HOD successfully.' });
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
      fileUrl = req.file.path;
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
    const rows = await db.execute(sql`
      SELECT 
        a.id, 
        a.title, 
        a.description, 
        a.due_date AS "dueDate", 
        a.max_score AS "maxScore", 
        a.created_at AS "createdAt",
        c.id AS "courseId",
        c.code AS "courseCode",
        c.title AS "courseTitle",
        (SELECT COUNT(*) FROM course_registrations cr WHERE cr.course_id = a.course_id AND cr.status = 'approved') AS "totalStudents",
        (SELECT COUNT(*) FROM assignment_submissions sub WHERE sub.assignment_id = a.id) AS "submissionCount"
      FROM assignments a
      LEFT JOIN courses c ON a.course_id = c.id
      WHERE a.lecturer_id = ${req.user.id}
      ORDER BY a.created_at DESC
    `);

    const data = rows.rows.map(r => ({
      id: r.id,
      title: r.title || 'Untitled',
      description: r.description,
      dueDate: r.dueDate,
      maxScore: r.maxScore,
      createdAt: r.createdAt,
      courseId: r.courseId,
      courseCode: r.courseCode || '—',
      courseTitle: r.courseTitle,
      totalStudents: Number(r.totalStudents || 0),
      submissionCount: Number(r.submissionCount || 0)
    }));

    return res.json({ success: true, data: data || [] });
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

    const [currentSession] = await db.select({ id: academicSessions.id }).from(academicSessions).where(eq(academicSessions.isCurrent, true)).limit(1);
    if (!currentSession) return res.status(409).json({ success: false, error: 'There is no active academic session. Please contact the Academic Office.' });

    if (req.file) {
      attachmentUrl = req.file.path;
    }

    const [row] = await db.insert(assignments).values({
      courseId: Number(courseId), lecturerId: req.user.id, sessionId: currentSession.id,
      semester: 'first', title, description: description || null, dueDate: dueDate ? new Date(dueDate) : null,
      maxScore: maxScore ? Number(maxScore) : 100, attachmentUrl,
    }).returning();

    return res.status(201).json({ success: true, data: row });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
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
// GET /api/lecturer/assignments/:id/submissions
// ============================================================
router.get('/assignments/:id/submissions', only, async (req, res, next) => {
  try {
    const assignmentId = Number(req.params.id);
    
    // 1. Verify the assignment belongs to this lecturer
    const [assignment] = await db.select().from(assignments)
      .where(and(eq(assignments.id, assignmentId), eq(assignments.lecturerId, req.user.id)))
      .limit(1);
      
    if (!assignment) return res.status(403).json({ success: false, error: 'Assignment not found or not yours.' });

    // 2. Use Drizzle select (No manual SQL)
    // If the table name is different, check your schema. It should be 'assignmentSubmissions'.
    const submissions = await db
      .select({
        id: assignmentSubmissions.id,
        submissionText: assignmentSubmissions.submissionText,
        submissionUrl: assignmentSubmissions.submissionUrl,
        score: assignmentSubmissions.score,
        feedback: assignmentSubmissions.feedback,
        submittedAt: assignmentSubmissions.submittedAt,
        // Join student details
        firstName: users.firstName,
        lastName: users.lastName,
        matricNumber: users.matricNumber,
      })
      .from(assignmentSubmissions)
      .leftJoin(users, eq(assignmentSubmissions.studentId, users.id))
      .where(eq(assignmentSubmissions.assignmentId, assignmentId))
      .orderBy(users.lastName);

    const data = submissions.map(s => ({
      id: s.id,
      studentName: `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Unknown Student',
      matricNumber: s.matricNumber || '—',
      submissionText: s.submissionText,
      submissionUrl: s.submissionUrl,
      score: s.score,
      feedback: s.feedback,
      submittedAt: s.submittedAt,
    }));

    // 3. Get total registered students
    const [regCount] = await db.select({ count: sql`count(*)::int` })
      .from(courseRegistrations)
      .where(and(
        eq(courseRegistrations.courseId, assignment.courseId),
        eq(courseRegistrations.status, 'approved')
      ));
    
    assignment.totalStudents = regCount?.count || 0;

    return res.json({ success: true, data: data || [], assignment });
  } catch (err) { 
    console.error('[lecturer/submissions] Error:', err);
    // Send the exact error message to the frontend for debugging
    return res.status(500).json({ success: false, error: err.message || 'Database error' }); 
  }
});

router.post('/submissions/:id/grade', only, async (req, res, next) => {
  try {
    const { score, feedback } = req.body || {};
    if (score === undefined) return res.status(400).json({ success: false, error: 'Score is required.' });

    const submissionId = Number(req.params.id);

    const [submission] = await db.select({
      id: assignmentSubmissions.id,
      studentId: assignmentSubmissions.studentId,
      assignmentId: assignmentSubmissions.assignmentId,
      courseId: assignments.courseId,
      maxScore: assignments.maxScore
    })
    .from(assignmentSubmissions)
    .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
    .where(eq(assignmentSubmissions.id, submissionId))
    .limit(1);

    if (!submission) return res.status(404).json({ success: false, error: 'Submission not found.' });

    await db.update(assignmentSubmissions)
      .set({ score: String(score), feedback: feedback || null, gradedAt: new Date(), gradedBy: req.user.id })
      .where(eq(assignmentSubmissions.id, submissionId));

    const maxScore = Number(submission.maxScore) || 100;
    const calculated10Marks = Math.round((Number(score) / maxScore) * 10);

    const sessionResult = await db.execute(sql`SELECT id FROM academic_sessions WHERE is_current = true LIMIT 1`);
    const sessionId = sessionResult.rows[0]?.id || 1;

    const [course] = await db.select().from(courses).where(eq(courses.id, submission.courseId)).limit(1);

    await db.execute(sql`
      INSERT INTO results (student_id, course_id, session_id, semester, assignment_score, status)
      VALUES (
        ${submission.studentId}, ${submission.courseId}, ${sessionId}, ${(course?.semesterName || 'first').toLowerCase()}, 
        ${calculated10Marks}, 'draft'
      )
      ON CONFLICT (student_id, course_id, session_id) 
      DO UPDATE SET
        assignment_score = EXCLUDED.assignment_score,
        updated_at = NOW()
    `);

    return res.json({ success: true, data: { score, calculated10Marks } });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// REQUESTS
// ============================================================
router.get('/requests', only, async (req, res, next) => {
  try { return res.json({ success: true, data: await notifQueries.listComplaints({ userId: req.user.id }) }); }
  catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.post('/requests', only, async (req, res, next) => {
  try {
    const { subject, body, category } = req.body || {};
    if (!subject || !body) return res.status(400).json({ success: false, error: 'Subject and Message are required.' });

    const row = await notifQueries.createComplaint({ userId: req.user.id, subject, body, category: category || 'general' });
    return res.status(201).json({ success: true, data: row });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// GET /api/lecturer/reports
// ============================================================
router.get('/reports', only, async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  
  try {
    const lecturerId = req.user.id;
    const allocatedCourses = await db.select({ courseId: courseAllocations.courseId }).from(courseAllocations).where(eq(courseAllocations.lecturerId, lecturerId));
    const courseIds = allocatedCourses.map(c => c.courseId).filter(Boolean);
    const coursesCount = courseIds.length;

    if (!coursesCount) {
      return res.json({ success: true, data: { coursesCount: 0, totalStudents: 0, totalResults: 0, attendanceSessions: 0, stats: {}, gradeDist: {}, statusDist: {}, levelDist: {} } });
    }

    const allResults = await db
      .select({ score: results.score, grade: results.grade, status: results.status, studentId: results.studentId, level: users.level })
      .from(results)
      .leftJoin(users, eq(results.studentId, users.id))
      .where(inArray(results.courseId, courseIds));

    const uniqueStudents = new Set(allResults.map(r => r.studentId)).size;
    const totalResults = allResults.length;
    let totalScore = 0, highest = -1, lowest = 101, passCount = 0;

    const gradeDist = {}, statusDist = {}, levelDist = {};

    allResults.forEach(r => {
      const score = Number(r.score) || 0;
      totalScore += score;
      if (score > highest) highest = score;
      if (score < lowest) lowest = score;
      if (score >= 40) passCount++;

      gradeDist[r.grade || 'N/A'] = (gradeDist[r.grade || 'N/A'] || 0) + 1;
      statusDist[r.status || 'draft'] = (statusDist[r.status || 'draft'] || 0) + 1;
      levelDist[r.level || 'Unknown'] = (levelDist[r.level || 'Unknown'] || 0) + 1;
    });

    const avgScore = totalResults > 0 ? (totalScore / totalResults).toFixed(1) : 0;
    const passRate = totalResults > 0 ? Math.round((passCount / totalResults) * 100) : 0;

    const attRows = await db.select({ id: attendance.id }).from(attendance).where(inArray(attendance.courseId, courseIds));
    const attendanceSessions = attRows.length;

    return res.json({
      success: true,
      data: {
        coursesCount, totalStudents: uniqueStudents, totalResults, attendanceSessions,
        stats: { averageScore: avgScore, highestScore: highest === -1 ? 0 : highest, lowestScore: lowest === 101 ? 0 : lowest, passRate },
        gradeDist, statusDist, levelDist
      }
    });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// TIMETABLE / PROFILE / SECURITY
// ============================================================
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
// EXAMS
// ============================================================
router.get('/exams', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: examSchedules.id, examDate: examSchedules.examDate, startTime: examSchedules.startTime,
        endTime: examSchedules.endTime, venue: examSchedules.venue,
        courseCode: courses.code, courseTitle: courses.title, departmentName: departments.name,
      })
      .from(examSchedules)
      .innerJoin(courses, eq(examSchedules.courseId, courses.id))
      .innerJoin(courseAllocations, eq(examSchedules.courseId, courseAllocations.courseId))
      .leftJoin(departments, eq(courses.departmentId, departments.id))
      .where(eq(courseAllocations.lecturerId, req.user.id))
      .orderBy(examSchedules.examDate);

    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.get('/exams/:id/students', only, async (req, res, next) => {
  try {
    const examId = Number(req.params.id);
    const [exam] = await db.select({ courseId: examSchedules.courseId }).from(examSchedules).where(eq(examSchedules.id, examId)).limit(1);
    if (!exam) return res.status(404).json({ success: false, error: 'Exam not found.' });

    const alloc = await db.select({ id: courseAllocations.id }).from(courseAllocations)
      .where(and(eq(courseAllocations.lecturerId, req.user.id), eq(courseAllocations.courseId, exam.courseId)))
      .limit(1);
    if (!alloc.length) return res.status(403).json({ success: false, error: 'Not your course.' });

    // ... rest of exam students logic
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;