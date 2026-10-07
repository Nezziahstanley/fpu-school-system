// ============================================================
// FPU — Grade scale utilities
// ------------------------------------------------------------
// Reads the active grade_scale rows from the DB (falls back to
// the NBTE default if the table is empty). Provides:
//   DEFAULT_GRADE_SCALE           (frozen constant)
//   getActiveGradeScale()         -> Promise<rows[]>
//   scoreToGrade(score, scale?)   -> { grade, points, remark }
//   gradeToPoints(grade, scale?)  -> number
// ============================================================

'use strict';

const { db, schema } = require('../db');
const { eq, asc } = require('drizzle-orm');
const { DEFAULT_GRADE_SCALE } = require('../config/departments');

const { gradeScales } = schema;

// ------------------------------------------------------------
// Fetch active scale (DB). Falls back to defaults if empty.
// ------------------------------------------------------------
async function getActiveGradeScale() {
  try {
    const rows = await db
      .select()
      .from(gradeScales)
      .where(eq(gradeScales.isActive, true))
      .orderBy(asc(gradeScales.minScore));

    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        grade: r.grade,
        minScore: Number(r.minScore),
        maxScore: Number(r.maxScore),
        points: Number(r.points),
        remark: r.remark || '',
      }));
    }
  } catch {
    // DB not ready / table missing — fall through to defaults
  }
  return DEFAULT_GRADE_SCALE.map((r) => ({ ...r }));
}

// ------------------------------------------------------------
// Convert a numeric score into a grade row.
// `scale` is optional; if omitted the DB scale is loaded.
// ------------------------------------------------------------
async function scoreToGrade(score, scale = null) {
  const s = Number(score);
  if (!Number.isFinite(s)) {
    return { grade: 'F', points: 0.0, remark: 'Invalid score' };
  }

  const active = scale || (await getActiveGradeScale());

  for (const band of active) {
    if (s >= band.minScore && s <= band.maxScore) {
      return {
        grade: band.grade,
        points: Number(band.points),
        remark: band.remark || '',
      };
    }
  }

  // Score outside every band — treat as fail
  return { grade: 'F', points: 0.0, remark: 'Fail' };
}

// ------------------------------------------------------------
// Synchronous variant using the default NBTE scale.
// Use only when you don't need DB overrides.
// ------------------------------------------------------------
function scoreToGradeSync(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return { grade: 'F', points: 0.0, remark: 'Invalid score' };

  for (const band of DEFAULT_GRADE_SCALE) {
    if (s >= band.minScore && s <= band.maxScore) {
      return { grade: band.grade, points: Number(band.points), remark: band.remark };
    }
  }
  return { grade: 'F', points: 0.0, remark: 'Fail' };
}

// ------------------------------------------------------------
// Map a letter grade back to its point value.
// ------------------------------------------------------------
async function gradeToPoints(grade, scale = null) {
  const g = String(grade || '').toUpperCase();
  const active = scale || (await getActiveGradeScale());
  const found = active.find((b) => b.grade === g);
  return found ? Number(found.points) : 0;
}

// ------------------------------------------------------------
// Convenience: cache the active scale for a short window.
// Avoids hitting the DB on every result row during bulk ops.
// ------------------------------------------------------------
let _cache = null;
let _cacheAt = 0;
const CACHE_MS = 30_000;

async function getCachedScale() {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_MS) return _cache;
  _cache = await getActiveGradeScale();
  _cacheAt = now;
  return _cache;
}

function invalidateCache() {
  _cache = null;
  _cacheAt = 0;
}

module.exports = {
  DEFAULT_GRADE_SCALE,
  getActiveGradeScale,
  getCachedScale,
  scoreToGrade,
  scoreToGradeSync,
  gradeToPoints,
  invalidateCache,
};