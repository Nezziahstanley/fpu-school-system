// ============================================================
// FPU — Admin authentication
// ------------------------------------------------------------
// POST /api/admin/auth/login
// POST /api/admin/auth/logout
// GET  /api/admin/auth/me
// ============================================================

'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const userQueries = require('../db/queries/users');
const sessionQueries = require('../db/queries/sessions');
const { comparePassword } = require('../utils/password');
const { logAudit, logSecurity, logLogin, contextFromReq } = require('../utils/audit');
const { requireUser } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimits');

// ------------------------------------------------------------
function sessionTtlMs() {
  const hours = Number(process.env.SESSION_TTL_HOURS) || 72;
  return hours * 60 * 60 * 1000;
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ------------------------------------------------------------
// POST /api/admin/auth/login
// ------------------------------------------------------------
router.post('/login', loginLimiter, async (req, res, next) => {
  const { email, password } = req.body || {};
  const ctx = contextFromReq(req);

  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const user = await userQueries.findByEmail(email);

    if (!user || !user.isActive) {
      await logLogin({ req, email, success: false, reason: 'user_not_found_or_inactive' });
      await logSecurity({ req, event: 'admin_login_failed', severity: 'warning', details: { email } });
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    // Any authenticated user can log in through this endpoint:
    //   - Staff → /admin/app.html or /portal/app.html
    //   - Student → /portal/app.html (student SPA)
    const ALLOWED_ROLES = [
      'admin', 'rector', 'registrar', 'bursar', 'librarian',
      'exam_officer', 'academic_officer', 'admission_officer',
      'hod', 'lecturer', 'student',
    ];
    if (!ALLOWED_ROLES.includes(user.role)) {
      await logLogin({ req, userId: user.id, email, success: false, reason: 'role_not_allowed' });
      await logSecurity({ req, userId: user.id, event: 'admin_login_role_denied', severity: 'warning', details: { role: user.role } });
      return res.status(403).json({ success: false, error: 'This role cannot log in here.' });
    }

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) {
      await logLogin({ req, userId: user.id, email, success: false, reason: 'bad_password' });
      await logSecurity({ req, userId: user.id, event: 'admin_login_bad_password', severity: 'warning' });
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const token = newToken();
    const expiresAt = new Date(Date.now() + sessionTtlMs());
    await sessionQueries.createAdminSession({
      userId: user.id,
      token,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      expiresAt,
    });
    await userQueries.touchLogin(user.id);

    await logLogin({ req, userId: user.id, email, success: true });
    await logAudit({ req, userId: user.id, action: 'admin.login', entity: 'user', entityId: user.id });

    // Fetch user again with joins so department/programme names are populated
    const fullUser = await userQueries.findById(user.id);

    return res.json({
      success: true,
      token,
      expiresAt,
      user: {
        id: fullUser.id,
        email: fullUser.email,
        role: fullUser.role,
        firstName: fullUser.firstName,
        lastName: fullUser.lastName,
        middleName: fullUser.middleName || null,
        photoUrl: fullUser.photoUrl || null,
        departmentId: fullUser.departmentId ?? null,
        departmentName: fullUser.departmentName ?? null,
        departmentCode: fullUser.departmentCode ?? null,
        programmeId: fullUser.programmeId ?? null,
        programmeName: fullUser.programmeName ?? null,
        level: fullUser.level ?? null,
        matricNumber: fullUser.matricNumber ?? null,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// POST /api/admin/auth/logout
// ------------------------------------------------------------
router.post('/logout', async (req, res, next) => {
  try {
    const token = req.authToken;
    if (token) {
      await sessionQueries.revokeAdminSession(token);
      await sessionQueries.revokeUserSession(token);
    }
    await logAudit({ req, userId: req.user?.id, action: 'admin.logout' });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// GET /api/admin/auth/me — current user
// ------------------------------------------------------------
router.get('/me', requireUser, async (req, res, next) => {
  try {
    const user = await userQueries.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    delete user.passwordHash;
    delete user.password_hash;

    return res.json({ success: true, user });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;