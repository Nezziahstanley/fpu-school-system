# ============================================================
# apply-batch1.ps1
# Safe, mechanical parts of Batch 1:
#   - Back up admin.js and admin.css
#   - Append the notification-dropdown CSS to admin.css
#   - Write batch1-to-add.js containing the JS functions
#     (you still need to paste these into admin.js manually)
# ============================================================

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "FPU — Batch 1 applier" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""

# ---------- Paths ----------
$root      = (Get-Location).Path
$adminJs   = Join-Path $root "public\js\admin.js"
$adminCss  = Join-Path $root "public\css\admin.css"
$backupDir = Join-Path $root "backups\batch1-$(Get-Date -Format yyyyMMdd-HHmmss)"

# ---------- Sanity check ----------
if (-not (Test-Path $adminJs)) {
  Write-Host "ERROR: could not find public\js\admin.js" -ForegroundColor Red
  Write-Host "       Run this script from C:\fpu-school-system\" -ForegroundColor Red
  exit 1
}
if (-not (Test-Path $adminCss)) {
  Write-Host "ERROR: could not find public\css\admin.css" -ForegroundColor Red
  exit 1
}

# ---------- Backup ----------
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $adminJs  (Join-Path $backupDir "admin.js.bak")  -Force
Copy-Item $adminCss (Join-Path $backupDir "admin.css.bak") -Force
Write-Host "Backed up to: $backupDir" -ForegroundColor Green

# ---------- Append CSS if not already present ----------
$cssMarker = "/* ==== FPU Batch 1 — notification dropdown ==== */"
$cssText   = Get-Content $adminCss -Raw
if ($cssText -notmatch [regex]::Escape($cssMarker)) {
  $cssBlock = @"

$cssMarker
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
"@
  Add-Content -Path $adminCss -Value $cssBlock -Encoding UTF8
  Write-Host "Appended notification-dropdown CSS to admin.css" -ForegroundColor Green
} else {
  Write-Host "CSS already contains Batch 1 marker — skipping" -ForegroundColor Yellow
}

# ---------- Write the JS additions to a file for manual paste ----------
$jsAdditionsFile = Join-Path $root "batch1-to-add.js"
$jsBlock = @'
// ============================================================
// FPU — Batch 1 additions to admin.js
// ------------------------------------------------------------
// Paste these functions INSIDE your IIFE, before
// `window.FPU_ADMIN = { ... }`.
// Then add the exported names inside that object.
// ============================================================

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
    menu.innerHTML = `
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
    `;
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

      body.innerHTML = rows.map((n) => `
        <div class="notif-dropdown-item ${n.isRead ? '' : 'unread'}" data-id="${n.id}">
          <div class="ndi-title">${escapeHtml(n.title || '')}</div>
          <div class="ndi-body">${escapeHtml((n.body || '').slice(0, 100))}</div>
          <div class="ndi-time">${timeAgo(n.createdAt)}</div>
        </div>
      `).join('');

      body.querySelectorAll('.notif-dropdown-item').forEach((el) => {
        el.addEventListener('click', () => {
          menu.hidden = true;
          if (window.FPU_ADMIN_SPA) {
            window.FPU_ADMIN_SPA.navigateToWithQuery('notification-detail', { id: Number(el.dataset.id) });
          }
        });
      });
    } catch (err) {
      body.innerHTML = `<div class="alert alert-danger" style="margin:12px;">${escapeHtml(err.message)}</div>`;
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
'@
Set-Content -Path $jsAdditionsFile -Value $jsBlock -Encoding UTF8
Write-Host "Wrote JS additions to: $jsAdditionsFile" -ForegroundColor Green

# ---------- Summary ----------
Write-Host ""
Write-Host "DONE." -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open batch1-to-add.js — it contains the JS functions to insert."
Write-Host "  2. Open public\js\admin.js."
Write-Host "  3. Paste the contents of batch1-to-add.js just BEFORE the line:"
Write-Host "       window.FPU_ADMIN = {"
Write-Host "  4. Add these four names inside the FPU_ADMIN export object:"
Write-Host "       goBack,"
Write-Host "       wireStaffRoleTabs,"
Write-Host "       wireSelectAll,"
Write-Host "       initNotificationBell,"
Write-Host "  5. Save. The dev server restarts automatically."
Write-Host ""
Write-Host "Rollback (if needed): copy files back from $backupDir" -ForegroundColor DarkGray
Write-Host ""