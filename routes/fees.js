// ============================================================
// FPU — Admin fee-structures API
// Mounted at /api/admin/fees
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
    const { programmeId, level, sessionId, isActive } = req.query;
    const rows = await paymentQueries.listFeeStructures({ programmeId, level, sessionId, isActive });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await paymentQueries.findFeeStructureById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Fee structure not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireRole(['admin', 'bursar']), async (req, res, next) => {
  try {
    const { programmeId, level, sessionId } = req.body || {};
    if (!programmeId || !level || !sessionId) {
      return res.status(400).json({ success: false, error: 'programmeId, level, sessionId are required.' });
    }
    const existing = await paymentQueries.findFeeStructure({ programmeId, level, sessionId });
    if (existing) return res.status(409).json({ success: false, error: 'A fee structure already exists for this tuple.' });

    const row = await paymentQueries.createFeeStructure(req.body);
    await logAudit({ req, action: 'fee.create', entity: 'fee_structure', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', requireRole(['admin', 'bursar']), async (req, res, next) => {
  try {
    const existing = await paymentQueries.findFeeStructureById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Fee structure not found.' });
    const row = await paymentQueries.updateFeeStructure(existing.id, req.body);
    await logAudit({ req, action: 'fee.update', entity: 'fee_structure', entityId: existing.id, before: existing, after: row });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const existing = await paymentQueries.findFeeStructureById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Fee structure not found.' });
    await paymentQueries.removeFeeStructure(existing.id);
    await logAudit({ req, action: 'fee.delete', entity: 'fee_structure', entityId: existing.id, before: existing });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;