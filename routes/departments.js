// ============================================================
// FPU — Admin departments API
// Mounted at /api/admin/departments
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const courseQueries = require('../db/queries/courses');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// NOTE: We removed the failing `require('../models')` import.
// We will use the database connection directly instead.
const db = require('../db'); // Assumes you have a db export here

const STAFF = ['admin', 'registrar', 'academic_officer', 'rector', 'hod'];

// ------------------------------------------------------------
// Departments CRUD
// ------------------------------------------------------------

router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    return res.json({ success: true, data: await courseQueries.listDepartments({ schoolId: req.query.schoolId }) });
  } catch (err) {
    return next(err);
  }
});

// IMPORTANT: /transcript/:userId must be declared BEFORE /:id
router.get('/transcript/:userId', requireRole(STAFF), async (req, res, next) => {
  try {
    // 1. Fetch student using raw SQL
    const studentQuery = `
      SELECT u.*, p.name as programmeName, d.name as departmentName 
      FROM users u
      LEFT JOIN programmes p ON u.programmeId = p.id
      LEFT JOIN departments d ON u.departmentId = d.id
      WHERE u.id = ?
    `;
    // Use whatever db query method you have (e.g., db.query, pool.query, knex)
    const [studentRows] = await db.query(studentQuery, [req.params.userId]);
    
    if (!studentRows || studentRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }
    const student = studentRows[0];

    // 2. Fetch results using raw SQL
    const resultsQuery = `
      SELECT * FROM results 
      WHERE userId = ? AND published = 1
      ORDER BY session ASC, semester ASC, courseCode ASC
    `;
    const [results] = await db.query(resultsQuery, [student.id]);

    return res.json({ success: true, student, results });
  } catch (err) {
    console.error('Transcript Error:', err);
    return next(err);
  }
});

router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await courseQueries.findDepartmentById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Department not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const { code, name, schoolId, hodUserId } = req.body || {};
    if (!code || !name || !schoolId) {
      return res.status(400).json({ success: false, error: 'code, name, schoolId are required.' });
    }
    const row = await courseQueries.createDepartment({ code, name, schoolId, hodUserId });
    await logAudit({ req, action: 'department.create', entity: 'department', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const existing = await courseQueries.findDepartmentById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Department not found.' });
    const patch = { ...req.body };
    delete patch.id;
    const row = await courseQueries.updateDepartment(existing.id, patch);
    await logAudit({ req, action: 'department.update', entity: 'department', entityId: existing.id, before: existing, after: row });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const existing = await courseQueries.findDepartmentById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Department not found.' });
    await courseQueries.removeDepartment(existing.id);
    await logAudit({ req, action: 'department.delete', entity: 'department', entityId: existing.id, before: existing });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;