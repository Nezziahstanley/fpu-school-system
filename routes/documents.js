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
const STAFF = ['admin', 'registrar', 'rector', 'academic_officer', 'bursar', 'lecturer', 'hod'];

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

// GET /api/admin/documents/:id/preview
// Returns HTML rendering of the document for the admin to preview
router.get('/:id/preview', requireRole(STAFF), async (req, res, next) => {
  try {
    const [row] = await db
      .select({ document: documents, user: users })
      .from(documents)
      .leftJoin(users, eq(documents.userId, users.id))
      .where(eq(documents.id, Number(req.params.id)));

    if (!row) return res.status(404).json({ success: false, error: 'Document not found.' });

    const doc = row.document;
    const stu = row.user || {};
    const studentName = `${stu.firstName || ''} ${stu.lastName || ''}`.trim() || 'Student';
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const docType = (doc.type || 'document').toUpperCase();

    // Document-type-specific HTML
    let bodyHtml = '';

    if (doc.type === 'id-card') {
      bodyHtml = `
        <div style="width: 340px; margin: 0 auto; border-radius: 14px; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.15); background: #fff;">
          <div style="background: linear-gradient(135deg, #065f46, #047857); color: #fff; padding: 1rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: .65rem; text-transform: uppercase; letter-spacing: 1px; color: #a7f3d0;">Federal Polytechnic Ugep</div>
              <div style="font-weight: 800; font-size: .95rem;">STUDENT ID CARD</div>
            </div>
            <div style="width: 40px; height: 40px; background: #f59e0b; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.1rem; color: #065f46;">F</div>
          </div>
          <div style="padding: 1rem; display: flex; gap: 1rem;">
            <div style="width: 90px; height: 110px; border-radius: 8px; background: ${stu.photoUrl ? 'url(' + stu.photoUrl + ') center/cover' : 'linear-gradient(135deg,#065f46,#f59e0b)'}; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 900; font-size: 1.6rem; flex-shrink: 0;">
              ${stu.photoUrl ? '' : (stu.firstName || 'S')[0].toUpperCase()}
            </div>
            <div style="flex: 1; font-size: .78rem;">
              <div style="font-weight: 800; color: #065f46; font-size: 1rem; margin-bottom: .4rem;">${studentName}</div>
              <div style="display: flex; justify-content: space-between; padding: .2rem 0; border-bottom: 1px dashed #e5e7eb;"><span style="color:#64748b;">Matric No</span><strong>${stu.matricNumber || '—'}</strong></div>
              <div style="display: flex; justify-content: space-between; padding: .2rem 0; border-bottom: 1px dashed #e5e7eb;"><span style="color:#64748b;">Level</span><strong>${stu.level || '—'}</strong></div>
              <div style="display: flex; justify-content: space-between; padding: .2rem 0;"><span style="color:#64748b;">Dept</span><strong>${stu.departmentName || '—'}</strong></div>
            </div>
          </div>
          <div style="padding: .55rem 1rem; background: #f9fafb; text-align: center; font-size: .65rem; letter-spacing: 1.5px; color: #6b7280; border-top: 1px solid #e5e7eb;">
            VALID UNTIL GRADUATION · ${today}
          </div>
        </div>
      `;
    } else {
      // Default letter / transcript / certificate layout
      bodyHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 2rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid #065f46;">
            <h1 style="margin: 0; color: #065f46; font-family: serif; font-size: 1.4rem;">FEDERAL POLYTECHNIC UGEP</h1>
            <p style="margin: .3rem 0 0; color: #64748b; font-size: .8rem;">P.M.B. 1038, Ugep, Cross River State, Nigeria</p>
          </div>
          <h2 style="text-align: center; color: #0f172a; text-transform: uppercase; font-size: .95rem; letter-spacing: 1px; margin-bottom: 1.5rem;">${docType}</h2>
          <p style="color: #0f172a; line-height: 1.8; font-size: .88rem;">
            This is to certify that <strong>${studentName}</strong> (Matric No: <strong>${stu.matricNumber || '—'}</strong>) 
            is a bona fide student of Federal Polytechnic Ugep with the following details:
          </p>
          <table style="width: 100%; margin: 1rem 0; font-size: .85rem; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: .5rem 0; color: #64748b;">Programme</td><td style="padding: .5rem 0; text-align: right; font-weight: 700;">${stu.programmeName || '—'}</td></tr>
            <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: .5rem 0; color: #64748b;">Department</td><td style="padding: .5rem 0; text-align: right; font-weight: 700;">${stu.departmentName || '—'}</td></tr>
            <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: .5rem 0; color: #64748b;">Level</td><td style="padding: .5rem 0; text-align: right; font-weight: 700;">${stu.level || '—'}</td></tr>
            <tr><td style="padding: .5rem 0; color: #64748b;">Session</td><td style="padding: .5rem 0; text-align: right; font-weight: 700;">2025/2026</td></tr>
          </table>
          <p style="color: #0f172a; line-height: 1.8; font-size: .88rem;">
            ${doc.remarks ? doc.remarks : `This document is issued at the request of the student for official use.`}
          </p>
          <p style="margin-top: 2rem; color: #64748b; font-size: .78rem;">Date Issued: ${today}</p>
          <div style="margin-top: 3rem; text-align: right;">
            <div style="display: inline-block; border-top: 1px solid #0f172a; padding-top: .3rem; min-width: 150px; text-align: center;">
              <div style="font-weight: 800; font-size: .85rem;">REGISTRAR</div>
              <div style="font-size: .7rem; color: #64748b;">Signature / Stamp</div>
            </div>
          </div>
        </div>
      `;
    }

    return res.json({ success: true, html: bodyHtml });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;