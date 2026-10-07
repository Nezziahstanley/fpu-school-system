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
