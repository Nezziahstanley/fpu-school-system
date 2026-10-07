// ============================================================
// apply-batch5-html.js
// ------------------------------------------------------------
// Adds the admin avatar uploader to:
//   users/admins.html   (page-level uploader)
//   users/form.html     (panel that appears when role=admin)
// ============================================================

'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT   = process.cwd();
const BACKUP = path.join(ROOT, 'backups', 'batch5-html-' + new Date().toISOString().replace(/[:.]/g, '-'));

function log(m, c) {
  const codes = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', dim: '\x1b[2m', reset: '\x1b[0m' };
  console.log((codes[c] || '') + m + codes.reset);
}
const ok = (m) => log('  ✓ ' + m, 'green');
const info = (m) => log('  · ' + m, 'dim');
const warn = (m) => log('  ⚠ ' + m, 'yellow');
const head = (m) => log('\n' + m, 'cyan');

function read(f) { return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; }
function backup(f) {
  if (!fs.existsSync(f)) return;
  fs.mkdirSync(BACKUP, { recursive: true });
  fs.copyFileSync(f, path.join(BACKUP, path.basename(f)));
}

head('Batch 5 HTML — avatar uploaders');
info('Backups: ' + BACKUP);

// ------------------------------------------------------------
// 1. users/admins.html
// ------------------------------------------------------------
const adminsPath = path.join(ROOT, 'public', 'admin', 'partials', 'users', 'admins.html');
let admins = read(adminsPath);

if (admins === null) {
  warn('users/admins.html not found');
} else if (admins.includes('admin-avatar-uploader')) {
  info('admins.html already patched');
} else {
  var adminsBlock = [
    '',
    '<div class="panel">',
    '  <div class="panel-head"><h3>Your Admin Avatar</h3></div>',
    '  <div class="panel-body">',
    '    <div class="admin-avatar-uploader" id="admin-avatar-uploader">',
    '      <input type="file" id="admin-avatar-file" accept="image/*" style="display:none" />',
    '      <div class="avatar-preview" id="admin-avatar-preview">A</div>',
    '      <p class="upload-hint"><strong>Click to upload your photo</strong><br/>JPG or PNG &middot; Max 5 MB</p>',
    '    </div>',
    '    <input type="hidden" id="admin-avatar-data" />',
    '    <div class="small muted" style="margin-top:10px;text-align:center;">',
    '      This avatar appears in the top-right corner of every page.',
    '    </div>',
    '  </div>',
    '</div>',
    '',
    '<script>',
    '  // batch5: pre-fill + save admin avatar',
    '  (function () {',
    '    var A = window.FPU_ADMIN;',
    '    if (!A) return;',
    '    var user = A.getAdminUser() || {};',
    '    var preview = document.getElementById("admin-avatar-preview");',
    '    if (preview && user.photoUrl) {',
    '      preview.innerHTML = \'<img src="\' + A.escapeHtml(user.photoUrl) + \'" alt="" />\';',
    '    }',
    '',
    '    var uploader = document.getElementById("admin-avatar-uploader");',
    '    if (uploader && !uploader.__saveBound) {',
    '      uploader.__saveBound = true;',
    '      var file = document.getElementById("admin-avatar-file");',
    '      file.addEventListener("change", async function () {',
    '        var f = file.files[0];',
    '        if (!f) return;',
    '        var dataUrl = await new Promise(function (res, rej) {',
    '          var r = new FileReader();',
    '          r.onload = function () { res(r.result); };',
    '          r.onerror = rej;',
    '          r.readAsDataURL(f);',
    '        });',
    '        try {',
    '          var resp = await A.adminFetch("/api/portal/avatar-upload", {',
    '            method: "POST",',
    '            body: JSON.stringify({ dataUrl: dataUrl })',
    '          });',
    '          var json = await resp.json();',
    '          if (!json.success) throw new Error(json.error);',
    '          A.applyAdminAvatar(json.url);',
    '          var u = A.getAdminUser() || {};',
    '          u.photoUrl = json.url;',
    '          localStorage.setItem("fpu_admin_user", JSON.stringify(u));',
    '          localStorage.setItem("portal_user", JSON.stringify(u));',
    '          A.showToast("Avatar saved.", "success");',
    '        } catch (err) {',
    '          A.showToast("\u274C " + err.message, "error");',
    '        }',
    '      });',
    '    }',
    '  })();',
    '</script>',
    '',
  ].join('\n');

  // Insert after the warning banner if present, else after first </section>
  var banner = /(<div class="alert alert-warning">[\s\S]*?<\/div>)/;
  if (banner.test(admins)) {
    admins = admins.replace(banner, '$1' + adminsBlock);
  } else {
    admins = admins.replace(/(<\/section>)/, '$1' + adminsBlock);
  }

  backup(adminsPath);
  fs.writeFileSync(adminsPath, admins, 'utf8');
  ok('Added avatar uploader to users/admins.html');
}

// ------------------------------------------------------------
// 2. users/form.html
// ------------------------------------------------------------
const userFormPath = path.join(ROOT, 'public', 'admin', 'partials', 'users', 'form.html');
let userForm = read(userFormPath);

if (userForm === null) {
  warn('users/form.html not found');
} else if (userForm.includes('admin-avatar-uploader')) {
  info('users/form.html already patched');
} else {
  var formBlock = [
    '',
    '<div class="panel" id="user-avatar-panel" style="display:none;">',
    '  <div class="panel-head"><h3>Profile Photo (Admin only)</h3></div>',
    '  <div class="panel-body">',
    '    <div class="admin-avatar-uploader" id="admin-avatar-uploader">',
    '      <input type="file" id="admin-avatar-file" accept="image/*" style="display:none" />',
    '      <div class="avatar-preview" id="admin-avatar-preview">A</div>',
    '      <p class="upload-hint"><strong>Click to upload</strong><br/>JPG or PNG &middot; Max 5 MB</p>',
    '    </div>',
    '    <input type="hidden" id="admin-avatar-data" />',
    '  </div>',
    '</div>',
    '',
    '<script>',
    '  // batch5: show avatar uploader only when role=admin',
    '  (function () {',
    '    function checkRole() {',
    '      var roleSel = document.getElementById("uf-role");',
    '      var panel = document.getElementById("user-avatar-panel");',
    '      if (!roleSel || !panel) return;',
    '      panel.style.display = roleSel.value === "admin" ? "block" : "none";',
    '    }',
    '    document.addEventListener("DOMContentLoaded", function () {',
    '      var roleSel = document.getElementById("uf-role");',
    '      if (roleSel) {',
    '        roleSel.addEventListener("change", checkRole);',
    '        checkRole();',
    '      }',
    '    });',
    '    window.addEventListener("hashchange", function () { setTimeout(checkRole, 150); });',
    '    setTimeout(checkRole, 200);',
    '  })();',
    '</script>',
    '',
  ].join('\n');

  // Insert before the Security panel
  var securityPanel = /(<div class="panel">\s*<div class="panel-head"><h3>Security<\/h3>)/;
  if (securityPanel.test(userForm)) {
    userForm = userForm.replace(securityPanel, formBlock + '$1');
  } else {
    userForm += formBlock;
  }

  backup(userFormPath);
  fs.writeFileSync(userFormPath, userForm, 'utf8');
  ok('Added avatar panel to users/form.html');
}

head('DONE');
console.log('');
info('Backups: ' + BACKUP);
console.log('');