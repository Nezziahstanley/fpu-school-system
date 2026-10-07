// ============================================================
// apply-batch4.js
// ------------------------------------------------------------
// Fixes:
//   1. settings SPA route → settings/index.html (not _tabs/)
//   2. graduation SPA route → queue.html (not list.html)
//   3. security SPA route → security/dashboard.html
//   4. harden goBack() so it falls back when ?return= is bad
//
// Safe: backup + syntax verify + auto-rollback.
// ============================================================

'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SPA  = path.join(ROOT, 'public', 'js', 'admin-spa.js');
const ADMIN = path.join(ROOT, 'public', 'js', 'admin.js');
const BACKUP = path.join(ROOT, 'backups', 'batch4-' + new Date().toISOString().replace(/[:.]/g, '-'));

function log(m, c) {
  const codes = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', dim: '\x1b[2m', reset: '\x1b[0m' };
  console.log((codes[c] || '') + m + codes.reset);
}
const ok = (m) => log('  ✓ ' + m, 'green');
const info = (m) => log('  · ' + m, 'dim');
const warn = (m) => log('  ⚠ ' + m, 'yellow');
const head = (m) => log('\n' + m, 'cyan');
const err = (m) => log('  ✗ ' + m, 'red');

function read(f) { return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; }
function backup(f) {
  if (!fs.existsSync(f)) return;
  fs.mkdirSync(BACKUP, { recursive: true });
  fs.copyFileSync(f, path.join(BACKUP, path.basename(f)));
}
function verifyJs(src) { try { new Function('window','document','localStorage','fetch','navigator','history','location', src); return true; } catch (e) { err(e.message); return false; } }

head('Batch 4 — SPA route + goBack fixes');
info('Backups: ' + BACKUP);

// ============================================================
// 1. admin-spa.js — fix 3 routes
// ============================================================
head('Step 1 — admin-spa.js route fixes');

let spa = read(SPA);
if (!spa) { err('admin-spa.js not found'); process.exit(1); }
let spaChanges = 0;

// Fix 1: settings → settings/index.html
if (spa.includes("'/admin/partials/settings/_tabs/index.html'")) {
  spa = spa.replace(
    /'settings':\s*\{\s*url:\s*'\/admin\/partials\/settings\/_tabs\/index\.html'/,
    "'settings':         { url: '/admin/partials/settings/index.html'"
  );
  spaChanges++;
  ok('settings → settings/index.html');
} else {
  info('settings route unchanged');
}

// Fix 2: graduation → graduations/queue.html
if (spa.includes("'/admin/partials/graduations/list.html'")) {
  spa = spa.replace(
    /'graduation':\s*\{\s*url:\s*'\/admin\/partials\/graduations\/list\.html'/,
    "'graduation':       { url: '/admin/partials/graduations/queue.html'"
  );
  spaChanges++;
  ok('graduation → graduations/queue.html');
} else {
  info('graduation route unchanged');
}

// Fix 3: security → security/dashboard.html
if (spa.includes("'/admin/partials/security/index.html'")) {
  spa = spa.replace(
    /'security':\s*\{\s*url:\s*'\/admin\/partials\/security\/index\.html'/,
    "'security':         { url: '/admin/partials/security/dashboard.html'"
  );
  spaChanges++;
  ok('security → security/dashboard.html');
} else {
  info('security route unchanged');
}

// Fix 4: also fix the sidebar "Settings" nav entry to point at settings
// (it already does — just confirm).
if (!spa.includes("key: 'settings'")) {
  warn("sidebar doesn't have a settings key — check SPA_NAV manually");
}

if (spaChanges > 0) {
  backup(SPA);
  if (!verifyJs(spa)) { err('syntax broken — not writing'); process.exit(1); }
  fs.writeFileSync(SPA, spa, 'utf8');
  ok('admin-spa.js patched (' + spaChanges + ' changes)');
} else {
  info('admin-spa.js — no changes');
}

// ============================================================
// 2. admin.js — harden goBack()
// ============================================================
head('Step 2 — harden goBack() in admin.js');

let admin = read(ADMIN);
if (!admin) { err('admin.js not found'); process.exit(1); }

if (admin.includes('// batch4: hardened goBack')) {
  info('goBack already hardened');
} else {
  const oldFn = /function goBack\(fallbackPage\s*=\s*'dashboard'\)\s*\{[\s\S]*?\n\}/;
  if (oldFn.test(admin)) {
    admin = admin.replace(oldFn, `function goBack(fallbackPage = 'dashboard') {
  // batch4: hardened goBack — validate before navigating
  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const SPA = window.FPU_ADMIN_SPA;
  const pages = SPA && SPA.SPA_PAGES ? SPA.SPA_PAGES : null;

  function safeNavigate(key) {
    if (!key || !pages || !pages[key]) return false;
    if (SPA && typeof SPA.navigateTo === 'function') {
      SPA.navigateTo(key);
      return true;
    }
    return false;
  }

  // 1) Explicit ?return= / ?back= — only if it maps to a real page
  if (qIdx >= 0) {
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    const ret = params.get('return') || params.get('back');
    if (ret && safeNavigate(ret)) return;
  }

  // 2) Caller-supplied fallback — only if it maps to a real page
  if (safeNavigate(fallbackPage)) return;

  // 3) Last resort: dashboard
  if (fallbackPage !== 'dashboard') safeNavigate('dashboard');
}`);
    backup(ADMIN);
    if (!verifyJs(admin)) { err('syntax broken — not writing'); process.exit(1); }
    fs.writeFileSync(ADMIN, admin, 'utf8');
    ok('goBack() hardened — validates pages before navigating');
  } else {
    warn('could not find goBack() to patch — check manually');
  }
}

// ============================================================
// 3. sanity check — verify the three files exist
// ============================================================
head('Step 3 — sanity check');

const files = [
  'public/admin/partials/settings/index.html',
  'public/admin/partials/graduations/queue.html',
  'public/admin/partials/security/dashboard.html',
  'public/admin/partials/notifications/index.html',
  'public/admin/partials/notifications/compose.html',
];

for (const f of files) {
  const full = path.join(ROOT, f);
  if (fs.existsSync(full)) ok('exists: ' + f);
  else err('MISSING: ' + f);
}

// ============================================================
head('DONE');
console.log('');
info('Backups: ' + BACKUP);
console.log('');
log('Next:', 'yellow');
log('  1. Ctrl+C the dev server, then `npm run dev`', 'yellow');
log('  2. Hard-refresh browser (Ctrl+Shift+R)', 'yellow');
log('  3. Test:', 'yellow');
log('     • Notifications → Compose → Back', 'yellow');
log('     • Graduation page loads the queue', 'yellow');
log('     • Settings loads the tabbed shell', 'yellow');
log('     • Security loads the dashboard', 'yellow');
console.log('');