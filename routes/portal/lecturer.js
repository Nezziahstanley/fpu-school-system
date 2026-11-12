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
const { eq, and, or, desc, inArray, sql } = require('drizzle-orm');
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
        semesterName: courses.semesterName,
        allocationStatus: courseAllocations.status,
        sessionName: academicSessions.name
      })
      .from(courseAllocations)
      .leftJoin(courses, eq(courseAllocations.courseId, courses.id))
      .leftJoin(academicSessions, eq(courseAllocations.sessionId, academicSessions.id))
      .where(eq(courseAllocations.lecturerId, lecturerId))
      .groupBy(courses.id, courses.code, courses.title, courses.level, courses.unit, courses.semesterName, courseAllocations.status, academicSessions.name);

    const courseIds = [...new Set(allocatedCourses.map(c => Number(c.id)).filter(Boolean))];
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
        .where(and(inArray(attendance.courseId, courseIds), eq(attendance.lecturerId, lecturerId)));
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
// GET /api/lecturer/students-list — course allocations and approved registered students
// ============================================================
router.get('/students-list', only, async (req, res, next) => {
  try {
    const [lecturer] = await db.select({ departmentId: users.departmentId }).from(users).where(eq(users.id, req.user.id)).limit(1);
    const allocations = await db.select({
      allocationId: courseAllocations.id, courseId: courses.id, courseCode: courses.code,
      courseTitle: courses.title, courseLevel: courses.level, unit: courses.unit,
      sessionId: courseAllocations.sessionId, sessionName: academicSessions.name,
      semester: courseAllocations.semester, departmentId: courses.departmentId,
      departmentName: departments.name, allocationStatus: courseAllocations.status
    }).from(courseAllocations)
      .innerJoin(courses, eq(courseAllocations.courseId, courses.id))
      .leftJoin(academicSessions, eq(courseAllocations.sessionId, academicSessions.id))
      .leftJoin(departments, eq(courses.departmentId, departments.id))
      .where(and(eq(courseAllocations.lecturerId, req.user.id), sql`${courseAllocations.status} <> 'cancelled'`)).orderBy(departments.name, courses.code);
    const courseData=[], uniqueStudents=new Map();
    for (const allocation of allocations) {
      const registered=await db.select({
        id:users.id,matricNumber:users.matricNumber,firstName:users.firstName,lastName:users.lastName,
        level:users.level,email:users.email,isActive:users.isActive,departmentId:users.departmentId,
        programmeName:programmes.name,departmentName:departments.name
      }).from(courseRegistrations)
        .innerJoin(users,eq(courseRegistrations.studentId,users.id))
        .leftJoin(programmes,eq(users.programmeId,programmes.id))
        .leftJoin(departments,eq(users.departmentId,departments.id))
        .where(and(eq(courseRegistrations.courseId,allocation.courseId),eq(courseRegistrations.sessionId,allocation.sessionId),
          eq(courseRegistrations.semester,allocation.semester),eq(courseRegistrations.status,'approved')))
        .orderBy(users.lastName,users.firstName);
      registered.forEach(st=>uniqueStudents.set(Number(st.id),st));
      courseData.push({...allocation,students:registered,studentCount:registered.length});
    }
    return res.json({success:true,courses:courseData,data:Array.from(uniqueStudents.values()),lecturerDeptId:lecturer?.departmentId??null});
  } catch(err) { console.error('[lecturer/students-list] Error:',err); return res.status(500).json({success:false,error:err.message}); }
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
        allocationSemester: courseAllocations.semester,
        sessionId: courseAllocations.sessionId,
        sessionName: academicSessions.name,
      })
      .from(courseAllocations)
      .leftJoin(courses, eq(courseAllocations.courseId, courses.id))
      .leftJoin(academicSessions, eq(courseAllocations.sessionId, academicSessions.id))
      .where(eq(courseAllocations.lecturerId, req.user.id))
      .orderBy(desc(academicSessions.isCurrent), desc(courseAllocations.sessionId), courses.code);

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
    const { courseId, sessionId, semester } = req.query;
    if (!courseId) return res.status(400).json({ success: false, error: 'courseId is required.' });
    const allocationConditions = [
      eq(courseAllocations.lecturerId, req.user.id),
      eq(courseAllocations.courseId, Number(courseId)),
      sql`${courseAllocations.status} <> 'cancelled'`
    ];
    if (sessionId) allocationConditions.push(eq(courseAllocations.sessionId, Number(sessionId)));
    if (semester) allocationConditions.push(eq(courseAllocations.semester, String(semester).toLowerCase()));

    const allocation = await db.select({
      sessionId: courseAllocations.sessionId,
      semester: courseAllocations.semester
    }).from(courseAllocations).where(and(...allocationConditions)).limit(1);
    if (!allocation.length) return res.status(403).json({ success: false, error: 'You are not allocated to this course/session.' });

    const registrationConditions = [
      eq(courseRegistrations.courseId, Number(courseId)),
      eq(courseRegistrations.status, 'approved'),
      eq(courseRegistrations.sessionId, allocation[0].sessionId),
      eq(courseRegistrations.semester, allocation[0].semester)
    ];
    const rows = await db.select({ registration: courseRegistrations, student: users })
      .from(courseRegistrations)
      .leftJoin(users, eq(courseRegistrations.studentId, users.id))
      .where(and(...registrationConditions))
      .orderBy(users.lastName);

    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// ATTENDANCE — lecturer course cards, approved timetable and course-scoped records
