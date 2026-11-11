// ============================================================
// routes/adminSystem.js — System deploy & github status
// ============================================================
'use strict';

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimits');

// Safe require for db (handles both { query } and default exports)
let query;
try {
  const db = require('../db');
  query = db.query || db.default?.query || (async () => ({ rows: [] }));
} catch (e) {
  console.warn('[adminSystem] DB not available:', e.message);
  query = async () => ({ rows: [] });
}

// ------------------------------------------------------------
// POST /api/admin/system/deploy
// ------------------------------------------------------------
router.post('/deploy', requireAdmin, adminLimiter, async (req, res) => {
  try {
    const { branch = 'main', notes = '' } = req.body || {};

    const hookUrl = process.env.RENDER_DEPLOY_HOOK;
    if (hookUrl) {
      try {
        await fetch(hookUrl, { method: 'POST' });
      } catch (hookErr) {
        console.warn('[deploy] Hook failed:', hookErr.message);
      }
    }

    try {
      await query(
        `INSERT INTO deployments (branch, notes, status, created_at)
         VALUES ($1, $2, 'triggered', NOW())`,
        [branch, notes]
      );
    } catch (e) {
      console.debug('[deploy] Could not persist:', e.message);
    }

    res.json({
      success: true,
      message: `Deploy triggered for branch ${branch}`,
      notes,
    });
  } catch (err) {
    console.error('[adminSystem] request failed:', err?.message);
    res.status(500).json({ success: false, error: 'Unable to complete the system request.' });
  }
});

// ------------------------------------------------------------
// GET /api/admin/system/deployments
// ------------------------------------------------------------
router.get('/deployments', requireAdmin, async (req, res) => {
  try {
    let rows = [];
    try {
      const result = await query(
        `SELECT id, branch, notes, status, created_at, completed_at
         FROM deployments ORDER BY created_at DESC LIMIT 10`
      );
      rows = result.rows || [];
    } catch (e) {
      console.debug('[deployments] Query failed:', e.message);
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ------------------------------------------------------------
// GET /api/admin/system/github-status
// ------------------------------------------------------------
router.get('/github-status', requireAdmin, async (req, res) => {
  try {
    const token = process.env.GITHUB_TOKEN;
    const repo  = process.env.GITHUB_REPO;
    if (token && repo) {
      const r = await fetch(
        `https://api.github.com/repos/${repo}/commits?per_page=1`,
        { headers: { Authorization: `token ${token}`, 'User-Agent': 'FPU-Admin' } }
      );
      const commits = await r.json();
      const c = Array.isArray(commits) ? commits[0] : null;
      return res.json({
        commit: c?.sha?.slice(0, 7) || '—',
        author: c?.commit?.author?.name || '—',
        date: c?.commit?.author?.date || null,
      });
    }
    res.json({ commit: '—', author: '—', date: null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;