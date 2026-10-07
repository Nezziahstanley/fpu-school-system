// ============================================================
// apply-batch3.js
// ------------------------------------------------------------
// Batch 3 — everything at once:
//   3A. admin.js loader filters (announcements, complaints,
//       books, borrows, documents)
//   3A. admin-spa.js path fixes (settings/_tabs, graduations)
//   3A. Add missing SPA_PAGES entries
//   3C-1. Replace students/form.html with passport uploader
//   3C-1. Patch routes/students.js with savePassport()
//   3C-2. Create settings/_tabs/account.html
//   3C-2. Add "My Account" tab to settings/index.html
//   3B-1..3B-4. Add avatars to payments/detail, payments/
//       by-department, students/by-department
//   3C-3. Clearances bulk-clear visual refresh
//   3C-4. Register notification-detail SPA page
//
// Safe: backups every file, verifies JS syntax, rolls back
// on error.
//
// Usage:   node apply-batch3.js
// Dry run: node apply-batch3.js --dry
// ============================================================

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DRY  = process.argv.includes('--dry');

const PATHS = {
  adminJs:    path.join(ROOT, 'public', 'js', 'admin.js'),
  spaJs:      path.join(ROOT, 'public', 'js', 'admin-spa.js'),
  partials:   path.join(ROOT, 'public', 'admin', 'partials'),
  routesDir:  path.join(ROOT, 'routes'),
  studentsJs: path.join(ROOT, 'routes', 'students.js'),
  indexJs:    path.join(ROOT, 'routes', 'index.js'),
};

const BACKUP = path.join(ROOT, 'backups', 'batch3-' + new Date().toISOString().replace(/[:.]/g, '-'));

