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
    // Fetch the document + full joined student details
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

    const doc  = row.document;
    const stu  = row.user || {};
    const dept = row.department || {};
    const prog = row.programme || {};

    // ✅ If the requesting user is NOT a student, look for the real student via document metadata
    let studentName = `${stu.firstName || ''} ${stu.lastName || ''}`.trim();
    let matricNumber = stu.matricNumber || '';
    let level = stu.level || '';
    let deptName = dept.name || '';
    let progName = prog.name || '';
    let photoUrl = stu.photoUrl || stu.idCardPhotoUrl || null;

    // If the user is an admin/staff, the metadata should carry the actual student
    if (stu.role && stu.role !== 'student') {
      const meta = doc.metadata || {};
      if (meta.studentName) studentName = meta.studentName;
      if (meta.matricNumber) matricNumber = meta.matricNumber;
      if (meta.level) level = meta.level;
      if (meta.department) deptName = meta.department;
      if (meta.programme) progName = meta.programme;
      if (meta.photoUrl) photoUrl = meta.photoUrl;
    }

    if (!studentName) studentName = 'Student';

    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const docType = (doc.type || 'document').toUpperCase();
    const escapeHtml = (value) => String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const signerRows = doc.issuedBy
      ? await db.select().from(users).where(eq(users.id, doc.issuedBy)).limit(1)
      : [];
    const signer = signerRows[0] || null;
    const signerHtml = signer && signer.signatureUrl
      ? `<img src="${escapeHtml(signer.signatureUrl)}" alt="Authorised electronic signature" style="display:block;max-width:170px;max-height:58px;object-fit:contain;margin:0 auto 5px;" />`
      : '<div style="height:48px;"></div>';

    // Institution logo
    const LOGO_URL = '/images/logo.png';
    const logoSrc = `${req.protocol}://${req.get('host')}${LOGO_URL}`;

    let bodyHtml = '';

    // ---------- ID CARD (No watermark) ----------
    if (doc.type === 'id-card') {
      bodyHtml = `
        <div style="width: 360px; margin: 0 auto; border-radius: 14px; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.15); background: #fff; font-family: 'Inter', sans-serif;">
          
          <div style="background: linear-gradient(135deg, #065f46, #047857); color: #fff; padding: 1rem 1.2rem; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: .7rem;">
              <img src="${logoSrc}" alt="FPU Logo" style="width: 42px; height: 42px; object-fit: contain; background: #fff; padding: 3px; border-radius: 8px;" onerror="this.style.display='none'" />
              <div>
                <div style="font-size: .62rem; text-transform: uppercase; letter-spacing: 1px; color: #a7f3d0; font-weight: 700;">Federal Polytechnic Ugep</div>
                <div style="font-weight: 800; font-size: 1rem; letter-spacing: .02em;">STUDENT ID CARD</div>
              </div>
            </div>
            <div style="width: 40px; height: 40px; background: #f59e0b; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.2rem; color: #065f46;">F</div>
          </div>

          <div style="padding: 1.2rem; display: flex; gap: 1rem;">
            <div style="width: 100px; height: 120px; border-radius: 10px; background: ${photoUrl ? `url('${photoUrl}') center/cover` : 'linear-gradient(135deg,#065f46,#f59e0b)'}; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 900; font-size: 2rem; flex-shrink: 0; border: 2px solid #f1f5f9;">
              ${photoUrl ? '' : (stu.firstName || 'S')[0].toUpperCase()}
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 800; color: #065f46; font-size: 1.05rem; margin-bottom: .5rem; line-height: 1.2;">${studentName}</div>
              <div style="font-size: .78rem; color: #475569; display: flex; flex-direction: column; gap: .35rem;">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e5e7eb; padding-bottom: .25rem;">
                  <span style="color: #64748b;">Matric</span>
                  <strong style="color: #0f172a;">${matricNumber || '—'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e5e7eb; padding-bottom: .25rem;">
                  <span style="color: #64748b;">Level</span>
                  <strong style="color: #0f172a;">${level || '—'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e5e7eb; padding-bottom: .25rem;">
                  <span style="color: #64748b;">Programme</span>
                  <strong style="color: #0f172a; text-align: right; font-size: .72rem;">${progName || '—'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #64748b;">Dept</span>
                  <strong style="color: #0f172a; text-align: right; font-size: .72rem;">${deptName || '—'}</strong>
                </div>
              </div>
            </div>
          </div>

          <div style="padding: .55rem 1rem; background: #f9fafb; text-align: center; font-size: .6rem; letter-spacing: 1.5px; color: #6b7280; text-transform: uppercase; border-top: 1px solid #e5e7eb;">
            Valid Until Graduation · ${today}
          </div>
        </div>
      `;
    } else if (doc.type === 'clearance') {
      bodyHtml = `
        <div style="position:relative;max-width:850px;min-height:1050px;margin:0 auto;padding:42px;background:#fff;border:8px double #065f46;box-sizing:border-box;font-family:Georgia,serif;overflow:hidden;">
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;"><img src="${logoSrc}" alt="" style="width:430px;height:430px;object-fit:contain;opacity:.055;" /></div>
          <div style="position:relative;z-index:1;">
            <div style="display:flex;align-items:center;justify-content:center;gap:18px;border-bottom:3px solid #065f46;padding-bottom:22px;text-align:center;"><img src="${logoSrc}" alt="FPU Logo" style="width:82px;height:82px;object-fit:contain;"/><div><div style="font-family:Arial,sans-serif;font-size:23px;font-weight:900;letter-spacing:1px;color:#065f46;">FEDERAL POLYTECHNIC UGEP</div><div style="font-size:12px;color:#64748b;margin-top:5px;">P.M.B. 1038, Ugep, Cross River State, Nigeria</div><div style="font-size:10px;color:#a16207;font-weight:800;letter-spacing:2px;margin-top:7px;">OFFICE OF THE REGISTRAR</div></div></div>
            <div style="text-align:center;margin:48px 0 38px;"><div style="font:800 11px Arial,sans-serif;letter-spacing:3px;color:#a16207;">OFFICIAL STUDENT DOCUMENT</div><h1 style="font:900 31px Arial,sans-serif;letter-spacing:3px;color:#064e3b;margin:14px 0;">CLEARANCE CERTIFICATE</h1><div style="height:3px;width:110px;background:#c9a84c;margin:0 auto;"></div><p style="font:11px Arial,sans-serif;color:#64748b;margin-top:14px;">REFERENCE: FPU/CLR/${String(doc.id).padStart(6,'0')}</p></div>
            <p style="font-size:18px;line-height:2.1;color:#1f2937;">This document is issued to <strong style="color:#065f46;">${escapeHtml(studentName)}</strong>, Matriculation Number <strong>${escapeHtml(matricNumber || '—')}</strong>, of the Department of <strong>${escapeHtml(deptName || '—')}</strong>, enrolled in <strong>${escapeHtml(progName || '—')}</strong> (${escapeHtml(level || '—')}).</p>
            <div style="margin:35px 0;padding:22px;background:#f0fdf4;border-left:5px solid #065f46;"><div style="font:800 10px Arial,sans-serif;letter-spacing:2px;color:#64748b;">REQUESTED DOCUMENT</div><div style="font:bold 17px Arial,sans-serif;color:#0f172a;margin-top:8px;">${escapeHtml(doc.title || 'Student clearance')}</div><p style="font-size:13px;line-height:1.8;color:#475569;margin-bottom:0;">This certificate records the institution's response to the student's clearance-document request. The official clearance status remains subject to the institution's clearance register.</p></div>
            <p style="font-size:15px;line-height:2;color:#334155;">Issued on ${today} for presentation to the relevant authority. The authenticity of this document may be confirmed through the institution.</p>
            <div style="display:flex;justify-content:space-between;gap:35px;margin-top:100px;"><div style="width:45%;text-align:center;">${signerHtml}<div style="border-top:1px solid #111;padding-top:8px;font:800 12px Arial,sans-serif;">${signer ? escapeHtml((signer.firstName+' '+signer.lastName).trim()) : 'BURSAR / AUTHORISED OFFICER'}</div><div style="font:10px Arial,sans-serif;color:#64748b;margin-top:4px;">${signer ? escapeHtml(String(signer.role||'').replace(/_/g,' ').toUpperCase()) : 'FINANCE CLEARANCE'}</div></div><div style="width:45%;text-align:center;"><div style="height:48px;"></div><div style="border-top:1px solid #111;padding-top:8px;font:800 12px Arial,sans-serif;">REGISTRAR</div><div style="font:10px Arial,sans-serif;color:#64748b;margin-top:4px;">For the Institution</div></div></div>
            <div style="margin-top:60px;padding-top:12px;border-top:1px solid #dbe4dc;text-align:center;font:10px Arial,sans-serif;color:#64748b;letter-spacing:1px;">FEDERAL POLYTECHNIC UGEP · FPU/CLR/${String(doc.id).padStart(6,'0')}</div>
          </div>
        </div>
      `;
    } else if (doc.type === 'certificate') {
      bodyHtml = `
        <div style="position:relative;max-width:900px;min-height:1050px;margin:0 auto;padding:55px;border:14px solid #064e3b;outline:3px solid #c9a84c;outline-offset:-28px;background:#fffdf7;box-sizing:border-box;font-family:Georgia,serif;overflow:hidden;">
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;"><img src="${logoSrc}" alt="" style="width:470px;height:470px;object-fit:contain;opacity:.055;"/></div>
          <div style="position:relative;z-index:1;text-align:center;padding:30px 20px;">
            <img src="${logoSrc}" alt="Federal Polytechnic Ugep crest" style="width:110px;height:110px;object-fit:contain;"/>
            <div style="font:900 27px Arial,sans-serif;letter-spacing:2px;color:#064e3b;margin-top:12px;">FEDERAL POLYTECHNIC UGEP</div><div style="font:800 11px Arial,sans-serif;letter-spacing:3px;color:#9a741b;margin-top:6px;">CROSS RIVER STATE · NIGERIA</div>
            <div style="width:160px;height:3px;background:#c9a84c;margin:32px auto;"></div><div style="font:900 40px Arial,sans-serif;letter-spacing:6px;color:#0f172a;">CERTIFICATE</div><div style="font:700 12px Arial,sans-serif;letter-spacing:4px;color:#64748b;margin-top:8px;">OF OFFICIAL RECORD</div>
            <p style="font-size:20px;color:#475569;font-style:italic;margin:55px 0 18px;">This certificate is respectfully issued to</p>
            <div style="font-size:35px;font-weight:bold;color:#064e3b;border-bottom:2px solid #c9a84c;display:inline-block;min-width:75%;padding:0 10px 14px;">${escapeHtml(studentName)}</div>
            <p style="font-size:17px;line-height:2;color:#334155;margin:38px auto;">Matriculation Number: <strong>${escapeHtml(matricNumber || '—')}</strong><br/>Department: <strong>${escapeHtml(deptName || '—')}</strong><br/>Programme: <strong>${escapeHtml(progName || '—')}</strong> · Level: <strong>${escapeHtml(level || '—')}</strong></p>
            <p style="font-size:16px;line-height:1.9;color:#475569;max-width:650px;margin:25px auto;">In recognition of the official record described as <strong>${escapeHtml(doc.title || 'Certificate request')}</strong>. This certificate is issued subject to verification of the institution's records.</p>
            <div style="display:flex;justify-content:space-between;gap:55px;margin:100px 30px 0;"><div style="width:45%;text-align:center;">${signerHtml}<div style="border-top:1px solid #111;padding-top:8px;font:800 12px Arial,sans-serif;">REGISTRAR</div></div><div style="width:45%;text-align:center;"><div style="height:48px;"></div><div style="border-top:1px solid #111;padding-top:8px;font:800 12px Arial,sans-serif;">RECTOR</div></div></div>
            <div style="font:10px Arial,sans-serif;color:#64748b;letter-spacing:1px;margin-top:55px;">ISSUED ${today} · CERTIFICATE NO: FPU/CERT/${String(doc.id).padStart(6,'0')}</div>
          </div>
        </div>
      `;
    } else if (doc.type === 'attestation' || doc.type === 'attestation-letter') {
      bodyHtml = `
        <div style="position:relative;max-width:850px;margin:0 auto;padding:48px;background:#fff;border:1px solid #dbe4dc;font-family:Georgia,serif;overflow:hidden;">
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;"><img src="${logoSrc}" alt="" style="width:410px;height:410px;object-fit:contain;opacity:.055;"/></div>
          <div style="position:relative;z-index:1;">
            <div style="display:flex;align-items:center;gap:20px;border-bottom:4px double #065f46;padding-bottom:20px;"><img src="${logoSrc}" alt="FPU Logo" style="width:80px;height:80px;object-fit:contain;"/><div><div style="font:900 24px Arial,sans-serif;color:#065f46;letter-spacing:1px;">FEDERAL POLYTECHNIC UGEP</div><div style="font:12px Arial,sans-serif;color:#64748b;margin-top:6px;">P.M.B. 1038, Ugep, Cross River State, Nigeria</div><div style="font:800 10px Arial,sans-serif;letter-spacing:2px;color:#a16207;margin-top:7px;">OFFICE OF THE REGISTRAR</div></div></div>
            <div style="display:flex;justify-content:space-between;margin:34px 0;font:13px Arial,sans-serif;color:#475569;"><span>Our Ref: FPU/REG/ATT/${String(doc.id).padStart(6,'0')}</span><span>Date: ${today}</span></div>
            <h1 style="text-align:center;font:800 22px Arial,sans-serif;letter-spacing:2px;color:#064e3b;text-decoration:underline;margin:30px 0 42px;">ATTESTATION LETTER</h1>
            <p style="font-size:16px;line-height:2.1;text-align:justify;">This is to attest that <strong>${escapeHtml(studentName)}</strong>, Matriculation Number <strong>${escapeHtml(matricNumber || '—')}</strong>, is recorded as a student of Federal Polytechnic Ugep in the <strong>${escapeHtml(deptName || '—')}</strong> Department, studying <strong>${escapeHtml(progName || '—')}</strong> at <strong>${escapeHtml(level || '—')}</strong> level.</p>
            <p style="font-size:16px;line-height:2.1;text-align:justify;">This letter is issued upon the student's request for the stated purpose: <strong>${escapeHtml(doc.title || 'Official use')}</strong>. It reflects the details available in the institution's records as at the date of issue.</p>
            <p style="font-size:16px;line-height:2.1;">Yours faithfully,</p><div style="margin-top:70px;text-align:right;">${signerHtml}<div style="display:inline-block;border-top:1px solid #111;min-width:220px;padding-top:8px;text-align:center;font:800 12px Arial,sans-serif;">REGISTRAR</div></div>
            <div style="margin-top:65px;border-top:1px solid #e2e8f0;padding-top:12px;text-align:center;font:10px Arial,sans-serif;color:#64748b;">This document is issued by Federal Polytechnic Ugep and may be verified with the Registry.</div>
          </div>
        </div>
      `;
    } else {
      // ---------- Existing general document layout (including transcript) ----------
      bodyHtml = `
        <div style="position: relative; max-width: 650px; margin: 0 auto; padding: 2.5rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; font-family: 'Times New Roman', serif; overflow: hidden;">
          
          <!-- ✅ Watermark (faded logo in background) -->
          <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 0; pointer-events: none;">
            <img src="${logoSrc}" alt="" style="width: 380px; height: 380px; object-fit: contain; opacity: 0.06; transform: rotate(-20deg);" onerror="this.style.display='none'" />
          </div>

          <div style="position: relative; z-index: 1;">
            <!-- Letterhead with logo -->
            <div style="text-align: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 3px double #065f46; display: flex; flex-direction: column; align-items: center;">
              <img src="${logoSrc}" alt="FPU Logo" style="width: 70px; height: 70px; object-fit: contain; margin-bottom: .5rem;" onerror="this.style.display='none'" />
              <h1 style="margin: 0; color: #065f46; font-size: 1.5rem; letter-spacing: .03em;">FEDERAL POLYTECHNIC UGEP</h1>
              <p style="margin: .3rem 0 0; color: #64748b; font-size: .8rem;">P.M.B. 1038, Ugep, Cross River State, Nigeria</p>
            </div>

            <h2 style="text-align: center; color: #0f172a; text-transform: uppercase; font-size: 1rem; letter-spacing: 2px; margin-bottom: 2rem; text-decoration: underline;">${docType}</h2>

            <p style="color: #0f172a; line-height: 1.9; font-size: .92rem;">
              This is to certify that <strong>${studentName}</strong> with Matric Number <strong>${matricNumber || '—'}</strong> 
              is a bona fide student of Federal Polytechnic Ugep, currently enrolled in the following programme:
            </p>

            <table style="width: 100%; margin: 1.5rem 0; font-size: .9rem; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: .6rem 0; color: #64748b; width: 40%;">Programme</td>
                <td style="padding: .6rem 0; text-align: right; font-weight: 700; color: #0f172a;">${progName || '—'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: .6rem 0; color: #64748b;">Department</td>
                <td style="padding: .6rem 0; text-align: right; font-weight: 700; color: #0f172a;">${deptName || '—'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: .6rem 0; color: #64748b;">Level</td>
                <td style="padding: .6rem 0; text-align: right; font-weight: 700; color: #0f172a;">${level || '—'}</td>
              </tr>
              <tr>
                <td style="padding: .6rem 0; color: #64748b;">Session</td>
                <td style="padding: .6rem 0; text-align: right; font-weight: 700; color: #0f172a;">2025/2026</td>
              </tr>
            </table>

            <p style="color: #0f172a; line-height: 1.9; font-size: .92rem;">
              ${doc.remarks || `This document is issued at the request of the student for official purposes.`}
            </p>

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

            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; text-align: center; font-size: .68rem; color: #94a3b8;">
              This is a computer-generated document and is valid without a physical signature.
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