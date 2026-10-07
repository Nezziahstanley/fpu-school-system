// ============================================================
// apply-batch2a.js
// ------------------------------------------------------------
// Rewrites id-based back/cancel buttons in admin partials to
// use FPU_ADMIN.goBack('parent-page') inline.
//
// Every "* -back" and "* -cancel" button in a partial gets an
// inline onclick based on the partial's folder → parent-page
// mapping below.
//
// Also fixes partials whose inline <script> uses window.location.hash
// at parse time — those are the ones that break on second visit.
//
// Usage:
//   node apply-batch2a.js
//   node apply-batch2a.js --dry     (preview only, no writes)
// ============================================================

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT    = process.cwd();
const DRY     = process.argv.includes('--dry');
const PARTIALS_DIR = path.join(ROOT, 'public', 'admin', 'partials');
const BACKUP_DIR   = path.join(ROOT, 'backups', 'batch2a-' + new Date().toISOString().replace(/[:.]/g, '-'));

// ------------------------------------------------------------
// Map: partial folder → parent page key in SPA_PAGES
// ------------------------------------------------------------
const PARENT_OF = {
  'applications':       'applications',
  'students':           'students',
  'sessions':           'sessions',
  'programmes':         'programmes',
  'courses':            'courses',
  'schools':            'schools',
  'departments':        'departments',
  'allocations':        'allocations',
  'registrations':      'registrations',
  'results':            'results',
  'transcript':         'transcript',
  'timetable':          'timetable',
  'exams':              'exams',
  'attendance':         'attendance',
  'staff':              'staff',
  'hods':               'hods',
  'lecturers':          'lecturers',
  'fees':               'fees',
  'payments':           'payments',
  'clearances':         'clearances',
  'announcements':      'announcements',
  'notifications':      'notifications',
  'complaints':         'complaints',
  'library':            'library',
  'documents':          'documents',
  'graduation':         'graduation',
  'reports':            'reports',
  'audit':              'audit',
  'security':           'security',
  'settings':           'settings',
  'users':              'users',
  'dashboard':          'dashboard',
};

// ------------------------------------------------------------
function log(msg, color) {
  const codes = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', dim: '\x1b[2m', reset: '\x1b[0m' };
  console.log((codes[color] || '') + msg + codes.reset);
}
function ok(m)   { log('  ✓ ' + m, 'green'); }
function warn(m) { log('  ⚠ ' + m, 'yellow'); }
function info(m) { log('  · ' + m, 'dim'); }
function head(m) { log('\n' + m, 'cyan'); }
function err(m)  { log('  ✗ ' + m, 'red'); }

// ------------------------------------------------------------
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (full.endsWith('.html')) out.push(full);
  }
  return out;
}

function parentKeyFor(filePath) {
  const rel = path.relative(PARTIALS_DIR, filePath).split(path.sep);
  const folder = rel[0];
  return PARENT_OF[folder] || 'dashboard';
}

// ------------------------------------------------------------
// Button rewriter
// ------------------------------------------------------------
// Matches:
//   <button ... id="xxx-back" ...>← Back</button>
//   <button ... id="xxx-cancel" ...>Cancel</button>
// And adds onclick="FPU_ADMIN.goBack('parent')" if it doesn't
// already have an onclick attribute.
//
// Also handles buttons where the label contains "← Back" or
// "Cancel" and the id ends in -back / -cancel.
// ------------------------------------------------------------
function rewriteButtons(html, parentKey) {
  let changed = 0;

  // 1) <button ... id="*-back" ...>  (or *-cancel)
  html = html.replace(
    /<button\b([^>]*\bid="([a-z0-9-]*(?:-back|-cancel))"[^>]*)>/gi,
    (match, attrs, id) => {
      if (/\bonclick\s*=/.test(attrs)) return match; // already has inline handler
      changed++;
      return `<button${attrs} onclick="FPU_ADMIN.goBack('${parentKey}')">`;
    }
  );

  return { html, changed };
}

// ------------------------------------------------------------
// Partial <script> rewrite for the "second visit" problem
// ------------------------------------------------------------
// Some partials do:
//   const hash = window.location.hash.replace(/^#/, '');
//   ...
//   document.getElementById('x-back').onclick = () => history.back();
//
// On second visit, `document.getElementById(...)` returns null
// because the script tries to wire an element that the SPA cached.
// The safest fix is to remove those `history.back()` wirings entirely
// — the inline onclick we just added will handle the button.
// ------------------------------------------------------------
function removeHistoryBackBindings(html, parentKey) {
  let changed = 0;

  // Pattern 1: el.onclick = () => history.back();
  //            el.addEventListener('click', () => history.back());
  // → comment out the whole statement
  const patterns = [
    /([^\n;]*\.onclick\s*=\s*(?:\(\s*\)\s*=>\s*|function\s*\(\s*\)\s*\{\s*)history\.back\(\s*\)\s*(?:\}|\s*;))/g,
    /([^\n;]*\.addEventListener\s*\(\s*['"]click['"]\s*,\s*(?:\(\s*\)\s*=>\s*|function\s*\(\s*\)\s*\{\s*)history\.back\(\s*\)[^)]*\)\s*;?)/g,
  ];
  for (const re of patterns) {
    html = html.replace(re, (match) => {
      changed++;
      return `/* batch2a: replaced by inline goBack */ void 0; /* ${match.trim()} */`;
    });
  }

  return { html, changed };
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
head('Batch 2A — Back button fixer');
log(DRY ? 'DRY RUN — no files will be written' : 'Live run — files will be updated', DRY ? 'yellow' : 'green');
info('Partials dir: ' + PARTIALS_DIR);
info('Backup dir:   ' + BACKUP_DIR);

if (!fs.existsSync(PARTIALS_DIR)) {
  err('Cannot find ' + PARTIALS_DIR);
  err('Run this script from the project root.');
  process.exit(1);
}

const files = walk(PARTIALS_DIR);
head(`Found ${files.length} partial(s)`);

let totalButtons = 0;
let totalHistoryBacks = 0;
let touchedFiles = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const parentKey = parentKeyFor(file);

  let html = original;

  const b = rewriteButtons(html, parentKey);
  html = b.html;

  const h = removeHistoryBackBindings(html, parentKey);
  html = h.html;

  if (html === original) continue;

  totalButtons += b.changed;
  totalHistoryBacks += h.changed;
  touchedFiles++;

  const rel = path.relative(ROOT, file);
  info(`${rel}  →  +${b.changed} onclick, ${h.changed} history.back removed`);

  if (!DRY) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const backupName = path.relative(PARTIALS_DIR, file).replace(/[\\/]/g, '__');
    fs.writeFileSync(path.join(BACKUP_DIR, backupName), original, 'utf8');
    fs.writeFileSync(file, html, 'utf8');
  }
}

head('Summary');
ok(`Files scanned:  ${files.length}`);
ok(`Files updated:  ${touchedFiles}`);
ok(`Buttons wired:  ${totalButtons}`);
ok(`history.back() calls neutralized: ${totalHistoryBacks}`);

if (DRY) {
  head('Dry run complete — rerun without --dry to apply');
} else {
  head('Batch 2A complete');
  info('Backups: ' + BACKUP_DIR);
  info('Restart the dev server and test any "New X" page → Back / Cancel');
}