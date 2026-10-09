// ============================================================
// FPU — Query helper: library (books, borrows, reservations, fines)
// ============================================================

'use strict';

const { db, schema, sql } = require('..');
const { eq, and, or, ilike, inArray, desc, asc } = require('drizzle-orm');

const { books, borrowRecords, bookReservations, libraryFines, users } = schema;

// ============================================================
// BOOKS
// ============================================================

async function findBookById(id) {
  if (!id) return null;
  const [row] = await db.select().from(books).where(eq(books.id, Number(id))).limit(1);
  return row || null;
}

async function listBooks({ search, category, availableOnly, limit = 200, offset = 0 } = {}) {
  const conds = [];
  if (category) conds.push(eq(books.category, category));
  if (availableOnly) conds.push(sql`${books.copiesAvailable} > 0`);
  if (search) {
    const term = `%${String(search).trim()}%`;
    conds.push(or(
      ilike(books.title, term),
      ilike(books.author, term),
      ilike(books.isbn, term),
      ilike(books.publisher, term)
    ));
  }
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select()
    .from(books)
    .where(where)
    .orderBy(asc(books.title))
    .limit(Number(limit))
    .offset(Number(offset));
}

async function countBooks(filters = {}) {
  const { search, category, availableOnly } = filters;
  const conds = [];
  if (category) conds.push(eq(books.category, category));
  if (availableOnly) conds.push(sql`${books.copiesAvailable} > 0`);
  if (search) {
    const term = `%${String(search).trim()}%`;
    conds.push(or(
      ilike(books.title, term),
      ilike(books.author, term),
      ilike(books.isbn, term)
    ));
  }
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db.select({ id: books.id }).from(books).where(where);
  return rows.length;
}

async function createBook(data) {
  const [row] = await db
    .insert(books)
    .values({
      title: data.title,
      author: data.author || null,
      isbn: data.isbn || null,
      category: data.category || null,
      publisher: data.publisher || null,
      year: data.year ? Number(data.year) : null,
      copiesTotal: Number(data.copiesTotal || 1),
      copiesAvailable: Number(data.copiesAvailable != null ? data.copiesAvailable : (data.copiesTotal || 1)),
      shelf: data.shelf || null,
      departmentId: data.departmentId ? Number(data.departmentId) : null,
      isGeneral: data.isGeneral !== false,
    })
    .returning();
  return row;
}

async function updateBook(id, data) {
  const allowed = ['title', 'author', 'isbn', 'category', 'publisher', 'year', 'copiesTotal', 'shelf', 'departmentId', 'isGeneral'];
  const clean = {};
  for (const k of allowed) {
    if (data[k] !== undefined) {
      if (k === 'year') clean[k] = data[k] ? Number(data[k]) : null;
      else if (k === 'copiesTotal') clean[k] = Math.max(1, Number(data[k]));
      else if (k === 'departmentId') clean[k] = data[k] ? Number(data[k]) : null;
      else if (k === 'isGeneral') clean[k] = !!data[k];
      else clean[k] = data[k] || null;
    }
  }
  if (!Object.keys(clean).length) return findBookById(id);
  const [row] = await db.update(books).set(clean).where(eq(books.id, Number(id))).returning();
  return row || null;
}

async function removeBook(id) {
  const [row] = await db.delete(books).where(eq(books.id, Number(id))).returning();
  return row || null;
}

// ------------------------------------------------------------
// adjustCopies — used by the borrow lifecycle.
// Only nudges copiesAvailable; copiesTotal stays the same.
//   createBorrow → -1
//   returnBorrow → +1
// ------------------------------------------------------------
async function adjustCopies(id, delta) {
  const book = await findBookById(id);
  if (!book) return null;
  const next = Math.max(0, Math.min(book.copiesTotal, book.copiesAvailable + Number(delta)));
  const [row] = await db.update(books).set({ copiesAvailable: next }).where(eq(books.id, Number(id))).returning();
  return row || null;
}

// ------------------------------------------------------------
// changeInventory — catalogue-level physical inventory change.
// Moves BOTH copiesTotal and copiesAvailable together.
//   +1 → acquired a new physical copy
//   -1 → removed a damaged/lost copy
// ------------------------------------------------------------
async function changeInventory(id, delta) {
  const book = await findBookById(id);
  if (!book) return null;
  const d = Number(delta) || 0;
  if (!d) return book;
  const newTotal     = Math.max(0, Number(book.copiesTotal)     + d);
  const newAvailable = Math.max(0, Math.min(newTotal, Number(book.copiesAvailable) + d));
  const [row] = await db
    .update(books)
    .set({ copiesTotal: newTotal, copiesAvailable: newAvailable })
    .where(eq(books.id, Number(id)))
    .returning();
  return row || null;
}

// ============================================================
// BORROW RECORDS
// ============================================================

async function findBorrowById(id) {
  if (!id) return null;
  const [row] = await db.select().from(borrowRecords).where(eq(borrowRecords.id, Number(id))).limit(1);
  return row || null;
}

async function listBorrows({ userId, bookId, status, limit = 200, offset = 0 } = {}) {
  const conds = [];
  if (userId) conds.push(eq(borrowRecords.userId, Number(userId)));
  if (bookId) conds.push(eq(borrowRecords.bookId, Number(bookId)));
  if (status) {
    Array.isArray(status)
      ? conds.push(inArray(borrowRecords.status, status))
      : conds.push(eq(borrowRecords.status, status));
  }
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select()
    .from(borrowRecords)
    .where(where)
    .orderBy(desc(borrowRecords.borrowedAt))
    .limit(Number(limit))
    .offset(Number(offset));
}

