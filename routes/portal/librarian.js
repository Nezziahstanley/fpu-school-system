// ============================================================
// FPU — Librarian portal API
// Mounted at /api/librarian
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const userQueries = require('../../db/queries/users');
const libQueries = require('../../db/queries/library');
const sessionQueries = require('../../db/queries/sessions');
const { db, schema, sql } = require('../../db');
const { eq, inArray } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');
const { logAudit } = require('../../utils/audit');

const { books, borrowRecords, libraryFines } = schema;
const only = requireRole('librarian', 'admin');

// ============================================================
// GET /api/librarian/dashboard
// ============================================================
router.get('/dashboard', only, async (_req, res, next) => {
  try {
    // ---- Stat tiles ----
    const [totalBooks] = await db.select({ c: sql`count(*)::int` }).from(books);

    const [activeBorrows] = await db
      .select({ c: sql`count(*)::int` })
      .from(borrowRecords)
      .where(inArray(borrowRecords.status, ['borrowed', 'overdue']));

    const [overdue] = await db
      .select({ c: sql`count(*)::int` })
      .from(borrowRecords)
      .where(eq(borrowRecords.status, 'overdue'));

    // Outstanding fines = SUM of unpaid amounts (not count)
    const [outstandingFines] = await db
      .select({ total: sql`coalesce(sum(${libraryFines.amount}),0)::numeric` })
      .from(libraryFines)
      .where(eq(libraryFines.isPaid, false));

    // ---- Recent borrows (last 5) ----
    let recentBorrows = [];
    try {
      const rows = await libQueries.listBorrowsWithRelations({});
      recentBorrows = (rows || []).slice(0, 5).map((r) => {
        const b = r.borrow || r.borrowRecord || r;
        const student = r.user || r.student || {};
        const book = r.book || {};
        return {
          id: b.id,
          bookTitle: book.title || b.bookTitle || ('Book #' + b.bookId),
          studentName:
            [student.firstName, student.lastName].filter(Boolean).join(' ') ||
            student.email ||
            ('User #' + b.userId),
          dueAt: b.dueAt,
          borrowedAt: b.borrowedAt,
          returnedAt: b.returnedAt,
          status: b.status,
        };
      });
    } catch (e) { recentBorrows = []; }

    // ---- Reservations awaiting action (pending) ----
    let reservations = [];
    try {
      const rows = await libQueries.listReservationsWithRelations({ status: 'pending' });
      reservations = (rows || []).slice(0, 5).map((r) => {
        const rv = r.reservation || r;
        const student = r.user || r.student || {};
        const book = r.book || {};
        return {
          id: rv.id,
          bookTitle: book.title || rv.bookTitle || ('Book #' + rv.bookId),
          studentName:
            [student.firstName, student.lastName].filter(Boolean).join(' ') ||
            student.email ||
            ('User #' + rv.userId),
          status: rv.status,
          reservedAt: rv.reservedAt,
        };
      });
    } catch (e) { reservations = []; }

    return res.json({
      success: true,
      data: {
        totalBooks: Number(totalBooks?.c || 0),
        activeBorrows: Number(activeBorrows?.c || 0),
        overdue: Number(overdue?.c || 0),
        outstandingFines: Number(outstandingFines?.total || 0),
        recentBorrows,
        reservations,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /api/librarian/books
// ============================================================
router.get('/books', only, async (req, res, next) => {
  try {
    const rows = await libQueries.listBooks({
      search: req.query.search,
      category: req.query.category,
      availableOnly: req.query.availableOnly === 'true',
    });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/librarian/borrows
// ============================================================
router.get('/borrows', only, async (req, res, next) => {
  try {
    const rows = await libQueries.listBorrowsWithRelations({ userId: req.query.userId, status: req.query.status });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/librarian/reservations
// ============================================================
router.get('/reservations', only, async (req, res, next) => {
  try {
    const rows = await libQueries.listReservationsWithRelations({ status: req.query.status });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/librarian/fines
// ============================================================
router.get('/fines', only, async (req, res, next) => {
  try {
    const rows = await libQueries.listFinesWithUser({
      isPaid: req.query.isPaid === undefined ? undefined : req.query.isPaid === 'true',
    });
    return res.json({ success: true, data: rows });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/librarian/borrows
// ============================================================
router.post('/borrows', only, async (req, res, next) => {
  try {
    const { bookId, userId, dueAt } = req.body || {};
    if (!bookId || !userId || !dueAt) {
      return res.status(400).json({ success: false, error: 'bookId, userId, dueAt are required.' });
    }
    const row = await libQueries.createBorrow({ bookId, userId, dueAt, issuedBy: req.user.id });
    await logAudit({ req, action: 'librarian.borrow', entity: 'borrow_record', entityId: row.id });
    return res.status(201).json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/librarian/borrows/:id/return
// ============================================================
router.post('/borrows/:id/return', only, async (req, res, next) => {
  try {
    const row = await libQueries.returnBorrow(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Borrow record not found.' });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/librarian/reports
// ============================================================
router.get('/reports', only, async (_req, res, next) => {
  try {
    const byStatus = await db
      .select({ status: borrowRecords.status, count: sql`count(*)::int` })
      .from(borrowRecords)
      .groupBy(borrowRecords.status);
    const fines = await db
      .select({ isPaid: libraryFines.isPaid, count: sql`count(*)::int`, total: sql`coalesce(sum(${libraryFines.amount}),0)::numeric` })
      .from(libraryFines)
      .groupBy(libraryFines.isPaid);
    return res.json({ success: true, data: { borrowsByStatus: byStatus, fines } });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/librarian/profile, /security
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