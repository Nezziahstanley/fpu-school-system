// ============================================================
// FPU School Management System — Static reference data
// Federal Polytechnic Ugep, Cross River State, Nigeria
// ------------------------------------------------------------
// Contains: school codes, department codes, programme codes,
// matric-number builder, parser, year helper, prefix helper.
// Matric format (6 segments): FPU/SST/CST/ND/26/001
// Legacy format (5 segments) : FPU/SST/CST/ND/001  (still parsed)
// ============================================================

'use strict';

// ------------------------------------------------------------
// Institution constants
// ------------------------------------------------------------
const INSTITUTION = Object.freeze({
  name: 'Federal Polytechnic Ugep',
  short: 'FPU',
  motto: 'Citadel of Technical Excellence',
  state: 'Cross River State',
  country: 'Nigeria',
  website: 'https://fedpolyugep.edu.ng',
});

// Default matric prefix (overridable via settings.matric_prefix)
const DEFAULT_MATRIC_PREFIX = process.env.MATRIC_PREFIX || 'FPU';

// ------------------------------------------------------------
// Schools (faculties)
// ------------------------------------------------------------
const SCHOOLS = Object.freeze([
  { code: 'SST', name: 'School of Science and Technology' },
  { code: 'SEN', name: 'School of Engineering Technology' },
  { code: 'SBS', name: 'School of Business and Management Sciences' },
  { code: 'SAG', name: 'School of Agriculture' },
  { code: 'SENV', name: 'School of Environmental Studies' },
  { code: 'SED', name: 'School of Education' },
]);

const SCHOOL_CODES = SCHOOLS.map((s) => s.code);

// ------------------------------------------------------------
// Departments (13 total — keyed by code)
// ------------------------------------------------------------
const DEPARTMENTS = Object.freeze([
  { code: 'CST', school: 'SST', name: 'Computer Science' },
  { code: 'SLT', school: 'SST', name: 'Science Laboratory Technology' },
  { code: 'STA', school: 'SST', name: 'Statistics' },
  { code: 'EEE', school: 'SEN', name: 'Electrical/Electronic Engineering' },
  { code: 'MEC', school: 'SEN', name: 'Mechanical Engineering' },
  { code: 'CVE', school: 'SEN', name: 'Civil Engineering' },
  { code: 'ACC', school: 'SBS', name: 'Accountancy' },
  { code: 'BUS', school: 'SBS', name: 'Business Administration' },
  { code: 'MKT', school: 'SBS', name: 'Marketing' },
  { code: 'AGR', school: 'SAG', name: 'Agricultural Technology' },
  { code: 'URP', school: 'SENV', name: 'Urban and Regional Planning' },
  { code: 'ARC', school: 'SENV', name: 'Architectural Technology' },
  { code: 'EDU', school: 'SED', name: 'Technical Education' },
]);

const DEPARTMENT_CODES = DEPARTMENTS.map((d) => d.code);

// ------------------------------------------------------------
// Programmes (13 — one per department, both ND and HND)
// ------------------------------------------------------------
const PROGRAMMES = Object.freeze([
  { code: 'CST', department: 'CST', name: 'Computer Science', levels: ['ND', 'HND'] },
  { code: 'SLT', department: 'SLT', name: 'Science Laboratory Technology', levels: ['ND', 'HND'] },
  { code: 'STA', department: 'STA', name: 'Statistics', levels: ['ND', 'HND'] },
  { code: 'EEE', department: 'EEE', name: 'Electrical/Electronic Engineering', levels: ['ND', 'HND'] },
  { code: 'MEC', department: 'MEC', name: 'Mechanical Engineering', levels: ['ND', 'HND'] },
  { code: 'CVE', department: 'CVE', name: 'Civil Engineering', levels: ['ND', 'HND'] },
  { code: 'ACC', department: 'ACC', name: 'Accountancy', levels: ['ND', 'HND'] },
  { code: 'BUS', department: 'BUS', name: 'Business Administration', levels: ['ND', 'HND'] },
  { code: 'MKT', department: 'MKT', name: 'Marketing', levels: ['ND', 'HND'] },
  { code: 'AGR', department: 'AGR', name: 'Agricultural Technology', levels: ['ND', 'HND'] },
  { code: 'URP', department: 'URP', name: 'Urban and Regional Planning', levels: ['ND', 'HND'] },
  { code: 'ARC', department: 'ARC', name: 'Architectural Technology', levels: ['ND', 'HND'] },
  { code: 'EDU', department: 'EDU', name: 'Technical Education', levels: ['ND', 'HND'] },
]);

