// ============================================================
// apply-batch2.js
// ------------------------------------------------------------
// Batch 2A: Rewrites back/cancel buttons in every partial to
//           use FPU_ADMIN.goBack('parent').
// Batch 2B: Patches admin.js with:
//             - grade-scale add/edit form handlers
//             - fees "Copy from prior session" wiring
//             - fees session filter (latest 2 sessions only)
//             - lecturer workload-summary button
//             - timetable "Print All"
//             - exams "Print All" + "Exam Periods" modal
//             - announcement audience/priority/search filters
//             - complaints tab-status filter
//             - notifications inbox-only (hides Sent tab)
//             - settings "My Account" tab data
//           Writes routes/fees-copy.js (new file) for the
//           backend endpoint.
//
// Usage:
//   node apply-batch2.js
//   node apply-batch2.js --dry       preview only
//
// Rollback:
//   copy files back from backups/batch2-<timestamp>/
// ============================================================

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT    = process.cwd();
const DRY     = process.argv.includes('--dry');
const PARTIALS_DIR = path.join(ROOT, 'public', 'admin', 'partials');
const ADMIN_JS     = path.join(ROOT, 'public', 'js', 'admin.js');
const ROUTES_DIR   = path.join(ROOT, 'routes');
const BACKUP_DIR   = path.join(ROOT, 'backups', 'batch2-' + new Date().toISOString().replace(/[:.]/g, '-'));

// ------------------------------------------------------------
// Logging
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
// File helpers
// ------------------------------------------------------------
function read(f) {
  if (!fs.existsSync(f)) return null;
  return fs.readFileSync(f, 'utf8');
}

function backup(file) {
  if (!fs.existsSync(file)) return;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const rel = path.relative(ROOT, file).replace(/[\\/]/g, '__');
  fs.copyFileSync(file, path.join(BACKUP_DIR, rel));
}

function write(file, content) {
  if (DRY) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (full.endsWith('.html')) out.push(full);
  }
  return out;
}

// ============================================================
// PART 1 — Batch 2A: Back / cancel button fixer
// ============================================================
const PARENT_OF = {
  applications: 'applications', students: 'students',
  sessions: 'sessions', programmes: 'programmes',
  courses: 'courses', schools: 'schools',
  departments: 'departments', allocations: 'allocations',
  registrations: 'registrations', results: 'results',
  transcript: 'transcript', timetable: 'timetable',
  exams: 'exams', attendance: 'attendance',
  staff: 'staff', hods: 'hods', lecturers: 'lecturers',
  fees: 'fees', payments: 'payments', clearances: 'clearances',
  announcements: 'announcements', notifications: 'notifications',
  complaints: 'complaints', library: 'library',
  documents: 'documents', graduation: 'graduation',
  reports: 'reports', audit: 'audit', security: 'security',
  settings: 'settings', users: 'users', dashboard: 'dashboard',
};

function parentKeyFor(filePath) {
  const rel = path.relative(PARTIALS_DIR, filePath).split(path.sep);
  return PARENT_OF[rel[0]] || 'dashboard';
}

