// ============================================================
// apply-batch7b.js
// ------------------------------------------------------------
// Fixed version of apply-batch7.js. Every injected function
// that uses `await` is declared `async`, no top-level awaits.
// ============================================================

'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT = process.cwd();
const ADMIN = path.join(ROOT, 'public', 'js', 'admin.js');
const PARTIALS = path.join(ROOT, 'public', 'admin', 'partials');
const BACKUP = path.join(ROOT, 'backups', 'batch7b-' + new Date().toISOString().replace(/[:.]/g, '-'));

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

head('Batch 7b — fixed injection');
info('Backups: ' + BACKUP);

let admin = read(ADMIN);
if (!admin) { err('admin.js not found'); process.exit(1); }
let changes = 0;

// Idempotency guard: if batch7b already applied, skip
if (admin.includes('// batch7b: applied')) {
  info('Batch 7b already applied — skipping');
  process.exit(0);
}

// ============================================================
// Helper: insert a function before a known anchor, using only
// string-safe joins. All async functions are explicitly async.
// ============================================================

function insertBefore(src, anchor, block) {
  const idx = src.indexOf(anchor);
  if (idx === -1) { warn('anchor not found: ' + anchor); return src; }
  return src.slice(0, idx) + block + '\n' + src.slice(idx);
}

// ------------------------------------------------------------
// 1. IP refresh — non-async, no awaits
// ------------------------------------------------------------
const IP_REFRESH = [
  '// batch7b: applied — IP refresh',
  'function wireIpRefresh() {',
  '  var refresh = null;',
  '  var btns = document.querySelectorAll(".page-head .actions button");',
  '  for (var i = 0; i < btns.length; i++) {',
  '    var t = (btns[i].textContent || "").trim().toLowerCase();',
  '    if (t.indexOf("refresh") !== -1) { refresh = btns[i]; break; }',
  '  }',
  '  if (refresh && !refresh.__bound) {',
  '    refresh.__bound = true;',
  '    refresh.addEventListener("click", function () {',
  '      if (typeof loadIpRules === "function") loadIpRules();',
  '    });',
  '  }',
  '}',
  '',
].join('\n');

if (!admin.includes('function wireIpRefresh')) {
  admin = insertBefore(admin, 'function wireIpAddForm() {', IP_REFRESH);
  changes++;
  ok('wireIpRefresh added');
}

