// ============================================================
// FPU — Programmes API
// Mounted at /api/admin/programmes AND /api/programmes
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const { db, schema, sql } = require('../db');
const { eq, and, ilike, or } = require('drizzle-orm');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const { programmes, users, departments } = schema;

// Read-only access
const STAFF = [
  'admin', 'registrar', 'academic_officer', 'admission_officer',
  'hod', 'exam_officer', 'rector', 'librarian',
];
// Write access
const WRITERS = ['admin', 'registrar', 'academic_officer'];

// ------------------------------------------------------------
// GET /api/programmes — list with department + student counts
// ------------------------------------------------------------
router.get('/', requireRole(STAFF), async (req, res, next) => {
  try {
    const { departmentId, level, search } = req.query;

    const conds = [];
    if (departmentId) conds.push(eq(programmes.departmentId, Number(departmentId)));
    if (level) conds.push(eq(programmes.level, level));
    if (search) {
      const like = `%${String(search).trim()}%`;
      conds.push(or(ilike(programmes.code, like), ilike(programmes.name, like)));
    }
    const where = conds.length ? and(...conds) : undefined;

    const rows = await db
      .select({
        id: programmes.id,
        code: programmes.code,
        name: programmes.name,
        level: programmes.level,
        durationYears: programmes.durationYears,
        departmentId: programmes.departmentId,
        departmentName: departments.name,
        departmentCode: departments.code,
        createdAt: programmes.createdAt,
      })
      .from(programmes)
      .leftJoin(departments, eq(programmes.departmentId, departments.id))
      .where(where)
      .orderBy(programmes.code);

    // Student counts per programme
    const studentCounts = await db
      .select({
        programmeId: users.programmeId,
        c: sql`count(*)::int`,
      })
      .from(users)
      .where(eq(users.role, 'student'))
      .groupBy(users.programmeId);

    const countMap = new Map(studentCounts.map((r) => [r.programmeId, r.c]));

    const data = rows.map((r) => ({
      ...r,
      studentCount: countMap.get(r.id) || 0,
      // keep both names for frontend compatibility
      studentsCount: countMap.get(r.id) || 0,
    }));

    return res.json({ success: true, data, total: data.length });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// GET /api/programmes/:id
// ------------------------------------------------------------
router.get('/:id', requireRole(STAFF), async (req, res, next) => {
  try {
    const [row] = await db
      .select({
        id: programmes.id,
        code: programmes.code,
        name: programmes.name,
        level: programmes.level,
        durationYears: programmes.durationYears,
        departmentId: programmes.departmentId,
        departmentName: departments.name,
        departmentCode: departments.code,
        createdAt: programmes.createdAt,
      })
      .from(programmes)
      .leftJoin(departments, eq(programmes.departmentId, departments.id))
      .where(eq(programmes.id, Number(req.params.id)))
      .limit(1);

    if (!row) return res.status(404).json({ success: false, error: 'Programme not found.' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// POST /api/programmes — create with validation
// ------------------------------------------------------------
router.post('/', requireRole(WRITERS), async (req, res, next) => {
  try {
    const { code, name, departmentId, level, durationYears } = req.body || {};

    if (!code || !name || !departmentId) {
      return res.status(400).json({
        success: false,
        error: 'code, name, and departmentId are required.',
      });
    }

    const normalizedCode = String(code).trim().toUpperCase();
    const normalizedLevel = level || 'ND';

    // Duplicate check (code + level)
    const [dupe] = await db
      .select({ id: programmes.id })
      .from(programmes)
      .where(and(eq(programmes.code, normalizedCode), eq(programmes.level, normalizedLevel)))
      .limit(1);

    if (dupe) {
      return res.status(409).json({
        success: false,
        error: `A programme with code "${normalizedCode}" at level "${normalizedLevel}" already exists.`,
      });
    }

    // Verify department exists
    const [dept] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, Number(departmentId)))
      .limit(1);

    if (!dept) {
      return res.status(400).json({ success: false, error: 'Invalid departmentId.' });
    }

    const [row] = await db
      .insert(programmes)
      .values({
        code: normalizedCode,
        name: String(name).trim(),
        departmentId: Number(departmentId),
        level: normalizedLevel,
        durationYears: Number(durationYears) || 2,
      })
      .returning();

    await logAudit({
      req,
      action: 'programme.create',
      entity: 'programme',
      entityId: row.id,
      after: row,
    });

    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// PUT /api/programmes/:id — update with validation
// ------------------------------------------------------------
router.put('/:id', requireRole(WRITERS), async (req, res, next) => {
  try {
    const [existing] = await db
      .select()
      .from(programmes)
      .where(eq(programmes.id, Number(req.params.id)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Programme not found.' });
    }

    const allowed = ['code', 'name', 'departmentId', 'level', 'durationYears'];
    const patch = {};
    for (const k of allowed) {
      if (req.body?.[k] !== undefined) {
        if (k === 'departmentId' || k === 'durationYears') {
          patch[k] = Number(req.body[k]);
        } else if (k === 'code') {
          patch[k] = String(req.body[k]).trim().toUpperCase();
        } else if (k === 'name') {
          patch[k] = String(req.body[k]).trim();
        } else {
          patch[k] = req.body[k];
        }
      }
    }

    // Duplicate check if code or level changed
    const newCode = patch.code || existing.code;
    const newLevel = patch.level || existing.level;
    if (newCode !== existing.code || newLevel !== existing.level) {
      const [dupe] = await db
        .select({ id: programmes.id })
        .from(programmes)
        .where(and(eq(programmes.code, newCode), eq(programmes.level, newLevel)))
        .limit(1);

      if (dupe && dupe.id !== existing.id) {
        return res.status(409).json({
          success: false,
          error: 'Another programme already uses this code/level combination.',
        });
      }
    }

    const [row] = await db
      .update(programmes)
      .set(patch)
      .where(eq(programmes.id, existing.id))
      .returning();

    await logAudit({
      req,
      action: 'programme.update',
      entity: 'programme',
      entityId: existing.id,
      before: existing,
      after: row,
    });

    return res.json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// DELETE /api/programmes/:id — refuses if students enrolled
// ------------------------------------------------------------
router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const [existing] = await db
      .select()
      .from(programmes)
      .where(eq(programmes.id, Number(req.params.id)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Programme not found.' });
    }

    // Safety check: any students enrolled?
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

    await db.delete(programmes).where(eq(programmes.id, existing.id));

    await logAudit({
      req,
      action: 'programme.delete',
      entity: 'programme',
      entityId: existing.id,
      before: existing,
    });

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;