// ============================================================
// FPU — Portal profile routes
// Mounted at /api/portal
// ------------------------------------------------------------
// Handles: photo upload, profile update
// ============================================================

'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const { requireUser } = require('../../middleware/auth');
const userQueries = require('../../db/queries/users');
const { logAudit } = require('../../utils/audit');

// ------------------------------------------------------------
// Multer — configured for image uploads only
// ------------------------------------------------------------
let multer;
try {
  multer = require('multer');
} catch {
  // Multer not installed — fall back to a helpful error
  multer = null;
}

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
const MAX_SIZE_MB = Number(process.env.MAX_UPLOAD_MB) || 5;
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Ensure upload dir exists
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}

let upload = null;
if (multer) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const userId = req.user ? req.user.id : 'unknown';
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `user-${userId}-${Date.now()}${ext}`);
    },
  });

  upload = multer({
    storage,
    limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
      cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
    },
  });
}

// ============================================================
// POST /api/portal/profile/photo
// Upload or replace the current user's profile photo.
// ============================================================
router.post('/profile/photo', requireUser, (req, res, next) => {
  if (!upload) {
    return res.status(503).json({
      success: false,
      error: 'Photo upload is not configured (multer missing).',
    });
  }

  upload.single('photo')(req, res, async (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? `File too large. Maximum ${MAX_SIZE_MB}MB.`
        : err.message;
      return res.status(400).json({ success: false, error: msg });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    try {
      const photoUrl = `/uploads/${req.file.filename}`;
      const prevPhoto = req.user.photoUrl;

      await userQueries.update(req.user.id, { photoUrl });

      // Delete the old photo if it existed and was inside /uploads/
      if (prevPhoto && prevPhoto.startsWith('/uploads/')) {
        const oldPath = path.join(UPLOAD_DIR, path.basename(prevPhoto));
        try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
      }

      await logAudit({
        req,
        userId: req.user.id,
        action: 'portal.profile.photo.update',
        entity: 'user',
        entityId: req.user.id,
      });

      return res.json({ success: true, data: { photoUrl } });
    } catch (e) {
      return next(e);
    }
  });
});

// ============================================================
// DELETE /api/portal/profile/photo
// Remove the current user's profile photo.
// ============================================================
router.delete('/profile/photo', requireUser, async (req, res, next) => {
  try {
    const prevPhoto = req.user.photoUrl;

    await userQueries.update(req.user.id, { photoUrl: null });

    if (prevPhoto && prevPhoto.startsWith('/uploads/')) {
      const oldPath = path.join(UPLOAD_DIR, path.basename(prevPhoto));
      try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
    }

    await logAudit({
      req,
      userId: req.user.id,
      action: 'portal.profile.photo.delete',
      entity: 'user',
      entityId: req.user.id,
    });

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/portal/profile
// Return the current user's full profile.
// ============================================================
router.get('/profile', requireUser, async (req, res, next) => {
  try {
    const user = await userQueries.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    // Never leak password hash
    delete user.passwordHash;

    return res.json({ success: true, data: user });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// PATCH /api/portal/profile
// Update the current user's editable details.
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

    // Basic validation
    if (patch.firstName !== undefined && (!patch.firstName || String(patch.firstName).trim().length < 2)) {
      return res.status(400).json({ success: false, error: 'First name must be at least 2 characters.' });
    }
    if (patch.lastName !== undefined && (!patch.lastName || String(patch.lastName).trim().length < 2)) {
      return res.status(400).json({ success: false, error: 'Last name must be at least 2 characters.' });
    }
    if (patch.phone && !/^[0-9+\-\s()]{7,20}$/.test(String(patch.phone))) {
      return res.status(400).json({ success: false, error: 'Invalid phone number format.' });
    }

    const updated = await userQueries.update(req.user.id, patch);
    if (!updated) return res.status(404).json({ success: false, error: 'User not found.' });

    // Return safe user (no password hash)
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
    return next(err);
  }
});

// ============================================================
// POST /api/portal/profile/change-password
// Requires current password for verification.
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

    // Load the full user (with passwordHash)
    const full = await userQueries.findByEmail(req.user.email);
    if (!full) return res.status(404).json({ success: false, error: 'User not found.' });

    // Verify current password
    const { comparePassword, hashPassword } = require('../../utils/password');
    const ok = await comparePassword(currentPassword, full.passwordHash);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    }

    // Hash and save new password
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
    return next(err);
  }
});
module.exports = router;