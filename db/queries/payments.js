// ============================================================
// FPU — Query helper: payments + fee_structures
// ============================================================

'use strict';

const { db, sql, schema } = require('../index');
const { eq, and, or, ilike, desc, asc, inArray, gte, lte } = require('drizzle-orm');

const { payments, feeStructures, users, academicSessions } = schema;

// ============================================================
// FEE STRUCTURES
// ============================================================

async function findFeeStructureById(id) {
  if (!id) return null;
  const [row] = await db.select().from(feeStructures).where(eq(feeStructures.id, Number(id))).limit(1);
  return row || null;
}

// ------------------------------------------------------------
// findFeeStructure — for a specific programme/level/session
// ------------------------------------------------------------
async function findFeeStructure({ programmeId, level, sessionId } = {}) {
  const conds = [];
  if (programmeId) conds.push(eq(feeStructures.programmeId, Number(programmeId)));
  if (level) conds.push(eq(feeStructures.level, level));
  if (sessionId) conds.push(eq(feeStructures.sessionId, Number(sessionId)));
  const where = conds.length ? and(...conds) : undefined;

  const [row] = await db
    .select()
    .from(feeStructures)
    .where(where)
    .orderBy(desc(feeStructures.createdAt))
    .limit(1);
  return row || null;
}

// ------------------------------------------------------------
// findFeeStructureWithFallback — tries the exact session
// first, then falls back to any session for the same
// programme + level. Fixes "no fees for current session".
// ------------------------------------------------------------
async function findFeeStructureWithFallback({ programmeId, level, sessionId } = {}) {
  if (!programmeId || !level) return null;

  // Exact match
  if (sessionId) {
    const exact = await findFeeStructure({ programmeId, level, sessionId });
    if (exact) return exact;
  }

  // Fallback: any session for this programme + level
  const [fallback] = await db
    .select()
    .from(feeStructures)
    .where(and(
      eq(feeStructures.programmeId, Number(programmeId)),
      eq(feeStructures.level, level)
    ))
    .orderBy(desc(feeStructures.sessionId))
    .limit(1);
  return fallback || null;
}

async function listFeeStructures({ programmeId, level, sessionId, isActive } = {}) {
  const conds = [];
  if (programmeId) conds.push(eq(feeStructures.programmeId, Number(programmeId)));
  if (level) conds.push(eq(feeStructures.level, level));
  if (sessionId) conds.push(eq(feeStructures.sessionId, Number(sessionId)));
  if (isActive !== undefined) conds.push(eq(feeStructures.isActive, !!isActive));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select()
    .from(feeStructures)
    .where(where)
    .orderBy(desc(feeStructures.createdAt));
}

async function createFeeStructure(data) {
  const [row] = await db
    .insert(feeStructures)
    .values({
      programmeId: Number(data.programmeId),
      level: data.level,
      sessionId: Number(data.sessionId),
      tuition: String(data.tuition || 0),
      acceptance: String(data.acceptance || 0),
      medical: String(data.medical || 0),
      library: String(data.library || 0),
      ict: String(data.ict || 0),
      sports: String(data.sports || 0),
      other: String(data.other || 0),
      total: String(data.total || 0),
      isActive: data.isActive !== false,
    })
    .returning();
  return row;
}

async function updateFeeStructure(id, data) {
  const allowed = ['tuition', 'acceptance', 'medical', 'library', 'ict', 'sports', 'other', 'total', 'isActive'];
  const clean = {};
  for (const k of allowed) {
    if (data[k] !== undefined) clean[k] = k === 'isActive' ? !!data[k] : String(data[k]);
  }
  if (!Object.keys(clean).length) return findFeeStructureById(id);
  const [row] = await db.update(feeStructures).set(clean).where(eq(feeStructures.id, Number(id))).returning();
  return row || null;
}

async function removeFeeStructure(id) {
  const [row] = await db.delete(feeStructures).where(eq(feeStructures.id, Number(id))).returning();
  return row || null;
}

// ============================================================
// PAYMENTS
// ============================================================

async function findById(id) {
  if (!id) return null;
  const [row] = await db.select().from(payments).where(eq(payments.id, Number(id))).limit(1);
  return row || null;
}

// ------------------------------------------------------------
// list — payments for a student (optionally by session),
// with optional search/status filters for the admin UI.
// ------------------------------------------------------------
async function list({ studentId, sessionId, status, search, limit = 200, offset = 0 } = {}) {
  const conds = [];
  if (studentId) conds.push(eq(payments.studentId, Number(studentId)));
  if (sessionId) conds.push(eq(payments.sessionId, Number(sessionId)));
  if (status) conds.push(eq(payments.status, status));
  if (search) {
    const term = `%${String(search).trim()}%`;
    conds.push(or(
      ilike(payments.reference, term),
      ilike(payments.bankName, term),
      ilike(payments.depositorName, term)
    ));
  }
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select()
    .from(payments)
    .where(where)
    .orderBy(desc(payments.createdAt))
    .limit(Number(limit))
    .offset(Number(offset));
}

