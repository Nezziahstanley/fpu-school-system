// ============================================================
// FPU — Admin fees API
// Mounted at /api/admin/fees
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const db = require('../db'); // Adjust path if your DB connection is elsewhere
const { requireRole } = require('../middleware/auth');

const STAFF = ['admin', 'bursar', 'registrar', 'rector'];

// GET /api/admin/fees — Return all fees from Neon
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, level, amount, session_id FROM fees ORDER BY level ASC'
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[fees] GET error:', err.message);
    return next(err);
  }
});

// GET /api/admin/fees/:id
router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM fees WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Fee not found.' });
    }
    return res.json({ success: true, data: result.rows[0] });
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
    const result = await db.query(
      `INSERT INTO fees (level, amount, session_id, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [String(level).toUpperCase(), Number(amount), sessionId || null]
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/admin/fees/:id
router.put('/:id', requireRole(['admin', 'bursar']), async (req, res, next) => {
  try {
    const { level, amount, sessionId } = req.body || {};
    const result = await db.query(
      `UPDATE fees SET
        level = COALESCE($1, level),
        amount = COALESCE($2, amount),
        session_id = COALESCE($3, session_id)
       WHERE id = $4 RETURNING *`,
      [
        level ? String(level).toUpperCase() : null,
        amount != null ? Number(amount) : null,
        sessionId || null,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Fee not found.' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/admin/fees/:id
router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM fees WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Fee not found.' });
    }
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;