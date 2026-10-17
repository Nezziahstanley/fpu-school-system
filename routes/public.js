// ============================================================
// FPU — Public API (unauthenticated)
// Mounted at /api
// ============================================================

'use strict';

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
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

// ============================================================
// MULTER — file upload config
// ============================================================
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'public', 'uploads');

(function ensureUploadDir() {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.accessSync(UPLOAD_DIR, fs.constants.W_OK);
  } catch (e) {
    console.error('[uploads] FAILED to prepare dir:', UPLOAD_DIR, '→', e.message);
  }
})();

const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.bin').toLowerCase();
    const safeExt = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.bin';
    const stem = (file.fieldname || 'file').replace(/[^a-z0-9_-]/gi, '');
    const rand = crypto.randomBytes(4).toString('hex');
    cb(null, `${stem}-${Date.now()}-${rand}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error('Only PDF, JPG, or PNG files are allowed.'));
    }
    cb(null, true);
  },
});

const applicationUpload = upload.fields([
  { name: 'file_olevel',   maxCount: 1 },
  { name: 'file_birth',    maxCount: 1 },
  { name: 'file_lga',      maxCount: 1 },
  { name: 'file_passport', maxCount: 1 },
  { name: 'file_nd_cert',  maxCount: 1 },
  { name: 'file_siwes',    maxCount: 1 },
]);

function pickFileUrls(req) {
  const f = req.files || {};
  const url = (arr) => (Array.isArray(arr) && arr[0]) ? `/uploads/${arr[0].filename}` : null;
  return {
    olevelUrl:   url(f.file_olevel),
    birthUrl:    url(f.file_birth),
    lgaUrl:      url(f.file_lga),
    passportUrl: url(f.file_passport),
    ndCertUrl:   url(f.file_nd_cert),
    siwesUrl:    url(f.file_siwes),
  };
}

function savePassportPhoto(dataUrl, prefix = 'passport') {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  if (!dataUrl.startsWith('data:image/')) return null;

  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!m) return null;

  const mime = m[1];
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowed.includes(mime)) return null;

  let buffer;
  try { buffer = Buffer.from(m[2], 'base64'); } catch { return null; }
  if (buffer.length > MAX_FILE_BYTES) return null;

  const ext = (mime.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
  try { fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer); } catch { return null; }
  return `/uploads/${filename}`;
}

// ============================================================
// POST /api/apply (ND)
// ============================================================
router.post('/apply', applicationUpload, async (req, res, next) => {
  try {
    const {
      firstName, lastName, middleName,
      email, phone, gender, dateOfBirth,
      country, stateOfOrigin, lga, address,
      programmeId, departmentId, schoolId, level,
      oLevelResult, oLevel, jambScore, jambReg, jambRegNo,
      passportData, programmeType, maritalStatus, campus, nationality,
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

    const files = pickFileUrls(req);
    const savedPassportUrl = files.passportUrl || savePassportPhoto(passportData, 'nd-app') || null;

    const oLevelObj = files.olevelUrl
      ? (typeof oLevelResult === 'string'
          ? (() => { try { return JSON.parse(oLevelResult); } catch { return { summary: oLevel || null }; } })()
          : (oLevelResult || { summary: oLevel || null }))
      : (oLevelResult || (oLevel ? { summary: oLevel } : null));

    const documents = {
      olevel: files.olevelUrl,
      birth: files.birthUrl,
      lga: files.lgaUrl,
      passport: files.passportUrl,
    };

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
      oLevelResult: { ...(oLevelObj || {}), documents },
      jambScore: jambScore ? Number(jambScore) : null,
      jambRegNo: jambRegNo || jambReg || null,
      passportUrl: savedPassportUrl,
    });

    Promise.resolve()
      .then(() => sendApplicationReceived(app))
      .catch((e) => console.error('[apply] email send failed:', e?.message));

    return res.status(201).json({ success: true, applicationNumber: app.applicationNumber, data: app });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/apply-hnd (HND)
// ============================================================
router.post('/apply-hnd', applicationUpload, async (req, res, next) => {
  try {
    const {
      firstName, lastName, middleName,
      email, phone, gender, dateOfBirth,
      country, stateOfOrigin, lga, address,
      programmeId, departmentId, schoolId, level,
      oLevelResult, oLevel, jambScore, jambRegNo,
      passportData,
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

    const files = pickFileUrls(req);
    const savedPassportUrl = files.passportUrl || savePassportPhoto(passportData, 'hnd-app') || null;

    const documents = {
      olevel: files.olevelUrl,
      birth: files.birthUrl,
      lga: files.lgaUrl,
      passport: files.passportUrl,
      ndCert: files.ndCertUrl,
      siwes: files.siwesUrl,
    };

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
      documents,
    };

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

    Promise.resolve()
      .then(() => sendApplicationReceived(app))
      .catch((e) => console.error('[apply-hnd] email send failed:', e?.message));

    return res.status(201).json({ success: true, applicationNumber: app.applicationNumber, data: app });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/apply-status
// ============================================================
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
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/letters/:id
// Public HTML wrapper to view/print admission letters from email
// ============================================================
router.get('/letters/:id', async (req, res, next) => {
  try {
    const app = await appQueries.findById(req.params.id);
    
    if (!app) {
      return res.status(404).send('Letter not found. Please check your link.');
    }
    
    if (!['approved', 'registered', 'matriculated', 'rejected'].includes(app.status)) {
      return res.status(403).send('Your admission is not yet approved.');
    }

    const enriched = await appQueries.findByIdWithRelations(app.id);
    
    let letterType = req.query.type || 'provisional';
    if (!req.query.type) {
      if (app.status === 'matriculated') letterType = 'matriculation';
      else if (app.status === 'rejected') letterType = 'rejection';
      else if (app.status === 'registered') letterType = 'acceptance';
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Letter - ${app.applicationNumber}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { background: #f3f4f6; padding: 20px; margin: 0; }
          .print-btn { position: fixed; bottom: 20px; right: 20px; z-index: 9999; padding: 15px 25px; font-size: 16px; font-weight: bold; background: #065f46; color: white; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
          @media print { 
            body { background: white; padding: 0; }
            .print-btn { display: none; } 
          }
        </style>
      </head>
      <body>
        <div id="letter-mount">Loading letter...</div>
        <button class="print-btn" onclick="window.print()">🖨 Download / Print PDF</button>
        
        <script>
          window.FPU_CURRENT_APPLICANT = ${JSON.stringify(enriched)};
          
          // Fetch the HTML template and inject it
          fetch('/portal/partials/admission-officer/letter-templates/${letterType}.html')
            .then(res => res.text())
            .then(html => {
              const mount = document.getElementById('letter-mount');
              mount.innerHTML = html;
              
              // Re-execute the scripts inside the template
              mount.querySelectorAll('script').forEach(old => {
                const s = document.createElement('script');
                if (old.src) s.src = old.src;
                else s.textContent = old.textContent;
                old.parentNode.replaceChild(s, old);
              });
            })
            .catch(err => {
              document.getElementById('letter-mount').innerHTML = '<div style="color:red; padding: 20px;">Error loading letter template: ' + err.message + '</div>';
            });
        </script>
      </body>
      </html>
    `);
  } catch (err) { 
    console.error('[public letters] error:', err);
    return next(err); 
  }
});

