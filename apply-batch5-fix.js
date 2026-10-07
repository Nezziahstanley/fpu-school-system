// ============================================================
// apply-batch5-fix.js
// ------------------------------------------------------------
// Rewrites the Batch 5 admin.js injection without nested
// template literals. CSS is already applied by the failed run,
// so this only handles the JS.
// ============================================================

'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT   = process.cwd();
const ADMIN  = path.join(ROOT, 'public', 'js', 'admin.js');
const BACKUP = path.join(ROOT, 'backups', 'batch5-fix-' + new Date().toISOString().replace(/[:.]/g, '-'));

function log(m, c) {
  const codes = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', dim: '\x1b[2m', reset: '\x1b[0m' };
  console.log((codes[c] || '') + m + codes.reset);
}
const ok = (m) => log('  ✓ ' + m, 'green');
const info = (m) => log('  · ' + m, 'dim');
const warn = (m) => log('  ⚠ ' + m, 'yellow');
const head = (m) => log('\n' + m, 'cyan');
const err  = (m) => log('  ✗ ' + m, 'red');

function read(f) { return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; }
function backup(f) {
  if (!fs.existsSync(f)) return;
  fs.mkdirSync(BACKUP, { recursive: true });
  fs.copyFileSync(f, path.join(BACKUP, path.basename(f)));
}

head('Batch 5 fix — re-inject admin.js JS (safe)');
info('Backups: ' + BACKUP);

const JS_MARKER = '// ==== FPU Batch 5 additions ====';

// Build the JS to inject using ONLY string concatenation.
// No backticks, no ${}. The outer script writes it as one big array-join.
const JS_LINES = [
  '',
  JS_MARKER,
  '',
  '// ------------------------------------------------------------',
  '// Settings tabs — render with structured icon + label + sub-label',
  '// ------------------------------------------------------------',
  'function enhanceSettingsTabs() {',
  '  var bar = document.getElementById("settings-tabs");',
  '  if (!bar || bar.__fpuEnhanced) return;',
  '  bar.__fpuEnhanced = true;',
  '',
  '  var LABELS = {',
  '    institution:   { icon: "\uD83C\uDFDB\uFE0F", label: "Institution",  sub: "Identity & branding" },',
  '    academic:      { icon: "\uD83C\uDF93", label: "Academic",     sub: "Session & rules" },',
  '    finance:       { icon: "\uD83D\uDCB0", label: "Finance",      sub: "Fees & currency" },',
  '    library:       { icon: "\uD83D\uDCDA", label: "Library",      sub: "Borrowing & fines" },',
  '    attendance:    { icon: "\uD83D\uDCCB", label: "Attendance",   sub: "Rules & thresholds" },',
  '    registrations: { icon: "\uD83D\uDCDD", label: "Registrations",sub: "Windows & limits" },',
  '    email:         { icon: "\uD83D\uDCE7", label: "Email / SMTP", sub: "Outgoing mail" },',
  '    sms:           { icon: "\uD83D\uDCAC", label: "SMS",          sub: "Provider config" },',
  '    features:      { icon: "\uD83C\uDF9B\uFE0F", label: "Features",     sub: "Toggle modules" },',
  '    localisation:  { icon: "\uD83C\uDF0D", label: "Localisation", sub: "Time, date, region" },',
  '    maintenance:   { icon: "\uD83D\uDEA7", label: "Maintenance",  sub: "Downtime control" },',
  '    advanced:      { icon: "\u2699\uFE0F", label: "Advanced",     sub: "Raw settings" },',
  '    account:       { icon: "\uD83D\uDC64", label: "My Account",   sub: "Password & photo" }',
  '  };',
  '',
  '  var tabs = bar.querySelectorAll(".staff-role-tab");',
  '  for (var i = 0; i < tabs.length; i++) {',
  '    var tab = tabs[i];',
  '    var key = tab.dataset.tab;',
  '    var meta = LABELS[key];',
  '    if (!meta) continue;',
  '    if (tab.querySelector(".tab-label")) continue;',
  '',
  '    var count = tab.querySelector(".tab-count");',
  '    var countHTML = count ? count.outerHTML : "";',
  '',
  '    tab.innerHTML =',
  '      \'<div style="font-size:1.4rem;line-height:1;margin-bottom:2px;">\' + meta.icon + \'</div>\' +',
  '      \'<div class="tab-label">\' + meta.label + \'</div>\' +',
  '      \'<div style="font-size:11px;color:#94a3b8;font-weight:500;">\' + meta.sub + \'</div>\' +',
  '      countHTML;',
  '  }',
  '}',
  '',
  '// ------------------------------------------------------------',
  '// Admin avatar uploader — used in users/form.html and users/admins',
  '// ------------------------------------------------------------',
  'function wireAdminAvatarUploader() {',
  '  var uploader = document.getElementById("admin-avatar-uploader");',
  '  var file = document.getElementById("admin-avatar-file");',
  '  var preview = document.getElementById("admin-avatar-preview");',
  '  var dataInput = document.getElementById("admin-avatar-data");',
  '',
  '  if (!uploader || uploader.__bound) return;',
  '  uploader.__bound = true;',
  '',
  '  uploader.addEventListener("click", function () { if (file) file.click(); });',
  '',
  '  if (file) {',
  '    file.addEventListener("change", function () {',
  '      var f = file.files[0];',
  '      if (!f) return;',
  '      if (!/^image\\//.test(f.type)) {',
  '        showToast("Please select an image file.", "warning");',
  '        file.value = "";',
  '        return;',
  '      }',
  '      if (f.size > 5 * 1024 * 1024) {',
  '        showToast("File is too large. Maximum 5 MB.", "warning");',
  '        file.value = "";',
  '        return;',
  '      }',
  '      var reader = new FileReader();',
  '      reader.onload = function (e) {',
  '        var dataUrl = e.target.result;',
  '        if (preview) preview.innerHTML = \'<img src="\' + dataUrl + \'" alt="Avatar" />\';',
  '        uploader.classList.add("has-image");',
  '        if (dataInput) dataInput.value = dataUrl;',
  '      };',
  '      reader.readAsDataURL(f);',
  '    });',
  '  }',
  '}',
  '',
  '// ------------------------------------------------------------',
  '// Apply admin avatar to topbar and cache',
  '// ------------------------------------------------------------',
  'function applyAdminAvatar(url) {',
  '  if (!url) return;',
  '  var topbar = document.getElementById("topbar-avatar");',
  '  if (topbar) topbar.innerHTML = \'<img src="\' + escapeHtml(url) + \'" alt="" />\';',
  '  var um = document.getElementById("user-menu-avatar");',
  '  if (um) um.innerHTML = \'<img src="\' + escapeHtml(url) + \'" alt="" />\';',
  '}',
  '',
  '// ------------------------------------------------------------',
  '// Batch 5 auto-wiring',
  '// ------------------------------------------------------------',
  'function wireBatch5() {',
  '  enhanceSettingsTabs();',
  '  wireAdminAvatarUploader();',
  '}',
  '',
  'document.addEventListener("DOMContentLoaded", function () {',
  '  wireBatch5();',
  '  var view = document.getElementById("page-view");',
  '  if (view) new MutationObserver(function () { wireBatch5(); }).observe(view, { childList: true, subtree: true });',
  '});',
  '',
  'window.addEventListener("hashchange", function () { setTimeout(wireBatch5, 120); });',
  '',
  '// ==== END FPU Batch 5 additions ====',
  '',
].join('\n');

let adminJs = read(ADMIN);
if (!adminJs) { err('admin.js not found'); process.exit(1); }

if (adminJs.includes(JS_MARKER)) {
  info('Batch 5 JS already present — nothing to do');
  process.exit(0);
}

const anchor = 'window.FPU_ADMIN = {';
const idx = adminJs.indexOf(anchor);
if (idx === -1) { err('Cannot find FPU_ADMIN export in admin.js'); process.exit(1); }

// Insert JS before the export
adminJs = adminJs.slice(0, idx) + JS_LINES + '\n' + adminJs.slice(idx);

// Add exports
const exportNames = ['enhanceSettingsTabs', 'wireAdminAvatarUploader', 'applyAdminAvatar', 'wireBatch5'];

// Find matching closing brace of the export object
let depth = 0, end = -1;
const exportStart = adminJs.indexOf(anchor);
for (let i = exportStart; i < adminJs.length; i++) {
  if (adminJs[i] === '{') depth++;
  else if (adminJs[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
}

if (end !== -1) {
  const body = adminJs.slice(exportStart, end);
  const toAdd = exportNames.filter(function (n) {
    return !(new RegExp('(^|\\s)' + n + '\\s*[,:]', 'm')).test(body);
  });
  if (toAdd.length) {
    let insertAt = end;
    while (insertAt > exportStart && /\s/.test(adminJs[insertAt - 1])) insertAt--;
    const indentMatch = body.match(/\n(\s+)\S/);
    const indent = indentMatch ? indentMatch[1] : '  ';
    const inj = '\n' + indent + '// Batch 5 additions\n' + toAdd.map(function (n) { return indent + n + ','; }).join('\n');
    adminJs = adminJs.slice(0, insertAt) + inj + adminJs.slice(insertAt);
    ok('Added exports: ' + toAdd.join(', '));
  }
}

// Syntax check
try {
  new Function('window', 'document', 'localStorage', 'fetch', 'navigator', 'history', 'location', adminJs);
  ok('admin.js parses cleanly');
} catch (e) {
  err('syntax error: ' + e.message);
  err('file NOT modified');
  process.exit(1);
}

backup(ADMIN);
fs.writeFileSync(ADMIN, adminJs, 'utf8');
ok('admin.js patched');

head('DONE');
console.log('');
info('Backups: ' + BACKUP);
console.log('');
log('Next: Ctrl+C the dev server, then `npm run dev`', 'yellow');
console.log('');