// ------------------------------------------------------------
// 2. Fees buckets — async, always awaits inside async
// ------------------------------------------------------------
const FEE_BUCKETS = [
  '// batch7b: fees bucket renderer',
  'function __feeBucketLabel(level, yearOfStudy) {',
  '  var lvl = String(level || "ND").toUpperCase();',
  '  var yr = Number(yearOfStudy) || 1;',
  '  return lvl + yr + " School Fees";',
  '}',
  '',
  'async function __renderFeeBuckets() {',
  '  var grid = document.getElementById("fees-dept-grid");',
  '  if (!grid) return;',
  '  if (grid.dataset.bucketed === "1") return;',
  '  try {',
  '    var feesRes = await adminFetch("/api/admin/fees");',
  '    var progsRes = await adminFetch("/api/admin/programmes");',
  '    var fees = (await feesRes.json()).data || [];',
  '    var progs = (await progsRes.json()).data || [];',
  '    var progById = new Map(progs.map(function (p) { return [p.id, p]; }));',
  '',
  '    var buckets = { "ND1 School Fees": [], "ND2 School Fees": [], "HND1 School Fees": [], "HND2 School Fees": [] };',
  '    fees.forEach(function (f) {',
  '      var p = progById.get(f.programmeId);',
  '      var lvl = String(f.level || (p && p.level) || "ND").toUpperCase();',
  '      var yr = Number(p && p.yearOfStudy) || 1;',
  '      var key = lvl + yr + " School Fees";',
  '      if (buckets[key]) buckets[key].push({ f: f, p: p });',
  '    });',
  '',
  '    var html = "";',
  '    Object.keys(buckets).forEach(function (label) {',
  '      var items = buckets[label];',
  '      html += \'<div style="grid-column:1/-1; margin-top:12px;">\';',
  '      html += \'<h3 style="font-family:Poppins,sans-serif; font-size:14px; color:#065f46; margin:8px 0; padding:8px 14px; background:#ecfdf5; border-radius:8px;">\';',
  '      html += label + \' <span style="color:#64748b; font-weight:400; font-size:12.5px;">(\' + items.length + \' structure\' + (items.length === 1 ? "" : "s") + \')</span>\';',
  '      html += \'</h3></div>\';',
  '',
  '      if (!items.length) {',
  '        html += \'<div class="empty-state" style="grid-column:1/-1; padding:12px;"><p class="muted">No fee structure</p></div>\';',
  '        return;',
  '      }',
  '',
  '      items.forEach(function (it) {',
  '        var f = it.f;',
  '        html += \'<div class="fee-card" onclick="FPU_ADMIN_SPA.navigateToWithQuery(\\\'fee-form\\\', { id: \' + f.id + \' })">\';',
  '        html += \'<div class="fc-head"><span class="fc-code">\' + escapeHtml((it.p && it.p.code) || "") + \'</span><span class="fc-level \' + (f.level || "nd").toLowerCase() + \'">\' + escapeHtml(f.level || "") + \'</span></div>\';',
  '        html += \'<h3>\' + escapeHtml((it.p && it.p.name) || "") + \'</h3>\';',
  '        html += \'<div class="fc-total"><span class="num">\' + money(f.total) + \'</span><span class="label">total fee</span></div>\';',
  '        html += \'<div class="fc-breakdown">\';',
  '        html += \'<div class="item"><span class="k">Tuition</span><span class="v">\' + money(f.tuition) + \'</span></div>\';',
  '        html += \'<div class="item"><span class="k">Acceptance</span><span class="v">\' + money(f.acceptance) + \'</span></div>\';',
  '        html += \'<div class="item"><span class="k">Medical</span><span class="v">\' + money(f.medical) + \'</span></div>\';',
  '        html += \'<div class="item"><span class="k">Library</span><span class="v">\' + money(f.library) + \'</span></div>\';',
  '        html += \'</div>\';',
  '        html += \'<div class="fc-footer"><span>\' + (f.isActive !== false ? "Active" : "Inactive") + \'</span><span class="arrow">Edit &rarr;</span></div>\';',
  '        html += \'</div>\';',
  '      });',
  '    });',
  '    grid.innerHTML = html;',
  '    grid.dataset.bucketed = "1";',
  '  } catch (e) {',
  '    console.debug("[fees buckets]", e && e.message);',
  '  }',
  '}',
  '',
  'function wireFeesBuckets() {',
  '  var grid = document.getElementById("fees-dept-grid");',
  '  if (!grid) return;',
  '  if (grid.__bucketObserver) return;',
  '  grid.__bucketObserver = new MutationObserver(function () {',
  '    if (grid.querySelector(".fees-dept-card") && grid.dataset.bucketed !== "1") {',
  '      setTimeout(function () { __renderFeeBuckets(); }, 100);',
  '    }',
  '  });',
  '  grid.__bucketObserver.observe(grid, { childList: true });',
  '  setTimeout(function () { __renderFeeBuckets(); }, 500);',
  '}',
  '',
].join('\n');

if (!admin.includes('function wireFeesBuckets')) {
  admin = insertBefore(admin, 'function wireIpRefresh', FEE_BUCKETS);
  changes++;
  ok('Fees buckets added');
}

