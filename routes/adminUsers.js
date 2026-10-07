// ============================================================
// FPU — Admin accounts CRUD (only for `role = admin`)
// Mounted at /api/admin/users
// ------------------------------------------------------------
// MUST be mounted BEFORE routes/users.js in routes/index.js.
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries = require('../db/queries/users');
const sessionQueries = require('../db/queries/sessions');
const { requireAdmin } = require('../middleware/auth');
const { hashPassword, validatePassword } = require('../utils/password');
const { logAudit } = require('../utils/audit');

// GET /api/admin/users — list admin accounts
router.get('/', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await userQueries.list({ role: 'admin', limit: 500, offset: 0 });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/users/:id
router.get('/:id', requireAdmin, async (req, res, next) => {
  try {
    const user = await userQueries.findById(req.params.id);
    if (!user || user.role !== 'admin') return res.status(404).json({ success: false, error: 'Admin not found.' });
    return res.json({ success: true, data: user });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/users
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, middleName, phone } = req.body || {};
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ success: false, error: 'email, firstName, lastName are required.' });
    }
    if (await userQueries.emailExists(email)) {
      return res.status(409).json({ success: false, error: 'A user with this email already exists.' });
    }
    const plain = password || 'admin1234';
    const { valid, reasons } = validatePassword(plain);
    if (!valid) return res.status(400).json({ success: false, error: reasons.join(' ') });

    const passwordHash = await hashPassword(plain);
    const user = await userQueries.create({
      email, passwordHash, role: 'admin',
      firstName, lastName, middleName, phone,
      mustChangePassword: true,
    });
    await logAudit({ req, action: 'admin_user.create', entity: 'user', entityId: user.id, after: { email } });
    return res.status(201).json({ success: true, data: user });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/admin/users/:id
router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const user = await userQueries.findById(req.params.id);
    if (!user || user.role !== 'admin') return res.status(404).json({ success: false, error: 'Admin not found.' });

    const patch = { ...req.body };
    delete patch.password;
    delete patch.passwordHash;
    delete patch.role;

    const updated = await userQueries.update(user.id, patch);
    await logAudit({ req, action: 'admin_user.update', entity: 'user', entityId: user.id, before: user, after: updated });
    return res.json({ success: true, data: updated });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/users/:id/reset-password
router.post('/:id/reset-password', requireAdmin, async (req, res, next) => {
  try {
    const user = await userQueries.findById(req.params.id);
    if (!user || user.role !== 'admin') return res.status(404).json({ success: false, error: 'Admin not found.' });

    const plain = req.body?.password || 'admin1234';
    const { valid, reasons } = validatePassword(plain);
    if (!valid) return res.status(400).json({ success: false, error: reasons.join(' ') });

    const passwordHash = await hashPassword(plain);
    await userQueries.updatePassword(user.id, passwordHash);
    await sessionQueries.revokeAllAdminSessions(user.id);
    await logAudit({ req, action: 'admin_user.password_reset', entity: 'user', entityId: user.id });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/users/:id/toggle-active
router.post('/:id/toggle-active', requireAdmin, async (req, res, next) => {
  try {
    const user = await userQueries.findById(req.params.id);
    if (!user || user.role !== 'admin') return res.status(404).json({ success: false, error: 'Admin not found.' });
    if (user.id === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot deactivate your own account.' });
    }
    const updated = await userQueries.setActive(user.id, !user.isActive);
    await logAudit({ req, action: 'admin_user.toggle_active', entity: 'user', entityId: user.id, after: { isActive: updated.isActive } });
    return res.json({ success: true, data: updated });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/admin/users/:id
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const user = await userQueries.findById(req.params.id);
    if (!user || user.role !== 'admin') return res.status(404).json({ success: false, error: 'Admin not found.' });
    if (user.id === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot delete your own account.' });
    }
    await userQueries.remove(user.id);
    await logAudit({ req, action: 'admin_user.delete', entity: 'user', entityId: user.id, before: user });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;