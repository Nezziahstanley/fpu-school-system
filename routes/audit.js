// ============================================================
// FPU — Admin audit log API
// Mounted at /api/admin/audit
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const auditQueries = require('../db/queries/audit');
const { requireRole } = require('../middleware/auth');

const STAFF = ['admin', 'registrar', 'rector'];

router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const rows = await auditQueries.listAuditWithUser(req.query);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/count', requireRole(STAFF), async (req, res, next) => {
  try {
    const total = await auditQueries.countAudit(req.query);
    return res.json({ success: true, total });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;