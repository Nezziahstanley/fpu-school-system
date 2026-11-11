// ============================================================
// FPU — Health & ping endpoints (public)
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const { ping } = require('../db');
const { isEmailEnabled } = require('../utils/emailService');

const BOOT_TIME = Date.now();

// ------------------------------------------------------------
// GET /api/health
// ------------------------------------------------------------
router.get('/health', async (_req, res) => {
  let dbOk = false;
  try {
    dbOk = await ping();
  } catch (err) {
    // Keep diagnostic details in server logs, not in the public response.
    console.error('[health] database ping failed:', err?.message);
  }

  return res.status(dbOk ? 200 : 503).json({
    success: dbOk,
    app: 'FPU School Management System',
    uptimeSeconds: Math.round((Date.now() - BOOT_TIME) / 1000),
    now: new Date().toISOString(),
    db: dbOk ? 'up' : 'down',
    email: isEmailEnabled() ? 'enabled' : 'disabled',
  });
});

// ------------------------------------------------------------
// GET /api/ping
// ------------------------------------------------------------
router.get('/ping', (_req, res) => res.json({ pong: true, t: Date.now() }));

module.exports = router;