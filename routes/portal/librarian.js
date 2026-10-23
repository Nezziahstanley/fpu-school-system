// ============================================================
// FPU — Librarian portal API
// Mounted at /api/librarian
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');

const userQueries = require('../../db/queries/users');
const libQueries = require('../../db/queries/library');
const sessionQueries = require('../../db/queries/sessions');
const { db, schema } = require('../../db');
const { eq, inArray, and, sql } = require('drizzle-orm');
const { requireRole } = require('../../middleware/auth');
const { logAudit } = require('../../utils/audit');

// Cloudinary upload
const { storage } = require('../../utils/cloudinary');
const upload = multer({ storage });

const { books, borrowRecords, libraryFines } = schema;
const only = requireRole('librarian', 'admin');

// ============================================================
// GET /api/librarian/dashboard
// ============================================================
router.get('/dashboard', only, async (_req, res, next) => {
  try {
    const [totalBooks] = await db.select({ c: sql`count(*)::int` }).from(books);

    const [activeBorrows] = await db
      .select({ c: sql`count(*)::int` })
      .from(borrowRecords)
      .where(inArray(borrowRecords.status, ['borrowed', 'overdue']));

    const [overdue] = await db
      .select({ c: sql`count(*)::int` })
      .from(borrowRecords)
      .where(eq(borrowRecords.status, 'overdue'));

    const [outstandingFines] = await db
      .select({ total: sql`coalesce(sum(${libraryFines.amount}),0)::numeric` })
      .from(libraryFines)
      .where(eq(libraryFines.isPaid, false));

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
          studentName: [student.firstName, student.lastName].filter(Boolean).join(' ') || student.email || ('User #' + b.userId),
          dueAt: b.dueAt, borrowedAt: b.borrowedAt, returnedAt: b.returnedAt, status: b.status,
        };
      });
    } catch (e) { recentBorrows = []; }

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
          studentName: [student.firstName, student.lastName].filter(Boolean).join(' ') || student.email || ('User #' + rv.userId),
          status: rv.status, reservedAt: rv.reservedAt,
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
        recentBorrows, reservations,
      },
    });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/librarian/books
// ============================================================
router.get('/books', only, async (req, res, next) => {
  try {
    const result = await db.execute(sql`
      SELECT id, title, author, isbn, category, publisher, year,
             copies_total AS "copiesTotal", copies_available AS "copiesAvailable",
             shelf, department_id AS "departmentId", is_general AS "isGeneral",
             ebook_url AS "ebookUrl", external_url AS "externalUrl",
             external_source AS "externalSource", description,
             is_digital AS "isDigital", is_physical AS "isPhysical",
             created_at AS "createdAt"
      FROM books
      ORDER BY title ASC
    `);
    return res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    console.error('[librarian/books GET] Error:', err);
    return next(err);
  }
});

