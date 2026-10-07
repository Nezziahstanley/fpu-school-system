// ============================================================
// apply-batch8.js  (v2 — safe)
// ------------------------------------------------------------
// 1. IP "+ Add IP Rule" — opens panel + wires save
// 2. Settings tabs — click swaps content, never navigates
// 3. admin-spa.js — remove settings-<tab> routes (line-safe)
// 4. Fees — complete styling for ND1/ND2/HND1/HND2 buckets
// ============================================================

'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT = process.cwd();
const ADMIN = path.join(ROOT, 'public', 'js', 'admin.js');
const SPA   = path.join(ROOT, 'public', 'js', 'admin-spa.js');
const CSS   = path.join(ROOT, 'public', 'css', 'admin.css');
const PARTIALS = path.join(ROOT, 'public', 'admin', 'partials');
const BACKUP = path.join(ROOT, 'backups', 'batch8-v2-' + new Date().toISOString().replace(/[:.]/g, '-'));

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

head('Batch 8 v2 — IP add panel + settings + fees styling');

// ============================================================
// 1. admin.js — safe replacements
// ============================================================
let admin = read(ADMIN);
if (!admin) { err('admin.js not found'); process.exit(1); }
let changes = 0;

// --- IP Add Form ---
const IP_ADD_FORM = [
  '// batch8: IP add form (v2)',
  'function wireIpAddForm() {',
  '  var addBtn = document.getElementById("ip-add-btn");',
  '  var panel = document.getElementById("ip-add-panel");',
  '  var cancel = document.getElementById("ip-add-cancel");',
  '  var save = document.getElementById("ip-save");',
  '  if (addBtn && !addBtn.__fpuAddBound) {',
  '    addBtn.__fpuAddBound = true;',
  '    addBtn.onclick = function (e) {',
  '      if (e) { e.preventDefault(); e.stopPropagation(); }',
  '      if (!panel) return;',
  '      var shown = panel.style.display === "block";',
  '      panel.style.display = shown ? "none" : "block";',
  '      if (!shown) {',
  '        var addr = document.getElementById("ip-address");',
  '        if (addr) addr.focus();',
  '      }',
  '    };',
  '  }',
  '  if (cancel && !cancel.__fpuCancelBound) {',
  '    cancel.__fpuCancelBound = true;',
  '    cancel.onclick = function (e) {',
  '      if (e) { e.preventDefault(); e.stopPropagation(); }',
  '      if (panel) panel.style.display = "none";',
  '    };',
  '  }',
  '  if (save && !save.__fpuSaveBound) {',
  '    save.__fpuSaveBound = true;',
  '    save.onclick = async function (e) {',
  '      if (e) { e.preventDefault(); e.stopPropagation(); }',
  '      var valEl = document.getElementById("ip-validation");',
  '      if (valEl) valEl.innerHTML = "";',
  '      var addr = document.getElementById("ip-address");',
  '      var rule = document.getElementById("ip-rule");',
  '      var expires = document.getElementById("ip-expires");',
  '      var reason = document.getElementById("ip-reason");',
  '      var ipValue = addr && addr.value.trim();',
  '      if (!ipValue) {',
  '        if (valEl) valEl.innerHTML = \'<div class="alert alert-error">IP address is required.</div>\';',
  '        return;',
  '      }',
  '      save.disabled = true;',
  '      try {',
  '        var res = await adminFetch("/api/admin/security/ip-rules", {',
  '          method: "POST",',
  '          body: JSON.stringify({',
  '            ipAddress: ipValue,',
  '            rule: (rule && rule.value) || "block",',
  '            expiresAt: (expires && expires.value) ? expires.value : null,',
  '            reason: (reason && reason.value.trim()) || null',
  '          })',
  '        });',
  '        var json = await res.json();',
  '        if (!json.success) throw new Error(json.error || "Save failed");',
  '        showToast("IP rule added.", "success");',
  '        if (panel) panel.style.display = "none";',
  '        if (addr) addr.value = "";',
  '        if (reason) reason.value = "";',
  '        if (expires) expires.value = "";',
  '        loadIpRules();',
  '      } catch (err) {',
  '        if (valEl) valEl.innerHTML = \'<div class="alert alert-error">\' + escapeHtml(err.message) + \'</div>\';',
  '      } finally {',
  '        save.disabled = false;',
  '      }',
  '    };',
  '  }',
  '}',
  '',
].join('\n');