// ------------------------------------------------------------
// 3. Security dashboard — async with awaits, all inside async
// ------------------------------------------------------------
const SEC_DASH = [
  '// batch7b: safe security dashboard',
  'async function loadSecurityDashboard() {',
  '  var summaryRes = null, eventsRes = null, loginsRes = null;',
  '  try { summaryRes = await adminFetch("/api/admin/security/summary"); } catch (e) { console.debug("[sd] summary", e.message); }',
  '  try { eventsRes = await adminFetch("/api/admin/security?limit=100"); } catch (e) { console.debug("[sd] events", e.message); }',
  '  try { loginsRes = await adminFetch("/api/admin/login-history?limit=100&success=false"); } catch (e) { console.debug("[sd] logins", e.message); }',
  '',
  '  var summaryRows = [], eventRows = [], failedRows = [];',
  '  try { if (summaryRes) summaryRows = (await summaryRes.json()).data || []; } catch (e) {}',
  '  try { if (eventsRes) eventRows = (await eventsRes.json()).data || []; } catch (e) {}',
  '  try { if (loginsRes) failedRows = (await loginsRes.json()).data || []; } catch (e) {}',
  '',
  '  var critical = 0, warning = 0, info = 0;',
  '  summaryRows.forEach(function (r) {',
  '    if (r.severity === "critical") critical = r.c || 0;',
  '    else if (r.severity === "warning") warning = r.c || 0;',
  '    else if (r.severity === "info") info = r.c || 0;',
  '  });',
  '',
  '  setText("sec-kpi-sessions", 0);',
  '  setText("sec-kpi-failed", failedRows.length);',
  '  setText("sec-kpi-locked", 0);',
  '  setText("sec-kpi-blocked", 0);',
  '',
  '  var banner = document.getElementById("sec-threat-banner");',
  '  if (banner) {',
  '    var score = critical * 10 + warning * 3 + info;',
  '    var level = critical > 0 ? "high" : warning > 5 ? "medium" : "low";',
  '    banner.className = "sec-threat-banner " + level;',
  '    var issues = "";',
  '    if (failedRows.length > 5) issues += "<span>" + failedRows.length + " failed logins recently</span>";',
  '    if (critical > 0) issues += "<span>" + critical + " critical security event(s)</span>";',
  '    banner.innerHTML =',
  '      \'<div class="stb-score \' + level + \'">\' + Math.min(100, score) + \'</div>\' +',
  '      \'<div class="stb-info">\' +',
  '        \'<h3>Threat Level: \' + level.toUpperCase() + \'</h3>\' +',
  '        \'<p>\' + critical + \' critical &middot; \' + warning + \' warning &middot; \' + info + \' info events</p>\' +',
  '        \'<div class="stb-issues">\' + issues + \'</div>\' +',
  '      \'</div>\';',
  '  }',
  '',
  '  setText("sac-events-badge", eventRows.length);',
  '  setText("sac-sessions-badge", "—");',
  '',
  '  var recent = eventRows.filter(function (r) { return (r.log || r).severity === "critical"; }).slice(0, 10);',
  '  var tbody = document.getElementById("sec-recent-events");',
  '  if (tbody) {',
  '    if (!recent.length) {',
  '      tbody.innerHTML = \'<tr><td colspan="5" class="empty">No critical events.</td></tr>\';',
  '    } else {',
  '      tbody.innerHTML = recent.map(function (r) {',
  '        var log = r.log || r;',
  '        var user = r.user ? escapeHtml(r.user.firstName) + " " + escapeHtml(r.user.lastName) : "—";',
  '        return \'<tr>\' +',
  '          \'<td>\' + escapeHtml(log.event || "") + \'</td>\' +',
  '          \'<td>\' + badge(log.severity) + \'</td>\' +',
  '          \'<td>\' + user + \'</td>\' +',
  '          \'<td>\' + escapeHtml(log.ipAddress || "") + \'</td>\' +',
  '          \'<td class="small muted">\' + fmtDateTime(log.createdAt) + \'</td>\' +',
  '          \'</tr>\';',
  '      }).join("");',
  '    }',
  '  }',
  '}',
  '',
].join('\n');

// Find and replace the existing loadSecurityDashboard
const oldDashRe = /async function loadSecurityDashboard\(\)\s*\{[\s\S]*?\n\}/;
if (oldDashRe.test(admin)) {
  admin = admin.replace(oldDashRe, SEC_DASH.trim());
  changes++;
  ok('loadSecurityDashboard replaced with safe version');
} else {
  warn('loadSecurityDashboard not found');
}

