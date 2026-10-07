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
  let dbError = null;
  try {
    dbOk = await ping();
  } catch (err) {
    dbError = err.message;
  }

  return res.json({
    success: true,
    app: 'FPU School Management System',
    env: process.env.NODE_ENV || 'development',
    uptimeSeconds: Math.round((Date.now() - BOOT_TIME) / 1000),
    now: new Date().toISOString(),
    db: dbOk ? 'up' : 'down',
    dbError,
    email: isEmailEnabled() ? 'enabled' : 'disabled',
  });
});

// ------------------------------------------------------------
// GET /api/ping
// ------------------------------------------------------------
router.get('/ping', (_req, res) => res.json({ pong: true, t: Date.now() }));

module.exports = router;