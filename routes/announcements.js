// ============================================================
// FPU — Admin announcements API
// Mounted at /api/admin/announcements
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const notifQueries = require('../db/queries/notifications');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const STAFF = ['admin', 'registrar', 'rector', 'academic_officer', 'lecturer', 'hod', 'bursar', 'librarian', 'exam_officer', 'admission_officer'];

router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { audience, isPublished } = req.query;
    const rows = await notifQueries.listAnnouncementsWithAuthor({
      audience,
      isPublished: isPublished === undefined ? undefined : isPublished === 'true',
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await notifQueries.findAnnouncementById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Announcement not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { title, body } = req.body || {};
    if (!title || !body) return res.status(400).json({ success: false, error: 'title and body are required.' });
    const row = await notifQueries.createAnnouncement({ ...req.body, authorId: req.user.id });
    await logAudit({ req, action: 'announcement.create', entity: 'announcement', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const existing = await notifQueries.findAnnouncementById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Announcement not found.' });
    const patch = { ...req.body };
    delete patch.id;
    delete patch.authorId;
    const row = await notifQueries.updateAnnouncement(existing.id, patch);
    await logAudit({ req, action: 'announcement.update', entity: 'announcement', entityId: existing.id, before: existing, after: row });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireRole(['admin', 'registrar']), async (req, res, next) => {
  try {
    const row = await notifQueries.removeAnnouncement(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Announcement not found.' });
    await logAudit({ req, action: 'announcement.delete', entity: 'announcement', entityId: row.id, before: row });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;