const oldIpRe = /function wireIpAddForm\(\)\s*\{[\s\S]*?\n\}/;
if (oldIpRe.test(admin)) {
  admin = admin.replace(oldIpRe, IP_ADD_FORM.trim());
  changes++;
  ok('wireIpAddForm replaced');
} else {
  const anchor = admin.indexOf('function wireIpRefresh()');
  if (anchor !== -1) {
    admin = admin.slice(0, anchor) + IP_ADD_FORM + '\n' + admin.slice(anchor);
    changes++;
    ok('wireIpAddForm inserted');
  } else {
    warn('anchor for wireIpAddForm not found');
  }
}

// --- Settings inline tabs ---
const SETTINGS_INLINE = [
  '// batch8: settings inline tabs (v2)',
  'function wireSettingsTabsAsPages() {',
  '  var bar = document.getElementById("settings-tabs");',
  '  if (!bar || bar.__fpuInlineBound) return;',
  '  bar.__fpuInlineBound = true;',
  '  var tabs = bar.querySelectorAll(".staff-role-tab");',
  '  for (var i = 0; i < tabs.length; i++) {',
  '    (function (tab) {',
  '      tab.style.cursor = "pointer";',
  '      tab.setAttribute("type", "button");',
  '      tab.onclick = function (e) {',
  '        if (e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }',
  '        var key = tab.dataset.tab;',
  '        if (!key) return false;',
  '        var all = bar.querySelectorAll(".staff-role-tab");',
  '        for (var j = 0; j < all.length; j++) all[j].classList.remove("active");',
  '        tab.classList.add("active");',
  '        if (typeof loadSettingsPage === "function") loadSettingsPage(key);',
  '        return false;',
  '      };',
  '    })(tabs[i]);',
  '  }',
  '  var active = bar.querySelector(".staff-role-tab.active") || tabs[0];',
  '  if (active && active.dataset.tab) {',
  '    var content = document.getElementById("settings-tab-content");',
  '    if (content && !content.dataset.fpuLoaded) {',
  '      content.dataset.fpuLoaded = "1";',
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
  const anchor = admin.indexOf('function wireIpRefresh()');
  if (anchor !== -1) {
    admin = admin.slice(0, anchor) + SETTINGS_INLINE + '\n' + admin.slice(anchor);
    changes++;
    ok('wireSettingsTabsAsPages inserted');
  }
}

// --- loadSettingsPage ---
const LOAD_SETTINGS_PAGE = [
  '// batch8: load settings page (v2)',
  'async function loadSettingsPage(tab) {',
  '  var content = document.getElementById("settings-tab-content");',
  '  if (!content) return;',
  '  content.innerHTML = \'<div class="loading"><span class="spinner"></span> Loading…</div>\';',
  '  try {',
  '    var res = await fetch("/admin/partials/settings/_tabs/" + tab + ".html", { cache: "no-cache" });',
  '    if (!res.ok) throw new Error("Partial " + tab + " not found (HTTP " + res.status + ")");',
  '    var html = await res.text();',
  '    content.innerHTML = html;',
  '    if (window.FPU_EXECUTE_PARTIAL_SCRIPTS) {',
  '      window.FPU_EXECUTE_PARTIAL_SCRIPTS(content);',
  '    } else {',
  '      var scripts = content.querySelectorAll("script");',
  '      for (var i = 0; i < scripts.length; i++) {',
  '        var s = document.createElement("script");',
  '        s.textContent = scripts[i].textContent;',
  '        scripts[i].replaceWith(s);',
  '      }',
  '    }',
  '    try {',
  '      var r = await adminFetch("/api/admin/settings?category=" + tab);',
  '      var j = await r.json();',
  '      var map = {};',
  '      (j.data || []).forEach(function (row) { map[row.key] = row.value; });',
  '      var inputs = content.querySelectorAll("input, select, textarea");',
  '      for (var k = 0; k < inputs.length; k++) {',
  '        var el = inputs[k];',
  '        var key = el.name;',
  '        if (!key || !(key in map)) continue;',
  '        if (el.type === "checkbox") {',
  '          el.checked = ["true","1","yes","on"].indexOf(String(map[key]).toLowerCase()) !== -1;',
  '        } else {',
  '          el.value = map[key] || "";',
  '        }',
  '      }',
  '    } catch (e) { console.debug("[settings] prefill", e.message); }',
  '  } catch (err) {',
  '    content.innerHTML = \'<div class="alert alert-danger">\' + escapeHtml(err.message) + \'</div>\';',
  '  }',
  '}',
  '',
].join('\n');

