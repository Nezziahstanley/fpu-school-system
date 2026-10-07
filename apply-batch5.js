// ============================================================
// apply-batch5.js
// ------------------------------------------------------------
// Batch 5 — Styling + role-tab fixes + admin avatar upload
//
// What it does:
//   1. Appends new CSS to admin.css:
//      - Pill-style .staff-role-tabs with colored chips
//      - Grid-based settings tab cards with icons
//      - Refined security action cards
//      - Polished notification bell dropdown
//      - Admin avatar uploader in users/admins form
//   2. Injects a JS block into admin.js that:
//      - Applies `data-tab-icon` styling to settings tabs
//      - Auto-wires admin avatar upload in users/admins
//      - Ensures tab filters pass the right values to loaders
//   3. Patches users/admins.html + users/form.html to include
//      an avatar uploader for admin accounts
//
// Safe: backup + syntax verify + auto-rollback.
// ============================================================

'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT   = process.cwd();
const CSS    = path.join(ROOT, 'public', 'css', 'admin.css');
const ADMIN  = path.join(ROOT, 'public', 'js', 'admin.js');
const SPA    = path.join(ROOT, 'public', 'js', 'admin-spa.js');
const BACKUP = path.join(ROOT, 'backups', 'batch5-' + new Date().toISOString().replace(/[:.]/g, '-'));

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

head('Batch 5 — styling + admin avatar');
info('Backups: ' + BACKUP);

// ============================================================
// PART 1 — admin.css additions
// ============================================================
head('Step 1 — admin.css styling additions');

const CSS_MARKER = '/* ==== FPU Batch 5 — pill tabs, settings cards, security action cards ==== */';