// ------------------------------------------------------------
// 4. Settings inline tabs — same as batch 7 but pure JS
// ------------------------------------------------------------
const SETTINGS_INLINE = [
  '// batch7b: settings inline tabs',
  'function wireSettingsTabsAsPages() {',
  '  var bar = document.getElementById("settings-tabs");',
  '  if (!bar || bar.__inlineBound) return;',
  '  bar.__inlineBound = true;',
  '  var tabs = bar.querySelectorAll(".staff-role-tab");',
  '  for (var i = 0; i < tabs.length; i++) {',
  '    (function (tab) {',
  '      tab.addEventListener("click", function (e) {',
  '        e.preventDefault();',
  '        e.stopPropagation();',
  '        var key = tab.dataset.tab;',
  '        if (!key) return;',
  '        var all = bar.querySelectorAll(".staff-role-tab");',
  '        for (var j = 0; j < all.length; j++) all[j].classList.remove("active");',
  '        tab.classList.add("active");',
  '        if (typeof loadSettingsPage === "function") loadSettingsPage(key);',
  '      }, true);',
  '    })(tabs[i]);',
  '  }',
  '  var active = bar.querySelector(".staff-role-tab.active") || tabs[0];',
  '  if (active && active.dataset.tab) {',
  '    var content = document.getElementById("settings-tab-content");',
  '    if (content && !content.dataset.loaded) {',
  '      content.dataset.loaded = "1";',
  '      loadSettingsPage(active.dataset.tab);',
  '    }',
  '  }',
  '}',
  '',
].join('\n');

const oldSettingsRe = /function wireSettingsTabsAsPages\(\)\s*\{[\s\S]*?\n\}/;
if (oldSettingsRe.test(admin)) {
  admin = admin.replace(oldSettingsRe, SETTINGS_INLINE.trim());
  changes++;
  ok('wireSettingsTabsAsPages replaced');
} else {
  // Insert if it doesn't exist
  admin = insertBefore(admin, 'function wireIpRefresh', SETTINGS_INLINE);
  changes++;
  ok('wireSettingsTabsAsPages inserted');
}

// ------------------------------------------------------------
// 5. wireBatch6 — make sure it calls all batch7 handlers
// ------------------------------------------------------------
if (!admin.includes('function wireBatch6()')) {
  warn('wireBatch6 not found — creating');
  admin = insertBefore(admin, 'function wireBatch5() {', [
    'function wireBatch6() {',
    '  if (typeof wireFeesBuckets === "function") wireFeesBuckets();',
    '  if (typeof wireIpRefresh === "function") wireIpRefresh();',
    '}',
    '',
  ].join('\n'));
} else {
  // Ensure wireBatch6 calls the new functions
  admin = admin.replace(
    /function wireBatch6\(\)\s*\{[\s\S]*?\n\}/,
    [
      'function wireBatch6() {',
      '  if (typeof wireFeesBuckets === "function") wireFeesBuckets();',
      '  if (typeof wireIpRefresh === "function") wireIpRefresh();',
      '}',
    ].join('\n')
  );
  changes++;
  ok('wireBatch6 updated');
}

// ------------------------------------------------------------
// 6. Ensure wireBatch6 is called from wireBatch5 chain
// ------------------------------------------------------------
if (!admin.includes('wireBatch6();')) {
  admin = admin.replace(/wireBatch5\(\);/g, 'wireBatch5(); wireBatch6();');
  changes++;
  ok('Hooked wireBatch6 into wireBatch5 calls');
}

// ------------------------------------------------------------
// 7. Export the new functions
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
    const names = ['wireIpRefresh', 'wireFeesBuckets', '__renderFeeBuckets', '__feeBucketLabel'];
    const toAdd = names.filter(function (n) {
      return !(new RegExp('(^|\\s)' + n + '\\s*[,:]', 'm')).test(body);
    });
    if (toAdd.length) {
      let insertAt = end;
      while (insertAt > exIdx && /\s/.test(admin[insertAt - 1])) insertAt--;
      const indentMatch = body.match(/\n(\s+)\S/);
      const indent = indentMatch ? indentMatch[1] : '  ';
      const inj = '\n' + indent + '// batch7b additions\n' + toAdd.map(function (n) { return indent + n + ','; }).join('\n');
      admin = admin.slice(0, insertAt) + inj + admin.slice(insertAt);
      ok('Added exports: ' + toAdd.join(', '));
    }
  }
}

