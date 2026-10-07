// ============================================================
// FPU — Admin students API
// Mounted at /api/admin/students
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries = require('../db/queries/users');
const courseQueries = require('../db/queries/courses');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { hashPassword, validatePassword } = require('../utils/password');
const { assignFIFOMatric } = require('../utils/matricHelper');
const { getMatricPrefix } = require('../db/queries/settings');
const { getYearShort } = require('../config/departments');

const STAFF = ['admin', 'registrar', 'academic_officer', 'bursar', 'rector', 'hod'];

// ------------------------------------------------------------
// GET /api/admin/students
// ------------------------------------------------------------
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { departmentId, programmeId, level, search, limit = 100, offset = 0 } = req.query;
    const rows = await userQueries.list({
      role: 'student',
      departmentId,
      programmeId,
      level,
      search,
      limit: Number(limit),
      offset: Number(offset),
    });
    const total = await userQueries.count({ role: 'student', departmentId, programmeId, level });
    return res.json({ success: true, data: rows, total });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// GET /api/admin/students/:id
// ------------------------------------------------------------
router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const student = await userQueries.findByIdWithRelations(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }
    return res.json({ success: true, data: student });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// POST /api/admin/students
// Body: email, password?, firstName, lastName, level, departmentId,
//       programmeId, schoolId?, phone?, gender?, dob?, stateOfOrigin?
// ------------------------------------------------------------
router.post('/', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const {
      email, password, firstName, lastName, middleName,
      phone, gender, dateOfBirth, address, stateOfOrigin,
      level = 'ND', departmentId, programmeId, schoolId,
    } = req.body || {};

    if (!email || !firstName || !lastName || !departmentId || !programmeId) {
      return res.status(400).json({ success: false, error: 'email, firstName, lastName, departmentId, programmeId are required.' });
    }

    if (await userQueries.emailExists(email)) {
      return res.status(409).json({ success: false, error: 'A user with this email already exists.' });
    }

    const dept = await courseQueries.findDepartmentById(departmentId);
    if (!dept) return res.status(400).json({ success: false, error: 'Invalid departmentId.' });

    const resolvedSchoolId = Number(schoolId) || dept.schoolId;
    const school = await courseQueries.findSchoolById(resolvedSchoolId);

    const prefix = await getMatricPrefix();
    const year = getYearShort(new Date());
    const matric = await assignFIFOMatric({
      prefix,
      schoolCode: school?.code || 'SST',
      deptCode: dept.code,
      level,
      year,
    });

    const plain = password || 'student1234';
    const { valid, reasons } = validatePassword(plain);
    if (!valid) return res.status(400).json({ success: false, error: reasons.join(' ') });

    const passwordHash = await hashPassword(plain);

    const user = await userQueries.create({
      email, passwordHash, role: 'student',
      firstName, lastName, middleName,
      phone, gender, dateOfBirth, address, stateOfOrigin,
      matricNumber: matric, level,
      departmentId: Number(departmentId),
      programmeId: Number(programmeId),
      schoolId: resolvedSchoolId,
      mustChangePassword: true,
    });

    await logAudit({ req, action: 'student.create', entity: 'user', entityId: user.id, after: { matric } });

    return res.status(201).json({ success: true, data: user });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// PUT /api/admin/students/:id
// ------------------------------------------------------------
router.put('/:id', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const student = await userQueries.findById(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }
    const patch = { ...req.body };
    delete patch.password;
    delete patch.passwordHash;
    delete patch.matricNumber; // never let admin edit matric via this endpoint
    delete patch.role;

    const updated = await userQueries.update(student.id, patch);
    await logAudit({ req, action: 'student.update', entity: 'user', entityId: student.id, before: student, after: updated });
    return res.json({ success: true, data: updated });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// POST /api/admin/students/:id/reset-password
// ------------------------------------------------------------
router.post('/:id/reset-password', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const student = await userQueries.findById(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }
    const plain = req.body?.password || 'student1234';
    const { valid, reasons } = validatePassword(plain);
    if (!valid) return res.status(400).json({ success: false, error: reasons.join(' ') });

    const passwordHash = await hashPassword(plain);
    await userQueries.updatePassword(student.id, passwordHash);
    await logAudit({ req, action: 'student.password_reset', entity: 'user', entityId: student.id });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// POST /api/admin/students/:id/toggle-active
// ------------------------------------------------------------
router.post('/:id/toggle-active', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const student = await userQueries.findById(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }
    const updated = await userQueries.setActive(student.id, !student.isActive);
    await logAudit({ req, action: 'student.toggle_active', entity: 'user', entityId: student.id, after: { isActive: updated.isActive } });
    return res.json({ success: true, data: updated });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// DELETE /api/admin/students/:id
// ------------------------------------------------------------
router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const student = await userQueries.findById(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }
    await userQueries.remove(student.id);
    await logAudit({ req, action: 'student.delete', entity: 'user', entityId: student.id, before: student });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;