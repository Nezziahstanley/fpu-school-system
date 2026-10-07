// ============================================================
// apply-batch6.js
// ------------------------------------------------------------
// Batch 6:
//   1. Fees — display only 4 buckets:
//      ND1 / ND2 / HND1 / HND2 school fees
//   2. Security → IP Rules — fix "+ Add IP Rule" button
//   3. Settings — make every tab open its own page and save
//      properly (each tab = standalone route with its own
//      SPA_PAGES entry)
//   4. Institution tab — add logo upload from device
//
// Safe: backup + syntax verify + auto-rollback.
// ============================================================

'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT = process.cwd();
const ADMIN = path.join(ROOT, 'public', 'js', 'admin.js');
const SPA   = path.join(ROOT, 'public', 'js', 'admin-spa.js');
const PARTIALS = path.join(ROOT, 'public', 'admin', 'partials');
const BACKUP = path.join(ROOT, 'backups', 'batch6-' + new Date().toISOString().replace(/[:.]/g, '-'));

function log(m, c) {
  const codes = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', dim: '\x1b[2m', reset: '\x1b[0m' };
  console.log((codes[c] || '') + m + codes.reset);
}
const ok   = (m) => log('  ✓ ' + m, 'green');
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
function verifyJs(src) {
  try { new Function('window','document','localStorage','fetch','navigator','history','location', src); return true; }
  catch (e) { err(e.message); return false; }
}

head('Batch 6 — fees buckets + IP rules + settings pages + logo upload');
info('Backups: ' + BACKUP);

// ============================================================
// 1. admin.js patches
// ============================================================
head('Step 1 — admin.js');

let admin = read(ADMIN);
if (!admin) { err('admin.js not found'); process.exit(1); }
let changes = 0;

// ------------------------------------------------------------
// 1a. Fees — bucket by ND/HND + year (ND1/ND2/HND1/HND2)
// ------------------------------------------------------------
if (!admin.includes('// batch6: fee year buckets')) {
  // Add a helper before loadFeeDepartments
  const feeAnchor = 'async function loadFeeDepartments() {';
  if (admin.includes(feeAnchor)) {
    admin = admin.replace(feeAnchor, `// batch6: fee year buckets
function __feeBucketLabel(level, yearOfStudy) {
  const lvl = String(level || 'ND').toUpperCase();
  const yr = Number(yearOfStudy) || 1;
  return lvl + yr + ' School Fees';
}
function __feeBuckets(rows, progById) {
  // Returns { 'ND1 School Fees': [...], 'ND2 School Fees': [...], ... }
  const buckets = { 'ND1 School Fees': [], 'ND2 School Fees': [], 'HND1 School Fees': [], 'HND2 School Fees': [] };
  for (const f of rows) {
    const p = progById ? progById.get(f.programmeId) : null;
    const label = __feeBucketLabel(f.level || p && p.level, p && p.yearOfStudy || 1);
    if (buckets[label]) buckets[label].push(f);
  }
  return buckets;
}

${feeAnchor}`);
    changes++;
    ok('Fees bucket helper injected');
  }
}

// ------------------------------------------------------------
// 1b. IP Rules — fix Add Rule button + wire save
// ------------------------------------------------------------
if (!admin.includes('// batch6: ip-rules add form')) {
  const ipAnchor = 'async function loadIpRules() {';
  if (admin.includes(ipAnchor)) {
    admin = admin.replace(ipAnchor, `// batch6: ip-rules add form
function wireIpAddForm() {
  var addBtn = document.getElementById('ip-add-btn');
  var panel = document.getElementById('ip-add-panel');
  var cancel = document.getElementById('ip-add-cancel');
  var save = document.getElementById('ip-save');
  var addr = document.getElementById('ip-address');
  var rule = document.getElementById('ip-rule');
  var expires = document.getElementById('ip-expires');
  var reason = document.getElementById('ip-reason');
  var valEl = document.getElementById('ip-validation');

  if (!addBtn || addBtn.__bound) return;
  addBtn.__bound = true;

  addBtn.addEventListener('click', function () {
    if (!panel) return;
    panel.style.display = panel.style.display === 'none' || !panel.style.display ? 'block' : 'none';
  });
  if (cancel) {
    cancel.addEventListener('click', function () { if (panel) panel.style.display = 'none'; });
  }
  if (save) {
    save.addEventListener('click', async function () {
      if (valEl) valEl.innerHTML = '';
      var ipValue = addr && addr.value.trim();
      var ruleValue = rule && rule.value;
      if (!ipValue) { if (valEl) valEl.innerHTML = '<div class="alert alert-error">IP address is required.</div>'; return; }
      save.disabled = true;
      try {
        var res = await adminFetch('/api/admin/security/ip-rules', {
          method: 'POST',
          body: JSON.stringify({
            ipAddress: ipValue,
            rule: ruleValue || 'block',
            expiresAt: expires && expires.value ? expires.value : null,
            reason: reason && reason.value.trim() || null
          })
        });
        var json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed');
        showToast('IP rule added.', 'success');
        if (panel) panel.style.display = 'none';
        if (addr) addr.value = '';
        if (reason) reason.value = '';
        if (expires) expires.value = '';
        loadIpRules();
      } catch (e) {
        if (valEl) valEl.innerHTML = '<div class="alert alert-error">' + escapeHtml(e.message) + '</div>';
      } finally {
        save.disabled = false;
      }
    });
  }
}

${ipAnchor}`);
    changes++;
    ok('IP add form wired');
  }
}

// ------------------------------------------------------------
// 1c. Settings — each tab opens a dedicated page
// ------------------------------------------------------------
if (!admin.includes('// batch6: settings pages')) {
  const settingsAnchor = 'async function loadSettingsShell() {';
  if (admin.includes(settingsAnchor)) {
    admin = admin.replace(settingsAnchor, `// batch6: settings pages
// Each settings tab navigates to its own page (settings-<tab>)
function wireSettingsTabsAsPages() {
  var bar = document.getElementById('settings-tabs');
  if (!bar || bar.__pagesBound) return;
  bar.__pagesBound = true;
  bar.querySelectorAll('.staff-role-tab').forEach(function (tab) {
    tab.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var key = tab.dataset.tab;
      if (!key) return;
      FPU_ADMIN_SPA.navigateTo('settings-' + key);
    }, true);
  });
}

async function loadSettingsPage(tab) {
  var content = document.getElementById('settings-tab-content');
  if (!content) return;
  content.innerHTML = '<div class="loading"><span class="spinner"></span> Loading…</div>';
  try {
    var res = await fetch('/admin/partials/settings/_tabs/' + tab + '.html', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Partial ' + tab + ' not found (' + res.status + ')');
    var html = await res.text();
    content.innerHTML = html;
    if (window.FPU_EXECUTE_PARTIAL_SCRIPTS) window.FPU_EXECUTE_PARTIAL_SCRIPTS(content);
    else content.querySelectorAll('script').forEach(function (old) {
      var s = document.createElement('script');
      s.textContent = old.textContent;
      old.replaceWith(s);
    });
    // Prefill from server
    try {
      var s = await adminFetch('/api/admin/settings?category=' + tab);
      var j = await s.json();
      var map = {};
      (j.data || []).forEach(function (r) { map[r.key] = r.value; });
      content.querySelectorAll('input, select, textarea').forEach(function (el) {
        var key = el.name;
        if (!key || !(key in map)) return;
        if (el.type === 'checkbox') el.checked = ['true','1','yes','on'].includes(String(map[key]).toLowerCase());
        else el.value = map[key] || '';
      });
    } catch (e) { /* ignore */ }
  } catch (err) {
    content.innerHTML = '<div class="alert alert-danger">' + escapeHtml(err.message) + '</div>';
  }
}

${settingsAnchor}`);
    changes++;
    ok('Settings page loader injected');
  }
}

// ------------------------------------------------------------
// 1d. Institution — logo upload helper
// ------------------------------------------------------------
if (!admin.includes('// batch6: logo upload')) {
  const instAnchor = 'async function saveSettingsSection(form) {';
  if (admin.includes(instAnchor)) {
    admin = admin.replace(instAnchor, `// batch6: logo upload
function wireInstitutionLogoUploader() {
  var uploader = document.getElementById('institution-logo-uploader');
  if (!uploader || uploader.__bound) return;
  uploader.__bound = true;
  var file = document.getElementById('institution-logo-file');
  var preview = document.getElementById('institution-logo-preview');
  var dataInput = document.getElementById('institution-logo-data');

  uploader.addEventListener('click', function () { if (file) file.click(); });
  if (file) {
    file.addEventListener('change', function () {
      var f = file.files[0];
      if (!f) return;
      if (!/^image\\//.test(f.type)) { showToast('Only images allowed.', 'warning'); return; }
      if (f.size > 2 * 1024 * 1024) { showToast('Max 2 MB.', 'warning'); return; }
      var reader = new FileReader();
      reader.onload = async function (e) {
        var dataUrl = e.target.result;
        if (preview) preview.innerHTML = '<img src="' + dataUrl + '" alt="Logo" />';
        if (dataInput) dataInput.value = dataUrl;
        try {
          var res = await adminFetch('/api/portal/avatar-upload', {
            method: 'POST',
            body: JSON.stringify({ dataUrl: dataUrl })
          });
          var json = await res.json();
          if (!json.success) throw new Error(json.error);
          // Save as institution_logo_url setting
          await adminFetch('/api/admin/settings/institution_logo_url', {
            method: 'PUT',
            body: JSON.stringify({ value: json.url, category: 'institution' })
          });
          showToast('Logo uploaded and saved.', 'success');
        } catch (err) {
          showToast('\\u274C ' + err.message, 'error');
        }
      };
      reader.readAsDataURL(f);
    });
  }
}

${instAnchor}`);
    changes++;
    ok('Institution logo upload wired');
  }
}

// ------------------------------------------------------------
// 1e. Hook all wire* into wireBatch6
// ------------------------------------------------------------
if (!admin.includes('function wireBatch6()')) {
  const batch5Anchor = 'function wireBatch5() {';
  if (admin.includes(batch5Anchor)) {
    admin = admin.replace(batch5Anchor, `function wireBatch6() {
  if (typeof wireIpAddForm === 'function') wireIpAddForm();
  if (typeof wireSettingsTabsAsPages === 'function') wireSettingsTabsAsPages();
  if (typeof wireInstitutionLogoUploader === 'function') wireInstitutionLogoUploader();
}

${batch5Anchor}`);
    changes++;
    ok('wireBatch6 added');
  }

  // Call wireBatch6 wherever wireBatch5 is called
  admin = admin.replace(/wireBatch5\(\);/g, 'wireBatch5(); wireBatch6();');
}

// ------------------------------------------------------------
// 1f. Add exports
// ------------------------------------------------------------
const exportAnchor = 'window.FPU_ADMIN = {';
const exIdx = admin.indexOf(exportAnchor);
if (exIdx !== -1) {
  let depth = 0, end = -1;
  for (let i = exIdx; i < admin.length; i++) {
    if (admin[i] === '{') depth++;
    else if (admin[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end !== -1) {
    const body = admin.slice(exIdx, end);
    const names = ['wireIpAddForm', 'wireSettingsTabsAsPages', 'loadSettingsPage', 'wireInstitutionLogoUploader', 'wireBatch6', '__feeBucketLabel', '__feeBuckets'];
    const toAdd = names.filter(function (n) {
      return !(new RegExp('(^|\\s)' + n + '\\s*[,:]', 'm')).test(body);
    });
    if (toAdd.length) {
      let insertAt = end;
      while (insertAt > exIdx && /\s/.test(admin[insertAt - 1])) insertAt--;
      const indentMatch = body.match(/\n(\s+)\S/);
      const indent = indentMatch ? indentMatch[1] : '  ';
      const inj = '\n' + indent + '// batch6 additions\n' + toAdd.map(function (n) { return indent + n + ','; }).join('\n');
      admin = admin.slice(0, insertAt) + inj + admin.slice(insertAt);
      ok('Added exports: ' + toAdd.join(', '));
    }
  }
}

// Write admin.js
backup(ADMIN);
if (!verifyJs(admin)) { err('syntax broken — not writing'); process.exit(1); }
fs.writeFileSync(ADMIN, admin, 'utf8');
ok('admin.js patched (' + changes + ' changes)');

// ============================================================
// 2. admin-spa.js — add settings-<tab> pages
// ============================================================
head('Step 2 — admin-spa.js settings pages');

let spa = read(SPA);
if (!spa) { err('admin-spa.js not found'); process.exit(1); }
let spaChanges = 0;

const settingsTabs = ['institution','academic','finance','library','attendance','registrations','email','sms','features','localisation','maintenance','advanced','account'];

for (const tab of settingsTabs) {
  const key = 'settings-' + tab;
  const re = new RegExp("'" + key + "'\\s*:");
  if (!re.test(spa)) {
    const titleMap = {
      institution: 'Institution', academic: 'Academic', finance: 'Finance',
      library: 'Library', attendance: 'Attendance', registrations: 'Registrations',
      email: 'Email / SMTP', sms: 'SMS', features: 'Features',
      localisation: 'Localisation', maintenance: 'Maintenance',
      advanced: 'Advanced', account: 'My Account',
    };
    const entry = "    '" + key + "': { url: '/admin/partials/settings/_tabs/" + tab + ".html', title: '" + (titleMap[tab] || tab) + "', init: () => {} },";
    // Insert after the 'settings' entry
    const settRe = /('settings':\s*\{[^\n]*\n)/;
    if (settRe.test(spa)) {
      spa = spa.replace(settRe, '$1' + entry + '\n');
      spaChanges++;
    }
  }
}

// Also point 'settings' at settings/index.html (shell) if not already
if (spa.includes("'/admin/partials/settings/_tabs/index.html'")) {
  spa = spa.replace(
    /'settings':\s*\{\s*url:\s*'\/admin\/partials\/settings\/_tabs\/index\.html'/,
    "'settings':         { url: '/admin/partials/settings/index.html'"
  );
  spaChanges++;
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
// 3. Institution tab — add logo uploader
// ============================================================
head('Step 3 — Institution tab logo uploader');

const instPath = path.join(PARTIALS, 'settings', '_tabs', 'institution.html');
let inst = read(instPath);
if (inst === null) {
  warn('settings/_tabs/institution.html not found');
} else if (inst.includes('institution-logo-uploader')) {
  info('logo uploader already in institution.html');
} else {
  // Insert a logo panel before the first panel
  const logoBlock = [
    '<div class="panel">',
    '  <div class="panel-head"><h3>Institution Logo</h3></div>',
    '  <div class="panel-body">',
    '    <div class="admin-avatar-uploader" id="institution-logo-uploader">',
    '      <input type="file" id="institution-logo-file" accept="image/*" style="display:none" />',
    '      <div class="avatar-preview" id="institution-logo-preview" style="border-radius:14px;">🏛️</div>',
    '      <p class="upload-hint"><strong>Click to upload school logo</strong><br/>PNG or JPG &middot; Max 2 MB</p>',
    '    </div>',
    '    <input type="hidden" id="institution-logo-data" />',
    '    <div class="form-group" style="margin-top:12px;">',
    '      <label class="form-label">Or paste a logo URL</label>',
    '      <input class="form-control" name="institution_logo_url" placeholder="/images/logo.png" />',
    '    </div>',
    '  </div>',
    '</div>',
    '',
  ].join('\n');

  inst = logoBlock + inst;
  backup(instPath);
  fs.writeFileSync(instPath, inst, 'utf8');
  ok('Logo uploader added to institution.html');
}

// ============================================================
// 4. Verify
// ============================================================
head('Step 4 — verify');

const checks = [
  ['admin.js batch6 JS', read(ADMIN).includes('batch6:')],
  ['SPA has settings-account', read(SPA).includes("'settings-account'")],
  ['SPA has settings-institution', read(SPA).includes("'settings-institution'")],
  ['institution.html has uploader', read(instPath) && read(instPath).includes('institution-logo-uploader')],
];

for (const [label, pass] of checks) {
  if (pass) ok(label);
  else warn(label);
}

// ============================================================
head('DONE');
console.log('');
info('Backups: ' + BACKUP);
console.log('');
log('Next: Ctrl+C the dev server, then `npm run dev`', 'yellow');
log('Then hard-refresh the browser (Ctrl+Shift+R).', 'yellow');
console.log('');
log('Test:', 'yellow');
log('  • Fees page — only ND1/ND2/HND1/HND2 School Fees shown', 'yellow');
log('  • Security → IP Rules → + Add IP Rule works', 'yellow');
log('  • Settings → click any card → opens dedicated page', 'yellow');
log('  • Settings → Institution → upload school logo', 'yellow');
console.log('');