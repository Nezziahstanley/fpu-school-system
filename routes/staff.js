// ============================================================
// FPU — Admin staff API (lecturers, HODs, principals)
// Mounted at /api/admin/staff
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries = require('../db/queries/users');
const courseQueries = require('../db/queries/courses');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { hashPassword, validatePassword } = require('../utils/password');

const STAFF_ADMINS = ['admin', 'registrar', 'rector', 'hod'];

// GET /api/admin/staff
router.get('/', requireRole(STAFF_ADMINS), async (req, res, next) => {
  try {
    const { departmentId, role, search, limit = 200, offset = 0 } = req.query;
    const rows = await userQueries.list({
      role: role || undefined,
      departmentId,
      search,
      limit: Number(limit),
      offset: Number(offset),
    });
    const filtered = rows.filter((u) => u.role !== 'student');
    return res.json({ success: true, data: filtered });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/staff/:id
router.get('/:id', requireRole(STAFF_ADMINS), async (req, res, next) => {
  try {
    const user = await userQueries.findByIdWithRelations(req.params.id);
    if (!user || user.role === 'student') {
      return res.status(404).json({ success: false, error: 'Staff member not found.' });
    }
    return res.json({ success: true, data: user });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/staff
router.post('/', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, middleName, phone, gender, role = 'lecturer', departmentId, rank, specialization, qualification, employmentDate } = req.body || {};
    if (!email || !firstName || !lastName || !role) {
      return res.status(400).json({ success: false, error: 'email, firstName, lastName, role are required.' });
    }
    const allowedRoles = ['lecturer', 'hod', 'bursar', 'rector', 'registrar', 'librarian', 'exam_officer', 'academic_officer', 'admission_officer', 'admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, error: `role must be one of: ${allowedRoles.join(', ')}` });
    }

    if (await userQueries.emailExists(email)) {
      return res.status(409).json({ success: false, error: 'A user with this email already exists.' });
    }

    if (typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({ success: false, error: 'An initial password is required.' });
    }
    if (role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only an administrator can create another admin account.' });
    }

    const plain = password;
    const { valid, reasons } = validatePassword(plain);
    if (!valid) return res.status(400).json({ success: false, error: reasons.join(' ') });

    const passwordHash = await hashPassword(plain);

    let schoolId = null;
    if (departmentId) {
      const dept = await courseQueries.findDepartmentById(departmentId);
      if (dept) schoolId = dept.schoolId;
    }

    const user = await userQueries.create({
      email, passwordHash, role,
      firstName, lastName, middleName, phone, gender,
      departmentId: departmentId || null,
      schoolId,
      mustChangePassword: true,
    });

    // Create staff profile
    const { db, schema } = require('../db');
    await db.insert(schema.staffProfiles).values({
      userId: user.id,
      rank: rank || null,
      specialization: specialization || null,
      qualification: qualification || null,
      employmentDate: employmentDate || null,
      isHod: role === 'hod',
    }).onConflictDoNothing();

    await logAudit({ req, action: 'staff.create', entity: 'user', entityId: user.id, after: { role } });
    return res.status(201).json({ success: true, data: user });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/admin/staff/:id
router.put('/:id', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const user = await userQueries.findById(req.params.id);
    if (!user || user.role === 'student') {
      return res.status(404).json({ success: false, error: 'Staff member not found.' });
    }

    const body = req.body || {};
    const { rank, specialization, qualification, employmentDate } = body;

    // 1. Separate User fields from Staff Profile fields
    const userPatch = { ...body };
    delete userPatch.password;
    delete userPatch.passwordHash;
    delete userPatch.role; 
    
    // Remove staff fields so they don't break the user update
    delete userPatch.rank;
    delete userPatch.specialization;
    delete userPatch.qualification;
    delete userPatch.employmentDate;

    // 2. Update the User table (Name, Email, Phone, Address, etc.)
    const updatedUser = await userQueries.update(user.id, userPatch);

    // 3. Update the Staff Profile table (Rank, Specialization, etc.)
    if (rank || specialization || qualification || employmentDate) {
      const { db, schema } = require('../db');
      const { eq } = require('drizzle-orm');

      // Check if profile exists first
      const existingProfile = await db
        .select()
        .from(schema.staffProfiles)
        .where(eq(schema.staffProfiles.userId, user.id))
        .limit(1);

      if (existingProfile.length > 0) {
        // Update existing profile
        await db.update(schema.staffProfiles)
          .set({
            rank: rank || existingProfile[0].rank,
            specialization: specialization || existingProfile[0].specialization,
            qualification: qualification || existingProfile[0].qualification,
            employmentDate: employmentDate || existingProfile[0].employmentDate,
            updatedAt: new Date() // If your table has this column
          })
          .where(eq(schema.staffProfiles.userId, user.id));
      } else {
        // Create new profile
        await db.insert(schema.staffProfiles).values({
          userId: user.id,
          rank: rank || null,
          specialization: specialization || null,
          qualification: qualification || null,
          employmentDate: employmentDate || null,
          isHod: user.role === 'hod',
        });
      }
    }

    await logAudit({ req, action: 'staff.update', entity: 'user', entityId: user.id, before: user, after: updatedUser });
    return res.json({ success: true, data: updatedUser });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/staff/:id/reset-password
router.post('/:id/reset-password', requireRole(['admin']), async (req, res, next) => {
  try {
    const user = await userQueries.findById(req.params.id);
    if (!user || user.role === 'student') {
      return res.status(404).json({ success: false, error: 'Staff member not found.' });
    }
    const plain = req.body?.password;
    if (typeof plain !== 'string' || !plain.trim()) {
      return res.status(400).json({ success: false, error: 'A new password is required.' });
    }
    const { valid, reasons } = validatePassword(plain);
    if (!valid) return res.status(400).json({ success: false, error: reasons.join(' ') });

    const passwordHash = await hashPassword(plain);
    await userQueries.updatePassword(user.id, passwordHash);
    await logAudit({ req, action: 'staff.password_reset', entity: 'user', entityId: user.id });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/staff/:id/toggle-active
router.post('/:id/toggle-active', requireRole(['admin']), async (req, res, next) => {
  try {
    const user = await userQueries.findById(req.params.id);
    if (!user || user.role === 'student') {
      return res.status(404).json({ success: false, error: 'Staff member not found.' });
    }
    const updated = await userQueries.setActive(user.id, !user.isActive);
    await logAudit({ req, action: 'staff.toggle_active', entity: 'user', entityId: user.id, after: { isActive: updated.isActive } });
    return res.json({ success: true, data: updated });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/staff/:id/workload
router.get('/:id/workload', requireRole(STAFF_ADMINS), async (req, res, next) => {
  try {
    const { sessionId } = req.query;
    const rows = await courseQueries.listAllocationsWithRelations({ lecturerId: req.params.id, sessionId });
    const totalUnits = rows.reduce((s, r) => s + (Number(r.course?.unit) || 0), 0);
    return res.json({ success: true, data: { allocations: rows, totalUnits, totalCourses: rows.length } });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/admin/staff/:id
router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const user = await userQueries.findById(req.params.id);
    if (!user || user.role === 'student') {
      return res.status(404).json({ success: false, error: 'Staff member not found.' });
    }
    await userQueries.remove(user.id);
    await logAudit({ req, action: 'staff.delete', entity: 'user', entityId: user.id, before: user });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;