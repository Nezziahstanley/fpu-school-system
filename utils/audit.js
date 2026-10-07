// ============================================================
// FPU — Audit + security logging helpers
// ------------------------------------------------------------
// Thin wrappers around db/queries/audit.js that never throw —
// logging failures must not break the request.
// ============================================================

'use strict';

const auditQueries = require('../db/queries/audit');

// ------------------------------------------------------------
// Extract IP / UA from an Express request safely.
// ------------------------------------------------------------
function contextFromReq(req) {
  if (!req) return { ipAddress: null, userAgent: null, userId: null };
  const forwarded = req.headers?.['x-forwarded-for'];
  const ip =
    (typeof forwarded === 'string' && forwarded.split(',')[0].trim()) ||
    req.ip ||
    req.socket?.remoteAddress ||
    null;
  const userAgent = req.headers?.['user-agent'] || null;
  const userId = req.user?.id || null;
  return { ipAddress: ip, userAgent, userId };
}

// ------------------------------------------------------------
// Write an audit log entry. Never throws.
// ------------------------------------------------------------
async function logAudit({
  req = null,
  userId = null,
  action,
  entity = null,
  entityId = null,
  before = null,
  after = null,
} = {}) {
  try {
    const ctx = contextFromReq(req);
    await auditQueries.writeAudit({
      userId: userId || ctx.userId,
      action,
      entity,
      entityId,
      before,
      after,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to log:', err.message);
  }
}

// ------------------------------------------------------------
// Write a security log entry. Never throws.
// ------------------------------------------------------------
async function logSecurity({
  req = null,
  userId = null,
  event,
  severity = 'info',
  details = null,
} = {}) {
  try {
    const ctx = contextFromReq(req);
    await auditQueries.writeSecurity({
      userId: userId || ctx.userId,
      event,
      severity,
      details,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[security] failed to log:', err.message);
  }
}

// ------------------------------------------------------------
// Write a login-history entry. Never throws.
// ------------------------------------------------------------
async function logLogin({
  req = null,
  userId = null,
  email = null,
  success = true,
  reason = null,
} = {}) {
  try {
    const ctx = contextFromReq(req);
    await auditQueries.writeLogin({
      userId: userId || ctx.userId,
      email,
      success,
      reason,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[login-history] failed to log:', err.message);
  }
}

module.exports = {
  contextFromReq,
  logAudit,
  logSecurity,
  logLogin,
};