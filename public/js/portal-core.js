/* ============================================================
   FPU Portal — Shared core utilities
   ============================================================ */

(function () {
  'use strict';

  // Accept BOTH key conventions (fpu_* and legacy portal_*)
  const TOKEN_KEYS = ['fpu_portal_token', 'portal_token', 'fpu_admin_token'];
  const USER_KEYS  = ['fpu_portal_user',  'portal_user',  'fpu_admin_user'];

  // ----------------------------------------------------------
  // Session
  // ----------------------------------------------------------
  function getToken() {
    for (const k of TOKEN_KEYS) {
      const v = localStorage.getItem(k);
      if (v) return v;
    }
    return null;
  }

  function getStoredUser() {
    for (const k of USER_KEYS) {
      const v = localStorage.getItem(k);
      if (v) { try { return JSON.parse(v); } catch {} }
    }
    return null;
  }

  function getPortalUser() { return getStoredUser(); }

  function setPortalSession(session) {
    if (!session) return;
    if (session.token) TOKEN_KEYS.forEach(k => localStorage.setItem(k, session.token));
    if (session.user)  {
      const s = JSON.stringify(session.user);
      USER_KEYS.forEach(k => localStorage.setItem(k, s));
    }
  }

  function clearPortalSession() {
    TOKEN_KEYS.forEach(k => localStorage.removeItem(k));
    USER_KEYS.forEach(k => localStorage.removeItem(k));
  }

  // ----------------------------------------------------------
  // Auth guard — redirects to unified /login.html
  // ----------------------------------------------------------
  function requirePortalAuth() {
    const token = getToken();
    if (!token) {
      const here = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login.html?redirect=${here}`;
      return null;
    }
    return getStoredUser();
  }

  // ----------------------------------------------------------
  // Fetch wrapper
  // ----------------------------------------------------------
  async function portalFetch(path, opts = {}) {
    const token = getToken();
    
    // Check if body is FormData (for file uploads)
    const isFormData = opts.body instanceof FormData;
    
    const headers = {
      // Only set JSON content-type if we are NOT sending FormData
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    
    const init = { ...opts, headers };
    
    // Only stringify plain objects. Leave FormData and strings alone.
    if (opts.body && typeof opts.body !== 'string' && !isFormData) {
      init.body = JSON.stringify(opts.body);
    }

    // ---- Auto-prefix admin paths for admin/superadmin ONLY ----
    const ADMIN_ROLES = ['admin', 'superadmin'];
    const ADMIN_PREFIX_MODULES = [
      'results', 'students', 'staff', 'courses', 'programmes', 'departments',
      'sessions', 'library', 'payments', 'clearances', 'applications',
      'registrations', 'announcements', 'notifications', 'exams', 'settings',
      'reports', 'transcript', 'lecturers', 'hods', 'allocations', 'timetable',
      'documents', 'attendance', 'complaints', 'graduation', 'security',
      'audit', 'fees', 'adminUsers', 'adminLookups',
    ];

    let finalPath = path;
    try {
      const me = getStoredUser();
      const role = me && me.role ? String(me.role).toLowerCase() : '';
      if (ADMIN_ROLES.includes(role) && typeof path === 'string' && path.startsWith('/api/')) {
        const rest = path.slice(5);
        const seg = rest.split('?')[0].split('/')[0];
        if (ADMIN_PREFIX_MODULES.includes(seg)) {
          finalPath = '/api/admin/' + rest;
        }
      }
    } catch {}

    const res = await fetch(finalPath, init);
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { error: text }; }

    if (res.status === 401) {
      clearPortalSession();
      window.location.href = '/login.html';
      throw new Error('Session expired. Please sign in again.');
    }
    if (!res.ok || json.success === false) {
      throw new Error(json.error || `Request failed (${res.status})`);
    }
    return json;
  }

  // ----------------------------------------------------------
  // Shared accessible confirmation dialog
  // ----------------------------------------------------------
  let activeConfirmDialog = null;

  function portalConfirm(message, options = {}) {
    if (activeConfirmDialog) return Promise.resolve(false);

    const title = options.title || 'Please confirm';
    const confirmText = options.confirmText || options.okText || 'Continue';
    const cancelText = options.cancelText || 'Cancel';
    const danger = options.type === 'danger';
    const overlay = document.createElement('div');
    overlay.className = 'fpu-confirm-overlay';
    overlay.setAttribute('role', 'presentation');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '100000',
      display: 'grid', placeItems: 'center', padding: '1rem',
      background: 'rgba(15, 23, 42, .62)', backdropFilter: 'blur(4px)'
    });

    const dialog = document.createElement('section');
    dialog.className = 'fpu-confirm-dialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'fpu-confirm-title');
    dialog.setAttribute('aria-describedby', 'fpu-confirm-message');
    Object.assign(dialog.style, {
      width: 'min(100%, 440px)', background: '#fff', color: '#0f172a',
      borderRadius: '18px', padding: '1.4rem',
      boxShadow: '0 24px 80px rgba(0,0,0,.28)',
      border: '1px solid #e2e8f0', fontFamily: 'inherit'
    });

    const icon = document.createElement('div');
    icon.textContent = danger ? '⚠️' : '❔';
    icon.setAttribute('aria-hidden', 'true');
    icon.style.cssText = 'font-size:2rem;margin-bottom:.65rem;';
    const heading = document.createElement('h2');
    heading.id = 'fpu-confirm-title';
    heading.textContent = title;
    heading.style.cssText = 'font-size:1.12rem;font-weight:800;margin:0 0 .5rem;';
    const body = document.createElement('p');
    body.id = 'fpu-confirm-message';
    body.textContent = String(message || 'Are you sure you want to continue?');
    body.style.cssText = 'font-size:.92rem;line-height:1.6;color:#475569;margin:0 0 1.25rem;white-space:pre-line;';
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:.65rem;flex-wrap:wrap;';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = cancelText;
    cancel.style.cssText = 'padding:.65rem 1rem;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#334155;font-weight:700;cursor:pointer;';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.textContent = confirmText;
    confirm.style.cssText = `padding:.65rem 1rem;border:1px solid ${danger ? '#b91c1c' : '#047857'};border-radius:9px;background:${danger ? '#b91c1c' : '#047857'};color:#fff;font-weight:800;cursor:pointer;`;
    actions.append(cancel, confirm);
    dialog.append(icon, heading, body, actions);
    overlay.appendChild(dialog);

    return new Promise(resolve => {
      activeConfirmDialog = overlay;
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKeyDown);
        overlay.remove();
        activeConfirmDialog = null;
        resolve(value);
      };
      const onKeyDown = event => {
        if (event.key === 'Escape') { event.preventDefault(); finish(false); }
        if (event.key === 'Enter' && document.activeElement === confirm) { event.preventDefault(); finish(true); }
        if (event.key === 'Tab') {
          const first = cancel, last = confirm;
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      };
      cancel.addEventListener('click', () => finish(false));
      confirm.addEventListener('click', () => finish(true));
      overlay.addEventListener('click', event => { if (event.target === overlay) finish(false); });
      document.addEventListener('keydown', onKeyDown);
      document.body.appendChild(overlay);
      confirm.focus();
    });
  }

  // ----------------------------------------------------------
  // Logout
  // ----------------------------------------------------------
  async function portalLogout() {
    const confirmed = await portalConfirm('Are you sure you want to sign out of your FPU portal account?', { title: 'Sign Out?', type: 'warning', confirmText: 'Sign Out', cancelText: 'Stay Signed In' });
    if (!confirmed) return false;
    try { await portalFetch('/api/admin/auth/logout', { method: 'POST' }); }
    catch {}
    clearPortalSession();
    window.location.href = '/login.html';
    return true;
  }

  // ----------------------------------------------------------
  // Toast
  // ----------------------------------------------------------
  function showToast(message, type = 'info') {
    let wrap = document.getElementById('toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<strong>${type === 'error' ? 'Error' : type === 'success' ? 'Success' : type === 'warning' ? 'Warning' : 'Info'}</strong>${escapeHtml(message)}`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity .25s';
      setTimeout(() => el.remove(), 300);
    }, 3500);
  }

  // ----------------------------------------------------------
  // String helpers
  // ----------------------------------------------------------
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeQuotes(s) { return String(s || '').replace(/"/g, '&quot;'); }
  function getInitials(name) {
    return String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');
  }
  function timeAgo(input) {
    const then = new Date(input).getTime();
    if (!then) return '';
    const diff = Math.floor((Date.now() - then) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return new Date(input).toLocaleDateString();
  }
  function formatMoney(n) {
    const v = Number(n || 0);
    return '₦' + v.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
  }
  function formatDateTime(d) {
    if (!d) return '';
    return new Date(d).toLocaleString('en-GB', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  // ----------------------------------------------------------
  // Sidebar helpers (used by portal/app.html)
  // ----------------------------------------------------------
  function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.toggle('open');
  }
  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.remove('open');
  }

  // ----------------------------------------------------------
  // Clipboard
  // ----------------------------------------------------------
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(String(text));
      showToast('Copied to clipboard', 'success');
    } catch {
      showToast('Could not copy', 'error');
    }
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------
  window.FPU_PORTAL = {
    // session
    getToken, getPortalUser, setPortalSession, clearPortalSession,
    requirePortalAuth, portalLogout, portalConfirm,
    // http
    portalFetch,
    // ui
    showToast, toggleSidebar, closeSidebar,
    // strings / format
    escapeHtml, escapeQuotes, getInitials, timeAgo,
    formatMoney, formatDate, formatDateTime,
    // misc
    copyToClipboard,
  };
})();
// Cache buster 11/04/2026 15:18:40
