// ============================================================
// FPU — Admissions Officer portal API
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { eq } = require('drizzle-orm');

const userQueries = require('../../db/queries/users');
const appQueries = require('../../db/queries/applications');
const sessionQueries = require('../../db/queries/sessions');
const { requireRole } = require('../../middleware/auth');
const { logAudit } = require('../../utils/audit');
const { 
  sendApplicationApproved, 
  sendApplicationRejected, 
  sendRegistrationComplete,
  sendMatriculationLetter,
  sendRejectionLetter,
  baseTemplate,
  sendMail
} = require('../../utils/emailService');
const { hashPassword } = require('../../utils/password');
const { assignFIFOMatric } = require('../../utils/matricHelper');
const { getMatricPrefix } = require('../../db/queries/settings');
const { getYearShort } = require('../../config/departments');
const courseQueries = require('../../db/queries/courses');
const { db, schema } = require('../../db');
const { users } = schema;

const only = requireRole('admission_officer', 'admin', 'registrar');

// Setup multer for signature uploads
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR });

// ============================================================
// POST /profile/signature
// ============================================================
router.post('/profile/signature', only, upload.single('signature'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });
    
    const ext = path.extname(req.file.originalname) || '.png';
    const newName = `signature-${req.user.id}-${Date.now()}${ext}`;
    const newPath = path.join(UPLOAD_DIR, newName);
    fs.renameSync(req.file.path, newPath);
    
    const signatureUrl = `/uploads/${newName}`;
    await db.update(users).set({ signatureUrl }).where(eq(users.id, req.user.id));
    
    return res.json({ success: true, signatureUrl });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /applications/:id/email