// ============================================================
router.get('/attendance', only, async (req, res, next) => {
  try {
    const allocations=await db.select({
      allocationId:courseAllocations.id,courseId:courses.id,courseCode:courses.code,courseTitle:courses.title,
      sessionId:courseAllocations.sessionId,sessionName:academicSessions.name,semester:courseAllocations.semester,
      departmentId:courses.departmentId,departmentName:departments.name
    }).from(courseAllocations)
      .innerJoin(courses,eq(courseAllocations.courseId,courses.id))
      .leftJoin(academicSessions,eq(courseAllocations.sessionId,academicSessions.id))
      .leftJoin(departments,eq(courses.departmentId,departments.id))
      .where(and(eq(courseAllocations.lecturerId,req.user.id),sql`${courseAllocations.status} <> 'cancelled'`)).orderBy(departments.name,courses.code);
    if(!allocations.length)return res.json({success:true,courses:[],data:[]});
    const coursesWithMeta=[];
    for(const a of allocations){
      const [registered]=await db.select({count:sql`count(*)::int`}).from(courseRegistrations).where(and(
        eq(courseRegistrations.courseId,a.courseId),eq(courseRegistrations.sessionId,a.sessionId),
        eq(courseRegistrations.semester,a.semester),eq(courseRegistrations.status,'approved')));
      const schedule=await db.select({dayOfWeek:timetableSlots.dayOfWeek,startTime:timetableSlots.startTime,endTime:timetableSlots.endTime,venue:timetableSlots.venue})
        .from(timetableSlots).where(and(eq(timetableSlots.courseId,a.courseId),eq(timetableSlots.sessionId,a.sessionId),
          eq(timetableSlots.semester,a.semester),eq(timetableSlots.status,'approved')))
        .orderBy(timetableSlots.dayOfWeek,timetableSlots.startTime);
      coursesWithMeta.push({...a,registeredCount:registered?.count||0,schedule});
    }
    const scope=allocations.map(a=>and(eq(attendance.courseId,a.courseId),eq(attendance.sessionId,a.sessionId),eq(attendance.semester,a.semester)));
    const rows=await db.select({
      id:attendance.id,courseId:attendance.courseId,sessionId:attendance.sessionId,semester:attendance.semester,
      date:attendance.date,status:attendance.status,remarks:attendance.remarks,createdAt:attendance.createdAt,
      studentId:attendance.studentId,studentFirstName:users.firstName,studentLastName:users.lastName,
      matricNumber:users.matricNumber,courseCode:courses.code,courseTitle:courses.title
    }).from(attendance).leftJoin(users,eq(attendance.studentId,users.id)).leftJoin(courses,eq(attendance.courseId,courses.id))
      .where(and(eq(attendance.lecturerId,req.user.id),or(...scope))).orderBy(desc(attendance.date),users.lastName).limit(3000);
    return res.json({success:true,courses:coursesWithMeta,data:rows});
  }catch(err){console.error('[lecturer/attendance] Error:',err);return res.status(500).json({success:false,error:err.message});}
});

