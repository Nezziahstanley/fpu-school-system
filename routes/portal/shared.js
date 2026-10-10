// ============================================================
// FPU — Shared portal API
// Mounted at /api/portal
// ------------------------------------------------------------
// Endpoints used by every logged-in user regardless of role:
//   photo, change-password, messages, notifications,
//   announcements, complaints, security, avatar-upload,
//   payments/submit, library/books
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const { db, schema } = require('../../db');
const { eq, and, desc } = require('drizzle-orm');

const notifQueries = require('../../db/queries/notifications');
const userQueries = require('../../db/queries/users');
const sessionQueries = require('../../db/queries/sessions');
const paymentQueries = require('../../db/queries/payments');
const libQueries = require('../../db/queries/library');

const { requireUser } = require('../../middleware/auth');
const { logSecurity } = require('../../utils/audit');

const {
  users, photoUploads, messages, notifications,
  announcements, complaints, borrowRecords, books,
} = schema;

// ============================================================
// POST /api/portal/change-password
// ============================================================
router.post('/change-password', requireUser, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'currentPassword and newPassword are required.' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters.' });
    }

    const bcrypt = require('bcryptjs');
    const me = await userQueries.findByEmail(req.user.email);
    if (!me || !me.passwordHash) {
      return res.status(400).json({ success: false, error: 'Account not found.' });
    }

    const ok = await bcrypt.compare(String(currentPassword), me.passwordHash);
    if (!ok) {
      await logSecurity({ req, event: 'password_change_failed', severity: 'warning' });
      return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    }

    const rounds = Number(process.env.BCRYPT_ROUNDS) || 10;
    const hash = await bcrypt.hash(String(newPassword), rounds);
    await userQueries.updatePassword(req.user.id, hash);

    await logSecurity({ req, event: 'password_changed', severity: 'info' });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/portal/photo — current user's photo
