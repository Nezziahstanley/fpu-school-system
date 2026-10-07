// ============================================================
// FPU — Admin clearances API
// Mounted at /api/admin/clearances
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const clearanceQueries = require('../db/queries/clearances');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const STAFF = ['admin', 'bursar', 'registrar', 'rector', 'librarian'];

router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { sessionId, status, type } = req.query;
    const rows = await clearanceQueries.listWithStudent({ sessionId, status, type });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/stats', requireRole(STAFF), async (req, res, next) => {
  try {
    const rows = await clearanceQueries.countByStatus({ sessionId: req.query.sessionId });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireRole(['admin', 'bursar']), async (req, res, next) => {
  try {
    const { studentId, sessionId, type } = req.body || {};
    if (!studentId || !sessionId) {
      return res.status(400).json({ success: false, error: 'studentId and sessionId are required.' });
    }
    const row = await clearanceQueries.create({ studentId, sessionId, type });
    await logAudit({ req, action: 'clearance.create', entity: 'clearance', entityId: row.id });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/clear', requireRole(['admin', 'bursar', 'librarian']), async (req, res, next) => {
  try {
    const row = await clearanceQueries.markCleared(req.params.id, req.user.id, req.body?.remarks);
    if (!row) return res.status(404).json({ success: false, error: 'Clearance not found.' });
    await logAudit({ req, action: 'clearance.clear', entity: 'clearance', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/reject', requireRole(['admin', 'bursar']), async (req, res, next) => {
  try {
    const row = await clearanceQueries.markRejected(req.params.id, req.user.id, req.body?.remarks);
    if (!row) return res.status(404).json({ success: false, error: 'Clearance not found.' });
    await logAudit({ req, action: 'clearance.reject', entity: 'clearance', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const row = await clearanceQueries.remove(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Clearance not found.' });
    await logAudit({ req, action: 'clearance.delete', entity: 'clearance', entityId: row.id, before: row });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;