router.post('/attendance/bulk', only, async (req, res, next) => {
  try {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 1000) return res.status(400).json({ success: false, error: 'Provide between 1 and 1000 attendance rows.' });

    const courseId = Number(rows[0].courseId);
    const sessionId = Number(rows[0].sessionId);
    const semester = String(rows[0].semester || '').toLowerCase();
    if (!Number.isInteger(courseId) || courseId < 1 || !Number.isInteger(sessionId) || sessionId < 1 ||
        !['first', 'second'].includes(semester) ||
        rows.some(r => Number(r.courseId) !== courseId || Number(r.sessionId) !== sessionId || String(r.semester || '').toLowerCase() !== semester)) {
      return res.status(400).json({ success: false, error: 'All attendance rows must belong to one valid course, session and semester.' });
    }
    const studentIds = rows.map(r => Number(r.studentId));
    if (studentIds.some(id => !Number.isInteger(id) || id < 1) || new Set(studentIds).size !== studentIds.length) {
      return res.status(400).json({ success: false, error: 'Student IDs must be valid and unique.' });
    }
    if (rows.some(r => !['present', 'absent', 'late'].includes(String(r.status || 'present').toLowerCase()))) {
      return res.status(400).json({ success: false, error: 'Attendance status must be present, absent, or late.' });
    }
    if (rows.some(r => !/^\d{4}-\d{2}-\d{2}$/.test(String(r.date || '')) || Number.isNaN(Date.parse(r.date)))) {
      return res.status(400).json({ success: false, error: 'A valid attendance date is required.' });
    }
    const allocation = await db
      .select({ id: courseAllocations.id })
      .from(courseAllocations)
      .where(and(
        eq(courseAllocations.lecturerId, req.user.id),
        eq(courseAllocations.courseId, courseId),
        eq(courseAllocations.sessionId, sessionId),
        eq(courseAllocations.semester, semester),
        sql`${courseAllocations.status} <> 'cancelled'`
      ))
      .limit(1);

    if (!allocation.length) return res.status(403).json({ success: false, error: 'You are not allocated to this course/session.' });

    const registered = await db.select({
      studentId: courseRegistrations.studentId,
      sessionId: courseRegistrations.sessionId,
      semester: courseRegistrations.semester,
    }).from(courseRegistrations).where(and(
      eq(courseRegistrations.courseId, courseId),
      eq(courseRegistrations.sessionId, sessionId),
      eq(courseRegistrations.semester, semester),
      eq(courseRegistrations.status, 'approved'),
      inArray(courseRegistrations.studentId, studentIds)
    ));
    const registrationByStudent = new Map(registered.map(r => [Number(r.studentId), r]));
    if (studentIds.some(id => !registrationByStudent.has(id))) {
      return res.status(400).json({ success: false, error: 'Attendance can only be recorded for students with approved registration in this course.' });
    }

    const insertData = rows.map(r => {
      const registration = registrationByStudent.get(Number(r.studentId));
      return {
        courseId,
        studentId: Number(r.studentId),
        lecturerId: req.user.id,
        sessionId,
        semester,
        date: r.date,
        status: String(r.status || 'present').toLowerCase(),
        remarks: r.remarks || null,
      };
    });

    if (insertData.some(row => !row.sessionId || !row.semester)) return res.status(409).json({ success: false, error: 'The student registration has no academic session or semester. Contact the Academic Office.' });

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

    // Return every active allocation first, including courses owned by other departments.
    // Starting from allocations ensures courses remain visible even before students register.
    const allocatedCourses = await db.select({
      allocationId: courseAllocations.id,
      id: courses.id,
      code: courses.code,
      title: courses.title,
      level: courses.level,
      unit: courses.unit,
      courseDeptId: courses.departmentId,
      courseDepartment: departments.name,
      sessionId: courseAllocations.sessionId,
      sessionName: academicSessions.name,
      allocationSemester: courseAllocations.semester,
      allocationStatus: courseAllocations.status
    }).from(courseAllocations)
      .innerJoin(courses, eq(courseAllocations.courseId, courses.id))
      .leftJoin(departments, eq(courses.departmentId, departments.id))
      .leftJoin(academicSessions, eq(courseAllocations.sessionId, academicSessions.id))
      .where(and(eq(courseAllocations.lecturerId, req.user.id), sql`${courseAllocations.status} <> 'cancelled'`))
      .orderBy(departments.name, courses.code, desc(courseAllocations.sessionId));

    const rows = await db.execute(sql`
      SELECT cr.student_id AS "studentId",
        r.id AS "id", r.score AS "score", r.grade AS "grade", r.points AS "points",
        COALESCE(r.status::text, 'not_started') AS "status",
        COALESCE(assignment_marks.score, 0) AS "assignmentScore",
        cr.session_id AS "sessionId", cr.semester AS "semester",
        u.first_name AS "studentFirstName", u.last_name AS "studentLastName",
        u.matric_number AS "matricNumber", u.department_id AS "studentDeptId",
        c.id AS "courseId", c.code AS "courseCode", c.title AS "courseTitle",
        c.department_id AS "courseDeptId", d.name AS "courseDepartment"
      FROM course_registrations cr
      INNER JOIN course_allocations ca
        ON ca.course_id = cr.course_id AND ca.session_id = cr.session_id
        AND ca.semester = cr.semester AND ca.lecturer_id = ${req.user.id}
        AND ca.status <> 'cancelled'
      INNER JOIN courses c ON c.id = cr.course_id
      INNER JOIN users u ON u.id = cr.student_id
      LEFT JOIN results r
        ON r.student_id = cr.student_id AND r.course_id = cr.course_id
        AND r.session_id = cr.session_id AND r.semester = cr.semester
      LEFT JOIN departments d ON d.id = c.department_id
      LEFT JOIN LATERAL (
        SELECT ROUND((COALESCE(SUM(COALESCE(asub.score, 0)), 0) /
          NULLIF(SUM(a.max_score), 0) * 10)::numeric, 2) AS score
        FROM assignments a
        LEFT JOIN assignment_submissions asub
          ON asub.assignment_id = a.id AND asub.student_id = cr.student_id
        WHERE a.course_id = cr.course_id AND a.session_id = cr.session_id
          AND a.semester = cr.semester
      ) assignment_marks ON TRUE
      WHERE cr.status = 'approved'
      ORDER BY c.department_id, c.code, cr.student_id
      LIMIT 5000
    `);
    return res.json({
      success: true,
      courses: allocatedCourses,
      data: rows.rows || [],
      lecturerDeptId: lecturer?.departmentId ?? null
    });
  } catch (err) {
    console.error('[lecturer/results] Overview query failed:', err);
    return res.status(500).json({ success: false, error: 'Unable to load lecturer results. Please refresh and try again.', detail: err.message });
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
    const sessionId = Number(req.query.sessionId);
    const semester = String(req.query.semester || '').toLowerCase();
    if (!Number.isInteger(courseId) || courseId < 1 || !Number.isInteger(sessionId) || sessionId < 1 || !['first', 'second'].includes(semester)) {
      return res.status(400).json({ success: false, error: 'A valid course, session and semester are required.' });
    }
    const allocation = await db.select({ id: courseAllocations.id }).from(courseAllocations)
      .where(and(eq(courseAllocations.lecturerId, req.user.id), eq(courseAllocations.courseId, courseId),
        eq(courseAllocations.sessionId, sessionId), eq(courseAllocations.semester, semester),
        sql`${courseAllocations.status} <> 'cancelled'`)).limit(1);
    if (!allocation.length) return res.status(403).json({ success: false, error: 'You are not allocated to this course/session.' });

    const rows = await db.execute(sql`
      SELECT u.id AS "studentId", u.first_name AS "firstName", u.last_name AS "lastName",
        u.matric_number AS "matricNumber", r.id AS "resultId", r.score AS "score",
        r.grade AS "grade", r.points AS "points", r.status AS "resultStatus",
        COALESCE(assignment_marks.score, 0) AS "assignmentScore"
      FROM course_registrations cr
      INNER JOIN users u ON u.id = cr.student_id
      LEFT JOIN results r ON r.student_id = cr.student_id AND r.course_id = cr.course_id
        AND r.session_id = cr.session_id AND r.semester = cr.semester
      LEFT JOIN LATERAL (
        SELECT ROUND((COALESCE(SUM(COALESCE(asub.score, 0)), 0) /
          NULLIF(SUM(a.max_score), 0) * 10)::numeric, 2) AS score
        FROM assignments a
        LEFT JOIN assignment_submissions asub
          ON asub.assignment_id = a.id AND asub.student_id = cr.student_id
        WHERE a.course_id = cr.course_id AND a.session_id = cr.session_id
          AND a.semester = cr.semester
      ) assignment_marks ON TRUE
      WHERE cr.course_id = ${courseId} AND cr.session_id = ${sessionId}
        AND cr.semester = ${semester} AND cr.status = 'approved'
      ORDER BY u.last_name, u.first_name
    `);
    return res.json({ success: true, data: rows.rows || [] });
  } catch (err) {
    console.error('[lecturer/results] Course roster query failed:', err);
    return res.status(500).json({ success: false, error: 'Unable to load students for this course. Please refresh and try again.', detail: err.message });
  }
});

