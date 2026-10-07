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

module.exports = {
  findById,
  list,
  listWithRelations,
  listForStudent,
  create,
  update,
  remove,
  findConflicts,
};