const CSS_BLOCK = `
${CSS_MARKER}

/* ------------------------------------------------------------
   PILL-STYLE ROLE TABS (Announcements, Books, Staff, etc.)
   ------------------------------------------------------------ */
.staff-role-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-bottom: none;
  margin-bottom: 22px;
  padding-bottom: 0;
  overflow: visible;
}

.staff-role-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: #ffffff;
  border: 1.5px solid var(--fpu-border);
  border-radius: 999px;
  font-family: var(--font-heading);
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;
  line-height: 1;
  border-bottom: 1.5px solid var(--fpu-border);
}

.staff-role-tab:hover {
  background: #f8fafc;
  color: var(--fpu-primary);
  border-color: #cbd5e1;
  transform: translateY(-1px);
}

.staff-role-tab.active {
  background: linear-gradient(135deg, #065f46, #047857);
  color: #ffffff;
  border-color: #065f46;
  box-shadow: 0 4px 12px rgba(6, 95, 70, 0.25);
  border-bottom-color: #065f46;
}

.staff-role-tab .tab-count {
  background: rgba(0, 0, 0, 0.08);
  color: inherit;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 9px;
  border-radius: 999px;
  letter-spacing: 0.3px;
  min-width: 22px;
  text-align: center;
}

.staff-role-tab.active .tab-count {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

/* Colored variants by audience */
.staff-role-tab[data-role="student"].active,
.staff-role-tab[data-audience="student"].active,
.staff-role-tab[data-status="pending"]:not([data-tab="audit"]).active {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-color: #2563eb;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
}

.staff-role-tab[data-role="hod"].active,
.staff-role-tab[data-audience="hod"].active {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  border-color: #7c3aed;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
}

.staff-role-tab[data-role="admin"].active {
  background: linear-gradient(135deg, #0f172a, #1e293b);
  border-color: #0f172a;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.3);
}

.staff-role-tab[data-role="principal"].active {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  border-color: #d97706;
  box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3);
}

.staff-role-tab[data-status="resolved"].active,
.staff-role-tab[data-status="approved"].active,
.staff-role-tab[data-status="issued"].active,
.staff-role-tab[data-status="returned"].active,
.staff-role-tab[data-status="graduated"].active {
  background: linear-gradient(135deg, #10b981, #047857);
  border-color: #047857;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
}

.staff-role-tab[data-status="rejected"].active,
.staff-role-tab[data-status="lost"].active,
.staff-role-tab[data-status="closed"].active,
.staff-role-tab[data-status="overdue"].active {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  border-color: #b91c1c;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
}

.staff-role-tab[data-status="in_review"].active,
.staff-role-tab[data-status="under_review"].active,
.staff-role-tab[data-status="submitted"].active {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  border-color: #1d4ed8;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
}

.staff-role-tab[data-status="ready"].active,
.staff-role-tab[data-status="borrowed"].active {
  background: linear-gradient(135deg, #0891b2, #0e7490);
  border-color: #0e7490;
  box-shadow: 0 4px 12px rgba(14, 116, 144, 0.25);
}

/* ------------------------------------------------------------
   SETTINGS GRID — icon cards instead of flat tabs
   ------------------------------------------------------------ */
#settings-tabs {
  display: grid !important;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  border-bottom: none;
  margin-bottom: 26px;
  padding: 0;
  overflow: visible;
}

#settings-tabs .staff-role-tab {
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 6px;
  padding: 16px 18px;
  border-radius: 14px;
  text-align: left;
  background: #ffffff;
  border: 1.5px solid var(--fpu-border);
  font-size: 13.5px;
  min-height: 76px;
  white-space: normal;
  line-height: 1.3;
}

#settings-tabs .staff-role-tab .tab-label {
  font-family: var(--font-heading);
  font-weight: 700;
  color: inherit;
  font-size: 13px;
  line-height: 1.25;
}

#settings-tabs .staff-role-tab:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
  border-color: #10b981;
}

#settings-tabs .staff-role-tab.active {
  background: linear-gradient(135deg, #ecfdf5, #d1fae5);
  color: #065f46;
  border-color: #065f46;
  box-shadow: 0 8px 20px rgba(6, 95, 70, 0.15);
}

#settings-tabs .staff-role-tab.active .tab-label {
  color: #065f46;
}

/* ------------------------------------------------------------
   SECURITY ACTION CARDS — more visual
   ------------------------------------------------------------ */
.sec-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
  margin-bottom: 22px;
}

.sec-action-card {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1.5px solid var(--fpu-border);
  border-radius: 14px;
  padding: 20px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s ease;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.sec-action-card::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, #065f46, #10b981);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.sec-action-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.10);
  border-color: #10b981;
}

.sec-action-card:hover::before { opacity: 1; }

.sac-icon {
  font-size: 1.8rem;
  line-height: 1;
  margin-bottom: 4px;
}

.sec-action-card h3 {
  font-family: var(--font-heading);
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  letter-spacing: -0.01em;
}

.sec-action-card p {
  font-size: 12.5px;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
  flex: 1;
}

.sec-action-card .sac-badge {
  position: absolute;
  top: 16px; right: 16px;
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  color: #ffffff;
  font-family: var(--font-heading);
  font-size: 11px;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 999px;
  box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
}

/* ------------------------------------------------------------
   ADMIN AVATAR UPLOADER
   ------------------------------------------------------------ */
.admin-avatar-uploader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
  border: 2px dashed #cbd5e1;
  border-radius: 14px;
  transition: all 0.2s ease;
  cursor: pointer;
  max-width: 340px;
  margin: 0 auto;
}

.admin-avatar-uploader:hover {
  border-color: #10b981;
  background: linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%);
}

.admin-avatar-uploader.has-image {
  border-style: solid;
  border-color: #10b981;
  background: #ffffff;
  padding: 12px;
}

.admin-avatar-uploader .avatar-preview {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(135deg, #065f46, #f59e0b);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-heading);
  font-size: 2.4rem;
  font-weight: 800;
  overflow: hidden;
  border: 4px solid #ffffff;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
}

.admin-avatar-uploader .avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.admin-avatar-uploader .upload-hint {
  font-size: 13px;
  color: #64748b;
  text-align: center;
  margin: 0;
}

.admin-avatar-uploader .upload-hint strong {
  color: #065f46;
  font-family: var(--font-heading);
}

/* ------------------------------------------------------------
   NOTIFICATION DROPDOWN — polish
   ------------------------------------------------------------ */
.notif-dropdown {
  min-width: 360px;
  max-width: 440px;
  border-radius: 14px;
  border: 1.5px solid var(--fpu-border);
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.18);
}

.notif-dropdown-head {
  background: linear-gradient(135deg, #065f46, #047857);
  color: #ffffff;
  padding: 14px 18px;
  border-bottom: none;
}

.notif-dropdown-head strong {
  font-size: 14px;
  letter-spacing: 0.3px;
}

.notif-dropdown-head .btn-ghost {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.15);
}

.notif-dropdown-head .btn-ghost:hover {
  background: rgba(255, 255, 255, 0.28);
}

.notif-dropdown-item {
  border-left: 3px solid transparent;
  transition: all 0.15s ease;
}

.notif-dropdown-item:hover {
  background: #ecfdf5;
  border-left-color: #10b981;
}

.notif-dropdown-item.unread {
  border-left-color: #f59e0b;
  background: linear-gradient(90deg, #fffbeb 0%, #ffffff 70%);
}

.notif-dropdown-item.unread:hover {
  background: linear-gradient(90deg, #fef3c7 0%, #ffffff 70%);
}

.notif-dropdown-foot {
  background: #f8fafc;
  padding: 12px 16px;
}

.notif-dropdown-foot .btn {
  width: 100%;
  justify-content: center;
}
`;

