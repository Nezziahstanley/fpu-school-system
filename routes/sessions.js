// ============================================================
// FPU — Admin academic-sessions API
// Mounted at /api/admin/sessions
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const sessionQueries = require('../db/queries/sessions');
const { db, schema, sql } = require('../db');
const { eq } = require('drizzle-orm');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const { users } = schema;

const STAFF = ['admin', 'registrar', 'academic_officer', 'rector'];

// ------------------------------------------------------------
// GET /api/admin/sessions
// Returns each session with its enrolled student count.
// ------------------------------------------------------------
router.get('/', requireRole(STAFF), async (_req, res, next) => {
  try {
    const rows = await sessionQueries.listAcademic();

    // Count students per session (using users.currentSessionId)
    const counts = await db
      .select({
        currentSessionId: users.currentSessionId,
        c: sql`count(*)::int`,
      })
      .from(users)
      .where(eq(users.role, 'student'))
      .groupBy(users.currentSessionId);

    const countMap = new Map(counts.map((r) => [r.currentSessionId, r.c]));

    const data = rows.map((s) => ({
      ...s,
      studentsCount: countMap.get(s.id) || 0,
    }));

    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/sessions/current
// ------------------------------------------------------------
router.get('/current', requireRole(STAFF), async (_req, res, next) => {
  try {
    const row = await sessionQueries.getCurrentAcademic();
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// POST /api/admin/sessions
// ------------------------------------------------------------
router.post('/', requireRole(['admin', 'registrar', 'academic_officer']), async (req, res, next) => {
  try {
    const { name, startDate, endDate, isCurrent } = req.body || {};
    if (!name) return res.status(400).json({ success: false, error: 'name is required.' });

    if (!/^\d{4}\/\d{4}$/.test(String(name).trim())) {
      return res.status(400).json({
        success: false,
        error: 'Session name must be in the format YYYY/YYYY (e.g. 2026/2027).',
      });
    }

    // Prevent duplicates
    const existing = await sessionQueries.findAcademicByName(name);
    if (existing) {
      return res.status(409).json({ success: false, error: 'A session with this name already exists.' });
    }

    const row = await sessionQueries.createAcademic({
      name,
      startDate: startDate || null,
      endDate: endDate || null,
      isCurrent: !!isCurrent,
    });

    if (isCurrent) await sessionQueries.setCurrentAcademic(row.id);

    await logAudit({
      req,
      action: 'session.create',
      entity: 'academic_session',
      entityId: row.id,
      after: row,
    });

    return res.status(201).json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/sessions/:id
// Must come AFTER /current
// ------------------------------------------------------------
router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await sessionQueries.findAcademicById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Session not found.' });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// PUT /api/admin/sessions/:id
// ------------------------------------------------------------
router.put('/:id', requireRole(['admin', 'registrar', 'academic_officer']), async (req, res, next) => {
  try {
    const existing = await sessionQueries.findAcademicById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Session not found.' });

    const patch = { ...req.body };
    delete patch.id;

    if (patch.name && !/^\d{4}\/\d{4}$/.test(String(patch.name).trim())) {
      return res.status(400).json({
        success: false,
        error: 'Session name must be in the format YYYY/YYYY.',
      });
    }

    // Prevent duplicate name (excluding self)
    if (patch.name && patch.name !== existing.name) {
      const dup = await sessionQueries.findAcademicByName(patch.name);
      if (dup && dup.id !== existing.id) {
        return res.status(409).json({ success: false, error: 'Another session already uses this name.' });
      }
    }

    const row = await sessionQueries.updateAcademic(existing.id, patch);
    if (patch.isCurrent) await sessionQueries.setCurrentAcademic(existing.id);

    await logAudit({
      req,
      action: 'session.update',
      entity: 'academic_session',
      entityId: existing.id,
      before: existing,
      after: row,
    });

    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// POST /api/admin/sessions/:id/set-current
// ------------------------------------------------------------
router.post('/:id/set-current', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const existing = await sessionQueries.findAcademicById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Session not found.' });

    const row = await sessionQueries.setCurrentAcademic(existing.id);

    await logAudit({
      req,
      action: 'session.set_current',
      entity: 'academic_session',
      entityId: row.id,
    });

    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// DELETE /api/admin/sessions/:id
// Refuses to delete the current session.
// ------------------------------------------------------------
router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const existing = await sessionQueries.findAcademicById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Session not found.' });

    if (existing.isCurrent) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the current session. Set another session as current first.',
      });
    }

    await sessionQueries.removeAcademic(existing.id);
    await logAudit({
      req,
      action: 'session.delete',
      entity: 'academic_session',
      entityId: existing.id,
      before: existing,
    });

    return res.json({ success: true });
  } catch (err) { return next(err); }
});

module.exports = router;