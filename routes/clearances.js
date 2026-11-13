// ============================================================
// FPU — Admin clearances API (FIXED)
// Mounted at /api/admin/clearances
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const db = require('../db');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const STAFF = ['admin', 'bursar', 'registrar', 'rector', 'librarian'];

async function resolveClearanceSessionId(requestedSessionId) {
  const result = requestedSessionId
    ? await db.query('SELECT id FROM academic_sessions WHERE id = $1 LIMIT 1', [requestedSessionId])
    : await db.query('SELECT id FROM academic_sessions ORDER BY is_current DESC, id DESC LIMIT 1');
  return result.rows[0]?.id || null;
}

async function ensureElectronicSignature(req, res) {
  const result = await db.query('SELECT signature_url FROM users WHERE id = $1 LIMIT 1', [req.user?.id]);
  if (!result.rows[0]?.signature_url) {
    res.status(409).json({
      success: false,
      error: 'Upload your electronic signature in My Profile before approving a clearance.',
    });
    return false;
  }
  return true;
}

// GET /api/admin/clearances — list all
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { sessionId, status } = req.query;
    const resolvedSessionId = await resolveClearanceSessionId(sessionId);
    if (!resolvedSessionId) return res.status(400).json({ success: false, error: 'No academic session is available. Create an academic session before managing clearances.' });
    const params = [resolvedSessionId];
    const where = ['session_id = $1'];
    if (status) { params.push(status); where.push('status = $' + params.length); }
    const query = 'SELECT * FROM clearances WHERE ' + where.join(' AND ') + ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[clearances] GET / error:', err.message);
    return next(err);
  }
});

