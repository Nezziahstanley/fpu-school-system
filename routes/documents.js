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
router.get('/:id/preview', requireRole(STAFF), async (req, res, next) => {
  try {
    const [row] = await db
      .select({
        document: documents,
        user: users,
        department: schema.departments,
        programme: schema.programmes,
      })
      .from(documents)
      .leftJoin(users, eq(documents.userId, users.id))
      .leftJoin(schema.departments, eq(users.departmentId, schema.departments.id))
      .leftJoin(schema.programmes, eq(users.programmeId, schema.programmes.id))
      .where(eq(documents.id, Number(req.params.id)));

    if (!row) return res.status(404).json({ success: false, error: 'Document not found.' });

    const doc = row.document;
    const stu = row.user || {};
    const dept = row.department || {};
    const prog = row.programme || {};

    const studentName = `${stu.firstName || ''} ${stu.lastName || ''}`.trim() || 'Student';
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const docType = (doc.type || 'document').toUpperCase();
    const photoUrl = stu.photoUrl || stu.idCardPhotoUrl || null;

    let bodyHtml = '';

    if (doc.type === 'id-card') {
      bodyHtml = `
        <div style="width: 360px; margin: 0 auto; border-radius: 14px; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.15); background: #fff; font-family: 'Inter', sans-serif;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #065f46, #047857); color: #fff; padding: 1rem 1.2rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: .62rem; text-transform: uppercase; letter-spacing: 1px; color: #a7f3d0; font-weight: 700;">Federal Polytechnic Ugep</div>
              <div style="font-weight: 800; font-size: 1rem; letter-spacing: .02em;">STUDENT ID CARD</div>
            </div>
            <div style="width: 44px; height: 44px; background: #f59e0b; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.3rem; color: #065f46;">F</div>
          </div>

          <!-- Body -->
          <div style="padding: 1.2rem; display: flex; gap: 1rem;">
            <!-- Photo -->
            <div style="width: 100px; height: 120px; border-radius: 10px; background: ${photoUrl ? `url('${photoUrl}') center/cover` : 'linear-gradient(135deg,#065f46,#f59e0b)'}; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 900; font-size: 2rem; flex-shrink: 0; border: 2px solid #f1f5f9;">
              ${photoUrl ? '' : (stu.firstName || 'S')[0].toUpperCase()}
            </div>
            
            <!-- Info -->
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 800; color: #065f46; font-size: 1.05rem; margin-bottom: .5rem; line-height: 1.2;">${studentName}</div>
              
              <div style="font-size: .78rem; color: #475569; display: flex; flex-direction: column; gap: .35rem;">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e5e7eb; padding-bottom: .25rem;">
                  <span style="color: #64748b;">Matric</span>
                  <strong style="color: #0f172a;">${stu.matricNumber || '—'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e5e7eb; padding-bottom: .25rem;">
                  <span style="color: #64748b;">Level</span>
                  <strong style="color: #0f172a;">${stu.level || '—'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e5e7eb; padding-bottom: .25rem;">
                  <span style="color: #64748b;">Programme</span>
                  <strong style="color: #0f172a; text-align: right; font-size: .72rem;">${prog.name || '—'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #64748b;">Dept</span>
                  <strong style="color: #0f172a; text-align: right; font-size: .72rem;">${dept.name || '—'}</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="padding: .55rem 1rem; background: #f9fafb; text-align: center; font-size: .6rem; letter-spacing: 1.5px; color: #6b7280; text-transform: uppercase; border-top: 1px solid #e5e7eb;">
            Valid Until Graduation · ${today}
          </div>
        </div>
      `;
    } else {
      // Default: transcript, certificate, attestation, letter
      bodyHtml = `
        <div style="max-width: 650px; margin: 0 auto; padding: 2.5rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; font-family: 'Times New Roman', serif;">
          
          <!-- Letterhead -->
          <div style="text-align: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 3px double #065f46;">
            <div style="width: 60px; height: 60px; background: #065f46; color: #f59e0b; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.6rem; margin-bottom: .5rem;">F</div>
            <h1 style="margin: 0; color: #065f46; font-size: 1.5rem; letter-spacing: .03em;">FEDERAL POLYTECHNIC UGEP</h1>
            <p style="margin: .3rem 0 0; color: #64748b; font-size: .8rem;">P.M.B. 1038, Ugep, Cross River State, Nigeria</p>
          </div>

          <!-- Title -->
          <h2 style="text-align: center; color: #0f172a; text-transform: uppercase; font-size: 1rem; letter-spacing: 2px; margin-bottom: 2rem; text-decoration: underline;">${docType}</h2>

          <!-- Body text -->
          <p style="color: #0f172a; line-height: 1.9; font-size: .92rem;">
            This is to certify that <strong>${studentName}</strong> with Matric Number <strong>${stu.matricNumber || '—'}</strong> 
            is a bona fide student of Federal Polytechnic Ugep, currently enrolled in the following programme:
          </p>

          <table style="width: 100%; margin: 1.5rem 0; font-size: .9rem; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: .6rem 0; color: #64748b; width: 40%;">Programme</td>
              <td style="padding: .6rem 0; text-align: right; font-weight: 700; color: #0f172a;">${prog.name || '—'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: .6rem 0; color: #64748b;">Department</td>
              <td style="padding: .6rem 0; text-align: right; font-weight: 700; color: #0f172a;">${dept.name || '—'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: .6rem 0; color: #64748b;">Level</td>
              <td style="padding: .6rem 0; text-align: right; font-weight: 700; color: #0f172a;">${stu.level || '—'}</td>
            </tr>
            <tr>
              <td style="padding: .6rem 0; color: #64748b;">Session</td>
              <td style="padding: .6rem 0; text-align: right; font-weight: 700; color: #0f172a;">2025/2026</td>
            </tr>
          </table>

          <p style="color: #0f172a; line-height: 1.9; font-size: .92rem;">
            ${doc.remarks || `This document is issued at the request of the student for official purposes.`}
          </p>

          <!-- Signature -->
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 3.5rem;">
            <div style="color: #64748b; font-size: .78rem;">
              <div>Date: ${today}</div>
            </div>
            <div style="text-align: center;">
              <div style="border-top: 1px solid #0f172a; padding-top: .4rem; min-width: 180px;">
                <div style="font-weight: 800; font-size: .85rem;">REGISTRAR</div>
                <div style="font-size: .7rem; color: #64748b;">Signature / Stamp</div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; text-align: center; font-size: .68rem; color: #94a3b8;">
            This is a computer-generated document and is valid without a physical signature.
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