// ------------------------------------------------------------
// Levels
// ------------------------------------------------------------
const LEVELS = Object.freeze(['ND', 'HND', 'CERT']);
const LEVEL_NAMES = Object.freeze({
  ND: 'National Diploma',
  HND: 'Higher National Diploma',
  CERT: 'Certificate',
});

// ------------------------------------------------------------
// Semesters
// ------------------------------------------------------------
const SEMESTERS = Object.freeze(['first', 'second']);
const SEMESTER_LABELS = Object.freeze({
  first: 'First Semester',
  second: 'Second Semester',
});

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/**
 * Get the current 2-digit year-short (e.g. 2026 -> "26").
 * @param {Date|number|string} [when=new Date()]
 * @returns {string}
 */
function getYearShort(when = new Date()) {
  const d = when instanceof Date ? when : new Date(when);
  const y = d.getFullYear();
  return String(y).slice(-2).padStart(2, '0');
}

/**
 * Get the matric prefix (falls back to env / default).
 * @param {string} [fromSettings]
 * @returns {string}
 */
function getMatricPrefix(fromSettings) {
  return (fromSettings || DEFAULT_MATRIC_PREFIX || 'FPU').toUpperCase();
}

/**
 * Pad a number to N digits with leading zeros.
 * @param {number|string} n
 * @param {number} [width=3]
 * @returns {string}
 */
function pad(n, width = 3) {
  return String(n).padStart(width, '0');
}

/**
 * Build a 6-segment matric number:
 *   FPU/SST/CST/ND/26/001
 *
 * @param {object} opts
 * @param {string} opts.prefix       - e.g. "FPU"          (default: env / "FPU")
 * @param {string} opts.schoolCode   - e.g. "SST"
 * @param {string} opts.deptCode     - e.g. "CST"
 * @param {string} opts.level        - "ND" | "HND" | "CERT"
 * @param {number|string} opts.year  - 2026 or "26"
 * @param {number|string} opts.serial- 1 or "001"
 * @returns {string}
 */
function buildMatricNumber({ prefix, schoolCode, deptCode, level, year, serial }) {
  if (!schoolCode) throw new Error('buildMatricNumber: schoolCode required');
  if (!deptCode) throw new Error('buildMatricNumber: deptCode required');
  if (!level) throw new Error('buildMatricNumber: level required');
  if (!year) throw new Error('buildMatricNumber: year required');
  if (serial === undefined || serial === null) throw new Error('buildMatricNumber: serial required');

  const p = getMatricPrefix(prefix);
  const s = String(schoolCode).toUpperCase();
  const d = String(deptCode).toUpperCase();
  const l = String(level).toUpperCase();

  const yStr = String(year);
  const y = yStr.length === 4 ? yStr.slice(-2) : yStr.padStart(2, '0');

  const serialStr = pad(serial, 3);

  return `${p}/${s}/${d}/${l}/${y}/${serialStr}`;
}

/**
 * Parse a matric number (6-segment OR legacy 5-segment).
 *
 *   6-seg : FPU/SST/CST/ND/26/001   -> { prefix, schoolCode, deptCode, level, year, serial, legacy: false }
 *   5-seg : FPU/SST/CST/ND/001      -> { prefix, schoolCode, deptCode, level, year: null, serial, legacy: true }
 *
 * @param {string} matric
 * @returns {object|null}
 */
