// ============================================================
// FPU — Admin fees API
// Mounted at /api/admin/fees
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const feeQueries = require('../db/queries/fees');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const STAFF = ['admin', 'bursar', 'registrar', 'rector'];

router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const rows = await feeQueries.listFees();
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[fees] GET / error:', err.message);
    return next(err);
  }
});

router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await feeQueries.findFeeById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Fee not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireRole(['admin', 'bursar']), async (req, res, next) => {
  try {
    const { level, amount, sessionId } = req.body || {};
    if (!level || amount === undefined) {
      return res.status(400).json({ success: false, error: 'level and amount are required.' });
    }
    const row = await feeQueries.createFee({ level, amount, sessionId });
    await logAudit({ req, action: 'fee.create', entity: 'fee', entityId: row.id });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', requireRole(['admin', 'bursar']), async (req, res, next) => {
  try {
    const existing = await feeQueries.findFeeById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Fee not found.' });
    const row = await feeQueries.updateFee(existing.id, req.body || {});
    await logAudit({ req, action: 'fee.update', entity: 'fee', entityId: existing.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const existing = await feeQueries.findFeeById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Fee not found.' });
    await feeQueries.removeFee(existing.id);
    await logAudit({ req, action: 'fee.delete', entity: 'fee', entityId: existing.id });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;