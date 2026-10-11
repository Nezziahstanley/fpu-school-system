// ============================================================
// FPU — Query helper: timetable_slots
// ============================================================

'use strict';

const { db, sql, schema } = require('../index');
const { eq, and, desc, asc, inArray } = require('drizzle-orm');

const { timetableSlots, courses, users, academicSessions } = schema;

async function findById(id) {
  if (!id) return null;
  const [row] = await db.select().from(timetableSlots).where(eq(timetableSlots.id, Number(id))).limit(1);
  return row || null;
}

async function list({ courseId, lecturerId, sessionId, semester, dayOfWeek } = {}) {
  const conds = [];
  if (courseId) conds.push(eq(timetableSlots.courseId, Number(courseId)));
  if (lecturerId) conds.push(eq(timetableSlots.lecturerId, Number(lecturerId)));
  if (sessionId) conds.push(eq(timetableSlots.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(timetableSlots.semester, semester));
  if (dayOfWeek) conds.push(eq(timetableSlots.dayOfWeek, dayOfWeek));
  const where = conds.length ? and(...conds) : undefined;
  return db.select().from(timetableSlots).where(where).orderBy(asc(timetableSlots.dayOfWeek), asc(timetableSlots.startTime));
}

async function listWithRelations({ sessionId, semester, lecturerId, courseId } = {}) {
  const conds = [];
  if (sessionId) conds.push(eq(timetableSlots.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(timetableSlots.semester, semester));
  if (lecturerId) conds.push(eq(timetableSlots.lecturerId, Number(lecturerId)));
  if (courseId) conds.push(eq(timetableSlots.courseId, Number(courseId)));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({
      slot: timetableSlots,
      course: courses,
      lecturer: users,
    })
    .from(timetableSlots)
    .leftJoin(courses, eq(timetableSlots.courseId, courses.id))
    .leftJoin(users, eq(timetableSlots.lecturerId, users.id))
    .where(where)
    .orderBy(asc(timetableSlots.dayOfWeek), asc(timetableSlots.startTime));
}

async function listForStudent({ programmeId, sessionId, semester } = {}) {
  const conds = [];
  if (sessionId) conds.push(eq(timetableSlots.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(timetableSlots.semester, semester));
  if (programmeId) conds.push(eq(courses.programmeId, Number(programmeId)));
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({
      slot: timetableSlots,
      course: courses,
    })
    .from(timetableSlots)
    .leftJoin(courses, eq(timetableSlots.courseId, courses.id))
    .where(where)
    .orderBy(asc(timetableSlots.dayOfWeek), asc(timetableSlots.startTime));
}

async function create(data) {
  const [row] = await db.insert(timetableSlots).values({
    courseId: Number(data.courseId),
    lecturerId: data.lecturerId ? Number(data.lecturerId) : null,
    sessionId: Number(data.sessionId),
    semester: data.semester,
    dayOfWeek: data.dayOfWeek,
    startTime: data.startTime,
    endTime: data.endTime,
    venue: data.venue || null,
  }).returning();
  return row;
}

async function update(id, data) {
  const patch = { ...data };
  delete patch.id;
  const [row] = await db.update(timetableSlots).set(patch).where(eq(timetableSlots.id, Number(id))).returning();
  return row || null;
}

async function remove(id) {
  const [row] = await db.delete(timetableSlots).where(eq(timetableSlots.id, Number(id))).returning();
  return row || null;
}

async function findConflicts({ sessionId, semester, dayOfWeek, startTime, endTime, lecturerId, venue, excludeId = null }) {
  const conds = [
    eq(timetableSlots.sessionId, Number(sessionId)),
    eq(timetableSlots.semester, semester),
    eq(timetableSlots.dayOfWeek, dayOfWeek),
    sql`${timetableSlots.startTime} < ${endTime} AND ${timetableSlots.endTime} > ${startTime}`,
  ];
  if (excludeId) conds.push(sql`${timetableSlots.id} <> ${Number(excludeId)}`);

  const rows = await db.select().from(timetableSlots).where(and(...conds));
  return rows.filter((r) => {
    if (lecturerId && r.lecturerId === Number(lecturerId)) return true;
    if (venue && r.venue && r.venue.toLowerCase() === venue.toLowerCase()) return true;
    return false;
  });
}

// ------------------------------------------------------------
// studentSummary — for a student's programme: how many slots
//                  are scheduled, per day, in a session/sem.
// ------------------------------------------------------------
async function studentSummary({ programmeId, sessionId, semester } = {}) {
  const conds = [];
  if (sessionId) conds.push(eq(timetableSlots.sessionId, Number(sessionId)));
  if (semester) conds.push(eq(timetableSlots.semester, semester));
  if (programmeId) conds.push(eq(courses.programmeId, Number(programmeId)));
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      dayOfWeek: timetableSlots.dayOfWeek,
      count: sql`count(*)::int`,
    })
    .from(timetableSlots)
    .leftJoin(courses, eq(timetableSlots.courseId, courses.id))
    .where(where)
    .groupBy(timetableSlots.dayOfWeek);

  const byDay = {};
  rows.forEach((r) => { byDay[r.dayOfWeek] = Number(r.count); });
  const total = rows.reduce((s, r) => s + Number(r.count), 0);

  return { total, byDay };
}

// ------------------------------------------------------------
// bulkUpsert — used by lecturer / academic officer "bulk
//              upload timetable" screens.
//
// Each row: { courseId, lecturerId, sessionId, semester,
//             dayOfWeek, startTime, endTime, venue }
//
// No DB-level unique constraint exists on timetableSlots, so
// we can't use ON CONFLICT. We delete-and-insert per
// (courseId, sessionId, semester) inside a transaction.
// ------------------------------------------------------------
async function bulkUpsert(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  // Group by (courseId, sessionId, semester) so we replace
  // only the slots for those keys.
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.courseId}|${r.sessionId}|${r.semester}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  return db.transaction(async (tx) => {
    const inserted = [];
    for (const [, groupRows] of groups) {
      const { courseId, sessionId, semester } = groupRows[0];
      await tx
        .delete(timetableSlots)
        .where(and(
          eq(timetableSlots.courseId, Number(courseId)),
          eq(timetableSlots.sessionId, Number(sessionId)),
          eq(timetableSlots.semester, semester)
        ));
      const values = groupRows.map((r) => ({
        courseId: Number(r.courseId),
        lecturerId: r.lecturerId ? Number(r.lecturerId) : null,
        sessionId: Number(r.sessionId),
        semester: r.semester,
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        venue: r.venue || null,
      }));
      const out = await tx.insert(timetableSlots).values(values).returning();
      inserted.push(...out);
    }
    return inserted;
  });
}

module.exports = {
  findById,
  list,
  listWithRelations,
  listForStudent,
  studentSummary,    // ← add
  create,
  update,
  remove,
  bulkUpsert,        // ← add
  findConflicts,
};