// GET /api/admin/clearances/stats
router.get('/stats', requireRole(STAFF), async (req, res, next) => {
  try {
    const { sessionId } = req.query;
    const resolvedSessionId = await resolveClearanceSessionId(sessionId);
    if (!resolvedSessionId) return res.status(400).json({ success: false, error: 'No academic session is available.' });
    const result = await db.query(
      `SELECT status, COUNT(*)::int AS count FROM clearances WHERE session_id = $1 GROUP BY status`,
      [resolvedSessionId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/clearances/student/:studentId
router.get('/student/:studentId', requireRole(STAFF), async (req, res, next) => {
  try {
    const requestedSessionId = req.query?.sessionId || null;
    const resolvedSessionId = await resolveClearanceSessionId(requestedSessionId);
    if (!resolvedSessionId) return res.status(400).json({ success: false, error: 'No academic session is available.' });
    const result = await db.query(
      `SELECT * FROM clearances WHERE student_id = $1 AND session_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [req.params.studentId, resolvedSessionId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No clearance found.' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/clearances — create or update (Upsert)
router.post('/', requireRole(['admin', 'bursar', 'registrar']), async (req, res, next) => {
  try {
    const { studentId, status = 'pending', remarks } = req.body || {};
    if (!studentId) {
      return res.status(400).json({ success: false, error: 'studentId is required.' });
    }

    const requestedSessionId = req.body?.sessionId || null;
    const sessionId = await resolveClearanceSessionId(requestedSessionId);
    if (!sessionId) return res.status(400).json({ success: false, error: 'No academic session is available. Create an academic session before managing clearances.' });

    const normalizedStatus = String(status).toLowerCase();
    if (!['pending', 'cleared', 'rejected'].includes(normalizedStatus)) {
      return res.status(400).json({ success: false, error: 'Invalid clearance status.' });
    }
    if (normalizedStatus === 'cleared' && !(await ensureElectronicSignature(req, res))) return;
    const clearedBy = normalizedStatus === 'cleared' ? (req.user?.id || null) : null;
    const clearedAt = normalizedStatus === 'cleared' ? new Date() : null;

    // THE FIX IS HERE: ${status}::clearance_status forces PostgreSQL to cast the string properly
    const query = `
      INSERT INTO clearances 
        (student_id, session_id, type, status, remarks, cleared_by, cleared_at, created_at)
      VALUES ($1, $2, 'general', $3::clearance_status, $4, $5, $6, NOW())
      ON CONFLICT (student_id, session_id) 
      DO UPDATE SET 
        status = EXCLUDED.status, 
        remarks = EXCLUDED.remarks, 
        cleared_by = EXCLUDED.cleared_by, 
        cleared_at = EXCLUDED.cleared_at
      RETURNING *;
    `;
    const result = await db.query(query, [
      studentId, sessionId, normalizedStatus, remarks || null, clearedBy, clearedAt
    ]);
    
    await logAudit({ req, action: 'clearance.upsert', entity: 'clearance', entityId: result.rows[0].id });
    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[clearances] POST / error:', err.message);
    return next(err);
  }
});

// PUT /api/admin/clearances/student/:studentId
router.put('/student/:studentId', requireRole(['admin', 'bursar', 'registrar']), async (req, res, next) => {
  try {
    const { status, remarks } = req.body || {};
    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required.' });
    }

    const requestedSessionId = req.body?.sessionId || null;
    const sessionId = await resolveClearanceSessionId(requestedSessionId);
    if (!sessionId) return res.status(400).json({ success: false, error: 'No academic session is available. Create an academic session before managing clearances.' });
    const normalizedStatus = String(status).toLowerCase();
    if (!['pending', 'cleared', 'rejected'].includes(normalizedStatus)) {
      return res.status(400).json({ success: false, error: 'Invalid clearance status.' });
    }
    if (normalizedStatus === 'cleared' && !(await ensureElectronicSignature(req, res))) return;
    const clearedBy = normalizedStatus === 'cleared' ? (req.user?.id || null) : null;
    const clearedAt = normalizedStatus === 'cleared' ? new Date() : null;

    const query = `
      UPDATE clearances
      SET status = $1,
          remarks = COALESCE($2, remarks),
          cleared_by = CASE WHEN $1 = 'cleared' THEN $3 ELSE NULL END,
          cleared_at = CASE WHEN $1 = 'cleared' THEN $4 ELSE NULL END
      WHERE student_id = $5 AND session_id = $6
      RETURNING *;
    `;
    const result = await db.query(query, [
      normalizedStatus, remarks || null, clearedBy, clearedAt, req.params.studentId, sessionId
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No clearance found.' });
    }
    await logAudit({ req, action: 'clearance.update', entity: 'clearance', entityId: result.rows[0].id });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/clearances/bulk-status
router.post('/bulk-status', requireRole(['admin', 'bursar', 'registrar']), async (req, res, next) => {
  try {
    const { studentIds, status } = req.body || {};
    if (!Array.isArray(studentIds) || !studentIds.length) {
      return res.status(400).json({ success: false, error: 'studentIds array is required.' });
    }
    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required.' });
    }

    const requestedSessionId = req.body?.sessionId || null;
    const sessionRes = requestedSessionId
      ? await db.query('SELECT id FROM academic_sessions WHERE id = $1 LIMIT 1', [requestedSessionId])
      : await db.query('SELECT id FROM academic_sessions WHERE is_current = true LIMIT 1');
    if (!sessionRes.rows.length) {
      return res.status(400).json({ success: false, error: 'Selected academic session was not found.' });
    }
    const sessionId = sessionRes.rows[0].id;

    if (!['pending', 'cleared', 'rejected'].includes(String(status).toLowerCase())) {
      return res.status(400).json({ success: false, error: 'Invalid clearance status.' });
    }
    const normalizedStatus = String(status).toLowerCase();
    if (normalizedStatus === 'cleared' && !(await ensureElectronicSignature(req, res))) return;
    const clearedBy = normalizedStatus === 'cleared' ? (req.user?.id || null) : null;
    const clearedAt = normalizedStatus === 'cleared' ? new Date() : null;

    // FIXED: Added session_id, type, and ON CONFLICT to the bulk insert
    const query = `
      INSERT INTO clearances (student_id, session_id, type, status, remarks, cleared_by, cleared_at, created_at)
      SELECT unnest($1::int[]), $2, 'general', $3, 'Bulk action', $4, $5, NOW()
      ON CONFLICT (student_id, session_id) 
      DO UPDATE SET 
        status = EXCLUDED.status, 
        remarks = EXCLUDED.remarks, 
        cleared_by = EXCLUDED.cleared_by, 
        cleared_at = EXCLUDED.cleared_at
      RETURNING *;
    `;
    const result = await db.query(query, [studentIds, sessionId, normalizedStatus, clearedBy, clearedAt]);
    await logAudit({ req, action: 'clearance.bulk', after: { count: result.rowCount, status } });
    return res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (err) {
    console.error('[clearances] POST /bulk-status error:', err.message);
    return next(err);
  }
});

// POST /api/admin/clearances/:id/clear
router.post('/:id/clear', requireRole(['admin', 'bursar', 'registrar']), async (req, res, next) => {
  try {
    if (!(await ensureElectronicSignature(req, res))) return;
    const result = await db.query(
      `UPDATE clearances 
       SET status = 'cleared', cleared_by = $1, cleared_at = NOW(), remarks = COALESCE($2, remarks)
       WHERE id = $3 RETURNING *`,
      [req.body?.remarks || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found.' });
    await logAudit({ req, action: 'clearance.clear', entity: 'clearance', entityId: result.rows[0].id, after: result.rows[0] });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) { return next(err); }
});

// POST /api/admin/clearances/:id/reject
router.post('/:id/reject', requireRole(['admin', 'bursar', 'registrar']), async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE clearances
       SET status = 'rejected', cleared_by = NULL, cleared_at = NULL, remarks = COALESCE($1, remarks)
       WHERE id = $2 RETURNING *`,
      [req.body?.remarks || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found.' });
    await logAudit({ req, action: 'clearance.reject', entity: 'clearance', entityId: result.rows[0].id, after: result.rows[0] });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) { return next(err); }
});

// DELETE /api/admin/clearances/:id
router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM clearances WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found.' });
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

module.exports = router;