async function listBorrowsWithRelations({ userId, status } = {}) {
  const conds = [];
  if (userId) conds.push(eq(borrowRecords.userId, Number(userId)));
  if (status) {
    Array.isArray(status)
      ? conds.push(inArray(borrowRecords.status, status))
      : conds.push(eq(borrowRecords.status, status));
  }
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({
      borrow: borrowRecords,
      book: books,
      user: users,
    })
    .from(borrowRecords)
    .leftJoin(books, eq(borrowRecords.bookId, books.id))
    .leftJoin(users, eq(borrowRecords.userId, users.id))
    .where(where)
    .orderBy(desc(borrowRecords.borrowedAt));
}

async function createBorrow(data) {
  const [row] = await db
    .insert(borrowRecords)
    .values({
      bookId: Number(data.bookId),
      userId: Number(data.userId),
      dueAt: data.dueAt,
      status: 'borrowed',
      issuedBy: data.issuedBy ? Number(data.issuedBy) : null,
      remarks: data.remarks || null,
    })
    .returning();
  await adjustCopies(data.bookId, -1);
  return row;
}

async function returnBorrow(id, receivedBy) {
  const [row] = await db
    .update(borrowRecords)
    .set({ status: 'returned', returnedAt: new Date(), receivedBy: Number(receivedBy) })
    .where(eq(borrowRecords.id, Number(id)))
    .returning();
  if (row) await adjustCopies(row.bookId, +1);
  return row || null;
}

async function markBorrowLost(id) {
  const [row] = await db
    .update(borrowRecords)
    .set({ status: 'lost' })
    .where(eq(borrowRecords.id, Number(id)))
    .returning();
  return row || null;
}

async function sweepOverdue() {
  const now = new Date();
  const rows = await db
    .update(borrowRecords)
    .set({ status: 'overdue' })
    .where(and(
      eq(borrowRecords.status, 'borrowed'),
      sql`${borrowRecords.dueAt} < ${now}`
    ))
    .returning();
  return rows;
}

// ============================================================
// RESERVATIONS
// ============================================================

async function findReservationById(id) {
  if (!id) return null;
  const [row] = await db.select().from(bookReservations).where(eq(bookReservations.id, Number(id))).limit(1);
  return row || null;
}

async function listReservations({ userId, bookId, status } = {}) {
  const conds = [];
  if (userId) conds.push(eq(bookReservations.userId, Number(userId)));
  if (bookId) conds.push(eq(bookReservations.bookId, Number(bookId)));
  if (status) conds.push(eq(bookReservations.status, status));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select()
    .from(bookReservations)
    .where(where)
    .orderBy(desc(bookReservations.reservedAt));
}

async function listReservationsWithRelations({ status } = {}) {
  const conds = [];
  if (status) conds.push(eq(bookReservations.status, status));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({
      reservation: bookReservations,
      book: books,
      user: users,
    })
    .from(bookReservations)
    .leftJoin(books, eq(bookReservations.bookId, books.id))
    .leftJoin(users, eq(bookReservations.userId, users.id))
    .where(where)
    .orderBy(desc(bookReservations.reservedAt));
}

async function createReservation(data) {
  const [row] = await db
    .insert(bookReservations)
    .values({
      bookId: Number(data.bookId),
      userId: Number(data.userId),
      status: data.status || 'pending',
    })
    .returning();
  return row;
}

async function updateReservationStatus(id, status, extras = {}) {
  const patch = { status, ...extras };
  const [row] = await db.update(bookReservations).set(patch).where(eq(bookReservations.id, Number(id))).returning();
  return row || null;
}

// ============================================================
// FINES
// ============================================================

async function listFines({ userId, isPaid } = {}) {
  const conds = [];
  if (userId) conds.push(eq(libraryFines.userId, Number(userId)));
  if (isPaid !== undefined) conds.push(eq(libraryFines.isPaid, !!isPaid));
  const where = conds.length ? and(...conds) : undefined;

  return db.select().from(libraryFines).where(where).orderBy(desc(libraryFines.createdAt));
}

async function listFinesWithUser({ isPaid } = {}) {
  const conds = [];
  if (isPaid !== undefined) conds.push(eq(libraryFines.isPaid, !!isPaid));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({
      fine: libraryFines,
      user: users,
    })
    .from(libraryFines)
    .leftJoin(users, eq(libraryFines.userId, users.id))
    .where(where)
    .orderBy(desc(libraryFines.createdAt));
}

async function createFine(data) {
  const [row] = await db
    .insert(libraryFines)
    .values({
      userId: Number(data.userId),
      borrowId: data.borrowId ? Number(data.borrowId) : null,
      amount: String(data.amount || 0),
      reason: data.reason || null,
      isPaid: false,
    })
    .returning();
  return row;
}

async function payFine(id) {
  const [row] = await db
    .update(libraryFines)
    .set({ isPaid: true, paidAt: new Date() })
    .where(eq(libraryFines.id, Number(id)))
    .returning();
  return row || null;
}

async function removeFine(id) {
  const [row] = await db.delete(libraryFines).where(eq(libraryFines.id, Number(id))).returning();
  return row || null;
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  // books
  findBookById,
  listBooks,
  countBooks,
  createBook,
  updateBook,
  removeBook,
  adjustCopies,
  changeInventory,

  // borrows
  findBorrowById,
  listBorrows,
  listBorrowsWithRelations,
  createBorrow,
  returnBorrow,
  markBorrowLost,
  sweepOverdue,

  // reservations
  findReservationById,
  listReservations,
  listReservationsWithRelations,
  createReservation,
  updateReservationStatus,

  // fines
  listFines,
  listFinesWithUser,
  createFine,
  payFine,
  removeFine,
};