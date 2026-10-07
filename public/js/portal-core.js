/* ============================================================
   FPU Portal — Shared core utilities
   ------------------------------------------------------------
   Every portal page loads this first. It provides:
     portalFetch, getPortalUser, setPortalSession,
     clearPortalSession, requirePortalAuth, portalLogout,
     showToast, escapeHtml, escapeQuotes, getInitials,
     timeAgo, formatMoney, formatDate, formatDateTime,
     toggleSidebar, closeSidebar, copyToClipboard.
   ============================================================ */

(function () {
  'use strict';

  // Accept BOTH key conventions so /login.html, /portal/login.html,
  // and /admin/login.html all agree on session state.
  const TOKEN_KEYS = ['fpu_portal_token', 'portal_token', 'fpu_admin_token'];
  const USER_KEYS  = ['fpu_portal_user',  'portal_user',  'fpu_admin_user'];

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
  function setPortalSessionBoth({ token, user }) {
    if (token) {
      TOKEN_KEYS.forEach(k => localStorage.setItem(k, token));
    }
    if (user) {
      USER_KEYS.forEach(k => localStorage.setItem(k, JSON.stringify(user)));
    }
  }
  function clearPortalSessionBoth() {
    TOKEN_KEYS.forEach(k => localStorage.removeItem(k));
    USER_KEYS.forEach(k => localStorage.removeItem(k));
  }

  // ----------------------------------------------------------
  // Session helpers
  // ----------------------------------------------------------
  function getPortalUser() { return getStoredUser(); }
  function setPortalSession(s) { setPortalSessionBoth(s); }
  function clearPortalSession() { clearPortalSessionBoth(); }

  // ----------------------------------------------------------
  // Redirect to login if not authenticated
  // ----------------------------------------------------------
  function requirePortalAuth() {
    const token = getToken();
    if (!token) {
      const here = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/portal/login.html?redirect=${here}`;
      return null;
    }
    return getPortalUser();
  }

  // ----------------------------------------------------------
  // Fetch wrapper — attaches Bearer token, parses JSON,
  // redirects on 401.
  // ----------------------------------------------------------
  async function portalFetch(path, opts = {}) {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const init = { ...opts, headers };
    if (opts.body && typeof opts.body !== 'string') init.body = JSON.stringify(opts.body);

    const res = await fetch(path, init);
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
  // Logout
  // ----------------------------------------------------------
  async function portalLogout() {
    try { await portalFetch('/api/admin/auth/logout', { method: 'POST' }); }
    catch { /* ignore */ }
    clearPortalSession();
    window.location.href = '/login.html';
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
  // String escaping
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
  function escapeQuotes(str) {
    return escapeHtml(str).replace(/`/g, '&#96;');
  }

  // ----------------------------------------------------------
  // Initials from a name
  // ----------------------------------------------------------
  function getInitials(firstName, lastName) {
    const a = (firstName || '').trim()[0] || '';
    const b = (lastName || '').trim()[0] || '';
    return (a + b).toUpperCase() || 'U';
  }

  // ----------------------------------------------------------
  // Relative time
  // ----------------------------------------------------------
  function timeAgo(input) {
    if (!input) return '';
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const dd = Math.floor(h / 24);
    if (dd < 30) return `${dd}d ago`;
    return d.toLocaleDateString();
  }

  // ----------------------------------------------------------
  // Money
  // ----------------------------------------------------------
  function formatMoney(amount, currency = '₦') {
    const n = Number(amount || 0);
    return currency + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ----------------------------------------------------------
  // Dates
  // ----------------------------------------------------------
  function formatDate(input) {
    if (!input) return '';
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function formatDateTime(input) {
    if (!input) return '';
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // ----------------------------------------------------------
  // Sidebar
  // ----------------------------------------------------------
  function toggleSidebar() {
    document.body.classList.toggle('sidebar-collapsed');
    if (window.matchMedia('(max-width: 900px)').matches) {
      document.body.classList.toggle('sidebar-open');
    }
  }
  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
  }

  // ----------------------------------------------------------
  // Clipboard
  // ----------------------------------------------------------
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard.', 'success');
      return true;
    } catch {
      showToast('Could not copy.', 'error');
      return false;
    }
  }

  // ----------------------------------------------------------
  // Sidebar toggle bind (topbar #sidebar-toggle)
  // ----------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('sidebar-toggle');
    if (btn) btn.addEventListener('click', toggleSidebar);
    document.addEventListener('click', (e) => {
      if (window.matchMedia('(max-width: 900px)').matches) {
        const sidebar = document.querySelector('.sidebar');
        const btn2 = document.getElementById('sidebar-toggle');
        if (sidebar && !sidebar.contains(e.target) && btn2 && !btn2.contains(e.target)) closeSidebar();
      }
    });
  });

  // ----------------------------------------------------------
  // Exports
  // ----------------------------------------------------------
  window.FPU_PORTAL = {
    TOKEN_KEY,
    USER_KEY,
    getToken,
    getPortalUser,
    setPortalSession,
    clearPortalSession,
    requirePortalAuth,
    portalFetch,
    portalLogout,
    showToast,
    escapeHtml,
    escapeQuotes,
    getInitials,
    timeAgo,
    formatMoney,
    formatDate,
    formatDateTime,
    toggleSidebar,
    closeSidebar,
    copyToClipboard,
  };
})();