// Send a single letter to a specific applicant
// ============================================================
router.post('/applications/:id/email', only, async (req, res, next) => {
  try {
    const app = await appQueries.findByIdWithRelations(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });

    const type = String(req.body?.type || 'provisional');

    let r;
    if (type === 'provisional')       r = await sendApplicationApproved(app);
    else if (type === 'acceptance')   r = await sendMail({
      to: app.email,
      subject: `Acceptance Acknowledged — ${app.applicationNumber}`,
      html: baseTemplate('Acceptance Confirmation', `
        <p>Dear <strong>${app.firstName} ${app.lastName}</strong>,</p>
        <p>Your acceptance of the offer of admission has been received and recorded.</p>
        <p>Please complete your registration at the Admissions Office.</p>
        <p>Warm regards,<br/><strong>Admissions Office</strong></p>
      `),
    });
    else if (type === 'matriculation') r = await sendMatriculationLetter(app);
    else if (type === 'rejection')     r = await sendRejectionLetter(app);

    if (!r) throw new Error('Unknown letter type.');
    if (r.skipped) return res.status(400).json({ success: false, error: 'Email service disabled (check config).' });
    if (!r.ok) throw new Error(r.error || 'Failed to send.');

    // Mark as sent in DB
    const MAP = { provisional: 1, acceptance: 2, matriculation: 3 };
    if (MAP[type]) await appQueries.markLetterSent(app.id, MAP[type]);

    return res.json({ success: true, message: 'Email sent successfully.' });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /bulk/email
// Send letters in bulk
// ============================================================
router.post('/bulk/email', only, async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
    const type = String(req.body?.type || '').trim();

    const ALLOWED = ['provisional', 'acceptance', 'matriculation', 'rejection'];
    if (!ALLOWED.includes(type)) {
      return res.status(400).json({ success: false, error: `type must be one of: ${ALLOWED.join(', ')}` });
    }
    if (!ids.length) return res.status(400).json({ success: false, error: 'ids array is required.' });

    const results = { ok: [], failed: [], skipped: 0 };

    for (const id of ids) {
      try {
        const enriched = await appQueries.findByIdWithRelations(id);
        if (!enriched) { results.failed.push({ id, error: 'Not found.' }); continue; }

        let r;
        if (type === 'provisional')       r = await sendApplicationApproved(enriched);
        else if (type === 'acceptance')   r = await sendMail({
          to: enriched.email,
          subject: `Acceptance Acknowledged — ${enriched.applicationNumber}`,
          html: baseTemplate('Acceptance Confirmation', `
            <p>Dear <strong>${enriched.firstName} ${enriched.lastName}</strong>,</p>
            <p>Your acceptance of the offer of admission has been received and recorded.</p>
            <p>Please complete your registration at the Admissions Office.</p>
            <p>Warm regards,<br/><strong>Admissions Office</strong></p>
          `),
        });
        else if (type === 'matriculation') r = await sendMatriculationLetter(enriched);
        else if (type === 'rejection')     r = await sendRejectionLetter(enriched);

        if (r && r.ok)          results.ok.push({ id });
        else if (r && r.skipped) results.skipped++;
        else                     results.failed.push({ id, error: r?.error || 'Unknown error.' });
      } catch (err) {
        results.failed.push({ id, error: err.message });
      }
    }

    return res.json({ success: true, data: results });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /dashboard
// ============================================================
router.get('/dashboard', only, async (_req, res, next) => {
  try {
    const byStatus = await appQueries.countByStatus({});
    const totals = byStatus.reduce((a, r) => ({ ...a, [r.status]: r.c }), {});
    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    return res.json({
      success: true,
      data: { total, byStatus: totals, currentSession: await sessionQueries.getCurrentAcademic() },
    });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /applications
// ============================================================
router.get('/applications', only, async (req, res, next) => {
  try {
    const rows = await appQueries.listWithRelations({
      status: req.query.status,
      type: req.query.type,
      search: req.query.search,
      programmeId: req.query.programmeId,
      departmentId: req.query.departmentId,
      schoolId: req.query.schoolId,
      limit: req.query.limit ? Number(req.query.limit) : 500,
    });

    const data = rows.map((r) => ({
      ...r.application,
      programmeName:  r.programme?.name  || r.programme?.title || null,
      departmentName: r.department?.name || null,
      schoolName:     r.school?.name     || null,
    }));

    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /applications/:id
// ============================================================
router.get('/applications/:id', only, async (req, res, next) => {
  try {
    const data = await appQueries.findByIdWithRelations(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'Application not found.' });
    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /applications/:id/documents
// ============================================================
router.get('/applications/:id/documents', only, async (req, res, next) => {
  try {
    const app = await appQueries.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });

    let olevel = app.oLevelResult;
    if (typeof olevel === 'string') {
      try { olevel = JSON.parse(olevel); } catch { olevel = {}; }
    }
    const docs = (olevel && olevel.documents) || {};

    const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');

    const present = (url) => {
      if (!url) return false;
      const filename = path.basename(String(url));
      try {
        return fs.existsSync(path.join(uploadsDir, filename));
      } catch {
        return false;
      }
    };

    const SLOTS = [
      { key: 'olevel',   label: "O'Level Result",                 url: docs.olevel   || null },
      { key: 'birth',    label: 'Birth Cert / Age Declaration',   url: docs.birth    || null },
      { key: 'lga',      label: 'LGA Certificate (optional)',     url: docs.lga      || null },
      { key: 'passport', label: 'Passport Photograph',            url: docs.passport || null },
      { key: 'ndCert',   label: 'ND Certificate (HND only)',      url: docs.ndCert   || null },
      { key: 'siwes',    label: 'SIWES Certificate (HND only)',   url: docs.siwes    || null },
    ];

    const data = SLOTS.map((s) => ({
      key: s.key,
      label: s.label,
      url: s.url,
      exists: present(s.url),
    }));

    return res.json({
      success: true,
      data,
      verified: {
        at: app.documentsVerifiedAt || null,
        by: app.documentsVerifiedBy || null,
      },
    });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /applications/:id/verify-documents
// ============================================================
router.post('/applications/:id/verify-documents', only, async (req, res, next) => {
  try {
    const app = await appQueries.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });

    const updated = await appQueries.verifyDocuments(app.id, req.user.id);
    await logAudit({ req, action: 'admission.verify_documents', entity: 'application', entityId: app.id });
    return res.json({ success: true, data: updated });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /applications/:id/matriculate
// ============================================================
router.post('/applications/:id/matriculate', only, async (req, res, next) => {
  try {
    const app = await appQueries.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });

    if (!['registered', 'approved'].includes(app.status)) {
      return res.status(400).json({ success: false, error: 'Application must be approved or registered before matriculation.' });
    }

    let matricNumber = String(req.body?.matricNumber || app.matricNumber || '').trim();

    if (!matricNumber) {
      const dept = app.departmentId ? await courseQueries.findDepartmentById(app.departmentId) : null;
      const school = await courseQueries.findSchoolById(app.schoolId || dept?.schoolId);
      const prefix = await getMatricPrefix();
      matricNumber = await assignFIFOMatric({
        prefix,
        schoolCode: school?.code || 'SST',
        deptCode: dept?.code || 'GEN',
        level: app.level || 'ND',
        year: getYearShort(new Date()),
      });
    }

    const updated = await appQueries.setMatricNumber(app.id, matricNumber);
    await logAudit({ req, action: 'admission.matriculate', entity: 'application', entityId: app.id, after: { matricNumber } });
    return res.json({ success: true, data: updated });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /applications/:id/letter/:type/sent
// ============================================================
router.post('/applications/:id/letter/:type/sent', only, async (req, res, next) => {
  try {
    const app = await appQueries.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });

    const MAP = { provisional: 1, acceptance: 2, matriculation: 3 };
    const which = MAP[req.params.type];
    if (!which) return res.status(400).json({ success: false, error: `Unknown letter type "${req.params.type}".` });

    const updated = await appQueries.markLetterSent(app.id, which);
    await logAudit({ req, action: `admission.letter_${req.params.type}_sent`, entity: 'application', entityId: app.id });
    return res.json({ success: true, data: updated });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /applications/:id/approve
// ============================================================
router.post('/applications/:id/approve', only, async (req, res, next) => {
  try {
    const app = await appQueries.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });
    const updated = await appQueries.setStatus(app.id, 'approved', { reviewedBy: req.user.id });
    
    Promise.resolve()
      .then(() => sendApplicationApproved(updated))
      .catch((e) => console.error('[admission] approve email failed:', e?.message));
      
    await logAudit({ req, action: 'admission.approve', entity: 'application', entityId: app.id });
    return res.json({ success: true, data: updated });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /applications/:id/reject
// ============================================================
router.post('/applications/:id/reject', only, async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    const app = await appQueries.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });
    const updated = await appQueries.setStatus(app.id, 'rejected', {
      reviewedBy: req.user.id,
      rejectionReason: reason || 'Application did not meet requirements.',
    });
    
    Promise.resolve()
      .then(() => sendApplicationRejected(updated, reason))
      .catch((e) => console.error('[admission] reject email failed:', e?.message));
      
    await logAudit({ req, action: 'admission.reject', entity: 'application', entityId: app.id });
    return res.json({ success: true, data: updated });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /applications/:id/register
// ============================================================
router.post('/applications/:id/register', only, async (req, res, next) => {
  try {
    const app = await appQueries.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });
    if (app.status === 'registered') return res.status(400).json({ success: false, error: 'Already registered.' });
    if (app.status === 'matriculated') return res.status(400).json({ success: false, error: 'Already matriculated.' });
    if (app.status !== 'approved') return res.status(400).json({ success: false, error: 'Application must be approved first.' });

    const existing = await userQueries.findByEmail(app.email);
    if (existing) return res.status(409).json({ success: false, error: 'A user with this email already exists.' });

    const departmentId = Number(req.body?.departmentId || app.departmentId);
    const programmeId = Number(req.body?.programmeId || app.programmeId);
    const level = req.body?.level || app.level || 'ND';
    if (!departmentId || !programmeId) return res.status(400).json({ success: false, error: 'departmentId and programmeId are required.' });

    const dept = await courseQueries.findDepartmentById(departmentId);
    if (!dept) return res.status(400).json({ success: false, error: 'Invalid departmentId.' });
    const school = await courseQueries.findSchoolById(req.body?.schoolId || app.schoolId || dept.schoolId);

    const prefix = await getMatricPrefix();
    const matric = await assignFIFOMatric({
      prefix,
      schoolCode: school?.code || 'SST',
      deptCode: dept.code,
      level,
      year: getYearShort(new Date()),
    });

    const plain = req.body?.password || 'student1234';
    const passwordHash = await hashPassword(plain);

    const user = await userQueries.create({
      email: app.email,
      passwordHash,
      role: 'student',
      firstName: app.firstName,
      lastName: app.lastName,
      middleName: app.middleName,
      phone: app.phone,
      gender: app.gender,
      dateOfBirth: app.dateOfBirth,
      stateOfOrigin: app.stateOfOrigin,
      address: app.address,
      matricNumber: matric,
      level,
      departmentId,
      programmeId,
      schoolId: school?.id || null,
      mustChangePassword: true,
    });

    await appQueries.markRegistered(app.id, { userId: user.id, matricNumber: matric });
    
    Promise.resolve()
      .then(() => sendRegistrationComplete(user))
      .catch((e) => console.error('[admission] register email failed:', e?.message));
      
    await logAudit({ req, action: 'admission.register', entity: 'application', entityId: app.id, after: { userId: user.id, matric } });

    return res.json({ success: true, data: { user, matricNumber: matric } });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /admitted
// ============================================================
router.get('/admitted', only, async (req, res, next) => {
  try {
    const rows = await appQueries.listWithRelations({ status: ['approved', 'registered', 'matriculated'], limit: 500 });
    const data = rows.map((r) => ({
      ...r.application,
      programmeName:  r.programme?.name  || r.programme?.title || null,
      departmentName: r.department?.name || null,
      schoolName:     r.school?.name     || null,
    }));
    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /reports
// ============================================================
router.get('/reports', only, async (_req, res, next) => {
  try {
    const byStatus = await appQueries.countByStatus({});
    const byType = {};
    for (const t of ['ND', 'HND']) {
      byType[t] = await appQueries.countByStatus({ type: t });
    }
    return res.json({ success: true, data: { byStatus, byType } });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /profile, /security
// ============================================================
router.get('/profile', only, async (req, res, next) => {
  try { return res.json({ success: true, data: await userQueries.findByIdWithRelations(req.user.id) }); }
  catch (err) { return next(err); }
});

router.get('/security', only, async (req, res, next) => {
  try {
    const sessions = await sessionQueries.listUserSessions(req.user.id);
    const logins = await require('../../db/queries/audit').listLogins({ userId: req.user.id, limit: 30 });
    return res.json({ success: true, sessions, logins });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /bulk/eligible
// ============================================================
router.get('/bulk/eligible', only, async (_req, res, next) => {
  try {
    const rows = await appQueries.listWithRelations({ status: ['approved', 'registered', 'rejected'], limit: 2000 });
    const flat = rows.map((r) => ({
      ...r.application,
      programmeName:  r.programme?.name  || r.programme?.title || null,
      departmentName: r.department?.name || null,
      departmentCode: r.department?.code || null,
      schoolName:     r.school?.name     || null,
    }));

    const byDept = new Map();
    flat.forEach((a) => {
      const key = a.departmentId || 0;
      if (!byDept.has(key)) {
        byDept.set(key, {
          departmentId:   a.departmentId,
          departmentName: a.departmentName || 'Unassigned Department',
          departmentCode: a.departmentCode || '',
          students: [],
        });
      }
      byDept.get(key).students.push(a);
    });

    const departments = [...byDept.values()].sort((a, b) =>
      String(a.departmentName).localeCompare(String(b.departmentName))
    );

    return res.json({ success: true, data: { departments, total: flat.length } });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /bulk/matriculate
// ============================================================
router.post('/bulk/matriculate', only, async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
    const sendEmails = req.body?.sendEmails !== false;
    if (!ids.length) return res.status(400).json({ success: false, error: 'ids array is required.' });

    const results = { ok: [], failed: [], emailed: 0, emailSkipped: 0 };

    for (const id of ids) {
      try {
        const app = await appQueries.findById(id);
        if (!app) { results.failed.push({ id, error: 'Not found.' }); continue; }
        if (!['approved', 'registered'].includes(app.status)) { results.failed.push({ id, error: `Status "${app.status}" not eligible.` }); continue; }

        if (app.matricNumber) {
          if (sendEmails) {
            const enriched = await appQueries.findByIdWithRelations(id);
            const r = await sendMatriculationLetter(enriched).catch(() => ({ ok: false }));
            if (r.ok) results.emailed++; else results.emailSkipped++;
          }
          results.ok.push({ id, matricNumber: app.matricNumber, alreadyAssigned: true });
          continue;
        }

        const dept = app.departmentId ? await courseQueries.findDepartmentById(app.departmentId) : null;
        const school = await courseQueries.findSchoolById(app.schoolId || dept?.schoolId);
        const prefix = await getMatricPrefix();
        const matric = await assignFIFOMatric({
          prefix,
          schoolCode: school?.code || 'SST',
          deptCode: dept?.code || 'GEN',
          level: app.level || 'ND',
          year: getYearShort(new Date()),
        });

        const updated = await appQueries.setMatricNumber(id, matric);
        await logAudit({ req, action: 'admission.bulk_matriculate', entity: 'application', entityId: id, after: { matric } });

        results.ok.push({ id, matricNumber: matric });

        if (sendEmails) {
          try {
            const enriched = { ...updated, programmeName: null, departmentName: dept?.name || null };
            const r = await sendMatriculationLetter(enriched);
            if (r.ok) results.emailed++; else results.emailSkipped++;
          } catch { results.emailSkipped++; }
        }
      } catch (err) {
        results.failed.push({ id, error: err.message });
      }
    }

    return res.json({ success: true, data: results });
  } catch (err) { return next(err); }
});

module.exports = router;