// ============================================================
// Write
// ============================================================
head('Write admin.js');
backup(ADMIN);
if (!verifyJs(admin)) { err('syntax broken — NOT writing'); process.exit(1); }
fs.writeFileSync(ADMIN, admin, 'utf8');
ok('admin.js patched (' + changes + ' changes)');

// ============================================================
// Also apply the HTML changes from batch 7 that failed (they
// never ran because batch 7 aborted). Re-run them here.
// ============================================================
head('HTML changes');

// Finance bank CRUD
const financePath = path.join(PARTIALS, 'settings', '_tabs', 'finance.html');
let finance = read(financePath);
if (finance && !finance.includes('// batch7b: bank CRUD')) {
  const bankScript = [
    '',
    '<script>',
    '  // batch7b: bank CRUD',
    '  (function () {',
    '    var listEl = document.getElementById("bank-accounts-list");',
    '    var addBtn = document.getElementById("bank-add-btn");',
    '    if (!listEl || listEl.__bound) return;',
    '    listEl.__bound = true;',
    '    function A() { return window.FPU_ADMIN; }',
    '',
    '    async function loadBanks() {',
    '      listEl.innerHTML = "Loading…";',
    '      try {',
    '        var res = await A().adminFetch("/api/admin/settings?category=bank");',
    '        var json = await res.json();',
    '        var rows = (json.data || []).filter(function (r) { return /^bank_account_/.test(r.key); });',
    '        if (!rows.length) { listEl.innerHTML = \'<p class="muted">No bank accounts yet.</p>\'; return; }',
    '        listEl.innerHTML = "";',
    '        rows.forEach(function (row, idx) {',
    '          var bank = {}; try { bank = JSON.parse(row.value); } catch (e) {}',
    '          var div = document.createElement("div");',
    '          div.style.cssText = "margin-bottom:10px; padding:12px; border:1px solid #e5e7eb; border-radius:8px;";',
    '          div.innerHTML =',
    '            \'<div class="form-grid">\' +',
    '            \'<div class="form-group"><label class="form-label">Bank</label><input class="form-control" data-bank="\' + idx + \'" value="\' + (bank.bank || "") + \'" /></div>\' +',
    '            \'<div class="form-group"><label class="form-label">Account Name</label><input class="form-control" data-bankname="\' + idx + \'" value="\' + (bank.accountName || "") + \'" /></div>\' +',
    '            \'<div class="form-group"><label class="form-label">Account Number</label><input class="form-control" data-banknum="\' + idx + \'" value="\' + (bank.accountNumber || "") + \'" /></div>\' +',
    '            \'</div>\' +',
    '            \'<div class="form-actions"><button type="button" class="btn btn-sm btn-primary" data-save="\' + row.key + \'" data-idx="\' + idx + \'">Save</button>\' +',
    '            \'<button type="button" class="btn btn-sm btn-ghost" data-del="\' + row.key + \'">Delete</button></div>\';',
    '          listEl.appendChild(div);',
    '        });',
    '',
    '        listEl.querySelectorAll("[data-save]").forEach(function (btn) {',
    '          btn.addEventListener("click", async function () {',
    '            var key = btn.dataset.save;',
    '            var idx = btn.dataset.idx;',
    '            var bankVal = listEl.querySelector(\'[data-bank="\' + idx + \'"]\').value;',
    '            var nameVal = listEl.querySelector(\'[data-bankname="\' + idx + \'"]\').value;',
    '            var numVal = listEl.querySelector(\'[data-banknum="\' + idx + \'"]\').value;',
    '            try {',
    '              await A().adminFetch("/api/admin/settings/" + key, {',
    '                method: "PUT",',
    '                body: JSON.stringify({ value: JSON.stringify({ bank: bankVal, accountName: nameVal, accountNumber: numVal }), category: "bank" })',
    '              });',
    '              A().showToast("Bank saved.", "success");',
    '            } catch (e) { A().showToast("Error: " + e.message, "error"); }',
    '          });',
    '        });',
    '',
    '        listEl.querySelectorAll("[data-del]").forEach(function (btn) {',
    '          btn.addEventListener("click", async function () {',
    '            if (!confirm("Delete this bank account?")) return;',
    '            try {',
    '              await A().adminFetch("/api/admin/settings/" + btn.dataset.del, { method: "DELETE" });',
    '              A().showToast("Deleted.", "success");',
    '              loadBanks();',
    '            } catch (e) { A().showToast("Error: " + e.message, "error"); }',
    '          });',
    '        });',
    '      } catch (e) {',
    '        listEl.innerHTML = \'<div class="alert alert-danger">\' + e.message + \'</div>\';',
    '      }',
    '    }',
    '',
    '    if (addBtn && !addBtn.__bound) {',
    '      addBtn.__bound = true;',
    '      addBtn.addEventListener("click", async function () {',
    '        try {',
    '          var res = await A().adminFetch("/api/admin/settings?category=bank");',
    '          var json = await res.json();',
    '          var rows = (json.data || []).filter(function (r) { return /^bank_account_/.test(r.key); });',
    '          var nextIdx = rows.length + 1;',
    '          var key = "bank_account_" + nextIdx;',
    '          await A().adminFetch("/api/admin/settings/" + key, {',
    '            method: "PUT",',
    '            body: JSON.stringify({ value: JSON.stringify({ bank: "", accountName: "", accountNumber: "" }), category: "bank" })',
    '          });',
    '          loadBanks();',
    '        } catch (e) { A().showToast("Error: " + e.message, "error"); }',
    '      });',
    '    }',
    '',
    '    setTimeout(loadBanks, 200);',
    '    window.addEventListener("hashchange", function () { setTimeout(loadBanks, 250); });',
    '  })();',
    '</script>',
    '',
  ].join('\n');
  backup(financePath);
  fs.writeFileSync(financePath, finance + bankScript, 'utf8');
  ok('Bank CRUD added to finance.html');
} else if (finance) {
  info('Bank CRUD already in finance.html');
}

