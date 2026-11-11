// ============================================================
// FPU — Portal profile routes
// Mounted at /api/portal
// ------------------------------------------------------------
// Routes:
//   GET    /api/portal/profile
//   PATCH  /api/portal/profile
//   POST   /api/portal/profile/photo
//   DELETE /api/portal/profile/photo
//   POST   /api/portal/profile/change-password
// ============================================================

'use strict';

const express = require('express');
const path = require('path');
const router = express.Router();

const { requireUser } = require('../../middleware/auth');
const userQueries = require('../../db/queries/users');
const { logAudit } = require('../../utils/audit');

// Cloudinary for photo uploads
const multer = require('multer');
const { storage } = require('../../utils/cloudinary');
const MAX_SIZE_MB = Number(process.env.MAX_UPLOAD_MB) || 5;
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) return cb(new Error('Only PNG, JPG and WEBP images are allowed.'));
    cb(null, true);
  },
});

// ============================================================
// GET /api/portal/profile
// ============================================================
router.get('/profile', requireUser, async (req, res, next) => {
  try {
    const user = await userQueries.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    delete user.passwordHash;
    delete user.password_hash;

    return res.json({ success: true, data: user });
  } catch (err) {
    console.error('[portal/profile] GET error:', err);
    return next(err);
  }
});

// ============================================================
// PATCH /api/portal/profile
// ============================================================
router.patch('/profile', requireUser, async (req, res, next) => {
  try {
    const ALLOWED = [
      'firstName', 'lastName', 'middleName',
      'phone', 'gender', 'dateOfBirth',
      'stateOfOrigin', 'nationality', 'address',
    ];

    const patch = {};
    for (const k of ALLOWED) {
      if (req.body && req.body[k] !== undefined) {
        patch[k] = req.body[k] === '' ? null : req.body[k];
      }
    }

    if (!Object.keys(patch).length) {
      return res.status(400).json({ success: false, error: 'No editable fields provided.' });
    }

    if (patch.firstName !== undefined && (!patch.firstName || String(patch.firstName).trim().length < 2)) {
      return res.status(400).json({ success: false, error: 'First name must be at least 2 characters.' });
    }
    if (patch.lastName !== undefined && (!patch.lastName || String(patch.lastName).trim().length < 2)) {
      return res.status(400).json({ success: false, error: 'Last name must be at least 2 characters.' });
    }

    const updated = await userQueries.update(req.user.id, patch);
    if (!updated) return res.status(404).json({ success: false, error: 'User not found.' });

    delete updated.passwordHash;
    delete updated.password_hash;

    await logAudit({
      req,
      userId: req.user.id,
      action: 'portal.profile.update',
      entity: 'user',
      entityId: req.user.id,
      details: { fields: Object.keys(patch) },
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[portal/profile] PATCH error:', err);
    return next(err);
  }
});

// ============================================================
// POST /api/portal/profile/photo
// ============================================================
router.post('/profile/photo', requireUser, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    // Cloudinary returns the full URL in req.file.path
    const photoUrl = req.file.path;

    await userQueries.update(req.user.id, { photoUrl });

    await logAudit({
      req,
      userId: req.user.id,
      action: 'portal.profile.photo.update',
      entity: 'user',
      entityId: req.user.id,
    });

    return res.json({ success: true, data: { photoUrl } });
  } catch (err) {
    console.error('[portal/profile] photo upload error:', err);
    return next(err);
  }
});

// ============================================================
// DELETE /api/portal/profile/photo
// ============================================================
router.delete('/profile/photo', requireUser, async (req, res, next) => {
  try {
    await userQueries.update(req.user.id, { photoUrl: null });

    await logAudit({
      req,
      userId: req.user.id,
      action: 'portal.profile.photo.delete',
      entity: 'user',
      entityId: req.user.id,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('[portal/profile] photo delete error:', err);
    return next(err);
  }
});

// ============================================================
// POST /api/portal/profile/signature
// Store the signed-in user's verified signature image in Cloudinary.
// This signature can be used only by workflows that authorise that role.
// ============================================================
router.post('/profile/signature', requireUser, upload.single('signature'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Please upload a signature image.' });
    if (!ALLOWED_MIME.includes(req.file.mimetype)) {
      return res.status(400).json({ success: false, error: 'Signature must be a PNG, JPG or WEBP image.' });
    }
    if (req.file.size && req.file.size > MAX_SIZE_MB * 1024 * 1024) {
      return res.status(400).json({ success: false, error: `Signature image must be ${MAX_SIZE_MB} MB or smaller.` });
    }
    const signatureUrl = req.file.path;
    const updated = await userQueries.update(req.user.id, { signatureUrl });
    if (!updated) return res.status(404).json({ success: false, error: 'User not found.' });
    await logAudit({ req, userId: req.user.id, action: 'portal.profile.signature.update', entity: 'user', entityId: req.user.id });
    return res.json({ success: true, data: { signatureUrl } });
  } catch (err) {
    console.error('[portal/profile] signature upload error:', err);
    return next(err);
  }
});
// ============================================================
// POST /api/portal/profile/change-password
// ============================================================
router.post('/profile/change-password', requireUser, async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, error: 'All password fields are required.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'New passwords do not match.' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters.' });
    }

    const full = await userQueries.findByEmail(req.user.email);
    if (!full) return res.status(404).json({ success: false, error: 'User not found.' });

    const { comparePassword, hashPassword } = require('../../utils/password');
    const ok = await comparePassword(currentPassword, full.passwordHash);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    }

    const newHash = await hashPassword(newPassword);
    await userQueries.update(req.user.id, {
      passwordHash: newHash,
      mustChangePassword: false,
    });

    await logAudit({
      req,
      userId: req.user.id,
      action: 'portal.profile.change_password',
      entity: 'user',
      entityId: req.user.id,
    });

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('[portal/profile] change-password error:', err);
    return next(err);
  }
});

module.exports = router;