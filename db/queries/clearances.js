// ============================================================
// FPU — Clearance queries
// Used by: routes/clearances, routes/portal/bursar,
//          routes/portal/student, routes/portal/registrar
// ============================================================

'use strict';

const { db, schema, sql } = require('..');
const { eq, and, or, ilike, desc } = require('drizzle-orm');

const { clearances, users, academicSessions } = schema;

async function listWithStudent({ sessionId, status, type, search } = {}) {
  const conds = [];
  if (sessionId) conds.push(eq(clearances.sessionId, Number(sessionId)));
  if (status) conds.push(eq(clearances.status, status));
  if (type) conds.push(eq(clearances.type, type));
  if (search) {
    const term = `%${String(search).trim()}%`;
    conds.push(or(
      ilike(users.firstName, term),
      ilike(users.lastName, term),
      ilike(users.matricNumber, term),
      ilike(users.email, term)
    ));
  }
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

// ------------------------------------------------------------
// findOne — used by student clearance request + exam officer
//           eligibility check.
// ------------------------------------------------------------
async function findOne({ studentId, sessionId, type } = {}) {
  const conds = [];
  if (studentId) conds.push(eq(clearances.studentId, Number(studentId)));
  if (sessionId) conds.push(eq(clearances.sessionId, Number(sessionId)));
  if (type) conds.push(eq(clearances.type, type));
  if (!conds.length) return null;
  const [row] = await db.select().from(clearances).where(and(...conds)).limit(1);
  return row || null;
}

// ------------------------------------------------------------
// list — simple list for one student + session.
// (listWithStudent is the admin/HOD join version.)
// ------------------------------------------------------------
async function list({ studentId, sessionId, type, status } = {}) {
  const conds = [];
  if (studentId) conds.push(eq(clearances.studentId, Number(studentId)));
  if (sessionId) conds.push(eq(clearances.sessionId, Number(sessionId)));
  if (type) conds.push(eq(clearances.type, type));
  if (status) conds.push(eq(clearances.status, status));
  const where = conds.length ? and(...conds) : undefined;
  return db.select().from(clearances).where(where).orderBy(desc(clearances.createdAt));
}

module.exports = {
  listWithStudent,
  list,              // ← add
  countByStatus,
  findById,
  findOne,           // ← add
  create,
  markCleared,
  markRejected,
  remove,
};