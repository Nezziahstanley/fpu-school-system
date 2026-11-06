// ============================================================
// FPU — Library Database Queries
// ============================================================

'use strict';

const db = require('../db'); // Adjust path if your db connection is elsewhere

// ============================================
// 1. BORROWS (The main fix)
// ============================================
async function listBorrowsWithRelations({ userId, status } = {}) {
  let whereClause = 'WHERE 1=1';
  const params = [];

  if (userId) {
    params.push(userId);
    whereClause += ` AND br.user_id = $${params.length}`;
  }

  if (status) {
    params.push(status);
    whereClause += ` AND br.status = $${params.length}`;
  }

  const query = `
    SELECT 
      br.id,
      br.status,
      br.borrowed_at,
      br.due_at,
      br.returned_at,
      u.first_name,
      u.last_name,
      u.matric_number,
      b.title AS book_title,
      b.author AS book_author
    FROM borrow_records br
    LEFT JOIN users u ON br.user_id = u.id
    LEFT JOIN books b ON br.book_id = b.id
    ${whereClause}
    ORDER BY br.id DESC
  `;

  const result = await db.query(query, params);
  return result.rows;
}

async function createBorrow({ bookId, userId, dueAt, issuedBy }) {
  const query = `
    INSERT INTO borrow_records (book_id, user_id, due_at, issued_by, status)
    VALUES ($1, $2, $3, $4, 'borrowed')
    RETURNING *
  `;
  const result = await db.query(query, [bookId, userId, dueAt, issuedBy]);
  return result.rows[0];
}

async function returnBorrow(borrowId, receivedBy) {
  const query = `
    UPDATE borrow_records 
    SET status = 'returned', returned_at = NOW(), received_by = $2
    WHERE id = $1
    RETURNING *
  `;
  const result = await db.query(query, [borrowId, receivedBy]);
  return result.rows[0];
}

async function markBorrowLost(borrowId) {
  const query = `
    UPDATE borrow_records 
    SET status = 'lost', returned_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const result = await db.query(query, [borrowId]);
  return result.rows[0];
}

// ============================================
// 2. BOOKS
// ============================================
async function listBooks({ search, category, availableOnly, limit = 200, offset = 0 }) {
  let query = `SELECT * FROM books WHERE 1=1`;
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (title ILIKE $${params.length} OR author ILIKE $${params.length})`;
  }
  if (category) {
    params.push(category);
    query += ` AND category = $${params.length}`;
  }
  if (availableOnly) {
    query += ` AND available_copies > 0`;
  }

  params.push(limit);
  query += ` ORDER BY title ASC LIMIT $${params.length}`;
  
  params.push(offset);
  query += ` OFFSET $${params.length}`;

  const result = await db.query(query, params);
  return result.rows;
}

async function countBooks({ search, category }) {
  let query = `SELECT COUNT(*) FROM books WHERE 1=1`;
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (title ILIKE $${params.length} OR author ILIKE $${params.length})`;
  }
  if (category) {
    params.push(category);
    query += ` AND category = $${params.length}`;
  }

  const result = await db.query(query, params);
  return parseInt(result.rows[0].count, 10);
}

async function findBookById(id) {
  const result = await db.query('SELECT * FROM books WHERE id = $1', [id]);
  return result.rows[0];
}

async function createBook(data) {
  const query = `
    INSERT INTO books (title, author, category, isbn, total_copies, available_copies)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  const result = await db.query(query, [
    data.title, data.author, data.category, data.isbn, data.totalCopies, data.totalCopies // Default available to total
  ]);
  return result.rows[0];
}

async function updateBook(id, data) {
  // Basic dynamic update (you can expand this)
  const query = `
    UPDATE books SET 
      title = COALESCE($1, title), 
      author = COALESCE($2, author), 
      category = COALESCE($3, category)
    WHERE id = $4 RETURNING *
  `;
  const result = await db.query(query, [data.title, data.author, data.category, id]);
  return result.rows[0];
}

async function removeBook(id) {
  const result = await db.query('DELETE FROM books WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}

// ============================================
// 3. RESERVATIONS
// ============================================
async function listReservationsWithRelations({ status }) {
  let query = `
    SELECT r.*, u.first_name, u.last_name, b.title AS book_title
    FROM book_reservations r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN books b ON r.book_id = b.id
    WHERE 1=1
  `;
  const params = [];
  if (status) {
    params.push(status);
    query += ` AND r.status = $${params.length}`;
  }
  query += ` ORDER BY r.created_at DESC`;
  
  const result = await db.query(query, params);
  return result.rows;
}

async function updateReservationStatus(id, status, extraData = {}) {
  let setClause = `status = $2`;
  const params = [id, status];

  if (extraData.readyAt) {
    params.push(extraData.readyAt);
    setClause += `, ready_at = $${params.length}`;
  }
  if (extraData.fulfilledAt) {
    params.push(extraData.fulfilledAt);
    setClause += `, fulfilled_at = $${params.length}`;
  }

  const query = `UPDATE book_reservations SET ${setClause} WHERE id = $1 RETURNING *`;
  const result = await db.query(query, params);
  return result.rows[0];
}

// ============================================
// 4. FINES
// ============================================
async function listFinesWithUser({ isPaid } = {}) {
  let query = `
    SELECT f.*, u.first_name, u.last_name, u.matric_number
    FROM library_fines f
    LEFT JOIN users u ON f.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  if (isPaid !== undefined) {
    params.push(isPaid);
    query += ` AND f.is_paid = $${params.length}`;
  }
  query += ` ORDER BY f.created_at DESC`;
  
  const result = await db.query(query, params);
  return result.rows;
}

async function createFine({ userId, amount, reason, borrowId }) {
  const query = `
    INSERT INTO library_fines (user_id, amount, reason, borrow_id)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const result = await db.query(query, [userId, amount, reason, borrowId || null]);
  return result.rows[0];
}

async function payFine(id) {
  const query = `
    UPDATE library_fines SET is_paid = true, paid_at = NOW()
    WHERE id = $1 RETURNING *
  `;
  const result = await db.query(query, [id]);
  return result.rows[0];
}

async function removeFine(id) {
  const result = await db.query('DELETE FROM library_fines WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}

// ============================================
// 5. OVERDUE SWEEP
// ============================================
async function sweepOverdue() {
  const query = `
    UPDATE borrow_records
    SET status = 'overdue'
    WHERE status = 'borrowed' AND due_at < NOW()
    RETURNING id
  `;
  const result = await db.query(query);
  return result.rowCount;
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  listBorrowsWithRelations,
  createBorrow,
  returnBorrow,
  markBorrowLost,
  listBooks,
  countBooks,
  findBookById,
  createBook,
  updateBook,
  removeBook,
  listReservationsWithRelations,
  updateReservationStatus,
  listFinesWithUser,
  createFine,
  payFine,
  removeFine,
  sweepOverdue,
};