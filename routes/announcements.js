// ============================================================
// FPU — Admin notifications & messages API
// Mounted at /api/admin/notifications
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const notifQueries = require('../db/queries/notifications');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const STAFF = ['admin', 'registrar', 'rector', 'hod', 'bursar'];

router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { userId, limit = 200, offset = 0 } = req.query;
    // If admin does NOT pass userId → show ALL notifications (dashboard view)
    const target = userId ? Number(userId) : null;
    const rows = await notifQueries.listNotifications(target, {
      limit: Number(limit),
      offset: Number(offset),
    });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

router.post('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { title, body } = req.body || {};
    if (!title || !body) return res.status(400).json({ success: false, error: 'title and body are required.' });

    const row = await notifQueries.createAnnouncement({
      ...req.body,
      authorId: req.user.id,
    });

    // Cross-post to notifications if audience is 'all'
    if ((row.audience || 'all') === 'all') {
      try {
        await notifQueries.createNotification({
          userId: null,
          title: row.title,
          body: row.body,
          type: 'info',
          link: '#announcements',
          showOnMarquee: row.showOnMarquee === true,
        });
      } catch (e) {
        console.error('[announcements] cross-post failed:', e.message);
      }
    }

    await logAudit({ req, action: 'announcement.create', entity: 'announcement', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) { return next(err); }
});

router.post('/broadcast', requireRole(['admin', 'registrar', 'rector']), async (req, res, next) => {
  try {
    const { userIds, title, body, type, link, showOnMarquee } = req.body || {};
    if (!Array.isArray(userIds) || !title) {
      return res.status(400).json({ success: false, error: 'userIds[] and title are required.' });
    }
    const rows = userIds.map((uid) => ({
      userId: Number(uid), title, body: body || null,
      type: type || 'info', link: link || null, showOnMarquee: showOnMarquee === true,
    }));
    const inserted = await notifQueries.bulkCreateNotifications(rows);
    await logAudit({ req, action: 'notification.broadcast', after: { count: inserted.length } });
    return res.status(201).json({ success: true, data: inserted });
  } catch (err) { return next(err); }
});

router.post('/:id/read', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await notifQueries.markNotificationRead(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Notification not found.' });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

router.post('/read-all', requireRole(STAFF), async (req, res, next) => {
  try {
    const count = await notifQueries.markAllNotificationsRead(req.user.id);
    return res.json({ success: true, count });
  } catch (err) { return next(err); }
});

router.delete('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await notifQueries.removeNotification(req.params.id, null);
    if (!row) return res.status(404).json({ success: false, error: 'Notification not found.' });
    return res.json({ success: true });
  } catch (err) { return next(err); }
});

module.exports = router;