// ============================================================
// FPU — Academic Officer portal API
// Mounted at /api/academic-officer
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries = require('../../db/queries/users');
const sessionQueries = require('../../db/queries/sessions');
const courseQueries = require('../../db/queries/courses');
const resultQueries = require('../../db/queries/results');
const regQueries = require('../../db/queries/registrations');
const { db, schema, sql } = require('../../db');
const { eq, and, inArray, desc } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');
const { computeStudentCGPA, classifyDegree } = require('../../utils/gpa');

const {
  programmes, courses, departments, schools, results,
  graduations, users, academicSessions,
} = schema;

const only = requireRole('academic_officer', 'admin');

// ============================================================
// GET /api/academic-officer/dashboard
// ------------------------------------------------------------
// Returns all the stats the dashboard needs in one call.
// ============================================================
router.get('/dashboard', only, async (req, res, next) => {
  try {
    // Row counts
    const [progCount]   = await db.select({ c: sql`count(*)::int` }).from(programmes);
    const [courseCount] = await db.select({ c: sql`count(*)::int` }).from(courses);
    const [deptCount]   = await db.select({ c: sql`count(*)::int` }).from(departments);
    const [schoolCount] = await db.select({ c: sql`count(*)::int` }).from(schools);
    const [studentCount]= await db.select({ c: sql`count(*)::int` }).from(users).where(eq(users.role, 'student'));
    const [publishedCount] = await db.select({ c: sql`count(*)::int` }).from(results).where(eq(results.status, 'published'));
    const [pendingResults] = await db.select({ c: sql`count(*)::int` }).from(results).where(inArray(results.status, ['submitted','hod_verified']));
    const [queuedGrads]    = await db.select({ c: sql`count(*)::int` }).from(graduations).where(eq(graduations.status, 'pending'));

    // Programmes by level
    const progByLevel = await db
      .select({ level: programmes.level, c: sql`count(*)::int` })
      .from(programmes)
      .groupBy(programmes.level);

    // Courses by semester (name may be 'First' / 'Second')
    const coursesBySem = await db
      .select({ semester: courses.semesterName, c: sql`count(*)::int` })
      .from(courses)
      .groupBy(courses.semesterName);

    // Courses by department (top 6)
    const coursesByDept = await db
      .select({
        departmentId: courses.departmentId,
        departmentName: departments.name,
        departmentCode: departments.code,
        c: sql`count(*)::int`,
      })
      .from(courses)
      .leftJoin(departments, eq(courses.departmentId, departments.id))
      .groupBy(courses.departmentId, departments.name, departments.code)
      .orderBy(desc(sql`count(*)`))
      .limit(6);

    // Recent published results
    const recentResults = await db
      .select({
        resultId: results.id,
        studentId: results.studentId,
        courseId: results.courseId,
        grade: results.grade,
        score: results.score,
        publishedAt: results.publishedAt,
        sessionId: results.sessionId,
        semester: results.semester,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentMatric: users.matricNumber,
        courseCode: courses.code,
        courseTitle: courses.title,
      })
      .from(results)
      .leftJoin(users, eq(results.studentId, users.id))
      .leftJoin(courses, eq(results.courseId, courses.id))
      .where(eq(results.status, 'published'))
      .orderBy(desc(results.publishedAt))
      .limit(10);

    return res.json({
      success: true,
      data: {
        programmes: progCount.c,
        courses: courseCount.c,
        departments: deptCount.c,
        schools: schoolCount.c,
        students: studentCount.c,
        resultsPublished: publishedCount.c,
        pendingResults: pendingResults.c,
        queuedGraduations: queuedGrads.c,
        byLevel: progByLevel.reduce((a, r) => ({ ...a, [r.level]: r.c }), {}),
        bySemester: coursesBySem.reduce((a, r) => ({ ...a, [r.semester || 'Unspecified']: r.c }), {}),
        topDepartments: coursesByDept,
        recentResults: recentResults.map((r) => ({
          id: r.resultId,
          studentName: `${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim(),
          studentMatric: r.studentMatric,
          courseCode: r.courseCode,
          courseTitle: r.courseTitle,
          grade: r.grade,
          score: r.score,
          semester: r.semester,
          publishedAt: r.publishedAt,
        })),
        currentSession: await sessionQueries.getCurrentAcademic(),
      },
    });
  } catch (err) {
    console.error('[academic-officer/dashboard]', err);
    return next(err);
  }
});

// ============================================================
// GET /api/academic-officer/sessions
// ============================================================
router.get('/sessions', only, async (req, res, next) => {
  try { return res.json({ success: true, data: await sessionQueries.listAcademic() }); }
  catch (err) { return next(err); }
});

// ============================================================
// GET /api/academic-officer/programmes
// ============================================================
router.get('/programmes', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: programmes.id,
        code: programmes.code,
        name: programmes.name,
        level: programmes.level,
        durationYears: programmes.durationYears,
        departmentId: programmes.departmentId,
        departmentName: departments.name,
        departmentCode: departments.code,
        createdAt: programmes.createdAt,
        schoolName: schools.name,
      })
      .from(programmes)
      .leftJoin(departments, eq(programmes.departmentId, departments.id))
      .leftJoin(schools, eq(departments.schoolId, schools.id))
      .orderBy(programmes.code);
    return res.json({ success: true, data: rows, total: rows.length });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/academic-officer/courses
// ============================================================
router.get('/courses', only, async (req, res, next) => {
  try {
    const { programmeId, departmentId, level, semester, search } = req.query;

    const conds = [];
    if (programmeId) conds.push(eq(courses.programmeId, Number(programmeId)));
    if (departmentId) conds.push(eq(courses.departmentId, Number(departmentId)));
    if (level) conds.push(eq(courses.level, level));
    if (semester) conds.push(eq(courses.semesterName, semester));
    if (search) {
      const like = `%${String(search).trim()}%`;
      conds.push(sql`(${courses.code} ILIKE ${like} OR ${courses.title} ILIKE ${like})`);
    }
    const where = conds.length ? and(...conds) : undefined;

    const rows = await db
      .select({
        id: courses.id,
        code: courses.code,
        title: courses.title,
        unit: courses.unit,
        level: courses.level,
        semesterName: courses.semesterName,
        yearOfStudy: courses.yearOfStudy,
        programmeId: courses.programmeId,
        departmentId: courses.departmentId,
        departmentName: departments.name,
        programmeName: programmes.name,
        description: courses.description,
        createdAt: courses.createdAt,
        isElective: courses.isElective,
        isActive: courses.isActive,
      })
      .from(courses)
      .leftJoin(departments, eq(courses.departmentId, departments.id))
      .leftJoin(programmes, eq(courses.programmeId, programmes.id))
      .where(where)
      .orderBy(courses.code)
      .limit(1000);

    return res.json({ success: true, data: rows, total: rows.length });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/academic-officer/lookups
// Returns departments and courses for the Academic Officer
// ============================================================
router.get('/lookups', only, async (req, res, next) => {
  try {
    const courseQueries = require('../../db/queries/courses');
    
    // Fetch all departments
    const departments = await courseQueries.listDepartments({});
    
    // Fetch all courses
    const courses = await courseQueries.list({});

    return res.json({
      success: true,
      departments,
      courses
    });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/academic-officer/departments
// ============================================================
router.get('/departments', only, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: departments.id, code: departments.code, name: departments.name,
        schoolId: departments.schoolId, schoolName: schools.name, createdAt: departments.createdAt,
        studentCount: sql`(SELECT count(*)::int FROM users u WHERE u.department_id = ${departments.id} AND u.role = 'student')`,
        programmeCount: sql`(SELECT count(*)::int FROM programmes p WHERE p.department_id = ${departments.id})`,
        courseCount: sql`(SELECT count(*)::int FROM courses c WHERE c.department_id = ${departments.id})`,
      })
      .from(departments).leftJoin(schools, eq(departments.schoolId, schools.id)).orderBy(departments.name);
    return res.json({ success: true, data: rows, total: rows.length });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/academic-officer/results  (recent published)
// ============================================================
router.get('/results', only, async (req, res, next) => {
  try {
    const limit=Math.min(Math.max(Number(req.query.limit)||1000,1),2000), conds=[eq(results.status,'published')];
    if(req.query.sessionId)conds.push(eq(results.sessionId,Number(req.query.sessionId)));
    if(req.query.semester)conds.push(eq(results.semester,req.query.semester));
    if(req.query.departmentId)conds.push(eq(users.departmentId,Number(req.query.departmentId)));
    if(req.query.level)conds.push(eq(users.level,req.query.level));
    if(req.query.search){const like=`%${String(req.query.search).trim()}%`;conds.push(sql`(${users.firstName} ILIKE ${like} OR ${users.lastName} ILIKE ${like} OR ${users.matricNumber} ILIKE ${like} OR ${courses.code} ILIKE ${like} OR ${courses.title} ILIKE ${like})`)}
    const rows=await db.select({
      resultId:results.id,studentId:results.studentId,courseId:results.courseId,score:results.score,grade:results.grade,points:results.points,status:results.status,publishedAt:results.publishedAt,sessionId:results.sessionId,semester:results.semester,
      studentFirstName:users.firstName,studentMiddleName:users.middleName,studentLastName:users.lastName,studentMatric:users.matricNumber,level:users.level,departmentId:users.departmentId,departmentName:departments.name,schoolName:schools.name,programmeName:programmes.name,
      courseCode:courses.code,courseTitle:courses.title,courseLevel:courses.level,courseUnit:courses.unit,sessionName:academicSessions.name
    }).from(results)
      .leftJoin(users,eq(results.studentId,users.id)).leftJoin(courses,eq(results.courseId,courses.id))
      .leftJoin(departments,eq(users.departmentId,departments.id)).leftJoin(schools,eq(users.schoolId,schools.id))
      .leftJoin(programmes,eq(users.programmeId,programmes.id)).leftJoin(academicSessions,eq(results.sessionId,academicSessions.id))
      .where(and(...conds)).orderBy(desc(results.publishedAt)).limit(limit);
    return res.json({success:true,data:rows.map(r=>({
      id:r.resultId,studentId:r.studentId,courseId:r.courseId,studentName:[r.studentFirstName,r.studentMiddleName,r.studentLastName].filter(Boolean).join(' '),
      studentMatric:r.studentMatric,level:r.level,departmentId:r.departmentId,departmentName:r.departmentName,schoolName:r.schoolName,programmeName:r.programmeName,
      courseCode:r.courseCode,courseTitle:r.courseTitle,courseLevel:r.courseLevel,courseUnit:r.courseUnit,sessionId:r.sessionId,sessionName:r.sessionName,semester:r.semester,
      score:r.score,grade:r.grade,points:r.points,status:r.status,publishedAt:r.publishedAt
    })),total:rows.length});
  }catch(err){return next(err)}
});
router.get('/transcripts', only, async (req, res, next) => {
  try {
    let studentId=req.query.studentId?Number(req.query.studentId):null;
    if(!studentId&&req.query.student){
      const key=String(req.query.student).trim();
      const found=/^\d+$/.test(key)?await db.select({id:users.id}).from(users).where(eq(users.id,Number(key))).limit(1):await db.select({id:users.id}).from(users).where(eq(users.matricNumber,key)).limit(1);
      studentId=found[0]?.id||null;
    }
    if(!studentId)return res.status(404).json({success:false,error:'Student was not found. Check the matriculation number or student ID.'});
    const rows=await resultQueries.publishedForStudent(studentId,{});
    const summary=computeStudentCGPA(rows.map(r=>({unit:Number(r.course?.unit)||0,points:Number(r.result?.points)||0,sessionId:r.result?.sessionId,semester:r.result?.semester})));
    const student=await userQueries.findByIdWithRelations(studentId);
    if(!student||student.role!=='student')return res.status(404).json({success:false,error:'Student record was not found.'});
    return res.json({success:true,student:{
      id:student.id,firstName:student.firstName,middleName:student.middleName,lastName:student.lastName,email:student.email,phone:student.phone,
      gender:student.gender,dateOfBirth:student.dateOfBirth,stateOfOrigin:student.stateOfOrigin,nationality:student.nationality,address:student.address,
      matricNumber:student.matricNumber,level:student.level,photoUrl:student.photoUrl||student.idCardPhotoUrl,
      departmentName:student.department?.name,programmeName:student.programme?.name,schoolName:student.school?.name
    },summary:{...summary,classification:classifyDegree(summary.cgpa)},rows:rows.map(r=>({...r,sessionName:r.session?.name||'—'}))});
  }catch(err){return next(err)}
});
router.get('/graduation', only, async (req, res, next) => {
  try {
    const conds=[];
    if(req.query.status)conds.push(eq(graduations.status,req.query.status));
    if(req.query.departmentId)conds.push(eq(users.departmentId,Number(req.query.departmentId)));
    if(req.query.sessionId)conds.push(eq(graduations.sessionId,Number(req.query.sessionId)));
    if(req.query.level)conds.push(eq(graduations.level,req.query.level));
    const rows=await db.select({graduation:graduations,student:users,departmentName:departments.name,departmentId:departments.id,programmeName:programmes.name,sessionName:academicSessions.name})
      .from(graduations).leftJoin(users,eq(graduations.studentId,users.id)).leftJoin(departments,eq(users.departmentId,departments.id))
      .leftJoin(programmes,eq(graduations.programmeId,programmes.id)).leftJoin(academicSessions,eq(graduations.sessionId,academicSessions.id))
      .where(conds.length?and(...conds):undefined).orderBy(desc(graduations.createdAt));
    return res.json({success:true,data:rows.map(r=>({...r,student:r.student?{id:r.student.id,firstName:r.student.firstName,middleName:r.student.middleName,lastName:r.student.lastName,matricNumber:r.student.matricNumber,level:r.student.level}:null}))});
  }catch(err){return next(err)}
});
router.get('/reports', only, async (req, res, next) => {
  try {
    const regs=await db.select({status:schema.courseRegistrations.status,count:sql`count(*)::int`}).from(schema.courseRegistrations).groupBy(schema.courseRegistrations.status);
    const resu=await db.select({status:results.status,count:sql`count(*)::int`}).from(results).groupBy(results.status);
    const grads=await db.select({status:graduations.status,count:sql`count(*)::int`}).from(graduations).groupBy(graduations.status);
    const studentsByLevel=await db.select({level:users.level,count:sql`count(*)::int`}).from(users).where(eq(users.role,'student')).groupBy(users.level);
    const resultsBySession=await db.select({sessionName:academicSessions.name,count:sql`count(*)::int`}).from(results).leftJoin(academicSessions,eq(results.sessionId,academicSessions.id)).where(eq(results.status,'published')).groupBy(academicSessions.name).orderBy(academicSessions.name);
    const registrationsByDepartment=await db.select({departmentName:departments.name,count:sql`count(*)::int`}).from(schema.courseRegistrations)
      .leftJoin(users,eq(schema.courseRegistrations.studentId,users.id)).leftJoin(departments,eq(users.departmentId,departments.id))
      .groupBy(departments.name).orderBy(departments.name);
    const graduationsBySession=await db.select({sessionName:academicSessions.name,status:graduations.status,count:sql`count(*)::int`})
      .from(graduations).leftJoin(academicSessions,eq(graduations.sessionId,academicSessions.id))
      .groupBy(academicSessions.name,graduations.status).orderBy(academicSessions.name);
    return res.json({success:true,data:{registrations:regs,results:resu,graduations:grads,studentsByLevel,resultsBySession,registrationsByDepartment,graduationsBySession}});
  }catch(err){return next(err)}
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

module.exports = router;