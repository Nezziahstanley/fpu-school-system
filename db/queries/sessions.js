// ============================================================
// FPU — Academic session + auth session queries
// Used by: routes/sessions, routes/adminAuth, utils/audit
// ============================================================

'use strict';

const { db, schema, sql } = require('..');
const { eq, and, isNull, gte, lt, desc, asc } = require('drizzle-orm');

const { academicSessions, adminSessions, userSessions } = schema;

// ------------------------------------------------------------
// ACADEMIC SESSIONS
// ------------------------------------------------------------
async function listAcademic() {
  return db.select().from(academicSessions).orderBy(desc(academicSessions.name));
}

async function findAcademicById(id) {
  if (!id) return null;
  const [row] = await db.select().from(academicSessions).where(eq(academicSessions.id, Number(id))).limit(1);
  return row || null;
}

async function findAcademicByName(name) {
  if (!name) return null;
  const [row] = await db
    .select()
    .from(academicSessions)
    .where(eq(academicSessions.name, String(name).trim()))
    .limit(1);
  return row || null;
}

async function getCurrentAcademic() {
  const [row] = await db
    .select()
    .from(academicSessions)
    .where(eq(academicSessions.isCurrent, true))
    .limit(1);
  return row || null;
}

async function createAcademic({ name, startDate, endDate, isCurrent }) {
  const [row] = await db
    .insert(academicSessions)
    .values({
      name: String(name).trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      isCurrent: !!isCurrent,
    })
    .returning();
  return row;
}

async function updateAcademic(id, patch) {
  const clean = {};
  if (patch.name !== undefined) clean.name = String(patch.name).trim();
  if (patch.startDate !== undefined) clean.startDate = patch.startDate || null;
  if (patch.endDate !== undefined) clean.endDate = patch.endDate || null;
  if (patch.isCurrent !== undefined) clean.isCurrent = !!patch.isCurrent;
  const [row] = await db.update(academicSessions).set(clean).where(eq(academicSessions.id, Number(id))).returning();
  return row || null;
}

async function setCurrentAcademic(id) {
  // Only one row may be current at a time.
  await db.update(academicSessions).set({ isCurrent: false }).where(eq(academicSessions.isCurrent, true));
  const [row] = await db
    .update(academicSessions)
    .set({ isCurrent: true })
    .where(eq(academicSessions.id, Number(id)))
    .returning();
  return row || null;
}

async function removeAcademic(id) {
  const [row] = await db.delete(academicSessions).where(eq(academicSessions.id, Number(id))).returning();
  return row || null;
}

// ------------------------------------------------------------
// ADMIN SESSIONS
// ------------------------------------------------------------
async function createAdminSession({ userId, token, userAgent, ipAddress, expiresAt }) {
  const [row] = await db
    .insert(adminSessions)
    .values({
      userId: Number(userId),
      token,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      expiresAt,
    })
    .returning();
  return row;
}

async function findAdminSession(token) {
  if (!token) return null;
  const [row] = await db
    .select()
    .from(adminSessions)
    .where(and(eq(adminSessions.token, token), isNull(adminSessions.revokedAt)))
    .limit(1);
  if (!row) return null;
  if (row.expiresAt < new Date()) return null;
  return row;
}

async function revokeAdminSession(token) {
  if (!token) return false;
  const [row] = await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessions.token, token))
    .returning({ id: adminSessions.id });
  return !!row;
}

async function revokeAllAdminSessions(userId) {
  const rows = await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(adminSessions.userId, Number(userId)), isNull(adminSessions.revokedAt)))
    .returning({ id: adminSessions.id });
  return rows.length;
}

async function purgeExpiredAdminSessions() {
  const rows = await db
    .delete(adminSessions)
    .where(lt(adminSessions.expiresAt, new Date()))
    .returning({ id: adminSessions.id });
  return rows.length;
}

// ------------------------------------------------------------
// USER SESSIONS
// ------------------------------------------------------------
async function createUserSession({ userId, token, userAgent, ipAddress, expiresAt }) {
  const [row] = await db
    .insert(userSessions)
    .values({
      userId: Number(userId),
      token,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      expiresAt,
    })
    .returning();
  return row;
}

async function findUserSession(token) {
  if (!token) return null;
  const [row] = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.token, token), isNull(userSessions.revokedAt)))
    .limit(1);
  if (!row) return null;
  if (row.expiresAt < new Date()) return null;
  return row;
}

async function revokeUserSession(token) {
  if (!token) return false;
  const [row] = await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(eq(userSessions.token, token))
    .returning({ id: userSessions.id });
  return !!row;
}

async function revokeAllUserSessions(userId) {
  const rows = await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessions.userId, Number(userId)), isNull(userSessions.revokedAt)))
    .returning({ id: userSessions.id });
  return rows.length;
}

async function purgeExpiredUserSessions() {
  const rows = await db
    .delete(userSessions)
    .where(lt(userSessions.expiresAt, new Date()))
    .returning({ id: userSessions.id });
  return rows.length;
}

// ------------------------------------------------------------
// COMPAT — routes/adminAuth.js calls revokeUserSession(token)
//            and revokeAdminSession(token) on logout.
//           routes/security.js calls revokeAllUserSessions and
//            revokeAllAdminSessions on force-logout.
// ------------------------------------------------------------

module.exports = {
  // academic
  listAcademic,
  findAcademicById,
  findAcademicByName,
  getCurrentAcademic,
  createAcademic,
  updateAcademic,
  setCurrentAcademic,
  removeAcademic,

  // admin sessions
  createAdminSession,
  findAdminSession,
  revokeAdminSession,
  revokeAllAdminSessions,
  purgeExpiredAdminSessions,

  // user sessions
  createUserSession,
  findUserSession,
  revokeUserSession,
  revokeAllUserSessions,
  purgeExpiredUserSessions,
};