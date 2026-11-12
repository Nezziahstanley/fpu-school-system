// ============================================================
// FPU — Registrar portal API
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();
const { eq, and, sql, desc, inArray } = require('drizzle-orm');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { requireRole } = require('../../middleware/auth');
const { db, schema } = require('../../db');
const { 
  users, 
  applications, 
  programmes, 
  academicSessions, 
  courseRegistrations, 
  clearances,
  departments,
  courses,
  documents,
  graduations
} = schema;

const only = requireRole('registrar', 'admin', 'rector');

// Setup multer for document uploads
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR });

// ============================================================
// GET /api/registrar/dashboard
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    const allStudents = await db.select({ id: users.id, level: users.level, gender: users.gender, departmentId: users.departmentId }).from(users).where(eq(users.role, 'student'));
    
    const totalStudents = allStudents.length;
    const ndStudents = allStudents.filter(s => /^ND([0-9]|$)/i.test(String(s.level || '').trim())).length;
    const hndStudents = allStudents.filter(s => /^HND([0-9]|$)/i.test(String(s.level || '').trim())).length;

    const [currentSession] = await db.select().from(academicSessions).where(eq(academicSessions.isCurrent, true)).limit(1);

    const pendingApps = await db.select({ count: sql`count(*)::int` }).from(applications).where(eq(applications.status, 'pending'));
    const pendingRegs = await db.select({ count: sql`count(*)::int` }).from(courseRegistrations).where(eq(courseRegistrations.status, 'pending'));
    const pendingClears = await db.select({ count: sql`count(*)::int` }).from(clearances).where(eq(clearances.status, 'pending'));
    const progCount = await db.select({ count: sql`count(*)::int` }).from(programmes);

    const depts = await db.select({ id: departments.id, name: departments.name }).from(departments);
    const deptMap = {};
    depts.forEach(d => { deptMap[d.id] = d.name; });

    const byDept = {};
    allStudents.forEach(s => {
      const name = s.departmentId ? (deptMap[s.departmentId] || 'Unknown Department') : 'Unassigned Department';
      byDept[name] = (byDept[name] || 0) + 1;
    });

    const byGender = { Male: 0, Female: 0, Other: 0, Unknown: 0 };
    allStudents.forEach(s => {
      const g = String(s.gender || '').trim().toLowerCase();
      if (g === 'male' || g === 'm') byGender.Male++;
      else if (g === 'female' || g === 'f') byGender.Female++;
      else if (g === 'other' || g === 'o') byGender.Other++;
      else byGender.Unknown++;
    });

    return res.json({
      success: true,
      data: {
        totalStudents,
        ndStudents,
        hndStudents,
        activeSession: currentSession?.name || '—',
        pendingApplications: pendingApps[0]?.count || 0,
        pendingRegistrations: pendingRegs[0]?.count || 0,
        pendingClearances: pendingClears[0]?.count || 0,
        totalProgrammes: progCount[0]?.count || 0,
        demographics: {
          byLevel: { ND: ndStudents, HND: hndStudents },
          byDept: byDept,
          byGender: byGender
        }
      }
    });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/trends