const oldLoadRe = /async function loadSettingsPage\([^)]*\)\s*\{[\s\S]*?\n\}/;
if (oldLoadRe.test(admin)) {
  admin = admin.replace(oldLoadRe, LOAD_SETTINGS_PAGE.trim());
  changes++;
  ok('loadSettingsPage replaced');
}

// --- Ensure wireBatch6 calls everything ---
if (admin.includes('function wireBatch6()')) {
  admin = admin.replace(
    /function wireBatch6\(\)\s*\{[\s\S]*?\n\}/,
    [
      'function wireBatch6() {',
      '  if (typeof wireFeesBuckets === "function") wireFeesBuckets();',
      '  if (typeof wireIpRefresh === "function") wireIpRefresh();',
      '  if (typeof wireIpAddForm === "function") wireIpAddForm();',
      '  if (typeof wireSettingsTabsAsPages === "function") wireSettingsTabsAsPages();',
      '}',
    ].join('\n')
  );
  changes++;
  ok('wireBatch6 updated');
}

// --- Exports ---
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
    const names = ['wireIpAddForm', 'wireSettingsTabsAsPages', 'loadSettingsPage'];
    const toAdd = names.filter(function (n) {
      return !(new RegExp('(^|\\s)' + n + '\\s*[,:]', 'm')).test(body);
    });
    if (toAdd.length) {
      let insertAt = end;
      while (insertAt > exIdx && /\s/.test(admin[insertAt - 1])) insertAt--;
      const indentMatch = body.match(/\n(\s+)\S/);
      const indent = indentMatch ? indentMatch[1] : '  ';
      const inj = '\n' + indent + '// batch8 additions\n' + toAdd.map(function (n) { return indent + n + ','; }).join('\n');
      admin = admin.slice(0, insertAt) + inj + admin.slice(insertAt);
      ok('Added exports: ' + toAdd.join(', '));
    }
  }
}

// --- Write admin.js ---
backup(ADMIN);
if (!verifyJs(admin)) { err('admin.js syntax broken — NOT writing'); process.exit(1); }
fs.writeFileSync(ADMIN, admin, 'utf8');
ok('admin.js patched (' + changes + ' changes)');

// ============================================================
// 2. admin-spa.js — remove settings-<tab> entries, LINE-SAFE
// ============================================================
head('Step 2 — admin-spa.js cleanup (line-safe)');

let spa = read(SPA);
if (spa) {
  const tabs = ['institution','academic','finance','library','attendance','registrations','email','sms','features','localisation','maintenance','advanced','account','system'];
  const lines = spa.split('\n');
  const out = [];
  let removed = 0;

  for (const line of lines) {
    let shouldDrop = false;
    for (const tab of tabs) {
      const key = 'settings-' + tab;
      // Only drop lines that START (after whitespace) with 'settings-<tab>' key
      if (new RegExp("^\\s*'" + key + "'\\s*:").test(line)) {
        shouldDrop = true;
        break;
      }
    }
    if (shouldDrop) { removed++; continue; }
    out.push(line);
  }

  if (removed > 0) {
    const newSpa = out.join('\n');
    if (!verifyJs(newSpa)) { err('admin-spa.js syntax broken — NOT writing'); process.exit(1); }
    backup(SPA);
    fs.writeFileSync(SPA, newSpa, 'utf8');
    ok('Removed ' + removed + ' settings-<tab> route(s) from SPA_PAGES');
  } else {
    info('No settings-<tab> routes to remove');
  }
} else {
  warn('admin-spa.js not found');
}

