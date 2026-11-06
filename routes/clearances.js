// ============================================================
// FPU — Admin clearances API
// Mounted at /api/admin/clearances
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const db = require('../db');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const STAFF = ['admin', 'bursar', 'registrar', 'rector', 'librarian'];

// ------------------------------------------------------------
// GET /api/admin/clearances — List all clearances
// ------------------------------------------------------------
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { sessionId, status } = req.query;
    let query = `SELECT * FROM clearances`;
    const params = [];
    const where = [];

    if (sessionId) {
      params.push(sessionId);
      where.push(`session_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }

    if (where.length) query += ' WHERE ' + where.join(' AND ');
    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[clearances] GET / error:', err.message);
    return next(err);
  }
});

// ------------------------------------------------------------
// GET /api/admin/clearances/stats
// ------------------------------------------------------------
router.get('/stats', requireRole(STAFF), async (req, res, next) => {
  try {
    const { sessionId } = req.query;
    let query = `SELECT status, COUNT(*)::int AS count FROM clearances`;
    const params = [];
    if (sessionId) {
      params.push(sessionId);
      query += ' WHERE session_id = $1';
    }
    query += ' GROUP BY status';
    
    const result = await db.query(query, params);
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// GET /api/admin/clearances/student/:studentId
// MUST BE BEFORE /:id routes
// ------------------------------------------------------------
router.get('/student/:studentId', requireRole(STAFF), async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM clearances WHERE student_id = $1 LIMIT 1',
      [req.params.studentId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No clearance found for this student.' });
    }
    
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// POST /api/admin/clearances — Create a new clearance
// ------------------------------------------------------------
router.post('/', requireRole(['admin', 'bursar', 'registrar']), async (req, res, next) => {
  try {
    const { studentId, status = 'pending', remarks, type = 'general' } = req.body || {};
    if (!studentId) {
      return res.status(400).json({ success: false, error: 'studentId is required.' });
    }

    // Get current session
    let sessionId = null;
    const sessionRes = await db.query('SELECT id FROM academic_sessions WHERE is_current = true LIMIT 1');
    if (sessionRes.rows.length) sessionId = sessionRes.rows[0].id;

    const clearedBy = status === 'cleared' ? (req.user?.id || null) : null;
    const clearedAt = status === 'cleared' ? new Date() : null;

    const query = `
      INSERT INTO clearances (student_id, session_id, type, status, remarks, cleared_by, cleared_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *;
    `;
    const result = await db.query(query, [
      studentId, sessionId, type, status, remarks || null, clearedBy, clearedAt
    ]);
    
    await logAudit({ req, action: 'clearance.create', entity: 'clearance', entityId: result.rows[0].id });
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// PUT /api/admin/clearances/student/:studentId
// ------------------------------------------------------------
router.put('/student/:studentId', requireRole(['admin', 'bursar', 'registrar']), async (req, res, next) => {
  try {
    const { status, remarks } = req.body || {};
    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required.' });
    }

    const clearedBy = status === 'cleared' ? (req.user?.id || null) : null;
    const clearedAt = status === 'cleared' ? new Date() : null;

    const query = `
      UPDATE clearances 
      SET status = $1, remarks = COALESCE($2, remarks), cleared_by = COALESCE($3, cleared_by), cleared_at = COALESCE($4, cleared_at)
      WHERE student_id = $5
      RETURNING *;
    `;
    const result = await db.query(query, [
      status, remarks || null, clearedBy, clearedAt, req.params.studentId
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No clearance found for this student.' });
    }
    
    await logAudit({ req, action: 'clearance.update', entity: 'clearance', entityId: result.rows[0].id });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// POST /api/admin/clearances/bulk-status — Bulk clear/reject
// ------------------------------------------------------------
router.post('/bulk-status', requireRole(['admin', 'bursar', 'registrar']), async (req, res, next) => {
  try {
    const { studentIds, status } = req.body || {};
    if (!Array.isArray(studentIds) || !studentIds.length) {
      return res.status(400).json({ success: false, error: 'studentIds array is required.' });
    }
    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required.' });
    }

    const clearedBy = status === 'cleared' ? (req.user?.id || null) : null;
    const clearedAt = status === 'cleared' ? new Date() : null;

    // Get current session
    let sessionId = null;
    const sessionRes = await db.query('SELECT id FROM academic_sessions WHERE is_current = true LIMIT 1');
    if (sessionRes.rows.length) sessionId = sessionRes.rows[0].id;

    const query = `
      INSERT INTO clearances (student_id, session_id, type, status, cleared_by, cleared_at, created_at)
      SELECT unnest($1::int[]), $2, 'general', $3, $4, $5, NOW()
      RETURNING *;
    `;
    const result = await db.query(query, [
      studentIds, sessionId, status, clearedBy, clearedAt
    ]);
    
    await logAudit({ req, action: 'clearance.bulk', after: { count: result.rowCount } });
    return res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (err) {
    console.error('[clearances] POST bulk-status error:', err.message);
    return next(err);
  }
});

// ------------------------------------------------------------
// POST /api/admin/clearances/:id/clear
// ------------------------------------------------------------
router.post('/:id/clear', requireRole(STAFF), async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE clearances SET status = 'cleared', cleared_by = $1, cleared_at = NOW(), remarks = COALESCE($2, remarks) WHERE id = $3 RETURNING *`,
      [req.user?.id || null, req.body?.remarks || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found.' });
    await logAudit({ req, action: 'clearance.clear', entity: 'clearance', entityId: req.params.id });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// POST /api/admin/clearances/:id/reject
// ------------------------------------------------------------
router.post('/:id/reject', requireRole(STAFF), async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE clearances SET status = 'rejected', cleared_by = $1, cleared_at = NOW(), remarks = COALESCE($2, remarks) WHERE id = $3 RETURNING *`,
      [req.user?.id || null, req.body?.remarks || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found.' });
    await logAudit({ req, action: 'clearance.reject', entity: 'clearance', entityId: req.params.id });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// DELETE /api/admin/clearances/:id
// ------------------------------------------------------------
router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM clearances WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found.' });
    await logAudit({ req, action: 'clearance.delete', entity: 'clearance', entityId: req.params.id });
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

module.exports = router;