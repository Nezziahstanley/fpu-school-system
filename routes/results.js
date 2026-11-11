// ============================================================
// FPU — Admin results API
// Mounted at /api/admin/results
// ------------------------------------------------------------
// Workflow: draft → submitted → hod_verified → approved → published
//           (+ hod_rejected, admin_rejected)
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const resultQueries = require('../db/queries/results');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { scoreToGrade, getActiveGradeScale, invalidateCache } = require('../utils/gradeScale');

const STAFF = ['admin', 'registrar', 'academic_officer', 'hod', 'lecturer'];

async function respondWithTransitionConflict(res, resultId, expectedStatus, actionLabel) {
  const existing = await resultQueries.findById(resultId);
  if (!existing) return res.status(404).json({ success: false, error: 'Result not found.' });
  return res.status(409).json({
    success: false,
    error: `Cannot ${actionLabel} a result with status "${existing.status}". Expected "${expectedStatus}".`,
  });
}

// ============================================================
// BULK ACTION — MUST BE BEFORE /:id routes!
// ============================================================
router.post('/bulk-action', requireRole(['admin', 'academic_officer']), async (req, res, next) => {
  try {
    const { ids, courseId, action, sessionId, semester } = req.body || {};

    // Bulk actions must follow the same approval sequence as single-result actions.
    const transitions = {
      approved: 'hod_verified',
      published: 'approved',
    };
    const requiredStatus = transitions[action];
    if (!requiredStatus) {
      return res.status(400).json({ success: false, error: 'Unsupported bulk action. Use approved or published.' });
    }

    const { db, schema } = require('../db');
    const { eq, inArray, and } = require('drizzle-orm');
    const conditions = [eq(schema.results.status, requiredStatus)];

    if (Array.isArray(ids) && ids.length > 0) {
      const numericIds = ids.map(Number);
      if (numericIds.some(id => !Number.isSafeInteger(id) || id <= 0)) {
        return res.status(400).json({ success: false, error: 'One or more result IDs are invalid.' });
      }
      conditions.push(inArray(schema.results.id, numericIds));
    } else if (courseId) {
      const numericCourseId = Number(courseId);
      const numericSessionId = Number(sessionId);
      if (!Number.isSafeInteger(numericCourseId) || numericCourseId <= 0) {
        return res.status(400).json({ success: false, error: 'Course ID is invalid.' });
      }
      if (!Number.isSafeInteger(numericSessionId) || numericSessionId <= 0) {
        return res.status(400).json({ success: false, error: 'A valid academic session is required for course-wide actions.' });
      }
      conditions.push(eq(schema.results.courseId, numericCourseId));
    } else {
      return res.status(400).json({ success: false, error: 'No IDs or Course ID provided.' });
    }

    if (sessionId) conditions.push(eq(schema.results.sessionId, Number(sessionId)));
    if (semester && semester !== 'all') conditions.push(eq(schema.results.semester, semester));

    const now = new Date();
    const updateFields = action === 'approved'
      ? { status: 'approved', approvedBy: Number(req.user.id), approvedAt: now, updatedAt: now }
      : { status: 'published', publishedAt: now, updatedAt: now };

    const updatedRows = await db
      .update(schema.results)
      .set(updateFields)
      .where(and(...conditions))
      .returning();

    // Match the single-result publish behaviour: notify each affected student privately.
    let notificationCount = 0;
    if (action === 'published' && updatedRows.length) {
      try {
        const notifQueries = require('../db/queries/notifications');
        const courseCodes = new Map();
        const outcomes = await Promise.allSettled(updatedRows.map(async (row) => {
          let code = courseCodes.get(row.courseId);
          if (code === undefined) {
            const [course] = await db.select({ code: schema.courses.code })
              .from(schema.courses)
              .where(eq(schema.courses.id, row.courseId))
              .limit(1);
            code = course?.code || 'course';
            courseCodes.set(row.courseId, code);
          }
          await notifQueries.createNotification({
            userId: row.studentId,
            title: 'Result Published',
            body: `Your result for ${code} has been published. You can now view it on your portal.`,
            type: 'success',
            link: '#results',
            showOnMarquee: false,
          });
        }));
        notificationCount = outcomes.filter(item => item.status === 'fulfilled').length;
        const failedNotifications = outcomes.length - notificationCount;
        if (failedNotifications) console.error(`[result.bulk-publish] ${failedNotifications} private notification(s) failed.`);
      } catch (notificationError) {
        console.error('[result.bulk-publish] notification processing failed:', notificationError.message);
      }
    }

    await logAudit({
      req,
      action: `result.bulk_${action}`,
      entity: 'result',
      after: { count: updatedRows.length, action, requiredStatus, sessionId: sessionId || null, semester: semester || null, notificationCount },
    });

    const requestedCount = Array.isArray(ids) ? ids.length : updatedRows.length;
    return res.json({
      success: true,
      data: updatedRows,
      count: updatedRows.length,
      skipped: Math.max(0, requestedCount - updatedRows.length),
      notificationCount,
    });
  } catch (err) {
    console.error('Bulk action error:', err);
    return next(err);
  }
});

