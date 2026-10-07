// ============================================================
// FPU — Admin documents API
// Mounted at /api/admin/documents
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const { db, schema } = require('../db');
const { eq, and, desc } = require('drizzle-orm');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const { documents, users } = schema;
const STAFF = ['admin', 'registrar', 'rector', 'academic_officer', 'bursar'];

router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { status, type, userId } = req.query;
    const conds = [];
    if (status) conds.push(eq(documents.status, status));
    if (type) conds.push(eq(documents.type, type));
    if (userId) conds.push(eq(documents.userId, Number(userId)));
    const where = conds.length ? and(...conds) : undefined;
    const rows = await db
      .select({ document: documents, user: users })
      .from(documents)
      .leftJoin(users, eq(documents.userId, users.id))
      .where(where)
      .orderBy(desc(documents.requestedAt));
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const { userId, type, title } = req.body || {};
    if (!userId || !type || !title) {
      return res.status(400).json({ success: false, error: 'userId, type, title are required.' });
    }
    const [row] = await db.insert(documents).values({
      userId: Number(userId),
      type,
      title,
      status: 'pending',
    }).returning();
    await logAudit({ req, action: 'document.create', entity: 'document', entityId: row.id });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/approve', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const [row] = await db.update(documents).set({ status: 'approved' }).where(eq(documents.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ success: false, error: 'Document not found.' });
    await logAudit({ req, action: 'document.approve', entity: 'document', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/issue', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const [row] = await db
      .update(documents)
      .set({ status: 'issued', issuedAt: new Date(), issuedBy: req.user.id, fileUrl: req.body?.fileUrl || null })
      .where(eq(documents.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Document not found.' });
    await logAudit({ req, action: 'document.issue', entity: 'document', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/reject', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const [row] = await db
      .update(documents)
      .set({ status: 'rejected', remarks: req.body?.remarks || null })
      .where(eq(documents.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Document not found.' });
    await logAudit({ req, action: 'document.reject', entity: 'document', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const [row] = await db.delete(documents).where(eq(documents.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ success: false, error: 'Document not found.' });
    await logAudit({ req, action: 'document.delete', entity: 'document', entityId: row.id, before: row });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;