// ============================================================
// 3. Fees — complete styling
// ============================================================
head('Step 3 — fees styling (admin.css)');

const FEES_CSS_MARKER = '/* ==== FPU Batch 8 — fees bucket styling ==== */';
let css = read(CSS);
if (!css) { err('admin.css not found'); process.exit(1); }

if (css.includes(FEES_CSS_MARKER)) {
  info('Fees CSS already present');
} else {
  const FEES_CSS = `
${FEES_CSS_MARKER}

/* Fees bucket section header */
.fees-bucket-head {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin: 26px 0 12px;
  padding: 14px 20px;
  background: linear-gradient(135deg, #065f46 0%, #047857 100%);
  color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 14px rgba(6, 95, 70, 0.18);
}

.fees-bucket-head:first-child { margin-top: 0; }

.fees-bucket-head .fees-bucket-title {
  font-family: 'Poppins', sans-serif;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.3px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.fees-bucket-head .fees-bucket-title::before {
  content: "";
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fef3c7;
  box-shadow: 0 0 0 4px rgba(254, 243, 199, 0.25);
}

.fees-bucket-head[data-bucket="ND1"] .fees-bucket-title::before  { background: #3b82f6; box-shadow: 0 0 0 4px rgba(59,130,246,.3); }
.fees-bucket-head[data-bucket="ND2"] .fees-bucket-title::before  { background: #06b6d4; box-shadow: 0 0 0 4px rgba(6,182,212,.3); }
.fees-bucket-head[data-bucket="HND1"] .fees-bucket-title::before { background: #f59e0b; box-shadow: 0 0 0 4px rgba(245,158,11,.3); }
.fees-bucket-head[data-bucket="HND2"] .fees-bucket-title::before { background: #ec4899; box-shadow: 0 0 0 4px rgba(236,72,153,.3); }

.fees-bucket-head .fees-bucket-meta {
  background: rgba(255, 255, 255, 0.15);
  color: #d1fae5;
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 999px;
  white-space: nowrap;
}

.fees-bucket-head .fees-bucket-meta strong {
  color: #fef3c7;
  font-size: 13px;
}

/* Bucket container */
.fees-bucket-grid {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 22px;
}

.fees-bucket-empty {
  grid-column: 1 / -1;
  padding: 20px;
  background: #f8fafc;
  border: 2px dashed #cbd5e1;
  border-radius: 10px;
  text-align: center;
  color: #94a3b8;
  font-size: 13.5px;
  font-style: italic;
}

/* Fee card — refined */
.fee-card {
  background: #ffffff;
  border: 1px solid var(--fpu-border);
  border-radius: 14px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 1px 2px rgba(15,23,42,0.04);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.fee-card::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
  background: linear-gradient(90deg, #065f46, #f59e0b);
}

.fee-card.inactive::before {
  background: linear-gradient(90deg, #cbd5e1, #e2e8f0);
}

.fee-card.inactive { opacity: 0.7; }

.fee-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 28px rgba(15,23,42,0.10);
  border-color: rgba(6,95,70,0.3);
}

.fee-card .fc-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.fee-card .fc-code {
  background: #ecfdf5;
  color: #065f46;
  font-family: 'Poppins', sans-serif;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1px;
  padding: 4px 10px;
  border-radius: 6px;
}

.fee-card .fc-level {
  font-family: 'Poppins', sans-serif;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 4px 10px;
  border-radius: 999px;
  text-transform: uppercase;
}

.fee-card .fc-level.nd  { background: #dbeafe; color: #1e40af; }
.fee-card .fc-level.hnd { background: #fef3c7; color: #92400e; }
.fee-card .fc-level.cert{ background: #dcfce7; color: #15803d; }

.fee-card h3 {
  font-family: 'Poppins', sans-serif;
  font-size: 1.05rem;
  color: #0f172a;
  margin: 0;
  line-height: 1.3;
}

.fee-card .fc-total {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.fee-card .fc-total .num {
  font-family: 'Poppins', sans-serif;
  font-size: 1.9rem;
  font-weight: 800;
  color: #065f46;
  line-height: 1;
}

.fee-card .fc-total .label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 600;
}

.fee-card .fc-breakdown {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  font-size: 11px;
  color: #475569;
  padding-top: 10px;
  border-top: 1px dashed #e5e7eb;
}

.fee-card .fc-breakdown .item {
  display: flex;
  justify-content: space-between;
  gap: 6px;
}

.fee-card .fc-breakdown .k { color: #94a3b8; }
.fee-card .fc-breakdown .v { font-weight: 600; color: #0f172a; }

.fee-card .fc-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
  font-size: 12px;
  color: #94a3b8;
  font-weight: 600;
}

.fee-card .fc-footer .arrow {
  color: #f59e0b;
  font-family: 'Poppins', sans-serif;
}

/* Session pill on card */
.fee-card .fc-session {
  font-size: 10.5px;
  color: #94a3b8;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Print styles */
@media print {
  .fees-bucket-head {
    background: #f1f5f9 !important;
    color: #000 !important;
    box-shadow: none !important;
    border: 1px solid #cbd5e1;
  }
  .fees-bucket-head .fees-bucket-meta {
    background: #e2e8f0 !important;
    color: #334155 !important;
  }
  .fee-card { break-inside: avoid; box-shadow: none !important; }
}
`;
  backup(CSS);
  fs.writeFileSync(CSS, css.trimEnd() + '\n' + FEES_CSS + '\n', 'utf8');
  ok('Fees styling appended to admin.css');
}