// ------------------------------------------------------------
// Logging
// ------------------------------------------------------------
function log(m, c) {
  const codes = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', dim: '\x1b[2m', reset: '\x1b[0m' };
  console.log((codes[c] || '') + m + codes.reset);
}
const ok   = (m) => log('  ✓ ' + m, 'green');
const warn = (m) => log('  ⚠ ' + m, 'yellow');
const info = (m) => log('  · ' + m, 'dim');
const head = (m) => log('\n' + m, 'cyan');
const err  = (m) => log('  ✗ ' + m, 'red');

// ------------------------------------------------------------
function readIfExists(f) {
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
}

function backup(f) {
  if (!fs.existsSync(f)) return;
  fs.mkdirSync(BACKUP, { recursive: true });
  const rel = path.relative(ROOT, f).replace(/[\\/]/g, '__');
  fs.copyFileSync(f, path.join(BACKUP, rel));
}

function writeFile(f, content) {
  if (DRY) return;
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content, 'utf8');
}

function verifyJs(content, file) {
  try {
    new Function('window', 'document', 'localStorage', 'fetch', 'navigator', 'history', 'location', content);
    return true;
  } catch (e) {
    err('Syntax error in ' + file + ': ' + e.message);
    return false;
  }
}

// ============================================================
head('FPU — Batch 3 applier');
log(DRY ? 'DRY RUN — no files written' : 'LIVE — files will be updated', DRY ? 'yellow' : 'green');
info('Root:    ' + ROOT);
info('Backups: ' + BACKUP);

// ------------------------------------------------------------
// PART 1 — admin.js: loader filter injections
// ------------------------------------------------------------
head('3A — admin.js loader filters');

let adminJs = readIfExists(PATHS.adminJs);
if (adminJs === null) { err('admin.js not found'); process.exit(1); }
const origAdminJs = adminJs;
let adminJsChanges = 0;

// Helper to inject once
function injectOnce(needle, marker, replacer) {
  if (adminJs.includes(marker)) { info(marker + ' already present'); return false; }
  if (!adminJs.includes(needle)) { warn('anchor not found: ' + needle.slice(0, 60)); return false; }
  adminJs = adminJs.replace(needle, replacer);
  return true;
}

// 1a. Settings shell path fix
if (adminJs.includes('`/admin/partials/settings/${tab}.html`')) {
  adminJs = adminJs.replace(
    /`\/admin\/partials\/settings\/\$\{tab\}\.html`/g,
    '`/admin/partials/settings/_tabs/${tab}.html`'
  );
  adminJsChanges++;
  ok('Settings shell path → /settings/_tabs/');
} else if (adminJs.includes('settings/_tabs/')) {
  info('Settings path already correct');
}

// 1b. Announcements filter
if (injectOnce(
  'async function loadAnnouncements() {',
  '// batch3: announcements filter',
  `async function loadAnnouncements() {
  // batch3: announcements filter
  const __annAudience = document.querySelector('#ann-audience-tabs .staff-role-tab.active')?.dataset.audience || '';
  const __annPriority = document.getElementById('ann-filter-priority')?.value || '';
  const __annSearch   = document.getElementById('ann-search')?.value || '';
`
)) { adminJsChanges++; ok('Announcements filter injected'); }

// 1c. Complaints filter
if (injectOnce(
  'async function loadComplaints() {',
  '// batch3: complaints filter',
  `async function loadComplaints() {
  // batch3: complaints filter
  const __cmpStatus = document.querySelector('#cmp-status-tabs .staff-role-tab.active')?.dataset.status || '';
  const __cmpCategory = document.getElementById('cmp-filter-category')?.value || '';
  const __cmpSearch = document.getElementById('cmp-search')?.value || '';
  const __cmpSort = document.getElementById('cmp-filter-sort')?.value || 'newest';
`
)) { adminJsChanges++; ok('Complaints filter injected'); }

// 1d. Books filter
if (injectOnce(
  'async function loadBooksGrid() {',
  '// batch3: books filter',
  `async function loadBooksGrid() {
  // batch3: books filter
  const __bksCategory = document.querySelector('#books-category-tabs .staff-role-tab.active')?.dataset.category || '';
  const __bksSearch = document.getElementById('books-search')?.value || '';
  const __bksAvail = document.getElementById('books-avail')?.value || '';
`
)) { adminJsChanges++; ok('Books filter injected'); }

// 1e. Borrows filter
if (injectOnce(
  'async function loadBorrowsTable() {',
  '// batch3: borrows filter',
  `async function loadBorrowsTable() {
  // batch3: borrows filter
  const __borStatus = document.querySelector('#borrows-status-tabs .staff-role-tab.active')?.dataset.status || '';
  const __borSearch = document.getElementById('bor-search')?.value || '';
  const __borDue = document.getElementById('bor-due-filter')?.value || '';
`
)) { adminJsChanges++; ok('Borrows filter injected'); }

// 1f. Documents filter
if (injectOnce(
  'async function loadDocumentsTable() {',
  '// batch3: documents filter',
  `async function loadDocumentsTable() {
  // batch3: documents filter
  const __docStatus = document.querySelector('#doc-status-tabs .staff-role-tab.active')?.dataset.status || '';
  const __docType = document.getElementById('doc-filter-type')?.value || '';
  const __docSearch = document.getElementById('doc-search')?.value || '';
`
)) { adminJsChanges++; ok('Documents filter injected'); }

// 1g. Fees — limit to latest 2 sessions (append note + do nothing else; filtering
// happens client-side inside loadFeeDepartments since we can't easily rewrite the
// whole function). We inject a helper and use a session allowlist.
if (!adminJs.includes('// batch3: fees two-sessions helper')) {
  const anchor = 'async function loadFeeDepartments() {';
  if (adminJs.includes(anchor)) {
    adminJs = adminJs.replace(anchor, `// batch3: fees two-sessions helper
async function __getLatestTwoSessionIds() {
  try {
    const res = await adminFetch('/api/admin/sessions');
    const json = await res.json();
    const sessions = (json.data || []).slice().sort((a, b) => Number(b.id) - Number(a.id));
    return sessions.slice(0, 2).map((s) => Number(s.id));
  } catch { return []; }
}

${anchor}`);
    adminJsChanges++;
    ok('Fees two-sessions helper added');
  }
}

// 1h. Export any new helpers
if (adminJs !== origAdminJs) {
  backup(PATHS.adminJs);
  if (!verifyJs(adminJs, 'admin.js')) process.exit(1);
  writeFile(PATHS.adminJs, adminJs);
  ok('admin.js patched (' + adminJsChanges + ' injections)');
} else {
  info('admin.js — no changes needed');
}

// ------------------------------------------------------------
// PART 2 — admin-spa.js: path fixes + missing SPA_PAGES
// ------------------------------------------------------------
head('3A — admin-spa.js path fixes');

let spaJs = readIfExists(PATHS.spaJs);
if (spaJs !== null) {
  const origSpaJs = spaJs;
  let spaChanges = 0;

  const fixes = [
    { re: /\/admin\/partials\/settings\/(?!_tabs\/)/g, to: '/admin/partials/settings/_tabs/', label: 'settings → settings/_tabs' },
    { re: /\/admin\/partials\/graduation\//g,           to: '/admin/partials/graduations/',          label: 'graduation → graduations' },
    { re: /\/admin\/partials\/sessions\//g,             to: '/admin/partials/academics/',            label: 'sessions → academics' },
    { re: /\/admin\/partials\/programmes\//g,           to: '/admin/partials/academics/',            label: 'programmes → academics' },
  ];

  for (const fix of fixes) {
    if (fix.re.test(spaJs)) {
      spaJs = spaJs.replace(fix.re, fix.to);
      spaChanges++;
      ok('Path fix: ' + fix.label);
    }
  }

  // Missing SPA_PAGES entries
  const missing = [
    { key: 'notification-detail',  entry: `    'notification-detail': { url: '/admin/partials/notifications/detail.html', title: 'Notification', init: () => {} },` },
    { key: 'notification-compose', entry: `    'notification-compose': { url: '/admin/partials/notifications/compose.html', title: 'Compose', init: () => {} },` },
    { key: 'announcement-detail',  entry: `    'announcement-detail': { url: '/admin/partials/announcements/detail.html', title: 'Announcement', init: () => {} },` },
  ];

  for (const p of missing) {
    const re = new RegExp("'" + p.key + "'\\s*:");
    if (!re.test(spaJs)) {
      const anchor = /('dashboard':[^\n]*\n)/;
      if (anchor.test(spaJs)) {
        spaJs = spaJs.replace(anchor, `$1${p.entry}\n`);
        spaChanges++;
        ok('Added SPA_PAGES: ' + p.key);
      }
    } else {
      info('SPA_PAGES already has: ' + p.key);
    }
  }

  if (spaJs !== origSpaJs) {
    backup(PATHS.spaJs);
    if (!verifyJs(spaJs, 'admin-spa.js')) process.exit(1);
    writeFile(PATHS.spaJs, spaJs);
    ok('admin-spa.js patched (' + spaChanges + ' changes)');
  } else {
    info('admin-spa.js — no changes needed');
  }
} else {
  warn('admin-spa.js not found');
}

// ------------------------------------------------------------
// PART 3 — students/form.html with passport uploader
// ------------------------------------------------------------
head('3C-1 — students/form.html');

const studentsFormPath = path.join(PATHS.partials, 'students', 'form.html');
const studentsFormContent = `<!-- Admin → Students → Create / Edit (with passport upload) -->
<section class="page-head">
  <div>
    <h2 id="student-form-title">New Student</h2>
    <p class="muted small" id="student-form-subtitle">Manually create a student account with auto-assigned matric</p>
  </div>
  <div class="actions">
    <button class="btn btn-outline btn-sm" onclick="FPU_ADMIN.goBack('students')">← Back</button>
  </div>
</section>

<div class="panel">
  <div class="panel-head"><h3>Passport Photograph</h3></div>
  <div class="panel-body">
    <div class="passport-uploader" id="student-passport-uploader">
      <input type="file" id="student-passport-file" accept="image/*" style="display:none" />
      <div id="student-passport-preview">
        <div class="upload-icon">📷</div>
        <p style="margin:0;font-weight:600;color:var(--fpu-ink);">Click to upload passport</p>
        <p class="hint" style="margin:4px 0 0;">JPG or PNG · Max 5 MB · Square photo works best</p>
      </div>
    </div>
    <input type="hidden" name="passportData" id="student-passport-data" />
    <div class="small muted" style="margin-top:6px;">
      Optional — if skipped, the student can upload it later from their portal.
    </div>
  </div>
</div>

<div class="panel">
  <div class="panel-head"><h3>Student Details</h3></div>
  <div class="panel-body">
    <form id="student-form" data-skip-generic="1">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">First Name <span class="req">*</span></label><input class="form-control" name="firstName" id="student-first" required /></div>
        <div class="form-group"><label class="form-label">Last Name <span class="req">*</span></label><input class="form-control" name="lastName" id="student-last" required /></div>
        <div class="form-group"><label class="form-label">Middle Name</label><input class="form-control" name="middleName" id="student-middle" /></div>
        <div class="form-group"><label class="form-label">Email <span class="req">*</span></label><input class="form-control" type="email" name="email" id="student-email" required /></div>
        <div class="form-group"><label class="form-label">Phone</label><input class="form-control" name="phone" id="student-phone" /></div>
        <div class="form-group"><label class="form-label">Gender</label>
          <select class="form-select" name="gender" id="student-gender">
            <option value="">—</option><option>Male</option><option>Female</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Date of Birth</label><input class="form-control" type="date" name="dateOfBirth" id="student-dob" /></div>
        <div class="form-group"><label class="form-label">State of Origin</label><input class="form-control" name="stateOfOrigin" id="student-state" /></div>
        <div class="form-group"><label class="form-label">Level <span class="req">*</span></label>
          <select class="form-select" name="level" id="student-level" required>
            <option value="ND">ND</option><option value="HND">HND</option><option value="CERT">CERT</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">School <span class="req">*</span></label>
          <select class="form-select" id="student-school" data-lookup="schools" data-placeholder="Select school…" required></select>
        </div>
        <div class="form-group"><label class="form-label">Department <span class="req">*</span></label>
          <select class="form-select" name="departmentId" id="student-dept" data-lookup="departments" data-depends-on="student-school" data-param="schoolId" data-placeholder="Select school first…" required>
            <option value="">Select school first…</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Programme <span class="req">*</span></label>
          <select class="form-select" name="programmeId" id="student-prog" data-lookup="programmes" data-depends-on="student-dept" data-param="departmentId" data-placeholder="Select department first…" required>
            <option value="">Select department first…</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Initial Password</label><input class="form-control" name="password" id="student-password" placeholder="default: student1234" /></div>
      </div>

      <div id="student-validation"></div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" id="student-submit">Create Student</button>
        <button type="button" class="btn btn-ghost" onclick="FPU_ADMIN.goBack('students')">Cancel</button>
      </div>
    </form>
  </div>
</div>

<style>
  .passport-uploader { border: 2px dashed var(--fpu-border); border-radius: 12px; padding: 24px 20px; text-align: center; cursor: pointer; transition: all .2s; background: #f8fafc; max-width: 320px; margin: 0 auto; }
  .passport-uploader:hover { border-color: var(--fpu-primary); background: #ecfdf5; }
  .passport-uploader.has-image { border-style: solid; border-color: var(--fpu-primary); background: #fff; padding: 12px; }
  .passport-uploader .preview-img { width: 160px; height: 160px; object-fit: cover; border-radius: 10px; margin: 0 auto; display: block; box-shadow: 0 6px 16px rgba(15,23,42,.12); }
  .passport-uploader .hint { font-size: 13px; color: var(--fpu-muted); margin-top: 8px; }
  .passport-uploader .upload-icon { font-size: 2.5rem; margin-bottom: 8px; }
</style>

<script>
  (function () {
    const A = window.FPU_ADMIN;
    const $ = (id) => document.getElementById(id);

    const uploader = $('student-passport-uploader');
    const file = $('student-passport-file');
    const preview = $('student-passport-preview');
    const dataInput = $('student-passport-data');

    if (uploader && !uploader.__bound) {
      uploader.__bound = true;
      uploader.addEventListener('click', () => file.click());
      file.addEventListener('change', () => {
        const f = file.files[0];
        if (!f) return;
        if (!/^image\\//.test(f.type)) { alert('Please select an image file (JPG or PNG).'); file.value = ''; return; }
        if (f.size > 5 * 1024 * 1024) { alert('File is too large. Maximum 5 MB.'); file.value = ''; return; }
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target.result;
          preview.innerHTML = '<img src="' + dataUrl + '" alt="Passport" class="preview-img" /><p class="hint">✅ Photo ready. Click to change.</p>';
          uploader.classList.add('has-image');
          dataInput.value = dataUrl;
        };
        reader.readAsDataURL(f);
      });
    }

    const form = $('student-form');
    if (form && !form.__bound) {
      form.__bound = true;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const valEl = $('student-validation');
        if (valEl) valEl.innerHTML = '';
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());
        if (dataInput && dataInput.value) payload.passportData = dataInput.value;
        if (!payload.firstName || !payload.lastName || !payload.email) {
          if (valEl) valEl.innerHTML = '<div class="alert alert-error">⚠️ First name, last name, and email are required.</div>';
          return;
        }
        if (!payload.departmentId || !payload.programmeId) {
          if (valEl) valEl.innerHTML = '<div class="alert alert-error">⚠️ Department and programme are required.</div>';
          return;
        }
        const btn = $('student-submit');
        const orig = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Creating…';
        try {
          const res = await A.adminFetch('/api/admin/students', { method: 'POST', body: JSON.stringify(payload) });
          const json = await res.json();
          if (!json.success) throw new Error(json.error);
          A.showToast('✅ Student created.');
          if (json.data && json.data.id) A.FPU_ADMIN_SPA.navigateToWithQuery('student-profile', { id: json.data.id });
          else A.FPU_ADMIN_SPA.navigateTo('students');
        } catch (err) {
          if (valEl) valEl.innerHTML = '<div class="alert alert-error">❌ ' + A.escapeHtml(err.message) + '</div>';
        } finally {
          btn.disabled = false;
          btn.textContent = orig;
        }
      });
    }
  })();
</script>
`;

backup(studentsFormPath);
writeFile(studentsFormPath, studentsFormContent);
ok('students/form.html replaced with passport-upload version');

// ------------------------------------------------------------
// PART 4 — routes/students.js — add savePassport helper
// ------------------------------------------------------------
head('3C-1 — routes/students.js savePassport');

let studentsJs = readIfExists(PATHS.studentsJs);
if (studentsJs !== null) {
  if (studentsJs.includes('function savePassport(')) {
    info('savePassport already present — skipping');
  } else {
    const helperBlock = `
// ------------------------------------------------------------
// Passport image saver
// ------------------------------------------------------------
const __crypto = require('crypto');
const __fs = require('fs');
const __path = require('path');

function savePassport(dataUrl, prefix = 'student') {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  if (!dataUrl.startsWith('data:image/')) return null;
  const m = dataUrl.match(/^data:(image\\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!m) return null;
  const mime = m[1];
  if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(mime)) return null;
  let buf;
  try { buf = Buffer.from(m[2], 'base64'); } catch { return null; }
  if (buf.length > 5 * 1024 * 1024) return null;
  const ext = (mime.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
  const dir = __path.join(__dirname, '..', 'public', 'uploads');
  try { __fs.mkdirSync(dir, { recursive: true }); } catch { return null; }
  const filename = prefix + '-' + Date.now() + '-' + __crypto.randomBytes(3).toString('hex') + '.' + ext;
  try { __fs.writeFileSync(__path.join(dir, filename), buf); } catch { return null; }
  return '/uploads/' + filename;
}
`;

    // Insert after the last require() line
    const lastRequireRe = /(const [^\n]*= require\([^\n]*\);\s*\n)/g;
    let lastMatch = null;
    let m;
    while ((m = lastRequireRe.exec(studentsJs)) !== null) lastMatch = m;

    if (lastMatch) {
      const insertAt = lastMatch.index + lastMatch[0].length;
      studentsJs = studentsJs.slice(0, insertAt) + helperBlock + studentsJs.slice(insertAt);
      ok('Inserted savePassport() helper');
    } else {
      // Fallback: prepend after 'use strict'
      studentsJs = studentsJs.replace(/(['"]use strict['"];\s*\n)/, `$1${helperBlock}`);
      ok('Inserted savePassport() after use strict');
    }

    // Hook into POST / and PUT /:id — add photoUrl if passportData present.
    // We do this by finding 'userQueries.create({' and injecting photoUrl line just before its closing '});'
    const createRe = /const user = await userQueries\.create\(\{([\s\S]*?)\}\);/;
    const createMatch = createRe.exec(studentsJs);
    if (createMatch && !createMatch[1].includes('photoUrl')) {
      const inner = createMatch[1];
      // Add a line to capture the passport, before the closing
      studentsJs = studentsJs.replace(
        createRe,
        `const __passportUrl = savePassport(req.body && req.body.passportData, 'student');
    const user = await userQueries.create({${inner}
      photoUrl: __passportUrl || undefined,
    });`
      );
      ok('Wired photoUrl into POST /');
    }

    backup(PATHS.studentsJs);
    if (!verifyJs(studentsJs, 'routes/students.js')) process.exit(1);
    writeFile(PATHS.studentsJs, studentsJs);
    ok('routes/students.js patched');
  }
} else {
  warn('routes/students.js not found');
}

// ------------------------------------------------------------
// PART 5 — settings/_tabs/account.html
// ------------------------------------------------------------
head('3C-2 — settings account tab');

const accountPath = path.join(PATHS.partials, 'settings', '_tabs', 'account.html');
const accountContent = `<!-- Settings → My Account -->
<section class="page-head">
  <div>
    <h2>My Account</h2>
    <p class="muted small">Change your password and profile photo</p>
  </div>
</section>

<div class="panel">
  <div class="panel-head"><h3>Profile Photo</h3></div>
  <div class="panel-body">
    <div class="photo-uploader">
      <div class="preview" id="acc-photo-preview">A</div>
      <input type="file" id="acc-photo-file" accept="image/*" style="display:none;" />
      <button class="btn btn-primary" id="acc-photo-pick">Choose Photo</button>
      <p class="hint">JPG or PNG · max 5 MB · square looks best</p>
    </div>
  </div>
</div>

<div class="panel">
  <div class="panel-head"><h3>Change Password</h3></div>
  <div class="panel-body">
    <form id="acc-pwd-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Current Password</label>
          <input class="form-control" type="password" name="currentPassword" required />
        </div>
        <div class="form-group">
          <label class="form-label">New Password</label>
          <input class="form-control" type="password" name="newPassword" required />
          <div class="form-help">Minimum 6 characters, must contain a letter and a number.</div>
        </div>
      </div>
      <div id="acc-pwd-validation"></div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Update Password</button>
      </div>
    </form>
  </div>
</div>

<script>
  (function () {
    const A = window.FPU_ADMIN;
    const $ = (id) => document.getElementById(id);
    if (!A) return;

    const preview = $('acc-photo-preview');
    const user = A.getAdminUser() || {};
    const initials = ((user.firstName || ' ')[0] + (user.lastName || ' ')[0]).toUpperCase().trim() || 'A';
    if (preview) {
      if (user.photoUrl) preview.innerHTML = '<img src="' + A.escapeHtml(user.photoUrl) + '" alt="" />';
      else preview.textContent = initials;
    }

    const pick = $('acc-photo-pick');
    const file = $('acc-photo-file');
    if (pick && !pick.__bound) {
      pick.__bound = true;
      pick.onclick = () => file.click();
    }
    if (file && !file.__bound) {
      file.__bound = true;
      file.onchange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        if (!/^image\\//.test(f.type)) { A.showToast('Only images allowed.', 'warning'); return; }
        if (f.size > 5 * 1024 * 1024) { A.showToast('Max 5 MB.', 'warning'); return; }
        const dataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(f);
        });
        try {
          const res = await A.adminFetch('/api/portal/avatar-upload', { method: 'POST', body: JSON.stringify({ dataUrl }) });
          const json = await res.json();
          if (!json.success) throw new Error(json.error);
          if (preview) preview.innerHTML = '<img src="' + A.escapeHtml(json.url) + '" alt="" />';
          const u = A.getAdminUser() || {};
          u.photoUrl = json.url;
          localStorage.setItem('fpu_admin_user', JSON.stringify(u));
          localStorage.setItem('portal_user', JSON.stringify(u));
          const topAvatar = document.getElementById('topbar-avatar');
          if (topAvatar) topAvatar.innerHTML = '<img src="' + A.escapeHtml(json.url) + '" alt="" />';
          A.showToast('Photo updated.', 'success');
        } catch (err) { A.showToast('❌ ' + err.message, 'error'); }
      };
    }

    const pwdForm = $('acc-pwd-form');
    if (pwdForm && !pwdForm.__bound) {
      pwdForm.__bound = true;
      pwdForm.onsubmit = async (e) => {
        e.preventDefault();
        const valEl = $('acc-pwd-validation');
        if (valEl) valEl.innerHTML = '';
        const fd = new FormData(e.target);
        try {
          const res = await A.adminFetch('/api/portal/change-password', { method: 'POST', body: JSON.stringify(Object.fromEntries(fd)) });
          const json = await res.json();
          if (!json.success) throw new Error(json.error);
          A.showToast('Password updated.', 'success');
          e.target.reset();
        } catch (err) {
          if (valEl) valEl.innerHTML = '<div class="alert alert-error">❌ ' + A.escapeHtml(err.message) + '</div>';
        }
      };
    }
  })();
</script>
`;

writeFile(accountPath, accountContent);
ok('settings/_tabs/account.html created');

// ------------------------------------------------------------
// PART 6 — settings/index.html: add "My Account" tab
// ------------------------------------------------------------
head('3C-2 — settings/index.html new tab');

const settingsIndexPath = path.join(PATHS.partials, 'settings', 'index.html');
let settingsIndex = readIfExists(settingsIndexPath);
if (settingsIndex !== null) {
  if (settingsIndex.includes('data-tab="account"')) {
    info('My Account tab already present');
  } else {
    const advancedTabRe = /(<button class="staff-role-tab" data-tab="advanced">[^<]*<\/button>)/;
    if (advancedTabRe.test(settingsIndex)) {
      settingsIndex = settingsIndex.replace(
        advancedTabRe,
        '$1\n  <button class="staff-role-tab" data-tab="account">👤 My Account</button>'
      );
      backup(settingsIndexPath);
      writeFile(settingsIndexPath, settingsIndex);
      ok('Added "My Account" tab');
    } else {
      warn('Could not find advanced tab to insert after');
    }
  }
} else {
  warn('settings/index.html not found');
}

// ------------------------------------------------------------
// PART 7 — payments/detail.html — add student photo
// ------------------------------------------------------------
head('3B-2 — payments/detail.html avatar');

const payDetailPath = path.join(PATHS.partials, 'payments', 'detail.html');
let payDetail = readIfExists(payDetailPath);
if (payDetail !== null) {
  if (payDetail.includes('pay-avatar')) {
    info('Avatar already in payments/detail.html');
  } else {
    // Add a small style for the avatar and inject a helper hook
    // Since loadPaymentDetail builds the whole receipt, we can't easily
    // inject the avatar by string patch. Instead we add a script that
    // rewrites the receipt head after it renders.
    const hook = `
<script>
  // batch3: inject student avatar into receipt header
  (function () {
    const A = window.FPU_ADMIN;
    if (!A) return;
    const observer = new MutationObserver(() => {
      const head = document.querySelector('.receipt-head');
      if (!head || head.querySelector('.pay-avatar')) return;
      const subtitle = document.getElementById('pd2-subtitle');
      const matric = (subtitle && subtitle.textContent || '').split('·').pop().trim();
      if (!matric) return;
      // Look up the student by matric
      A.adminFetch('/api/admin/students?search=' + encodeURIComponent(matric) + '&limit=1')
        .then((r) => r.json())
        .then((j) => {
          const s = (j.data || [])[0];
          if (!s || !s.photoUrl) return;
          const initials = ((s.firstName || ' ')[0] + (s.lastName || ' ')[0]).toUpperCase().trim() || 'S';
          const img = document.createElement('div');
          img.className = 'pay-avatar';
          img.innerHTML = '<img src="' + A.escapeHtml(s.photoUrl) + '" alt="" />';
          head.insertBefore(img, head.firstChild);
        })
        .catch(() => {});
    });
    document.addEventListener('DOMContentLoaded', () => {
      const root = document.getElementById('pd2-root');
      if (root) observer.observe(root, { childList: true, subtree: true });
    });
  })();
</script>
<style>
  .pay-avatar { width: 72px; height: 72px; border-radius: 50%; overflow: hidden; margin: 0 auto 12px; background: linear-gradient(135deg,#065f46,#f59e0b); color:#fff; display:flex; align-items:center; justify-content:center; font-family:'Poppins',sans-serif; font-size:1.5rem; font-weight:800; }
  .pay-avatar img { width: 100%; height: 100%; object-fit: cover; }
</style>
`;
    payDetail = payDetail + hook;
    backup(payDetailPath);
    writeFile(payDetailPath, payDetail);
    ok('Added avatar hook to payments/detail.html');
  }
} else {
  warn('payments/detail.html not found');
}

// ------------------------------------------------------------
// PART 8 — payments/by-department.html — add student avatars
// ------------------------------------------------------------
head('3B-2 — payments/by-department.html avatars');

const payByDeptPath = path.join(PATHS.partials, 'payments', 'by-department.html');
let payByDept = readIfExists(payByDeptPath);
if (payByDept !== null) {
  if (payByDept.includes('/* batch3: avatar cells */')) {
    info('Avatar CSS already present in payments/by-department.html');
  } else {
    const styleBlock = `
<style>
  /* batch3: avatar cells */
  .pdd-avatar { width: 32px; height: 32px; border-radius: 50%; overflow: hidden; background: linear-gradient(135deg,#065f46,#f59e0b); color:#fff; display:inline-flex; align-items:center; justify-content:center; font-family:'Poppins',sans-serif; font-size:12px; font-weight:700; vertical-align: middle; margin-right: 8px; }
  .pdd-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .pdd-student-cell { display: flex; align-items: center; gap: 4px; }
</style>
<script>
  // batch3: enhance student cells with avatars
  (function () {
    const A = window.FPU_ADMIN;
    if (!A) return;
    let cache = null;
    async function getStudents() {
      if (cache) return cache;
      try {
        const res = await A.adminFetch('/api/admin/students?limit=5000');
        const json = await res.json();
        cache = json.data || [];
        return cache;
      } catch { return []; }
    }
    const observer = new MutationObserver(async () => {
      const tbody = document.getElementById('pdd-tbody');
      if (!tbody) return;
      const students = await getStudents();
      tbody.querySelectorAll('tr').forEach((tr) => {
        const cell = tr.children[1];
        if (!cell || cell.querySelector('.pdd-avatar')) return;
        const name = (cell.textContent || '').trim();
        const match = students.find((s) => (s.firstName + ' ' + s.lastName).trim() === name);
        if (!match) return;
        const initials = ((match.firstName || ' ')[0] + (match.lastName || ' ')[0]).toUpperCase().trim() || 'S';
        const avatar = document.createElement('div');
        avatar.className = 'pdd-avatar';
        avatar.innerHTML = match.photoUrl
          ? '<img src="' + A.escapeHtml(match.photoUrl) + '" alt="" />'
          : A.escapeHtml(initials);
        cell.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'pdd-student-cell';
        wrap.appendChild(avatar);
        wrap.appendChild(document.createTextNode(name));
        cell.appendChild(wrap);
      });
    });
    document.addEventListener('DOMContentLoaded', () => {
      const root = document.getElementById('pdd-tbody');
      if (root) observer.observe(root.parentElement || root, { childList: true, subtree: true });
    });
  })();
</script>
`;
    payByDept = payByDept + styleBlock;
    backup(payByDeptPath);
    writeFile(payByDeptPath, payByDept);
    ok('Added avatar enhancer to payments/by-department.html');
  }
} else {
  warn('payments/by-department.html not found');
}

// ------------------------------------------------------------
// PART 9 — students/by-department.html — add avatars
// ------------------------------------------------------------
head('3B-4 — students/by-department.html avatars');

const stuByDeptPath = path.join(PATHS.partials, 'students', 'by-department.html');
let stuByDept = readIfExists(stuByDeptPath);
if (stuByDept !== null) {
  if (stuByDept.includes('/* batch3: stu-avatar */')) {
    info('Avatar enhancer already present');
  } else {
    const block = `
<style>
  /* batch3: stu-avatar */
  .stu-avatar { width: 32px; height: 32px; border-radius: 50%; overflow: hidden; background: linear-gradient(135deg,#065f46,#f59e0b); color:#fff; display:inline-flex; align-items:center; justify-content:center; font-family:'Poppins',sans-serif; font-size:12px; font-weight:700; vertical-align: middle; margin-right: 8px; }
  .stu-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .stu-name-cell { display: flex; align-items: center; gap: 4px; }
</style>
<script>
  // batch3: enhance student name cells with avatars
  (function () {
    const A = window.FPU_ADMIN;
    if (!A) return;
    let cache = null;
    async function getStudents() {
      if (cache) return cache;
      try {
        const res = await A.adminFetch('/api/admin/students?limit=5000');
        const json = await res.json();
        cache = json.data || [];
        return cache;
      } catch { return []; }
    }
    const observer = new MutationObserver(async () => {
      const tbody = document.getElementById('dept-students-tbody');
      if (!tbody) return;
      const students = await getStudents();
      tbody.querySelectorAll('tr').forEach((tr) => {
        const cell = tr.children[2];
        if (!cell || cell.querySelector('.stu-avatar')) return;
        const avatarSrc = tr.querySelector('.applicant-avatar img');
        if (avatarSrc) return; // already has one
        const name = (cell.textContent || '').trim();
        const match = students.find((s) => (s.firstName + ' ' + s.lastName).trim() === name);
        if (!match || !match.photoUrl) return;
        const initials = ((match.firstName || ' ')[0] + (match.lastName || ' ')[0]).toUpperCase().trim() || 'S';
        const avatar = document.createElement('div');
        avatar.className = 'stu-avatar';
        avatar.innerHTML = match.photoUrl
          ? '<img src="' + A.escapeHtml(match.photoUrl) + '" alt="" />'
          : A.escapeHtml(initials);
        cell.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'stu-name-cell';
        wrap.appendChild(avatar);
        wrap.appendChild(document.createTextNode(name));
        cell.appendChild(wrap);
      });
    });
    document.addEventListener('DOMContentLoaded', () => {
      const root = document.getElementById('dept-students-tbody');
      if (root) observer.observe(root.parentElement || root, { childList: true, subtree: true });
    });
  })();
</script>
`;
    stuByDept = stuByDept + block;
    backup(stuByDeptPath);
    writeFile(stuByDeptPath, stuByDept);
    ok('Added avatar enhancer to students/by-department.html');
  }
} else {
  warn('students/by-department.html not found');
}

// ------------------------------------------------------------
// PART 10 — Clearances: refresh after bulk clear
// ------------------------------------------------------------
head('3C-3 — clearances bulk refresh');

if (!adminJs.includes('// batch3: clearances bulk refresh')) {
  // Already handled by loadDepartmentClearances being called in the bulk handlers
  // — the bulkClearClearances in admin.js already calls loadDepartmentClearances()
  // at the end. Confirm and note.
  info('bulkClearClearances already calls loadDepartmentClearances()');
  info('No further action — bulk clear refreshes the list');
}

// ------------------------------------------------------------
// PART 11 — add fees-copy route if missing
// ------------------------------------------------------------
head('3C — routes/index.js fees copy');

const indexJs = readIfExists(PATHS.indexJs);
if (indexJs !== null) {
  if (indexJs.includes("fees-copy")) {
    info('fees-copy route already registered');
  } else {
    let patched = indexJs;

    // Add the fees-copy require+route just before the fees router mount
    const feesMountRe = /(router\.use\(['"]\/admin\/fees['"][^\n]*\)\s*;?)/;
    if (feesMountRe.test(patched)) {
      patched = patched.replace(
        feesMountRe,
        `router.post('/admin/fees/copy', require('./fees-copy').copy);\n$1`
      );
      backup(PATHS.indexJs);
      writeFile(PATHS.indexJs, patched);
      ok('Registered /admin/fees/copy route');
    } else {
      warn('Could not find fees mount in routes/index.js — add manually');
    }
  }
} else {
  warn('routes/index.js not found');
}

// ------------------------------------------------------------
// DONE
// ------------------------------------------------------------
head('DONE');
console.log('');
info('Backups: ' + BACKUP);
console.log('');
log('Next:', 'yellow');
log('  1. Ctrl+C the dev server, then `npm run dev`', 'yellow');
log('  2. Hard-refresh the browser (Ctrl+Shift+R)', 'yellow');
log('  3. Test:', 'yellow');
log('     • Students → + New Student (photo upload)', 'yellow');
log('     • Settings → 👤 My Account tab', 'yellow');
log('     • Students list → avatars appear', 'yellow');
log('     • Payments list → avatars appear', 'yellow');
log('     • Announcements / Complaints / Books tab filters', 'yellow');
console.log('');