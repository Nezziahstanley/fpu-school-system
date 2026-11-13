// ============================================================
// FPU — Query helper: announcements, notifications, complaints, messages
// ============================================================

'use strict';

const { db, sql, schema } = require('../index');
const { eq, and, or, desc, isNull } = require('drizzle-orm');

const { announcements, notifications, complaints, messages, users } = schema;

// ============================================================
// ANNOUNCEMENTS
// ============================================================

async function listAnnouncementsWithAuthor({ audience, isPublished, departmentId } = {}) {
  const conds = [];
  if (audience) conds.push(eq(announcements.audience, audience));
  if (isPublished !== undefined) conds.push(eq(announcements.isPublished, !!isPublished));
  if (departmentId !== undefined && departmentId !== null) conds.push(eq(announcements.departmentId, Number(departmentId)));
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
      departmentId: payload.departmentId ? Number(payload.departmentId) : null,
      isPublished: payload.isPublished !== false,
      showOnMarquee: payload.showOnMarquee === true,
      publishedAt: new Date(),
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
    })
    .returning();
  return row;
}

async function updateAnnouncement(id, patch) {
  const allowed = ['title', 'body', 'audience', 'priority', 'isPublished', 'showOnMarquee', 'expiresAt', 'departmentId'];
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

async function listMarqueeAnnouncements(limit = 10) {
  return db
    .select({ id: announcements.id, title: announcements.title, createdAt: announcements.publishedAt })
    .from(announcements)
    .where(and(
      eq(announcements.showOnMarquee, true),
      eq(announcements.isPublished, true),
      eq(announcements.audience, 'all')
    ))
    .orderBy(desc(announcements.publishedAt))
    .limit(Number(limit));
}

// ============================================================
// NOTIFICATIONS
// ============================================================

async function listNotifications(userId, { unreadOnly = false, limit = 200, offset = 0 } = {}) {
  const conds = [];
  if (userId) {
    conds.push(or(eq(notifications.userId, Number(userId)), isNull(notifications.userId)));
  }
  if (unreadOnly) conds.push(eq(notifications.isRead, false));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(Number(limit))
    .offset(Number(offset));
}

async function countUnreadNotifications(userId) {
  if (!userId) return 0;
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(
      or(eq(notifications.userId, Number(userId)), isNull(notifications.userId)),
      eq(notifications.isRead, false)
    ));
  return rows.length;
}

async function createNotification({ userId, title, body, type, link, showOnMarquee }) {
  const [row] = await db
    .insert(notifications)
    .values({
      userId: userId ? Number(userId) : null,
      title,
      body: body || null,
      type: type || 'info',
      link: link || null,
      showOnMarquee: showOnMarquee === true,
    })
    .returning();
  return row;
}

async function bulkCreateNotifications(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  return db.insert(notifications).values(rows.map((r) => ({
    userId: r.userId ? Number(r.userId) : null,
    title: r.title,
    body: r.body || null,
    type: r.type || 'info',
    link: r.link || null,
    showOnMarquee: r.showOnMarquee === true,
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
  const conds = [eq(notifications.id, Number(id))];
  if (userId) conds.push(eq(notifications.userId, Number(userId)));
  const [row] = await db.delete(notifications).where(and(...conds)).returning();
  return row || null;
}

async function listMarqueeNotifications(limit = 10) {
  return db
    .select({ id: notifications.id, title: notifications.title, createdAt: notifications.createdAt })
    .from(notifications)
    .where(eq(notifications.showOnMarquee, true))
    .orderBy(desc(notifications.createdAt))
    .limit(Number(limit));
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

async function listComplaints({ userId, status } = {}) {
  const conds = [];
  if (userId) conds.push(eq(complaints.userId, Number(userId)));
  if (status) conds.push(eq(complaints.status, status));
  const where = conds.length ? and(...conds) : undefined;
  return db.select().from(complaints).where(where).orderBy(desc(complaints.createdAt));
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
    .values({ userId: Number(userId), subject, body, category: category || null, status: 'open' })
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
  const [row] = await db.update(complaints).set({ status }).where(eq(complaints.id, Number(id))).returning();
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

async function countUnreadMessages(userId) {
  if (!userId) return 0;
  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.recipientId, Number(userId)), eq(messages.isRead, false)));
  return rows.length;
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
  listAnnouncementsWithAuthor,
  findAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  removeAnnouncement,
  listMarqueeAnnouncements,

  listNotifications,
  countUnreadNotifications,
  createNotification,
  bulkCreateNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,
  listMarqueeNotifications,

  listComplaintsWithUser,
  listComplaints,
  findComplaintById,
  createComplaint,
  respondToComplaint,
  updateComplaintStatus,
  removeComplaint,

  listMessages,
  countUnreadMessages,
  createMessage,
  markMessageRead,
};