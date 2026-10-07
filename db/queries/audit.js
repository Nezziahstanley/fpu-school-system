// ============================================================
// FPU — Audit + security + login-history queries
// Used by: utils/audit, routes/audit, routes/security,
//          routes/loginHistory
// ============================================================

'use strict';

const { db, schema, sql } = require('..');
const { eq, and, gte, lte, desc, asc, isNull } = require('drizzle-orm');

const { auditLogs, securityLogs, loginHistory, tokens, users } = schema;

// ============================================================
// AUDIT LOGS
// ============================================================
async function writeAudit({ userId, action, entity, entityId, before, after, ipAddress, userAgent }) {
  const [row] = await db
    .insert(auditLogs)
    .values({
      userId: userId ? Number(userId) : null,
      action,
      entity: entity || null,
      entityId: entityId !== undefined && entityId !== null ? String(entityId) : null,
      before: before || null,
      after: after || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    })
    .returning();
  return row;
}

async function listAuditWithUser({ action, entity, from, to, userId, limit = 200, offset = 0 } = {}) {
  const conds = [];
  if (action) conds.push(eq(auditLogs.action, action));
  if (entity) conds.push(eq(auditLogs.entity, entity));
  if (userId) conds.push(eq(auditLogs.userId, Number(userId)));
  if (from) conds.push(gte(auditLogs.createdAt, new Date(from)));
  if (to) conds.push(lte(auditLogs.createdAt, new Date(to)));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({ log: auditLogs, user: users })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(Number(limit))
    .offset(Number(offset));
}

async function countAudit({ action, entity, from, to } = {}) {
  const conds = [];
  if (action) conds.push(eq(auditLogs.action, action));
  if (entity) conds.push(eq(auditLogs.entity, entity));
  if (from) conds.push(gte(auditLogs.createdAt, new Date(from)));
  if (to) conds.push(lte(auditLogs.createdAt, new Date(to)));
  const where = conds.length ? and(...conds) : undefined;
  const [row] = await db.select({ c: sql`count(*)::int` }).from(auditLogs).where(where);
  return row?.c ?? 0;
}

// ============================================================
// SECURITY LOGS
// ============================================================
async function writeSecurity({ userId, event, severity, details, ipAddress, userAgent }) {
  const [row] = await db
    .insert(securityLogs)
    .values({
      userId: userId ? Number(userId) : null,
      event,
      severity: severity || 'info',
      details: details || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    })
    .returning();
  return row;
}

async function listSecurityWithUser({ severity, event, limit = 200, offset = 0 } = {}) {
  const conds = [];
  if (severity) conds.push(eq(securityLogs.severity, severity));
  if (event) conds.push(eq(securityLogs.event, event));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({ log: securityLogs, user: users })
    .from(securityLogs)
    .leftJoin(users, eq(securityLogs.userId, users.id))
    .where(where)
    .orderBy(desc(securityLogs.createdAt))
    .limit(Number(limit))
    .offset(Number(offset));
}

async function countSecurityBySeverity() {
  return db
    .select({ severity: securityLogs.severity, c: sql`count(*)::int` })
    .from(securityLogs)
    .groupBy(securityLogs.severity);
}

// ============================================================
// LOGIN HISTORY
// ============================================================
async function writeLogin({ userId, email, success, ipAddress, userAgent, reason }) {
  const [row] = await db
    .insert(loginHistory)
    .values({
      userId: userId ? Number(userId) : null,
      email: email || null,
      success: !!success,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      reason: reason || null,
    })
    .returning();
  return row;
}

async function listLogins({ userId, email, success, limit = 200, offset = 0 } = {}) {
  const conds = [];
  if (userId) conds.push(eq(loginHistory.userId, Number(userId)));
  if (email) conds.push(sql`lower(${loginHistory.email}) = lower(${email})`);
  if (success !== undefined) conds.push(eq(loginHistory.success, !!success));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select()
    .from(loginHistory)
    .where(where)
    .orderBy(desc(loginHistory.createdAt))
    .limit(Number(limit))
    .offset(Number(offset));
}

async function listLoginsWithUser({ success, limit = 200 } = {}) {
  const conds = [];
  if (success !== undefined) conds.push(eq(loginHistory.success, !!success));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({ entry: loginHistory, user: users })
    .from(loginHistory)
    .leftJoin(users, eq(loginHistory.userId, users.id))
    .where(where)
    .orderBy(desc(loginHistory.createdAt))
    .limit(Number(limit));
}

// ============================================================
// TOKENS (email verification / password reset)
// ============================================================
async function createToken({ email, token, purpose, expiresAt, userId }) {
  const [row] = await db
    .insert(tokens)
    .values({
      userId: userId ? Number(userId) : null,
      email: email ? String(email).trim().toLowerCase() : null,
      token,
      purpose,
      expiresAt,
    })
    .returning();
  return row;
}

async function findToken(token) {
  if (!token) return null;
  const [row] = await db.select().from(tokens).where(eq(tokens.token, token)).limit(1);
  if (!row) return null;
  if (row.expiresAt < new Date()) return null;
  if (row.usedAt) return null;
  return row;
}

async function markTokenUsed(id) {
  const [row] = await db
    .update(tokens)
    .set({ usedAt: new Date() })
    .where(eq(tokens.id, Number(id)))
    .returning({ id: tokens.id });
  return !!row;
}

async function purgeExpiredTokens() {
  const rows = await db
    .delete(tokens)
    .where(lte(tokens.expiresAt, new Date()))
    .returning({ id: tokens.id });
  return rows.length;
}

module.exports = {
  // audit
  writeAudit,
  listAuditWithUser,
  countAudit,

  // security
  writeSecurity,
  listSecurityWithUser,
  countSecurityBySeverity,

  // login history
  writeLogin,
  listLogins,
  listLoginsWithUser,

  // tokens
  createToken,
  findToken,
  markTokenUsed,
  purgeExpiredTokens,
};