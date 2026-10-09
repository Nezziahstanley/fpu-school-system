// ============================================================
// FPU — Query helper: sessions (academic, user, admin)
// ============================================================

'use strict';

const { db, sql, schema } = require('../index');
const { eq, and, or, desc, asc, isNull, gt, lt } = require('drizzle-orm');

const {
  academicSessions, userSessions, adminSessions, users,
} = schema;

// ============================================================
// ACADEMIC SESSIONS
// ============================================================

async function listAcademic() {
  return db.select().from(academicSessions).orderBy(desc(academicSessions.startDate));
}

async function findAcademicById(id) {
  if (!id) return null;
  const [row] = await db
    .select()
    .from(academicSessions)
    .where(eq(academicSessions.id, Number(id)))
    .limit(1);
  return row || null;
}

async function findAcademicByName(name) {
  if (!name) return null;
  const [row] = await db
    .select()
    .from(academicSessions)
    .where(eq(academicSessions.name, String(name)))
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

async function createAcademic(data) {
  const [row] = await db
    .insert(academicSessions)
    .values({
      name: data.name,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      isCurrent: !!data.isCurrent,
    })
    .returning();
  return row;
}

async function updateAcademic(id, patch) {
  const allowed = ['name', 'startDate', 'endDate', 'isCurrent'];
  const clean = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) clean[k] = patch[k];
  }
  const [row] = await db
    .update(academicSessions)
    .set(clean)
    .where(eq(academicSessions.id, Number(id)))
    .returning();
  return row || null;
}

async function setCurrentAcademic(id) {
  // Unset all
  await db.update(academicSessions).set({ isCurrent: false });
  // Set the new one
  const [row] = await db
    .update(academicSessions)
    .set({ isCurrent: true })
    .where(eq(academicSessions.id, Number(id)))
    .returning();
  return row || null;
}

async function removeAcademic(id) {
  const [row] = await db
    .delete(academicSessions)
    .where(eq(academicSessions.id, Number(id)))
    .returning();
  return row || null;
}

// ============================================================
// ADMIN SESSIONS
// ============================================================

async function createAdminSession({ userId, token, userAgent, ipAddress, expiresAt }) {
  const [row] = await db
    .insert(adminSessions)
    .values({
      userId: Number(userId),
      token,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      expiresAt: expiresAt instanceof Date ? expiresAt : new Date(expiresAt),
    })
    .returning();
  return row;
}

async function findAdminSession(token) {
  if (!token) return null;
  const [row] = await db
    .select()
    .from(adminSessions)
    .where(and(
      eq(adminSessions.token, token),
      isNull(adminSessions.revokedAt),
      gt(adminSessions.expiresAt, new Date())
    ))
    .limit(1);
  return row || null;
}

async function revokeAdminSession(token) {
  const [row] = await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessions.token, token))
    .returning();
  return row || null;
}

async function revokeAllAdminSessions(userId) {
  const rows = await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(adminSessions.userId, Number(userId)),
      isNull(adminSessions.revokedAt)
    ))
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

// ============================================================
// USER SESSIONS
// ============================================================

async function createUserSession({ userId, token, userAgent, ipAddress, expiresAt }) {
  const [row] = await db
    .insert(userSessions)
    .values({
      userId: Number(userId),
      token,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      expiresAt: expiresAt instanceof Date ? expiresAt : new Date(expiresAt),
    })
    .returning();
  return row;
}

async function findUserSession(token) {
  if (!token) return null;
  const [row] = await db
    .select()
    .from(userSessions)
    .where(and(
      eq(userSessions.token, token),
      isNull(userSessions.revokedAt),
      gt(userSessions.expiresAt, new Date())
    ))
    .limit(1);
  return row || null;
}

// ------------------------------------------------------------
// listUserSessions — active (non-revoked, non-expired) sessions
// for a given user. Used by the Security page and dashboard.
// ------------------------------------------------------------
async function listUserSessions(userId) {
  if (!userId) return [];
  return db
    .select()
    .from(userSessions)
    .where(and(
      eq(userSessions.userId, Number(userId)),
      isNull(userSessions.revokedAt),
      gt(userSessions.expiresAt, new Date())
    ))
    .orderBy(desc(userSessions.createdAt));
}

async function revokeUserSession(token) {
  const [row] = await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(eq(userSessions.token, token))
    .returning();
  return row || null;
}

// ------------------------------------------------------------
// revokeAllUserSessions — optionally excluding the current token,
// so "Sign out everywhere else" keeps the current device live.
// ------------------------------------------------------------
async function revokeAllUserSessions(userId, { exceptToken } = {}) {
  const conds = [
    eq(userSessions.userId, Number(userId)),
    isNull(userSessions.revokedAt),
  ];
  if (exceptToken) {
    conds.push(sql`${userSessions.token} <> ${exceptToken}`);
  }

  const rows = await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(...conds))
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

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  // academic sessions
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
  listUserSessions,           // ← NEW
  revokeUserSession,
  revokeAllUserSessions,
  purgeExpiredUserSessions,
};