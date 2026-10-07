// ============================================================
// FPU — Admin complaints API
// Mounted at /api/admin/complaints
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const notifQueries = require('../db/queries/notifications');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const STAFF = ['admin', 'registrar', 'rector', 'hod'];

router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { status } = req.query;
    const rows = await notifQueries.listComplaintsWithUser({ status });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await notifQueries.findComplaintById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Complaint not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/respond', requireRole(STAFF), async (req, res, next) => {
  try {
    const { response, status } = req.body || {};
    if (!response) return res.status(400).json({ success: false, error: 'response is required.' });
    const row = await notifQueries.respondToComplaint(req.params.id, {
      response,
      respondedBy: req.user.id,
      status: status || 'resolved',
    });
    if (!row) return res.status(404).json({ success: false, error: 'Complaint not found.' });

    // Notify the complainant
    await notifQueries.createNotification({
      userId: row.userId,
      title: 'Your complaint has been answered',
      body: response,
      type: 'complaint',
    });

    await logAudit({ req, action: 'complaint.respond', entity: 'complaint', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id/status', requireRole(STAFF), async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ success: false, error: 'status is required.' });
    const row = await notifQueries.updateComplaintStatus(req.params.id, status);
    if (!row) return res.status(404).json({ success: false, error: 'Complaint not found.' });
    await logAudit({ req, action: 'complaint.status', entity: 'complaint', entityId: row.id, after: { status } });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const row = await notifQueries.removeComplaint(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Complaint not found.' });
    await logAudit({ req, action: 'complaint.delete', entity: 'complaint', entityId: row.id, before: row });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;