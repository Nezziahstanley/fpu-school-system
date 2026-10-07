// ============================================================
// FPU — Admin seed endpoints (guarded)
// ------------------------------------------------------------
// Locked behind a shared secret in the header:
//     x-seed-secret: <SEED_SECRET>
// AND disabled in production, regardless of secret.
// If SEED_SECRET is unset, the routes are disabled.
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

function requireSeedSecret(req, res, next) {
  // Hard kill switch in production
  if (isProduction) {
    return res.status(404).json({ success: false, error: 'Seed endpoints are disabled.' });
  }

  const secret = process.env.SEED_SECRET;
  if (!secret) {
    return res.status(404).json({ success: false, error: 'Seed endpoints are disabled.' });
  }

  const provided = req.headers['x-seed-secret'];
  if (provided !== secret) {
    return res.status(403).json({ success: false, error: 'Forbidden.' });
  }

  return next();
}

function runScript(name) {
  return new Promise((resolve) => {
    const file = path.join(__dirname, '..', '..', 'scripts', `${name}.js`);
    exec(`node "${file}"`, { timeout: 10 * 60 * 1000 }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        exitCode: err ? err.code || 1 : 0,
        stdout: stdout ? stdout.slice(-4000) : '',
        stderr: stderr ? stderr.slice(-4000) : '',
      });
    });
  });
}

// ------------------------------------------------------------
// POST /api/admin/seed/run  { script: "seed-massive" }
// ------------------------------------------------------------
router.post('/run', requireSeedSecret, async (req, res) => {
  const { script } = req.body || {};
  const allowed = ['seed-massive', 'seed-bank-details', 'reset-staff-passwords'];
  if (!allowed.includes(script)) {
    return res.status(400).json({ success: false, error: `script must be one of: ${allowed.join(', ')}` });
  }
  const result = await runScript(script);
  return res.status(result.ok ? 200 : 500).json({ success: result.ok, script, result });
});

module.exports = router;