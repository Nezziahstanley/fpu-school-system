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
const { eq, and, or, ilike, desc } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');
const { logAudit } = require('../../utils/audit');

const { payments, programmes, academicSessions, documents, users } = schema;
const only = requireRole('bursar', 'admin');

const VALID_LEVELS = ['ND', 'HND'];

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

    const [todayRow] = await db
      .select({
        count: sql`count(*)::int`,
        total: sql`coalesce(sum(${payments.amount}),0)::numeric`,
      })
      .from(payments)
      .where(sql`${payments.createdAt} >= current_date`);

    let recentPayments = [];
    try {
      const rows = await paymentQueries.listWithStudent({ limit: 5 });
      recentPayments = (rows || []).map((r) => {
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
    const clearMap  = pendingClearances.reduce((a, r) => ({ ...a, [r.status]: r.count }), {});

    return res.json({
      success: true,
      data: {
        todayPayments:  Number(todayRow?.count || 0),
        todayAmount:    Number(todayRow?.total || 0),
        pendingCount:   Number(statusMap.pending || 0),
        totalVerified:  Number(totalVerified?.total || 0),
        totalPending:   Number(totalPending?.total || 0),
        clearancesAwaiting: Number(clearMap.pending || 0),
        byStatus: statusMap,
        pendingClearances: clearMap,
        recentPayments,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/bursar/lookups
// ============================================================
router.get('/lookups', only, async (_req, res, next) => {
  try {
    const progs = await db
      .select({ id: programmes.id, code: programmes.code, name: programmes.name, level: programmes.level })
      .from(programmes)
      .orderBy(programmes.name);

    const sessions = await db
      .select({ id: academicSessions.id, name: academicSessions.name, isCurrent: academicSessions.isCurrent })
      .from(academicSessions)
      .orderBy(desc(academicSessions.isCurrent), desc(academicSessions.startDate));

    return res.json({
      success: true,
      data: { programmes: progs, sessions, levels: VALID_LEVELS },
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
    const { sessionId, status, search } = req.query;
    const rows = await paymentQueries.listWithStudent({ sessionId, status, search });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/payments/:id/verify', only, async (req, res, next) => {
  try {
    const row = await paymentQueries.verify(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Payment not found.' });
    await logAudit({ req, action: 'bursar.payment_verify', entity: 'payment', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

router.post('/payments/:id/reject', only, async (req, res, next) => {
  try {
    const row = await paymentQueries.reject(req.params.id, req.body?.reason, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Payment not found.' });
    await logAudit({ req, action: 'bursar.payment_reject', entity: 'payment', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// FEES
// ============================================================
router.get('/fees', only, async (req, res, next) => {
  try {
    const rows = await paymentQueries.listFeeStructures({
      programmeId: req.query.programmeId,
      level: req.query.level,
      sessionId: req.query.sessionId,
      isActive: req.query.isActive,
    });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

router.post('/fees', only, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.programmeId || !b.level || !b.sessionId) {
      return res.status(400).json({ success: false, error: 'programmeId, level, and sessionId are required.' });
    }
    if (!VALID_LEVELS.includes(b.level)) {
      return res.status(400).json({ success: false, error: 'level must be ND or HND.' });
    }
    const components = ['tuition', 'acceptance', 'medical', 'library', 'ict', 'sports', 'other'];
    const total = components.reduce((sum, k) => sum + Number(b[k] || 0), 0);

    const row = await paymentQueries.createFeeStructure({
      programmeId: b.programmeId, level: b.level, sessionId: b.sessionId,
      tuition: b.tuition, acceptance: b.acceptance, medical: b.medical,
      library: b.library, ict: b.ict, sports: b.sports, other: b.other,
      total, isActive: b.isActive !== false,
    });
    await logAudit({ req, action: 'bursar.fee_create', entity: 'fee_structure', entityId: row.id });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    if (err && /unique|duplicate/i.test(err.message || '')) {
      return res.status(409).json({ success: false, error: 'A fee structure already exists for this programme + level + session.' });
    }
    return next(err);
  }
});

router.put('/fees/:id', only, async (req, res, next) => {
  try {
    const b = req.body || {};
    const components = ['tuition', 'acceptance', 'medical', 'library', 'ict', 'sports', 'other'];
    const total = components.reduce((sum, k) => sum + Number(b[k] || 0), 0);
    const row = await paymentQueries.updateFeeStructure(req.params.id, {
      tuition: b.tuition, acceptance: b.acceptance, medical: b.medical,
      library: b.library, ict: b.ict, sports: b.sports, other: b.other,
      total, isActive: b.isActive,
    });
    if (!row) return res.status(404).json({ success: false, error: 'Fee structure not found.' });
    await logAudit({ req, action: 'bursar.fee_update', entity: 'fee_structure', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

router.delete('/fees/:id', only, async (req, res, next) => {
  try {
    const row = await paymentQueries.removeFeeStructure(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Fee structure not found.' });
    await logAudit({ req, action: 'bursar.fee_delete', entity: 'fee_structure', entityId: row.id, before: row });
    return res.json({ success: true });
  } catch (err) {
    if (err && /foreign key|violates/i.test(err.message || '')) {
      return res.status(409).json({ success: false, error: 'Cannot delete — this fee structure is referenced by existing payments. Deactivate it instead.' });
    }
    return next(err);
  }
});

// ============================================================
// CLEARANCES
// ============================================================
router.get('/clearances', only, async (req, res, next) => {
  try {
    const rows = await clearQueries.listWithStudent({
      sessionId: req.query.sessionId,
      status: req.query.status,
      type: req.query.type,
      search: req.query.search,
    });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

router.post('/clearances/:id/clear', only, async (req, res, next) => {
  try {
    const row = await clearQueries.markCleared(req.params.id, req.user.id, req.body?.remarks);
    if (!row) return res.status(404).json({ success: false, error: 'Clearance not found.' });
    await logAudit({ req, action: 'bursar.clearance_clear', entity: 'clearance', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

router.post('/clearances/:id/reject', only, async (req, res, next) => {
  try {
    const row = await clearQueries.markRejected(req.params.id, req.user.id, req.body?.remarks);
    if (!row) return res.status(404).json({ success: false, error: 'Clearance not found.' });
    await logAudit({ req, action: 'bursar.clearance_reject', entity: 'clearance', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// REPORTS
// ============================================================
router.get('/reports', only, async (req, res, next) => {
  try {
    const { from, to, sessionId } = req.query;
    const byStatus = await paymentQueries.sumByStatus({ from, to, sessionId });
    return res.json({ success: true, data: byStatus });
  } catch (err) { return next(err); }
});

router.get('/reports/by-bank', only, async (req, res, next) => {
  try {
    const { from, to, sessionId } = req.query;
    const byBank = await paymentQueries.sumByBank({ from, to, sessionId });
    return res.json({ success: true, data: byBank });
  } catch (err) { return next(err); }
});

// ============================================================
// DOCUMENTS — bursar can view requests (students request
// transcripts / letters / certificates) and act on them.
// Admin/registrar also use these; scope matches routes/documents.js.
// ============================================================

// ---- GET /api/bursar/documents ----
router.get('/documents', only, async (req, res, next) => {
  try {
    const { status, type, search } = req.query;
    const conds = [];
    if (status) conds.push(eq(documents.status, status));
    if (type)   conds.push(eq(documents.type, type));
    if (search) {
      const term = `%${String(search).trim()}%`;
      conds.push(or(
        ilike(documents.title, term),
        ilike(documents.type, term),
        ilike(users.firstName, term),
        ilike(users.lastName, term),
        ilike(users.matricNumber, term)
      ));
    }
    const where = conds.length ? and(...conds) : undefined;

    const rows = await db
      .select({ document: documents, user: users })
      .from(documents)
      .leftJoin(users, eq(documents.userId, users.id))
      .where(where)
      .orderBy(desc(documents.requestedAt));

    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ---- POST /api/bursar/documents/:id/approve ----
router.post('/documents/:id/approve', only, async (req, res, next) => {
  try {
    const [row] = await db
      .update(documents)
      .set({ status: 'approved' })
      .where(eq(documents.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Document not found.' });
    await logAudit({ req, action: 'bursar.document_approve', entity: 'document', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ---- POST /api/bursar/documents/:id/issue ----
router.post('/documents/:id/issue', only, async (req, res, next) => {
  try {
    const [row] = await db
      .update(documents)
      .set({
        status: 'issued',
        issuedAt: new Date(),
        issuedBy: req.user.id,
        fileUrl: req.body?.fileUrl || null,
      })
      .where(eq(documents.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Document not found.' });
    await logAudit({ req, action: 'bursar.document_issue', entity: 'document', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ---- POST /api/bursar/documents/:id/reject ----
router.post('/documents/:id/reject', only, async (req, res, next) => {
  try {
    const [row] = await db
      .update(documents)
      .set({ status: 'rejected', remarks: req.body?.remarks || null })
      .where(eq(documents.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Document not found.' });
    await logAudit({ req, action: 'bursar.document_reject', entity: 'document', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// PROFILE + SECURITY
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