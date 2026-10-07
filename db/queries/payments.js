// ============================================================
// FPU — Fee structures + payments queries
// Used by: routes/fees, routes/fees-copy, routes/payments
// ============================================================

'use strict';

const { db, schema, sql } = require('..');
const { eq, and, desc, asc } = require('drizzle-orm');

const { feeStructures, payments, users } = schema;

// ============================================================
// FEE STRUCTURES
// ============================================================
async function listFeeStructures({ programmeId, level, sessionId, isActive } = {}) {
  const conds = [];
  if (programmeId) conds.push(eq(feeStructures.programmeId, Number(programmeId)));
  if (level) conds.push(eq(feeStructures.level, level));
  if (sessionId) conds.push(eq(feeStructures.sessionId, Number(sessionId)));
  if (isActive !== undefined && isActive !== null && isActive !== '')
    conds.push(eq(feeStructures.isActive, String(isActive).toLowerCase() === 'true'));
  const where = conds.length ? and(...conds) : undefined;
  return db.select().from(feeStructures).where(where).orderBy(asc(feeStructures.id));
}

async function findFeeStructureById(id) {
  if (!id) return null;
  const [row] = await db.select().from(feeStructures).where(eq(feeStructures.id, Number(id))).limit(1);
  return row || null;
}

async function findFeeStructure({ programmeId, level, sessionId }) {
  if (!programmeId || !level || !sessionId) return null;
  const [row] = await db
    .select()
    .from(feeStructures)
    .where(and(
      eq(feeStructures.programmeId, Number(programmeId)),
      eq(feeStructures.level, level),
      eq(feeStructures.sessionId, Number(sessionId)),
    ))
    .limit(1);
  return row || null;
}

async function createFeeStructure(payload) {
  const tuition = Number(payload.tuition) || 0;
  const acceptance = Number(payload.acceptance) || 0;
  const medical = Number(payload.medical) || 0;
  const library = Number(payload.library) || 0;
  const ict = Number(payload.ict) || 0;
  const sports = Number(payload.sports) || 0;
  const other = Number(payload.other) || 0;
  const total = tuition + acceptance + medical + library + ict + sports + other;

  const [row] = await db
    .insert(feeStructures)
    .values({
      programmeId: Number(payload.programmeId),
      level: payload.level,
      sessionId: Number(payload.sessionId),
      tuition: String(tuition),
      acceptance: String(acceptance),
      medical: String(medical),
      library: String(library),
      ict: String(ict),
      sports: String(sports),
      other: String(other),
      total: String(total),
      isActive: payload.isActive !== false,
    })
    .returning();
  return row;
}

async function updateFeeStructure(id, patch) {
  const existing = await findFeeStructureById(id);
  if (!existing) return null;

  const next = {
    tuition: patch.tuition !== undefined ? Number(patch.tuition) : Number(existing.tuition),
    acceptance: patch.acceptance !== undefined ? Number(patch.acceptance) : Number(existing.acceptance),
    medical: patch.medical !== undefined ? Number(patch.medical) : Number(existing.medical),
    library: patch.library !== undefined ? Number(patch.library) : Number(existing.library),
    ict: patch.ict !== undefined ? Number(patch.ict) : Number(existing.ict),
    sports: patch.sports !== undefined ? Number(patch.sports) : Number(existing.sports),
    other: patch.other !== undefined ? Number(patch.other) : Number(existing.other),
  };
  const total = Object.values(next).reduce((a, b) => a + b, 0);

  const clean = {
    tuition: String(next.tuition),
    acceptance: String(next.acceptance),
    medical: String(next.medical),
    library: String(next.library),
    ict: String(next.ict),
    sports: String(next.sports),
    other: String(next.other),
    total: String(total),
  };
  if (patch.level !== undefined) clean.level = patch.level;
  if (patch.isActive !== undefined) clean.isActive = !!patch.isActive;

  const [row] = await db.update(feeStructures).set(clean).where(eq(feeStructures.id, Number(id))).returning();
  return row || null;
}

async function removeFeeStructure(id) {
  const [row] = await db.delete(feeStructures).where(eq(feeStructures.id, Number(id))).returning({ id: feeStructures.id });
  return !!row;
}

// ============================================================
// PAYMENTS
// ============================================================
async function listWithStudent({ sessionId, status } = {}) {
  const conds = [];
  if (sessionId) conds.push(eq(payments.sessionId, Number(sessionId)));
  if (status) conds.push(eq(payments.status, status));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({ payment: payments, student: users })
    .from(payments)
    .leftJoin(users, eq(payments.studentId, users.id))
    .where(where)
    .orderBy(desc(payments.createdAt));
}

async function countByStatus({ sessionId } = {}) {
  const conds = [];
  if (sessionId) conds.push(eq(payments.sessionId, Number(sessionId)));
  const where = conds.length ? and(...conds) : undefined;
  return db
    .select({
      status: payments.status,
      count: sql`count(*)::int`,
      total: sql`coalesce(sum(${payments.amount}), 0)::numeric`,
    })
    .from(payments)
    .where(where)
    .groupBy(payments.status);
}

async function findById(id) {
  if (!id) return null;
  const [row] = await db.select().from(payments).where(eq(payments.id, Number(id))).limit(1);
  return row || null;
}

async function create(payload) {
  const [row] = await db
    .insert(payments)
    .values({
      studentId: Number(payload.studentId),
      sessionId: Number(payload.sessionId),
      feeStructureId: payload.feeStructureId ? Number(payload.feeStructureId) : null,
      amount: String(payload.amount),
      reference: payload.reference,
      bankName: payload.bankName || null,
      depositorName: payload.depositorName || null,
      depositDate: payload.depositDate || null,
      status: payload.status || 'pending',
    })
    .returning();
  return row;
}

async function update(id, patch) {
  const allowed = ['amount', 'reference', 'bankName', 'depositorName', 'depositDate', 'feeStructureId'];
  const clean = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) clean[k] = patch[k];
  }
  if (clean.amount !== undefined) clean.amount = String(clean.amount);
  if (clean.feeStructureId !== undefined) clean.feeStructureId = clean.feeStructureId ? Number(clean.feeStructureId) : null;

  const [row] = await db.update(payments).set(clean).where(eq(payments.id, Number(id))).returning();
  return row || null;
}

async function verify(id, userId) {
  const [row] = await db
    .update(payments)
    .set({ status: 'verified', verifiedBy: Number(userId), verifiedAt: new Date(), rejectionReason: null })
    .where(eq(payments.id, Number(id)))
    .returning();
  return row || null;
}

async function reject(id, userId, reason) {
  const [row] = await db
    .update(payments)
    .set({ status: 'rejected', verifiedBy: Number(userId), verifiedAt: new Date(), rejectionReason: reason || null })
    .where(eq(payments.id, Number(id)))
    .returning();
  return row || null;
}

async function refund(id, userId) {
  const [row] = await db
    .update(payments)
    .set({ status: 'refunded', verifiedBy: Number(userId), verifiedAt: new Date() })
    .where(eq(payments.id, Number(id)))
    .returning();
  return row || null;
}

async function remove(id) {
  const [row] = await db.delete(payments).where(eq(payments.id, Number(id))).returning();
  return row || null;
}

module.exports = {
  // fee structures
  listFeeStructures,
  findFeeStructureById,
  findFeeStructure,
  createFeeStructure,
  updateFeeStructure,
  removeFeeStructure,

  // payments
  listWithStudent,
  countByStatus,
  findById,
  create,
  update,
  verify,
  reject,
  refund,
  remove,
};