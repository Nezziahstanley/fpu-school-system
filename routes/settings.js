// ============================================================
// FPU — Admin settings API
// Mounted at /api/admin/settings
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const settingsQueries = require('../db/queries/settings');
const { db, schema } = require('../db');
const { eq } = require('drizzle-orm');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const { academicSessions } = schema;

const STAFF = ['admin', 'registrar', 'rector', 'academic_officer', 'bursar', 'hod'];

router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { category } = req.query;
    const rows = await settingsQueries.getAll({ category });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/institution', requireRole(STAFF), async (_req, res, next) => {
  try {
    const inst = await settingsQueries.getInstitution();
    return res.json({ success: true, data: inst });
  } catch (err) {
    return next(err);
  }
});

router.get('/banks', requireRole(STAFF), async (_req, res, next) => {
  try {
    const banks = await settingsQueries.getBankAccounts();
    return res.json({ success: true, data: banks });
  } catch (err) {
    return next(err);
  }
});

// GET a single setting by key
router.get('/:key', requireRole(STAFF), async (req, res, next) => {
  try {
    const value = await settingsQueries.get(req.params.key, null);
    return res.json({ success: true, key: req.params.key, value });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /bulk — Save many settings at once
// ✅ Syncs current_session → academic_sessions.isCurrent
// ============================================================
router.post('/bulk', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const { settings, category } = req.body || {};
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'settings object is required.' });
    }

    // 1. Save all settings to the settings table
    const rows = await settingsQueries.setMany(settings, category || 'general');

    // 2. ✅ If current_session was updated, sync academic_sessions.isCurrent
    const newCurrentSession = settings.current_session;
    if (newCurrentSession && typeof newCurrentSession === 'string' && newCurrentSession.trim()) {
      try {
        // Unset all sessions
        await db
          .update(academicSessions)
          .set({ isCurrent: false })
          .where(eq(academicSessions.isCurrent, true));

        // Set the new current session
        const [updated] = await db
          .update(academicSessions)
          .set({ isCurrent: true })
          .where(eq(academicSessions.name, newCurrentSession.trim()))
          .returning();

        if (!updated) {
          console.warn(`[settings] current_session "${newCurrentSession}" not found in academic_sessions table.`);
        }
      } catch (syncErr) {
        console.error('[settings] session sync failed:', syncErr.message);
        // Don't fail the whole request if sync fails — just log it
      }
    }

    // 3. Audit log
    await logAudit({ req, action: 'settings.bulk_update', after: settings });

    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// Set a single key
router.put('/:key', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const { value, category } = req.body || {};
    const row = await settingsQueries.set(req.params.key, value, category || 'general');

    // ✅ If this single update is current_session, sync academic_sessions
    if (req.params.key === 'current_session' && value && typeof value === 'string') {
      try {
        await db
          .update(academicSessions)
          .set({ isCurrent: false })
          .where(eq(academicSessions.isCurrent, true));
        await db
          .update(academicSessions)
          .set({ isCurrent: true })
          .where(eq(academicSessions.name, value.trim()));
      } catch (syncErr) {
        console.error('[settings] session sync failed:', syncErr.message);
      }
    }

    await logAudit({ req, action: 'settings.update', entity: 'setting', entityId: req.params.key, after: { value } });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:key', requireRole(['admin']), async (req, res, next) => {
  try {
    const row = await settingsQueries.removeSetting(req.params.key);
    if (!row) return res.status(404).json({ success: false, error: 'Setting not found.' });
    await logAudit({ req, action: 'settings.delete', entity: 'setting', entityId: req.params.key, before: row });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;