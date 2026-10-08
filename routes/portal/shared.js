// ============================================================
// FPU — Shared portal API (works for any authenticated user)
// Mounted at /api/portal
// ------------------------------------------------------------
// Endpoints: profile, photo, password, messages, notifications,
// announcements, complaints, security, payments, library.
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const userQueries    = require('../../db/queries/users');
const notifQueries   = require('../../db/queries/notifications');
const sessionQueries = require('../../db/queries/sessions');
const auditQueries   = require('../../db/queries/audit');
const paymentQueries = require('../../db/queries/payments');
const libraryQueries = require('../../db/queries/library');
const { db, schema } = require('../../db');
const { eq, and, desc } = require('drizzle-orm');
const { requireUser } = require('../../middleware/auth');
const { hashPassword, comparePassword, validatePassword } = require('../../utils/password');
const { logAudit, logSecurity } = require('../../utils/audit');

const { photoUploads } = schema;

// ============================================================
// GET /api/portal/profile
// ============================================================

// ------------------------------------------------------------
// NOTE: /profile GET and PUT were removed from this file.
// They are now handled by routes/portal/profile.js which is
// mounted at /api/portal (and provides PATCH + password change).
// ------------------------------------------------------------

router.post('/change-password', requireUser, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'currentPassword and newPassword are required.' });
    }
    const check = validatePassword(newPassword);
    if (!check.valid) return res.status(400).json({ success: false, error: check.reasons.join(' ') });

    const user = await userQueries.findById(req.user.id);
    const ok = await comparePassword(currentPassword, user.passwordHash);
    if (!ok) {
      await logSecurity({ req, userId: user.id, event: 'portal_password_change_failed', severity: 'warning' });
      return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    }

    const passwordHash = await hashPassword(newPassword);
    await userQueries.updatePassword(user.id, passwordHash);
    await logAudit({ req, action: 'portal.password_change', entity: 'user', entityId: user.id });
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/portal/photo
// ============================================================
router.get('/photo', requireUser, async (req, res, next) => {
  try {
    const [row] = await db
      .select()
      .from(photoUploads)
      .where(and(eq(photoUploads.userId, req.user.id), eq(photoUploads.isCurrent, true)))
      .limit(1);
    return res.json({ success: true, data: row || null, photoUrl: req.user.photoUrl || null });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/portal/photo
// ============================================================
router.post('/photo', requireUser, async (req, res, next) => {
  try {
    const { url, mimeType, sizeBytes } = req.body || {};
    if (!url) return res.status(400).json({ success: false, error: 'url is required.' });

    await db.update(photoUploads).set({ isCurrent: false }).where(eq(photoUploads.userId, req.user.id));
    const [row] = await db.insert(photoUploads).values({
      userId: req.user.id, url,
      mimeType: mimeType || null,
      sizeBytes: sizeBytes ? Number(sizeBytes) : null,
      isCurrent: true,
    }).returning();
    await userQueries.setPhoto(req.user.id, url);
    await logAudit({ req, action: 'portal.photo_upload', entity: 'user', entityId: req.user.id });
    return res.status(201).json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/portal/messages
// ============================================================
router.get('/messages', requireUser, async (req, res, next) => {
  try {
    const { box } = req.query;
    if (box === 'sent') {
      const rows = await notifQueries.listSent(req.user.id);
      return res.json({ success: true, data: rows });
    }
    const rows = await notifQueries.listInboxWithSender(req.user.id);
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/portal/messages/:id
// ============================================================
router.get('/messages/:id', requireUser, async (req, res, next) => {
  try {
    const row = await notifQueries.findMessageById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Message not found.' });
    if (row.senderId !== req.user.id && row.recipientId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Forbidden.' });
    }
    if (row.recipientId === req.user.id && !row.isRead) {
      await notifQueries.markMessageRead(row.id, req.user.id);
    }
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/portal/messages
// ============================================================
router.post('/messages', requireUser, async (req, res, next) => {
  try {
    const { recipientId, subject, body, parentId } = req.body || {};
    if (!recipientId || !body) {
      return res.status(400).json({ success: false, error: 'recipientId and body are required.' });
    }
    const recipient = await userQueries.findById(recipientId);
    if (!recipient) return res.status(404).json({ success: false, error: 'Recipient not found.' });

    const row = await notifQueries.createMessage({
      senderId: req.user.id,
      recipientId,
      subject,
      body,
      parentId,
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// DELETE /api/portal/messages/:id
// ============================================================
router.delete('/messages/:id', requireUser, async (req, res, next) => {
  try {
    const row = await notifQueries.removeMessage(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Message not found.' });
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/portal/notifications
// ============================================================
router.get('/notifications', requireUser, async (req, res, next) => {
  try {
    const rows = await notifQueries.listNotifications(req.user.id, {
      unreadOnly: req.query.unread === 'true',
      limit: Number(req.query.limit) || 100,
    });
    const unread = await notifQueries.countUnreadNotifications(req.user.id);
    return res.json({ success: true, data: rows, unread });
  } catch (err) { return next(err); }
});

router.post('/notifications/:id/read', requireUser, async (req, res, next) => {
  try {
    const row = await notifQueries.markNotificationRead(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Notification not found.' });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

router.post('/notifications/read-all', requireUser, async (req, res, next) => {
  try {
    const count = await notifQueries.markAllNotificationsRead(req.user.id);
    return res.json({ success: true, count });
  } catch (err) { return next(err); }
});

router.delete('/notifications/:id', requireUser, async (req, res, next) => {
  try {
    const row = await notifQueries.removeNotification(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Notification not found.' });
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/portal/announcements
// ============================================================
router.get('/announcements', requireUser, async (req, res, next) => {
  try {
    const rows = await notifQueries.listAnnouncementsWithAuthor({
      audience: req.user.role,
      isPublished: true,
    });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/portal/complaints & POST /api/portal/complaints
// ============================================================
router.get('/complaints', requireUser, async (req, res, next) => {
  try {
    const rows = await notifQueries.listComplaints({ userId: req.user.id });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

router.post('/complaints', requireUser, async (req, res, next) => {
  try {
    const { subject, body, category } = req.body || {};
    if (!subject || !body) {
      return res.status(400).json({ success: false, error: 'subject and body are required.' });
    }
    const row = await notifQueries.createComplaint({ userId: req.user.id, subject, body, category });
    return res.status(201).json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/portal/security
// ============================================================
router.get('/security', requireUser, async (req, res, next) => {
  try {
    const sessions = await sessionQueries.listUserSessions(req.user.id);
    const adminSessions = await sessionQueries.listAdminSessions(req.user.id);
    const logins = await auditQueries.listLogins({ userId: req.user.id, limit: 30 });
    const events = await auditQueries.listSecurity({ userId: req.user.id, limit: 30 });
    return res.json({ success: true, sessions, adminSessions, logins, events });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/portal/security/revoke/:token
// ============================================================
router.post('/security/revoke/:token', requireUser, async (req, res, next) => {
  try {
    await sessionQueries.revokeUserSession(req.params.token);
    await sessionQueries.revokeAdminSession(req.params.token);
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/portal/security/revoke-all
// ============================================================
router.post('/security/revoke-all', requireUser, async (req, res, next) => {
  try {
    const current = req.authToken;
    const list = await sessionQueries.listUserSessions(req.user.id);
    for (const s of list) {
      if (s.token !== current && !s.revokedAt) {
        await sessionQueries.revokeUserSession(s.token);
      }
    }
    const adminList = await sessionQueries.listAdminSessions(req.user.id);
    for (const s of adminList) {
      if (s.token !== current && !s.revokedAt) {
        await sessionQueries.revokeAdminSession(s.token);
      }
    }
    await logAudit({ req, action: 'portal.revoke_all_sessions', entity: 'user', entityId: req.user.id });
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/portal/avatar-upload
// ============================================================
router.post('/avatar-upload', requireUser, async (req, res, next) => {
  try {
    const { dataUrl } = req.body || {};
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      return res.status(400).json({ success: false, error: 'A base64 image data URL is required.' });
    }
    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!m) return res.status(400).json({ success: false, error: 'Invalid data URL.' });

    const mime = m[1];
    const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!ALLOWED.includes(mime)) {
      return res.status(400).json({ success: false, error: 'Only PNG, JPEG, and WebP images are allowed.' });
    }

    const buffer = Buffer.from(m[2], 'base64');
    const maxBytes = (Number(process.env.MAX_UPLOAD_MB) || 5) * 1024 * 1024;
    if (buffer.length > maxBytes) {
      return res.status(413).json({ success: false, error: `File too large. Max ${maxBytes} bytes.` });
    }

    const ext = mime.split('/')[1].replace(/[^a-z0-9]/gi, '') || 'png';
    const uploadDir = path.join(__dirname, '..', '..', process.env.UPLOAD_DIR || 'public/uploads');
    fs.mkdirSync(uploadDir, { recursive: true });

    const filename = `user-${req.user.id}-${Date.now()}.${ext}`;
    const fullPath = path.join(uploadDir, filename);
    fs.writeFileSync(fullPath, buffer);

    const publicUrl = `/${(process.env.UPLOAD_DIR || 'public/uploads').replace(/^public\//, '')}/${filename}`;

    await db.update(photoUploads).set({ isCurrent: false }).where(eq(photoUploads.userId, req.user.id));
    const [row] = await db.insert(photoUploads).values({
      userId: req.user.id,
      url: publicUrl,
      mimeType: mime,
      sizeBytes: buffer.length,
      isCurrent: true,
    }).returning();
    await userQueries.setPhoto(req.user.id, publicUrl);

    await logAudit({ req, action: 'portal.avatar_upload', entity: 'user', entityId: req.user.id });
    return res.json({ success: true, url: publicUrl, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/portal/payments/submit
// Student self-service payment submission. Uses the caller's
// currentSessionId — never trusts a client-supplied session.
// ============================================================
router.post('/payments/submit', requireUser, async (req, res, next) => {
  try {
    const { amount, bankName, depositorName, depositDate, reference } = req.body || {};
    if (!amount || !bankName || !reference) {
      return res.status(400).json({
        success: false,
        error: 'amount, bankName, and reference are required.',
      });
    }
    if (!req.user.currentSessionId) {
      return res.status(400).json({ success: false, error: 'No current session set on your account.' });
    }

    const row = await paymentQueries.create({
      studentId: req.user.id,
      sessionId: req.user.currentSessionId,
      amount,
      reference,
      bankName,
      depositorName: depositorName || null,
      depositDate: depositDate || null,
      status: 'pending',
    });
    await logAudit({ req, action: 'portal.payment_submit', entity: 'payment', entityId: row.id });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'A payment with that reference already exists.' });
    }
    return next(err);
  }
});

// ============================================================
// GET /api/portal/library/books
// Read-only book catalogue for any authenticated user (student,
// staff, admin — everyone can browse the library).
// ============================================================
router.get('/library/books', requireUser, async (req, res, next) => {
  try {
    const rows = await libraryQueries.listBooks({
      search: req.query.search,
      category: req.query.category,
      availableOnly: req.query.availableOnly === 'true',
      limit: Number(req.query.limit) || 100,
      offset: Number(req.query.offset) || 0,
    });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

module.exports = router;