// System tab — check if created by batch7 (which aborted before Step 8)
const systemPath = path.join(PARTIALS, 'settings', '_tabs', 'system.html');
if (!fs.existsSync(systemPath)) {
  warn('settings/_tabs/system.html missing — you may need to create it manually');
} else {
  info('settings/_tabs/system.html already exists');
}

// System tab in settings/index.html
const settingsIndexPath = path.join(PARTIALS, 'settings', 'index.html');
let settingsIndex = read(settingsIndexPath);
if (settingsIndex && !settingsIndex.includes('data-tab="system"')) {
  const anchorRe = /(<button class="staff-role-tab"[^>]*data-tab="account"[^>]*>[^<]*<\/button>)/;
  if (anchorRe.test(settingsIndex)) {
    settingsIndex = settingsIndex.replace(anchorRe, '$1\n  <button class="staff-role-tab" data-tab="system">🖥️ System</button>');
    backup(settingsIndexPath);
    fs.writeFileSync(settingsIndexPath, settingsIndex, 'utf8');
    ok('Added System tab');
  }
} else if (settingsIndex) {
  info('System tab already present');
}

// ============================================================
head('DONE');
console.log('');
info('Backups: ' + BACKUP);
console.log('');
log('Next:', 'yellow');
log('  1. Ctrl+C the dev server', 'yellow');
log('  2. npm run dev', 'yellow');
log('  3. Hard-refresh browser (Ctrl+Shift+R)', 'yellow');
console.log('');
log('Test:', 'yellow');
log('  • Fees — grouped by ND1/ND2/HND1/HND2', 'yellow');
log('  • Security dashboard — no longer stuck', 'yellow');
log('  • Security → IP Rules → Refresh + Add Rule', 'yellow');
log('  • Settings → tab bar stays visible', 'yellow');
log('  • Settings → Finance → bank accounts CRUD', 'yellow');
log('  • Settings → System tab exists', 'yellow');
console.log('');