// ============================================================
// GET /api/admin/results — list with joins
// ============================================================
router.get('/', requireRole(STAFF), async (req, res, next) => {
  if (req.user && req.user.role === 'hod' && req.user.departmentId) {
    req.query.departmentId = req.user.departmentId;
  }
  
  try {
    const { studentId, courseId, sessionId, semester, status, departmentId, search, limit = 500, offset = 0 } = req.query;
    
    const { db, schema } = require('../db');
    const { eq, and, ilike, or, desc } = require('drizzle-orm');

    const conds = [];
    if (studentId) conds.push(eq(schema.results.studentId, Number(studentId)));
    if (courseId) conds.push(eq(schema.results.courseId, Number(courseId)));
    if (sessionId) conds.push(eq(schema.results.sessionId, Number(sessionId)));
    
    if (semester && semester !== 'all') {
      conds.push(eq(schema.results.semester, semester));
    }
    
    if (status) {
      conds.push(eq(schema.results.status, status));
    }
    
    if (departmentId) {
      conds.push(eq(schema.courses.departmentId, Number(departmentId)));
    }
    
    if (search) {
      conds.push(or(
        ilike(schema.users.firstName, `%${search}%`),
        ilike(schema.users.lastName, `%${search}%`),
        ilike(schema.users.matricNumber, `%${search}%`),
        ilike(schema.courses.code, `%${search}%`)
      ));
    }

    const where = conds.length ? and(...conds) : undefined;

    const rows = await db
      .select({
        id: schema.results.id,
        score: schema.results.score,
        grade: schema.results.grade,
        status: schema.results.status,
        semester: schema.results.semester,
        
        student: {
          id: schema.users.id,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          matricNumber: schema.users.matricNumber,
        },
        
        course: {
          id: schema.courses.id,
          code: schema.courses.code,
          title: schema.courses.title,
          unit: schema.courses.unit,
          departmentId: schema.departments.id,
          departmentName: schema.departments.name,
          departmentCode: schema.departments.code,
        }
      })
      .from(schema.results)
      .leftJoin(schema.users, eq(schema.results.studentId, schema.users.id))
      .leftJoin(schema.courses, eq(schema.results.courseId, schema.courses.id))
      .leftJoin(schema.departments, eq(schema.courses.departmentId, schema.departments.id))
      .where(where)
      .orderBy(desc(schema.results.id))
      .limit(Number(limit))
      .offset(Number(offset));

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching results:', err);
    return next(err);
  }
});