// ============================================================
// 4. Replace __renderFeeBuckets in admin.js to use the new class names
// ============================================================
head('Step 4 — fees bucket renderer (styled)');

const NEW_FEE_RENDER = [
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
  '    var buckets = {',
  '      "ND1": { label: "ND 1 School Fees", items: [] },',
  '      "ND2": { label: "ND 2 School Fees", items: [] },',
  '      "HND1": { label: "HND 1 School Fees", items: [] },',
  '      "HND2": { label: "HND 2 School Fees", items: [] }',
  '    };',
  '',
  '    fees.forEach(function (f) {',
  '      var p = progById.get(f.programmeId);',
  '      var lvl = String(f.level || (p && p.level) || "ND").toUpperCase();',
  '      var yr = Number(p && p.yearOfStudy) || 1;',
  '      var key = lvl + yr;',
  '      if (buckets[key]) buckets[key].items.push({ f: f, p: p });',
  '    });',
  '',
  '    var html = "";',
  '    ["ND1","ND2","HND1","HND2"].forEach(function (key) {',
  '      var bucket = buckets[key];',
  '      var items = bucket.items;',
  '      var total = items.reduce(function (sum, it) { return sum + (Number(it.f.total) || 0); }, 0);',
  '',
  '      html += \'<div class="fees-bucket-head" data-bucket="\' + key + \'">\';',
  '      html += \'<div class="fees-bucket-title">\' + bucket.label + \'</div>\';',
  '      html += \'<div class="fees-bucket-meta"><strong>\' + items.length + \'</strong> structure\' + (items.length === 1 ? "" : "s") + \' &middot; \' + money(total) + \'</div>\';',
  '      html += \'</div>\';',
  '',
  '      html += \'<div class="fees-bucket-grid">\';',
  '      if (!items.length) {',
  '        html += \'<div class="fees-bucket-empty">No fee structures defined for \' + bucket.label + \'</div>\';',
  '      } else {',
  '        items.forEach(function (it) {',
  '          var f = it.f;',
  '          var p = it.p || {};',
  '          html += \'<div class="fee-card \' + (f.isActive === false ? "inactive" : "") + \'" onclick="FPU_ADMIN_SPA.navigateToWithQuery(\\\'fee-form\\\', { id: \' + f.id + \' })">\';',
  '          html += \'<div class="fc-head">\';',
  '          html += \'<span class="fc-code">\' + escapeHtml(p.code || "") + \'</span>\';',
  '          html += \'<span class="fc-level \' + (f.level || "nd").toLowerCase() + \'">\' + escapeHtml(f.level || "") + \'</span>\';',
  '          html += \'</div>\';',
  '          html += \'<h3>\' + escapeHtml(p.name || "") + \'</h3>\';',
  '          html += \'<div class="fc-total"><span class="num">\' + money(f.total) + \'</span><span class="label">total fee</span></div>\';',
  '          html += \'<div class="fc-breakdown">\';',
  '          html += \'<div class="item"><span class="k">Tuition</span><span class="v">\' + money(f.tuition) + \'</span></div>\';',
  '          html += \'<div class="item"><span class="k">Acceptance</span><span class="v">\' + money(f.acceptance) + \'</span></div>\';',
  '          html += \'<div class="item"><span class="k">Medical</span><span class="v">\' + money(f.medical) + \'</span></div>\';',
  '          html += \'<div class="item"><span class="k">Library</span><span class="v">\' + money(f.library) + \'</span></div>\';',
  '          html += \'<div class="item"><span class="k">ICT</span><span class="v">\' + money(f.ict) + \'</span></div>\';',
  '          html += \'<div class="item"><span class="k">Sports</span><span class="v">\' + money(f.sports) + \'</span></div>\';',
  '          html += \'</div>\';',
  '          html += \'<div class="fc-footer"><span>\' + (f.isActive !== false ? "Active" : "Inactive") + \'</span><span class="arrow">Edit &rarr;</span></div>\';',
  '          html += \'</div>\';',
  '        });',
  '      }',
  '      html += \'</div>\';',
  '    });',
  '    grid.innerHTML = html;',
  '    grid.dataset.bucketed = "1";',
  '  } catch (e) {',
  '    console.debug("[fees buckets]", e && e.message);',
  '  }',
  '}',
  '',
].join('\n');

