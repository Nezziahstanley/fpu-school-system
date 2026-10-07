// ============================================================
// FPU — Announcements, notifications, complaints, messages queries
// Used by: routes/announcements, routes/notifications,
//          routes/complaints, routes/portal/shared
// ============================================================

'use strict';

const { db, schema, sql } = require('..');
const { eq, and, desc, asc, isNull, inArray } = require('drizzle-orm');

const {
  announcements,
  notifications,
  complaints,
  messages,
  users,
} = schema;

// ============================================================
// ANNOUNCEMENTS
// ============================================================
async function listAnnouncementsWithAuthor({ audience, isPublished } = {}) {
  const conds = [];
  if (audience) conds.push(eq(announcements.audience, audience));
  if (isPublished !== undefined) conds.push(eq(announcements.isPublished, !!isPublished));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({ announcement: announcements, author: users })
    .from(announcements)
    .leftJoin(users, eq(announcements.authorId, users.id))
    .where(where)
    .orderBy(desc(announcements.publishedAt));
}

async function findAnnouncementById(id) {
  if (!id) return null;
  const [row] = await db
    .select({ announcement: announcements, author: users })
    .from(announcements)
    .leftJoin(users, eq(announcements.authorId, users.id))
    .where(eq(announcements.id, Number(id)))
    .limit(1);
  if (!row) return null;
  return { ...row.announcement, author: row.author };
}

async function createAnnouncement(payload) {
  const [row] = await db
    .insert(announcements)
    .values({
      title: payload.title,
      body: payload.body,
      audience: payload.audience || 'all',
      priority: payload.priority || 'normal',
      authorId: Number(payload.authorId),
      isPublished: payload.isPublished !== false,
      publishedAt: new Date(),
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
    })
    .returning();
  return row;
}

async function updateAnnouncement(id, patch) {
  const allowed = ['title', 'body', 'audience', 'priority', 'isPublished', 'expiresAt'];
  const clean = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) {
      clean[k] = k === 'expiresAt'
        ? (patch[k] ? new Date(patch[k]) : null)
        : patch[k];
    }
  }
  const [row] = await db.update(announcements).set(clean).where(eq(announcements.id, Number(id))).returning();
  return row || null;
}

async function removeAnnouncement(id) {
  const [row] = await db.delete(announcements).where(eq(announcements.id, Number(id))).returning();
  return row || null;
}

// ============================================================
// NOTIFICATIONS
// ============================================================
async function listNotifications(userId, { limit = 200, offset = 0 } = {}) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, Number(userId)))
    .orderBy(desc(notifications.createdAt))
    .limit(Number(limit))
    .offset(Number(offset));
}

async function createNotification({ userId, title, body, type, link }) {
  const [row] = await db
    .insert(notifications)
    .values({
      userId: Number(userId),
      title,
      body: body || null,
      type: type || 'info',
      link: link || null,
    })
    .returning();
  return row;
}

async function bulkCreateNotifications(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  return db.insert(notifications).values(rows.map((r) => ({
    userId: Number(r.userId),
    title: r.title,
    body: r.body || null,
    type: r.type || 'info',
    link: r.link || null,
  }))).returning();
}

async function markNotificationRead(id, userId) {
  const [row] = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.id, Number(id)), eq(notifications.userId, Number(userId))))
    .returning();
  return row || null;
}

async function markAllNotificationsRead(userId) {
  const rows = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.userId, Number(userId)), eq(notifications.isRead, false)))
    .returning({ id: notifications.id });
  return rows.length;
}

async function removeNotification(id, userId) {
  const [row] = await db
    .delete(notifications)
    .where(and(eq(notifications.id, Number(id)), eq(notifications.userId, Number(userId))))
    .returning();
  return row || null;
}

// ============================================================
// COMPLAINTS
// ============================================================
async function listComplaintsWithUser({ status, category, search } = {}) {
  const conds = [];
  if (status) conds.push(eq(complaints.status, status));
  if (category) conds.push(eq(complaints.category, category));
  if (search) {
    const term = `%${String(search).trim()}%`;
    conds.push(sql`(${complaints.subject} ILIKE ${term} OR ${complaints.body} ILIKE ${term})`);
  }
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({ complaint: complaints, user: users })
    .from(complaints)
    .leftJoin(users, eq(complaints.userId, users.id))
    .where(where)
    .orderBy(desc(complaints.createdAt));
}

async function findComplaintById(id) {
  if (!id) return null;
  const [row] = await db
    .select({ complaint: complaints, user: users })
    .from(complaints)
    .leftJoin(users, eq(complaints.userId, users.id))
    .where(eq(complaints.id, Number(id)))
    .limit(1);
  if (!row) return null;
  return { ...row.complaint, user: row.user };
}

async function createComplaint({ userId, subject, body, category }) {
  const [row] = await db
    .insert(complaints)
    .values({
      userId: Number(userId),
      subject,
      body,
      category: category || null,
      status: 'open',
    })
    .returning();
  return row;
}

async function respondToComplaint(id, { response, respondedBy, status }) {
  const [row] = await db
    .update(complaints)
    .set({
      response,
      respondedBy: respondedBy ? Number(respondedBy) : null,
      respondedAt: new Date(),
      status: status || 'resolved',
    })
    .where(eq(complaints.id, Number(id)))
    .returning();
  return row || null;
}

async function updateComplaintStatus(id, status) {
  const [row] = await db
    .update(complaints)
    .set({ status })
    .where(eq(complaints.id, Number(id)))
    .returning();
  return row || null;
}

async function removeComplaint(id) {
  const [row] = await db.delete(complaints).where(eq(complaints.id, Number(id))).returning();
  return row || null;
}

// ============================================================
// MESSAGES
// ============================================================
async function listMessages({ userId, box = 'inbox', limit = 200 } = {}) {
  const column = box === 'sent' ? messages.senderId : messages.recipientId;
  return db
    .select({ message: messages, sender: users })
    .from(messages)
    .leftJoin(users, eq(messages.senderId, users.id))
    .where(eq(column, Number(userId)))
    .orderBy(desc(messages.createdAt))
    .limit(Number(limit));
}

async function createMessage({ senderId, recipientId, subject, body, parentId }) {
  const [row] = await db
    .insert(messages)
    .values({
      senderId: Number(senderId),
      recipientId: Number(recipientId),
      subject: subject || null,
      body,
      parentId: parentId ? Number(parentId) : null,
    })
    .returning();
  return row;
}

async function markMessageRead(id, userId) {
  const [row] = await db
    .update(messages)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(messages.id, Number(id)), eq(messages.recipientId, Number(userId))))
    .returning();
  return row || null;
}

module.exports = {
  // announcements
  listAnnouncementsWithAuthor,
  findAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  removeAnnouncement,

  // notifications
  listNotifications,
  createNotification,
  bulkCreateNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,

  // complaints
  listComplaintsWithUser,
  findComplaintById,
  createComplaint,
  respondToComplaint,
  updateComplaintStatus,
  removeComplaint,

  // messages
  listMessages,
  createMessage,
  markMessageRead,
};