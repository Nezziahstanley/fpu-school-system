// ============================================================
// apply-batch1.js
// ------------------------------------------------------------
// Applies Batch 1 to admin.js + admin.css safely.
//
// What it does:
//   1. Backs up public/js/admin.js and public/css/admin.css
//   2. Appends notification-dropdown CSS (idempotent — checks marker)
//   3. Inserts four new functions into admin.js just before
//      `window.FPU_ADMIN = {`
//   4. Adds the four export names inside the FPU_ADMIN object
//   5. Reloads are NOT triggered — restart your dev server after
//
// Usage:
//   node apply-batch1.js
//
// Rollback:
//   Copy files back from backups/batch1-<timestamp>/
// ============================================================

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT      = process.cwd();
const ADMIN_JS  = path.join(ROOT, 'public', 'js', 'admin.js');
const ADMIN_CSS = path.join(ROOT, 'public', 'css', 'admin.css');
const BACKUP    = path.join(ROOT, 'backups', 'batch1-' + new Date().toISOString().replace(/[:.]/g, '-'));

const MARKER_JS  = '// ==== FPU Batch 1 additions ====';
const MARKER_CSS = '/* ==== FPU Batch 1 — notification dropdown ==== */';

// ------------------------------------------------------------
// Logging
// ------------------------------------------------------------
function log(msg, color) {
  const codes = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', dim: '\x1b[2m', reset: '\x1b[0m' };
  console.log((codes[color] || '') + msg + codes.reset);
}
function ok(m)   { log('  ✓ ' + m, 'green'); }
function warn(m) { log('  ⚠ ' + m, 'yellow'); }
function err(m)  { log('  ✗ ' + m, 'red'); }
function head(m) { log('\n' + m, 'cyan'); }

// ------------------------------------------------------------
// Safety: read + validate
// ------------------------------------------------------------
function read(file) {
  if (!fs.existsSync(file)) {
    err(`File not found: ${file}`);
    process.exit(1);
  }
  return fs.readFileSync(file, 'utf8');
}

function backup(file) {
  fs.mkdirSync(BACKUP, { recursive: true });
  const dest = path.join(BACKUP, path.basename(file));
  fs.copyFileSync(file, dest);
  ok(`Backed up ${path.basename(file)} → ${dest}`);
}

// ------------------------------------------------------------
// The JS block to insert
// ------------------------------------------------------------
const JS_BLOCK = `
${MARKER_JS}
// ------------------------------------------------------------
// SPA-aware back navigation
// ------------------------------------------------------------
function goBack(fallbackPage = 'dashboard') {
  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  if (qIdx >= 0) {
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    const ret = params.get('return') || params.get('back');
    if (ret && window.FPU_ADMIN_SPA) {
      window.FPU_ADMIN_SPA.loadPage(ret);
      return;
    }
  }
  if (window.FPU_ADMIN_SPA) {
    window.FPU_ADMIN_SPA.navigateTo(fallbackPage);
  }
}

// ------------------------------------------------------------
// Wire staff-role-tabs so clicking a tab re-runs the page loader
// ------------------------------------------------------------
function wireStaffRoleTabs() {
  document.querySelectorAll('.staff-role-tabs').forEach((bar) => {
    if (bar.__fpuWired) return;
    bar.__fpuWired = true;
    bar.addEventListener('click', (e) => {
      const tab = e.target.closest('.staff-role-tab');
      if (!tab || !bar.contains(tab)) return;
      bar.querySelectorAll('.staff-role-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const pageKey = (window.location.hash.replace(/^#/, '').split('?')[0]) || 'dashboard';
      const cfg = window.FPU_ADMIN_SPA && window.FPU_ADMIN_SPA.SPA_PAGES && window.FPU_ADMIN_SPA.SPA_PAGES[pageKey];
      if (cfg && typeof cfg.init === 'function') {
        try { cfg.init(); } catch (err) { console.debug('[tabs] init error:', err.message); }
      }
    });
  });
}

// ------------------------------------------------------------
// Wire generic "select all" checkboxes
// ------------------------------------------------------------
function wireSelectAll() {
  document.querySelectorAll('input[type="checkbox"][id$="-select-all"]').forEach((cb) => {
    if (cb.__fpuWired) return;
    cb.__fpuWired = true;
    const prefix = cb.id.replace(/-select-all$/, '');
    const rowClass = prefix + '-check';
    cb.addEventListener('change', () => {
      document.querySelectorAll('.' + rowClass).forEach((rc) => {
        rc.checked = cb.checked;
      });
    });
  });
}

// ------------------------------------------------------------
// Notification bell dropdown
// ------------------------------------------------------------
async function initNotificationBell() {
  const bell = document.getElementById('topbar-notifications');
  if (!bell || bell.__fpuBellWired) return;
  bell.__fpuBellWired = true;

  let menu = document.getElementById('notif-dropdown');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'notif-dropdown';
    menu.className = 'notif-dropdown';
    menu.hidden = true;
    menu.innerHTML = \`
      <div class="notif-dropdown-head">
        <strong>Notifications</strong>
        <button class="btn btn-ghost btn-sm" id="notif-dropdown-close">×</button>
      </div>
      <div class="notif-dropdown-body" id="notif-dropdown-body">
        <div class="loading"><span class="spinner"></span> Loading…</div>
      </div>
      <div class="notif-dropdown-foot">
        <button class="btn btn-outline btn-sm" id="notif-dropdown-viewall">
          View all →
        </button>
      </div>
    \`;
    bell.parentElement.style.position = 'relative';
    bell.parentElement.appendChild(menu);

    menu.querySelector('#notif-dropdown-close').addEventListener('click', () => {
      menu.hidden = true;
    });
    menu.querySelector('#notif-dropdown-viewall').addEventListener('click', () => {
      menu.hidden = true;
      if (window.FPU_ADMIN_SPA) window.FPU_ADMIN_SPA.navigateTo('notifications');
    });

    document.addEventListener('click', (e) => {
      if (!menu.hidden && !menu.contains(e.target) && !bell.contains(e.target)) {
        menu.hidden = true;
      }
    });
  }

  bell.addEventListener('click', async (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    if (menu.hidden) return;

    const body = menu.querySelector('#notif-dropdown-body');
    body.innerHTML = '<div class="loading"><span class="spinner"></span> Loading…</div>';

    try {
      const res = await adminFetch('/api/admin/notifications');
      const json = await res.json();
      const rows = (json.data || []).slice(0, 8);

      if (!rows.length) {
        body.innerHTML = '<p class="muted" style="padding:16px;">No notifications.</p>';
        return;
      }

      body.innerHTML = rows.map((n) => \`
        <div class="notif-dropdown-item \${n.isRead ? '' : 'unread'}" data-id="\${n.id}">
          <div class="ndi-title">\${escapeHtml(n.title || '')}</div>
          <div class="ndi-body">\${escapeHtml((n.body || '').slice(0, 100))}</div>
          <div class="ndi-time">\${timeAgo(n.createdAt)}</div>
        </div>
      \`).join('');

      body.querySelectorAll('.notif-dropdown-item').forEach((el) => {
        el.addEventListener('click', () => {
          menu.hidden = true;
          if (window.FPU_ADMIN_SPA) {
            window.FPU_ADMIN_SPA.navigateToWithQuery('notification-detail', { id: Number(el.dataset.id) });
          }
        });
      });
    } catch (err) {
      body.innerHTML = \`<div class="alert alert-danger" style="margin:12px;">\${escapeHtml(err.message)}</div>\`;
    }
  });
}

// ------------------------------------------------------------
// Auto-wire everything on load + on SPA navigation
// ------------------------------------------------------------
function wireAllBatch1() {
  wireStaffRoleTabs();
  wireSelectAll();
  initNotificationBell();
}

document.addEventListener('DOMContentLoaded', () => {
  wireAllBatch1();
  const view = document.getElementById('page-view');
  if (view) {
    new MutationObserver(() => wireAllBatch1()).observe(view, { childList: true, subtree: true });
  }
});

window.addEventListener('hashchange', () => {
  setTimeout(wireAllBatch1, 120);
});
// ==== END FPU Batch 1 additions ====
`;

// ------------------------------------------------------------
// The CSS block to append
// ------------------------------------------------------------
const CSS_BLOCK = `
${MARKER_CSS}
.notif-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 320px;
  max-width: 400px;
  max-height: 480px;
  background: #fff;
  border: 1px solid var(--fpu-border);
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.15);
  z-index: 1000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: user-menu-in 0.15s ease;
}
.notif-dropdown[hidden] { display: none; }
.notif-dropdown-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--fpu-border);
  font-family: 'Poppins', sans-serif;
  font-size: 13.5px;
  color: #0f172a;
}
.notif-dropdown-body {
  overflow-y: auto;
  max-height: 380px;
  flex: 1;
}
.notif-dropdown-item {
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.12s ease;
}
.notif-dropdown-item:hover { background: #f8fafc; }
.notif-dropdown-item.unread {
  background: linear-gradient(90deg, #ecfdf5 0%, #fff 60%);
  border-left: 3px solid #10b981;
  padding-left: 13px;
}
.notif-dropdown-item .ndi-title {
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.3;
}
.notif-dropdown-item .ndi-body {
  font-size: 12.5px;
  color: #64748b;
  margin-top: 2px;
  line-height: 1.4;
}
.notif-dropdown-item .ndi-time {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}
.notif-dropdown-foot {
  padding: 10px 16px;
  border-top: 1px solid var(--fpu-border);
  background: #f8fafc;
  text-align: center;
}
.topbar-right { position: relative; }
/* ==== END FPU Batch 1 CSS ==== */
`;

// ------------------------------------------------------------
// Step 1: Backup
// ------------------------------------------------------------
head('Step 1 — Backup');
log('Backup dir: ' + BACKUP, 'dim');
backup(ADMIN_JS);
backup(ADMIN_CSS);

// ------------------------------------------------------------
// Step 2: admin.css — append CSS (idempotent)
// ------------------------------------------------------------
head('Step 2 — admin.css');
let css = read(ADMIN_CSS);
if (css.includes(MARKER_CSS)) {
  warn('CSS marker already present — skipping (already applied)');
} else {
  css = css.trimEnd() + '\n' + CSS_BLOCK + '\n';
  fs.writeFileSync(ADMIN_CSS, css, 'utf8');
  ok('Appended notification-dropdown CSS');
}

// ------------------------------------------------------------
// Step 3: admin.js — insert JS block
// ------------------------------------------------------------
head('Step 3 — admin.js functions');
let js = read(ADMIN_JS);

if (js.includes(MARKER_JS)) {
  warn('JS marker already present — skipping function insertion');
} else {
  const marker = 'window.FPU_ADMIN = {';
  const idx = js.indexOf(marker);
  if (idx === -1) {
    err('Could not find `window.FPU_ADMIN = {` in admin.js');
    err('Aborting — file is unchanged.');
    process.exit(1);
  }

  // Insert the JS block right before the export object
  const before = js.slice(0, idx);
  const after  = js.slice(idx);
  js = before + JS_BLOCK + '\n' + after;
  ok('Inserted 4 new functions above the FPU_ADMIN export');
}

// ------------------------------------------------------------
// Step 4: admin.js — add exports to the FPU_ADMIN object
// ------------------------------------------------------------
head('Step 4 — admin.js exports');

const exportNames = ['goBack', 'wireStaffRoleTabs', 'wireSelectAll', 'initNotificationBell'];
const alreadyExported = [];
const toAdd = [];

// Look for the export object
const exportStart = js.indexOf('window.FPU_ADMIN = {');
if (exportStart === -1) {
  err('FPU_ADMIN export object not found — cannot add names.');
  process.exit(1);
}

// Find the matching closing brace of the export object.
// Walk forward from exportStart, tracking depth.
let depth = 0;
let exportEnd = -1;
for (let i = exportStart; i < js.length; i++) {
  const ch = js[i];
  if (ch === '{') depth++;
  else if (ch === '}') {
    depth--;
    if (depth === 0) { exportEnd = i; break; }
  }
}

if (exportEnd === -1) {
  err('Could not find closing brace of FPU_ADMIN export object.');
  process.exit(1);
}

const exportBody = js.slice(exportStart, exportEnd);

// Check which names are already present
for (const name of exportNames) {
  // Match e.g. "goBack," or "goBack:" at start of a line (with optional spaces)
  const re = new RegExp(`(^|\\s)${name}\\s*[,:]`, 'm');
  if (re.test(exportBody)) alreadyExported.push(name);
  else toAdd.push(name);
}

if (alreadyExported.length) {
  warn('Already exported: ' + alreadyExported.join(', '));
}

if (toAdd.length) {
  // Insert just before the closing brace
  // Find the last non-whitespace character position before exportEnd
  let insertAt = exportEnd;
  while (insertAt > exportStart && /\s/.test(js[insertAt - 1])) insertAt--;

  // Detect indentation used in the file (2 or 4 spaces)
  const indentMatch = exportBody.match(/\n(\s+)\S/);
  const indent = indentMatch ? indentMatch[1] : '  ';

  const injection =
    '\n' + indent + '// Batch 1 additions\n' +
    toAdd.map((n) => indent + n + ',').join('\n');

  js = js.slice(0, insertAt) + injection + js.slice(insertAt);
  ok('Added exports: ' + toAdd.join(', '));
} else {
  warn('All 4 names already exported — nothing to do');
}

fs.writeFileSync(ADMIN_JS, js, 'utf8');
ok('admin.js updated');

// ------------------------------------------------------------
// Step 5: Verify by re-parsing
// ------------------------------------------------------------
head('Step 5 — Verify');
try {
  // Basic syntax check: require the file in a sandbox with stubs.
  // We don't want to actually run it, so we just use new Function.
  // If SyntaxError, we roll back.
  new Function('window', 'document', 'localStorage', 'fetch', 'navigator', js);
  ok('admin.js parses cleanly');
} catch (e) {
  err('Syntax error introduced: ' + e.message);
  err('Rolling back admin.js from backup...');
  fs.copyFileSync(path.join(BACKUP, 'admin.js'), ADMIN_JS);
  err('Rolled back. Your original admin.js is restored.');
  process.exit(1);
}

// ------------------------------------------------------------
// Done
// ------------------------------------------------------------
head('DONE');
console.log('');
log('  Backups: ' + BACKUP, 'dim');
console.log('');
log('  Next: restart the dev server (Ctrl+C in the npm window, then `npm run dev`).', 'yellow');
log('  The 4 new functions are now live in admin.js:', 'dim');
log('    • goBack(fallback)             — SPA-aware back nav', 'dim');
log('    • wireStaffRoleTabs()          — tab bar click handling', 'dim');
log('    • wireSelectAll()              — select-all checkboxes', 'dim');
log('    • initNotificationBell()       — topbar bell dropdown', 'dim');
console.log('');
log('  They run automatically on DOMContentLoaded + on every SPA navigation.', 'dim');
console.log('');