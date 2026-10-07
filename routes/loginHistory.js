// ============================================================
// FPU — Admin login-history API
// Mounted at /api/admin/login-history
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const audit = require('../db/queries/audit');
const { requireRole } = require('../middleware/auth');

const STAFF = ['admin', 'registrar', 'rector'];

// ------------------------------------------------------------
// GET /api/admin/login-history
// ------------------------------------------------------------
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { userId, email, success, limit = 200, offset = 0 } = req.query;
    const rows = await audit.listLogins({
      userId,
      email,
      success: success === undefined ? undefined : String(success).toLowerCase() === 'true',
      limit: Number(limit),
      offset: Number(offset),
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// GET /api/admin/login-history/with-user
// ------------------------------------------------------------
router.get('/with-user', requireRole(STAFF), async (req, res, next) => {
  try {
    const { success } = req.query;
    const rows = await audit.listLoginsWithUser({
      success: success === undefined ? undefined : String(success).toLowerCase() === 'true',
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;