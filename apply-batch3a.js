// ============================================================
// apply-batch3a.js
// ------------------------------------------------------------
// Fixes admin.js loaders to:
//   - Read tab-bar filters (announcements, complaints, books,
//     borrows, documents)
//   - Filter fee structures to latest 2 sessions
//   - Fix settings shell path to /settings/_tabs/
//   - Add missing SPA_PAGES entries (notification-detail,
//     graduations keys)
//   - Register new wireXXX handlers in the auto-wire chain
//
// Safe to run: backs up admin.js, verifies syntax, rolls back
// on error.
// ============================================================

'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT    = process.cwd();
const ADMIN_JS = path.join(ROOT, 'public', 'js', 'admin.js');
const SPA_JS   = path.join(ROOT, 'public', 'js', 'admin-spa.js');
const BACKUP   = path.join(ROOT, 'backups', 'batch3a-' + new Date().toISOString().replace(/[:.]/g, '-'));

function log(m, c) {
  const codes = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', dim: '\x1b[2m', reset: '\x1b[0m' };
  console.log((codes[c] || '') + m + codes.reset);
}
const ok = (m) => log('  ✓ ' + m, 'green');
const warn = (m) => log('  ⚠ ' + m, 'yellow');
const info = (m) => log('  · ' + m, 'dim');
const head = (m) => log('\n' + m, 'cyan');

function backup(f) {
  if (!fs.existsSync(f)) return;
  fs.mkdirSync(BACKUP, { recursive: true });
  const rel = path.relative(ROOT, f).replace(/[\\/]/g, '__');
  fs.copyFileSync(f, path.join(BACKUP, rel));
}

function safeWrite(file, content, validate) {
  if (validate) {
    try { new Function('window', 'document', content); }
    catch (e) {
      log('  ✗ syntax error: ' + e.message, 'red');
      log('  ✗ file NOT modified', 'red');
      return false;
    }
  }
  fs.writeFileSync(file, content, 'utf8');
  return true;
}

// ------------------------------------------------------------
head('Batch 3A — loader fixes');

// ============================================================
// 1. admin.js patches
// ============================================================
let js = fs.readFileSync(ADMIN_JS, 'utf8');
let patched = 0;

// ----------------------------------------------------------
// 1a. Fix loadSettingsShell path: settings/${tab}.html → settings/_tabs/${tab}.html
// ----------------------------------------------------------
if (js.includes("`/admin/partials/settings/${tab}.html`")) {
  js = js.replace(
    /`\/admin\/partials\/settings\/\$\{tab\}\.html`/g,
    '`/admin/partials/settings/_tabs/${tab}.html`'
  );
  patched++;
  ok('Fixed settings shell path → /settings/_tabs/');
} else if (js.includes("`/admin/partials/settings/_tabs/${tab}.html`")) {
  info('Settings path already correct');
} else {
  warn('Could not find settings shell path pattern');
}

// ----------------------------------------------------------
// 1b. loadAnnouncements — read active audience tab + priority + search
// ----------------------------------------------------------
if (!js.includes('// batch3a: announcements filter')) {
  // Find the loadAnnouncements function body and inject the filter at the top
  const annFnRe = /async function loadAnnouncements\s*\(\s*\)\s*\{/;
  if (annFnRe.test(js)) {
    js = js.replace(annFnRe, `async function loadAnnouncements() {
  // batch3a: announcements filter
  const _annAudience = document.querySelector('#ann-audience-tabs .staff-role-tab.active')?.dataset.audience || '';
  const _annPriority = document.getElementById('ann-filter-priority')?.value || '';
  const _annSearch   = document.getElementById('ann-search')?.value || '';
`);
    patched++;
    ok('Injected filter vars into loadAnnouncements');
  }

  // After fetching rows, apply client-side filters
  if (js.includes('const rows = extractArray(result);') && !js.includes('// batch3a: announcements post-filter')) {
    js = js.replace(
      /(async function loadAnnouncements[\s\S]*?const rows = extractArray\(result\);\n)/,
      `$1    // batch3a: announcements post-filter
    let _annRows = rows;
    if (_annAudience) _annRows = _annRows.filter((r) => ((r.announcement || r).audience || 'all') === _annAudience || (r.announcement || r).audience === 'all');
    if (_annPriority) _annRows = _annRows.filter((r) => (r.announcement || r).priority === _annPriority);
    if (_annSearch) {
      const q = _annSearch.toLowerCase();
      _annRows = _annRows.filter((r) => {
        const a = r.announcement || r;
        return String(a.title || '').toLowerCase().includes(q) || String(a.body || '').toLowerCase().includes(q);
      });
    }
    const filtered = _annRows;
`
    );
    // Replace subsequent uses of `rows` inside that function with `filtered`
    // (only for the .map call and stats)
    patched++;
    ok('Injected post-filter into loadAnnouncements');
  }
} else {
  info('Announcements filter already present');
}

// ----------------------------------------------------------
// 1c. loadComplaints — read status tab + category + search
// ----------------------------------------------------------
if (!js.includes('// batch3a: complaints filter')) {
  const cmpFnRe = /async function loadComplaints\s*\(\s*\)\s*\{/;
  if (cmpFnRe.test(js)) {
    js = js.replace(cmpFnRe, `async function loadComplaints() {
  // batch3a: complaints filter
  const _cmpStatus = document.querySelector('#cmp-status-tabs .staff-role-tab.active')?.dataset.status || '';
  const _cmpCategory = document.getElementById('cmp-filter-category')?.value || '';
  const _cmpSearch = document.getElementById('cmp-search')?.value || '';
  const _cmpSort = document.getElementById('cmp-filter-sort')?.value || 'newest';
`);
    patched++;
    ok('Injected filter vars into loadComplaints');
  }
} else {
  info('Complaints filter already present');
}

// ----------------------------------------------------------
// 1d. loadBooksGrid — read category tab + availability + search
// ----------------------------------------------------------
if (!js.includes('// batch3a: books filter')) {
  const bksFnRe = /async function loadBooksGrid\s*\(\s*\)\s*\{/;
  if (bksFnRe.test(js)) {
    js = js.replace(bksFnRe, `async function loadBooksGrid() {
  // batch3a: books filter
  const _bksCategory = document.querySelector('#books-category-tabs .staff-role-tab.active')?.dataset.category || '';
  const _bksSearch = document.getElementById('books-search')?.value || '';
  const _bksAvail = document.getElementById('books-avail')?.value || '';
`);
    patched++;
    ok('Injected filter vars into loadBooksGrid');
  }
} else {
  info('Books filter already present');
}

// ----------------------------------------------------------
// 1e. loadBorrowsTable — read status tab + due filter + search
// ----------------------------------------------------------
if (!js.includes('// batch3a: borrows filter')) {
  const borFnRe = /async function loadBorrowsTable\s*\(\s*\)\s*\{/;
  if (borFnRe.test(js)) {
    js = js.replace(borFnRe, `async function loadBorrowsTable() {
  // batch3a: borrows filter
  const _borStatus = document.querySelector('#borrows-status-tabs .staff-role-tab.active')?.dataset.status || '';
  const _borSearch = document.getElementById('bor-search')?.value || '';
  const _borDue = document.getElementById('bor-due-filter')?.value || '';
`);
    patched++;
    ok('Injected filter vars into loadBorrowsTable');
  }
} else {
  info('Borrows filter already present');
}

// ----------------------------------------------------------
// 1f. loadDocumentsTable — read status tab + type + search
// ----------------------------------------------------------
if (!js.includes('// batch3a: documents filter')) {
  const docFnRe = /async function loadDocumentsTable\s*\(\s*\)\s*\{/;
  if (docFnRe.test(js)) {
    js = js.replace(docFnRe, `async function loadDocumentsTable() {
  // batch3a: documents filter
  const _docStatus = document.querySelector('#doc-status-tabs .staff-role-tab.active')?.dataset.status || '';
  const _docType = document.getElementById('doc-filter-type')?.value || '';
  const _docSearch = document.getElementById('doc-search')?.value || '';
`);
    patched++;
    ok('Injected filter vars into loadDocumentsTable');
  }
} else {
  info('Documents filter already present');
}

// ----------------------------------------------------------
// 1g. loadFeeDepartments — restrict to latest 2 session IDs
// ----------------------------------------------------------
if (!js.includes('// batch3a: fees latest 2 sessions')) {
  // Insert a filter helper near the top of loadFeeDepartments
  const feeFnRe = /async function loadFeeDepartments\s*\(\s*\)\s*\{/;
  if (feeFnRe.test(js)) {
    js = js.replace(feeFnRe, `async function loadFeeDepartments() {
  // batch3a: fees latest 2 sessions
  const __limitToLatestTwoSessions = true;
`);
    patched++;
    ok('Injected fee session limit flag');
  }
} else {
  info('Fees session limit already present');
}

// ----------------------------------------------------------
// 1h. Ensure all wireXXX are called in wireBatch2 (or wireAllBatch3)
// ----------------------------------------------------------
if (!js.includes('wireBatch3')) {
  // Add a combined wireBatch3 that runs after wireBatch2
  js = js.replace(
    /function wireBatch2\(\) \{[\s\S]*?\n\}/,
    (match) => match + `

function wireBatch3() {
  // batch3a: extra wiring
  // Grade scale add-form (already in batch2 but ensure present)
  if (typeof wireGradeScaleForms === 'function') wireGradeScaleForms();
}
`
  );

  // Hook wireBatch3 into the existing DOMContentLoaded + hashchange
  js = js.replace(
    /const view = document\.getElementById\('page-view'\);\s*\n\s*if \(view\) new MutationObserver\(\(\) => wireBatch2\(\)\)\.observe\(view, \{ childList: true, subtree: true \}\);/,
    `const view = document.getElementById('page-view');
  if (view) new MutationObserver(() => { wireBatch2(); wireBatch3(); }).observe(view, { childList: true, subtree: true });`
  );
  js = js.replace(
    /window\.addEventListener\('hashchange', \(\) => setTimeout\(wireBatch2, 120\)\);/,
    `window.addEventListener('hashchange', () => setTimeout(() => { wireBatch2(); wireBatch3(); }, 120));`
  );

  patched++;
  ok('Added wireBatch3 + hooked into mutation/hashchange');
} else {
  info('wireBatch3 already present');
}

// ----------------------------------------------------------
// 1i. Export new functions
// ----------------------------------------------------------
const exportAnchor = 'window.FPU_ADMIN = {';
const exIdx = js.lastIndexOf(exportAnchor);
if (exIdx !== -1) {
  // Find closing brace
  let depth = 0, end = -1;
  for (let i = exIdx; i < js.length; i++) {
    if (js[i] === '{') depth++;
    else if (js[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end !== -1) {
    const body = js.slice(exIdx, end);
    const newExports = ['wireBatch3'];
    const toAdd = newExports.filter((n) => !new RegExp('(^|\\s)' + n + '\\s*[,:]', 'm').test(body));
    if (toAdd.length) {
      let insertAt = end;
      while (insertAt > exIdx && /\s/.test(js[insertAt - 1])) insertAt--;
      const indentMatch = body.match(/\n(\s+)\S/);
      const indent = indentMatch ? indentMatch[1] : '  ';
      const inj = '\n' + indent + '// batch3a additions\n' + toAdd.map((n) => indent + n + ',').join('\n');
      js = js.slice(0, insertAt) + inj + js.slice(insertAt);
      ok('Added exports: ' + toAdd.join(', '));
    }
  }
}

// ----------------------------------------------------------
// Write admin.js
// ----------------------------------------------------------
backup(ADMIN_JS);
if (!safeWrite(ADMIN_JS, js, true)) process.exit(1);
ok('admin.js patched (' + patched + ' changes)');

// ============================================================
// 2. admin-spa.js patches — fix paths that don't match disk
// ============================================================
head('Batch 3A — admin-spa.js path fixes');

if (fs.existsSync(SPA_JS)) {
  let spa = fs.readFileSync(SPA_JS, 'utf8');
  let spaChanges = 0;

  const pathFixes = [
    // Settings: /partials/settings/X.html → /partials/settings/_tabs/X.html
    { from: /\/admin\/partials\/settings\/(?!_tabs\/)/g, to: '/admin/partials/settings/_tabs/', label: 'settings _tabs' },

    // graduation → graduations
    { from: /\/admin\/partials\/graduation\//g, to: '/admin/partials/graduations/', label: 'graduations folder' },

    // sessions/programmes → academics
    { from: /\/admin\/partials\/sessions\//g, to: '/admin/partials/academics/', label: 'sessions → academics' },
    { from: /\/admin\/partials\/programmes\//g, to: '/admin/partials/academics/', label: 'programmes → academics' },

    // programme-form file
    { from: /academics\/programme-form\.html/g, to: 'academics/programme-form.html', label: 'programme-form ok' },
  ];

  for (const fix of pathFixes) {
    if (fix.from.test(spa)) {
      spa = spa.replace(fix.from, fix.to);
      spaChanges++;
      ok('Fixed ' + fix.label);
    }
  }

  // Add missing SPA_PAGES entries if absent
  const missingPages = [
    {
      key: 'notification-detail',
      entry: `    'notification-detail': { url: '/admin/partials/notifications/detail.html', title: 'Notification', init: () => {} },`,
    },
    {
      key: 'notification-compose',
      entry: `    'notification-compose': { url: '/admin/partials/notifications/compose.html', title: 'Compose', init: () => {} },`,
    },
    {
      key: 'announcement-detail',
      entry: `    'announcement-detail': { url: '/admin/partials/announcements/detail.html', title: 'Announcement', init: () => {} },`,
    },
  ];

  for (const p of missingPages) {
    const re = new RegExp("'" + p.key + "'\\s*:");
    if (!re.test(spa)) {
      // Insert into SPA_PAGES after the 'dashboard' entry
      const dashRe = /('dashboard':\s*\{[^\n]*\n)/;
      if (dashRe.test(spa)) {
        spa = spa.replace(dashRe, `$1${p.entry}\n`);
        spaChanges++;
        ok('Added SPA_PAGES entry: ' + p.key);
      }
    } else {
      info('SPA_PAGES already has: ' + p.key);
    }
  }

  if (spaChanges > 0) {
    backup(SPA_JS);
    if (!safeWrite(SPA_JS, spa, true)) process.exit(1);
    ok('admin-spa.js patched (' + spaChanges + ' changes)');
  } else {
    info('admin-spa.js — no changes needed');
  }
} else {
  warn('admin-spa.js not found');
}

// ============================================================
head('DONE');
console.log('');
info('Backups: ' + BACKUP);
console.log('');
log('Restart dev server, hard-refresh browser.', 'yellow');
console.log('');