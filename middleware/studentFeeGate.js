'use strict';

const { db, schema } = require('../db');
const { eq, and, sql } = require('drizzle-orm');
const { optionalUser } = require('./auth');
const paymentQueries = require('../db/queries/payments');

async function getStudentFeeAccess(userId) {
  const [student] = await db.select({
    id: schema.users.id,
    programmeId: schema.users.programmeId,
    level: schema.users.level,
  }).from(schema.users).where(eq(schema.users.id, Number(userId))).limit(1);

  if (!student) throw new Error('Student account not found.');

  const [session] = await db.select({ id: schema.academicSessions.id })
    .from(schema.academicSessions)
    .where(eq(schema.academicSessions.isCurrent, true))
    .limit(1);

  if (!session?.id) {
    return { paymentRequired: false, totalDue: 0, totalPaid: 0, balance: 0, sessionId: null };
  }

  const [fee] = await db.select({
    totalDue: sql`COALESCE(SUM(${schema.feeStructures.total}), 0)::numeric`,
  }).from(schema.feeStructures).where(and(
    eq(schema.feeStructures.sessionId, session.id),
    eq(schema.feeStructures.programmeId, student.programmeId),
    eq(schema.feeStructures.level, student.level),
    eq(schema.feeStructures.isActive, true),
  ));

  const totalDue = Number(fee?.totalDue || 0);
  const totalPaid = Number(await paymentQueries.totalVerifiedForStudent(student.id, session.id)) || 0;
  const balance = Math.max(0, totalDue - totalPaid);

  return {
    paymentRequired: totalDue > 0 && balance > 0.009,
    totalDue,
    totalPaid,
    balance,
    sessionId: session.id,
  };
}

const paymentRoutes = new Set([
  'GET /student/access-status',
  'GET /student/fees',
  'GET /student/payment-options',
  'POST /student/payments/bank-transfer',
  'POST /student/payments/paystack/initialize',
  'POST /student/payments/paystack/verify',
  'POST /admin/auth/logout',
  'GET /admin/auth/me',
]);

async function studentFeeGate(req, res, next) {
  try {
    await optionalUser(req, res, () => {});
    if (!req.user || String(req.user.role).toLowerCase() !== 'student') return next();

    const routeKey = String(req.method || 'GET').toUpperCase() + ' ' + req.path;
    if (paymentRoutes.has(routeKey)) return next();

    const access = await getStudentFeeAccess(req.user.id);
    if (access.paymentRequired) {
      return res.status(402).json({
        success: false,
        code: 'STUDENT_PAYMENT_REQUIRED',
        error: 'Your dashboard is temporarily restricted because required school fees are outstanding. Please complete payment and wait for verification.',
        data: access,
      });
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { studentFeeGate, getStudentFeeAccess };
