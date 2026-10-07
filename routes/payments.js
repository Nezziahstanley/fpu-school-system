// ============================================================
// FPU — Admin payments API
// Mounted at /api/admin/payments
// ------------------------------------------------------------
// Status workflow: pending → verified | rejected → refunded
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const paymentQueries = require('../db/queries/payments');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const STAFF = ['admin', 'bursar', 'registrar', 'rector'];

router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { sessionId, status } = req.query;
    const rows = await paymentQueries.listWithStudent({ sessionId, status });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/stats', requireRole(STAFF), async (req, res, next) => {
  try {
    const rows = await paymentQueries.countByStatus({ sessionId: req.query.sessionId });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await paymentQueries.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Payment not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireRole(['admin', 'bursar']), async (req, res, next) => {
  try {
    const { studentId, sessionId, amount, reference } = req.body || {};
    if (!studentId || !sessionId || amount === undefined || !reference) {
      return res.status(400).json({ success: false, error: 'studentId, sessionId, amount, reference are required.' });
    }
    const row = await paymentQueries.create(req.body);
    await logAudit({ req, action: 'payment.create', entity: 'payment', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', requireRole(['admin', 'bursar']), async (req, res, next) => {
  try {
    const existing = await paymentQueries.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Payment not found.' });
    const patch = { ...req.body };
    delete patch.id;
    const row = await paymentQueries.update(existing.id, patch);
    await logAudit({ req, action: 'payment.update', entity: 'payment', entityId: existing.id, before: existing, after: row });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/verify', requireRole(['admin', 'bursar']), async (req, res, next) => {
  try {
    const row = await paymentQueries.verify(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Payment not found.' });
    await logAudit({ req, action: 'payment.verify', entity: 'payment', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/reject', requireRole(['admin', 'bursar']), async (req, res, next) => {
  try {
    const row = await paymentQueries.reject(req.params.id, req.user.id, req.body?.reason);
    if (!row) return res.status(404).json({ success: false, error: 'Payment not found.' });
    await logAudit({ req, action: 'payment.reject', entity: 'payment', entityId: row.id, after: { reason: req.body?.reason } });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/refund', requireRole(['admin', 'bursar']), async (req, res, next) => {
  try {
    const row = await paymentQueries.refund(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Payment not found.' });
    await logAudit({ req, action: 'payment.refund', entity: 'payment', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const row = await paymentQueries.remove(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Payment not found.' });
    await logAudit({ req, action: 'payment.delete', entity: 'payment', entityId: row.id, before: row });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;