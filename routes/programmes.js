// ============================================================
// FPU — Admin programmes API
// Mounted at /api/admin/programmes
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const courseQueries = require('../db/queries/courses');
const { db, schema, sql } = require('../db');
const { eq, and } = require('drizzle-orm');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const { users, departments } = schema;

const STAFF = ['admin', 'registrar', 'academic_officer', 'admission_officer', 'hod'];

// ------------------------------------------------------------
// GET /api/admin/programmes
// Query: departmentId, level, search
// Returns each programme with department name + student count
// ------------------------------------------------------------
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { departmentId, level, search } = req.query;

    const conds = [];
    if (departmentId) conds.push(eq(schema.programmes.departmentId, Number(departmentId)));
    if (level)        conds.push(eq(schema.programmes.level, level));
    if (search) {
      const term = `%${String(search).trim()}%`;
      conds.push(
        sql`(${schema.programmes.code} ILIKE ${term} OR ${schema.programmes.name} ILIKE ${term})`
      );
    }

    const where = conds.length ? and(...conds) : undefined;

    const rows = await db
      .select({
        id: schema.programmes.id,
        code: schema.programmes.code,
        name: schema.programmes.name,
        level: schema.programmes.level,
        durationYears: schema.programmes.durationYears,
        departmentId: schema.programmes.departmentId,
        departmentName: departments.name,
        departmentCode: departments.code,
        createdAt: schema.programmes.createdAt,
      })
      .from(schema.programmes)
      .leftJoin(departments, eq(schema.programmes.departmentId, departments.id))
      .where(where)
      .orderBy(schema.programmes.code);

    // Student count per programme
    const counts = await db
      .select({
        programmeId: users.programmeId,
        c: sql`count(*)::int`,
      })
      .from(users)
      .where(eq(users.role, 'student'))
      .groupBy(users.programmeId);

    const countMap = new Map(counts.map((r) => [r.programmeId, r.c]));

    const data = rows.map((p) => ({
      ...p,
      studentsCount: countMap.get(p.id) || 0,
    }));

    return res.json({ success: true, data });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// GET /api/admin/programmes/:id
// ------------------------------------------------------------
router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const row = await courseQueries.findProgrammeById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Programme not found.' });

    const [dept] = row.departmentId
      ? await db.select().from(departments).where(eq(departments.id, row.departmentId)).limit(1)
      : [];

    return res.json({ success: true, data: { ...row, department: dept || null } });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// POST /api/admin/programmes
// ------------------------------------------------------------
router.post('/', requireRole(['admin', 'registrar', 'academic_officer']), async (req, res, next) => {
  try {
    const { code, name, departmentId, level, durationYears } = req.body || {};

    if (!code || !name || !departmentId) {
      return res.status(400).json({
        success: false,
        error: 'code, name, departmentId are required.',
      });
    }

    // Duplicate check (code + level)
    const existing = await courseQueries.findProgrammeByCode(code, level || 'ND');
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `A programme with code "${code}" at level "${level || 'ND'}" already exists.`,
      });
    }

    // Verify department exists
    const dept = await courseQueries.findDepartmentById(departmentId);
    if (!dept) {
      return res.status(400).json({ success: false, error: 'Invalid departmentId.' });
    }

    const row = await courseQueries.createProgramme({
      code: String(code).trim().toUpperCase(),
      name: String(name).trim(),
      departmentId: Number(departmentId),
      level: level || 'ND',
      durationYears: Number(durationYears) || 2,
    });

    await logAudit({
      req,
      action: 'programme.create',
      entity: 'programme',
      entityId: row.id,
      after: row,
    });

    return res.status(201).json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// PUT /api/admin/programmes/:id
// ------------------------------------------------------------
router.put('/:id', requireRole(['admin', 'registrar', 'academic_officer']), async (req, res, next) => {
  try {
    const existing = await courseQueries.findProgrammeById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Programme not found.' });

    const patch = { ...req.body };
    delete patch.id;
    delete patch.createdAt;

    if (patch.code) patch.code = String(patch.code).trim().toUpperCase();
    if (patch.name) patch.name = String(patch.name).trim();
    if (patch.departmentId) patch.departmentId = Number(patch.departmentId);
    if (patch.durationYears) patch.durationYears = Number(patch.durationYears);

    // Duplicate check if code or level changed
    const codeChanged = patch.code && patch.code !== existing.code;
    const levelChanged = patch.level && patch.level !== existing.level;
    if (codeChanged || levelChanged) {
      const dup = await courseQueries.findProgrammeByCode(
        patch.code || existing.code,
        patch.level || existing.level
      );
      if (dup && dup.id !== existing.id) {
        return res.status(409).json({ success: false, error: 'Another programme already uses this code/level.' });
      }
    }

    const row = await courseQueries.updateProgramme(existing.id, patch);

    await logAudit({
      req,
      action: 'programme.update',
      entity: 'programme',
      entityId: existing.id,
      before: existing,
      after: row,
    });

    return res.json({ success: true, data: row });
  } catch (err) { return next(err); }
});

// ------------------------------------------------------------
// DELETE /api/admin/programmes/:id
// Refuses if students are enrolled
// ------------------------------------------------------------
router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const existing = await courseQueries.findProgrammeById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Programme not found.' });

    // Count enrolled students
    const [enrolled] = await db
      .select({ c: sql`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, 'student'), eq(users.programmeId, existing.id)));

    if (enrolled.c > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete — ${enrolled.c} student(s) are enrolled in this programme. Reassign them first.`,
      });
    }

    await courseQueries.removeProgramme(existing.id);
    await logAudit({
      req,
      action: 'programme.delete',
      entity: 'programme',
      entityId: existing.id,
      before: existing,
    });

    return res.json({ success: true });
  } catch (err) { return next(err); }
});

module.exports = router;