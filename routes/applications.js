// ============================================================
// FPU — Admin applications API
// Mounted at /api/admin/applications
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const applications = require('../db/queries/applications');
const userQueries = require('../db/queries/users');
const courseQueries = require('../db/queries/courses');
const { db, schema } = require('../db');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { hashPassword } = require('../utils/password');
const { assignFIFOMatric } = require('../utils/matricHelper');
const { getMatricPrefix } = require('../db/queries/settings');
const {
  sendApplicationApproved,
  sendApplicationRejected,
  sendRegistrationComplete,
} = require('../utils/emailService');
const { getYearShort } = require('../config/departments');

const { photoUploads } = schema;
const STAFF = ['admin', 'admission_officer', 'registrar', 'rector'];

// ------------------------------------------------------------
// savePassportPhoto — persist a base64 data URL under public/uploads
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
  try { buffer = Buffer.from(m[2], 'base64'); }
  catch { return null; }

  if (buffer.length > 5 * 1024 * 1024) return null;

  const ext = (mime.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
  try { fs.mkdirSync(uploadDir, { recursive: true }); }
  catch (e) { console.error('[applications] mkdir uploads failed:', e.message); return null; }

  const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
  try { fs.writeFileSync(path.join(uploadDir, filename), buffer); }
  catch (e) { console.error('[applications] write upload failed:', e.message); return null; }

  return `/uploads/${filename}`;
}

// ------------------------------------------------------------
// GET /api/admin/applications
// ------------------------------------------------------------
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const {
      status, type, search, programmeId, departmentId, schoolId,
      country, state,
      limit = 200, offset = 0,
    } = req.query;

    const rows = await applications.list({
      status, type, search, programmeId, departmentId, schoolId,
      country, state,
      limit: Number(limit), offset: Number(offset),
    });
    const total = await applications.count({ status, type });
    return res.json({ success: true, data: rows, total });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/applications/stats/summary