const oldRenderRe = /async function __renderFeeBuckets\(\)\s*\{[\s\S]*?\n\}/;
if (oldRenderRe.test(admin)) {
  admin = admin.replace(oldRenderRe, NEW_FEE_RENDER.trim());
  changes++;
  ok('__renderFeeBuckets replaced with styled version');
} else {
  warn('__renderFeeBuckets not found — you may need to run batch7b first');
}

// Re-write admin.js (it was already written above; write again)
if (!verifyJs(admin)) { err('admin.js syntax broken — NOT writing'); process.exit(1); }
backup(ADMIN);
fs.writeFileSync(ADMIN, admin, 'utf8');
ok('admin.js re-written with styled fees renderer');

// ============================================================
// 5. Verify
// ============================================================
head('Step 5 — verify');

const checks = [
  ['admin.js has wireIpAddForm', read(ADMIN).includes('function wireIpAddForm')],
  ['admin.js has wireSettingsTabsAsPages', read(ADMIN).includes('function wireSettingsTabsAsPages')],
  ['admin.js has styled __renderFeeBuckets', read(ADMIN).includes('fees-bucket-head')],
  ['admin.css has fees styling', read(CSS).includes(FEES_CSS_MARKER)],
  ['admin-spa.js has no settings-institution route', !read(SPA).includes("'settings-institution'")],
];
for (const [label, pass] of checks) {
  if (pass) ok(label);
  else warn(label);
}

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
log('  • Security → IP Rules → + Add IP Rule → panel opens', 'yellow');
log('  • Settings → click any card → content swaps, tab bar stays', 'yellow');
log('  • Fees → styled buckets ND1/ND2/HND1/HND2 with green headers', 'yellow');
console.log('');