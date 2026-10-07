// ============================================================
// FPU — Admin library API
// Mounted at /api/admin/library
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const libQueries = require('../db/queries/library');
const { requireRole, requireUser } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const STAFF = ['admin', 'librarian'];

// ---------------- Books (read-only for any authenticated user) ----------------

router.get('/books', requireUser, async (req, res, next) => {
  try {
    const { search, category, availableOnly, limit = 200, offset = 0 } = req.query;
    const rows = await libQueries.listBooks({
      search,
      category,
      availableOnly: availableOnly === 'true',
      limit: Number(limit),
      offset: Number(offset),
    });
    const total = await libQueries.countBooks({ search, category });
    return res.json({ success: true, data: rows, total });
  } catch (err) {
    return next(err);
  }
});

router.get('/books/:id', requireUser, async (req, res, next) => {
  try {
    const row = await libQueries.findBookById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Book not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ---------------- Books (mutations — staff only) ----------------

router.post('/books', requireRole(STAFF), async (req, res, next) => {
  try {
    const { title } = req.body || {};
    if (!title) return res.status(400).json({ success: false, error: 'title is required.' });
    const row = await libQueries.createBook(req.body);
    await logAudit({ req, action: 'library.book_create', entity: 'book', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.put('/books/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const existing = await libQueries.findBookById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Book not found.' });
    const row = await libQueries.updateBook(existing.id, req.body);
    await logAudit({ req, action: 'library.book_update', entity: 'book', entityId: existing.id, before: existing, after: row });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/books/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const existing = await libQueries.findBookById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Book not found.' });
    await libQueries.removeBook(existing.id);
    await logAudit({ req, action: 'library.book_delete', entity: 'book', entityId: existing.id, before: existing });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ---------------- Borrows ----------------

router.get('/borrows', requireRole(STAFF), async (req, res, next) => {
  try {
    const { userId, status } = req.query;
    const rows = await libQueries.listBorrowsWithRelations({ userId, status });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/borrows', requireRole(STAFF), async (req, res, next) => {
  try {
    const { bookId, userId, dueAt } = req.body || {};
    if (!bookId || !userId || !dueAt) {
      return res.status(400).json({ success: false, error: 'bookId, userId, dueAt are required.' });
    }
    const row = await libQueries.createBorrow({ bookId, userId, dueAt, issuedBy: req.user.id });
    await logAudit({ req, action: 'library.borrow', entity: 'borrow_record', entityId: row.id });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/borrows/:id/return', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await libQueries.returnBorrow(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Borrow record not found.' });
    await logAudit({ req, action: 'library.return', entity: 'borrow_record', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/borrows/:id/lost', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await libQueries.markBorrowLost(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Borrow record not found.' });
    await logAudit({ req, action: 'library.lost', entity: 'borrow_record', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ---------------- Reservations ----------------

router.get('/reservations', requireRole(STAFF), async (req, res, next) => {
  try {
    const rows = await libQueries.listReservationsWithRelations({ status: req.query.status });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/reservations/:id/ready', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await libQueries.updateReservationStatus(req.params.id, 'ready', { readyAt: new Date() });
    if (!row) return res.status(404).json({ success: false, error: 'Reservation not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/reservations/:id/fulfill', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await libQueries.updateReservationStatus(req.params.id, 'fulfilled', { fulfilledAt: new Date() });
    if (!row) return res.status(404).json({ success: false, error: 'Reservation not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/reservations/:id/cancel', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await libQueries.updateReservationStatus(req.params.id, 'cancelled');
    if (!row) return res.status(404).json({ success: false, error: 'Reservation not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ---------------- Fines ----------------

router.get('/fines', requireRole(STAFF), async (req, res, next) => {
  try {
    const { isPaid } = req.query;
    const rows = await libQueries.listFinesWithUser({
      isPaid: isPaid === undefined ? undefined : isPaid === 'true',
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/fines', requireRole(STAFF), async (req, res, next) => {
  try {
    const { userId, amount, reason } = req.body || {};
    if (!userId || amount === undefined) {
      return res.status(400).json({ success: false, error: 'userId and amount are required.' });
    }
    const row = await libQueries.createFine({
      userId, amount, reason, borrowId: req.body?.borrowId,
    });
    await logAudit({ req, action: 'library.fine_create', entity: 'library_fine', entityId: row.id });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/fines/:id/pay', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await libQueries.payFine(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Fine not found.' });
    await logAudit({ req, action: 'library.fine_pay', entity: 'library_fine', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.delete('/fines/:id', requireRole(['admin', 'librarian']), async (req, res, next) => {
  try {
    const row = await libQueries.removeFine(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Fine not found.' });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ---------------- Overdue sweep ----------------

router.post('/sweep-overdue', requireRole(STAFF), async (req, res, next) => {
  try {
    const count = await libQueries.sweepOverdue();
    await logAudit({ req, action: 'library.sweep_overdue', after: { count } });
    return res.json({ success: true, count });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;