// ============================================================
router.get('/photo', requireUser, async (req, res, next) => {
  try {
    const [row] = await db
      .select()
      .from(photoUploads)
      .where(and(eq(photoUploads.userId, req.user.id), eq(photoUploads.isCurrent, true)))
      .limit(1);
    return res.json({
      success: true,
      data: row || null,
      photoUrl: req.user.photoUrl || null,
    });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /api/portal/photo — save/update the user's photo URL
// ------------------------------------------------------------
// Body: { photoUrl } OR { url } (accept both).
// Also locks in idCardPhotoUrl on the FIRST upload.
// ============================================================
router.post('/photo', requireUser, async (req, res, next) => {
  try {
    const url = String(req.body?.photoUrl || req.body?.url || '').trim();
    if (!url) {
      return res.status(400).json({ success: false, error: 'photoUrl is required.' });
    }

    const updates = { photoUrl: url, updatedAt: new Date() };
    // Lock in the ID-card photo only on first upload
    if (!req.user.idCardPhotoUrl) {
      updates.idCardPhotoUrl = url;
    }

    const [row] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, req.user.id))
      .returning();

    // Also record in photo_uploads history
    try {
      await db.insert(photoUploads).values({
        userId: req.user.id,
        url,
        mimeType: req.body?.mimeType || null,
        sizeBytes: req.body?.sizeBytes ? Number(req.body.sizeBytes) : null,
        isCurrent: true,
      });
      // Mark older uploads as not current
      await db
        .update(photoUploads)
        .set({ isCurrent: false })
        .where(and(eq(photoUploads.userId, req.user.id), eq(photoUploads.isCurrent, true)));
    } catch {
      // history is optional — ignore failures
    }

    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// MESSAGES
// ============================================================
router.get('/messages', requireUser, async (req, res, next) => {
  try {
    const box = req.query.box === 'sent' ? 'sent' : 'inbox';
    const rows = await notifQueries.listMessages({ userId: req.user.id, box });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/messages/:id', requireUser, async (req, res, next) => {
  try {
    const [row] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, Number(req.params.id)))
      .limit(1);
    if (!row) return res.status(404).json({ success: false, error: 'Message not found.' });
    if (row.recipientId !== req.user.id && row.senderId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not allowed.' });
    }
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/messages', requireUser, async (req, res, next) => {
  try {
    const { recipientId, subject, body, parentId } = req.body || {};
    if (!recipientId || !body) {
      return res.status(400).json({ success: false, error: 'recipientId and body are required.' });
    }
    const row = await notifQueries.createMessage({
      senderId: req.user.id,
      recipientId,
      subject,
      body,
      parentId,
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/messages/:id', requireUser, async (req, res, next) => {
  try {
    const [row] = await db
      .delete(messages)
      .where(and(eq(messages.id, Number(req.params.id)), eq(messages.recipientId, req.user.id)))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Message not found.' });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// NOTIFICATIONS
// ============================================================
router.get('/notifications', requireUser, async (req, res, next) => {
  try {
    const rows = await notifQueries.listNotifications(req.user.id, {
      unreadOnly: req.query.unread === 'true',
      limit: Number(req.query.limit) || 100,
    });
    const unread = await notifQueries.countUnreadNotifications(req.user.id);
    return res.json({ success: true, data: rows, unread });
  } catch (err) {
    return next(err);
  }
});

router.post('/notifications/:id/read', requireUser, async (req, res, next) => {
  try {
    const row = await notifQueries.markNotificationRead(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Notification not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/notifications/read-all', requireUser, async (req, res, next) => {
  try {
    const count = await notifQueries.markAllNotificationsRead(req.user.id);
    return res.json({ success: true, count });
  } catch (err) {
    return next(err);
  }
});

router.delete('/notifications/:id', requireUser, async (req, res, next) => {
  try {
    const row = await notifQueries.removeNotification(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Notification not found.' });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// ANNOUNCEMENTS
// ============================================================
router.get('/announcements', requireUser, async (req, res, next) => {
  try {
    const all = await notifQueries.listAnnouncementsWithAuthor({
      audience: 'all',
      isPublished: true,
    });
    const mine = await notifQueries.listAnnouncementsWithAuthor({
      audience: req.user.role,
      isPublished: true,
    });
    // Merge + dedupe by id, sort by publishedAt desc
    const seen = new Set();
    const merged = [];
    [...all, ...mine].forEach((r) => {
      const a = r.announcement || r;
      if (!seen.has(a.id)) { seen.add(a.id); merged.push(r); }
    });
    merged.sort((x, y) => {
      const ax = (x.announcement || x).publishedAt || '';
      const ay = (y.announcement || y).publishedAt || '';
      return String(ay).localeCompare(String(ax));
    });
    return res.json({ success: true, data: merged });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// STAFF ANNOUNCEMENT WRITE ENDPOINTS
// Everyone below can read; only staff can write. Role limits
// what audience they can target.
// ------------------------------------------------------------
const STAFF_ANNOUNCE_ROLES = [
  'admin', 'registrar', 'rector', 'bursar', 'librarian',
  'hod', 'exam_officer', 'academic_officer', 'admission_officer', 'lecturer',
];

// Which audience values each role may target when creating / editing.
// Weakest → strongest. Anyone can target 'all' if listed.
const ANNOUNCE_TARGETS = {
  admin:              ['all', 'student', 'staff', 'lecturer', 'hod'],
  registrar:          ['all', 'student', 'staff', 'lecturer', 'hod'],
  rector:             ['all', 'student', 'staff', 'lecturer', 'hod'],
  academic_officer:   ['all', 'student', 'staff', 'lecturer', 'hod'],
  exam_officer:       ['student', 'staff', 'lecturer', 'hod'],
  admission_officer:  ['student', 'staff'],
  bursar:             ['all', 'student', 'staff'],
  librarian:          ['all', 'student', 'staff'],
  hod:                ['student', 'staff', 'lecturer'],
  lecturer:           ['student'],
};

// POST /api/portal/announcements — staff create
router.post('/announcements', requireUser, async (req, res, next) => {
  try {
    const role = String(req.user.role || '').toLowerCase();
    if (!STAFF_ANNOUNCE_ROLES.includes(role)) {
      return res.status(403).json({ success: false, error: 'Not allowed.' });
    }
    const { title, body, audience, priority, isPublished, expiresAt } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'title and body are required.' });
    }
    const aud = audience || 'all';
    const allowed = ANNOUNCE_TARGETS[role] || ['all'];
    if (!allowed.includes(aud)) {
      return res.status(403).json({
        success: false,
        error: `Your role cannot target "${aud}". Allowed: ${allowed.join(', ')}.`,
      });
    }
    const row = await notifQueries.createAnnouncement({
      title,
      body,
      audience: aud,
      priority: priority || 'normal',
      isPublished: isPublished !== false,
      expiresAt: expiresAt || null,
      authorId: req.user.id,
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/portal/announcements/:id — author (or admin) edit
router.put('/announcements/:id', requireUser, async (req, res, next) => {
  try {
    const role = String(req.user.role || '').toLowerCase();
    if (!STAFF_ANNOUNCE_ROLES.includes(role)) {
      return res.status(403).json({ success: false, error: 'Not allowed.' });
    }
    const existing = await notifQueries.findAnnouncementById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Not found.' });

    // Only the author or an admin can edit
    if (existing.authorId !== req.user.id && role !== 'admin') {
      return res.status(403).json({ success: false, error: 'You can only edit your own announcements.' });
    }

    const b = req.body || {};
    const patch = {};
    if (b.title !== undefined) patch.title = b.title;
    if (b.body !== undefined) patch.body = b.body;
    if (b.priority !== undefined) patch.priority = b.priority;
    if (b.isPublished !== undefined) patch.isPublished = !!b.isPublished;
    if (b.expiresAt !== undefined) patch.expiresAt = b.expiresAt || null;
    if (b.audience !== undefined) {
      const allowed = ANNOUNCE_TARGETS[role] || ['all'];
      if (!allowed.includes(b.audience)) {
        return res.status(403).json({ success: false, error: `Your role cannot target "${b.audience}".` });
      }
      patch.audience = b.audience;
    }

    const row = await notifQueries.updateAnnouncement(existing.id, patch);
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/portal/announcements/:id — author (or admin)
router.delete('/announcements/:id', requireUser, async (req, res, next) => {
  try {
    const role = String(req.user.role || '').toLowerCase();
    if (!STAFF_ANNOUNCE_ROLES.includes(role)) {
      return res.status(403).json({ success: false, error: 'Not allowed.' });
    }
    const existing = await notifQueries.findAnnouncementById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Not found.' });

    if (existing.authorId !== req.user.id && role !== 'admin') {
      return res.status(403).json({ success: false, error: 'You can only delete your own announcements.' });
    }

    await notifQueries.removeAnnouncement(existing.id);
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// GET /api/portal/users/search?q=... — recipient picker for
// messages + reference. Returns up to 20 matches for the
// current user's messaging scope (students/staff peers).
// ------------------------------------------------------------
router.get('/users/search', requireUser, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ success: true, data: [] });

    const { ilike, or: orOp, ne, and: andOp } = require('drizzle-orm');
    const term = `%${q}%`;
    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        matricNumber: users.matricNumber,
      })
      .from(users)
      .where(andOp(
        ne(users.id, req.user.id),
        orOp(
          ilike(users.firstName, term),
          ilike(users.lastName, term),
          ilike(users.email, term),
          ilike(users.matricNumber, term)
        )
      ))
      .limit(20);

    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// COMPLAINTS
// ============================================================
router.get('/complaints', requireUser, async (req, res, next) => {
  try {
    const rows = await notifQueries.listComplaints({ userId: req.user.id });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/complaints', requireUser, async (req, res, next) => {
  try {
    const { subject, body, category } = req.body || {};
    if (!subject || !body) {
      return res.status(400).json({ success: false, error: 'subject and body are required.' });
    }
    const row = await notifQueries.createComplaint({
      userId: req.user.id,
      subject,
      body,
      category,
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});


// ============================================================
// SECURITY (sessions + login history)
// ============================================================
router.get('/security', requireUser, async (req, res, next) => {
  try {
    const sessions = await sessionQueries.listUserSessions(req.user.id);

    let logins = [];
    try {
      const audit = require('../../db/queries/audit');
      logins = await audit.listLogins({ userId: req.user.id, limit: 30 });
    } catch { /* audit helper missing — return empty */ }

    return res.json({ success: true, sessions, logins });
  } catch (err) {
    console.error('[portal/security] error:', err);
    return next(err);
  }
});

router.post('/security/revoke-all', requireUser, async (req, res, next) => {
  try {
    const count = await sessionQueries.revokeAllUserSessions(req.user.id, {
      exceptToken: req.authToken || null,
    });
    return res.json({ success: true, count });
  } catch (err) {
    return next(err);
  }
});

router.post('/security/revoke/:token', requireUser, async (req, res, next) => {
  try {
    await sessionQueries.revokeUserSession(req.params.token);
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// AVATAR UPLOAD — multipart via multer
// ============================================================
router.post('/avatar-upload', requireUser, async (req, res, next) => {
  try {
    // This endpoint expects a file already handled by multer middleware
    // in your previous version. If not, the client should POST to /photo
    // with a URL instead.
    return res.status(400).json({
      success: false,
      error: 'Use POST /api/portal/photo with { photoUrl } for now.',
    });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// PAYMENTS — student submits a payment receipt
// ============================================================
router.post('/payments/submit', requireUser, async (req, res, next) => {
  try {
    const { amount, reference, bankName, depositorName, depositDate, sessionId } = req.body || {};
    if (!amount || !reference) {
      return res.status(400).json({ success: false, error: 'amount and reference are required.' });
    }
    const row = await paymentQueries.create({
      studentId: req.user.id,
      sessionId: sessionId ? Number(sessionId) : req.user.currentSessionId,
      amount: String(amount),
      reference,
      bankName,
      depositorName,
      depositDate,
      status: 'pending',
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// LIBRARY — search books (any logged-in user)
// ============================================================
router.get('/library/books', requireUser, async (req, res, next) => {
  try {
    const rows = await libQueries.listBooks({
      search: req.query.search,
      category: req.query.category,
      availableOnly: req.query.availableOnly === 'true',
      limit: Number(req.query.limit) || 100,
      offset: Number(req.query.offset) || 0,
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

