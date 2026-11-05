// ============================================================
// routes/adminSystem.js — System health, deploy, backups
// ============================================================
'use strict';

const express = require('express');
const router = express.Router();

const { adminAuth } = require('../middleware/adminAuth');
const { query } = require('../db');

// ------------------------------------------------------------
// GET /api/health — Public health check (also used by System tab)
// ------------------------------------------------------------
router.get('/health', (req, res) => {
  res.json({
    app: 'FPU School Management System',
    version: process.env.APP_VERSION || '1.0.0',
    env: process.env.NODE_ENV || 'production',
    node: process.version,
    uptime: Math.floor(process.uptime()) + 's',
    lastDeploy: process.env.LAST_DEPLOY || null,
  });
});

// ------------------------------------------------------------
// Everything below requires admin auth
// ------------------------------------------------------------
router.use(adminAuth);

// ------------------------------------------------------------
// POST /api/admin/system/deploy — Trigger a deployment
// ------------------------------------------------------------
router.post('/admin/system/deploy', async (req, res) => {
  try {
    const { branch = 'main', notes = '' } = req.body || {};

    // Render deploy hook (set via env var)
    const hookUrl = process.env.RENDER_DEPLOY_HOOK;
    if (hookUrl) {
      await fetch(hookUrl, { method: 'POST' });
    }

    // Optionally persist the deploy record to a table
    try {
      await query(
        `INSERT INTO deployments (branch, notes, status, deployed_by, created_at)
         VALUES ($1, $2, 'triggered', $3, NOW())`,
        [branch, notes, req.user?.id || null]
      );
    } catch (e) {
      // Table might not exist yet — ignore
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
// GET /api/admin/system/deployments — Recent deploy history
// ------------------------------------------------------------
router.get('/admin/system/deployments', async (req, res) => {
  try {
    let rows = [];
    try {
      const result = await query(
        `SELECT * FROM deployments ORDER BY created_at DESC LIMIT 10`
      );
      rows = result.rows || result || [];
    } catch { rows = []; }
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ------------------------------------------------------------
// GET /api/admin/system/github-status — Latest commit info
// ------------------------------------------------------------
router.get('/admin/system/github-status', async (req, res) => {
  try {
    // Optional: fetch from GitHub API if GITHUB_TOKEN is set
    const token = process.env.GITHUB_TOKEN;
    const repo  = process.env.GITHUB_REPO; // e.g. "user/fpu-school-system"
    if (token && repo) {
      const r = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, {
        headers: { Authorization: `token ${token}` },
      });
      const commits = await r.json();
      const c = commits[0];
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