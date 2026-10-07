// ============================================================
// FPU — Admin settings API
// Mounted at /api/admin/settings
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const settingsQueries = require('../db/queries/settings');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

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

// Set many settings in one call (category defaults to 'general')
router.post('/bulk', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const { settings, category } = req.body || {};
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'settings object is required.' });
    }
    const rows = await settingsQueries.setMany(settings, category || 'general');
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