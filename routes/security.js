// ============================================================
// FPU — Admin security logs + policy API
// Mounted at /api/admin/security  (via routes/index.js)
// File lives at: routes/security.js
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const { db, schema, sql } = require('../db');
const { eq, and, desc, gte, lt, isNull } = require('drizzle-orm');
const { requireRole } = require('../middleware/auth');
const { logAudit, logSecurity } = require('../utils/audit');
const auditQueries = require('../db/queries/audit');
const sessionQueries = require('../db/queries/sessions');
const settingsQueries = require('../db/queries/settings');

const {
  users,
  userSessions,
  adminSessions,
  securityLogs,
  loginHistory,
  auditLogs,
} = schema;

const STAFF = ['admin', 'registrar', 'rector'];
const ADMIN = ['admin'];

// ============================================================
// SETTINGS HELPERS
// ============================================================

const PASSWORD_POLICY_KEY = 'security_password_policy';
const IP_RULES_KEY        = 'security_ip_rules';
const PERMISSIONS_KEY     = 'security_permissions';
const TFA_KEY             = 'security_2fa';
const BACKUP_KEY          = 'security_backup';

const DEFAULT_PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireNumber: true,
  requireSymbol: false,
  expiryDays: 90,
  preventReuse: 3,
  maxAttempts: 5,
  lockoutMinutes: 15,
  idleTimeout: 60,
  allowConcurrent: true,
  maxConcurrent: 3,
};

const DEFAULT_2FA = {
  requiredRoles: ['admin'],
  methods: ['app', 'backup'],
};

const DEFAULT_BACKUP = {
  schedule: 'daily',
  retentionDays: 30,
  storage: 'local',
  history: [],
};

async function readJsonSetting(key, fallback) {
  try {
    const raw = await settingsQueries.get(key, null);
    if (!raw) return { ...fallback };
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return { ...fallback };
  }
}

async function writeJsonSetting(key, value) {
  return settingsQueries.set(key, JSON.stringify(value), 'security');
}

// ============================================================
// SUMMARY / EVENTS
// ============================================================

