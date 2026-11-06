// ============================================================
// FPU — Database Queries: Fees
// ============================================================

'use strict';

const { db, schema } = require('..');
const { eq, asc } = require('drizzle-orm');

// If your schema exports a "fees" table, use it.
// Otherwise fall back to "feeStructures" (old shape).
const feesTable = schema.fees || schema.feeStructures;

async function listFees() {
  if (!feesTable) throw new Error('Fees table not registered in schema');
  return db.select().from(feesTable).orderBy(asc(feesTable.level));
}

async function findFeeById(id) {
  if (!feesTable) throw new Error('Fees table not registered in schema');
  const [row] = await db.select().from(feesTable).where(eq(feesTable.id, Number(id))).limit(1);
  return row || null;
}

async function createFee({ level, amount, sessionId }) {
  if (!feesTable) throw new Error('Fees table not registered in schema');
  const [row] = await db
    .insert(feesTable)
    .values({
      level: String(level).toUpperCase(),
      amount: String(Number(amount)),
      sessionId: sessionId ? Number(sessionId) : null,
    })
    .returning();
  return row;
}

async function updateFee(id, patch) {
  if (!feesTable) throw new Error('Fees table not registered in schema');
  const clean = {};
  if (patch.level !== undefined) clean.level = String(patch.level).toUpperCase();
  if (patch.amount !== undefined) clean.amount = String(Number(patch.amount));
  if (patch.sessionId !== undefined) clean.sessionId = patch.sessionId ? Number(patch.sessionId) : null;

  if (!Object.keys(clean).length) return findFeeById(id);

  const [row] = await db
    .update(feesTable)
    .set(clean)
    .where(eq(feesTable.id, Number(id)))
    .returning();
  return row || null;
}

async function removeFee(id) {
  if (!feesTable) throw new Error('Fees table not registered in schema');
  const [row] = await db.delete(feesTable).where(eq(feesTable.id, Number(id))).returning();
  return row || null;
}

module.exports = {
  listFees,
  findFeeById,
  createFee,
  updateFee,
  removeFee,
};