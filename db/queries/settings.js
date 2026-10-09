// ============================================================
// FPU — Query helper: settings, study_levels
// ============================================================

'use strict';

const { db, sql, schema } = require('../index');
const { eq, and, asc } = require('drizzle-orm');

const { settings, studyLevels } = schema;

// ============================================================
// SETTINGS
// ============================================================

async function get(key, fallback = null) {
  if (!key) return fallback;
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return row ? row.value : fallback;
}

async function getNumber(key, fallback = 0) {
  const v = await get(key);
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function getBool(key, fallback = false) {
  const v = await get(key);
  if (v === null || v === undefined || v === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(v).toLowerCase());
}

async function getMany(keys = []) {
  if (!keys.length) return {};
  const rows = await db.select().from(settings);
  const map = {};
  for (const row of rows) {
    if (keys.includes(row.key)) map[row.key] = row.value;
  }
  for (const k of keys) if (!(k in map)) map[k] = null;
  return map;
}

async function getAll({ category } = {}) {
  const where = category ? eq(settings.category, category) : undefined;
  return db.select().from(settings).where(where).orderBy(asc(settings.key));
}

async function set(key, value, category = 'general') {
  const [row] = await db
    .insert(settings)
    .values({ key, value: value === undefined || value === null ? null : String(value), category })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: value === undefined || value === null ? null : String(value), category, updatedAt: new Date() },
    })
    .returning();
  return row;
}

async function setMany(pairs, category = 'general') {
  if (!pairs || typeof pairs !== 'object') return [];
  const rows = [];
  for (const [key, value] of Object.entries(pairs)) {
    rows.push(await set(key, value, category));
  }
  return rows;
}

async function removeSetting(key) {
  const [row] = await db.delete(settings).where(eq(settings.key, key)).returning();
  return row || null;
}

// ------------------------------------------------------------
// Frequently used values (with sane defaults)
// ------------------------------------------------------------
async function getMaxUnits() {
  return getNumber('max_units', Number(process.env.DEFAULT_MAX_UNITS) || 24);
}

async function getMatricPrefix() {
  return (await get('matric_prefix')) || process.env.MATRIC_PREFIX || 'FPU';
}

async function getCurrentSessionName() {
  return get('current_session', null);
}

async function getCurrentSemester() {
  return get('current_semester', 'first');
}

async function getPassMark() {
  return getNumber('pass_mark', 40);
}

async function getInstitution() {
  let map = {};
  try {
    const rows = await db.select().from(settings).where(eq(settings.category, 'institution'));
    for (const row of rows) map[row.key] = row.value;
  } catch (err) {
    console.error('[getInstitution] query failed:', err.message);
    // Fall through to env-var + hardcoded defaults — card still renders
  }

  return {
    name:    map.institution_name    || process.env.INSTITUTION_NAME    || 'Federal Polytechnic Ugep',
    short:   map.institution_short   || process.env.INSTITUTION_SHORT   || 'FPU',
    motto:   map.institution_motto   || process.env.INSTITUTION_MOTTO   || 'Citadel of Technical Excellence',
    address: map.institution_address || process.env.INSTITUTION_ADDRESS || 'Ugep, Cross River State, Nigeria',
    state:   map.institution_state   || process.env.INSTITUTION_STATE   || 'Cross River State',
    country: map.institution_country || process.env.INSTITUTION_COUNTRY || 'Nigeria',
    phone:   map.institution_phone   || process.env.INSTITUTION_PHONE   || '+234-704-114-5338',
    email:   map.institution_email   || process.env.INSTITUTION_EMAIL   || 'stanleytechconnect@gmail.com',
    website: map.institution_website || process.env.INSTITUTION_WEBSITE || 'https://fpu-school-systems.onrender.com',
  };
}

// ------------------------------------------------------------
// Bank accounts (seeded by scripts/seed-bank-details.js)
// ------------------------------------------------------------
async function getBankAccounts() {
  const rows = await db.select().from(settings).where(eq(settings.category, 'bank'));
  return rows
    .map((r) => {
      try {
        return JSON.parse(r.value);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .map((b, i) => ({ id: i + 1, ...b }));
}

// ============================================================
// STUDY LEVELS
// ============================================================

async function listStudyLevels() {
  return db.select().from(studyLevels).orderBy(asc(studyLevels.id));
}

async function findStudyLevelByCode(code) {
  if (!code) return null;
  const [row] = await db.select().from(studyLevels).where(eq(studyLevels.code, code)).limit(1);
  return row || null;
}

async function createStudyLevel(data) {
  const [row] = await db.insert(studyLevels).values({
    code: data.code,
    name: data.name,
    level: data.level,
    yearOfStudy: Number(data.yearOfStudy) || 1,
  }).returning();
  return row;
}

async function removeStudyLevel(id) {
  const [row] = await db.delete(studyLevels).where(eq(studyLevels.id, Number(id))).returning();
  return row || null;
}

module.exports = {
  // settings
  get,
  getNumber,
  getBool,
  getMany,
  getAll,
  set,
  setMany,
  removeSetting,

  // helpers
  getMaxUnits,
  getMatricPrefix,
  getCurrentSessionName,
  getCurrentSemester,
  getPassMark,
  getInstitution,
  getBankAccounts,

  // study levels
  listStudyLevels,
  findStudyLevelByCode,
  createStudyLevel,
  removeStudyLevel,
};