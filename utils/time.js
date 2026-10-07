// ============================================================
// FPU — Time utilities (for timetable conflict detection etc.)
// ------------------------------------------------------------
// "HH:MM" strings are used everywhere for slot start/end.
// ============================================================

'use strict';

// ------------------------------------------------------------
// Convert "HH:MM" to minutes since midnight. Returns NaN if bad.
// ------------------------------------------------------------
function timeToMinutes(hhmm) {
  if (typeof hhmm !== 'string') return NaN;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return NaN;
  return h * 60 + min;
}

// ------------------------------------------------------------
// Convert minutes back to "HH:MM".
// ------------------------------------------------------------
function minutesToTime(mins) {
  const m = Math.max(0, Math.floor(Number(mins) || 0));
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ------------------------------------------------------------
// Do two "HH:MM" ranges overlap?
// Half-open [start, end) semantics.
// ------------------------------------------------------------
function slotsOverlap(aStart, aEnd, bStart, bEnd) {
  const a1 = timeToMinutes(aStart);
  const a2 = timeToMinutes(aEnd);
  const b1 = timeToMinutes(bStart);
  const b2 = timeToMinutes(bEnd);
  if ([a1, a2, b1, b2].some((n) => Number.isNaN(n))) return false;
  return a1 < b2 && b1 < a2;
}

// ------------------------------------------------------------
// Sorted weekday ordering (used for timetable display).
// ------------------------------------------------------------
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function dayIndex(day) {
  const i = DAY_ORDER.indexOf(String(day || ''));
  return i === -1 ? 99 : i;
}

// ------------------------------------------------------------
// Format helpers
// ------------------------------------------------------------
function formatDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateTime(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString();
}

module.exports = {
  timeToMinutes,
  minutesToTime,
  slotsOverlap,
  DAY_ORDER,
  dayIndex,
  formatDate,
  formatDateTime,
};