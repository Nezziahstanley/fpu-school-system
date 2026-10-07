// ============================================================
// FPU — Admin generic users listing
// Mounted at /api/admin/user-list
// ------------------------------------------------------------
// Read-only listing of all users regardless of role. For CRUD
// on admin accounts, see adminUsers.js. For students, see
// students.js.
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries = require('../db/queries/users');
const { requireRole } = require('../middleware/auth');

const STAFF = ['admin', 'registrar', 'rector'];

// ------------------------------------------------------------
// GET /api/admin/user-list
// ------------------------------------------------------------
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { role, departmentId, schoolId, programmeId, level, search, isActive, limit = 100, offset = 0 } = req.query;
    const rows = await userQueries.list({
      role, departmentId, schoolId, programmeId, level, search, isActive,
      limit: Number(limit), offset: Number(offset),
    });
    const total = await userQueries.count({ role, departmentId, schoolId, programmeId, level, isActive });
    return res.json({ success: true, data: rows, total });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// GET /api/admin/user-list/staff
// ------------------------------------------------------------
router.get('/staff', requireRole(STAFF), async (req, res, next) => {
  try {
    const { departmentId, role } = req.query;
    const rows = await userQueries.listStaff({ departmentId, role });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// GET /api/admin/user-list/students
// ------------------------------------------------------------
router.get('/students', requireRole(STAFF), async (req, res, next) => {
  try {
    const { departmentId, programmeId, level, sessionId } = req.query;
    const rows = await userQueries.listStudents({ departmentId, programmeId, level, sessionId });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;