// ============================================================
// FPU — Clearance queries
// Used by: routes/clearances, routes/portal/bursar,
//          routes/portal/student, routes/portal/registrar
// ============================================================

'use strict';

const { db, schema, sql } = require('..');
const { eq, and, desc } = require('drizzle-orm');

const { clearances, users, academicSessions } = schema;

async function listWithStudent({ sessionId, status, type } = {}) {
  const conds = [];
  if (sessionId) conds.push(eq(clearances.sessionId, Number(sessionId)));
  if (status) conds.push(eq(clearances.status, status));
  if (type) conds.push(eq(clearances.type, type));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({
      clearance: clearances,
      student: users,
      session: academicSessions,
    })
    .from(clearances)
    .leftJoin(users, eq(clearances.studentId, users.id))
    .leftJoin(academicSessions, eq(clearances.sessionId, academicSessions.id))
    .where(where)
    .orderBy(desc(clearances.createdAt));
}

async function countByStatus({ sessionId } = {}) {
  const conds = [];
  if (sessionId) conds.push(eq(clearances.sessionId, Number(sessionId)));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({ status: clearances.status, count: sql`count(*)::int` })
    .from(clearances)
    .where(where)
    .groupBy(clearances.status);
}

async function findById(id) {
  if (!id) return null;
  const [row] = await db.select().from(clearances).where(eq(clearances.id, Number(id))).limit(1);
  return row || null;
}

async function create({ studentId, sessionId, type }) {
  const [row] = await db
    .insert(clearances)
    .values({
      studentId: Number(studentId),
      sessionId: Number(sessionId),
      type: type || 'semester',
      status: 'pending',
    })
    .onConflictDoNothing()
    .returning();
  return row || null;
}

async function markCleared(id, userId, remarks) {
  const [row] = await db
    .update(clearances)
    .set({ status: 'cleared', clearedBy: Number(userId), clearedAt: new Date(), remarks: remarks || null })
    .where(eq(clearances.id, Number(id)))
    .returning();
  return row || null;
}

async function markRejected(id, userId, remarks) {
  const [row] = await db
    .update(clearances)
    .set({ status: 'rejected', clearedBy: Number(userId), clearedAt: new Date(), remarks: remarks || null })
    .where(eq(clearances.id, Number(id)))
    .returning();
  return row || null;
}

async function remove(id) {
  const [row] = await db.delete(clearances).where(eq(clearances.id, Number(id))).returning();
  return row || null;
}

module.exports = {
  listWithStudent,
  countByStatus,
  findById,
  create,
  markCleared,
  markRejected,
  remove,
};