function parseMatric(matric) {
  if (!matric || typeof matric !== 'string') return null;
  const parts = matric.trim().toUpperCase().split('/').filter(Boolean);
  if (parts.length !== 6 && parts.length !== 5) return null;

  if (parts.length === 6) {
    const [prefix, schoolCode, deptCode, level, year, serial] = parts;
    if (!/^\d{2}$/.test(year)) return null;
    if (!/^\d{1,3}$/.test(serial)) return null;
    return {
      prefix,
      schoolCode,
      deptCode,
      level,
      year,
      serial: Number(serial),
      raw: matric,
      legacy: false,
    };
  }

  // 5-segment legacy
  const [prefix, schoolCode, deptCode, level, serial] = parts;
  if (!/^\d{1,3}$/.test(serial)) return null;
  return {
    prefix,
    schoolCode,
    deptCode,
    level,
    year: null,
    serial: Number(serial),
    raw: matric,
    legacy: true,
  };
}

/**
 * Validate a matric number is well-formed.
 * @param {string} matric
 * @returns {boolean}
 */
function isValidMatric(matric) {
  return parseMatric(matric) !== null;
}

/**
 * Look up a school by code.
 * @param {string} code
 * @returns {object|null}
 */
function getSchool(code) {
  if (!code) return null;
  const upper = String(code).toUpperCase();
  return SCHOOLS.find((s) => s.code === upper) || null;
}

/**
 * Look up a department by code.
 * @param {string} code
 * @returns {object|null}
 */
function getDepartment(code) {
  if (!code) return null;
  const upper = String(code).toUpperCase();
  return DEPARTMENTS.find((d) => d.code === upper) || null;
}

/**
 * Look up a programme by code.
 * @param {string} code
 * @returns {object|null}
 */
function getProgramme(code) {
  if (!code) return null;
  const upper = String(code).toUpperCase();
  return PROGRAMMES.find((p) => p.code === upper) || null;
}

/**
 * Given a department code, return the school code it belongs to.
 * @param {string} deptCode
 * @returns {string|null}
 */
function schoolOfDepartment(deptCode) {
  const dept = getDepartment(deptCode);
  return dept ? dept.school : null;
}

// ------------------------------------------------------------
// Grade classification thresholds (NBTE)
// ------------------------------------------------------------
const CLASSIFICATION_BANDS = Object.freeze([
  { min: 3.5,  max: 4.0,  label: 'Distinction' },
  { min: 3.0,  max: 3.49, label: 'Upper Credit' },
  { min: 2.5,  max: 2.99, label: 'Lower Credit' },
  { min: 2.0,  max: 2.49, label: 'Pass' },
  { min: 0.0,  max: 1.99, label: 'Fail' },
]);

// ------------------------------------------------------------
// Default NBTE grade scale (used to seed `grade_scales` table)
// ------------------------------------------------------------
const DEFAULT_GRADE_SCALE = Object.freeze([
  { grade: 'A', minScore: 70, maxScore: 100, points: 4.0, remark: 'Excellent' },
  { grade: 'B', minScore: 60, maxScore: 69,  points: 3.0, remark: 'Very Good' },
  { grade: 'C', minScore: 50, maxScore: 59,  points: 2.0, remark: 'Good' },
  { grade: 'D', minScore: 45, maxScore: 49,  points: 1.0, remark: 'Fair' },
  { grade: 'E', minScore: 40, maxScore: 44,  points: 0.5, remark: 'Pass' },
  { grade: 'F', minScore: 0,  maxScore: 39,  points: 0.0, remark: 'Fail' },
]);

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = {
  // constants
  INSTITUTION,
  DEFAULT_MATRIC_PREFIX,
  SCHOOLS,
  SCHOOL_CODES,
  DEPARTMENTS,
  DEPARTMENT_CODES,
  PROGRAMMES,
  LEVELS,
  LEVEL_NAMES,
  SEMESTERS,
  SEMESTER_LABELS,
  CLASSIFICATION_BANDS,
  DEFAULT_GRADE_SCALE,

  // helpers
  getYearShort,
  getMatricPrefix,
  buildMatricNumber,
  parseMatric,
  isValidMatric,
  getSchool,
  getDepartment,
  getProgramme,
  schoolOfDepartment,
  pad,
};