router.get('/with-course', requireRole(STAFF), async (req, res, next) => {
  try {
    const { studentId, sessionId, semester, status } = req.query;
    const rows = await resultQueries.listWithCourse({ studentId, sessionId, semester, status });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/with-student', requireRole(STAFF), async (req, res, next) => {
  try {
    const { courseId, sessionId, semester, status } = req.query;
    const rows = await resultQueries.listWithStudent({ courseId, sessionId, semester, status });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/pending-hod', requireRole(['hod', 'admin']), async (req, res, next) => {
  try {
    const departmentId = req.user.departmentId;
    if (!departmentId) return res.status(400).json({ success: false, error: 'No department assigned.' });
    const rows = await resultQueries.listPendingForHod(departmentId, { sessionId: req.query.sessionId, semester: req.query.semester });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.get('/pending-admin', requireRole(['admin', 'academic_officer']), async (req, res, next) => {
  try {
    const rows = await resultQueries.listPendingAdmin({ sessionId: req.query.sessionId, semester: req.query.semester });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// SINGLE RESULT routes (must come AFTER bulk-action)
// ============================================================
router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await resultQueries.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Result not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireRole(['admin', 'academic_officer', 'lecturer']), async (req, res, next) => {
  try {
    const { studentId, courseId, sessionId, semester, score } = req.body || {};
    if (!studentId || !courseId || !sessionId || !semester || score === undefined) {
      return res.status(400).json({ success: false, error: 'studentId, courseId, sessionId, semester, score are required.' });
    }
    const scale = await getActiveGradeScale();
    const { grade, points } = await scoreToGrade(score, scale);

    const row = await resultQueries.upsert({
      studentId, courseId, sessionId, semester,
      score, grade, points,
      status: 'draft',
    });
    await logAudit({ req, action: 'result.upsert', entity: 'result', entityId: row.id, after: row });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', requireRole(['admin', 'academic_officer', 'lecturer']), async (req, res, next) => {
  try {
    const existing = await resultQueries.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Result not found.' });

    const patch = { ...req.body };
    delete patch.id;

    if (patch.score !== undefined) {
      const scale = await getActiveGradeScale();
      const { grade, points } = await scoreToGrade(patch.score, scale);
      patch.grade = grade;
      patch.points = points;
    }

    const row = await resultQueries.update(existing.id, patch);
    await logAudit({ req, action: 'result.update', entity: 'result', entityId: existing.id, before: existing, after: row });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/submit', requireRole(['lecturer', 'admin', 'academic_officer']), async (req, res, next) => {
  try {
    const row = await resultQueries.submit(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Result not found.' });
    await logAudit({ req, action: 'result.submit', entity: 'result', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/hod-verify', requireRole(['hod', 'admin']), async (req, res, next) => {
  try {
    const row = await resultQueries.hodVerify(req.params.id, req.user.id);
    if (!row) return respondWithTransitionConflict(res, req.params.id, 'submitted', 'verify');

    // ✅ FIX: Private notification to just this student (no announcement spam)
    try {
      const notifQueries = require('../db/queries/notifications');
      const { schema, db } = require('../db');
      const { eq } = require('drizzle-orm');
      const [c] = await db.select({ code: schema.courses.code })
        .from(schema.courses).where(eq(schema.courses.id, row.courseId)).limit(1);

      await notifQueries.createNotification({
        userId: row.studentId,
        title: 'Result Verified',
        body: `Your result for ${c?.code || 'course'} has been verified by the HOD.`,
        type: 'success',
        link: '#results',
        showOnMarquee: false, // NEVER on public marquee
      });
    } catch (e) { console.error('[result.hod-verify] notif failed:', e.message); }

    await logAudit({ req, action: 'result.hod_verify', entity: 'result', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

router.post('/:id/approve', requireRole(['admin', 'academic_officer']), async (req, res, next) => {
  try {
    const row = await resultQueries.adminApprove(req.params.id, req.user.id);
    if (!row) return respondWithTransitionConflict(res, req.params.id, 'hod_verified', 'approve');

    // ✅ FIX: Private notification only
    try {
      const notifQueries = require('../db/queries/notifications');
      const { schema, db } = require('../db');
      const { eq } = require('drizzle-orm');
      const [c] = await db.select({ code: schema.courses.code })
        .from(schema.courses).where(eq(schema.courses.id, row.courseId)).limit(1);

      await notifQueries.createNotification({
        userId: row.studentId,
        title: 'Result Approved',
        body: `Your result for ${c?.code || 'course'} has been approved by the academic office.`,
        type: 'success',
        link: '#results',
        showOnMarquee: false,
      });
    } catch (e) { console.error('[result.approve] notif failed:', e.message); }

    await logAudit({ req, action: 'result.approve', entity: 'result', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

router.post('/:id/publish', requireRole(['admin', 'academic_officer']), async (req, res, next) => {
  try {
    const row = await resultQueries.publish(req.params.id);
    if (!row) return respondWithTransitionConflict(res, req.params.id, 'approved', 'publish');

    // ✅ FIX: Private notification only
    try {
      const notifQueries = require('../db/queries/notifications');
      const { schema, db } = require('../db');
      const { eq } = require('drizzle-orm');
      const [c] = await db.select({ code: schema.courses.code })
        .from(schema.courses).where(eq(schema.courses.id, row.courseId)).limit(1);

      await notifQueries.createNotification({
        userId: row.studentId,
        title: 'Result Published',
        body: `Your result for ${c?.code || 'course'} has been published. You can now view it on your portal.`,
        type: 'success',
        link: '#results',
        showOnMarquee: false,
      });
    } catch (e) { console.error('[result.publish] notif failed:', e.message); }

    await logAudit({ req, action: 'result.publish', entity: 'result', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

router.post('/:id/hod-reject', requireRole(['hod', 'admin']), async (req, res, next) => {
  try {
    const row = await resultQueries.hodReject(req.params.id, req.user.id, req.body?.reason);
    if (!row) return respondWithTransitionConflict(res, req.params.id, 'submitted', 'reject');
    await logAudit({ req, action: 'result.hod_reject', entity: 'result', entityId: row.id, after: { reason: req.body?.reason } });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/approve', requireRole(['admin', 'academic_officer']), async (req, res, next) => {
  try {
    const row = await resultQueries.adminApprove(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, error: 'Result not found.' });
    await logAudit({ req, action: 'result.approve', entity: 'result', entityId: row.id });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/reject', requireRole(['admin', 'academic_officer']), async (req, res, next) => {
  try {
    const row = await resultQueries.adminReject(req.params.id, req.user.id, req.body?.reason);
    if (!row) return respondWithTransitionConflict(res, req.params.id, 'hod_verified', 'reject');
    await logAudit({ req, action: 'result.admin_reject', entity: 'result', entityId: row.id, after: { reason: req.body?.reason } });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

router.post('/publish-batch', requireRole(['admin', 'academic_officer']), async (req, res, next) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids[] is required.' });
    }
    const rows = await resultQueries.publishBatch(ids);
    await logAudit({ req, action: 'result.publish_batch', entity: 'result', after: { count: rows.length } });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const row = await resultQueries.remove(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Result not found.' });
    await logAudit({ req, action: 'result.delete', entity: 'result', entityId: row.id, before: row });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

router.post('/refresh-scale', requireRole(['admin']), async (_req, res) => {
  invalidateCache();
  return res.json({ success: true });
});

module.exports = router;