// ============================================================
router.get('/trends', only, async (req, res, next) => {
  try {
    const students = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.role, 'student'));
    const enrollments = {};
    students.forEach(s => {
      if (!s.createdAt) return;
      const d = new Date(s.createdAt);
      const key = d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' });
      enrollments[key] = (enrollments[key] || 0) + 1;
    });
    
    const sortedEnrollKeys = Object.keys(enrollments).sort((a, b) => new Date(a) - new Date(b));
    let cumSum = 0;
    const enrollmentData = sortedEnrollKeys.map(k => {
      cumSum += enrollments[k];
      return cumSum;
    });

    const apps = await db.select({ createdAt: applications.createdAt }).from(applications);
    const admissions = {};
    apps.forEach(a => {
      if (!a.createdAt) return;
      const d = new Date(a.createdAt);
      const key = d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' });
      admissions[key] = (admissions[key] || 0) + 1;
    });
    const sortedAdmKeys = Object.keys(admissions).sort((a, b) => new Date(a) - new Date(b));
    const admissionData = sortedAdmKeys.map(k => admissions[k]);

    const regs = await db.select({ status: courseRegistrations.status }).from(courseRegistrations);
    const regStats = { pending: 0, approved: 0, rejected: 0 };
    regs.forEach(r => {
      if (regStats[r.status] !== undefined) regStats[r.status]++;
    });

    return res.json({
      success: true,
      data: {
        enrollment: { labels: sortedEnrollKeys, values: enrollmentData },
        admission: { labels: sortedAdmKeys, values: admissionData },
        registrations: regStats
      }
    });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/students
// ============================================================
router.get('/students', only, async (req, res, next) => {
  try {
    const resultQueries = require('../../db/queries/results');
    const { computeStudentCGPA } = require('../../utils/gpa');

    const rows = await db
      .select({
        id: users.id,
        matricNumber: users.matricNumber,
        firstName: users.firstName,
        middleName: users.middleName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        gender: users.gender,
        dateOfBirth: users.dateOfBirth,
        stateOfOrigin: users.stateOfOrigin,
        nationality: users.nationality,
        address: users.address,
        photoUrl: users.photoUrl,
        idCardPhotoUrl: users.idCardPhotoUrl,
        matricNumber: users.matricNumber,
        level: users.level,
        schoolId: users.schoolId,
        departmentId: departments.id,
        programmeId: users.programmeId,
        currentSessionId: users.currentSessionId,
        programmeName: programmes.name,
        departmentName: departments.name,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(eq(users.role, 'student'))
      .orderBy(desc(users.createdAt));

    // Calculate CGPA for each student
    const data = [];
    for (const s of rows) {
      const results = await resultQueries.publishedForStudent(s.id, {});
      const summary = computeStudentCGPA(
        results.map((r) => ({
          unit: Number(r.course?.unit) || 0,
          points: Number(r.result?.points) || 0,
          sessionId: r.result?.sessionId,
          semester: r.result?.semester,
        }))
      );
      
      // Attach the calculated CGPA to the student object
      data.push({ ...s, cgpa: summary.cgpa || 0 });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[registrar/students] Error:', err);
    return next(err);
  }
});

// ============================================================
// GET /api/registrar/transcripts
// ============================================================
router.get('/transcripts', only, async (req, res, next) => {
  try {
    const resultQueries = require('../../db/queries/results');
    const { computeStudentCGPA } = require('../../utils/gpa');

    const rows = await db
      .select({
        id: users.id,
        matricNumber: users.matricNumber,
        firstName: users.firstName,
        lastName: users.lastName,
        level: users.level,
        programmeName: programmes.name,
        departmentId: departments.id,
        departmentName: departments.name,
      })
      .from(users)
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(eq(users.role, 'student'))
      .orderBy(departments.name, users.lastName);

    const data = [];
    for (const s of rows) {
      const results = await resultQueries.publishedForStudent(s.id, {});
      const summary = computeStudentCGPA(
        results.map((r) => ({
          unit: Number(r.course?.unit) || 0,
          points: Number(r.result?.points) || 0,
          sessionId: r.result?.sessionId,
          semester: r.result?.semester,
        }))
      );
      data.push({ ...s, cgpa: summary.cgpa || 0 });
    }

    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/transcript/:studentId
// ============================================================
router.get('/transcript/:studentId', only, async (req, res, next) => {
  try {
    const userQueries = require('../../db/queries/users');
    const { computeStudentCGPA, classifyDegree } = require('../../utils/gpa');

    const studentId = Number(req.params.studentId);
    const student = await userQueries.findByIdWithRelations(studentId);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });

    // Fetch results WITH the session name joined
    const results = await db.execute(sql`
      SELECT 
        r.id,
        c.code AS "courseCode", 
        c.title AS "courseTitle", 
        c.unit AS "unit",
        r.score, 
        r.grade, 
        r.points,
        r.semester,
        r.session_id AS "sessionId",
        s.name AS "sessionName"
      FROM results r
      JOIN courses c ON r.course_id = c.id
      LEFT JOIN academic_sessions s ON r.session_id = s.id
      WHERE r.student_id = ${studentId} AND r.status = 'published'
      ORDER BY s.name, r.semester, c.code
    `);

    const rows = results.rows || [];
    
    // Format rows to match the expected structure
    const formattedRows = rows.map(r => ({
      course: { code: r.courseCode, title: r.courseTitle, unit: r.unit },
      result: { score: r.score, grade: r.grade, points: r.points, semester: r.semester, sessionId: r.sessionId, sessionName: r.sessionName }
    }));

    const summary = computeStudentCGPA(
      formattedRows.map((r) => ({
        unit: Number(r.course?.unit) || 0,
        points: Number(r.result?.points) || 0,
        sessionId: r.result?.sessionId,
        semester: r.result?.semester,
      }))
    );

    return res.json({
      success: true,
      student,
      rows: formattedRows,
      summary: { ...summary, classification: classifyDegree(summary.cgpa) },
    });
  } catch (err) {
    console.error('[registrar/transcript] Error:', err);
    return next(err);
  }
});

// ============================================================
// GET /api/registrar/recent-students
// ============================================================
router.get('/recent-students', only, async (req, res, next) => {
  try {
    const rows = await db
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
      .where(eq(users.role, 'student'))
      .orderBy(desc(users.createdAt))
      .limit(5);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/recent-applications
// ============================================================
router.get('/recent-applications', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: applications.id,
        applicationNumber: applications.applicationNumber,
        firstName: applications.firstName,
        lastName: applications.lastName,
        type: applications.type,
        status: applications.status,
      })
      .from(applications)
      .orderBy(desc(applications.createdAt))
      .limit(5);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/sessions
// ============================================================
router.get('/sessions', only, async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(academicSessions)
      .orderBy(desc(academicSessions.startDate));

    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/applications
// ============================================================
router.get('/applications', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        application: applications,
        programme: programmes,
        department: departments,
      })
      .from(applications)
      .leftJoin(programmes, eq(applications.programmeId, programmes.id))
      .leftJoin(departments, eq(applications.departmentId, departments.id))
      .orderBy(desc(applications.createdAt));

    const data = rows.map((r) => ({
      ...r.application,
      programmeName: r.programme?.name || null,
      departmentName: r.department?.name || null,
    }));

    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/applications/:id
// ============================================================
router.get('/applications/:id', only, async (req, res, next) => {
  try {
    const [row] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, Number(req.params.id)))
      .limit(1);

    if (!row) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/admitted
// ============================================================
router.get('/admitted', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        application: applications,
        programme: programmes,
        department: departments,
      })
      .from(applications)
      .leftJoin(programmes, eq(applications.programmeId, programmes.id))
      .leftJoin(departments, eq(applications.departmentId, departments.id))
      .where(inArray(applications.status, ['approved', 'registered', 'matriculated']))
      .orderBy(desc(applications.admittedAt));

    const data = rows.map((r) => ({
      ...r.application,
      programmeName: r.programme?.name || null,
      departmentName: r.department?.name || null,
    }));

    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/registrations
// ============================================================
router.get('/registrations', only, async (req, res, next) => {
  try {
    const { status, sessionId, semester } = req.query;
    
    const conds = [];
    if (status) conds.push(eq(courseRegistrations.status, status));
    if (sessionId) conds.push(eq(courseRegistrations.sessionId, Number(sessionId)));
    if (semester) conds.push(eq(courseRegistrations.semester, semester));

    const where = conds.length ? and(...conds) : undefined;

    const rows = await db
      .select({
        registration: courseRegistrations,
        student: users,
        course: courses,
        session: academicSessions,
      })
      .from(courseRegistrations)
      .leftJoin(users, eq(courseRegistrations.studentId, users.id))
      .leftJoin(courses, eq(courseRegistrations.courseId, courses.id))
      .leftJoin(academicSessions, eq(courseRegistrations.sessionId, academicSessions.id))
      .where(where)
      .orderBy(desc(courseRegistrations.createdAt));

    const data = rows.map((r) => ({
      id: r.registration.id,
      registration: r.registration,
      student: r.student,
      course: r.course,
      session: r.session,
    }));

    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/registrar/registrations/:id/status
// ============================================================
router.post('/registrations/:id/status', only, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Registration status must be approved or rejected.' });
    }

    const [row] = await db
      .update(courseRegistrations)
      .set({ status, approvedAt: new Date(), approvedBy: req.user.id })
      .where(and(
        eq(courseRegistrations.id, Number(req.params.id)),
        eq(courseRegistrations.status, 'pending')
      ))
      .returning();

    if (!row) {
      const [existing] = await db.select({ id: courseRegistrations.id, status: courseRegistrations.status })
        .from(courseRegistrations)
        .where(eq(courseRegistrations.id, Number(req.params.id)))
        .limit(1);
      if (!existing) return res.status(404).json({ success: false, error: 'Course registration not found.' });
      return res.status(409).json({ success: false, error: 'Only pending registrations can be approved or rejected.' });
    }

    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/documents
// ============================================================
router.get('/documents', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        document: documents,
        student: users,
      })
      .from(documents)
      .leftJoin(users, eq(documents.userId, users.id))
      .orderBy(desc(documents.requestedAt));

    const data = rows.map((r) => ({
      ...r.document,
      studentName: `${r.student?.firstName || ''} ${r.student?.lastName || ''}`.trim() || 'Unknown',
      matricNumber: r.student?.matricNumber || '—',
    }));

    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// GET /api/registrar/documents/:id/preview — complete student/request data for official templates
router.get('/documents/:id/preview', only, async (req, res, next) => {
  try {
    const docId = Number(req.params.id);
    if (!Number.isInteger(docId) || docId < 1) return res.status(400).json({ success: false, error: 'Invalid document request ID.' });
    const [row] = await db.select({
      document: documents,
      student: {
        id: users.id, firstName: users.firstName, middleName: users.middleName, lastName: users.lastName,
        email: users.email, phone: users.phone, gender: users.gender, dateOfBirth: users.dateOfBirth,
        stateOfOrigin: users.stateOfOrigin, nationality: users.nationality, address: users.address,
        matricNumber: users.matricNumber, level: users.level, photoUrl: users.photoUrl,
        isActive: users.isActive, createdAt: users.createdAt,
      },
      programmeName: programmes.name,
      departmentName: departments.name,
    }).from(documents)
      .leftJoin(users, eq(documents.userId, users.id))
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(eq(documents.id, docId)).limit(1);
    if (!row || !row.student) return res.status(404).json({ success: false, error: 'Document request or student record not found.' });
    const [issuer] = await db.select({ signatureUrl: users.signatureUrl }).from(users).where(eq(users.id, req.user.id)).limit(1);
    return res.json({ success: true, data: {
      document: row.document,
      student: { ...row.student, programmeName: row.programmeName, departmentName: row.departmentName },
      issuerSignatureUrl: issuer?.signatureUrl || null,
    }});
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/registrar/documents/:id/issue
// ============================================================
router.post('/documents/:id/issue', only, upload.single('file'), async (req, res, next) => {
  try {
    const [issuer] = await db.select({ signatureUrl: users.signatureUrl }).from(users).where(eq(users.id, req.user.id)).limit(1);
    if (!issuer?.signatureUrl) return res.status(409).json({ success: false, error: 'Upload your electronic signature in My Profile before issuing official documents.' });
    const docId = Number(req.params.id);
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });

    // Save file with a clean name
    const ext = path.extname(req.file.originalname) || '.pdf';
    const newName = `doc-${docId}-${Date.now()}${ext}`;
    const newPath = path.join(UPLOAD_DIR, newName);
    fs.renameSync(req.file.path, newPath);

    const fileUrl = `/uploads/${newName}`;

    // Update DB
    const [updated] = await db
      .update(documents)
      .set({
        status: 'issued',
        fileUrl,
        issuedAt: new Date(),
        issuedBy: req.user.id,
      })
      .where(and(eq(documents.id, docId), inArray(documents.status, ['pending', 'approved'])))
      .returning();

    if (!updated) { try { fs.unlinkSync(newPath); } catch (_) {} return res.status(409).json({ success: false, error: 'Only pending or approved document requests can be issued.' }); }
    return res.json({ success: true, data: updated });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/registrar/documents/:id/mark-issued
// ============================================================
router.post('/documents/:id/mark-issued', only, async (req, res, next) => {
  try {
    const [issuer] = await db.select({ signatureUrl: users.signatureUrl }).from(users).where(eq(users.id, req.user.id)).limit(1);
    if (!issuer?.signatureUrl) return res.status(409).json({ success: false, error: 'Upload your electronic signature in My Profile before issuing official documents.' });
    const docId = Number(req.params.id);
    const [updated] = await db
      .update(documents)
      .set({ status: 'issued', issuedAt: new Date(), issuedBy: req.user.id })
      .where(and(eq(documents.id, docId), inArray(documents.status, ['pending', 'approved'])))
      .returning();

    if (!updated) return res.status(409).json({ success: false, error: 'Only pending or approved document requests can be marked as issued.' });
    return res.json({ success: true, data: updated });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/graduations
// ============================================================
router.get('/graduations', only, async (req, res, next) => {
  try {
    const userQueries = require('../../db/queries/users');
    const resultQueries = require('../../db/queries/results');
    const { computeStudentCGPA, classifyDegree } = require('../../utils/gpa');

    const students = await db
      .select({
        id: users.id,
        matricNumber: users.matricNumber,
        firstName: users.firstName,
        middleName: users.middleName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        gender: users.gender,
        dateOfBirth: users.dateOfBirth,
        stateOfOrigin: users.stateOfOrigin,
        nationality: users.nationality,
        address: users.address,
        photoUrl: users.photoUrl,
        isActive: users.isActive,
        schoolId: users.schoolId,
        currentSessionId: users.currentSessionId,
        createdAt: users.createdAt,
        level: users.level,
        programmeName: programmes.name,
        departmentName: departments.name,
      })
      .from(users)
      .leftJoin(programmes, eq(users.programmeId, programmes.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(and(
        eq(users.role, 'student'),
        inArray(users.level, ['ND', 'HND'])
      ))
      .orderBy(users.lastName);

    const graduatedRecords = await db.select({ studentId: graduations.studentId }).from(graduations);
    const graduatedSet = new Set(graduatedRecords.map(r => r.studentId));

    const data = [];
    for (const s of students) {
      const results = await resultQueries.publishedForStudent(s.id, {});
      const summary = computeStudentCGPA(
        results.map((r) => ({
          unit: Number(r.course?.unit) || 0,
          points: Number(r.result?.points) || 0,
          sessionId: r.result?.sessionId,
          semester: r.result?.semester,
        }))
      );

      const cgpa = summary.cgpa || 0;
      const isEligible = cgpa >= 2.0;
      const isGraduated = graduatedSet.has(s.id);

      data.push({
        ...s,
        cgpa: cgpa,
        classification: classifyDegree(cgpa),
        eligible: isEligible,
        status: isGraduated ? 'Graduated' : (isEligible ? 'Eligible' : 'Not Eligible'),
      });
    }

    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/registrar/graduations/:id/mark
// ============================================================
router.post('/graduations/:id/mark', only, async (req, res, next) => {
  try {
    const studentId = Number(req.params.id);
    
    // 1. Fetch the student to get their actual programme and level
    const [student] = await db.select({
      programmeId: users.programmeId,
      level: users.level
    }).from(users).where(eq(users.id, studentId)).limit(1);

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }

    // 2. Check if they are already marked
    const existing = await db.select().from(graduations).where(eq(graduations.studentId, studentId)).limit(1);
    if (existing.length) {
      return res.status(400).json({ success: false, error: 'Student already marked as graduated.' });
    }

    // 3. Use the active academic session; never assume session ID 1.
    const [currentSession] = await db.select({ id: academicSessions.id }).from(academicSessions).where(eq(academicSessions.isCurrent, true)).limit(1);
    if (!currentSession) return res.status(409).json({ success: false, error: 'There is no active academic session. Please contact the Academic Office.' });

    const [row] = await db.insert(graduations).values({
      studentId: studentId,
      sessionId: currentSession.id,
      programmeId: student.programmeId, // Fixed: Uses actual programme
      level: student.level,             // Fixed: Uses actual level (ND or HND)
      status: 'graduated',
      approvedBy: req.user.id,
      approvedAt: new Date()
    }).returning();

    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/clearances
// ============================================================
router.get('/clearances', only, async (req, res, next) => {
  try {
    const result = await db.execute(sql`
      SELECT c.id, c.student_id AS "studentId", c.type, c.status,
             c.created_at AS "requestedAt", c.cleared_at AS "clearedAt",
             c.session_id AS "sessionId", s.name AS "sessionName",
             student.first_name AS "firstName", student.middle_name AS "middleName", student.last_name AS "lastName",
             student.email, student.phone, student.gender, student.date_of_birth AS "dateOfBirth",
             student.state_of_origin AS "stateOfOrigin", student.nationality, student.address,
             student.photo_url AS "photoUrl", student.is_active AS "isActive",
             student.matric_number AS "matricNumber", student.level,
             student.school_id AS "schoolId", student.programme_id AS "programmeId",
             student.department_id AS "departmentId", student.current_session_id AS "currentSessionId",
             student.created_at AS "studentCreatedAt",
             programme.name AS "programmeName", department.name AS "departmentName",
             signer.first_name AS "signerFirstName", signer.last_name AS "signerLastName",
             signer.role AS "signerRole", signer.signature_url AS "signerSignatureUrl"
      FROM clearances c
      LEFT JOIN users student ON student.id = c.student_id
      LEFT JOIN users signer ON signer.id = c.cleared_by
      LEFT JOIN programmes programme ON programme.id = student.programme_id
      LEFT JOIN departments department ON department.id = student.department_id
      LEFT JOIN academic_sessions s ON s.id = c.session_id
      ORDER BY CASE WHEN c.status = 'pending' THEN 1 ELSE 2 END, c.created_at DESC
    `);
    return res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    console.error('[registrar/clearances] Error:', err);
    return next(err);
  }
});

// ============================================================
// POST /api/registrar/clearances/:id/status
// ============================================================
router.post('/clearances/:id/status', only, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['cleared', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status. Must be cleared or rejected.' });
    }

    if (status === 'cleared') {
      const [signer] = await db.select({ signatureUrl: users.signatureUrl })
        .from(users).where(eq(users.id, req.user.id)).limit(1);
      if (!signer?.signatureUrl) {
        return res.status(409).json({ success: false, error: 'Upload your electronic signature in My Profile before approving a clearance.' });
      }
    }
    const patch = status === 'cleared'
      ? { status, clearedBy: req.user.id, clearedAt: new Date() }
      : { status, clearedBy: null, clearedAt: null };
    const [updated] = await db.update(clearances)
      .set(patch)
      .where(eq(clearances.id, Number(req.params.id)))
      .returning();
    if (!updated) return res.status(404).json({ success: false, error: 'Clearance not found.' });
    return res.json({ success: true, data: updated });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/registrar/programmes
// ============================================================
router.get('/programmes', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: programmes.id,
        code: programmes.code,
        name: programmes.name,
        level: programmes.level,
        departmentId: programmes.departmentId,
        departmentName: departments.name, // <-- This fixes the "—"
      })
      .from(programmes)
      .leftJoin(departments, eq(programmes.departmentId, departments.id))
      .orderBy(programmes.name);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[registrar/programmes] Error:', err);
    return next(err);
  }
});

// ============================================================
// POST /api/registrar/sessions
// ============================================================
router.post('/sessions', only, async (req, res, next) => {
  try {
    const { name, startDate, endDate, isCurrent } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Session name is required.' });

    // If setting this as current, unset all others first
    if (isCurrent) {
      await db.update(academicSessions).set({ isCurrent: false });
    }

    const [row] = await db.insert(academicSessions).values({
      name,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      isCurrent: !!isCurrent,
    }).returning();

    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error('[registrar/sessions] POST Error:', err);
    return next(err);
  }
});

// ============================================================
// POST /api/registrar/sessions/:id/activate
// ============================================================
router.post('/sessions/:id/activate', only, async (req, res, next) => {
  try {
    const sessionId = Number(req.params.id);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return res.status(400).json({ success: false, error: 'A valid academic session ID is required.' });
    }

    // Validate before clearing the current session; a bad ID must never leave
    // the institution without an active academic session.
    const [targetSession] = await db.select({ id: academicSessions.id })
      .from(academicSessions)
      .where(eq(academicSessions.id, sessionId))
      .limit(1);
    if (!targetSession) {
      return res.status(404).json({ success: false, error: 'Academic session not found.' });
    }

    await db.transaction(async (tx) => {
      await tx.update(academicSessions).set({ isCurrent: false });
      await tx.update(academicSessions)
        .set({ isCurrent: true })
        .where(eq(academicSessions.id, sessionId));
    });

    const [updated] = await db.select().from(academicSessions)
      .where(eq(academicSessions.id, sessionId))
      .limit(1);
    return res.json({ success: true, data: updated });
  } catch (err) { return next(err); }
});

module.exports = router;