router.post('/results/:courseId', only, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const sessionId = Number(req.query.sessionId);
    const semester = String(req.query.semester || '').toLowerCase();
    if (!Number.isInteger(sessionId) || sessionId < 1 || !['first', 'second'].includes(semester)) {
      return res.status(400).json({ success: false, error: 'A valid course session and semester are required.' });
    }
    const allocation = await db.select({ id: courseAllocations.id })
      .from(courseAllocations)
      .where(and(
        eq(courseAllocations.lecturerId, req.user.id),
        eq(courseAllocations.courseId, courseId),
        eq(courseAllocations.sessionId, sessionId),
        eq(courseAllocations.semester, semester)
      )).limit(1);
    if (!allocation.length) return res.status(403).json({ success: false, error: 'Not your course/session.' });

    const { results: resultRows } = req.body || {};
    if (!Array.isArray(resultRows) || resultRows.length === 0 || resultRows.length > 1000) return res.status(400).json({ success: false, error: 'Provide between 1 and 1000 student results.' });

    const studentIds = resultRows.map(r => Number(r.studentId));
    if (studentIds.some(id => !Number.isInteger(id) || id < 1) || new Set(studentIds).size !== studentIds.length) {
      return res.status(400).json({ success: false, error: 'Student IDs must be valid and unique.' });
    }
    const validScores = resultRows.every(r => {
      const a = Number(r.assignmentScore), c = Number(r.classworkScore), e = Number(r.examScore);
      return [a, c, e].every(Number.isFinite) && a >= 0 && a <= 10 && c >= 0 && c <= 20 && e >= 0 && e <= 70;
    });
    if (!validScores) return res.status(400).json({ success: false, error: 'Scores must be within the approved components: Assignment 0–10, Classwork 0–20, Exam 0–70.' });

    const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found.' });

    const registrations = await db.select({
      studentId: courseRegistrations.studentId,
      sessionId: courseRegistrations.sessionId
    }).from(courseRegistrations).where(and(
      eq(courseRegistrations.courseId, courseId),
      eq(courseRegistrations.sessionId, sessionId),
      eq(courseRegistrations.semester, semester),
      eq(courseRegistrations.status, 'approved'),
      inArray(courseRegistrations.studentId, studentIds)
    ));
    const registrationByStudent = new Map(registrations.map(r => [Number(r.studentId), r]));
    if (studentIds.some(id => !registrationByStudent.has(id))) {
      return res.status(400).json({ success: false, error: 'Results can only be entered for students with approved registration in this course.' });
    }

    const gradeScale = await getActiveGradeScale();

    for (const r of resultRows) {
      const studentSessionId = registrationByStudent.get(Number(r.studentId)).sessionId;

      const assign = Number(r.assignmentScore) || 0;
      const cw = Number(r.classworkScore) || 0;
      const exam = Number(r.examScore) || 0;
      const total = assign + cw + exam;
      
      const { grade, points } = await scoreToGrade(total, gradeScale);

      const semesterValue = semester;

      const savedResult = await db.execute(sql`
        INSERT INTO results (student_id, course_id, session_id, semester, score, grade, points, status)
        VALUES (
          ${r.studentId}, ${courseId}, ${studentSessionId}, ${semesterValue},
          ${total}, ${grade}, ${points}, 'draft'
        )
        ON CONFLICT (student_id, course_id, session_id, semester) 
        DO UPDATE SET
          score = EXCLUDED.score,
          grade = EXCLUDED.grade,
          points = EXCLUDED.points,
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
    const sessionId = Number(req.query.sessionId);
    const semester = String(req.query.semester || '').toLowerCase();
    if (!Number.isInteger(sessionId) || sessionId < 1 || !['first', 'second'].includes(semester)) {
      return res.status(400).json({ success: false, error: 'A valid course session and semester are required.' });
    }
    const alloc = await db.select({ id: courseAllocations.id }).from(courseAllocations)
      .where(and(
        eq(courseAllocations.lecturerId, req.user.id),
        eq(courseAllocations.courseId, courseId),
        eq(courseAllocations.sessionId, sessionId),
        eq(courseAllocations.semester, semester)
      )).limit(1);
    if (!alloc.length) return res.status(403).json({ success: false, error: 'Not your course/session.' });

    const submitted = await db.execute(sql`
      UPDATE results
      SET status = 'submitted', submitted_at = NOW(), submitted_by = ${req.user.id}
      WHERE course_id = ${courseId}
        AND session_id = ${sessionId}
        AND semester = ${semester}
        AND status = 'draft'
      RETURNING id
    `);
    const submittedCount = submitted.rows?.length || 0;
    if (!submittedCount) return res.status(409).json({ success: false, error: 'There are no saved draft results for this course session to submit.' });

    return res.json({ success: true, submittedCount, message: 'Results submitted to HOD successfully.' });
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
    const [allocation] = await db.select({ id: courseAllocations.id }).from(courseAllocations).where(and(eq(courseAllocations.lecturerId, req.user.id), eq(courseAllocations.courseId, Number(courseId)))).limit(1);
    if (!allocation) return res.status(403).json({ success: false, error: 'You can only upload materials for courses allocated to you.' });

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
        a.session_id AS "sessionId",
        a.semester AS "semester",
        a.created_at AS "createdAt",
        c.id AS "courseId",
        c.code AS "courseCode",
        c.title AS "courseTitle",
        acs.name AS "sessionName",
        (SELECT COUNT(*) FROM course_registrations cr WHERE cr.course_id = a.course_id AND cr.session_id = a.session_id AND cr.semester = a.semester AND cr.status = 'approved') AS "totalStudents",
        (SELECT COUNT(*) FROM assignment_submissions sub WHERE sub.assignment_id = a.id) AS "submissionCount"
      FROM assignments a
      LEFT JOIN courses c ON a.course_id = c.id
      LEFT JOIN academic_sessions acs ON a.session_id = acs.id
      WHERE a.lecturer_id = ${req.user.id}
      ORDER BY a.created_at DESC
    `);

    const data = rows.rows.map(r => ({
      id: r.id,
      title: r.title || 'Untitled',
      description: r.description,
      dueDate: r.dueDate,
      maxScore: r.maxScore,
      sessionId: r.sessionId,
      semester: r.semester,
      sessionName: r.sessionName,
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
    const { courseId, sessionId, semester, title, description, dueDate, maxScore } = req.body || {};
    let attachmentUrl = null;

    if (!courseId || !title || !sessionId || !semester) return res.status(400).json({ success: false, error: 'Course, session, semester and title are required.' });
    if (!['first', 'second'].includes(String(semester).toLowerCase())) return res.status(400).json({ success: false, error: 'Select a valid semester.' });

    const [allocation] = await db.select({
      id: courseAllocations.id,
      sessionId: courseAllocations.sessionId,
      semester: courseAllocations.semester
    }).from(courseAllocations).where(and(
      eq(courseAllocations.lecturerId, req.user.id),
      eq(courseAllocations.courseId, Number(courseId)),
      eq(courseAllocations.sessionId, Number(sessionId)),
      eq(courseAllocations.semester, String(semester).toLowerCase())
    )).limit(1);
    if (!allocation) return res.status(403).json({ success: false, error: 'You can only create assignments for courses allocated to you.' });
    const parsedDueDate = dueDate ? new Date(dueDate) : null;
    if (dueDate && Number.isNaN(parsedDueDate.getTime())) return res.status(400).json({ success: false, error: 'A valid assignment due date is required.' });
    const scoreLimit = Number(maxScore || 100);
    if (!Number.isFinite(scoreLimit) || scoreLimit < 1 || scoreLimit > 1000) return res.status(400).json({ success: false, error: 'Maximum score must be between 1 and 1000.' });

    if (req.file) {
      attachmentUrl = req.file.path;
    }

    const [row] = await db.insert(assignments).values({
      courseId: Number(courseId), lecturerId: req.user.id, sessionId: allocation.sessionId,
      semester: allocation.semester, title, description: description || null, dueDate: parsedDueDate,
      maxScore: scoreLimit, attachmentUrl,
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
        eq(courseRegistrations.sessionId, assignment.sessionId),
        eq(courseRegistrations.semester, assignment.semester),
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
    const numericScore = Number(score);

    const [submission] = await db.select({
      id: assignmentSubmissions.id,
      studentId: assignmentSubmissions.studentId,
      assignmentId: assignmentSubmissions.assignmentId,
      courseId: assignments.courseId,
      maxScore: assignments.maxScore,
      sessionId: assignments.sessionId,
      semester: assignments.semester
    })
    .from(assignmentSubmissions)
    .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
    .where(and(eq(assignmentSubmissions.id, submissionId), eq(assignments.lecturerId, req.user.id)))
    .limit(1);

    if (!submission) return res.status(404).json({ success: false, error: 'Submission not found for your assignments.' });
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > Number(submission.maxScore || 100)) {
      return res.status(400).json({ success: false, error: 'Score must be between 0 and the assignment maximum score.' });
    }

    await db.update(assignmentSubmissions)
      .set({ score: String(numericScore), feedback: feedback || null, gradedAt: new Date(), gradedBy: req.user.id })
      .where(eq(assignmentSubmissions.id, submissionId));

    const maxScore = Number(submission.maxScore) || 100;
    const calculated10Marks = Math.round((Number(score) / maxScore) * 10);
    // Assignment marks are derived from assignment_submissions; the results table stores the overall course score.

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
    const courseIds = [...new Set(allocatedCourses.map(c => Number(c.courseId)).filter(Boolean))];
    const coursesCount = courseIds.length;

    if (!coursesCount) {
      return res.json({ success: true, data: { coursesCount: 0, totalStudents: 0, totalResults: 0, attendanceSessions: 0, stats: {}, gradeDist: {}, statusDist: {}, levelDist: {} } });
    }

    const allResults = await db
      .select({ score: results.score, grade: results.grade, status: results.status, studentId: results.studentId, level: users.level })
      .from(results)
      .leftJoin(users, eq(results.studentId, users.id))
      .where(inArray(results.courseId, courseIds));

    const registeredStudents = await db.select({ studentId: courseRegistrations.studentId })
      .from(courseRegistrations)
      .where(and(inArray(courseRegistrations.courseId, courseIds), eq(courseRegistrations.status, 'approved')));
    const uniqueStudents = new Set(registeredStudents.map(r => Number(r.studentId))).size;
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

    const attRows = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM (SELECT DISTINCT course_id, date FROM attendance WHERE course_id IN (${sql.join(courseIds, sql`, `)}) AND lecturer_id = ${lecturerId}) sessions
    `);
    const attendanceSessions = Number(attRows.rows[0]?.count || 0);

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
    const allocations = await db.select({
      courseId: courseAllocations.courseId,
      sessionId: courseAllocations.sessionId,
      semester: courseAllocations.semester
    }).from(courseAllocations).where(eq(courseAllocations.lecturerId, req.user.id));
    if (!allocations.length) return res.json({ success: true, data: [] });
    const allocationMatch = or(...allocations.map(a => and(
      eq(timetableSlots.courseId, a.courseId),
      eq(timetableSlots.sessionId, a.sessionId),
      eq(timetableSlots.semester, a.semester)
    )));

    const slots = await db.select({
      id: timetableSlots.id, dayOfWeek: timetableSlots.dayOfWeek, startTime: timetableSlots.startTime,
      endTime: timetableSlots.endTime, venue: timetableSlots.venue, semester: timetableSlots.semester,
      sessionId: timetableSlots.sessionId, sessionName: academicSessions.name,
      courseCode: courses.code, courseTitle: courses.title, level: courses.level,
    })
      .from(timetableSlots)
      .leftJoin(courses, eq(timetableSlots.courseId, courses.id))
      .leftJoin(academicSessions, eq(timetableSlots.sessionId, academicSessions.id))
      .where(and(allocationMatch, eq(timetableSlots.status, 'approved')))
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
    // EXISTS prevents one exam row being multiplied by allocation joins.
    // A lecturer can see schedules for any active allocation, including external departments.
    const result = await db.execute(sql`
      SELECT es.id AS "id", es.course_id AS "courseId",
        es.session_id AS "sessionId", es.exam_date AS "examDate",
        es.start_time AS "startTime", es.end_time AS "endTime",
        es.venue AS "venue", es.invigilators AS "invigilators",
        es.status AS "status", es.semester AS "semester",
        es.created_at AS "createdAt", a.name AS "sessionName",
        c.code AS "courseCode", c.title AS "courseTitle",
        d.name AS "departmentName"
      FROM exam_schedules es
      INNER JOIN courses c ON c.id = es.course_id
      LEFT JOIN departments d ON d.id = c.department_id
      LEFT JOIN academic_sessions a ON a.id = es.session_id
      WHERE LOWER(TRIM(es.status)) = 'approved'
        AND EXISTS (
          SELECT 1 FROM course_allocations ca
          WHERE ca.course_id = es.course_id
            AND ca.session_id = es.session_id
            AND ca.semester = es.semester
            AND ca.lecturer_id = ${req.user.id}
            AND ca.status <> 'cancelled'
        )
      ORDER BY es.created_at DESC, es.id DESC
    `);
    const unique = new Map();
    for (const row of (result.rows || [])) {
      const key = String(row.courseId); // one timetable entry per allocated course; newest approved schedule wins
      if (!unique.has(key)) unique.set(key, row);
    }
    const data = Array.from(unique.values()).sort((a, b) => String(a.examDate).localeCompare(String(b.examDate)));
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[lecturer/exams] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/exams/:id/students', only, async (req, res, next) => {
  try {
    const examId = Number(req.params.id);
    const [exam] = await db.select({
      courseId: examSchedules.courseId,
      sessionId: examSchedules.sessionId,
      semester: examSchedules.semester,
      status: examSchedules.status
    }).from(examSchedules).where(eq(examSchedules.id, examId)).limit(1);
    if (!exam || exam.status !== 'approved') return res.status(404).json({ success: false, error: 'Approved exam not found.' });

    const alloc = await db.select({ id: courseAllocations.id }).from(courseAllocations)
      .where(and(eq(courseAllocations.lecturerId, req.user.id), eq(courseAllocations.courseId, exam.courseId),
        eq(courseAllocations.sessionId, exam.sessionId), eq(courseAllocations.semester, exam.semester))).limit(1);
    if (!alloc.length) return res.status(403).json({ success: false, error: 'Not your course.' });

    const rows = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      matricNumber: users.matricNumber,
      level: users.level,
      programmeName: programmes.name,
    }).from(courseRegistrations)
      .innerJoin(users, eq(courseRegistrations.studentId, users.id))
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .where(and(
        eq(courseRegistrations.courseId, exam.courseId),
        eq(courseRegistrations.sessionId, exam.sessionId),
        eq(courseRegistrations.semester, exam.semester),
        eq(courseRegistrations.status, 'approved')
      ))
      .orderBy(users.lastName, users.firstName);

    return res.json({ success: true, data: rows });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// COURSE ALLOCATION RESPONSES
// ============================================================
router.post('/allocations/:id/accept', only, async (req, res, next) => {
  try {
    const allocationId = Number(req.params.id);
    const [updated] = await db.update(courseAllocations)
      .set({ status: 'accepted', respondedAt: new Date(), flagReason: null, flagNote: null })
      .where(and(
        eq(courseAllocations.id, allocationId),
        eq(courseAllocations.lecturerId, req.user.id),
        inArray(courseAllocations.status, ['assigned', 'flagged'])
      ))
      .returning({ id: courseAllocations.id, status: courseAllocations.status, respondedAt: courseAllocations.respondedAt });
    if (!updated) return res.status(409).json({ success: false, error: 'This course allocation is no longer awaiting your response. Refresh your course list.' });
    await logAudit({ req, action: 'lecturer.allocation_accept', entity: 'course_allocation', entityId: allocationId, after: updated });
    return res.json({ success: true, data: updated, message: 'Course allocation accepted.' });
  } catch (err) { return next(err); }
});

router.post('/allocations/:id/flag', only, async (req, res, next) => {
  try {
    const allocationId = Number(req.params.id);
    const { reason, note } = req.body || {};
    const allowedReasons = ['study-leave', 'overload', 'specialty', 'medical', 'other'];
    if (!allowedReasons.includes(String(reason || ''))) return res.status(400).json({ success: false, error: 'Select a valid reason for flagging this allocation.' });
    if (note != null && String(note).length > 500) return res.status(400).json({ success: false, error: 'The note must not exceed 500 characters.' });
    const [updated] = await db.update(courseAllocations)
      .set({ status: 'flagged', flagReason: String(reason), flagNote: String(note || '').trim() || null, respondedAt: new Date() })
      .where(and(
        eq(courseAllocations.id, allocationId),
        eq(courseAllocations.lecturerId, req.user.id),
        inArray(courseAllocations.status, ['assigned', 'flagged'])
      ))
      .returning({ id: courseAllocations.id, status: courseAllocations.status, flagReason: courseAllocations.flagReason, flagNote: courseAllocations.flagNote, respondedAt: courseAllocations.respondedAt });
    if (!updated) return res.status(409).json({ success: false, error: 'This course allocation can no longer be flagged. Refresh your course list.' });
    await logAudit({ req, action: 'lecturer.allocation_flag', entity: 'course_allocation', entityId: allocationId, after: updated });
    return res.json({ success: true, data: updated, message: 'Your HOD has been notified of the flagged allocation.' });
  } catch (err) { return next(err); }
});

module.exports = router;