// ============================================================
// POST /api/librarian/books — Create with PDF upload
// ============================================================
router.post('/books', only, upload.fields([{ name: 'pdf', maxCount: 1 }]), async (req, res, next) => {
  console.log('===========================================');
  console.log('[librarian/books POST] Request received');
  console.log('  body:', JSON.stringify(req.body, null, 2));
  console.log('  files:', req.files ? Object.keys(req.files) : 'none');

  try {
    const b = req.body || {};
    if (!b.title) {
      console.log('[librarian/books POST] ❌ Missing title');
      return res.status(400).json({ success: false, error: 'Title is required.' });
    }

    const copiesTotal = Math.max(1, Number(b.copiesTotal || 1));
    let ebookUrl = null;
    if (req.files && req.files.pdf && req.files.pdf[0]) {
      ebookUrl = req.files.pdf[0].path;
      console.log('[librarian/books POST] PDF uploaded to:', ebookUrl);
    }

    console.log('[librarian/books POST] Inserting book with ebookUrl:', ebookUrl);

    const result = await db.execute(sql`
      INSERT INTO books (
        title, author, isbn, category, publisher, year,
        copies_total, copies_available, shelf, department_id, is_general,
        ebook_url, external_url, external_source, description,
        is_digital, is_physical
      ) VALUES (
        ${String(b.title).trim()}, ${b.author || null}, ${b.isbn || null},
        ${b.category || null}, ${b.publisher || null}, ${b.year ? Number(b.year) : null},
        ${copiesTotal}, ${copiesTotal}, ${b.shelf || null},
        ${b.departmentId ? Number(b.departmentId) : null}, ${b.isGeneral !== 'false'},
        ${ebookUrl}, ${b.externalUrl || null}, ${b.externalSource || null},
        ${b.description || null},
        ${b.isDigital === 'true'}, ${b.isPhysical !== 'false'}
      )
      RETURNING id, title
    `);

    const row = result.rows[0];
    console.log('[librarian/books POST] ✅ Inserted:', row);

    await logAudit({ req, action: 'librarian.book_create', entity: 'book', entityId: row.id });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error('[librarian/books POST] ❌ Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// PUT /api/librarian/books/:id — Update
// ============================================================
router.put('/books/:id', only, upload.fields([{ name: 'pdf', maxCount: 1 }]), async (req, res, next) => {
  console.log('===========================================');
  console.log('[librarian/books PUT] Request for ID:', req.params.id);
  console.log('  body:', JSON.stringify(req.body, null, 2));
  console.log('  files:', req.files ? Object.keys(req.files) : 'none');

  try {
    const bookId = Number(req.params.id);
    const b = req.body || {};

    if (!b.title) {
      return res.status(400).json({ success: false, error: 'Title is required.' });
    }

    let ebookUrl = null;
    if (req.files && req.files.pdf && req.files.pdf[0]) {
      ebookUrl = req.files.pdf[0].path;
      console.log('[librarian/books PUT] New PDF:', ebookUrl);
    }

    await db.execute(sql`
      UPDATE books SET
        title = ${String(b.title).trim()},
        author = ${b.author || null},
        isbn = ${b.isbn || null},
        category = ${b.category || null},
        publisher = ${b.publisher || null},
        year = ${b.year ? Number(b.year) : null},
        copies_total = ${Math.max(1, Number(b.copiesTotal || 1))},
        shelf = ${b.shelf || null},
        is_general = ${b.isGeneral !== 'false'},
        ${ebookUrl ? sql`ebook_url = ${ebookUrl},` : sql``}
        external_url = ${b.externalUrl || null},
        external_source = ${b.externalSource || null},
        description = ${b.description || null},
        is_digital = ${b.isDigital === 'true'},
        is_physical = ${b.isPhysical !== 'false'}
      WHERE id = ${bookId}
    `);

    console.log('[librarian/books PUT] ✅ Updated book ID:', bookId);
    await logAudit({ req, action: 'librarian.book_update', entity: 'book', entityId: bookId });
    return res.json({ success: true });
  } catch (err) {
    console.error('[librarian/books PUT] ❌ Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// DELETE /api/librarian/books/:id
// ============================================================
router.delete('/books/:id', only, async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM books WHERE id = ${Number(req.params.id)}`);
    await logAudit({ req, action: 'librarian.book_delete', entity: 'book', entityId: req.params.id });
    return res.json({ success: true });
  } catch (err) {
    if (err && /foreign key|violates/i.test(err.message || '')) {
      return res.status(409).json({ success: false, error: 'Cannot delete — this book has borrow history.' });
    }
    return next(err);
  }
});

// ============================================================
// POST /api/librarian/books/:id/adjust
// ============================================================
router.post('/books/:id/adjust', only, async (req, res, next) => {
  try {
    const delta = Number(req.body?.delta || 0);
    if (!delta) return res.status(400).json({ success: false, error: 'delta must be non-zero.' });
    const row = await libQueries.changeInventory(req.params.id, delta);
    if (!row) return res.status(404).json({ success: false, error: 'Book not found.' });
    await logAudit({ req, action: 'librarian.book_adjust', entity: 'book', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// GET /api/librarian/borrows
// ============================================================
router.get('/borrows', only, async (req, res, next) => {
  try {
    const rows = await libQueries.listBorrowsWithRelations({
      userId: req.query.userId,
      status: req.query.status,
    });
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
// POST /api/librarian/reservations/:id/ready
// ============================================================
router.post('/reservations/:id/ready', only, async (req, res, next) => {
  try {
    const row = await libQueries.updateReservationStatus(req.params.id, 'ready', { readyAt: new Date() });
    if (!row) return res.status(404).json({ success: false, error: 'Reservation not found.' });
    await logAudit({ req, action: 'librarian.reservation_ready', entity: 'book_reservation', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/librarian/reservations/:id/fulfill
// ============================================================
router.post('/reservations/:id/fulfill', only, async (req, res, next) => {
  try {
    const row = await libQueries.updateReservationStatus(req.params.id, 'fulfilled', { fulfilledAt: new Date() });
    if (!row) return res.status(404).json({ success: false, error: 'Reservation not found.' });
    await logAudit({ req, action: 'librarian.reservation_fulfill', entity: 'book_reservation', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ============================================================
// POST /api/librarian/reservations/:id/cancel
// ============================================================
router.post('/reservations/:id/cancel', only, async (req, res, next) => {
  try {
    const row = await libQueries.updateReservationStatus(req.params.id, 'cancelled', {});
    if (!row) return res.status(404).json({ success: false, error: 'Reservation not found.' });
    await logAudit({ req, action: 'librarian.reservation_cancel', entity: 'book_reservation', entityId: row.id });
    return res.json({ success: true, data: row });
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
// POST /api/librarian/fines/:id/pay
// ============================================================
router.post('/fines/:id/pay', only, async (req, res, next) => {
  try {
    const row = await libQueries.payFine(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Fine not found.' });
    await logAudit({ req, action: 'librarian.fine_paid', entity: 'library_fine', entityId: row.id });
    return res.json({ success: true, data: row });
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