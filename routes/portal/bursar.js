// ============================================================
// FPU — Bursar portal API
// Mounted at /api/bursar
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries = require('../../db/queries/users');
const paymentQueries = require('../../db/queries/payments');
const clearQueries = require('../../db/queries/clearances');
const notifQueries = require('../../db/queries/notifications');
const sessionQueries = require('../../db/queries/sessions');
const { db, schema, sql } = require('../../db');
const { eq, desc } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');
const { logAudit } = require('../../utils/audit');

const { payments } = schema;
const only = requireRole('bursar', 'admin');

// ============================================================
// GET /api/bursar/dashboard
// ============================================================
router.get('/dashboard', only, async (_req, res, next) => {
  try {
    const byStatus = await paymentQueries.countByStatus({});
    const [totalVerified] = await db
      .select({ total: sql`coalesce(sum(${payments.amount}),0)::numeric` })
      .from(payments)
      .where(eq(payments.status, 'verified'));

    const [totalPending] = await db
      .select({ total: sql`coalesce(sum(${payments.amount}),0)::numeric` })
      .from(payments)
      .where(eq(payments.status, 'pending'));

    const pendingClearances = await clearQueries.countByStatus({});

    // ---- today's payments ----
    const [todayRow] = await db
      .select({
        count: sql`count(*)::int`,
        total: sql`coalesce(sum(${payments.amount}),0)::numeric`,
      })
      .from(payments)
      .where(sql`${payments.createdAt} >= current_date`);

    // ---- recent payments (last 5, joined to student) ----
    let recentPayments = [];
    try {
      const rows = await paymentQueries.listWithStudent({ limit: 5 });
      recentPayments = (rows || []).map((r) => {
        // listWithStudent returns { payment, student } or a flat row; normalize.
        const p = r.payment || r;
        const s = r.student || r.studentInfo || {};
        return {
          id: p.id,
          amount: Number(p.amount || 0),
          status: p.status || '',
          reference: p.reference || p.referenceNo || '',
          createdAt: p.createdAt,
          method: p.method || p.paymentMethod || '',
          studentName:
            [s.firstName, s.lastName].filter(Boolean).join(' ') ||
            s.fullName || s.email ||
            p.studentName || 'Student',
        };
      });
    } catch (e) {
      recentPayments = [];
    }

    const statusMap = byStatus.reduce((a, r) => ({ ...a, [r.status]: r.c }), {});
    const clearMap  = pendingClearances.reduce((a, r) => ({ ...a, [r.status]: r.c }), {});

    return res.json({
      success: true,
      data: {
        // stat cards
        todayPayments:  Number(todayRow?.count || 0),
        todayAmount:    Number(todayRow?.total || 0),
        pendingCount:   Number(statusMap.pending || 0),
        totalVerified:  Number(totalVerified?.total || 0),
        totalPending:   Number(totalPending?.total || 0),
        clearancesAwaiting: Number(clearMap.pending || 0),

        // status breakdown
        byStatus: statusMap,
        pendingClearances: clearMap,

        // recent payments table
        recentPayments,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/bursar/payments
// ============================================================
router.get('/payments', only, async (req, res, next) => {
  try {
    const { sessionId, status } = req.query;
    const rows = await paymentQueries.listWithStudent({ sessionId, status });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /api/bursar/payments/:id/verify
// ============================================================
router.post('/payments/:id/verify', only, async (req, res, next) => {
  try {
    const row = await paymentQueries.verify(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Payment not found.' });
    await logAudit({ req, action: 'bursar.payment_verify', entity: 'payment', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /api/bursar/payments/:id/reject
// ============================================================
router.post('/payments/:id/reject', only, async (req, res, next) => {
  try {
    const row = await paymentQueries.reject(req.params.id, req.body?.reason, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Payment not found.' });
    await logAudit({ req, action: 'bursar.payment_reject', entity: 'payment', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/bursar/fees
// ============================================================
router.get('/fees', only, async (req, res, next) => {
  try {
    const rows = await paymentQueries.listFeeStructures({
      programmeId: req.query.programmeId,
      level: req.query.level,
      sessionId: req.query.sessionId,
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/bursar/clearances
// ============================================================
router.get('/clearances', only, async (req, res, next) => {
  try {
    const rows = await clearQueries.listWithStudent({
      sessionId: req.query.sessionId,
      status: req.query.status,
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /api/bursar/clearances/:id/clear
// ============================================================
router.post('/clearances/:id/clear', only, async (req, res, next) => {
  try {
    const row = await clearQueries.markCleared(req.params.id, req.user.id, req.body?.remarks);
    if (!row) return res.status(404).json({ success: false, error: 'Clearance not found.' });
    await logAudit({ req, action: 'bursar.clearance_clear', entity: 'clearance', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/bursar/reports
// ============================================================
router.get('/reports', only, async (_req, res, next) => {
  try {
    const byStatus = await db
      .select({ status: payments.status, count: sql`count(*)::int`, total: sql`coalesce(sum(${payments.amount}),0)::numeric` })
      .from(payments)
      .groupBy(payments.status);
    return res.json({ success: true, data: byStatus });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/bursar/profile, /security
// ============================================================
router.get('/profile', only, async (req, res, next) => {
  try {
    return res.json({ success: true, data: await userQueries.findByIdWithRelations(req.user.id) });
  } catch (err) { return next(err); }
});

router.get('/security', only, async (req, res, next) => {
  try {
    const sessions = await sessionQueries.listUserSessions(req.user.id);
    const logins = await require('../../db/queries/audit').listLogins({ userId: req.user.id, limit: 30 });
    return res.json({ success: true, sessions, logins });
  } catch (err) { return next(err); }
});

module.exports = router;