// ------------------------------------------------------------
// listWithStudent — admin view: join student info
// ------------------------------------------------------------
async function listWithStudent({ studentId, sessionId, status, search, limit = 200, offset = 0 } = {}) {
  const conds = [];
  if (studentId) conds.push(eq(payments.studentId, Number(studentId)));
  if (sessionId) conds.push(eq(payments.sessionId, Number(sessionId)));
  if (status) conds.push(eq(payments.status, status));
  if (search) {
    const term = `%${String(search).trim()}%`;
    conds.push(or(
      ilike(payments.reference, term),
      ilike(payments.bankName, term),
      ilike(payments.depositorName, term),
      ilike(users.firstName, term),
      ilike(users.lastName, term),
      ilike(users.matricNumber, term)
    ));
  }
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({ payment: payments, student: users })
    .from(payments)
    .leftJoin(users, eq(payments.studentId, users.id))
    .where(where)
    .orderBy(desc(payments.createdAt))
    .limit(Number(limit))
    .offset(Number(offset));
}

async function count({ studentId, sessionId, status } = {}) {
  const conds = [];
  if (studentId) conds.push(eq(payments.studentId, Number(studentId)));
  if (sessionId) conds.push(eq(payments.sessionId, Number(sessionId)));
  if (status) conds.push(eq(payments.status, status));
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db.select({ id: payments.id }).from(payments).where(where);
  return rows.length;
}

// ------------------------------------------------------------
// totalVerifiedForStudent — sum of all VERIFIED payments for
// a student (optionally scoped to a session).
// ------------------------------------------------------------
async function totalVerifiedForStudent(studentId, sessionId) {
  if (!studentId) return 0;

  const conds = [
    eq(payments.studentId, Number(studentId)),
    eq(payments.status, 'verified'),
  ];
  if (sessionId) conds.push(eq(payments.sessionId, Number(sessionId)));

  const rows = await db
    .select({ amount: payments.amount })
    .from(payments)
    .where(and(...conds));

  const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  return total;
}

// ------------------------------------------------------------
// totalPaidForStudent — same as above but for ALL non-rejected
// payments (pending + verified).
// ------------------------------------------------------------
async function totalPaidForStudent(studentId, sessionId) {
  if (!studentId) return 0;

  const conds = [eq(payments.studentId, Number(studentId))];
  if (sessionId) conds.push(eq(payments.sessionId, Number(sessionId)));

  const rows = await db
    .select({ amount: payments.amount, status: payments.status })
    .from(payments)
    .where(and(...conds));

  const total = rows
    .filter((r) => r.status !== 'rejected')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  return total;
}

async function create(data) {
  const [row] = await db
    .insert(payments)
    .values({
      studentId: Number(data.studentId),
      sessionId: Number(data.sessionId),
      feeStructureId: data.feeStructureId ? Number(data.feeStructureId) : null,
      amount: String(data.amount || 0),
      reference: data.reference,
      bankName: data.bankName || null,
      depositorName: data.depositorName || null,
      depositDate: data.depositDate || null,
      receiptUrl: data.receiptUrl || null,
      status: data.status || 'pending',
    })
    .returning();
  return row;
}

async function update(id, patch) {
  const allowed = ['amount', 'reference', 'bankName', 'depositorName', 'depositDate', 'receiptUrl'];
  const clean = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) clean[k] = patch[k];
  }
  const [row] = await db.update(payments).set(clean).where(eq(payments.id, Number(id))).returning();
  return row || null;
}

async function verify(id, verifiedBy) {
  const [row] = await db
    .update(payments)
    .set({ status: 'verified', verifiedBy: Number(verifiedBy), verifiedAt: new Date() })
    .where(eq(payments.id, Number(id)))
    .returning();
  return row || null;
}

async function reject(id, reason, rejectedBy) {
  const [row] = await db
    .update(payments)
    .set({ status: 'rejected', rejectionReason: reason, verifiedBy: Number(rejectedBy), verifiedAt: new Date() })
    .where(eq(payments.id, Number(id)))
    .returning();
  return row || null;
}

async function remove(id) {
  const [row] = await db.delete(payments).where(eq(payments.id, Number(id))).returning();
  return row || null;
}

// ------------------------------------------------------------
// listByDepartment — admin reporting
// ------------------------------------------------------------
async function listByDepartment({ departmentId, sessionId, status } = {}) {
  const conds = [];
  if (departmentId) conds.push(eq(users.departmentId, Number(departmentId)));
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

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  // fee structures
  findFeeStructureById,
  findFeeStructure,
  findFeeStructureWithFallback,
  listFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  removeFeeStructure,

  // payments
  findById,
  list,
  listWithStudent,
  listByDepartment,
  count,
  totalVerifiedForStudent,
  totalPaidForStudent,
  create,
  update,
  verify,
  reject,
  remove,
};