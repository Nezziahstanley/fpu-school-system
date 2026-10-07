// ============================================================
// FPU — Admin lookup endpoints for <select> dropdowns
// Mounted at /api/admin/lookups
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();
const { db, schema, sql } = require('../db');
const { eq, and, asc, inArray } = require('drizzle-orm');
const { requireRole } = require('../middleware/auth');
const geo = require('../config/geo');

const {
  schools, departments, programmes, courses, academicSessions,
  users, feeStructures, books,
} = schema;

const STAFF = [
  'admin', 'registrar', 'academic_officer', 'hod', 'lecturer',
  'bursar', 'exam_officer', 'admission_officer', 'librarian', 'rector',
];

// ------------------------------------------------------------
// GET /api/admin/lookups/schools
// ------------------------------------------------------------
router.get('/schools', requireRole(STAFF), async (_req, res, next) => {
  try {
    const rows = await db
      .select({ id: schools.id, code: schools.code, name: schools.name })
      .from(schools)
      .orderBy(asc(schools.code));
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/lookups/departments?schoolId=
// ------------------------------------------------------------
router.get('/departments', requireRole(STAFF), async (req, res, next) => {
  try {
    const conds = [];
    if (req.query.schoolId) conds.push(eq(departments.schoolId, Number(req.query.schoolId)));
    const where = conds.length ? and(...conds) : undefined;
    const rows = await db
      .select({
        id: departments.id,
        code: departments.code,
        name: departments.name,
        schoolId: departments.schoolId,
      })
      .from(departments)
      .where(where)
      .orderBy(asc(departments.code));
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/lookups/programmes?departmentId=&level=
// ------------------------------------------------------------
router.get('/programmes', requireRole(STAFF), async (req, res, next) => {
  try {
    const conds = [];
    if (req.query.departmentId) conds.push(eq(programmes.departmentId, Number(req.query.departmentId)));
    if (req.query.level) conds.push(eq(programmes.level, req.query.level));
    const where = conds.length ? and(...conds) : undefined;
    const rows = await db
      .select({
        id: programmes.id,
        code: programmes.code,
        name: programmes.name,
        level: programmes.level,
        departmentId: programmes.departmentId,
      })
      .from(programmes)
      .where(where)
      .orderBy(asc(programmes.code));
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/lookups/courses
// ------------------------------------------------------------
router.get('/courses', requireRole(STAFF), async (req, res, next) => {
  try {
    const conds = [];
    if (req.query.programmeId) conds.push(eq(courses.programmeId, Number(req.query.programmeId)));
    if (req.query.departmentId) conds.push(eq(courses.departmentId, Number(req.query.departmentId)));
    if (req.query.level) conds.push(eq(courses.level, req.query.level));
    if (req.query.semester) conds.push(eq(courses.semester, req.query.semester));
    const where = conds.length ? and(...conds) : undefined;
    const rows = await db
      .select({
        id: courses.id,
        code: courses.code,
        title: courses.title,
        unit: courses.unit,
        level: courses.level,
        semester: courses.semester,
        programmeId: courses.programmeId,
        departmentId: courses.departmentId,
      })
      .from(courses)
      .where(where)
      .orderBy(asc(courses.code))
      .limit(500);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/lookups/sessions
// ------------------------------------------------------------
router.get('/sessions', requireRole(STAFF), async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: academicSessions.id,
        name: academicSessions.name,
        isCurrent: academicSessions.isCurrent,
      })
      .from(academicSessions)
      .orderBy(sql`${academicSessions.name} desc`);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/lookups/students?departmentId=&level=
// ------------------------------------------------------------
router.get('/students', requireRole(STAFF), async (req, res, next) => {
  try {
    const conds = [eq(users.role, 'student')];
    if (req.query.departmentId) conds.push(eq(users.departmentId, Number(req.query.departmentId)));
    if (req.query.level) conds.push(eq(users.level, req.query.level));
    const rows = await db
      .select({
        id: users.id,
        matricNumber: users.matricNumber,
        firstName: users.firstName,
        lastName: users.lastName,
        level: users.level,
      })
      .from(users)
      .where(and(...conds))
      .orderBy(asc(users.matricNumber))
      .limit(1000);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/lookups/lecturers?departmentId=
// ------------------------------------------------------------
router.get('/lecturers', requireRole(STAFF), async (req, res, next) => {
  try {
    const conds = [eq(users.role, 'lecturer')];
    if (req.query.departmentId) conds.push(eq(users.departmentId, Number(req.query.departmentId)));
    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        departmentId: users.departmentId,
      })
      .from(users)
      .where(and(...conds))
      .orderBy(asc(users.lastName));
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/lookups/fee-structures?sessionId=
// ------------------------------------------------------------
router.get('/fee-structures', requireRole(STAFF), async (req, res, next) => {
  try {
    const conds = [];
    if (req.query.sessionId) conds.push(eq(feeStructures.sessionId, Number(req.query.sessionId)));
    const where = conds.length ? and(...conds) : undefined;
    const rows = await db
      .select({
        id: feeStructures.id,
        programmeId: feeStructures.programmeId,
        level: feeStructures.level,
        sessionId: feeStructures.sessionId,
        total: feeStructures.total,
      })
      .from(feeStructures)
      .where(where);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/lookups/books
// ------------------------------------------------------------
router.get('/books', requireRole(STAFF), async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: books.id,
        title: books.title,
        author: books.author,
        copiesAvailable: books.copiesAvailable,
      })
      .from(books)
      .orderBy(asc(books.title))
      .limit(500);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/lookups/users?roles=admin,registrar
// ------------------------------------------------------------
router.get('/users', requireRole(STAFF), async (req, res, next) => {
  try {
    const roles = (req.query.roles || '').split(',').map((r) => r.trim()).filter(Boolean);
    const conds = [];
    if (roles.length) conds.push(inArray(users.role, roles));
    const where = conds.length ? and(...conds) : undefined;
    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(where)
      .orderBy(asc(users.lastName))
      .limit(2000);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/lookups/countries
// ------------------------------------------------------------
router.get('/countries', requireRole(STAFF), async (_req, res, next) => {
  try {
    return res.json({ success: true, data: geo.listCountries() });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/lookups/states?country=NG
// ------------------------------------------------------------
router.get('/states', requireRole(STAFF), async (req, res, next) => {
  try {
    const country = req.query.country || 'NG';
    return res.json({ success: true, data: geo.listStates(country) });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/lookups/lgas?country=NG&state=Cross%20River
// ------------------------------------------------------------
router.get('/lgas', requireRole(STAFF), async (req, res, next) => {
  try {
    const { country = 'NG', state } = req.query;
    if (!state) {
      return res.status(400).json({ success: false, error: 'state is required.' });
    }
    return res.json({ success: true, data: geo.listLgas(country, state) });
  } catch (err) { return next(err); }
});

module.exports = router;