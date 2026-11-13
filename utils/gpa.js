// ============================================================
// FPU — GPA / CGPA / classification utilities
// ------------------------------------------------------------
// Rules (NBTE):
//   GPA  = Σ(points × unit) / Σ(unit)   [per semester]
//   CGPA = Σ(points × unit) / Σ(unit)   [across all semesters]
// Classification:
//   ≥3.50 Distinction · 3.00–3.49 Upper Credit ·
//   2.50–2.99 Lower Credit · 2.00–2.49 Pass · <2.00 Fail
// ============================================================

'use strict';

const { CLASSIFICATION_BANDS } = require('../config/departments');

// ------------------------------------------------------------
// Round to 2 decimals without float noise (e.g. 3.49999 -> 3.5)
// ------------------------------------------------------------
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// ------------------------------------------------------------
// Compute GPA from an array of { unit, points } rows.
// `points` should already be the grade point (0–4) scaled
// according to the active grade scale. Missing/invalid points
// are treated as 0.
// ------------------------------------------------------------
function computeGPA(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { gpa: 0, totalUnits: 0, totalPoints: 0 };
  }

  let totalUnits = 0;
  let totalPoints = 0;

  for (const r of rows) {
    const unit = Number(r.unit) || 0;
    const points = Number(r.points);
    const safePoints = Number.isFinite(points) ? points : 0;
    totalUnits += unit;
    totalPoints += unit * safePoints;
  }

  const gpa = totalUnits > 0 ? totalPoints / totalUnits : 0;
  return {
    gpa: round2(gpa),
    totalUnits,
    totalPoints: round2(totalPoints),
  };
}

// ------------------------------------------------------------
// Compute CGPA for a student.
//
// Accepts either:
//   - an array of rows:    [{ unit, points, sessionId, semester }, ...]
//   - the result of a db call returning the same shape
//
// Returns overall CGPA, total units, and a per-session breakdown.
// ------------------------------------------------------------
function computeStudentCGPA(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      cgpa: 0,
      totalUnits: 0,
      totalPoints: 0,
      perSession: [],
    };
  }

  const perSessionMap = new Map();
  let totalUnits = 0;
  let totalPoints = 0;

  for (const r of rows) {
    const unit = Number(r.unit) || 0;
    const points = Number(r.points);
    const safePoints = Number.isFinite(points) ? points : 0;

    totalUnits += unit;
    totalPoints += unit * safePoints;

    const key = `${r.sessionId || 'unknown'}|${r.semester || 'unknown'}`;
    if (!perSessionMap.has(key)) {
      perSessionMap.set(key, {
        sessionId: r.sessionId || null,
        semester: r.semester || null,
        totalUnits: 0,
        totalPoints: 0,
      });
    }
    const bucket = perSessionMap.get(key);
    bucket.totalUnits += unit;
    bucket.totalPoints += unit * safePoints;
  }

  const cgpa = totalUnits > 0 ? totalPoints / totalUnits : 0;

  const perSession = Array.from(perSessionMap.values()).map((b) => ({
    sessionId: b.sessionId,
    semester: b.semester,
    totalUnits: b.totalUnits,
    totalPoints: round2(b.totalPoints),
    gpa: b.totalUnits > 0 ? round2(b.totalPoints / b.totalUnits) : 0,
  }));

  return {
    cgpa: round2(cgpa),
    totalUnits,
    totalPoints: round2(totalPoints),
    perSession,
  };
}


// ------------------------------------------------------------
// Resolve grade points for transcript calculations.
// Older published rows may have a grade/score but a NULL points
// column. Preserve an explicitly stored zero (a valid failing grade),
// otherwise derive the missing value from the active grade scale.
// ------------------------------------------------------------
function resolveResultPoints(result, scale = []) {
  const stored = result?.points;
  if (stored !== null && stored !== undefined && String(stored).trim() !== '') {
    const numeric = Number(stored);
    if (Number.isFinite(numeric)) return numeric;
  }

  const grade = String(result?.grade || '').trim().toUpperCase();
  if (grade) {
    const match = scale.find((band) => String(band.grade || '').trim().toUpperCase() === grade);
    if (match && Number.isFinite(Number(match.points))) return Number(match.points);
  }

  const score = Number(result?.score);
  if (Number.isFinite(score)) {
    const match = scale.find((band) => score >= Number(band.minScore) && score <= Number(band.maxScore));
    if (match && Number.isFinite(Number(match.points))) return Number(match.points);
  }
  return 0;
}

// ------------------------------------------------------------
// Classification by CGPA (NBTE bands).
// ------------------------------------------------------------
function classifyDegree(cgpa) {
  const value = Number(cgpa);
  if (!Number.isFinite(value)) return 'Fail';
  for (const band of CLASSIFICATION_BANDS) {
    if (value >= band.min && value <= band.max) return band.label;
  }
  // Edge case: exactly 4.00 fits the first band; above 4.00 clamps to Distinction.
  return value >= 3.5 ? 'Distinction' : 'Fail';
}

// ------------------------------------------------------------
// Convenience: is a result a pass? (default pass mark 40)
// ------------------------------------------------------------
function isPass(score, passMark = 40) {
  return Number(score) >= Number(passMark);
}

module.exports = {
  computeGPA,
  computeStudentCGPA,
  resolveResultPoints,
  classifyDegree,
  isPass,
  round2,
};