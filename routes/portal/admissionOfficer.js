// ============================================================
// FPU — Admissions Officer portal API
// Mounted at /api/admission-officer
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries = require('../../db/queries/users');
const appQueries = require('../../db/queries/applications');
const sessionQueries = require('../../db/queries/sessions');
const { requireRole } = require('../../middleware/auth');
const { logAudit } = require('../../utils/audit');
const { sendApplicationApproved, sendApplicationRejected, sendRegistrationComplete } = require('../../utils/emailService');
const { hashPassword } = require('../../utils/password');
const { assignFIFOMatric } = require('../../utils/matricHelper');
const { getMatricPrefix } = require('../../db/queries/settings');
const { getYearShort } = require('../../config/departments');
const courseQueries = require('../../db/queries/courses');
const path = require('path');
const fs = require('fs');

const only = requireRole('admission_officer', 'admin', 'registrar');

// ============================================================
// GET /api/admission-officer/dashboard
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
// GET /api/admission-officer/applications
// Returns applications WITH programme / department / school names.
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

    // Flatten the joins into the top-level shape the frontend expects
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
// GET /api/admission-officer/applications/:id
// Returns a single application with relation names attached.
// ============================================================
router.get('/applications/:id', only, async (req, res, next) => {
  try {
    const data = await appQueries.findByIdWithRelations(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'Application not found.' });
    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/admission-officer/applications/:id/documents
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
// POST /api/admission-officer/applications/:id/verify-documents
// ============================================================
router.post('/applications/:id/verify-documents', only, async (req, res, next) => {
  try {
    const app = await appQueries.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });

    const updated = await appQueries.verifyDocuments(app.id, req.user.id);
    await logAudit({
      req, action: 'admission.verify_documents', entity: 'application', entityId: app.id,
    });
    return res.json({ success: true, data: updated });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/admission-officer/applications/:id/matriculate
// ============================================================
router.post('/applications/:id/matriculate', only, async (req, res, next) => {
  try {
    const app = await appQueries.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });

    if (!['registered', 'approved'].includes(app.status)) {
      return res.status(400).json({
        success: false,
        error: 'Application must be approved or registered before matriculation.',
      });
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
    await logAudit({
      req, action: 'admission.matriculate', entity: 'application', entityId: app.id,
      after: { matricNumber },
    });
    return res.json({ success: true, data: updated });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/admission-officer/applications/:id/letter/:type/sent
// ============================================================
router.post('/applications/:id/letter/:type/sent', only, async (req, res, next) => {
  try {
    const app = await appQueries.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });

    const MAP = {
      provisional:   1,
      acceptance:    2,
      matriculation: 3,
    };

    const which = MAP[req.params.type];
    if (!which) {
      return res.status(400).json({
        success: false,
        error: `Unknown letter type "${req.params.type}".`,
      });
    }

    const updated = await appQueries.markLetterSent(app.id, which);
    await logAudit({
      req, action: `admission.letter_${req.params.type}_sent`,
      entity: 'application', entityId: app.id,
    });
    return res.json({ success: true, data: updated });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/admission-officer/applications/:id/approve
// ============================================================
router.post('/applications/:id/approve', only, async (req, res, next) => {
  try {
    const app = await appQueries.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });
    const updated = await appQueries.setStatus(app.id, 'approved', { reviewedBy: req.user.id });
    await sendApplicationApproved(updated).catch(() => {});
    await logAudit({ req, action: 'admission.approve', entity: 'application', entityId: app.id });
    return res.json({ success: true, data: updated });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/admission-officer/applications/:id/reject
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
    await sendApplicationRejected(updated, reason).catch(() => {});
    await logAudit({ req, action: 'admission.reject', entity: 'application', entityId: app.id });
    return res.json({ success: true, data: updated });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/admission-officer/applications/:id/register
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
    if (!departmentId || !programmeId) {
      return res.status(400).json({ success: false, error: 'departmentId and programmeId are required.' });
    }

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
    await sendRegistrationComplete(user).catch(() => {});
    await logAudit({ req, action: 'admission.register', entity: 'application', entityId: app.id, after: { userId: user.id, matric } });

    return res.json({ success: true, data: { user, matricNumber: matric } });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/admission-officer/admitted
// Returns approved + registered + matriculated WITH relations.
// ============================================================
router.get('/admitted', only, async (req, res, next) => {
  try {
    const rows = await appQueries.listWithRelations({
      status: ['approved', 'registered', 'matriculated'],
      limit: 500,
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
// GET /api/admission-officer/letters/:id
// ============================================================
router.get('/letters/:id', only, async (req, res, next) => {
  try {
    const app = await appQueries.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });
    if (!['approved', 'registered', 'matriculated'].includes(app.status)) {
      return res.status(400).json({ success: false, error: 'Admission letter is available only after approval.' });
    }
    const { baseTemplate } = require('../../utils/emailService');
    const html = baseTemplate('Admission Letter', `
      <p>Dear <strong>${app.firstName} ${app.lastName}</strong>,</p>
      <p>We are pleased to offer you admission into <strong>Federal Polytechnic Ugep</strong>.</p>
      <p><strong>Application Number:</strong> ${app.applicationNumber}<br/>
         <strong>Programme Level:</strong> ${app.type || app.level}</p>
      <p>Please log in to the portal to complete your registration.</p>
      <p>Signed,<br/><strong>Admissions Office</strong></p>
    `);
    return res.json({ success: true, html, application: app });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/admission-officer/reports
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
// GET /api/admission-officer/profile, /security
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

module.exports = router;