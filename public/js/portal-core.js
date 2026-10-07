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
    return getPortalUser();
  }

  // ----------------------------------------------------------
  // Fetch wrapper
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
    catch {}
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
    requirePortalAuth, portalLogout,
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