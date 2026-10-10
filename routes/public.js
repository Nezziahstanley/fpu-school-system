// ============================================================
// FPU — Public API (unauthenticated)
// Mounted at /api
// ------------------------------------------------------------
// Endpoints:
//   POST /api/apply            — ND / Certificate application
//   POST /api/apply-hnd        — HND application
//   GET  /api/apply-status     — check status by number + email
//   POST /api/contact          — contact form
//   POST /api/register-token   — email verification token
//   GET  /api/announcements    — public announcements
//   GET  /api/programmes       — programmes + departments + schools
//   GET  /api/institution      — institution info
//   GET  /api/banks            — bank accounts
//   GET  /api/geo/countries    — public country list
//   GET  /api/geo/states       — public state list per country
//   GET  /api/geo/lgas         — public LGA list per state
// ============================================================

'use strict';

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const appQueries = require('../db/queries/applications');
const notifQueries = require('../db/queries/notifications');
const auditQueries = require('../db/queries/audit');
const courseQueries = require('../db/queries/courses');
const settingsQueries = require('../db/queries/settings');
const userQueries = require('../db/queries/users');
const { sendApplicationReceived } = require('../utils/emailService');
const { logSecurity } = require('../utils/audit');
const geo = require('../config/geo');

// ------------------------------------------------------------
// Save a base64 image data URL to /public/uploads/
// ------------------------------------------------------------
function savePassportPhoto(dataUrl, prefix = 'passport') {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  if (!dataUrl.startsWith('data:image/')) return null;

  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!m) return null;

  const mime = m[1];
  const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!ALLOWED.includes(mime)) return null;

  let buffer;
  try {
    buffer = Buffer.from(m[2], 'base64');
  } catch {
    return null;
  }

  const MAX_BYTES = 5 * 1024 * 1024;
  if (buffer.length > MAX_BYTES) return null;

  const ext = (mime.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';

  const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (e) {
    console.error('[public] mkdir uploads failed:', e.message);
    return null;
  }

  const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
  try {
    fs.writeFileSync(path.join(uploadDir, filename), buffer);
  } catch (e) {
    console.error('[public] write upload failed:', e.message);
    return null;
  }

  return `/uploads/${filename}`;
}

