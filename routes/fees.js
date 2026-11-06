// ============================================================
// FPU — Admin fees API
// Mounted at /api/admin/fees
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const { db, schema } = require('..');
const { eq, asc } = require('drizzle-orm');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const STAFF = ['admin', 'bursar', 'registrar', 'rector'];

// GET /api/admin/fees — list all fees
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const rows = await db.select().from(schema.fees).orderBy(asc(schema.fees.level));
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[fees] GET error:', err.message);
    return next(err);
  }
});

// GET /api/admin/fees/:id
router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const [row] = await db
      .select()
      .from(schema.fees)
      .where(eq(schema.fees.id, Number(req.params.id)))
      .limit(1);
    if (!row) return res.status(404).json({ success: false, error: 'Fee not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/fees
router.post('/', requireRole(['admin', 'bursar']), async (req, res, next) => {
  try {
    const { level, amount, sessionId } = req.body || {};
    if (!level || amount === undefined) {
      return res.status(400).json({ success: false, error: 'level and amount are required.' });
    }
    const [row] = await db
      .insert(schema.fees)
      .values({
        level: String(level).toUpperCase(),
        amount: String(Number(amount)),
        sessionId: sessionId ? Number(sessionId) : null,
      })
      .returning();
    await logAudit({ req, action: 'fee.create', entity: 'fee', entityId: row.id });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/admin/fees/:id
router.put('/:id', requireRole(['admin', 'bursar']), async (req, res, next) => {
  try {
    const { level, amount, sessionId } = req.body || {};
    const patch = {};
    if (level !== undefined) patch.level = String(level).toUpperCase();
    if (amount !== undefined) patch.amount = String(Number(amount));
    if (sessionId !== undefined) patch.sessionId = sessionId ? Number(sessionId) : null;

    if (!Object.keys(patch).length) {
      return res.status(400).json({ success: false, error: 'No fields to update.' });
    }

    const [row] = await db
      .update(schema.fees)
      .set(patch)
      .where(eq(schema.fees.id, Number(req.params.id)))
      .returning();

    if (!row) return res.status(404).json({ success: false, error: 'Fee not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/admin/fees/:id
router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const [row] = await db
      .delete(schema.fees)
      .where(eq(schema.fees.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Fee not found.' });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;