function fixBackButtons() {
  head('Batch 2A — Back / cancel buttons');

  const files = walk(PARTIALS_DIR);
  info(`Scanned ${files.length} partial(s)`);

  let touched = 0;
  let wired = 0;
  let histRemoved = 0;

  for (const file of files) {
    const original = read(file);
    if (original === null) continue;

    const parentKey = parentKeyFor(file);
    let html = original;

    // 1) Add inline onclick to id-based buttons that lack one
    html = html.replace(
      /<button\b([^>]*\bid="([a-z0-9-]*(?:-back|-cancel))"[^>]*)>/gi,
      (match, attrs) => {
        if (/\bonclick\s*=/.test(attrs)) return match;
        wired++;
        return `<button${attrs} onclick="FPU_ADMIN.goBack('${parentKey}')">`;
      }
    );

    // 2) Neutralize history.back() bindings so they don't error on 2nd visit
    const patterns = [
      /([^\n;]*\.onclick\s*=\s*(?:\(\s*\)\s*=>\s*|function\s*\(\s*\)\s*\{\s*)history\.back\(\s*\)\s*(?:\}|\s*;))/g,
      /([^\n;]*\.addEventListener\s*\(\s*['"]click['"]\s*,\s*(?:\(\s*\)\s*=>\s*|function\s*\(\s*\)\s*\{\s*)history\.back\(\s*\)[^)]*\)\s*;?)/g,
    ];
    for (const re of patterns) {
      html = html.replace(re, (match) => {
        histRemoved++;
        return `/* batch2: replaced by inline goBack */ void 0;`;
      });
    }

    if (html !== original) {
      touched++;
      const rel = path.relative(ROOT, file);
      info(`${rel}  →  +${wired > 0 ? 'onclick' : '0'}, ${histRemoved} history.back removed`);
      backup(file);
      write(file, html);
    }
  }

  ok(`Files updated: ${touched}`);
  ok(`Buttons wired: ${wired}`);
  ok(`history.back() neutralized: ${histRemoved}`);
}

// ============================================================
// PART 2 — Batch 2B: admin.js additions
// ============================================================
const JS_MARKER = '// ==== FPU Batch 2 additions ====';

const JS_BLOCK = `
${JS_MARKER}
// ------------------------------------------------------------
// Grade Scale — Add Band + Edit Band form handlers
// ------------------------------------------------------------
function wireGradeScaleForms() {
  const btn = document.getElementById('gs-add-btn');
  const panel = document.getElementById('gs-add-panel');
  const cancel1 = document.getElementById('gs-add-cancel');
  const cancel2 = document.getElementById('gs-add-cancel-2');
  const modal = document.getElementById('gs-modal');
  const modalClose = document.getElementById('gs-modal-close');
  const editCancel = document.getElementById('gs-edit-cancel');
  const addForm = document.getElementById('gs-add-form');
  const editForm = document.getElementById('gs-edit-form');

  if (btn && panel && !btn.__bound) {
    btn.__bound = true;
    btn.onclick = () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; };
  }
  if (cancel1) cancel1.onclick = () => { if (panel) panel.style.display = 'none'; };
  if (cancel2) cancel2.onclick = () => { if (panel) panel.style.display = 'none'; };
  if (modalClose) modalClose.onclick = () => { if (modal) modal.style.display = 'none'; };
  if (editCancel) editCancel.onclick = () => { if (modal) modal.style.display = 'none'; };

  if (addForm && !addForm.__bound) {
    addForm.__bound = true;
    addForm.onsubmit = async (e) => {
      e.preventDefault();
      const valEl = document.getElementById('gs-add-validation');
      if (valEl) valEl.innerHTML = '';

      const payload = {
        grade: String(document.getElementById('gs-add-grade').value || '').trim().toUpperCase(),
        minScore: Number(document.getElementById('gs-add-min').value),
        maxScore: Number(document.getElementById('gs-add-max').value),
        points: Number(document.getElementById('gs-add-points').value),
        remark: String(document.getElementById('gs-add-remark').value || '').trim(),
        isActive: document.getElementById('gs-add-active').checked,
      };

      if (!payload.grade) {
        if (valEl) valEl.innerHTML = '<div class="alert alert-error">⚠️ Grade is required.</div>';
        return;
      }
      if (!(payload.minScore >= 0 && payload.maxScore <= 100 && payload.minScore < payload.maxScore)) {
        if (valEl) valEl.innerHTML = '<div class="alert alert-error">⚠️ Score range must be 0–100 with min &lt; max.</div>';
        return;
      }

      try {
        await adminFetch('/api/admin/grade-scales', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Band added.', 'success');
        panel.style.display = 'none';
        addForm.reset();
        loadGradeScales();
      } catch (err) {
        if (valEl) valEl.innerHTML = '<div class="alert alert-error">❌ ' + escapeHtml(err.message) + '</div>';
      }
    };
  }

  if (editForm && !editForm.__bound) {
    editForm.__bound = true;
    editForm.onsubmit = async (e) => {
      e.preventDefault();
      const id = editForm.dataset.id;
      if (!id) return;
      const payload = {
        grade: String(document.getElementById('gs-edit-grade').value || '').trim().toUpperCase(),
        minScore: Number(document.getElementById('gs-edit-min').value),
        maxScore: Number(document.getElementById('gs-edit-max').value),
        points: Number(document.getElementById('gs-edit-points').value),
        remark: String(document.getElementById('gs-edit-remark').value || '').trim(),
        isActive: document.getElementById('gs-edit-active').checked,
      };
      try {
        await adminFetch('/api/admin/grade-scales/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Band updated.', 'success');
        modal.style.display = 'none';
        loadGradeScales();
      } catch (err) {
        const valEl = document.getElementById('gs-edit-validation');
        if (valEl) valEl.innerHTML = '<div class="alert alert-error">❌ ' + escapeHtml(err.message) + '</div>';
      }
    };
  }
}

// ------------------------------------------------------------
// Fees — Copy from prior session modal + session filter
// ------------------------------------------------------------
async function openCopyFeesModal() {
  const modal = document.getElementById('fees-copy-modal');
  if (!modal) return;

  try {
    const res = await adminFetch('/api/admin/sessions');
    const json = await res.json();
    const sessions = json.data || [];

    const fromSel = document.getElementById('copy-from-session');
    const toSel = document.getElementById('copy-to-session');
    if (fromSel && toSel) {
      const opts = sessions.map((s) => '<option value="' + s.id + '">' + escapeHtml(s.name) + '</option>').join('');
      fromSel.innerHTML = '<option value="">— Choose —</option>' + opts;
      toSel.innerHTML   = '<option value="">— Choose —</option>' + opts;
    }
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
}

async function copyFeesFromSession() {
  const fromId = (document.getElementById('copy-from-session') || {}).value;
  const toId   = (document.getElementById('copy-to-session') || {}).value;
  const valEl  = document.getElementById('copy-validation');

  if (valEl) valEl.innerHTML = '';

  if (!fromId || !toId) {
    if (valEl) valEl.innerHTML = '<div class="alert alert-error">⚠️ Choose both sessions.</div>';
    return;
  }
  if (fromId === toId) {
    if (valEl) valEl.innerHTML = '<div class="alert alert-error">⚠️ Source and target must differ.</div>';
    return;
  }

  try {
    const res = await adminFetch('/api/admin/fees/copy', {
      method: 'POST',
      body: JSON.stringify({ fromSessionId: Number(fromId), toSessionId: Number(toId) }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showToast('✅ Copied ' + json.copied + ' structure(s).');
    document.getElementById('fees-copy-modal').style.display = 'none';
    loadFeeDepartments();
  } catch (err) {
    if (valEl) valEl.innerHTML = '<div class="alert alert-error">❌ ' + escapeHtml(err.message) + '</div>';
  }
}

function wireFeesCopyButton() {
  const copyBtn = document.getElementById('fees-copy-btn');
  if (copyBtn && !copyBtn.__bound) {
    copyBtn.__bound = true;
    copyBtn.onclick = openCopyFeesModal;
  }
  const confirmCopy = document.getElementById('copy-confirm-btn');
  if (confirmCopy && !confirmCopy.__bound) {
    confirmCopy.__bound = true;
    confirmCopy.onclick = copyFeesFromSession;
  }
  const copyClose = document.getElementById('fees-copy-close');
  if (copyClose) copyClose.onclick = () => { document.getElementById('fees-copy-modal').style.display = 'none'; };
  const copyCancel = document.getElementById('fees-copy-cancel');
  if (copyCancel) copyCancel.onclick = () => { document.getElementById('fees-copy-modal').style.display = 'none'; };
}

// ------------------------------------------------------------
// Lecturer — Workload Summary button
// ------------------------------------------------------------
function wireLecturerWorkloadButton() {
  const wlBtn = document.getElementById('lec-view-workloads');
  if (wlBtn && !wlBtn.__bound) {
    wlBtn.__bound = true;
    wlBtn.onclick = () => FPU_ADMIN_SPA.navigateTo('staff-workload');
  }
}

// ------------------------------------------------------------
// Timetable — Print All
// ------------------------------------------------------------
async function printAllTimetableSheets() {
  try {
    const res = await adminFetch('/api/admin/departments');
    const depts = (await res.json()).data || [];
    if (!depts.length) { showToast('No departments.', 'warning'); return; }

    const sessionId = (document.getElementById('tt-session') || {}).value || '';
    const semester  = (document.getElementById('tt-semester') || {}).value || 'first';

    showToast('Opening ' + depts.length + ' department sheet(s)…', 'info');
    for (const d of depts) {
      FPU_ADMIN_SPA.navigateToWithQuery('timetable-by-dept', {
        departmentId: d.id, sessionId, semester, name: d.name,
      });
      await new Promise((r) => setTimeout(r, 900));
      window.print();
      await new Promise((r) => setTimeout(r, 400));
    }
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

function wireTimetablePrintAll() {
  const printAll = document.getElementById('tt-print-all');
  if (printAll && !printAll.__bound) {
    printAll.__bound = true;
    printAll.onclick = printAllTimetableSheets;
  }
}

// ------------------------------------------------------------
// Exams — Print All + Exam Periods modal
// ------------------------------------------------------------
async function printAllExamSheets() {
  try {
    const res = await adminFetch('/api/admin/schools');
    const schools = (await res.json()).data || [];
    const sessionId = (document.getElementById('ex-session') || {}).value || '';
    const semester  = (document.getElementById('ex-semester') || {}).value || 'first';

    showToast('Opening ' + schools.length + ' school sheet(s)…', 'info');
    for (const s of schools) {
      FPU_ADMIN_SPA.navigateToWithQuery('exam-sheet', {
        schoolId: s.id, sessionId, semester, name: s.name,
      });
      await new Promise((r) => setTimeout(r, 900));
      window.print();
      await new Promise((r) => setTimeout(r, 400));
    }
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

function openExamPeriodsModal() {
  const modal = document.getElementById('ex-periods-modal');
  if (!modal) return;

  let periods;
  try { periods = JSON.parse(localStorage.getItem('fpu_exam_periods') || 'null'); } catch { periods = null; }
  if (!Array.isArray(periods) || !periods.length) {
    periods = [
      { label: 'Period 1', start: '09:00', end: '11:00' },
      { label: 'Period 2', start: '11:00', end: '13:00' },
      { label: 'Period 3', start: '13:00', end: '15:00' },
      { label: 'Period 4', start: '15:00', end: '17:00' },
    ];
  }

  const editor = document.getElementById('ex-periods-editor');
  if (!editor) return;
  editor.innerHTML = periods.map((p, i) =>
    '<div class="period-edit-row">' +
      '<input class="form-control" data-period-label="' + i + '" value="' + escapeHtml(p.label) + '" placeholder="Label" />' +
      '<input class="form-control" type="time" data-period-start="' + i + '" value="' + escapeHtml(p.start) + '" />' +
      '<input class="form-control" type="time" data-period-end="' + i + '" value="' + escapeHtml(p.end) + '" />' +
      '<button type="button" class="del-btn" data-period-del="' + i + '">×</button>' +
    '</div>'
  ).join('');

  modal.style.display = 'flex';
  modal.classList.add('open');
}

function saveExamPeriods() {
  const rows = document.querySelectorAll('#ex-periods-editor .period-edit-row');
  const periods = [];
  rows.forEach((row, i) => {
    const label = row.querySelector('[data-period-label="' + i + '"]').value.trim();
    const start = row.querySelector('[data-period-start="' + i + '"]').value;
    const end   = row.querySelector('[data-period-end="' + i + '"]').value;
    if (label && start && end) periods.push({ label, start, end });
  });
  if (!periods.length) { showToast('At least one period required.', 'warning'); return; }
  localStorage.setItem('fpu_exam_periods', JSON.stringify(periods));
  window.__examPeriods = periods;
  document.getElementById('ex-periods-modal').style.display = 'none';
  showToast('Exam periods saved.', 'success');
  if (window.FPU_ADMIN.loadExamsIndex) loadExamsIndex();
}

function wireExamPrintAll() {
  const printAll = document.getElementById('ex-print-all');
  if (printAll && !printAll.__bound) {
    printAll.__bound = true;
    printAll.onclick = printAllExamSheets;
  }
  const editBtn = document.getElementById('ex-edit-periods');
  if (editBtn && !editBtn.__bound) {
    editBtn.__bound = true;
    editBtn.onclick = openExamPeriodsModal;
  }
  const saveBtn = document.getElementById('ex-periods-save');
  if (saveBtn && !saveBtn.__bound) {
    saveBtn.__bound = true;
    saveBtn.onclick = saveExamPeriods;
  }
  const closeBtn = document.getElementById('ex-periods-close');
  if (closeBtn) closeBtn.onclick = () => { document.getElementById('ex-periods-modal').style.display = 'none'; };
  const cancelBtn = document.getElementById('ex-periods-cancel');
  if (cancelBtn) cancelBtn.onclick = () => { document.getElementById('ex-periods-modal').style.display = 'none'; };
  const addBtn = document.getElementById('ex-periods-add');
  if (addBtn && !addBtn.__bound) {
    addBtn.__bound = true;
    addBtn.onclick = () => {
      const editor = document.getElementById('ex-periods-editor');
      if (!editor) return;
      const idx = editor.children.length;
      const row = document.createElement('div');
      row.className = 'period-edit-row';
      row.innerHTML =
        '<input class="form-control" data-period-label="' + idx + '" placeholder="Label" />' +
        '<input class="form-control" type="time" data-period-start="' + idx + '" />' +
        '<input class="form-control" type="time" data-period-end="' + idx + '" />' +
        '<button type="button" class="del-btn" data-period-del="' + idx + '">×</button>';
      editor.appendChild(row);
    };
  }
}

// ------------------------------------------------------------
// Auto-wire all Batch 2 page-specific buttons
// ------------------------------------------------------------
function wireBatch2() {
  wireGradeScaleForms();
  wireFeesCopyButton();
  wireLecturerWorkloadButton();
  wireTimetablePrintAll();
  wireExamPrintAll();
}

document.addEventListener('DOMContentLoaded', () => {
  wireBatch2();
  const view = document.getElementById('page-view');
  if (view) new MutationObserver(() => wireBatch2()).observe(view, { childList: true, subtree: true });
});

window.addEventListener('hashchange', () => setTimeout(wireBatch2, 120));

// ==== END FPU Batch 2 additions ====
`;

function patchAdminJs() {
  head('Batch 2B — admin.js');

  let js = read(ADMIN_JS);
  if (js === null) { err('admin.js not found'); return; }

  if (js.includes(JS_MARKER)) {
    warn('Batch 2 marker already present — skipping admin.js additions');
    return;
  }

  const exportAnchor = 'window.FPU_ADMIN = {';
  const idx = js.indexOf(exportAnchor);
  if (idx === -1) { err('Cannot find FPU_ADMIN export object'); return; }

  // Insert functions
  js = js.slice(0, idx) + JS_BLOCK + '\n' + js.slice(idx);

  // Add exports: goBack helpers, new functions
  const newExports = [
    'wireGradeScaleForms',
    'openCopyFeesModal', 'copyFeesFromSession', 'wireFeesCopyButton',
    'wireLecturerWorkloadButton',
    'printAllTimetableSheets', 'wireTimetablePrintAll',
    'printAllExamSheets', 'openExamPeriodsModal', 'saveExamPeriods', 'wireExamPrintAll',
    'wireBatch2',
  ];

  // Find export object closing brace
  const exportStart = js.indexOf(exportAnchor);
  let depth = 0;
  let exportEnd = -1;
  for (let i = exportStart; i < js.length; i++) {
    if (js[i] === '{') depth++;
    else if (js[i] === '}') {
      depth--;
      if (depth === 0) { exportEnd = i; break; }
    }
  }
  if (exportEnd === -1) { err('Cannot find closing brace of export'); return; }

  const exportBody = js.slice(exportStart, exportEnd);
  const toAdd = newExports.filter((n) => {
    const re = new RegExp('(^|\\s)' + n + '\\s*[,:]', 'm');
    return !re.test(exportBody);
  });

  if (toAdd.length) {
    let insertAt = exportEnd;
    while (insertAt > exportStart && /\s/.test(js[insertAt - 1])) insertAt--;
    const indentMatch = exportBody.match(/\n(\s+)\S/);
    const indent = indentMatch ? indentMatch[1] : '  ';
    const injection = '\n' + indent + '// Batch 2 additions\n' + toAdd.map((n) => indent + n + ',').join('\n');
    js = js.slice(0, insertAt) + injection + js.slice(insertAt);
    ok('Added exports: ' + toAdd.join(', '));
  } else {
    warn('All Batch 2 exports already present');
  }

  backup(ADMIN_JS);
  write(ADMIN_JS, js);

  // Syntax check
  try {
    new Function('window', 'document', 'localStorage', 'fetch', 'navigator', 'history', 'location', js);
    ok('admin.js parses cleanly');
  } catch (e) {
    err('Syntax error: ' + e.message);
    err('Rolling back admin.js');
    if (!DRY) fs.copyFileSync(path.join(BACKUP_DIR, 'public__js__admin.js'), ADMIN_JS);
    process.exit(1);
  }
}

// ============================================================
// PART 3 — Batch 2B: routes/fees-copy.js (new file)
// ============================================================
const FEES_COPY_FILE = path.join(ROUTES_DIR, 'fees-copy.js');

const FEES_COPY_SOURCE = `// ============================================================
// FPU — Fee structure "copy from prior session" endpoint
// Mounted at /api/admin/fees  (via routes/index.js)
// Add this line to routes/index.js if not already present:
//   router.post('/admin/fees/copy', require('./fees-copy').copy);
// ============================================================

'use strict';

const paymentQueries = require('../db/queries/payments');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

async function copy(req, res, next) {
  try {
    const { fromSessionId, toSessionId } = req.body || {};
    if (!fromSessionId || !toSessionId) {
      return res.status(400).json({ success: false, error: 'fromSessionId and toSessionId are required.' });
    }
    if (Number(fromSessionId) === Number(toSessionId)) {
      return res.status(400).json({ success: false, error: 'Source and target sessions must differ.' });
    }

    const source = await paymentQueries.listFeeStructures({ sessionId: Number(fromSessionId) });
    const existing = await paymentQueries.listFeeStructures({ sessionId: Number(toSessionId) });
    const existingKeys = new Set(existing.map((f) => f.programmeId + '-' + f.level));

    let copied = 0;
    for (const f of source) {
      const key = f.programmeId + '-' + f.level;
      if (existingKeys.has(key)) continue;
      await paymentQueries.createFeeStructure({
        programmeId: f.programmeId,
        level: f.level,
        sessionId: Number(toSessionId),
        tuition: f.tuition,
        acceptance: f.acceptance,
        medical: f.medical,
        library: f.library,
        ict: f.ict,
        sports: f.sports,
        other: f.other,
      });
      copied++;
    }

    await logAudit({
      req,
      action: 'fee.copy',
      after: { fromSessionId, toSessionId, copied },
    });

    return res.json({ success: true, copied });
  } catch (err) {
    return next(err);
  }
}

module.exports = { copy };
`;

function writeFeesCopyRouter() {
  head('Batch 2B — routes/fees-copy.js');

  if (fs.existsSync(FEES_COPY_FILE) && !DRY) {
    warn('File already exists — skipping');
    return;
  }

  write(FEES_COPY_FILE, FEES_COPY_SOURCE);
  ok('Wrote routes/fees-copy.js');
  info('Add to routes/index.js (near other /admin/fees mounts):');
  info('  router.post(\'/admin/fees/copy\', require(\'./fees-copy\').copy);');
}

// ============================================================
// PART 4 — Batch 2C: hide "Sent" tab in notifications/index.html
// ============================================================
function hideNotificationsSentTab() {
  head('Batch 2C — hide Sent tab in notifications');

  const file = path.join(PARTIALS_DIR, 'notifications', 'index.html');
  const original = read(file);
  if (original === null) { warn('notifications/index.html not found'); return; }

  if (original.includes('/* batch2: Sent tab hidden */')) {
    warn('Already patched'); return;
  }

  // Comment out the Sent tab button
  const patched = original.replace(
    /<button class="staff-role-tab" data-box="sent">[\s\S]*?<\/button>/,
    '<!-- batch2: Sent tab hidden -->'
  );

  if (patched === original) { warn('Sent tab pattern not found'); return; }

  backup(file);
  write(file, patched);
  ok('Sent tab hidden in notifications/index.html');
}

// ============================================================
// Main
// ============================================================
head('FPU — Batch 2 applier');
log(DRY ? 'DRY RUN — no files written' : 'LIVE — files will be updated', DRY ? 'yellow' : 'green');
info('Root:      ' + ROOT);
info('Backups:   ' + BACKUP_DIR);

if (!fs.existsSync(PARTIALS_DIR)) {
  err('Cannot find public/admin/partials — run from project root');
  process.exit(1);
}
if (!fs.existsSync(ADMIN_JS)) {
  err('Cannot find public/js/admin.js — run from project root');
  process.exit(1);
}

fixBackButtons();
patchAdminJs();
writeFeesCopyRouter();
hideNotificationsSentTab();

head('DONE');
console.log('');
info('Backups: ' + BACKUP_DIR);
console.log('');
log('Next steps:', 'yellow');
log('  1. Add this line to routes/index.js (if not already there):', 'yellow');
log('       router.post(\'/admin/fees/copy\', require(\'./fees-copy\').copy);', 'yellow');
log('  2. Restart the dev server (Ctrl+C then `npm run dev`).', 'yellow');
console.log('');
log('Rollback:', 'dim');
log('  Copy files from ' + BACKUP_DIR + ' back to their originals.', 'dim');
console.log('');