// ------------------------------------------------------------
// POST /api/apply  (ND / Certificate)
// ------------------------------------------------------------
router.post('/apply', async (req, res, next) => {
  try {
    const {
      firstName, lastName, middleName,
      email, phone, gender, dateOfBirth,
      country, stateOfOrigin, lga, address,
      programmeId, departmentId, schoolId, level,
      oLevelResult, oLevel, jambScore, jambReg, jambRegNo,
      passportData, passportUrl,
      programmeType, maritalStatus, campus, nationality,
    } = req.body || {};

    if (!firstName || !lastName || !email || !phone) {
      return res.status(400).json({ success: false, error: 'firstName, lastName, email, phone are required.' });
    }
    if (!programmeId || !departmentId) {
      return res.status(400).json({ success: false, error: 'programmeId and departmentId are required.' });
    }

    const dept = await courseQueries.findDepartmentById(departmentId);
    if (!dept) return res.status(400).json({ success: false, error: 'Invalid departmentId.' });

    const resolvedSchoolId = Number(schoolId) || dept.schoolId;

    const applicationNumber = await appQueries.generateApplicationNumber('ND');

    const savedPassportUrl = savePassportPhoto(passportData, 'nd-app') || passportUrl || null;

    const app = await appQueries.create({
      applicationNumber,
      type: 'ND',
      firstName, lastName, middleName,
      email, phone, gender, dateOfBirth,
      country: country || 'Nigeria',
      stateOfOrigin, lga, address,
      programmeId: Number(programmeId),
      departmentId: Number(departmentId),
      schoolId: resolvedSchoolId,
      level: level || programmeType || 'ND',
      oLevelResult: oLevelResult || (oLevel ? { summary: oLevel } : null),
      jambScore: jambScore ? Number(jambScore) : null,
      jambRegNo: jambRegNo || jambReg || null,
      passportUrl: savedPassportUrl,
    });

    await sendApplicationReceived(app).catch(() => {});
    return res.status(201).json({
      success: true,
      applicationNumber: app.applicationNumber,
      data: app,
    });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// POST /api/apply-hnd  (HND)
// ------------------------------------------------------------
router.post('/apply-hnd', async (req, res, next) => {
  try {
    const {
      firstName, lastName, middleName,
      email, phone, gender, dateOfBirth,
      country, stateOfOrigin, lga, address,
      programmeId, departmentId, schoolId, level,
      oLevelResult, oLevel, jambScore, jambRegNo,
      passportData, passportUrl,
      ndMatric, ndMatricNumber, ndInstitution, ndProgramme,
      ndYear, ndGrade, ndCgpa,
      itCompleted, itDuration, itCompany, itSupervisor,
      maritalStatus, campus, nationality,
    } = req.body || {};

    if (!firstName || !lastName || !email || !phone) {
      return res.status(400).json({ success: false, error: 'firstName, lastName, email, phone are required.' });
    }
    if (!programmeId || !departmentId) {
      return res.status(400).json({ success: false, error: 'programmeId and departmentId are required.' });
    }

    const dept = await courseQueries.findDepartmentById(departmentId);
    if (!dept) return res.status(400).json({ success: false, error: 'Invalid departmentId.' });

    const resolvedSchoolId = Number(schoolId) || dept.schoolId;
    const applicationNumber = await appQueries.generateApplicationNumber('HND');

    const oLevelPayload = {
      summary: oLevel || null,
      ...(typeof oLevelResult === 'object' && oLevelResult !== null ? oLevelResult : {}),
      hnd: {
        ndMatric: ndMatric || ndMatricNumber || null,
        ndInstitution: ndInstitution || null,
        ndProgramme: ndProgramme || null,
        ndYear: ndYear || null,
        ndGrade: ndGrade || null,
        ndCgpa: ndCgpa || null,
        itCompleted: itCompleted || null,
        itDuration: itDuration || null,
        itCompany: itCompany || null,
        itSupervisor: itSupervisor || null,
      },
    };

    const savedPassportUrl = savePassportPhoto(passportData, 'hnd-app') || passportUrl || null;

    const app = await appQueries.create({
      applicationNumber,
      type: 'HND',
      firstName, lastName, middleName,
      email, phone, gender, dateOfBirth,
      country: country || 'Nigeria',
      stateOfOrigin, lga, address,
      programmeId: Number(programmeId),
      departmentId: Number(departmentId),
      schoolId: resolvedSchoolId,
      level: level || 'HND',
      oLevelResult: oLevelPayload,
      jambScore: jambScore ? Number(jambScore) : null,
      jambRegNo: jambRegNo || null,
      passportUrl: savedPassportUrl,
    });

    await sendApplicationReceived(app).catch(() => {});
    return res.status(201).json({
      success: true,
      applicationNumber: app.applicationNumber,
      data: app,
    });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// GET /api/apply-status?number=&email=
// ------------------------------------------------------------
router.get('/apply-status', async (req, res, next) => {
  try {
    const { number, email } = req.query;
    if (!number || !email) {
      return res.status(400).json({ success: false, error: 'number and email are required.' });
    }
    const app = await appQueries.findByNumber(String(number).trim());
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });

    if (String(app.email).toLowerCase() !== String(email).toLowerCase().trim()) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    return res.json({
      success: true,
      data: {
        applicationNumber: app.applicationNumber,
        firstName: app.firstName,
        lastName: app.lastName,
        type: app.type,
        level: app.level,
        status: app.status,
        createdAt: app.createdAt,
        reviewedAt: app.reviewedAt,
        admittedAt: app.admittedAt,
        matricNumber: app.matricNumber,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// POST /api/contact
// ------------------------------------------------------------
router.post('/contact', async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'name, email, message are required.' });
    }

    const adminUser = await userQueries.findByEmail(
      process.env.ADMIN_EMAIL || 'admin@fedpolyugep.edu.ng'
    );
    const attributedTo = adminUser?.id || 1;

    const row = await notifQueries.createComplaint({
      userId: attributedTo,
      subject: subject ? `[Contact] ${subject}` : `[Contact] Message from ${name}`,
      body: `From: ${name} <${email}>\n\n${message}`,
      category: 'contact',
    });

    await logSecurity({
      req,
      event: 'public_contact_submitted',
      severity: 'info',
      details: { email, subject },
    });

    return res.status(201).json({ success: true, data: { id: row.id } });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// POST /api/register-token
// ------------------------------------------------------------
router.post('/register-token', async (req, res, next) => {
  try {
    const { email, purpose } = req.body || {};
    if (!email || !purpose) {
      return res.status(400).json({ success: false, error: 'email and purpose are required.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await auditQueries.createToken({ email, token, purpose, expiresAt });

    await logSecurity({
      req,
      event: 'register_token_issued',
      severity: 'info',
      details: { email, purpose },
    });

    return res.status(201).json({
      success: true,
      message: 'Verification token generated.',
      token,
      expiresAt,
    });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// GET /api/announcements
// ------------------------------------------------------------
router.get('/announcements', async (req, res, next) => {
  try {
    const rows = await notifQueries.listAnnouncementsWithAuthor({
      audience: req.query.audience || 'all',
      isPublished: true,
    });
    const data = rows.map((r) => ({
      id: r.announcement.id,
      title: r.announcement.title,
      body: r.announcement.body,
      priority: r.announcement.priority,
      publishedAt: r.announcement.publishedAt,
      authorName: r.author ? `${r.author.firstName} ${r.author.lastName}`.trim() : null,
    }));
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// GET /api/programmes
// ------------------------------------------------------------
router.get('/programmes', async (_req, res, next) => {
  try {
    const programmes = await courseQueries.listProgrammes({});
    const departments = await courseQueries.listDepartments({});
    const schools = await courseQueries.listSchools();
    return res.json({ success: true, programmes, departments, schools });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// GET /api/institution
// ------------------------------------------------------------
router.get('/institution', async (_req, res, next) => {
  try {
    const institution = await settingsQueries.getInstitution();
    const banks = await settingsQueries.getBankAccounts();
    return res.json({ success: true, institution, banks });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// GET /api/banks
// ------------------------------------------------------------
router.get('/banks', async (_req, res, next) => {
  try {
    return res.json({ success: true, data: await settingsQueries.getBankAccounts() });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// GET /api/geo/countries  (public, no auth)
// ------------------------------------------------------------
router.get('/geo/countries', (_req, res) => {
  return res.json({ success: true, data: geo.listCountries() });
});

// ------------------------------------------------------------
// GET /api/geo/states?country=NG  (public, no auth)
// ------------------------------------------------------------
router.get('/geo/states', (req, res) => {
  const country = req.query.country || 'NG';
  return res.json({ success: true, data: geo.listStates(country) });
});

// ------------------------------------------------------------
// GET /api/geo/lgas?country=NG&state=Cross%20River  (public, no auth)
// ------------------------------------------------------------
router.get('/geo/lgas', (req, res) => {
  const { country = 'NG', state } = req.query;
  if (!state) return res.status(400).json({ success: false, error: 'state is required.' });
  return res.json({ success: true, data: geo.listLgas(country, state) });
});

// TEMP DEBUG — remove after fixing
router.get('/geo/__debug', (_req, res) => {
  const G = require('../config/geo');
  return res.json({
    hasCountries: Array.isArray(G.COUNTRIES),
    countryCount: (G.COUNTRIES || []).length,
    stateKeys: Object.keys(G.STATES || {}),
    ngCount: (G.STATES && G.STATES.NG) ? G.STATES.NG.length : 0,
    ngSample: (G.STATES && G.STATES.NG) ? G.STATES.NG.slice(0, 3) : [],
    listStatesType: typeof G.listStates,
    listStatesResult: (typeof G.listStates === 'function') ? G.listStates('NG').slice(0, 3) : null,
  });
});

module.exports = router;