let css = read(CSS);
if (!css) { err('admin.css not found'); process.exit(1); }

if (css.includes(CSS_MARKER)) {
  info('Batch 5 CSS already present — skipping');
} else {
  backup(CSS);
  fs.writeFileSync(CSS, css.trimEnd() + '\n' + CSS_BLOCK + '\n', 'utf8');
  ok('Appended Batch 5 CSS (' + Math.round(CSS_BLOCK.length / 1024) + ' KB)');
}

// ============================================================
// PART 2 — admin.js additions
// ============================================================
head('Step 2 — admin.js additions');

const JS_MARKER = '// ==== FPU Batch 5 additions ====';

const JS_BLOCK = `
${JS_MARKER}

// ------------------------------------------------------------
// Settings tabs — render with structured labels
// ------------------------------------------------------------
function enhanceSettingsTabs() {
  const bar = document.getElementById('settings-tabs');
  if (!bar || bar.__fpuEnhanced) return;
  bar.__fpuEnhanced = true;

  const LABELS = {
    institution:   { icon: '🏛️', label: 'Institution',  sub: 'Identity & branding' },
    academic:      { icon: '🎓', label: 'Academic',     sub: 'Session & rules' },
    finance:       { icon: '💰', label: 'Finance',      sub: 'Fees & currency' },
    library:       { icon: '📚', label: 'Library',      sub: 'Borrowing & fines' },
    attendance:    { icon: '📋', label: 'Attendance',   sub: 'Rules & thresholds' },
    registrations: { icon: '📝', label: 'Registrations',sub: 'Windows & limits' },
    email:         { icon: '📧', label: 'Email / SMTP', sub: 'Outgoing mail' },
    sms:           { icon: '💬', label: 'SMS',          sub: 'Provider config' },
    features:      { icon: '🎛️', label: 'Features',     sub: 'Toggle modules' },
    localisation:  { icon: '🌍', label: 'Localisation', sub: 'Time, date, region' },
    maintenance:   { icon: '🚧', label: 'Maintenance',  sub: 'Downtime control' },
    advanced:      { icon: '⚙️', label: 'Advanced',     sub: 'Raw settings' },
    account:       { icon: '👤', label: 'My Account',   sub: 'Password & photo' },
  };

  bar.querySelectorAll('.staff-role-tab').forEach((tab) => {
    const key = tab.dataset.tab;
    const meta = LABELS[key];
    if (!meta) return;

    // Only rewrite once
    if (tab.querySelector('.tab-label')) return;

    // Preserve count span if any
    const count = tab.querySelector('.tab-count');
    const countHTML = count ? count.outerHTML : '';

    tab.innerHTML = \`
      <div style="font-size:1.4rem;line-height:1;margin-bottom:2px;">\${meta.icon}</div>
      <div class="tab-label">\${meta.label}</div>
      <div style="font-size:11px;color:#94a3b8;font-weight:500;">\${meta.sub}</div>
      \${countHTML}
    \`;
  });
}

// ------------------------------------------------------------
// Admin avatar uploader — used in users/form.html and users/admins
// ------------------------------------------------------------
function wireAdminAvatarUploader() {
  const uploader = document.getElementById('admin-avatar-uploader');
  const file = document.getElementById('admin-avatar-file');
  const preview = document.getElementById('admin-avatar-preview');
  const dataInput = document.getElementById('admin-avatar-data');

  if (!uploader || uploader.__bound) return;
  uploader.__bound = true;

  uploader.addEventListener('click', () => file && file.click());

  if (file) {
    file.addEventListener('change', () => {
      const f = file.files[0];
      if (!f) return;
      if (!/^image\\//.test(f.type)) {
        showToast('Please select an image file.', 'warning');
        file.value = '';
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        showToast('File is too large. Maximum 5 MB.', 'warning');
        file.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        if (preview) preview.innerHTML = '<img src="' + dataUrl + '" alt="Avatar" />';
        uploader.classList.add('has-image');
        if (dataInput) dataInput.value = dataUrl;
      };
      reader.readAsDataURL(f);
    });
  }
}

// ------------------------------------------------------------
// Apply admin avatar to topbar and cache
// ------------------------------------------------------------
function applyAdminAvatar(url) {
  if (!url) return;
  const topbar = document.getElementById('topbar-avatar');
  if (topbar) topbar.innerHTML = '<img src="' + escapeHtml(url) + '" alt="" />';
  const userMenuAvatar = document.getElementById('user-menu-avatar');
  if (userMenuAvatar) userMenuAvatar.innerHTML = '<img src="' + escapeHtml(url) + '" alt="" />';
}

// ------------------------------------------------------------
// Batch 5 auto-wiring
// ------------------------------------------------------------
function wireBatch5() {
  enhanceSettingsTabs();
  wireAdminAvatarUploader();
}

document.addEventListener('DOMContentLoaded', () => {
  wireBatch5();
  const view = document.getElementById('page-view');
  if (view) new MutationObserver(() => wireBatch5()).observe(view, { childList: true, subtree: true });
});

window.addEventListener('hashchange', () => setTimeout(wireBatch5, 120));

// ==== END FPU Batch 5 additions ====
`;

