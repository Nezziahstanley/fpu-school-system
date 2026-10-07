// ============================================================
// FPU — Query helper: library (books, borrows, reservations, fines)
// ============================================================

'use strict';

const { db, sql, schema } = require('../index');
const { eq, and, or, ilike, desc, asc, inArray, lt } = require('drizzle-orm');

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
  if (search) {
    const term = `%${String(search).trim()}%`;
    conds.push(or(ilike(books.title, term), ilike(books.author, term), ilike(books.isbn, term)));
  }
  if (category) conds.push(eq(books.category, category));
  if (availableOnly) conds.push(sql`${books.copiesAvailable} > 0`);
  const where = conds.length ? and(...conds) : undefined;
  return db.select().from(books).where(where).orderBy(asc(books.title)).limit(limit).offset(offset);
}

async function countBooks(filters = {}) {
  const conds = [];
  if (filters.search) {
    const term = `%${String(filters.search).trim()}%`;
    conds.push(or(ilike(books.title, term), ilike(books.author, term), ilike(books.isbn, term)));
  }
  if (filters.category) conds.push(eq(books.category, filters.category));
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db.select({ c: sql`count(*)::int` }).from(books).where(where);
  return rows[0]?.c || 0;
}

async function createBook(data) {
  const copiesTotal = Number(data.copiesTotal) || 1;
  const copiesAvailable = data.copiesAvailable !== undefined ? Number(data.copiesAvailable) : copiesTotal;
  const [row] = await db.insert(books).values({
    title: data.title,
    author: data.author || null,
    isbn: data.isbn || null,
    category: data.category || null,
    publisher: data.publisher || null,
    year: data.year ? Number(data.year) : null,
    copiesTotal,
    copiesAvailable,
    shelf: data.shelf || null,
  }).returning();
  return row;
}

async function updateBook(id, data) {
  const patch = { ...data };
  delete patch.id;
  if (patch.year) patch.year = Number(patch.year);
  if (patch.copiesTotal) patch.copiesTotal = Number(patch.copiesTotal);
  if (patch.copiesAvailable) patch.copiesAvailable = Number(patch.copiesAvailable);
  const [row] = await db.update(books).set(patch).where(eq(books.id, Number(id))).returning();
  return row || null;
}

async function removeBook(id) {
  const [row] = await db.delete(books).where(eq(books.id, Number(id))).returning();
  return row || null;
}

async function adjustCopies(id, delta) {
  const book = await findBookById(id);
  if (!book) return null;
  const next = Math.max(0, Math.min(book.copiesTotal, book.copiesAvailable + Number(delta)));
  const [row] = await db.update(books).set({ copiesAvailable: next }).where(eq(books.id, Number(id))).returning();
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
    Array.isArray(status) ? conds.push(inArray(borrowRecords.status, status)) : conds.push(eq(borrowRecords.status, status));
  }
  const where = conds.length ? and(...conds) : undefined;
  return db.select().from(borrowRecords).where(where).orderBy(desc(borrowRecords.borrowedAt)).limit(limit).offset(offset);
}

async function listBorrowsWithRelations({ userId, status } = {}) {
  const conds = [];
  if (userId) conds.push(eq(borrowRecords.userId, Number(userId)));
  if (status) {
    Array.isArray(status) ? conds.push(inArray(borrowRecords.status, status)) : conds.push(eq(borrowRecords.status, status));
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
  const [row] = await db.insert(borrowRecords).values({
    bookId: Number(data.bookId),
    userId: Number(data.userId),
    dueAt: data.dueAt,
    issuedBy: data.issuedBy ? Number(data.issuedBy) : null,
    status: data.status || 'borrowed',
    remarks: data.remarks || null,
  }).returning();
  await adjustCopies(data.bookId, -1);
  return row;
}

async function returnBorrow(id, receivedBy) {
  const [row] = await db
    .update(borrowRecords)
    .set({ returnedAt: new Date(), status: 'returned', receivedBy: Number(receivedBy) })
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
  const rows = await db
    .update(borrowRecords)
    .set({ status: 'overdue' })
    .where(and(eq(borrowRecords.status, 'borrowed'), lt(borrowRecords.dueAt, new Date())))
    .returning({ id: borrowRecords.id });
  return rows.length;
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
  return db.select().from(bookReservations).where(where).orderBy(desc(bookReservations.reservedAt));
}

async function listReservationsWithRelations({ status } = {}) {
  const where = status ? eq(bookReservations.status, status) : undefined;
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
  const [row] = await db.insert(bookReservations).values({
    bookId: Number(data.bookId),
    userId: Number(data.userId),
    status: 'pending',
  }).returning();
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
  const where = isPaid !== undefined ? eq(libraryFines.isPaid, !!isPaid) : undefined;
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
  const [row] = await db.insert(libraryFines).values({
    userId: Number(data.userId),
    borrowId: data.borrowId ? Number(data.borrowId) : null,
    amount: String(data.amount || 0),
    reason: data.reason || null,
  }).returning();
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

module.exports = {
  // books
  findBookById,
  listBooks,
  countBooks,
  createBook,
  updateBook,
  removeBook,
  adjustCopies,

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