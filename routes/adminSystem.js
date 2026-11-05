// ============================================================
// routes/adminSystem.js — System deploy & github status
// ============================================================
'use strict';

const express = require('express');
const router = express.Router();

const { adminAuth } = require('../middleware/adminAuth');
const { query } = require('../db');

// All routes below require admin auth
router.use(adminAuth);

// ------------------------------------------------------------
// POST /api/admin/system/deploy — Trigger deployment
// ------------------------------------------------------------
router.post('/system/deploy', async (req, res) => {
  try {
    const { branch = 'main', notes = '' } = req.body || {};

    const hookUrl = process.env.RENDER_DEPLOY_HOOK;
    if (hookUrl) {
      try {
        await fetch(hookUrl, { method: 'POST' });
      } catch (hookErr) {
        console.warn('[deploy] Hook failed:', hookErr.message);
      }
    } else {
      console.warn('[deploy] RENDER_DEPLOY_HOOK not set — skipping actual deploy');
    }

    // Persist record (ignore if table missing)
    try {
      await query(
        `INSERT INTO deployments (branch, notes, status, deployed_by, created_at)
         VALUES ($1, $2, 'triggered', $3, NOW())`,
        [branch, notes, req.user?.id || null]
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
    res.status(500).json({ success: false, error: err.message });
  }
});

// ------------------------------------------------------------
// GET /api/admin/system/deployments — Deploy history
// ------------------------------------------------------------
router.get('/system/deployments', async (req, res) => {
  try {
    let rows = [];
    try {
      const result = await query(
        `SELECT id, branch, notes, status, deployed_by, created_at, completed_at
         FROM deployments ORDER BY created_at DESC LIMIT 10`
      );
      rows = result.rows || result || [];
    } catch { rows = []; }
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ------------------------------------------------------------
// GET /api/admin/system/github-status — Latest commit
// ------------------------------------------------------------
router.get('/system/github-status', async (req, res) => {
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