// ------------------------------------------------------------
router.get('/stats/summary', requireRole(STAFF), async (_req, res, next) => {
  try {
    const byStatus = await applications.countByStatus({});
    const totals = byStatus.reduce((acc, r) => {
      acc[r.status] = r.c;
      return acc;
    }, {});
    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    return res.json({ success: true, total, byStatus: totals });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// POST /api/admin/applications
// ------------------------------------------------------------
router.post('/', requireRole(['admin', 'admission_officer', 'registrar']), async (req, res, next) => {
  try {
    const {
      firstName, lastName, middleName, email, phone, gender,
      dateOfBirth, country, stateOfOrigin, lga, address,
      programmeId, departmentId, schoolId, level, type,
      passportData, passportUrl,
    } = req.body || {};

    if (!firstName || !lastName || !email || !phone) {
      return res.status(400).json({
        success: false,
        error: 'firstName, lastName, email, and phone are required.',
      });
    }

    const existing = await applications.findByEmail(email);
    if (existing && existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'An application with this email already exists.',
      });
    }

    let resolvedSchoolId = schoolId ? Number(schoolId) : null;
    if (departmentId && !resolvedSchoolId) {
      const dept = await courseQueries.findDepartmentById(departmentId);
      if (dept) resolvedSchoolId = dept.schoolId;
    }

    const applicationNumber = await applications.generateApplicationNumber(type || 'ND');
    const savedPassportUrl = savePassportPhoto(passportData, 'walkin-app') || passportUrl || null;

    const row = await applications.create({
      applicationNumber,
      type: type || 'ND',
      firstName,
      lastName,
      middleName: middleName || null,
      email,
      phone,
      gender: gender || null,
      dateOfBirth: dateOfBirth || null,
      country: country || 'Nigeria',
      stateOfOrigin: stateOfOrigin || null,
      lga: lga || null,
      address: address || null,
      programmeId: programmeId ? Number(programmeId) : null,
      departmentId: departmentId ? Number(departmentId) : null,
      schoolId: resolvedSchoolId,
      level: level || 'ND',
      passportUrl: savedPassportUrl,
    });

    await logAudit({
      req,
      action: 'application.create',
      entity: 'application',
      entityId: row.id,
      after: { applicationNumber },
    });

    return res.status(201).json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// POST /api/admin/applications/bulk
// ------------------------------------------------------------
router.post('/bulk', requireRole(STAFF), async (req, res, next) => {
  try {
    const { ids, action, reason } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids[] is required.' });
    }
    if (!['approve', 'reject', 'delete'].includes(action)) {
      return res.status(400).json({ success: false, error: 'action must be approve, reject, or delete.' });
    }
    if (action === 'delete' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admin can bulk-delete.' });
    }

    let processed = 0;
    const errors = [];

    for (const id of ids) {
      try {
        const app = await applications.findById(id);
        if (!app) { errors.push({ id, error: 'not found' }); continue; }

        if (action === 'approve') {
          if (app.status === 'approved' || app.status === 'registered') continue;
          await applications.setStatus(app.id, 'approved', { reviewedBy: req.user.id });
          await sendApplicationApproved({ ...app, status: 'approved' }).catch(() => {});
        } else if (action === 'reject') {
          if (app.status === 'registered') { errors.push({ id, error: 'already registered' }); continue; }
          await applications.setStatus(app.id, 'rejected', {
            reviewedBy: req.user.id,
            rejectionReason: reason || 'Bulk rejection.',
          });
        } else if (action === 'delete') {
          if (app.status === 'registered') { errors.push({ id, error: 'cannot delete registered' }); continue; }
          await applications.remove(app.id);
        }
        processed += 1;
      } catch (e) {
        errors.push({ id, error: e.message });
      }
    }

    await logAudit({
      req,
      action: `application.bulk_${action}`,
      entity: 'application',
      after: { processed, errors: errors.length, requested: ids.length },
    });

    return res.json({ success: true, processed, errors });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/applications/:id
// ------------------------------------------------------------
router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const app = await applications.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });
    return res.json({ success: true, data: app });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// POST /api/admin/applications/:id/review
// ------------------------------------------------------------
router.post('/:id/review', requireRole(STAFF), async (req, res, next) => {
  try {
    const app = await applications.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });

    const updated = await applications.setStatus(app.id, 'under_review', { reviewedBy: req.user.id });
    await logAudit({ req, action: 'application.review', entity: 'application', entityId: app.id });
    return res.json({ success: true, data: updated });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// POST /api/admin/applications/:id/approve
// ------------------------------------------------------------
router.post('/:id/approve', requireRole(STAFF), async (req, res, next) => {
  try {
    const app = await applications.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });
    if (app.status === 'approved' || app.status === 'registered') {
      return res.status(400).json({ success: false, error: 'Application is already approved.' });
    }

    const updated = await applications.setStatus(app.id, 'approved', { reviewedBy: req.user.id });
    await sendApplicationApproved(updated).catch(() => {});
    await logAudit({ req, action: 'application.approve', entity: 'application', entityId: app.id });
    return res.json({ success: true, data: updated });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// POST /api/admin/applications/:id/reject
// ------------------------------------------------------------
router.post('/:id/reject', requireRole(STAFF), async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    const app = await applications.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });

    const updated = await applications.setStatus(app.id, 'rejected', {
      reviewedBy: req.user.id,
      rejectionReason: reason || 'Application did not meet requirements.',
    });
    await sendApplicationRejected(updated, reason).catch(() => {});
    await logAudit({ req, action: 'application.reject', entity: 'application', entityId: app.id, after: { reason } });
    return res.json({ success: true, data: updated });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// POST /api/admin/applications/:id/register
// ------------------------------------------------------------
router.post('/:id/register', requireRole(STAFF), async (req, res, next) => {
  try {
    const app = await applications.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });
    if (app.status === 'registered') {
      return res.status(400).json({ success: false, error: 'Application is already registered.' });
    }
    if (app.status !== 'approved') {
      return res.status(400).json({ success: false, error: 'Application must be approved first.' });
    }

    const existing = await userQueries.findByEmail(app.email);
    if (existing) {
      return res.status(409).json({ success: false, error: 'A user with this email already exists.' });
    }

    const departmentId = Number(req.body?.departmentId || app.departmentId);
    const programmeId = Number(req.body?.programmeId || app.programmeId);
    const level = req.body?.level || app.level || 'ND';

    if (!departmentId || !programmeId) {
      return res.status(400).json({
        success: false,
        error: 'departmentId and programmeId are required to register.',
      });
    }

    const dept = await courseQueries.findDepartmentById(departmentId);
    if (!dept) return res.status(400).json({ success: false, error: 'Invalid departmentId.' });

    const schoolId = Number(req.body?.schoolId || app.schoolId || dept.schoolId);
    const school = await courseQueries.findSchoolById(schoolId);
    if (!school) {
      return res.status(400).json({ success: false, error: 'Cannot resolve school for this application.' });
    }

    const prefix = await getMatricPrefix();
    const year = getYearShort(new Date());
    const matric = await assignFIFOMatric({
      prefix,
      schoolCode: school.code,
      deptCode: dept.code,
      level,
      year,
    });

    const plain = req.body?.password || 'student1234';
    const passwordHash = await hashPassword(plain);
    const passportUrl = app.passportUrl || null;

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
      photoUrl: passportUrl,
      matricNumber: matric,
      level,
      departmentId,
      programmeId,
      schoolId,
      mustChangePassword: true,
    });

    if (passportUrl) {
      try {
        await db.insert(photoUploads).values({
          userId: user.id,
          url: passportUrl,
          mimeType: null,
          sizeBytes: null,
          isCurrent: true,
        });
      } catch (e) {
        console.error('[register] photo_uploads insert failed:', e.message);
      }
    }

    await applications.markRegistered(app.id, { userId: user.id, matricNumber: matric });
    await sendRegistrationComplete(user).catch(() => {});
    await logAudit({
      req,
      action: 'application.register',
      entity: 'application',
      entityId: app.id,
      after: { userId: user.id, matric, hasPhoto: !!passportUrl },
    });

    return res.json({
      success: true,
      data: { user, matricNumber: matric, passportUrl },
    });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// DELETE /api/admin/applications/:id
// ------------------------------------------------------------
router.delete('/:id', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const app = await applications.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });

    if (app.status === 'registered') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete a registered application.',
      });
    }

    await applications.remove(app.id);
    await logAudit({ req, action: 'application.delete', entity: 'application', entityId: app.id, before: app });
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

module.exports = router;