// ============================================================
// POST /api/contact
// ============================================================
router.post('/contact', async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'name, email, message are required.' });
    }

    const adminUser = await userQueries.findByEmail(process.env.ADMIN_EMAIL || 'admin@fedpolyugep.edu.ng');
    const attributedTo = adminUser?.id || 1;

    const row = await notifQueries.createComplaint({
      userId: attributedTo,
      subject: subject ? `[Contact] ${subject}` : `[Contact] Message from ${name}`,
      body: `From: ${name} <${email}>\n\n${message}`,
      category: 'contact',
    });

    await logSecurity({ req, event: 'public_contact_submitted', severity: 'info', details: { email, subject } });

    return res.status(201).json({ success: true, data: { id: row.id } });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/register-token
// ============================================================
router.post('/register-token', async (req, res, next) => {
  try {
    const { email, purpose } = req.body || {};
    if (!email || !purpose) {
      return res.status(400).json({ success: false, error: 'email and purpose are required.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await auditQueries.createToken({ email, token, purpose, expiresAt });

    await logSecurity({ req, event: 'register_token_issued', severity: 'info', details: { email, purpose } });

    return res.status(201).json({ success: true, message: 'Verification token generated.', token, expiresAt });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/announcements
// ============================================================
router.get('/announcements', async (req, res, next) => {
  try {
    const rows = await notifQueries.listAnnouncementsWithAuthor({ audience: req.query.audience || 'all', isPublished: true });
    const data = rows.map((r) => ({
      id: r.announcement.id,
      title: r.announcement.title,
      body: r.announcement.body,
      priority: r.announcement.priority,
      publishedAt: r.announcement.publishedAt,
      authorName: r.author ? `${r.author.firstName} ${r.author.lastName}`.trim() : null,
    }));
    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/programmes
// ============================================================
router.get('/programmes', async (_req, res, next) => {
  try {
    const programmes = await courseQueries.listProgrammes({});
    const departments = await courseQueries.listDepartments({});
    const schools = await courseQueries.listSchools();
    return res.json({ success: true, programmes, departments, schools });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/institution
// ============================================================
router.get('/institution', async (_req, res, next) => {
  try {
    const institution = await settingsQueries.getInstitution();
    const banks = await settingsQueries.getBankAccounts();
    return res.json({ success: true, institution, banks });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/banks
// ============================================================
router.get('/banks', async (_req, res, next) => {
  try { return res.json({ success: true, data: await settingsQueries.getBankAccounts() }); }
  catch (err) { return next(err); }
});

// ============================================================
// GEO
// ============================================================
router.get('/geo/countries', (_req, res) => { return res.json({ success: true, data: geo.listCountries() }); });

router.get('/geo/states', (req, res) => {
  const q = String(req.query.country || 'NG').trim();
  let code = q.length === 2 ? q.toUpperCase() : null;
  if (!code) {
    const found = (geo.COUNTRIES || []).find((c) => c.name.toLowerCase() === q.toLowerCase());
    if (found) code = found.code;
  }
  return res.json({ success: true, data: code ? geo.listStates(code) : [] });
});

router.get('/geo/lgas', (req, res) => {
  const q = String(req.query.country || 'NG').trim();
  const state = String(req.query.state || '').trim();
  if (!state) return res.status(400).json({ success: false, error: 'state is required.' });
  let code = q.length === 2 ? q.toUpperCase() : null;
  if (!code) {
    const found = (geo.COUNTRIES || []).find((c) => c.name.toLowerCase() === q.toLowerCase());
    if (found) code = found.code;
  }
  return res.json({ success: true, data: code ? geo.listLgas(code, state) : [] });
});

// ============================================================
// Multer error handler
// ============================================================
router.use((err, _req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, error: 'File too large. Max 5 MB.' });
  if (err && err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ success: false, error: 'Too many files.' });
  if (err && err.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ success: false, error: `Unexpected file field: ${err.field}` });
  if (err && err.message && err.message.includes('Only PDF')) return res.status(400).json({ success: false, error: err.message });
  return next(err);
});

module.exports = router;