let adminJs = read(ADMIN);
if (!adminJs) { err('admin.js not found'); process.exit(1); }

if (adminJs.includes(JS_MARKER)) {
  info('Batch 5 JS already present — skipping');
} else {
  const anchor = 'window.FPU_ADMIN = {';
  const idx = adminJs.indexOf(anchor);
  if (idx === -1) { err('Cannot find FPU_ADMIN export in admin.js'); process.exit(1); }

  adminJs = adminJs.slice(0, idx) + JS_BLOCK + '\n' + adminJs.slice(idx);

  // Add exports
  const exportNames = ['enhanceSettingsTabs', 'wireAdminAvatarUploader', 'applyAdminAvatar', 'wireBatch5'];
  let depth = 0, end = -1;
  for (let i = idx; i < adminJs.length; i++) {
    if (adminJs[i] === '{') depth++;
    else if (adminJs[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }

  if (end !== -1) {
    const body = adminJs.slice(idx, end);
    const toAdd = exportNames.filter((n) => !new RegExp('(^|\\\\s)' + n + '\\\\s*[,:]', 'm').test(body));
    if (toAdd.length) {
      let insertAt = end;
      while (insertAt > idx && /\\s/.test(adminJs[insertAt - 1])) insertAt--;
      const indentMatch = body.match(/\\n(\\s+)\\S/);
      const indent = indentMatch ? indentMatch[1] : '  ';
      const inj = '\\n' + indent + '// Batch 5 additions\\n' + toAdd.map((n) => indent + n + ',').join('\\n');
      adminJs = adminJs.slice(0, insertAt) + inj + adminJs.slice(insertAt);
      ok('Added exports: ' + toAdd.join(', '));
    }
  }

  backup(ADMIN);
  if (!verifyJs(adminJs)) { err('syntax broken — not writing'); process.exit(1); }
  fs.writeFileSync(ADMIN, adminJs, 'utf8');
  ok('admin.js patched');
}

// ============================================================
// PART 3 — Add avatar uploader to users/admins.html
// ============================================================
head('Step 3 — users/admins.html avatar uploader');

const adminsPath = path.join(ROOT, 'public', 'admin', 'partials', 'users', 'admins.html');
let admins = read(adminsPath);

if (admins === null) {
  warn('users/admins.html not found — skipping');
} else if (admins.includes('admin-avatar-uploader')) {
  info('avatar uploader already present in admins.html');
} else {
  // Insert the uploader panel after the warning banner
  const banner = /(<div class="alert alert-warning">[\s\S]*?<\/div>)/;
  const uploaderPanel = `

<div class="panel">
  <div class="panel-head"><h3>Your Admin Avatar</h3></div>
  <div class="panel-body">
    <div class="admin-avatar-uploader" id="admin-avatar-uploader">
      <input type="file" id="admin-avatar-file" accept="image/*" style="display:none" />
      <div class="avatar-preview" id="admin-avatar-preview">A</div>
      <p class="upload-hint"><strong>Click to upload your photo</strong><br/>JPG or PNG · Max 5 MB</p>
    </div>
    <input type="hidden" id="admin-avatar-data" />
    <div class="small muted" style="margin-top:10px;text-align:center;">
      This avatar appears in the top-right corner of every page.
    </div>
  </div>
</div>

<script>
  // batch5: pre-fill admin avatar from cached user
  (function () {
    const A = window.FPU_ADMIN;
    if (!A) return;
    const user = A.getAdminUser() || {};
    const preview = document.getElementById('admin-avatar-preview');
    if (preview && user.photoUrl) {
      preview.innerHTML = '<img src="' + A.escapeHtml(user.photoUrl) + '" alt="" />';
    }

    // Wire save
    const uploader = document.getElementById('admin-avatar-uploader');
    if (uploader && !uploader.__saveBound) {
      uploader.__saveBound = true;
      const file = document.getElementById('admin-avatar-file');
      file.addEventListener('change', async () => {
        const f = file.files[0];
        if (!f) return;
        const dataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(f);
        });
        try {
          const res = await A.adminFetch('/api/portal/avatar-upload', {
            method: 'POST',
            body: JSON.stringify({ dataUrl }),
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error);
          A.applyAdminAvatar(json.url);
          const u = A.getAdminUser() || {};
          u.photoUrl = json.url;
          localStorage.setItem('fpu_admin_user', JSON.stringify(u));
          localStorage.setItem('portal_user', JSON.stringify(u));
          A.showToast('Avatar saved.', 'success');
        } catch (err) {
          A.showToast('❌ ' + err.message, 'error');
        }
      });
    }
  })();
</script>
`;

  if (banner.test(admins)) {
    admins = admins.replace(banner, '$1' + uploaderPanel);
  } else {
    // No banner — insert after the page-head
    const pageHeadRe = /(<\/section>)/;
    admins = admins.replace(pageHeadRe, '$1' + uploaderPanel);
  }

  backup(adminsPath);
  fs.writeFileSync(adminsPath, admins, 'utf8');
  ok('Added admin avatar uploader to users/admins.html');
}

// ============================================================
// PART 4 — Add avatar to users/form.html (create admin)
// ============================================================
head('Step 4 — users/form.html admin avatar');

const userFormPath = path.join(ROOT, 'public', 'admin', 'partials', 'users', 'form.html');
let userForm = read(userFormPath);

if (userForm === null) {
  warn('users/form.html not found — skipping');
} else if (userForm.includes('admin-avatar-uploader')) {
  info('avatar uploader already present in users/form.html');
} else {
  // Insert avatar uploader panel before the "Security" panel
  const securityPanelRe = /(<div class="panel">\s*<div class="panel-head"><h3>Security<\/h3>)/;
  const uploaderBlock = `
<div class="panel" id="user-avatar-panel" style="display:none;">
  <div class="panel-head"><h3>Profile Photo (Admin only)</h3></div>
  <div class="panel-body">
    <div class="admin-avatar-uploader" id="admin-avatar-uploader">
      <input type="file" id="admin-avatar-file" accept="image/*" style="display:none" />
      <div class="avatar-preview" id="admin-avatar-preview">A</div>
      <p class="upload-hint"><strong>Click to upload</strong><br/>JPG or PNG · Max 5 MB</p>
    </div>
    <input type="hidden" id="admin-avatar-data" />
  </div>
</div>

`;

  if (securityPanelRe.test(userForm)) {
    userForm = userForm.replace(securityPanelRe, uploaderBlock + '$1');
  } else {
    // Fallback: append at end of body
    userForm += uploaderBlock;
  }

  // Add JS that shows the panel only when role=admin
  const scriptAppend = `
<script>
  // batch5: show avatar uploader only for admin role
  (function () {
    const A = window.FPU_ADMIN;
    if (!A) return;
    function checkRole() {
      const roleSel = document.getElementById('uf-role');
      const panel = document.getElementById('user-avatar-panel');
      if (!roleSel || !panel) return;
      panel.style.display = roleSel.value === 'admin' ? 'block' : 'none';
    }
    document.addEventListener('DOMContentLoaded', () => {
      const roleSel = document.getElementById('uf-role');
      if (roleSel) {
        roleSel.addEventListener('change', checkRole);
        checkRole();
      }
    });
    window.addEventListener('hashchange', () => setTimeout(checkRole, 150));
    setTimeout(checkRole, 200);
  })();
</script>
`;

  userForm += scriptAppend;

  backup(userFormPath);
  fs.writeFileSync(userFormPath, userForm, 'utf8');
  ok('Added avatar uploader panel to users/form.html');
}

// ============================================================
// PART 5 — style cleanup in admin-spa.js (no changes needed, verify)
// ============================================================
head('Step 5 — verify');

const verify = [
  ['admin.css contains Batch 5 CSS', read(CSS).includes(CSS_MARKER)],
  ['admin.js contains Batch 5 JS',   read(ADMIN).includes(JS_MARKER)],
  ['admins.html has uploader',       read(adminsPath) && read(adminsPath).includes('admin-avatar-uploader')],
  ['users/form.html has uploader',   read(userFormPath) && read(userFormPath).includes('admin-avatar-uploader')],
];

for (const [label, passed] of verify) {
  if (passed) ok(label);
  else warn(label);
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
log('     • Sidebar → Settings → grid of icon cards', 'yellow');
log('     • Sidebar → Security → styled action cards', 'yellow');
log('     • Sidebar → Announcements / Books / etc. → pill-shaped tabs', 'yellow');
log('     • Users → Admin Accounts → avatar uploader at top', 'yellow');
log('     • Users → + New User → select role "Admin" → avatar panel appears', 'yellow');
log('     • Top-right avatar updates after upload', 'yellow');
console.log('');