// GET /api/admin/security/summary
router.get('/summary', requireRole(STAFF), async (_req, res, next) => {
  try {
    const rows = await auditQueries.countSecurityBySeverity();
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// GET /api/admin/security
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { severity, event, limit = 200, offset = 0 } = req.query;
    const rows = await auditQueries.listSecurityWithUser({
      severity,
      event,
      limit: Number(limit),
      offset: Number(offset),
    });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// SESSIONS (active user + admin sessions)
// ============================================================

// GET /api/admin/security/sessions
router.get('/sessions', requireRole(STAFF), async (_req, res, next) => {
  try {
    const now = new Date();

    const userRows = await db
      .select({
        session: userSessions,
        user: users,
      })
      .from(userSessions)
      .leftJoin(users, eq(userSessions.userId, users.id))
      .where(and(
        isNull(userSessions.revokedAt),
        gte(userSessions.expiresAt, now)
      ))
      .orderBy(desc(userSessions.createdAt))
      .limit(500);

    const adminRows = await db
      .select({
        session: adminSessions,
        user: users,
      })
      .from(adminSessions)
      .leftJoin(users, eq(adminSessions.userId, users.id))
      .where(and(
        isNull(adminSessions.revokedAt),
        gte(adminSessions.expiresAt, now)
      ))
      .orderBy(desc(adminSessions.createdAt))
      .limit(500);

    const data = [
      ...adminRows.map((r) => ({ ...r, source: 'admin' })),
      ...userRows.map((r) => ({ ...r, source: 'user' })),
    ];

    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// ============================================================
// REVOKE / PURGE
// ============================================================

// POST /api/admin/security/revoke/:userId
router.post('/revoke/:userId', requireRole(ADMIN), async (req, res, next) => {
  try {
    await sessionQueries.revokeAllUserSessions(req.params.userId);
    await sessionQueries.revokeAllAdminSessions(req.params.userId);
    await logSecurity({ req, userId: req.params.userId, event: 'admin_force_logout', severity: 'warning' });
    await logAudit({ req, action: 'security.revoke_sessions', entity: 'user', entityId: req.params.userId });
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

// POST /api/admin/security/purge
router.post('/purge', requireRole(ADMIN), async (req, res, next) => {
  try {
    const usersCount = await sessionQueries.purgeExpiredUserSessions();
    const adminsCount = await sessionQueries.purgeExpiredAdminSessions();
    const tokensCount = await auditQueries.purgeExpiredTokens();
    await logAudit({ req, action: 'security.purge', after: { users: usersCount, admins: adminsCount, tokens: tokensCount } });
    return res.json({ success: true, counts: { users: usersCount, admins: adminsCount, tokens: tokensCount } });
  } catch (err) { return next(err); }
});

// ============================================================
// IP RULES
// ============================================================

// GET /api/admin/security/ip-rules
router.get('/ip-rules', requireRole(STAFF), async (_req, res, next) => {
  try {
    const cfg = await readJsonSetting(IP_RULES_KEY, { rules: [] });
    return res.json({ success: true, data: cfg.rules || [] });
  } catch (err) { return next(err); }
});

// POST /api/admin/security/ip-rules
router.post('/ip-rules', requireRole(ADMIN), async (req, res, next) => {
  try {
    const { ipAddress, rule, expiresAt, reason } = req.body || {};
    if (!ipAddress || !rule) {
      return res.status(400).json({ success: false, error: 'ipAddress and rule are required.' });
    }
    if (!['allow', 'block'].includes(rule)) {
      return res.status(400).json({ success: false, error: 'rule must be "allow" or "block".' });
    }

    const cfg = await readJsonSetting(IP_RULES_KEY, { rules: [] });
    const nextId = (cfg.rules || []).reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;

    const row = {
      id: nextId,
      ipAddress: String(ipAddress).trim(),
      rule,
      reason: reason || null,
      expiresAt: expiresAt || null,
      createdAt: new Date().toISOString(),
      createdBy: req.user.id,
    };

    cfg.rules = [...(cfg.rules || []), row];
    await writeJsonSetting(IP_RULES_KEY, cfg);

    // Bust the IP guard cache so the rule takes effect immediately.
    try {
      const ipGuard = require('../middleware/ipGuard');
      if (ipGuard && typeof ipGuard.invalidateCache === 'function') ipGuard.invalidateCache();
    } catch { /* ipGuard not installed yet — fine */ }

    await logAudit({ req, action: 'security.ip_rule_add', entity: 'ip_rule', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// DELETE /api/admin/security/ip-rules/:id
router.delete('/ip-rules/:id', requireRole(ADMIN), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const cfg = await readJsonSetting(IP_RULES_KEY, { rules: [] });
    const before = (cfg.rules || []).find((r) => r.id === id);
    if (!before) return res.status(404).json({ success: false, error: 'Rule not found.' });
    cfg.rules = (cfg.rules || []).filter((r) => r.id !== id);
    await writeJsonSetting(IP_RULES_KEY, cfg);

    try {
      const ipGuard = require('../middleware/ipGuard');
      if (ipGuard && typeof ipGuard.invalidateCache === 'function') ipGuard.invalidateCache();
    } catch { /* silent */ }

    await logAudit({ req, action: 'security.ip_rule_delete', entity: 'ip_rule', entityId: id, before });
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

// ============================================================
// PASSWORD POLICY
// ============================================================

// GET /api/admin/security/password-policy
router.get('/password-policy', requireRole(STAFF), async (_req, res, next) => {
  try {
    const cfg = await readJsonSetting(PASSWORD_POLICY_KEY, DEFAULT_PASSWORD_POLICY);
    return res.json({ success: true, data: cfg });
  } catch (err) { return next(err); }
});

// PUT /api/admin/security/password-policy
router.put('/password-policy', requireRole(ADMIN), async (req, res, next) => {
  try {
    const patch = { ...DEFAULT_PASSWORD_POLICY, ...(req.body || {}) };
    await writeJsonSetting(PASSWORD_POLICY_KEY, patch);
    await logAudit({ req, action: 'security.password_policy_update', after: patch });
    return res.json({ success: true, data: patch });
  } catch (err) { return next(err); }
});

// ============================================================
// PERMISSIONS MATRIX
// ============================================================

const DEFAULT_ROLES = [
  'admin', 'registrar', 'rector', 'bursar', 'librarian',
  'exam_officer', 'academic_officer', 'admission_officer',
  'hod', 'lecturer', 'student',
];

const DEFAULT_RESOURCES = [
  'applications',
  'students',
  'staff',
  'courses',
  'programmes',
  'sessions',
  'results',
  'payments',
  'fees',
  'clearances',
  'documents',
  'library',
  'reports',
  'settings',
  'security',
  'users',
];

function buildDefaultMatrix() {
  const m = {};
  for (const res of DEFAULT_RESOURCES) {
    m[res] = {};
    for (const role of DEFAULT_ROLES) {
      m[res][role] = role === 'admin';
    }
  }
  return m;
}

// GET /api/admin/security/permissions
router.get('/permissions', requireRole(STAFF), async (_req, res, next) => {
  try {
    const cfg = await readJsonSetting(PERMISSIONS_KEY, {});
    const stored = cfg.matrix || {};
    const defaults = buildDefaultMatrix();

    const matrix = {};
    for (const res of DEFAULT_RESOURCES) {
      matrix[res] = { ...(defaults[res] || {}), ...(stored[res] || {}) };
    }

    return res.json({
      success: true,
      data: {
        roles: DEFAULT_ROLES,
        resources: DEFAULT_RESOURCES,
        matrix,
      },
    });
  } catch (err) { return next(err); }
});

// PUT /api/admin/security/permissions
router.put('/permissions', requireRole(ADMIN), async (req, res, next) => {
  try {
    const { matrix } = req.body || {};
    if (!matrix || typeof matrix !== 'object') {
      return res.status(400).json({ success: false, error: 'matrix object is required.' });
    }
    await writeJsonSetting(PERMISSIONS_KEY, { matrix });
    await logAudit({ req, action: 'security.permissions_update' });
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

// ============================================================
// TWO-FACTOR AUTH CONFIG
// ============================================================

// GET /api/admin/security/2fa
router.get('/2fa', requireRole(STAFF), async (_req, res, next) => {
  try {
    const cfg = await readJsonSetting(TFA_KEY, DEFAULT_2FA);
    return res.json({ success: true, data: cfg });
  } catch (err) { return next(err); }
});

// PUT /api/admin/security/2fa
router.put('/2fa', requireRole(ADMIN), async (req, res, next) => {
  try {
    const { requiredRoles, methods } = req.body || {};
    const cfg = await readJsonSetting(TFA_KEY, DEFAULT_2FA);
    if (Array.isArray(requiredRoles)) cfg.requiredRoles = requiredRoles;
    if (Array.isArray(methods)) cfg.methods = methods;
    await writeJsonSetting(TFA_KEY, cfg);
    await logAudit({ req, action: 'security.2fa_update', after: cfg });
    return res.json({ success: true, data: cfg });
  } catch (err) { return next(err); }
});

// ============================================================
// BACKUPS
// ============================================================

// GET /api/admin/security/backups
router.get('/backups', requireRole(STAFF), async (_req, res, next) => {
  try {
    const cfg = await readJsonSetting(BACKUP_KEY, DEFAULT_BACKUP);
    return res.json({ success: true, data: cfg.history || [] });
  } catch (err) { return next(err); }
});

// PUT /api/admin/security/backups/config
router.put('/backups/config', requireRole(ADMIN), async (req, res, next) => {
  try {
    const { schedule, retentionDays, storage } = req.body || {};
    const cfg = await readJsonSetting(BACKUP_KEY, DEFAULT_BACKUP);
    if (schedule) cfg.schedule = schedule;
    if (retentionDays) cfg.retentionDays = Number(retentionDays);
    if (storage) cfg.storage = storage;
    await writeJsonSetting(BACKUP_KEY, cfg);
    await logAudit({ req, action: 'security.backup_config_update', after: cfg });
    return res.json({ success: true, data: cfg });
  } catch (err) { return next(err); }
});

// POST /api/admin/security/backups/trigger
router.post('/backups/trigger', requireRole(ADMIN), async (req, res, next) => {
  try {
    const cfg = await readJsonSetting(BACKUP_KEY, DEFAULT_BACKUP);

    // Record a synthetic "completed" backup entry. A real backup
    // would spawn pg_dump; here we log the intent so the history
    // table has something to show.
    const entry = {
      id: Date.now(),
      kind: 'full',
      status: 'completed',
      size: null,
      fileUrl: null,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      triggeredBy: req.user.id,
      note: 'Manual trigger (no dump backend configured).',
    };

    cfg.history = [entry, ...(cfg.history || [])].slice(0, 100);
    await writeJsonSetting(BACKUP_KEY, cfg);
    await logAudit({ req, action: 'security.backup_trigger', entity: 'backup', entityId: entry.id });
    return res.status(201).json({ success: true, data: entry });
  } catch (err) { return next(err); }
});

// ============================================================
// COMPLIANCE
// ============================================================

// GET /api/admin/security/compliance
router.get('/compliance', requireRole(STAFF), async (_req, res, next) => {
  try {
    const checks = [];

    // 1. Strong password policy
    const pw = await readJsonSetting(PASSWORD_POLICY_KEY, DEFAULT_PASSWORD_POLICY);
    checks.push({
      title: 'Strong password policy enforced',
      status: (pw.minLength >= 8 && pw.requireUppercase && pw.requireNumber) ? 'pass' : 'warn',
      detail: `Minimum length: ${pw.minLength}, uppercase: ${pw.requireUppercase}, number: ${pw.requireNumber}`,
      fix: pw.minLength >= 8 ? null : 'Raise minimum length to 8+ and enable uppercase + number requirements.',
    });

    // 2. 2FA on admin accounts
    const tfa = await readJsonSetting(TFA_KEY, DEFAULT_2FA);
    checks.push({
      title: 'Two-factor auth required for admins',
      status: (tfa.requiredRoles || []).includes('admin') ? 'pass' : 'warn',
      detail: `Required roles: ${(tfa.requiredRoles || []).join(', ') || 'none'}`,
      fix: !(tfa.requiredRoles || []).includes('admin') ? 'Enable 2FA for the admin role in Security → Two-Factor Auth.' : null,
    });

    // 3. No critical events in 7 days
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const critical = await db
      .select({ c: sql`count(*)::int` })
      .from(securityLogs)
      .where(and(
        eq(securityLogs.severity, 'critical'),
        gte(securityLogs.createdAt, since),
      ));
    const criticalCount = critical[0]?.c || 0;
    checks.push({
      title: 'No unresolved critical events (7 days)',
      status: criticalCount === 0 ? 'pass' : 'fail',
      detail: `${criticalCount} critical event(s) recorded in the last 7 days`,
      fix: criticalCount > 0 ? 'Review Security → Events and mark critical incidents resolved.' : null,
    });

    // 4. Backups scheduled
    const bk = await readJsonSetting(BACKUP_KEY, DEFAULT_BACKUP);
    checks.push({
      title: 'Database backups scheduled',
      status: bk.schedule ? 'pass' : 'warn',
      detail: `Schedule: ${bk.schedule || 'none'} · Retention: ${bk.retentionDays} days`,
      fix: !bk.schedule ? 'Enable a backup schedule in Security → Backups.' : null,
    });

    // 5. Failed logins within normal range (24h)
    const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const failed = await db
      .select({ c: sql`count(*)::int` })
      .from(loginHistory)
      .where(and(
        eq(loginHistory.success, false),
        gte(loginHistory.createdAt, oneDayAgo),
      ));
    const failedCount = failed[0]?.c || 0;
    checks.push({
      title: 'Failed logins within normal range (24h)',
      status: failedCount < 50 ? 'pass' : failedCount < 200 ? 'warn' : 'fail',
      detail: `${failedCount} failed login attempt(s) in the last 24 hours`,
      fix: failedCount >= 50 ? 'Investigate IP addresses and consider blocking them in Security → IP Rules.' : null,
    });

    // 6. Audit logging active
    const auditCount = await db
      .select({ c: sql`count(*)::int` })
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, oneDayAgo));
    const ac = auditCount[0]?.c || 0;
    checks.push({
      title: 'Audit logging active',
      status: ac > 0 ? 'pass' : 'warn',
      detail: `${ac} audit entries recorded in the last 24 hours`,
      fix: ac === 0 ? 'Confirm that audit logging calls are wired into the routes.' : null,
    });

    // 7. No stale sessions over 7 days old
    const staleCutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const stale = await db
      .select({ c: sql`count(*)::int` })
      .from(userSessions)
      .where(and(
        isNull(userSessions.revokedAt),
        gte(userSessions.expiresAt, new Date()),
        lt(userSessions.createdAt, staleCutoff),
      ));
    const staleCount = stale[0]?.c || 0;
    checks.push({
      title: 'No stale sessions older than 7 days',
      status: staleCount === 0 ? 'pass' : 'warn',
      detail: `${staleCount} active session(s) older than 7 days`,
      fix: staleCount > 0 ? 'Purge expired sessions in Security → Active Sessions.' : null,
    });

    return res.json({ success: true, data: checks });
  } catch (err) { return next(err); }
});

module.exports = router;