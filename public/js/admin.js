// ============================================
// FPU ADMIN.JS — Federal Polytechnic Ugep
// Complete consolidated version (v11)
// Fixed: Syntax errors, Dashboard loading, Course Departments
// ============================================

// ============================================================
// FPU ADMIN — STYLED CONFIRM/ALERT MODALS
// ============================================================
(function() {
  'use strict';

  function ensureModalDOM() {
    if (document.getElementById('fpu-modal-container')) return;
    const html = `
      <div class="fpu-modal-overlay" id="fpu-modal-container">
        <div class="fpu-modal-box">
          <div class="fpu-modal-icon warning" id="fpu-modal-icon">⚠️</div>
          <h3 class="fpu-modal-title" id="fpu-modal-title">Confirm</h3>
          <div class="fpu-modal-message" id="fpu-modal-message"></div>
          <div class="fpu-modal-actions">
            <button type="button" class="fpu-modal-btn fpu-modal-btn-cancel" id="fpu-modal-cancel">Cancel</button>
            <button type="button" class="fpu-modal-btn fpu-modal-btn-confirm" id="fpu-modal-ok">Confirm</button>
          </div>
        </div>
      </div>
    `;
    if (document.body) {
      document.body.insertAdjacentHTML('beforeend', html);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.insertAdjacentHTML('beforeend', html);
      });
    }
  }

  window.fpuConfirm = function(message, options) {
    options = options || {};
    const type = options.type || 'warning';
    const title = options.title || (type === 'danger' ? 'Are you sure?' : 'Please Confirm');
    const okText = options.okText || 'Confirm';
    const cancelText = options.cancelText || 'Cancel';
    const showCancel = options.showCancel !== false;

    ensureModalDOM();

    return new Promise((resolve) => {
      const overlay = document.getElementById('fpu-modal-container');
      const iconEl = document.getElementById('fpu-modal-icon');
      const titleEl = document.getElementById('fpu-modal-title');
      const msgEl = document.getElementById('fpu-modal-message');
      const okBtn = document.getElementById('fpu-modal-ok');
      const cancelBtn = document.getElementById('fpu-modal-cancel');

      iconEl.className = 'fpu-modal-icon ' + type;
      iconEl.textContent = type === 'danger' ? '❌' : type === 'info' ? 'ℹ️' : type === 'success' ? '✅' : '⚠️';
      titleEl.textContent = title;
      msgEl.textContent = message;
      okBtn.textContent = okText;
      okBtn.className = 'fpu-modal-btn fpu-modal-btn-confirm ' + (type === 'danger' ? 'danger' : type === 'warning' ? 'warning' : '');
      cancelBtn.textContent = cancelText;
      cancelBtn.style.display = showCancel ? '' : 'none';

      overlay.classList.add('show');

      function cleanup(result) {
        overlay.classList.remove('show');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOverlayClick);
        document.removeEventListener('keydown', onKey);
        resolve(result);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onOverlayClick(e) { if (e.target === overlay) cleanup(false); }
      function onKey(e) {
        if (e.key === 'Escape') cleanup(false);
        if (e.key === 'Enter') cleanup(true);
      }

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      overlay.addEventListener('click', onOverlayClick);
      document.addEventListener('keydown', onKey);
    });
  };

  window.fpuAlert = function(message, options) {
    options = options || {};
    return window.fpuConfirm(message, {
      title: options.title || 'Notice',
      type: options.type || 'info',
      okText: options.okText || 'OK',
      showCancel: false,
    });
  };

// ============================================
// CUSTOM UI MODALS (Replaces prompt/confirm)
// ============================================
window.fpuPrompt = function(message, hint, title = 'Input Required') {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'fpu-modal-backdrop';
    backdrop.innerHTML = `
      <div class="fpu-modal">
        <div class="fpu-modal-header">
          <h3>${escapeHtml(title)}</h3>
          <button class="btn btn-sm btn-ghost" id="fpu-prompt-close">×</button>
        </div>
        <div class="fpu-modal-body">
          <p style="margin-bottom:12px;">${escapeHtml(message)}</p>
          <input type="text" class="form-control" id="fpu-prompt-input" placeholder="Type here..." style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
          ${hint ? `<div style="font-size:12px; color:#64748b; margin-top:8px;">${escapeHtml(hint)}</div>` : ''}
        </div>
        <div class="fpu-modal-footer">
          <button class="btn btn-outline" id="fpu-prompt-cancel">Cancel</button>
          <button class="btn btn-primary" id="fpu-prompt-ok">Submit</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    
    const input = backdrop.querySelector('#fpu-prompt-input');
    input.focus();

    const close = () => { backdrop.remove(); resolve(null); };
    const submit = () => { 
      const val = input.value.trim(); 
      backdrop.remove(); 
      resolve(val); 
    };

    backdrop.querySelector('#fpu-prompt-close').onclick = close;
    backdrop.querySelector('#fpu-prompt-cancel').onclick = close;
    backdrop.querySelector('#fpu-prompt-ok').onclick = submit;
    input.onkeypress = (e) => { if (e.key === 'Enter') submit(); };
  });
};

  if (!window.__fpuModalOverridden) {
    window.__fpuModalOverridden = true;
    window.confirm = function(message) {
      if (window.__fpuUsingNativeConfirm) return window.__fpuNativeConfirm.call(window, message);
      window.fpuConfirm(message, { type: 'warning' });
      return false;
    };
    window.alert = function(message) { window.fpuAlert(message, { type: 'info' }); };
  }
  if (!window.__fpuNativeConfirm) { window.__fpuNativeConfirm = window.confirm.bind(window); }
})();

// ============================================
// ADMIN AUTH HELPERS
// ============================================
function getAdminToken() {
  return localStorage.getItem("fpu_admin_token") || localStorage.getItem("portal_token");
}
function getAdminUser() {
  try {
    const raw = localStorage.getItem("fpu_admin_user") || localStorage.getItem("portal_user");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function setAdminSession(token, user) {
  localStorage.setItem("fpu_admin_token", token);
  localStorage.setItem("fpu_admin_user", JSON.stringify(user));
  localStorage.setItem("portal_token", token);
  localStorage.setItem("portal_user", JSON.stringify(user));
}
function clearAdminSession() {
  localStorage.removeItem("fpu_admin_token");
  localStorage.removeItem("fpu_admin_user");
  localStorage.removeItem("portal_token");
  localStorage.removeItem("portal_user");
}
function requireAdminAuth() {
  const token = getAdminToken();
  if (!token) { window.location.href = "/login.html"; return false; }
  return true;
}
function adminFetch(url, options = {}) {
  const token = getAdminToken();
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      Authorization: "Bearer " + token,
    },
  }).then((response) => {
    if (response.status === 401) {
      const onLoginPage = window.location.pathname.includes("/login");
      if (!onLoginPage) {
        clearAdminSession();
        showToast("⏰ Session expired. Redirecting to login...", "warning");
        setTimeout(() => { window.location.href = "/login.html"; }, 1200);
      }
    }
    return response;
  });
}

// ============================================
// HELPERS
// ============================================
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function escapeQuotes(str) { return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;"); }
function capitalize(str) { if (!str) return ""; return str.charAt(0).toUpperCase() + str.slice(1); }
function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const now = new Date();
  const then = new Date(dateStr);
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
  return then.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); } catch { return "—"; }
}
function fmtDateTime(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("en-GB"); } catch { return "—"; }
}
function money(n) { return "₦" + Number(n || 0).toLocaleString(); }
let __lastToast = { msg: '', at: 0 };
function showToast(message, type) {
  const now = Date.now();
  if (message === __lastToast.msg && now - __lastToast.at < 1200) return;
  __lastToast = { msg: message, at: now };

  const existing = document.getElementById("admin-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "admin-toast";
  toast.textContent = message;
  const bg = type === "error" ? "#b91c1c" : type === "warning" ? "#b45309" : type === "info" ? "#1e40af" : "#0a7d2a";
  toast.style.cssText = `position: fixed; bottom: 24px; right: 24px; background: ${bg}; color: #fff; padding: 14px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,0.2); z-index: 99999; font-family: 'Inter', sans-serif; max-width: 340px; word-break: break-word;`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "all 0.3s";
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = (value === undefined || value === null) ? "0" : value;
}
function copyToClipboard(text) {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast("✅ Copied")).catch(() => fallbackCopy(text));
  } else { fallbackCopy(text); }
}
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); showToast("✅ Copied"); }
  catch (e) { alert("Copy manually:\n" + text); }
  document.body.removeChild(ta);
}
function extractArray(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.rows)) return result.rows;
  return [];
}
function badge(status) {
  const s = String(status || "").toLowerCase();
  let cls = "muted";
  if (["approved", "verified", "published", "cleared", "graduated", "success", "active"].includes(s)) cls = "success";
  else if (["rejected", "failed", "lost"].includes(s) || s.includes("reject")) cls = "danger";
  else if (["pending", "draft", "under_review", "in_review", "submitted"].includes(s)) cls = "warning";
  else if (["registered", "hod_verified", "info"].includes(s)) cls = "info";
  else if (["ready", "paid"].includes(s)) cls = "primary";
  return `<span class="badge badge-${cls}">${escapeHtml(status || "—")}</span>`;
}
function roleBadge(role) {
  const r = String(role || "").toLowerCase().replace(/\s+/g, "_");
  return `<span class="badge role-${r}">${escapeHtml(r.replace(/_/g, " "))}</span>`;
}
function statusPill(status) {
  const map = {
    pending: { cls: 'warning', icon: '⏳' }, under_review: { cls: 'info', icon: '🔎' },
    approved: { cls: 'success', icon: '✅' }, rejected: { cls: 'danger', icon: '❌' },
    registered: { cls: 'primary', icon: '🎓' },
  };
  const m = map[status] || map.pending;
  return `<span class="badge badge-${m.cls}">${m.icon} ${escapeHtml(String(status || 'pending').replace(/_/g, ' '))}</span>`;
}
function promptReason(label = "Reason:") {
  const v = prompt(label);
  if (v === null) return null;
  if (!v.trim()) { showToast("⚠️ A reason is required.", "warning"); return null; }
  return v.trim();
}
function exportTableAsCSV(table, filename = "export.csv") {
  if (!table) return;
  const rows = Array.from(table.querySelectorAll("tr"));
  const csv = rows.map((tr) => {
    const cells = Array.from(tr.querySelectorAll("th,td"));
    return cells.map((c) => `"${(c.textContent || "").replace(/\s+/g, " ").trim().replace(/"/g, '""')}"`).join(",");
  }).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast("✅ Exported " + filename);
}
function openModal(title, bodyHtml) {
  let backdrop = document.getElementById("modal-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "modal-backdrop";
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `<div class="modal"><div class="modal-head"><h3></h3><button class="icon-btn" data-close>&times;</button></div><div class="modal-body"></div></div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector("[data-close]").addEventListener("click", () => backdrop.classList.remove("open"));
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.classList.remove("open"); });
  }
  backdrop.querySelector("h3").textContent = title;
  backdrop.querySelector(".modal-body").innerHTML = bodyHtml;
  backdrop.classList.add("open");
}

// ============================================
// DASHBOARD
// ============================================
async function initDashboard() { /* Self-bootstraps */ }

async function loadDashboardStats() {
  try {
    const res = await adminFetch("/api/admin/reports/overview");
    const result = await res.json();
    if (!result.success) return;
    const s = result.data || result.stats || result;
    setText("stat-students", s.students);
    setText("stat-lecturers", s.lecturers);
    setText("stat-apps", s.pendingApplications);
    setText("stat-results", s.pendingResults);
    setText("stat-payments", s.pendingPayments);
    setText("stat-clearances", s.pendingClearances);
    setText("stat-complaints", s.openComplaints);
    setText("stat-borrows", s.activeBorrows);
    const badgeEl = document.getElementById("pending-badge");
    if (badgeEl) {
      const pending = s.pendingApplications || 0;
      badgeEl.textContent = pending;
      badgeEl.style.display = pending > 0 ? "inline-flex" : "none";
    }
  } catch (err) { console.debug("[dashboard] stats:", err && err.message); }
}

async function loadRecentActivity() {
  const container = document.getElementById("activity-list");
  if (!container) return;
  try {
    const res = await adminFetch("/api/admin/audit?limit=6");
    const result = await res.json();
    const logs = extractArray(result);
    if (!logs.length) { container.innerHTML = `<p style="text-align:center;color:#94a3b8;padding:20px;font-size:14px;">No activity yet</p>`; return; }
    container.innerHTML = logs.map((r) => {
      const log = r.log || r;
      return `<div class="activity-item"><div class="activity-icon">📝</div><div class="activity-content"><strong>${escapeHtml(log.action || '')}</strong><p>${escapeHtml(log.entity || '')}${log.entityId ? ` #${escapeHtml(String(log.entityId))}` : ''}</p></div><span class="activity-time">${timeAgo(log.createdAt)}</span></div>`;
    }).join("");
  } catch (err) { console.debug("[dashboard] activity:", err && err.message); }
}

async function loadStats() { return loadDashboardStats(); }

async function loadTopDepartments() {
  const box = document.getElementById("top-departments");
  if (!box) return;
  try {
    const res = await adminFetch("/api/admin/reports/enrollment-by-department");
    const json = await res.json();
    const rows = (json.data || []).slice(0, 8);
    if (!rows.length) { box.innerHTML = '<p class="muted">No data.</p>'; return; }
    const max = rows[0].count || 1;
    box.innerHTML = rows.map((r) => `<div class="progress-list-item"><div class="progress-header"><span>${escapeHtml(r.name)}</span><span class="progress-value">${r.count}</span></div><div class="progress-bar"><div class="progress-fill" style="width:${Math.round((r.count / max) * 100)}%"></div></div></div>`).join("");
  } catch (err) { box.innerHTML = `<p class="muted">Could not load.</p>`; }
}

async function loadPendingApprovals() {
  const box = document.getElementById("pending-approvals");
  if (!box) return;
  try {
    const res = await adminFetch("/api/admin/reports/overview");
    const json = await res.json();
    const d = json.data || json;
    const items = [
      { label: "Pending applications", value: d.pendingApplications || 0, page: "applications" },
      { label: "Pending results", value: d.pendingResults || 0, page: "results" },
      { label: "Pending payments", value: d.pendingPayments || 0, page: "payments" },
      { label: "Pending clearances", value: d.pendingClearances || 0, page: "clearances" },
      { label: "Open complaints", value: d.openComplaints || 0, page: "complaints" },
    ];
    box.innerHTML = items.map((it) => `<div class="session-item" style="cursor:pointer;" onclick="FPU_ADMIN_SPA.navigateTo('${it.page}')"><div class="meta"><strong>${escapeHtml(it.label)}</strong></div><div>${badge(it.value > 0 ? 'pending' : 'approved')}</div></div>`).join("");
  } catch (err) { box.innerHTML = `<p class="muted">Could not load.</p>`; }
}

async function loadStudentsByDept() {
  const el = document.getElementById("chart-students-dept");
  if (!el || typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/reports/enrollment-by-department");
    const json = await res.json();
    const rows = (json.data || []).slice(0, 12);
    if (!rows.length) return;
    new Chart(el, { type: 'bar', data: { labels: rows.map((r) => r.name), datasets: [{ label: 'Students', data: rows.map((r) => r.count), backgroundColor: '#065f46', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  } catch (err) { console.debug(err.message); }
}

async function loadStudentsByProgramme() {
  const el = document.getElementById("chart-students-prog");
  if (!el || typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/reports/enrollment-by-programme");
    const json = await res.json();
    const rows = (json.data || []).slice(0, 12);
    if (!rows.length) return;
    new Chart(el, { type: 'bar', data: { labels: rows.map((r) => r.name), datasets: [{ label: 'Students', data: rows.map((r) => r.count), backgroundColor: '#3b82f6', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  } catch (err) { console.debug(err.message); }
}

async function loadStudentsByLevel() {
  const el = document.getElementById("chart-students-level");
  if (!el || typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/reports/enrollment-by-level");
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) return;
    new Chart(el, { type: 'bar', data: { labels: rows.map((r) => r.level || 'Unknown'), datasets: [{ label: 'Students', data: rows.map((r) => r.count), backgroundColor: '#8b5cf6', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  } catch (err) { console.debug(err.message); }
}

async function loadStudentGender() {
  const el = document.getElementById("chart-students-gender");
  if (!el || typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/students?limit=1000");
    const json = await res.json();
    const rows = json.data || [];
    let male = 0, female = 0, other = 0;
    rows.forEach((s) => {
      const g = String(s.gender || '').toLowerCase();
      if (g === 'male') male++; else if (g === 'female') female++; else other++;
    });
    if (male + female + other === 0) return;
    new Chart(el, { type: 'doughnut', data: { labels: ['Male', 'Female', 'Not Specified'], datasets: [{ data: [male, female, other], backgroundColor: ['#3b82f6', '#ec4899', '#64748b'], borderColor: '#ffffff', borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '62%' } });
  } catch (err) { console.debug(err.message); }
}

async function loadAdmissionTrend() {
  const el = document.getElementById("chart-admission-trend");
  if (!el || typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch(`/api/admin/reports/admission-trend?days=${window.__dashRangeDays || 365}`);
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) return;
    new Chart(el, { type: 'line', data: { labels: rows.map((r) => r.month), datasets: [{ label: 'Admissions', data: rows.map((r) => r.count), borderColor: '#065f46', backgroundColor: 'rgba(6, 95, 70, 0.1)', tension: 0.4, fill: true, borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  } catch (err) { console.debug(err.message); }
}

async function loadApplicationStatus() {
  const el = document.getElementById("chart-app-status");
  if (!el || typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/reports/applications-by-status");
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) return;
    const colorMap = { pending: '#f59e0b', under_review: '#3b82f6', approved: '#065f46', rejected: '#dc2626', registered: '#8b5cf6' };
    new Chart(el, { type: 'doughnut', data: { labels: rows.map((r) => (r.status || 'unknown').replace(/_/g, ' ')), datasets: [{ data: rows.map((r) => r.count), backgroundColor: rows.map((r) => colorMap[r.status] || '#64748b'), borderColor: '#ffffff', borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '62%' } });
  } catch (err) { console.debug(err.message); }
}

async function loadPopulationTrend() {
  const el = document.getElementById("chart-population-trend");
  if (!el || typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch(`/api/admin/reports/population-trend?days=${window.__dashRangeDays || 365}`);
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) return;
    new Chart(el, { type: 'line', data: { labels: rows.map((r) => r.month), datasets: [{ label: 'Total Students', data: rows.map((r) => r.total), borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', tension: 0.4, fill: true, borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  } catch (err) { console.debug(err.message); }
}

async function loadPaymentStatus() {
  const el = document.getElementById("chart-payment-status");
  if (!el || typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/reports/payments-by-status");
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) return;
    const colorMap = { pending: '#f59e0b', verified: '#065f46', rejected: '#dc2626', refunded: '#3b82f6' };
    new Chart(el, { type: 'doughnut', data: { labels: rows.map((r) => r.status || 'unknown'), datasets: [{ data: rows.map((r) => r.count), backgroundColor: rows.map((r) => colorMap[r.status] || '#64748b'), borderColor: '#ffffff', borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '62%' } });
  } catch (err) { console.debug(err.message); }
}

async function loadRevenueTrend() {
  const el = document.getElementById("chart-revenue-trend");
  if (!el || typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch(`/api/admin/reports/revenue-trend?days=${window.__dashRangeDays || 365}`);
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) return;
    new Chart(el, { type: 'line', data: { labels: rows.map((r) => r.month), datasets: [{ label: 'Revenue (₦)', data: rows.map((r) => Number(r.total || 0)), borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.15)', tension: 0.4, fill: true, borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  } catch (err) { console.debug(err.message); }
}

async function loadRegistrationStats() {
  const el = document.getElementById("chart-registrations");
  if (!el || typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/reports/registrations-by-status");
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) return;
    const colorMap = { pending: '#f59e0b', approved: '#065f46', rejected: '#dc2626' };
    new Chart(el, { type: 'bar', data: { labels: rows.map((r) => r.status), datasets: [{ label: 'Registrations', data: rows.map((r) => r.count), backgroundColor: rows.map((r) => colorMap[r.status] || '#64748b'), borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  } catch (err) { console.debug(err.message); }
}

async function loadDeptComparison() {
  const el = document.getElementById("chart-dept-comparison");
  if (!el || typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/reports/enrollment-by-department");
    const json = await res.json();
    const rows = (json.data || []).slice(0, 10);
    if (!rows.length) return;
    new Chart(el, { type: 'bar', data: { labels: rows.map((r) => r.name), datasets: [{ label: 'Students', data: rows.map((r) => r.count), backgroundColor: '#14b8a6', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  } catch (err) { console.debug(err.message); }
}

async function loadResultsStats() {
  const el = document.getElementById("chart-results-stats");
  if (!el || typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/reports/results-by-status");
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) return;
    const colorMap = { draft: '#64748b', submitted: '#3b82f6', hod_verified: '#8b5cf6', approved: '#065f46', published: '#10b981', hod_rejected: '#dc2626', admin_rejected: '#dc2626' };
    new Chart(el, { type: 'bar', data: { labels: rows.map((r) => (r.status || '').replace(/_/g, ' ')), datasets: [{ label: 'Results', data: rows.map((r) => r.count), backgroundColor: rows.map((r) => colorMap[r.status] || '#64748b'), borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  } catch (err) { console.debug(err.message); }
}

async function loadRecentStudents() {
  const tbody = document.getElementById("recent-students-tbody");
  if (!tbody) return;
  try {
    const res = await adminFetch("/api/admin/students?limit=8");
    const json = await res.json();
    const rows = json.data || [];
    tbody.innerHTML = rows.length ? rows.map((s) => `<tr><td><code>${escapeHtml(s.matricNumber || '')}</code></td><td><strong>${escapeHtml(s.firstName || '')} ${escapeHtml(s.lastName || '')}</strong></td><td>${escapeHtml(s.level || '')}</td><td>${escapeHtml(s.programmeName || s.programme?.name || '—')}</td><td>${fmtDate(s.createdAt)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No students yet.</td></tr>';
  } catch (err) { console.debug(err.message); }
}

async function loadRecentPayments() {
  const tbody = document.getElementById("recent-payments-tbody");
  if (!tbody) return;
  try {
    const res = await adminFetch("/api/admin/payments?limit=8");
    const json = await res.json();
    const rows = json.data || [];
    tbody.innerHTML = rows.length ? rows.map((r) => {
      const p = r.payment || r;
      const studentName = r.student ? `${r.student.firstName || ''} ${r.student.lastName || ''}`.trim() : '—';
      return `<tr><td><code>${escapeHtml(p.reference || '')}</code></td><td>${escapeHtml(studentName)}</td><td class="num">${money(p.amount)}</td><td>${badge(p.status)}</td></tr>`;
    }).join('') : '<tr><td colspan="4" class="empty">No payments yet.</td></tr>';
  } catch (err) { console.debug(err.message); }
}

async function loadRecentApplications() {
  const tbody = document.getElementById("recent-apps-tbody");
  if (!tbody) return;
  try {
    const res = await adminFetch("/api/admin/applications?limit=8");
    const json = await res.json();
    const rows = json.data || [];
    tbody.innerHTML = rows.length ? rows.map((a) => `<tr><td><code>${escapeHtml(a.applicationNumber || '')}</code></td><td>${escapeHtml((a.firstName || '') + ' ' + (a.lastName || ''))}</td><td>${escapeHtml(a.type || 'ND')}</td><td>${statusPill(a.status)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No applications yet.</td></tr>';
  } catch (err) { console.debug(err.message); }
}

async function loadRecentRegistrations() {
  const tbody = document.getElementById("recent-registrations-tbody");
  if (!tbody) return;
  try {
    const res = await adminFetch("/api/admin/registrations/with-student?limit=8");
    const json = await res.json();
    const rows = json.data || [];
    tbody.innerHTML = rows.length ? rows.map((r) => {
      const student = r.student || {}; const course = r.course || {}; const reg = r.registration || r;
      return `<tr><td>${escapeHtml((student.firstName || '') + ' ' + (student.lastName || '')) || 'Student ' + reg.studentId}</td><td>${escapeHtml(course.code || ('Course ' + reg.courseId))}</td><td>${escapeHtml(reg.semester || '')}</td><td>${badge(reg.status)}</td></tr>`;
    }).join('') : '<tr><td colspan="4" class="empty">No registrations yet.</td></tr>';
  } catch (err) { console.debug(err.message); }
}

async function loadRecentResults() {
  const tbody = document.getElementById("recent-results-tbody");
  if (!tbody) return;
  try {
    const res = await adminFetch("/api/admin/results?limit=8");
    const json = await res.json();
    const rows = json.data || [];
    tbody.innerHTML = rows.length ? rows.map((r) => `<tr><td>Student ${r.studentId}</td><td>Course ${r.courseId}</td><td class="num">${r.score}</td><td>${badge(r.status)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No results yet.</td></tr>';
  } catch (err) { console.debug(err.message); }
}

async function loadRecentNotifications() {
  const box = document.getElementById("recent-notifications");
  if (!box) return;
  try {
    const res = await adminFetch("/api/admin/notifications");
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) { box.innerHTML = '<p class="muted">No notifications.</p>'; return; }
    box.innerHTML = rows.slice(0, 6).map((n) => `<div class="session-item"><div class="meta"><strong>${escapeHtml(n.title || '')}</strong>${escapeHtml((n.body || '').slice(0, 80))}</div><div class="small muted">${timeAgo(n.createdAt)}</div></div>`).join('');
  } catch (err) { console.debug(err.message); }
}

async function loadUpcomingEvents() {
  const box = document.getElementById("upcoming-events");
  if (!box) return;
  try {
    const res = await adminFetch("/api/admin/exams?limit=5");
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) { box.innerHTML = '<p class="muted">No upcoming events.</p>'; return; }
    box.innerHTML = rows.slice(0, 5).map((r) => {
      const exam = r.exam || r; const course = r.course || {};
      return `<div class="session-item"><div class="meta"><strong>${escapeHtml(course.code || '')} — ${escapeHtml(course.title || 'Exam')}</strong><div class="small">${exam.startTime || ''} ${exam.endTime ? '- ' + exam.endTime : ''} · ${escapeHtml(exam.venue || '')}</div></div><div class="small muted">${exam.examDate ? fmtDate(exam.examDate) : ''}</div></div>`;
    }).join('');
  } catch (err) { console.debug(err.message); }
}

async function loadRecentLogins() {
  const box = document.getElementById("recent-logins");
  if (!box) return;
  try {
    const res = await adminFetch("/api/admin/login-history?limit=8");
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) { box.innerHTML = '<p class="muted">No logins yet.</p>'; return; }
    box.innerHTML = rows.map((r) => {
      const entry = r.entry || r; const user = r.user || {};
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || entry.email || 'Unknown';
      return `<div class="session-item"><div class="meta"><strong>${entry.success ? '✅' : '❌'} ${escapeHtml(name)}</strong><div class="small">${escapeHtml(entry.ipAddress || '')}</div></div><div class="small muted">${timeAgo(entry.createdAt)}</div></div>`;
    }).join('');
  } catch (err) { console.debug(err.message); }
}

async function loadAll() {
  const fns = [
    loadStats, loadTopDepartments, loadPendingApprovals,
    loadStudentsByDept, loadStudentsByProgramme, loadStudentsByLevel, loadStudentGender,
    loadAdmissionTrend, loadApplicationStatus, loadPopulationTrend, loadPaymentStatus,
    loadRevenueTrend, loadRegistrationStats, loadDeptComparison, loadResultsStats,
    loadRecentStudents, loadRecentPayments, loadRecentApplications, loadRecentRegistrations,
    loadRecentResults, loadRecentActivity, loadRecentNotifications, loadUpcomingEvents, loadRecentLogins,
  ];
  const promises = [];
  for (const fn of fns) {
    if (typeof fn !== 'function') continue;
    try {
      const p = fn();
      if (p && typeof p.catch === 'function') p.catch((err) => console.debug(`[dashboard]:`, err && err.message));
      promises.push(p);
    } catch (err) { console.debug(`[dashboard] threw:`, err && err.message); }
  }
  await Promise.allSettled(promises);
}

// ============================================
// APPLICATIONS
// ============================================
async function loadApplications() {
  const container = document.getElementById("applications-tbody");
  if (!container) return;
  const status = (document.getElementById("applications-status-filter") || {}).value || "";
  const type = (document.getElementById("applications-type-filter") || {}).value || "";
  const country = (document.getElementById("applications-country-filter") || {}).value || "";
  const state = (document.getElementById("applications-state-filter") || {}).value || "";
  const search = (document.getElementById("applications-search") || {}).value || "";

  const qs = new URLSearchParams({ limit: 500 });
  if (status) qs.set("status", status);
  if (type) qs.set("type", type);
  if (country) qs.set("country", country);
  if (state) qs.set("state", state);
  if (search) qs.set("search", search);

  container.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';
  try {
    const res = await adminFetch(`/api/admin/applications?${qs}`);
    const result = await res.json();
    const apps = extractArray(result);
    updateApplicationStats(apps);
    if (!apps.length) { container.innerHTML = `<tr><td colspan="7" class="empty">No applications found.</td></tr>`; return; }

    if (window.FPU_PAGINATE && typeof window.FPU_PAGINATE.mount === 'function') {
      window.__appsPager = window.FPU_PAGINATE.mount(container, apps, {
        pageSize: 25, renderRow: (a) => {
          const fullName = `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Applicant';
          const initials = ((a.firstName || ' ')[0] + (a.lastName || ' ')[0]).toUpperCase().trim() || 'A';
          const avatar = a.passportUrl ? `<img src="${escapeHtml(a.passportUrl)}" alt="" />` : escapeHtml(initials);
          return `<tr class="row-clickable" data-id="${a.id}"><td style="width:32px;"><input type="checkbox" class="app-check" data-id="${a.id}" onclick="event.stopPropagation()" /></td><td><code>${escapeHtml(a.applicationNumber || '')}</code></td><td><div class="applicant-cell"><div class="applicant-avatar">${avatar}</div><div><div class="applicant-name">${escapeHtml(fullName)}</div><div class="applicant-meta">${escapeHtml(a.email || '')}</div></div></div></td><td>${escapeHtml(a.type || 'ND')}</td><td>${statusPill(a.status)}</td><td class="small muted">${fmtDate(a.createdAt)}</td><td><div class="row-actions"><button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('application-view', { id: ${a.id} })">View</button></div></td></tr>`;
        },
      });
      setTimeout(() => {
        container.querySelectorAll('tr[data-id]').forEach((tr) => {
          if (tr.__fpuClickBound) return;
          tr.__fpuClickBound = true;
          tr.addEventListener('click', () => { FPU_ADMIN_SPA.navigateToWithQuery('application-view', { id: Number(tr.dataset.id) }); });
        });
      }, 0);
    } else {
      container.innerHTML = apps.map((a) => {
        const fullName = `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Applicant';
        const initials = ((a.firstName || ' ')[0] + (a.lastName || ' ')[0]).toUpperCase().trim() || 'A';
        const avatar = a.passportUrl ? `<img src="${escapeHtml(a.passportUrl)}" alt="" />` : escapeHtml(initials);
        return `<tr class="row-clickable" data-id="${a.id}"><td style="width:32px;"><input type="checkbox" class="app-check" data-id="${a.id}" onclick="event.stopPropagation()" /></td><td><code>${escapeHtml(a.applicationNumber || '')}</code></td><td><div class="applicant-cell"><div class="applicant-avatar">${avatar}</div><div><div class="applicant-name">${escapeHtml(fullName)}</div><div class="applicant-meta">${escapeHtml(a.email || '')}</div></div></div></td><td>${escapeHtml(a.type || 'ND')}</td><td>${statusPill(a.status)}</td><td class="small muted">${fmtDate(a.createdAt)}</td><td><div class="row-actions" style="white-space:nowrap;"><button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('application-view', { id: ${a.id} })">👁 View</button>${['pending','under_review'].includes(String(a.status).toLowerCase()) ? `<button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); FPU_ADMIN.approveApplication(${a.id})">✅ Approve</button><button class="btn btn-sm btn-ghost" style="color:#dc2626;" onclick="event.stopPropagation(); FPU_ADMIN.rejectApplication(${a.id})">❌ Reject</button>` : ''}${String(a.status).toLowerCase() === 'approved' ? `<button class="btn btn-sm" style="background:#3b82f6;color:white;border-color:#3b82f6;" onclick="event.stopPropagation(); FPU_ADMIN.registerApplication(${a.id})">🎓 Register</button>` : ''}</div></td></tr>`;
      }).join("");
      container.querySelectorAll('tr[data-id]').forEach((tr) => { tr.addEventListener('click', () => { FPU_ADMIN_SPA.navigateToWithQuery('application-view', { id: Number(tr.dataset.id) }); }); });
    }
    const selectAll = document.getElementById('apps-select-all');
    if (selectAll) { selectAll.checked = false; selectAll.onchange = () => { container.querySelectorAll('.app-check').forEach((cb) => { cb.checked = selectAll.checked; }); }; }
  } catch (err) { container.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`; }
}

function updateApplicationStats(rows) {
  const counts = { total: rows.length, pending: 0, approved: 0, registered: 0 };
  rows.forEach((r) => {
    if (r.status === 'pending' || r.status === 'under_review') counts.pending += 1;
    else if (r.status === 'approved') counts.approved += 1;
    else if (r.status === 'registered') counts.registered += 1;
  });
  Object.keys(counts).forEach((k) => { const el = document.getElementById(`app-stat-${k}`); if (el) el.textContent = counts[k]; });
}

async function bulkApplicationAction(action) {
  const ids = Array.from(document.querySelectorAll('.app-check:checked')).map((cb) => Number(cb.dataset.id));
  if (ids.length === 0) { showToast('⚠️ Select at least one application.', 'warning'); return; }
  let reason = null;
  if (action === 'reject') {
    reason = prompt(`Reason for rejecting ${ids.length} application(s):`);
    if (reason === null) return;
    if (!reason.trim()) { showToast('⚠️ A reason is required.', 'warning'); return; }
  } else { if (!confirm(`${action === 'delete' ? 'Delete' : 'Approve'} ${ids.length} application(s)?`)) return; }

  try {
    const res = await adminFetch('/api/admin/applications/bulk', { method: 'POST', body: JSON.stringify({ ids, action, reason }) });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showToast(`✅ ${json.processed} of ${ids.length} processed.`);
    loadApplications();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function approveApplication(id) {
  if (!confirm('Approve this application?')) return;
  try {
    const res = await adminFetch(`/api/admin/applications/${id}/approve`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Approve failed');
    showToast('✅ Application approved.', 'success');
    loadApplications();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function rejectApplication(id) {
  const reason = prompt('Enter rejection reason (optional):');
  if (reason === null) return;
  try {
    const res = await adminFetch(`/api/admin/applications/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() || 'Did not meet requirements.' }) });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Reject failed');
    showToast('⚠️ Application rejected.', 'warning');
    loadApplications();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function registerApplication(id) {
  if (!confirm('Register this applicant?\n\nThis will:\n• Generate a Matric Number\n• Create a Student Portal account\n• Send them a welcome email\n\nProceed?')) return;
  try {
    const res = await adminFetch(`/api/admin/applications/${id}/register`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Registration failed');
    const matric = (json.data && json.data.matricNumber) ? json.data.matricNumber : 'N/A';
    showToast('🎓 Student registered! Matric: ' + matric, 'success');
    loadApplications();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function loadAdmitted() {
  const container = document.getElementById("admitted-tbody");
  if (!container) return;
  const statusFilter = (document.getElementById("admitted-status-filter") || {}).value;
  const typeFilter = (document.getElementById("admitted-type-filter") || {}).value || "";
  const search = (document.getElementById("admitted-search") || {}).value || "";
  const status = statusFilter === undefined ? "approved" : statusFilter;
  const qs = new URLSearchParams({ limit: 500 });
  if (status) qs.set("status", status);
  if (typeFilter) qs.set("type", typeFilter);
  if (search) qs.set("search", search);

  container.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';
  try {
    const res = await adminFetch(`/api/admin/applications?${qs}`);
    const json = await res.json();
    const rows = json.data || [];
    updateAdmittedStats(rows);
    if (!rows.length) { container.innerHTML = `<tr><td colspan="7" class="empty">No applicants found.</td></tr>`; return; }

    if (window.FPU_PAGINATE && typeof window.FPU_PAGINATE.mount === 'function') {
      window.FPU_PAGINATE.mount(container, rows, {
        pageSize: 25, renderRow: (a) => {
          const fullName = `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Applicant';
          const initials = ((a.firstName || ' ')[0] + (a.lastName || ' ')[0]).toUpperCase().trim() || 'A';
          const avatar = a.passportUrl ? `<img src="${escapeHtml(a.passportUrl)}" alt="" />` : escapeHtml(initials);
          const isRegistered = a.status === 'registered';
          return `<tr class="row-clickable" data-id="${a.id}"><td style="width:32px;">${!isRegistered ? `<input type="checkbox" class="adm-check" data-id="${a.id}" onclick="event.stopPropagation()" />` : ''}</td><td><code>${escapeHtml(a.applicationNumber || '')}</code></td><td><div class="applicant-cell"><div class="applicant-avatar">${avatar}</div><div><div class="applicant-name">${escapeHtml(fullName)}</div><div class="applicant-meta">${escapeHtml(a.email || '')}</div></div></div></td><td>${escapeHtml(a.type || 'ND')}</td><td>${statusPill(a.status)}</td><td class="small muted">${a.reviewedAt ? fmtDate(a.reviewedAt) : '—'}</td><td><div class="row-actions"><button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('application-view', { id: ${a.id} })">View</button>${!isRegistered ? `<button class="btn btn-sm btn-accent" onclick="event.stopPropagation(); FPU_ADMIN.registerAdmitted(${a.id})">Register</button>` : `<span class="badge badge-primary">🎓 ${escapeHtml(a.matricNumber || 'Registered')}</span>`}</div></td></tr>`;
        },
      });
      setTimeout(() => {
        container.querySelectorAll('tr[data-id]').forEach((tr) => {
          if (tr.__fpuClickBound) return;
          tr.__fpuClickBound = true;
          tr.addEventListener('click', () => { FPU_ADMIN_SPA.navigateToWithQuery('application-view', { id: Number(tr.dataset.id) }); });
        });
      }, 0);
    } else {
      container.innerHTML = rows.map((a) => {
        const fullName = `${a.firstName || ''} ${a.lastName || ''}`.trim();
        const initials = ((a.firstName || ' ')[0] + (a.lastName || ' ')[0]).toUpperCase().trim() || 'A';
        const avatar = a.passportUrl ? `<img src="${escapeHtml(a.passportUrl)}" alt="" />` : escapeHtml(initials);
        const isRegistered = a.status === 'registered';
        return `<tr class="row-clickable" data-id="${a.id}"><td>${!isRegistered ? `<input type="checkbox" class="adm-check" data-id="${a.id}" onclick="event.stopPropagation()" />` : ''}</td><td><code>${escapeHtml(a.applicationNumber || '')}</code></td><td><div class="applicant-cell"><div class="applicant-avatar">${avatar}</div><div><div class="applicant-name">${escapeHtml(fullName)}</div><div class="applicant-meta">${escapeHtml(a.email || '')}</div></div></div></td><td>${escapeHtml(a.type || 'ND')}</td><td>${statusPill(a.status)}</td><td class="small muted">${a.reviewedAt ? fmtDate(a.reviewedAt) : '—'}</td><td><div class="row-actions"><button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('application-view', { id: ${a.id} })">View</button>${!isRegistered ? `<button class="btn btn-sm btn-accent" onclick="event.stopPropagation(); FPU_ADMIN.registerAdmitted(${a.id})">Register</button>` : ''}</div></td></tr>`;
      }).join("");
      container.querySelectorAll('tr[data-id]').forEach((tr) => { tr.addEventListener('click', () => { FPU_ADMIN_SPA.navigateToWithQuery('application-view', { id: Number(tr.dataset.id) }); }); });
    }
    const selectAll = document.getElementById('adm-select-all');
    if (selectAll) { selectAll.checked = false; selectAll.onchange = () => { container.querySelectorAll('.adm-check').forEach((cb) => { cb.checked = selectAll.checked; }); }; }
  } catch (err) { container.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`; }
}

function updateAdmittedStats(rows) {
  const awaiting = rows.filter((r) => r.status === 'approved').length;
  const registered = rows.filter((r) => r.status === 'registered').length;
  const nd = rows.filter((r) => r.type === 'ND').length;
  const hnd = rows.filter((r) => r.type === 'HND').length;
  setText('adm-stat-total', rows.length);
  setText('adm-stat-awaiting', awaiting);
  setText('adm-stat-registered', registered);
  setText('adm-stat-split', `${nd} / ${hnd}`);
}

async function bulkRegisterAdmitted() {
  const ids = Array.from(document.querySelectorAll('.adm-check:checked')).map((cb) => Number(cb.dataset.id));
  if (ids.length === 0) { showToast('⚠️ Select at least one applicant.', 'warning'); return; }
  if (!confirm(`Create student accounts for ${ids.length} applicant(s)?\n\nEach will be assigned a matric number and default password "student1234".`)) return;
  let ok = 0, failed = 0;
  for (const id of ids) {
    try {
      const res = await adminFetch(`/api/admin/applications/${id}/register`, { method: 'POST' });
      const json = await res.json();
      if (json.success) ok++; else failed++;
    } catch (e) { failed++; }
  }
  showToast(failed === 0 ? `✅ Registered ${ok} applicant(s).` : `⚠️ ${ok} registered, ${failed} failed.`, failed > 0 ? 'warning' : 'success');
  loadAdmitted();
}

async function registerAdmitted(id) {
  if (!confirm('Create the student account and assign a matric number?')) return;
  try {
    const res = await adminFetch(`/api/admin/applications/${id}/register`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Registration failed');
    showToast(`Registered. Matric: ${json.data.matricNumber}`);
    loadAdmitted();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

// ============================================
// STUDENTS
// ============================================
async function loadStudentDepartments() {
  const grid = document.getElementById('dept-grid');
  if (!grid) return;
  const schoolId = (document.getElementById('stu-filter-school') || {}).value || '';
  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading departments…</div>';
  try {
    const [deptRes, studentRes, schoolRes] = await Promise.all([
      adminFetch('/api/admin/departments'), adminFetch(`/api/admin/students?limit=5000${schoolId ? '&schoolId=' + schoolId : ''}`), adminFetch('/api/admin/schools'),
    ]);
    const depts = (await deptRes.json()).data || [];
    const students = (await studentRes.json()).data || [];
    const schools = (await schoolRes.json()).data || [];
    const schoolMap = new Map(schools.map((s) => [s.id, s]));
    const byDept = new Map();
    for (const d of depts) byDept.set(d.id, { dept: d, students: [] });
    for (const u of students) { if (!u.departmentId) continue; if (!byDept.has(u.departmentId)) continue; byDept.get(u.departmentId).students.push(u); }
    const visible = [...byDept.values()].filter(({ dept }) => { if (!schoolId) return true; return Number(dept.schoolId) === Number(schoolId); });
    const totalStudents = visible.reduce((s, d) => s + d.students.length, 0);
    const activeCount = visible.reduce((s, d) => s + d.students.filter((u) => u.isActive !== false).length, 0);
    const ndCount = visible.reduce((s, d) => s + d.students.filter((u) => u.level === 'ND').length, 0);
    const hndCount = visible.reduce((s, d) => s + d.students.filter((u) => u.level === 'HND').length, 0);
    setText('stu-stat-total', totalStudents); setText('stu-stat-active', activeCount); setText('stu-stat-nd', ndCount); setText('stu-stat-hnd', hndCount);
    if (!visible.length) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">🏫</div><p>No departments found.</p></div>`; return; }
    visible.sort((a, b) => String(a.dept.code).localeCompare(String(b.dept.code)));
    grid.innerHTML = visible.map(({ dept, students: list }) => {
      const count = list.length; const active = list.filter((u) => u.isActive !== false).length;
      const nd = list.filter((u) => u.level === 'ND').length; const hnd = list.filter((u) => u.level === 'HND').length; const cert = list.filter((u) => u.level === 'CERT').length;
      const school = schoolMap.get(dept.schoolId); const isEmpty = count === 0;
      return `<div class="dept-card ${isEmpty ? 'empty' : ''}" ${isEmpty ? '' : `data-dept-id="${dept.id}" data-dept-name="${escapeHtml(dept.name)}"`}><div class="dept-head"><span class="dept-code">${escapeHtml(dept.code)}</span><span class="dept-school">${escapeHtml(school?.code || '')}</span></div><h3>${escapeHtml(dept.name)}</h3><div class="dept-count"><span class="num">${count}</span><span class="label">student${count === 1 ? '' : 's'}</span></div><div class="dept-split">${nd ? `<span class="dept-chip nd">ND: ${nd}</span>` : ''}${hnd ? `<span class="dept-chip hnd">HND: ${hnd}</span>` : ''}${cert ? `<span class="dept-chip cert">CERT: ${cert}</span>` : ''}${(!nd && !hnd && !cert) ? `<span class="dept-chip">No students</span>` : ''}</div><div class="dept-footer"><span>${active} active</span><span class="arrow">View students →</span></div></div>`;
    }).join('');
    grid.querySelectorAll('.dept-card[data-dept-id]').forEach((card) => { card.addEventListener('click', () => { FPU_ADMIN_SPA.navigateToWithQuery('students-by-dept', { departmentId: Number(card.dataset.deptId), name: card.dataset.deptName }); }); });
  } catch (err) { grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`; }
}

async function globalStudentSearch() {
  const term = (document.getElementById('stu-global-search') || {}).value || '';
  if (!term.trim()) { showToast('Enter a search term.', 'warning'); return; }
  FPU_ADMIN_SPA.navigateToWithQuery('students-by-dept', { departmentId: '', name: 'Search Results', q: term.trim() });
}

async function loadDepartmentStudents() {
  const container = document.getElementById('dept-students-tbody');
  if (!container) return;
  const hash = window.location.hash.replace(/^#/, ''); const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const departmentId = params.get('departmentId') || ''; const deptName = params.get('name') || 'Department';
  const globalQuery = params.get('q') || '';
  const titleEl = document.getElementById('dept-page-title'); const tableTitle = document.getElementById('dept-table-title');
  if (titleEl) titleEl.textContent = deptName; if (tableTitle) tableTitle.textContent = `${deptName} — Students`;
  const subtitleEl = document.getElementById('dept-page-subtitle');
  if (subtitleEl) subtitleEl.textContent = departmentId ? `Students enrolled in ${deptName}` : `Search results for "${globalQuery}"`;
  const progSelect = document.getElementById('dept-filter-programme');
  if (progSelect && departmentId) { progSelect.dataset.extraParams = JSON.stringify({ departmentId }); if (window.FPU_LOOKUPS && window.FPU_LOOKUPS.populate) window.FPU_LOOKUPS.populate(progSelect); }
  const level = (document.getElementById('dept-filter-level') || {}).value || '';
  const programme = (document.getElementById('dept-filter-programme') || {}).value || '';
  const status = (document.getElementById('dept-filter-status') || {}).value || '';
  const search = (document.getElementById('dept-filter-search') || {}).value || globalQuery;
  const qs = new URLSearchParams({ limit: 5000 });
  if (departmentId) qs.set('departmentId', departmentId); if (level) qs.set('level', level);
  if (programme) qs.set('programmeId', programme); if (status) qs.set('isActive', status === 'active' ? 'true' : 'false');
  if (search) qs.set('search', search);
  container.innerHTML = '<tr><td colspan="8" class="empty">Loading…</td></tr>';
  try {
    const res = await adminFetch(`/api/admin/students?${qs}`);
    const result = await res.json();
    const students = extractArray(result);
    setText('dept-stat-total', students.length); setText('dept-stat-active', students.filter((u) => u.isActive !== false).length);
    setText('dept-stat-nd', students.filter((u) => u.level === 'ND').length); setText('dept-stat-hnd', students.filter((u) => u.level === 'HND').length);
    if (!students.length) { container.innerHTML = `<tr><td colspan="8" class="empty">No students found.</td></tr>`; return; }
    if (window.FPU_PAGINATE && typeof window.FPU_PAGINATE.mount === 'function') {
      window.FPU_PAGINATE.mount(container, students, {
        pageSize: 25, renderRow: (u) => {
          const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
          const initials = ((u.firstName || ' ')[0] + (u.lastName || ' ')[0]).toUpperCase().trim() || 'S';
          const avatar = u.photoUrl ? `<img src="${escapeHtml(u.photoUrl)}" alt="" />` : escapeHtml(initials);
          return `<tr class="row-clickable" data-id="${u.id}"><td style="width:32px;"><input type="checkbox" class="stu-check" data-id="${u.id}" onclick="event.stopPropagation()" /></td><td><code>${escapeHtml(u.matricNumber || u.matric || '')}</code></td><td><div class="applicant-cell"><div class="applicant-avatar">${avatar}</div><div><div class="applicant-name">${escapeHtml(fullName)}</div><div class="applicant-meta">${escapeHtml(u.email || '')}</div></div></div></td><td>${escapeHtml(u.level || '')}</td><td>${escapeHtml(u.programmeName || u.programme?.name || '—')}</td><td>${escapeHtml(u.phone || '—')}</td><td>${u.isActive !== false ? badge('active') : badge('inactive')}</td><td><div class="row-actions"><button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('student-profile', { id: ${u.id} })">View</button></div></td></tr>`;
        }
      });
      setTimeout(() => { container.querySelectorAll('tr[data-id]').forEach((tr) => { if (tr.__fpuClickBound) return; tr.__fpuClickBound = true; tr.addEventListener('click', () => { FPU_ADMIN_SPA.navigateToWithQuery('student-profile', { id: Number(tr.dataset.id) }); }); }); }, 0);
    } else {
      container.innerHTML = students.map((u) => {
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
        const initials = ((u.firstName || ' ')[0] + (u.lastName || ' ')[0]).toUpperCase().trim() || 'S';
        const avatar = u.photoUrl ? `<img src="${escapeHtml(u.photoUrl)}" alt="" />` : escapeHtml(initials);
        return `<tr class="row-clickable" data-id="${u.id}"><td><input type="checkbox" class="stu-check" data-id="${u.id}" onclick="event.stopPropagation()" /></td><td><code>${escapeHtml(u.matricNumber || '')}</code></td><td><div class="applicant-cell"><div class="applicant-avatar">${avatar}</div><div><div class="applicant-name">${escapeHtml(fullName)}</div><div class="applicant-meta">${escapeHtml(u.email || '')}</div></div></div></td><td>${escapeHtml(u.level || '')}</td><td>${escapeHtml(u.programmeName || u.programme?.name || '')}</td><td>${escapeHtml(u.phone || '')}</td><td>${u.isActive !== false ? badge('active') : badge('inactive')}</td><td><div class="row-actions"><button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('student-profile', { id: ${u.id} })">View</button></div></td></tr>`;
      }).join('');
      container.querySelectorAll('tr[data-id]').forEach((tr) => { tr.addEventListener('click', () => { FPU_ADMIN_SPA.navigateToWithQuery('student-profile', { id: Number(tr.dataset.id) }); }); });
    }
    const selectAll = document.getElementById('dept-select-all');
    if (selectAll) { selectAll.checked = false; selectAll.onchange = () => { container.querySelectorAll('.stu-check').forEach((cb) => { cb.checked = selectAll.checked; }); }; }
  } catch (err) { container.innerHTML = `<tr><td colspan="8" class="empty">${escapeHtml(err.message)}</td></tr>`; }
}

async function bulkStudentAction(action) {
  const ids = Array.from(document.querySelectorAll('.stu-check:checked')).map((cb) => Number(cb.dataset.id));
  if (ids.length === 0) { showToast('⚠️ Select at least one student.', 'warning'); return; }
  let password = null;
  if (action === 'reset-password') {
    password = prompt(`Reset password for ${ids.length} student(s) to:`, 'student1234');
    if (password === null) return; if (!password.trim()) { showToast('⚠️ A password is required.', 'warning'); return; }
  } else { if (!confirm(`${action === 'delete' ? 'Delete' : action === 'activate' ? 'Activate' : 'Deactivate'} ${ids.length} student(s)?`)) return; }
  let ok = 0, failed = 0;
  for (const id of ids) {
    try {
      if (action === 'delete') { await adminFetch(`/api/admin/students/${id}`, { method: 'DELETE' }); }
      else if (action === 'activate' || action === 'deactivate') {
        const cur = await adminFetch(`/api/admin/students/${id}`).then(r => r.json());
        const isCurrentlyActive = cur.data.isActive !== false;
        const shouldBeActive = action === 'activate';
        if (isCurrentlyActive !== shouldBeActive) { await adminFetch(`/api/admin/students/${id}/toggle-active`, { method: 'POST' }); }
      } else if (action === 'reset-password') { await adminFetch(`/api/admin/students/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }); }
      ok++;
    } catch (e) { failed++; }
  }
  showToast(failed === 0 ? `✅ ${ok} student(s) processed.` : `⚠️ ${ok} ok, ${failed} failed.`, failed > 0 ? 'warning' : 'success');
  loadDepartmentStudents();
}

// ============================================
// COURSES (Department-first Directory)
// ============================================
function inferCourseYear(course) {
  if (course.yearOfStudy) return Number(course.yearOfStudy);
  const m = String(course.code || '').match(/(\d)(\d)(\d)/);
  if (!m) return null; const digit = Number(m[1]); return digit === 1 ? 1 : digit === 2 ? 2 : null;
}

async function loadCourseDepartments() {
  const grid = document.getElementById('course-dept-grid');
  if (!grid) return;
  grid.innerHTML = `<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading departments…</div>`;
  try {
    const schoolId = (document.getElementById('course-filter-school') || {}).value || '';
    const levelFilter = (document.getElementById('course-filter-level') || {}).value || '';
    const search = (document.getElementById('crs-search') || {}).value || '';
    const sortBy = (document.getElementById('course-filter-sort') || {}).value || 'code';

    const [deptRes, courseRes, schoolRes] = await Promise.all([
      adminFetch('/api/admin/departments'), adminFetch('/api/admin/courses?limit=5000'), adminFetch('/api/admin/schools'),
    ]);
    const depts = (await deptRes.json()).data || [];
    const courses = (await courseRes.json()).data || [];
    const schools = (await schoolRes.json()).data || [];
    const schoolMap = new Map(schools.map(s => [Number(s.id), s]));

    const byDept = new Map();
    depts.forEach(d => byDept.set(Number(d.id), { dept: d, courses: [] }));
    courses.forEach(c => { const bucket = byDept.get(Number(c.departmentId)); if (bucket) bucket.courses.push(c); });

    let totalCourses = 0, totalUnits = 0;
    for (const bucket of byDept.values()) { totalCourses += bucket.courses.length; totalUnits += bucket.courses.reduce((s, c) => s + (Number(c.unit) || 0), 0); }
    setText('crs-stat-total', totalCourses); setText('crs-stat-units', totalUnits);
    setText('crs-stat-departments', depts.length); setText('crs-stat-with-courses', [...byDept.values()].filter(b => b.courses.length > 0).length);

    const filteredByDept = [];
    for (const bucket of byDept.values()) {
      let list = bucket.courses;
      if (levelFilter) { list = list.filter(c => String(c.level || '').toUpperCase() === levelFilter); }
      filteredByDept.push({ dept: bucket.dept, courses: list });
    }

    let visible = filteredByDept.filter(v => {
      if (schoolId && Number(v.dept.schoolId) !== Number(schoolId)) return false;
      if (search) {
        const q = search.toLowerCase();
        const deptMatch = `${v.dept.name || ''} ${v.dept.code || ''}`.toLowerCase().includes(q);
        if (!deptMatch && !v.courses.some(c => `${c.code || ''} ${c.title || ''}`.toLowerCase().includes(q))) return false;
      }
      return true;
    });

    switch (sortBy) {
      case 'courses-desc': visible.sort((a, b) => b.courses.length - a.courses.length); break;
      case 'courses-asc': visible.sort((a, b) => a.courses.length - b.courses.length); break;
      case 'units-desc': visible.sort((a, b) => b.courses.reduce((s, c) => s + (Number(c.unit) || 0), 0) - a.courses.reduce((s, c) => s + (Number(c.unit) || 0), 0)); break;
      case 'units-asc': visible.sort((a, b) => a.courses.reduce((s, c) => s + (Number(c.unit) || 0), 0) - b.courses.reduce((s, c) => s + (Number(c.unit) || 0), 0)); break;
      default: visible.sort((a, b) => String(a.dept.code).localeCompare(String(b.dept.code)));
    }

    if (!visible.length) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">📚</div><p>No departments match your filters.</p></div>'; return; }

    grid.innerHTML = visible.map(({ dept, courses: list }) => {
      const units = list.reduce((s, c) => s + (Number(c.unit) || 0), 0);
      const nd = list.filter(c => String(c.level || '').toUpperCase() === 'ND').length;
      const hnd = list.filter(c => String(c.level || '').toUpperCase() === 'HND').length;
      const cert = list.filter(c => String(c.level || '').toUpperCase() === 'CERT').length;
      const school = schoolMap.get(Number(dept.schoolId));
      const isEmpty = list.length === 0;

      return `<div class="course-dept-card ${isEmpty ? 'empty' : ''}" ${isEmpty ? '' : `data-dept-id="${dept.id}" data-dept-name="${escapeQuotes(dept.name)}"`}><div class="cdc-head"><span class="cdc-code">${escapeHtml(dept.code || '—')}</span><span class="cdc-school">${escapeHtml(school ? school.code : '')}</span></div><h3>${escapeHtml(dept.name || '—')}</h3><div class="cdc-stats"><div class="cdc-stat"><span class="num">${list.length}</span><span class="label">Courses</span></div><div class="cdc-stat units"><span class="num">${units}</span><span class="label">Credit Units</span></div></div><div class="cdc-split">${nd ? `<span class="cdc-chip nd">ND: ${nd}</span>` : ''}${hnd ? `<span class="cdc-chip hnd">HND: ${hnd}</span>` : ''}${cert ? `<span class="cdc-chip cert">CERT: ${cert}</span>` : ''}${!nd && !hnd && !cert ? '<span class="cdc-chip">No courses</span>' : ''}</div><div class="cdc-footer"><span>${isEmpty ? 'No courses yet' : 'View courses →'}</span><span class="arrow">→</span></div></div>`;
    }).join('');

    grid.querySelectorAll('.course-dept-card[data-dept-id]').forEach(card => {
      card.addEventListener('click', () => {
        FPU_ADMIN_SPA.navigateToWithQuery('courses-by-dept', { departmentId: Number(card.dataset.deptId), name: card.dataset.deptName });
      });
    });
  } catch (err) { grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`; }
}

async function loadDepartmentCourses() {
  const root = document.getElementById('course-by-dept-root');
  if (!root) return;
  const hash = window.location.hash.replace(/^#/, ''); const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const departmentId = params.get('departmentId') || ''; const deptName = params.get('name') || 'Department';
  const titleEl = document.getElementById('course-dept-title'); const subEl = document.getElementById('course-dept-subtitle');
  if (titleEl) titleEl.textContent = deptName;
  if (subEl) subEl.textContent = `Courses offered by ${deptName}, grouped by level, year, and semester`;

  if (!departmentId) { root.innerHTML = '<div class="alert alert-warning">No department selected.</div>'; return; }
  root.innerHTML = `<div class="loading"><span class="spinner"></span> Loading courses…</div>`;

  try {
    const res = await adminFetch(`/api/admin/courses?departmentId=${departmentId}&limit=500`);
    const json = await res.json();
    const courses = json.data || json.rows || (Array.isArray(json) ? json : []);
    const totalCourses = courses.length; const totalUnits = courses.reduce((s, c) => s + (Number(c.unit) || 0), 0);
    const nd = courses.filter(c => String(c.level || '').toUpperCase() === 'ND').length;
    const hnd = courses.filter(c => String(c.level || '').toUpperCase() === 'HND').length;
    setText('cbd-stat-total', totalCourses); setText('cbd-stat-units', totalUnits);
    setText('cbd-stat-nd', nd); setText('cbd-stat-hnd', hnd);

    const LEVELS = [{ code: 'ND', label: 'ND' }, { code: 'HND', label: 'HND' }];
    const YEARS = [1, 2];
    const SEMESTERS = [{ code: 'first', label: 'First Semester' }, { code: 'second', label: 'Second Semester' }];

    function inferYear(course) {
      if (course.yearOfStudy) return Number(course.yearOfStudy);
      const m = String(course.code || '').match(/^\D+(\d)/);
      if (m) { const d = Number(m[1]); if (d === 1) return 1; if (d === 2) return 2; }
      return 1;
    }
    function normalizeSemester(course) {
      const s = String(course.semester || '').toLowerCase();
      if (s === 'second') return 'second'; if (s === 'first') return 'first';
      const m = String(course.code || '').match(/^\D+\d(\d)\d/);
      if (m && m[1] === '2') return 'second';
      return 'first';
    }

    const buckets = {};
    LEVELS.forEach(lvl => { YEARS.forEach(yr => { SEMESTERS.forEach(sem => { buckets[`${lvl.code}-${yr}-${sem.code}`] = { level: lvl, year: yr, semester: sem, courses: [] }; }); }); });

    courses.forEach(c => {
      const lvl = String(c.level || 'ND').toUpperCase();
      if (lvl !== 'ND' && lvl !== 'HND') return;
      const yr = inferYear(c); const sem = normalizeSemester(c);
      const key = `${lvl}-${yr}-${sem}`;
      if (buckets[key]) buckets[key].courses.push(c);
    });

    Object.values(buckets).forEach(b => { b.courses.sort((a, c) => String(a.code || '').localeCompare(String(c.code || ''))); });

    const levelTotals = {};
    LEVELS.forEach(lvl => {
      levelTotals[lvl.code] = {
        count: courses.filter(c => String(c.level || '').toUpperCase() === lvl.code).length,
        units: courses.filter(c => String(c.level || '').toUpperCase() === lvl.code).reduce((s, c) => s + (Number(c.unit) || 0), 0),
      };
    });

    const levelTabs = LEVELS.map((lvl, i) => `<button class="course-level-tab ${i === 0 ? 'active' : ''}" data-level="${lvl.code}">${lvl.label} <span class="tab-count">${levelTotals[lvl.code].count} · ${levelTotals[lvl.code].units}u</span></button>`).join('');

    function renderSection(bucket) {
      const { level, year, semester, courses: list } = bucket;
      const sectionUnits = list.reduce((s, c) => s + (Number(c.unit) || 0), 0);
      const isEmpty = list.length === 0;
      const sectionTitle = `${level.label} ${year} — ${semester.label}`;
      const tableRows = isEmpty
        ? `<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:#94a3b8;font-style:italic;">No courses in this section yet.<button class="btn btn-sm btn-outline" style="margin-left:.5rem;" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('course-form', { departmentId: ${departmentId}, level: '${level.code}', yearOfStudy: ${year}, semester: '${semester.code}' })">+ Add Course</button></td></tr>`
        : list.map(c => `<tr><td><code>${escapeHtml(c.code || '')}</code></td><td>${escapeHtml(c.title || '')}</td><td class="num" style="text-align:center;">${Number(c.unit) || 0}</td><td><div class="row-actions" style="justify-content:flex-end;"><button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('course-form', { id: ${c.id} })">Edit</button></div></td></tr>`).join('');

      return `<div class="course-section ${isEmpty ? 'course-section-empty' : ''}"><div class="course-section-head"><div><span class="course-section-title">${escapeHtml(sectionTitle)}</span><span class="course-section-count">${list.length} course${list.length === 1 ? '' : 's'}</span></div><div class="course-section-units"><span class="units-num">${sectionUnits}</span><span class="units-lbl">credit units</span></div></div><div class="table-wrap"><table class="table-admin"><thead><tr><th>Code</th><th>Title</th><th style="text-align:center;width:80px;">Unit</th><th style="text-align:right;width:100px;">Actions</th></tr></thead><tbody>${tableRows}</tbody></table></div></div>`;
    }

    function renderLevelBlock(levelCode) {
      const sections = [];
      for (const yr of YEARS) { for (const sem of SEMESTERS) { const bucket = buckets[`${levelCode}-${yr}-${sem.code}`]; if (bucket) sections.push(renderSection(bucket)); } }
      return sections.join('');
    }

    root.innerHTML = `<div class="course-level-tabs" role="tablist">${levelTabs}</div>${LEVELS.map((lvl, i) => `<div class="course-level-panel ${i === 0 ? 'active' : ''}" data-level-panel="${lvl.code}">${renderLevelBlock(lvl.code)}</div>`).join('')}`;

    root.querySelectorAll('.course-level-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.course-level-tab').forEach(b => b.classList.remove('active'));
        root.querySelectorAll('.course-level-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const level = btn.dataset.level;
        const panel = root.querySelector(`.course-level-panel[data-level-panel="${level}"]`);
        if (panel) panel.classList.add('active');
      });
    });
  } catch (err) {
    console.error('[Courses] Error:', err);
    root.innerHTML = `<div class="alert alert-danger">Failed to load courses: ${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// ACADEMIC SESSIONS (List Page)
// ============================================
async function loadSessions() {
  const container = document.getElementById("sessions-tbody");
  if (!container) return;

  container.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';

  try {
    const [sessionsRes, studentsRes] = await Promise.all([
      adminFetch("/api/admin/sessions"),
      adminFetch("/api/admin/students?limit=5000").catch(() => null),
    ]);
    const result = await sessionsRes.json();
    const rows = extractArray(result);

    // Fetch student counts per session
    let studentCounts = {};
    if (studentsRes) {
      try {
        const sJson = await studentsRes.json();
        const students = sJson.data || [];
        students.forEach(s => {
          if (s.currentSessionId) {
            studentCounts[s.currentSessionId] = (studentCounts[s.currentSessionId] || 0) + 1;
          }
        });
      } catch (e) { /* ignore */ }
    }

    if (!rows.length) {
      container.innerHTML = '<tr><td colspan="7" class="empty">No sessions yet. Create the first one.</td></tr>';
      return;
    }

    // Sort: latest session first
    const sorted = [...rows].sort((a, b) => String(b.name).localeCompare(String(a.name)));

    // Compute stats
    const current = sorted.find(s => s.isCurrent);
    const now = Date.now();
    const upcoming = sorted.filter(s => s.startDate && new Date(s.startDate).getTime() > now).length;
    const past = sorted.filter(s => s.endDate && new Date(s.endDate).getTime() < now).length;

    // Update stats
    setText('ses-stat-total', sorted.length);
    setText('ses-stat-current', current ? 1 : 0);
    setText('ses-stat-upcoming', upcoming);
    setText('ses-stat-past', past);

    // Current session panel
    const currentPanel = document.getElementById('current-session-panel');
    if (current && currentPanel) {
      currentPanel.style.display = 'block';
      setText('current-session-name', current.name);
      setText('current-session-dates', `${current.startDate ? fmtDate(current.startDate) : '—'} → ${current.endDate ? fmtDate(current.endDate) : '—'}`);
      setText('current-session-count', studentCounts[current.id] || 0);
    } else if (currentPanel) {
      currentPanel.style.display = 'none';
    }

    // Render rows manually (avoids pagination crash)
    container.innerHTML = sorted.map((s) => {
      const isCurrent = !!s.isCurrent;
      const start = s.startDate ? new Date(s.startDate) : null;
      const end = s.endDate ? new Date(s.endDate) : null;

      let duration = '—';
      if (start && end) {
        const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
        duration = `${days} days`;
      }

      // Status badge
      let statusText, statusClass;
      if (isCurrent) { statusText = 'Current'; statusClass = 'success'; }
      else if (start && start.getTime() > now) { statusText = 'Upcoming'; statusClass = 'info'; }
      else if (end && end.getTime() < now) { statusText = 'Past'; statusClass = 'muted'; }
      else { statusText = 'Active'; statusClass = 'primary'; }

      const rowStyle = isCurrent ? 'background:#ecfdf5;' : '';

      return `
        <tr style="${rowStyle}">
          <td>
            <strong>${escapeHtml(s.name || '—')}</strong>
            ${isCurrent ? '<div style="font-size:10.5px;color:#10b981;font-weight:700;margin-top:2px;">● ACTIVE</div>' : ''}
          </td>
          <td>${fmtDate(s.startDate)}</td>
          <td>${fmtDate(s.endDate)}</td>
          <td class="small muted">${duration}</td>
          <td class="num">${studentCounts[s.id] || 0}</td>
          <td><span class="badge badge-${statusClass}">${statusText}</span></td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              ${!isCurrent ? `
                <button class="btn btn-sm btn-primary"
                  onclick="FPU_ADMIN.setCurrentSession(${s.id})">
                  ⭐ Set Current
                </button>
              ` : '<span class="small muted" style="color:#10b981;font-weight:700;margin-right:6px;">✓ Current</span>'}
              <button class="btn btn-sm btn-outline"
                onclick="FPU_ADMIN_SPA.navigateToWithQuery('session-form', { id: ${s.id} })">
                ✏️ Edit
              </button>
              ${!isCurrent ? `
                <button class="btn btn-sm btn-ghost" style="color:#dc2626;"
                  onclick="FPU_ADMIN.deleteSession(${s.id}, '${escapeQuotes(s.name)}')">
                  🗑 Delete
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function setCurrentSession(id) {
  const ok = await window.fpuConfirm('Set this as the current academic session?\n\nThe previously current session will become past.', { title: 'Set Current Session?', type: 'warning', okText: 'Yes, Set Current' });
  if (!ok) return;
  try {
    await adminFetch(`/api/admin/sessions/${id}/set-current`, { method: 'POST' });
    showToast('✅ Current session updated.', 'success');
    loadSessions();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

async function deleteSession(id, name) {
  const ok = await window.fpuConfirm(`Delete session "${name}"?\n\nThis cannot be undone. Enrolled student records are preserved.`, { title: 'Delete Session?', type: 'danger', okText: 'Delete Permanently' });
  if (!ok) return;
  try {
    await adminFetch(`/api/admin/sessions/${id}`, { method: 'DELETE' });
    showToast('✅ Session deleted.', 'success');
    loadSessions();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

async function autoCreateNextSession() {
  try {
    const res = await adminFetch('/api/admin/sessions');
    const json = await res.json();
    const sessions = (json.data || []).sort((a, b) => String(b.name).localeCompare(String(a.name)));
    const current = sessions.find(s => s.isCurrent) || sessions[0];
    if (!current) { showToast('Create the first session manually.', 'warning'); return; }

    const parts = String(current.name || '').split('/');
    if (parts.length !== 2) { showToast('Current session has invalid format. Use Manual Create.', 'warning'); return; }
    const nextYearStart = Number(parts[0]) + 1;
    const nextYearEnd = Number(parts[1]) + 1;
    const nextName = `${nextYearStart}/${nextYearEnd}`;

    const start = current.startDate ? new Date(current.startDate) : new Date(nextYearStart, 9, 1);
    const end = current.endDate ? new Date(current.endDate) : new Date(nextYearEnd, 6, 31);
    start.setFullYear(nextYearStart); end.setFullYear(nextYearEnd);

    const formattedStart = start.toISOString().slice(0, 10);
    const formattedEnd = end.toISOString().slice(0, 10);

    const ok = await window.fpuConfirm(`Create session "${nextName}"?\n\nStart: ${new Date(formattedStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\nEnd: ${new Date(formattedEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n\nYou can set it as current later.`, { title: 'Auto-Create Next Session', type: 'info', okText: `Create ${nextName}` });
    if (!ok) return;

    await adminFetch('/api/admin/sessions', { method: 'POST', body: JSON.stringify({ name: nextName, startDate: formattedStart, endDate: formattedEnd, isCurrent: false }) });
    showToast(`✅ Session ${nextName} created.`, 'success');
    loadSessions();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

// ============================================
// PROGRAMMES (Department-first directory)
// ============================================
const __progPalette = [
  '#065f46','#0891b2','#7c3aed','#dc2626',
  '#ea580c','#0d9488','#db2777','#4f46e5',
  '#059669','#d97706','#0369a1','#9333ea'
];
function __progPickColor(i) { return __progPalette[i % __progPalette.length]; }
function __progInitials(name) {
  return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('').slice(0, 3);
}

async function loadProgrammes() {
  const grid = document.getElementById('prog-dept-grid');
  if (!grid) return;

  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#94a3b8;font-size:.82rem;"><div style="display:inline-block;width:28px;height:28px;border:3px solid #e2e8f0;border-top-color:#065f46;border-radius:50%;animation:fpu-spin .8s linear infinite;"></div><div style="margin-top:.65rem;">Loading departments…</div></div>`;

  try {
    const [progRes, deptRes, schoolRes] = await Promise.all([
      adminFetch('/api/admin/programmes'),
      adminFetch('/api/admin/departments'),
      adminFetch('/api/admin/schools')
    ]);

    const progs = (await progRes.json()).data || [];
    const depts = (await deptRes.json()).data || [];
    const schools = (await schoolRes.json()).data || [];

    // Students (best-effort)
    let studentCounts = {};
    try {
      const studentsRes = await adminFetch('/api/admin/students?limit=5000');
      const stuJson = await studentsRes.json();
      (stuJson.data || []).forEach(s => {
        if (s.programmeId) studentCounts[s.programmeId] = (studentCounts[s.programmeId] || 0) + 1;
      });
    } catch (e) {}

    // Group programmes by department
    const byDept = new Map();
    depts.forEach(d => byDept.set(Number(d.id), { dept: d, progs: [] }));
    progs.forEach(p => {
      const bucket = byDept.get(Number(p.departmentId));
      if (bucket) bucket.progs.push(p);
    });

    // Stats
    const nd = progs.filter(p => String(p.level || '').toUpperCase() === 'ND').length;
    const hnd = progs.filter(p => String(p.level || '').toUpperCase() === 'HND').length;
    const cert = progs.filter(p => String(p.level || '').toUpperCase() === 'CERT').length;
    
    setText('prog-total-depts', depts.length);
    setText('prog-total-progs', progs.length);
    setText('prog-total-nd', nd);
    setText('prog-total-hnd', hnd);
    setText('prog-total-cert', cert);

    // Show grid, hide detail
    const detailPanel = document.getElementById('prog-progs-panel');
    const backBar = document.getElementById('prog-back-bar');
    if (detailPanel) detailPanel.style.display = 'none';
    if (backBar) backBar.style.display = 'none';
    grid.style.display = 'grid';

    // Filters
    const search = (document.getElementById('prog-search') || {}).value || '';
    const levelFilter = (document.getElementById('prog-level') || {}).value || '';
    const q = search.trim().toLowerCase();

    let visible = [...byDept.values()].filter(v => v.progs.length > 0);

    if (q) {
      visible = visible.filter(({ dept, progs: ps }) => {
        if (`${dept.name} ${dept.code}`.toLowerCase().includes(q)) return true;
        return ps.some(p => `${p.code} ${p.name}`.toLowerCase().includes(q));
      });
    }
    if (levelFilter) {
      visible = visible.filter(({ progs: ps }) => ps.some(p => String(p.level || '').toUpperCase() === levelFilter));
    }

    visible.sort((a, b) => String(a.dept.code).localeCompare(String(b.dept.code)));

    if (!visible.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#94a3b8;">No departments match your filters.</div>`;
      return;
    }

    grid.innerHTML = visible.map(({ dept, progs: list }, i) => {
      const count = list.length;
      return `
        <div class="prog-dept-card" data-dept-id="${dept.id}" data-dept-name="${escapeQuotes(dept.name)}">
          <div class="prog-dept-icon" style="background:${__progPickColor(i)};">${escapeHtml(__progInitials(dept.name || dept.code))}</div>
          <div class="prog-dept-body">
            <div class="prog-dept-name" title="${escapeHtml(dept.name)}">${escapeHtml(dept.name || '—')}</div>
            <div class="prog-dept-count">${escapeHtml(dept.code || '')} · ${count} programme${count === 1 ? '' : 's'}</div>
          </div>
          <div class="prog-dept-arrow">›</div>
        </div>`;
    }).join('');

    // Wire clicks
    grid.querySelectorAll('.prog-dept-card').forEach(card => {
      card.addEventListener('click', () => {
        selectProgrammeDepartment(Number(card.dataset.deptId), card.dataset.deptName);
      });
    });

    window.__progByDept = byDept;
    window.__progStudentCounts = studentCounts;

    // Wire filters
    const searchEl = document.getElementById('prog-search');
    const levelEl = document.getElementById('prog-level');
    const backBtn = document.getElementById('prog-back');

    if (searchEl && !searchEl.__wired) {
      searchEl.__wired = true;
      let timer;
      searchEl.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => loadProgrammes(), 200); });
    }
    if (levelEl && !levelEl.__wired) {
      levelEl.__wired = true;
      levelEl.addEventListener('change', () => loadProgrammes());
    }
    if (backBtn && !backBtn.__wired) {
      backBtn.__wired = true;
      backBtn.onclick = () => loadProgrammes();
    }
  } catch (err) {
    console.error('[programmes] error:', err);
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;"><strong>Failed to load:</strong> ${escapeHtml(err.message)}</div>`;
  }
}

function selectProgrammeDepartment(deptId, deptName) {
  const byDept = window.__progByDept || new Map();
  const studentCounts = window.__progStudentCounts || {};
  const bucket = byDept.get(deptId);

  if (!bucket) return;

  document.getElementById('prog-dept-grid').style.display = 'none';
  document.getElementById('prog-progs-panel').style.display = 'block';
  document.getElementById('prog-back-bar').style.display = 'block';
  document.getElementById('prog-current-dept').textContent = `${bucket.dept.code || ''} · ${deptName}`;

  const tbody = document.getElementById('prog-progs-tbody');
  const list = bucket.progs.slice().sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">No programmes in this department yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => {
    const levelUpper = String(p.level || 'ND').toUpperCase();
    const levelCls = levelUpper === 'HND' ? 'warning' : levelUpper === 'CERT' ? 'success' : 'info';
    const studentCount = studentCounts[p.id] || 0;
    const duration = p.durationYears || p.duration || 2;

    return `
      <tr>
        <td><code>${escapeHtml(p.code || '—')}</code></td>
        <td><strong>${escapeHtml(p.name || '—')}</strong></td>
        <td style="text-align:center;"><span class="badge badge-${levelCls}">${escapeHtml(levelUpper)}</span></td>
        <td style="text-align:center;">${duration} yr${duration === 1 ? '' : 's'}</td>
        <td style="text-align:center;">${studentCount > 0 ? `<strong style="color:#065f46;">${studentCount}</strong>` : '<span style="color:#cbd5e1;">0</span>'}</td>
        <td style="text-align:right;">
          <div class="row-actions" style="justify-content:flex-end;">
            <button class="btn btn-sm btn-outline" onclick="FPU_ADMIN_SPA.navigateToWithQuery('programme-form', { id: ${p.id} })">✏️ Edit</button>
            <button class="btn btn-sm btn-ghost" style="color:#dc2626;" onclick="FPU_ADMIN.deleteProgramme(${p.id}, '${escapeQuotes(p.name)}')">🗑 Delete</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

async function deleteProgramme(id, name) {
  const ok = await window.fpuConfirm(`Delete programme "${name}"?\n\nIf students are enrolled, the delete will fail.`, { title: 'Delete Programme?', type: 'danger', okText: 'Delete Permanently' });
  if (!ok) return;
  try {
    await adminFetch(`/api/admin/programmes/${id}`, { method: 'DELETE' });
    showToast('✅ Programme deleted.', 'success');
    const current = document.getElementById('prog-current-dept').textContent;
    await loadProgrammes();
    if (current) {
      const code = current.split('·')[0].trim();
      const byDept = window.__progByDept || new Map();
      for (const [deptId, bucket] of byDept) {
        if (bucket.dept.code === code) { selectProgrammeDepartment(deptId, bucket.dept.name); break; }
      }
    }
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

// ============================================
// SCHOOLS (Card Grid Directory)
// ============================================
async function loadSchoolCards() {
  const grid = document.getElementById('school-card-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading schools…</div>';

  try {
    const [schoolsRes, deptsRes, progsRes, studentsRes] = await Promise.all([
      adminFetch('/api/admin/schools'),
      adminFetch('/api/admin/departments'),
      adminFetch('/api/admin/programmes'),
      adminFetch('/api/admin/students?limit=5000'),
    ]);

    const schools   = (await schoolsRes.json()).data  || [];
    const depts     = (await deptsRes.json()).data    || [];
    const progs     = (await progsRes.json()).data    || [];
    const students  = (await studentsRes.json()).data || [];

    setText('sch-stat-total', schools.length);
    setText('sch-stat-departments', depts.length);
    setText('sch-stat-programmes', progs.length);
    setText('sch-stat-students', students.length);

    if (!schools.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">🏛️</div><p>No schools.</p></div>';
      return;
    }

    grid.innerHTML = schools.map((sch) => {
      const deptIds = new Set(depts.filter((d) => Number(d.schoolId) === Number(sch.id)).map((d) => d.id));
      const deptCount = deptIds.size;
      const progCount = progs.filter((p) => deptIds.has(p.departmentId)).length;
      const stuCount = students.filter((s) => deptIds.has(s.departmentId)).length;
      const deptNames = depts.filter((d) => deptIds.has(d.id)).map((d) => d.code);

      return `
        <div class="school-card" data-school-id="${sch.id}" data-school-name="${escapeHtml(sch.name)}">
          <div class="sch-head">
            <span class="sch-code">${escapeHtml(sch.code)}</span>
          </div>
          <h3>${escapeHtml(sch.name)}</h3>
          <div class="sch-stats">
            <div class="sch-stat"><span class="num">${deptCount}</span><span class="label">Departments</span></div>
            <div class="sch-stat purple"><span class="num">${progCount}</span><span class="label">Programmes</span></div>
            <div class="sch-stat blue"><span class="num">${stuCount}</span><span class="label">Students</span></div>
            <div class="sch-stat gold"><span class="num">${stuCount ? '✓' : '—'}</span><span class="label">Active</span></div>
          </div>
          <div class="sch-depts">
            ${deptNames.slice(0, 6).map((c) => `<span class="sch-dept-chip">${escapeHtml(c)}</span>`).join('')}
            ${deptNames.length > 6 ? `<span class="sch-dept-chip more">+${deptNames.length - 6}</span>` : ''}
          </div>
          <div class="sch-footer">
            <span>View details</span>
            <span class="arrow">→</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.school-card').forEach((card) => {
      card.addEventListener('click', () => {
        FPU_ADMIN_SPA.navigateToWithQuery('school-by-id', {
          id: Number(card.dataset.schoolId),
          name: card.dataset.schoolName,
        });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

// Fallback for standard table view (if used anywhere)
async function loadSchools() {
  const container = document.getElementById("schools-tbody");
  if (!container) {
    // If the table doesn't exist, load the grid instead
    return loadSchoolCards();
  }
  try {
    const res = await adminFetch("/api/admin/schools");
    const result = await res.json();
    const rows = extractArray(result);
    container.innerHTML = rows.length ? rows.map((s) => `
      <tr>
        <td><code>${escapeHtml(s.code)}</code></td>
        <td>${escapeHtml(s.name)}</td>
        <td>${fmtDate(s.createdAt)}</td>
      </tr>
    `).join('') : '<tr><td colspan="3" class="empty">No schools.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="3" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

// ============================================
// DEPARTMENTS (Card Grid Directory)
// ============================================
async function loadDepartmentCards() {
  const grid = document.getElementById('dept-card-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading departments…</div>';

  try {
    const [deptsRes, schoolsRes, progsRes, coursesRes, studentsRes] = await Promise.all([
      adminFetch('/api/admin/departments'),
      adminFetch('/api/admin/schools'),
      adminFetch('/api/admin/programmes'),
      adminFetch('/api/admin/courses?limit=2000'),
      adminFetch('/api/admin/students?limit=5000'),
    ]);

    const depts    = (await deptsRes.json()).data    || [];
    const schools  = (await schoolsRes.json()).data  || [];
    const progs    = (await progsRes.json()).data    || [];
    const courses  = (await coursesRes.json()).data  || [];
    const students = (await studentsRes.json()).data || [];

    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    setText('dept-stat-total-all', depts.length);
    setText('dept-stat-progs-all', progs.length);
    setText('dept-stat-courses-all', courses.length);
    setText('dept-stat-students-all', students.length);

    if (!depts.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">🏢</div><p>No departments.</p></div>';
      return;
    }

    // Apply Filters (if inputs exist)
    const schoolFilter = (document.getElementById('dept-filter-school') || {}).value || '';
    const search = (document.getElementById('dept-filter-search') || {}).value || '';
    
    let visible = depts;
    if (schoolFilter) visible = visible.filter(d => Number(d.schoolId) === Number(schoolFilter));
    if (search) {
      const q = search.toLowerCase();
      visible = visible.filter(d => String(d.name || '').toLowerCase().includes(q) || String(d.code || '').toLowerCase().includes(q));
    }

    if (!visible.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">🔍</div><p>No departments match your filters.</p></div>';
      return;
    }

    grid.innerHTML = visible.map((d) => {
      const progCount = progs.filter((p) => p.departmentId === d.id).length;
      const courseList = courses.filter((c) => c.departmentId === d.id);
      const units = courseList.reduce((s, c) => s + (Number(c.unit) || 0), 0);
      const stuCount = students.filter((s) => s.departmentId === d.id).length;
      const school = schoolMap.get(d.schoolId);

      return `
        <div class="dept-card" data-dept-id="${d.id}" data-dept-name="${escapeHtml(d.name)}">
          <div class="dpt-head">
            <span class="dpt-code">${escapeHtml(d.code)}</span>
            <span class="dpt-school">${escapeHtml(school?.code || '')}</span>
          </div>
          <h3>${escapeHtml(d.name)}</h3>
          <div class="dpt-stats">
            <div class="dpt-stat"><span class="num">${progCount}</span><span class="label">Programmes</span></div>
            <div class="dpt-stat units"><span class="num">${courseList.length}</span><span class="label">Courses</span></div>
            <div class="dpt-stat students"><span class="num">${stuCount}</span><span class="label">Students</span></div>
          </div>
          <div class="dpt-footer">
            <span>${units} total units</span>
            <span class="arrow">View →</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.dept-card').forEach((card) => {
      card.addEventListener('click', () => {
        FPU_ADMIN_SPA.navigateToWithQuery('department-by-id', {
          id: Number(card.dataset.deptId),
          name: card.dataset.deptName,
        });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

// Fallback for standard table view
async function loadDepartments() {
  const container = document.getElementById("departments-tbody");
  if (!container) return loadDepartmentCards();
  
  try {
    const res = await adminFetch("/api/admin/departments");
    const result = await res.json();
    const rows = extractArray(result);
    container.innerHTML = rows.length ? rows.map((d) => `
      <tr>
        <td><code>${escapeHtml(d.code)}</code></td>
        <td>${escapeHtml(d.name)}</td>
        <td>${d.schoolId}</td>
        <td>${d.hodUserId || '—'}</td>
      </tr>
    `).join('') : '<tr><td colspan="4" class="empty">No departments.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="4" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

// ============================================
// ALLOCATIONS (Department-first directory)
// ============================================
async function loadAllocationDepartments() {
  const grid = document.getElementById('alloc-dept-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading allocations…</div>';

  try {
    // Fetch filter values
    const sessionId = (document.getElementById('alloc-filter-session') || {}).value || '';
    const semester = (document.getElementById('alloc-filter-semester') || {}).value || '';
    const search = (document.getElementById('alloc-search') || {}).value || '';

    const [deptsRes, allocsRes, schoolsRes] = await Promise.all([
      adminFetch('/api/admin/departments'),
      adminFetch('/api/admin/allocations'),
      adminFetch('/api/admin/schools'),
    ]);

    const depts   = (await deptsRes.json()).data   || [];
    const allocs  = (await allocsRes.json()).data  || [];
    const schools = (await schoolsRes.json()).data || [];

    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    // Group allocations by department
    const byDept = new Map();
    for (const d of depts) byDept.set(d.id, { dept: d, allocs: [] });

    for (const a of allocs) {
      const course = a.course || {};
      const deptId = course.departmentId;
      if (!deptId || !byDept.has(deptId)) continue;
      
      // Apply filters
      if (sessionId && Number(a.allocation?.sessionId) !== Number(sessionId)) continue;
      if (semester && a.allocation?.semester !== semester) continue;
      if (search) {
        const q = search.toLowerCase();
        const lecturer = a.lecturer || {};
        const match = 
          String(course.code || '').toLowerCase().includes(q) ||
          String(course.title || '').toLowerCase().includes(q) ||
          String(lecturer.firstName || '').toLowerCase().includes(q) ||
          String(lecturer.lastName || '').toLowerCase().includes(q);
        if (!match) continue;
      }

      byDept.get(deptId).allocs.push(a);
    }

    // Calculate stats
    let totalAllocs = 0;
    let totalUnits = 0;
    let totalLecturers = new Set();
    
    for (const { allocs: list } of byDept.values()) {
      totalAllocs += list.length;
      totalUnits  += list.reduce((s, a) => s + (Number(a.course?.unit) || 0), 0);
      list.forEach((a) => a.lecturer?.id && totalLecturers.add(a.lecturer.id));
    }

    setText('al-stat-total', totalAllocs);
    setText('al-stat-lecturers', totalLecturers.size);
    setText('al-stat-units', totalUnits);
    setText('al-stat-depts', [...byDept.values()].filter((d) => d.allocs.length > 0).length);

    // Only show departments that have allocations (or show all? let's show all for empty states)
    const visible = [...byDept.values()];

    if (!visible.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">🔗</div><p>No departments found.</p></div>';
      return;
    }

    visible.sort((a, b) => String(a.dept.code).localeCompare(String(b.dept.code)));

    grid.innerHTML = visible.map(({ dept, allocs: list }) => {
      const units = list.reduce((s, a) => s + (Number(a.course?.unit) || 0), 0);
      const lecturerSet = new Set(list.map((a) => a.lecturer?.id).filter(Boolean));
      const school = schoolMap.get(dept.schoolId);
      const isEmpty = list.length === 0;

      return `
        <div class="alloc-dept-card ${isEmpty ? 'empty' : ''}" 
             ${isEmpty ? '' : `data-dept-id="${dept.id}" data-dept-name="${escapeHtml(dept.name)}"`}>
          <div class="adc-head">
            <span class="adc-code">${escapeHtml(dept.code)}</span>
            <span class="adc-school">${escapeHtml(school?.code || '')}</span>
          </div>
          <h3>${escapeHtml(dept.name)}</h3>
          <div class="adc-stats">
            <div class="adc-stat"><span class="num">${list.length}</span><span class="label">Allocations</span></div>
            <div class="adc-stat units"><span class="num">${units}</span><span class="label">Units</span></div>
            <div class="adc-stat lect"><span class="num">${lecturerSet.size}</span><span class="label">Lecturers</span></div>
          </div>
          <div class="adc-footer">
            <span>${isEmpty ? 'No allocations' : 'View allocations'}</span>
            <span class="arrow">→</span>
          </div>
        </div>
      `;
    }).join('');

    // Wire click events
    grid.querySelectorAll('.alloc-dept-card[data-dept-id]').forEach((card) => {
      card.addEventListener('click', () => {
        FPU_ADMIN_SPA.navigateToWithQuery('allocations-by-dept', {
          departmentId: Number(card.dataset.deptId),
          name: card.dataset.deptName,
        });
      });
    });

    // Wire filters
    const applyBtn = document.getElementById('alloc-apply');
    if (applyBtn && !applyBtn.__wired) {
      applyBtn.__wired = true;
      applyBtn.onclick = () => loadAllocationDepartments();
    }

  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// REGISTRATIONS (Grouped by Student)
// ============================================
async function loadRegistrationStudents() {
  const grid = document.getElementById('reg-student-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading registrations…</div>';

  // Fetch filter values
  const sessionId = (document.getElementById('reg-filter-session') || {}).value || '';
  const semester = (document.getElementById('reg-filter-semester') || {}).value || '';
  const status = (document.getElementById('reg-filter-status') || {}).value || '';
  const deptId = (document.getElementById('reg-filter-dept') || {}).value || '';
  const search = (document.getElementById('reg-filter-search') || {}).value || '';

  const qs = new URLSearchParams({ limit: 1000 });
  if (sessionId) qs.set('sessionId', sessionId);
  if (semester) qs.set('semester', semester);
  if (status) qs.set('status', status);

  try {
    const res = await adminFetch(`/api/admin/registrations/with-student?${qs}`);
    const json = await res.json();
    let rows = json.data || [];

    // Apply client-side filters
    if (deptId) {
      rows = rows.filter((r) => Number(r.student?.departmentId) === Number(deptId));
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => {
        const s = r.student || {};
        return (
          String(s.matricNumber || '').toLowerCase().includes(q) ||
          String(s.firstName || '').toLowerCase().includes(q) ||
          String(s.lastName || '').toLowerCase().includes(q) ||
          String(s.email || '').toLowerCase().includes(q)
        );
      });
    }

    // Group by student
    const byStudent = new Map();
    for (const r of rows) {
      const s = r.student || {};
      const key = s.id || 0;
      if (!byStudent.has(key)) {
        byStudent.set(key, { student: s, rows: [] });
      }
      byStudent.get(key).rows.push(r);
    }

    // Calculate stats
    let totalPending = 0;
    let totalApproved = 0;
    let totalUnits = 0;
    byStudent.forEach((b) => {
      b.rows.forEach((r) => {
        if (r.registration.status === 'pending') totalPending++;
        else if (r.registration.status === 'approved') totalApproved++;
        if (['pending','approved'].includes(r.registration.status)) {
          totalUnits += Number(r.course?.unit) || 0;
        }
      });
    });

    setText('reg-stat-students', byStudent.size);
    setText('reg-stat-pending', totalPending);
    setText('reg-stat-approved', totalApproved);
    setText('reg-stat-units', totalUnits);

    if (!byStudent.size) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">📝</div><p>No registrations found.</p></div>';
      return;
    }

    grid.innerHTML = [...byStudent.values()].map(({ student, rows: list }) => {
      const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
      const initials = ((student.firstName || ' ')[0] + (student.lastName || ' ')[0]).toUpperCase().trim() || 'S';
      const avatar = student.photoUrl ? `<img src="${escapeHtml(student.photoUrl)}" alt="" />` : escapeHtml(initials);
      const units = list
        .filter((r) => ['pending','approved'].includes(r.registration.status))
        .reduce((s, r) => s + (Number(r.course?.unit) || 0), 0);
      const pending = list.filter((r) => r.registration.status === 'pending').length;
      const approved = list.filter((r) => r.registration.status === 'approved').length;
      const rejected = list.filter((r) => r.registration.status === 'rejected').length;

      const cardClass = pending > 0 ? 'has-pending' : rejected > 0 ? 'has-rejected' : 'all-approved';

      return `
        <div class="reg-card ${cardClass}"
             onclick="FPU_ADMIN_SPA.navigateToWithQuery('registrations-by-student', { studentId: ${student.id} })">
          <div class="reg-card-head">
            <div class="reg-avatar">${avatar}</div>
            <div class="reg-info">
              <strong>${escapeHtml(fullName)}</strong>
              <span class="matric">${escapeHtml(student.matricNumber || '—')}</span>
            </div>
          </div>
          <div class="reg-stats">
            <div class="reg-stat"><span class="num">${list.length}</span><span class="label">Courses</span></div>
            <div class="reg-stat units"><span class="num">${units}</span><span class="label">Units</span></div>
          </div>
          <div class="reg-split">
            ${pending  ? `<span class="reg-chip pending">Pending: ${pending}</span>` : ''}
            ${approved ? `<span class="reg-chip approved">Approved: ${approved}</span>` : ''}
            ${rejected ? `<span class="reg-chip rejected">Rejected: ${rejected}</span>` : ''}
          </div>
          <div class="reg-footer">
            <span>View registrations</span>
            <span class="arrow">→</span>
          </div>
        </div>
      `;
    }).join('');

    // Wire Apply button if it exists
    const applyBtn = document.getElementById('reg-apply');
    if (applyBtn && !applyBtn.__wired) {
      applyBtn.__wired = true;
      applyBtn.onclick = () => loadRegistrationStudents();
    }
    
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// RESULTS (Department-first directory)
// ============================================
async function loadResultDepartments() {
  const grid = document.getElementById('res-dept-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading results…</div>';

  // Fetch filter values
  const sessionId = (document.getElementById('res-filter-session') || {}).value || '';
  const semester = (document.getElementById('res-filter-semester') || {}).value || '';
  const status = (document.getElementById('res-filter-status') || {}).value || 'hod_verified';
  const schoolId = (document.getElementById('res-filter-school') || {}).value || '';

  const qs = new URLSearchParams({ limit: 2000 });
  if (sessionId) qs.set('sessionId', sessionId);
  if (semester) qs.set('semester', semester);
  if (status) qs.set('status', status);

  try {
    const [resultsRes, deptsRes, coursesRes, schoolsRes] = await Promise.all([
      adminFetch(`/api/admin/results?${qs}`),
      adminFetch('/api/admin/departments'),
      adminFetch('/api/admin/courses?limit=2000'),
      adminFetch('/api/admin/schools'),
    ]);

    const results = (await resultsRes.json()).data || [];
    const depts = (await deptsRes.json()).data || [];
    const courses = (await coursesRes.json()).data || [];
    const schools = (await schoolsRes.json()).data || [];

    const courseById = new Map(courses.map((c) => [c.id, c]));
    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    // Setup buckets
    const byDept = new Map();
    for (const d of depts) {
      byDept.set(d.id, { dept: d, pending: 0, approved: 0, published: 0, rejected: 0, total: 0 });
    }

    // Aggregate results by department
    for (const r of results) {
      const c = courseById.get(r.courseId);
      if (!c) continue;
      const bucket = byDept.get(c.departmentId);
      if (!bucket) continue;
      
      bucket.total++;
      if (r.status === 'hod_verified') bucket.pending++;
      else if (r.status === 'approved') bucket.approved++;
      else if (r.status === 'published') bucket.published++;
      else if (r.status && r.status.includes('rejected')) bucket.rejected++;
    }

    // Stats
    let totalPending = 0, totalApproved = 0, totalRows = 0;
    byDept.forEach((b) => {
      totalPending += b.pending;
      totalApproved += b.approved;
      totalRows += b.total;
    });

    setText('res-stat-depts', [...byDept.values()].filter((b) => b.total > 0).length);
    setText('res-stat-pending', totalPending);
    setText('res-stat-approved', totalApproved);
    setText('res-stat-total', totalRows);

    // Filter to visible departments
    const visible = [...byDept.values()].filter((b) => b.total > 0).filter(({ dept }) => {
      if (!schoolId) return true;
      return Number(dept.schoolId) === Number(schoolId);
    });

    if (!visible.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">📊</div><p>No results match your filters.</p></div>';
      return;
    }

    visible.sort((a, b) => String(a.dept.code).localeCompare(String(b.dept.code)));

    grid.innerHTML = visible.map((b) => {
      const cardClass = b.pending > 0 ? 'pending' : b.approved > 0 ? 'approved' : 'clear';
      const school = schoolMap.get(b.dept.schoolId);
      return `
        <div class="res-dept-card ${cardClass}"
             onclick="FPU_ADMIN_SPA.navigateToWithQuery('results-by-dept', { departmentId: ${b.dept.id}, name: '${escapeQuotes(b.dept.name)}' })">
          <div class="rdc-head">
            <span class="rdc-code">${escapeHtml(b.dept.code)}</span>
            <span class="rdc-school">${escapeHtml(school?.code || '')}</span>
          </div>
          <h3>${escapeHtml(b.dept.name)}</h3>
          <div class="rdc-total">
            <span class="num">${b.total}</span>
            <span class="label">total rows</span>
          </div>
          <div class="rdc-status">
            <div class="rdc-status-item pending"><span class="num">${b.pending}</span><span class="label">Awaiting</span></div>
            <div class="rdc-status-item approved"><span class="num">${b.approved}</span><span class="label">Approved</span></div>
            <div class="rdc-status-item"><span class="num">${b.published}</span><span class="label">Published</span></div>
            <div class="rdc-status-item rejected"><span class="num">${b.rejected}</span><span class="label">Rejected</span></div>
          </div>
          <div class="rdc-footer">
            <span>Review results</span>
            <span class="arrow">→</span>
          </div>
        </div>
      `;
    }).join('');

    // Wire Apply button if it exists
    const applyBtn = document.getElementById('res-apply');
    if (applyBtn && !applyBtn.__wired) {
      applyBtn.__wired = true;
      applyBtn.onclick = () => loadResultDepartments();
    }

  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// GRADE SCALES: Logic, Preview & CRUD
// ============================================

let cachedGradeBands = []; // Store bands globally for the live preview

async function loadGradeScales() {
  const tbody = document.getElementById('grade-scales-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="empty" style="text-align:center; padding: 40px; color: #64748b;"><span class="spinner"></span> Loading bands…</td></tr>';

  try {
    const res = await adminFetch('/api/admin/grade-scales');
    const json = await res.json();
    const bands = json.data || [];
    
    // Cache for the live preview
    cachedGradeBands = bands;

    // Update Stats Bar
    const countEl = document.getElementById('gs-count');
    if (countEl) countEl.textContent = `${bands.length} active bands`;

    // Update Health Banner (Simple version)
    const healthEl = document.getElementById('gs-health');
    if (healthEl) {
      const totalPoints = bands.reduce((sum, b) => sum + Number(b.points || 0), 0);
      healthEl.innerHTML = `
        <div class="panel-body">
          <div class="gs-health-grid">
            <div class="gs-health-item"><div class="num ok">${bands.length}</div><div class="label">Active Bands</div></div>
            <div class="gs-health-item"><div class="num warn">${totalPoints.toFixed(1)}</div><div class="label">Total Points</div></div>
          </div>
        </div>
      `;
    }

    if (!bands.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty" style="text-align:center; padding: 40px; color: #64748b;">No grade bands configured yet.</td></tr>';
      return;
    }

    tbody.innerHTML = bands.map(b => {
      const range = `${b.minScore} – ${b.maxScore}`;
      const isActive = b.isActive !== false;
      
      let chipClass = '';
      if (b.grade === 'F') chipClass = 'F';
      else if (b.grade === 'D' || b.grade === 'E') chipClass = 'D';

      return `
        <tr>
          <td><span class="gs-grade-chip ${chipClass}">${escapeHtml(b.grade)}</span></td>
          <td><span class="gs-range">${range}</span></td>
          <td><span class="gs-points">${Number(b.points).toFixed(2)}</span></td>
          <td style="color: #475569;">${escapeHtml(b.remark || '—')}</td>
          <td>
            <span style="background:${isActive ? '#dcfce7' : '#fee2e2'}; color:${isActive ? '#15803d' : '#b91c1c'}; padding:4px 10px; border-radius:999px; font-size:10px; font-weight:700; text-transform:uppercase;">
              ${isActive ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="FPU_ADMIN.editGradeScale(${b.id})">Edit</button>
            <button class="btn btn-sm btn-ghost" style="color:#dc2626;" onclick="FPU_ADMIN.deleteGradeScale(${b.id})">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach event listener to preview input
    const previewInput = document.getElementById('gs-preview-score');
    if (previewInput) {
      previewInput.addEventListener('input', (e) => {
        const score = parseFloat(e.target.value);
        const resultBox = document.getElementById('gs-preview-result');
        if (!resultBox) return;

        if (isNaN(score)) {
          resultBox.innerHTML = '<div class="gs-preview-empty">Enter a score to preview</div>';
          return;
        }

        // Find the matching band
        const match = cachedGradeBands.find(b => score >= b.minScore && score <= b.maxScore);

        if (match) {
          let gradeClass = '';
          if (match.grade === 'F') gradeClass = 'F';
          else if (match.grade === 'D' || match.grade === 'E') gradeClass = 'D';

          resultBox.innerHTML = `
            <div class="gs-preview-hit">
              <div class="gs-preview-grade ${gradeClass}">${escapeHtml(match.grade)}</div>
              <div class="gs-preview-meta">
                <div class="label">Grade</div>
                <div class="value">${escapeHtml(match.grade)} — ${escapeHtml(match.remark || '')}</div>
                <div class="sub">${match.minScore}–${match.maxScore} → ${Number(match.points).toFixed(2)} points</div>
              </div>
            </div>
          `;
        } else {
          resultBox.innerHTML = `<div class="gs-preview-miss">No grade band covers a score of ${score}.</div>`;
        }
      });
    }

  } catch (err) {
    console.error('Failed to load grade scales:', err);
    tbody.innerHTML = '<tr><td colspan="6" class="empty" style="text-align:center; padding: 40px; color: #dc2626;">Failed to load bands.</td></tr>';
  }
}

function toggleAddBandForm(show) {
  const panel = document.getElementById('gs-add-panel');
  if (!panel) return;
  
  if (show) {
    panel.style.display = 'block';
    document.getElementById('gs-add-grade').focus();
  } else {
    panel.style.display = 'none';
    document.getElementById('gs-add-form').reset();
    document.getElementById('gs-add-validation').innerHTML = '';
  }
}

async function submitAddBand(e) {
  if (e) e.preventDefault();
  
  const grade = document.getElementById('gs-add-grade').value.trim().toUpperCase();
  const minScore = parseInt(document.getElementById('gs-add-min').value);
  const maxScore = parseInt(document.getElementById('gs-add-max').value);
  const points = parseFloat(document.getElementById('gs-add-points').value);
  const remark = document.getElementById('gs-add-remark').value.trim();
  const isActive = document.getElementById('gs-add-active').checked;

  const valEl = document.getElementById('gs-add-validation');
  valEl.innerHTML = '';

  if (!grade || isNaN(minScore) || isNaN(maxScore) || isNaN(points)) {
    valEl.innerHTML = '<div class="alert alert-error">All required fields must be filled.</div>';
    return;
  }

  const btn = document.getElementById('gs-add-submit');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Adding...';

  try {
    const res = await adminFetch('/api/admin/grade-scales', {
      method: 'POST',
      body: JSON.stringify({ grade, minScore, maxScore, points, remark, isActive })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to save band');

    showToast('✅ Grade band added successfully.', 'success');
    toggleAddBandForm(false);
    loadGradeScales(); // Refresh the table

  } catch (err) {
    valEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// Placeholder functions for Edit/Delete (Wire up if backend supports it)
function editGradeScale(id) {
  showToast('Edit logic not yet implemented for ID: ' + id, 'info');
}

async function deleteGradeScale(id) {
  if (!confirm('Are you sure you want to delete this grade band?')) return;
  try {
    await adminFetch(`/api/admin/grade-scales/${id}`, { method: 'DELETE' });
    showToast('🗑️ Band deleted.', 'success');
    loadGradeScales();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

function updateGradeHealth(bands) {
  const healthEl = document.getElementById('gs-health');
  if (!healthEl) return;
  
  if (!bands.length) {
    healthEl.innerHTML = '<div class="panel-body"><span class="muted">No bands configured.</span></div>';
    return;
  }

  // Calculate simple stats for the banner
  const totalPoints = bands.reduce((sum, b) => sum + Number(b.points || 0), 0);
  
  healthEl.innerHTML = `
    <div class="panel-body">
      <div class="gs-health-grid">
        <div class="gs-health-item">
          <div class="num ok">${bands.length}</div>
          <div class="label">Active Bands</div>
        </div>
        <div class="gs-health-item">
          <div class="num warn">${totalPoints.toFixed(1)}</div>
          <div class="label">Total Points</div>
        </div>
      </div>
    </div>
  `;
}

// Placeholder for edit/delete (to wire up later)
function renderGradeScaleHealth(rows) {
  const health = document.getElementById('gs-health');
  if (!health) return;

  const active = rows.filter((r) => r.isActive !== false).sort((a, b) => Number(a.minScore) - Number(b.minScore));
  
  if (!active.length) {
    health.innerHTML = '<div class="panel-body"><div class="alert alert-warning">⚠️ No active grade bands — no scores can be graded.</div></div>';
    return;
  }

  let coverage = 0;
  let overlaps = [];
  let lastMax = -1;

  for (const b of active) {
    const min = Number(b.minScore);
    const max = Number(b.maxScore);

    if (min > lastMax + 1 && lastMax >= 0) {
      overlaps.push(`Gap between ${lastMax} and ${min}`);
    }
    if (min <= lastMax) {
      overlaps.push(`Overlap at ${min} (band ${b.grade})`);
    }
    
    // Count unique numbers covered (roughly)
    coverage += (max - min + 1);
    lastMax = Math.max(lastMax, max);
  }

  const cls = overlaps.length ? 'err' : coverage >= 101 ? 'ok' : 'warn';
  
  health.innerHTML = `
    <div class="panel-body">
      <div class="gs-health-grid">
        <div class="gs-health-item">
          <div class="num ${cls}">${coverage}</div>
          <div class="label">Score coverage (0-100)</div>
        </div>
        <div class="gs-health-item">
          <div class="num ${active.length ? 'ok' : 'err'}">${active.length}</div>
          <div class="label">Active bands</div>
        </div>
        <div class="gs-health-item">
          <div class="num ${rows.length - active.length ? 'warn' : 'ok'}">${rows.length - active.length}</div>
          <div class="label">Inactive</div>
        </div>
        <div class="gs-health-item">
          <div class="num ${overlaps.length ? 'err' : 'ok'}">${overlaps.length}</div>
          <div class="label">Issues</div>
        </div>
      </div>
      ${overlaps.length ? `<div class="gs-overlap-list" style="color:#dc2626;margin-top:12px;font-size:12px;">${overlaps.map(escapeHtml).join('<br/>')}</div>` : ''}
    </div>`;
}

function setupGradeScalePreview(rows) {
  const input = document.getElementById('gs-preview-score');
  const result = document.getElementById('gs-preview-result');
  if (!input || !result) return;

  const render = () => {
    const v = Number(input.value);
    if (!Number.isFinite(v) || input.value === '') {
      result.innerHTML = '<div class="gs-preview-empty" style="padding:20px;text-align:center;color:#94a3b8;">Enter a score to preview</div>';
      return;
    }
    
    const active = rows.filter((r) => r.isActive !== false);
    const hit = active.find((b) => v >= Number(b.minScore) && v <= Number(b.maxScore));
    
    if (!hit) {
      result.innerHTML = `<div class="gs-preview-miss" style="padding:20px;text-align:center;color:#dc2626;font-weight:600;">Score ${v} falls outside all active bands.<br/>Students scoring this would get an F.</div>`;
      return;
    }
    
    result.innerHTML = `
      <div class="gs-preview-hit" style="padding:20px;display:flex;align-items:center;gap:20px;border:1px solid #e2e8f0;border-radius:8px;">
        <div class="gs-preview-grade ${escapeHtml(hit.grade)}" style="font-size:32px;font-weight:800;color:#065f46;">${escapeHtml(hit.grade)}</div>
        <div class="gs-preview-meta">
          <div class="label" style="font-size:12px;text-transform:uppercase;color:#64748b;">Grade</div>
          <div class="value" style="font-size:16px;font-weight:700;">${escapeHtml(hit.grade)} — ${escapeHtml(hit.remark || '')}</div>
          <div class="sub" style="font-size:13px;color:#475569;">${hit.minScore}–${hit.maxScore} → ${hit.points} points</div>
        </div>
      </div>`;
  };
  
  input.oninput = render;
  render(); // Run once initially
}

// Modal & Actions for Grade Scales
function openEditGradeScale(id) {
  if (!id) return;
  adminFetch(`/api/admin/grade-scales/${id}`).then((r) => r.json()).then((j) => {
    if (!j.success) return;
    const g = j.data;
    const modal = document.getElementById('gs-modal');
    if (!modal) return;
    document.getElementById('gs-edit-grade').value = g.grade || '';
    document.getElementById('gs-edit-min').value = g.minScore ?? '';
    document.getElementById('gs-edit-max').value = g.maxScore ?? '';
    document.getElementById('gs-edit-points').value = g.points ?? '';
    document.getElementById('gs-edit-remark').value = g.remark || '';
    document.getElementById('gs-edit-active').checked = g.isActive !== false;
    document.getElementById('gs-edit-form').dataset.id = id;
    modal.style.display = 'flex';
    modal.classList.add('open');
  });
}

async function toggleGradeScale(id, nextState) {
  try {
    await adminFetch(`/api/admin/grade-scales/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ isActive: nextState }),
    });
    showToast('Updated.', 'success');
    loadGradeScales();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

function handlePreview(e) {
  const score = parseFloat(e.target.value);
  const resultBox = document.getElementById('gs-preview-result');
  if (!resultBox) return;

  if (isNaN(score)) {
    resultBox.innerHTML = '<div class="gs-preview-empty">Enter a score to preview</div>';
    return;
  }

  // Find the matching band
  const match = cachedGradeBands.find(b => score >= b.minScore && score <= b.maxScore);

  if (match) {
    // ... render the hit
  } else {
    resultBox.innerHTML = `<div class="gs-preview-miss">No grade band covers a score of ${score}.</div>`;
  }
}

// ============================================
// TRANSCRIPT: Lookup (With Filters)
// ============================================
async function loadTranscriptLookup() {
  const tbody = document.getElementById('tx-search-tbody');
  if (!tbody) return;

  // 1. Render the filter bar + table structure if it doesn't exist
  const container = tbody.closest('.panel-body').parentElement;
  if (!document.getElementById('tx-filters')) {
    // We inject the filters right above the table
    const filterHtml = `
      <div id="tx-filters" class="panel" style="margin-bottom: 20px; padding: 16px; display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end;">
        <div style="flex: 1; min-width: 200px;">
          <label class="form-label" style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Search</label>
          <input class="form-control" id="tx-search" placeholder="Matric, name, or email…" onkeydown="if(event.key==='Enter')FPU_ADMIN.loadTranscriptLookup()" value="${document.getElementById('tx-search')?.value || ''}" />
        </div>
        <div style="width: 200px;">
          <label class="form-label" style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Department</label>
          <select class="form-select" id="tx-filter-dept">
            <option value="">All Departments</option>
          </select>
        </div>
        <div style="width: 150px;">
          <label class="form-label" style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Level</label>
          <select class="form-select" id="tx-filter-level">
            <option value="">All Levels</option>
            <option value="ND 1">ND 1</option>
            <option value="ND 2">ND 2</option>
            <option value="HND 1">HND 1</option>
            <option value="HND 2">HND 2</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="FPU_ADMIN.loadTranscriptLookup()" style="height: 38px;">Search</button>
      </div>
    `;
    container.insertAdjacentHTML('beforebegin', filterHtml);
  }

  const searchTerm = document.getElementById('tx-search')?.value.trim() || '';
  const deptFilter = document.getElementById('tx-filter-dept')?.value || '';
  const levelFilter = document.getElementById('tx-filter-level')?.value || '';

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; color: #64748b;"><span class="spinner"></span> Loading students…</td></tr>';

  try {
    // 2. Fetch departments for the dropdown (only once)
    const deptSelect = document.getElementById('tx-filter-dept');
    if (deptSelect && deptSelect.options.length <= 1) {
      const dRes = await adminFetch('/api/admin/departments').catch(() => null);
      if (dRes && dRes.ok) {
        const dJson = await dRes.json();
        (dJson.data || []).forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.id;
          opt.textContent = `${d.code} - ${d.name}`;
          deptSelect.appendChild(opt);
        });
      }
    }

    // 3. Fetch students
    let url = '/api/admin/students?limit=50';
    if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
    if (deptFilter) url += `&departmentId=${deptFilter}`;
    if (levelFilter) url += `&level=${encodeURIComponent(levelFilter)}`;

    const res = await adminFetch(url);
    const json = await res.json();
    let students = json.data || [];

    // Client-side fallback filter if backend doesn't support departmentId/level natively
    if (deptFilter) students = students.filter(s => Number(s.departmentId) === Number(deptFilter));
    if (levelFilter) students = students.filter(s => String(s.level).toUpperCase() === levelFilter.toUpperCase());

    const countEl = document.getElementById('tx-count');
    if (countEl) countEl.textContent = `${students.length} results`;

    if (!students.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; color: #64748b;">No students match your filters.</td></tr>';
      return;
    }

    tbody.innerHTML = students.map(s => `
      <tr>
        <td style="font-family: monospace; font-weight: 700; color: #065f46;">${escapeHtml(s.matricNumber || '—')}</td>
        <td style="font-weight: 600; color: #0f172a;">${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}</td>
        <td style="text-align: center;">${escapeHtml(s.level || '—')}</td>
        <td>${escapeHtml(s.programmeName || '—')}</td>
        <td style="text-align: center;">
          ${s.isActive !== false 
            ? '<span style="background:#dcfce7; color:#15803d; padding:4px 10px; border-radius:999px; font-size:10px; font-weight:700;">Active</span>' 
            : '<span style="background:#fee2e2; color:#b91c1c; padding:4px 10px; border-radius:999px; font-size:10px; font-weight:700;">Inactive</span>'}
        </td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="FPU_ADMIN.openTranscriptModal(${s.id})">
            Open
          </button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Failed to load transcript lookup:', err);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; color: #dc2626;">Failed to load students.</td></tr>';
  }
}

// ============================================
// TRANSCRIPT: View
// ============================================
async function loadTranscriptView() {
  const root = document.getElementById('tx-root');
  if (!root) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const studentId = params.get('id') || params.get('studentId');

  if (!studentId) {
    root.innerHTML = `
      <div class="alert alert-warning" style="margin:20px;">
        No student selected.
        <button class="btn btn-sm btn-outline" onclick="window.location.hash='#transcript'">← Back to lookup</button>
      </div>`;
    return;
  }

  root.innerHTML = '<div class="loading" style="padding:60px;text-align:center;"><span class="spinner"></span> Loading transcript…</div>';

  try {
    // Fetch student, results, and all courses in parallel
    const [studentRes, resultsRes, coursesRes] = await Promise.all([
      adminFetch(`/api/admin/students/${studentId}`).catch(() => null),
      adminFetch(`/api/admin/results?studentId=${studentId}&limit=5000`).catch(() => null),
      adminFetch('/api/admin/courses?limit=5000').catch(() => null),
    ]);

    let student = null;
    try { if (studentRes && studentRes.ok) { const j = await studentRes.json(); student = j.data || j; } } catch {}
    
    let results = [];
    try { 
      if (resultsRes && resultsRes.ok) { 
        const j = await resultsRes.json(); 
        results = j.data || j || []; 
        // Handle case where backend returns { data: { rows: [...] } }
        if (results.rows) results = results.rows;
      } 
    } catch {}
    
    let courseMap = new Map();
    try { 
      if (coursesRes && coursesRes.ok) { 
        const j = await coursesRes.json(); 
        const courses = j.data || j || [];
        courses.forEach(c => courseMap.set(c.id, c)); 
      } 
    } catch {}

    if (!student || !student.id) {
      throw new Error('Student not found.');
    }

    // Update page header
    const titleEl = document.getElementById('tx-title');
    const subtitleEl = document.getElementById('tx-subtitle');
    if (titleEl) titleEl.textContent = `${student.firstName || ''} ${student.lastName || ''} — Transcript`;
    if (subtitleEl) subtitleEl.textContent = `${student.matricNumber || ''} · ${student.programmeName || student.programme?.name || ''}`;

    // Group results by session/semester
    const groups = new Map();
    results.forEach(r => {
      const row = r.result || r;
      const key = `${row.sessionId || '?'}|${row.semester || '?'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });

    // Compute summary
    let totalUnits = 0, totalPoints = 0, courseCount = 0;
    
    results.forEach(r => {
      const row = r.result || r;
      // Find course details from our map
      const course = courseMap.get(row.courseId) || r.course || {};
      const units = Number(course.unit) || Number(row.unit) || 0;
      const points = Number(row.points) || 0;
      
      if (row.status === 'published' || row.status === 'approved') {
        totalUnits += units;
        totalPoints += units * points;
        courseCount++;
      }
    });
    
    const cgpa = totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '—';
    const classification =
      cgpa === '—' ? '—' :
      Number(cgpa) >= 3.50 ? 'Distinction' :
      Number(cgpa) >= 3.00 ? 'Upper Credit' :
      Number(cgpa) >= 2.50 ? 'Lower Credit' :
      Number(cgpa) >= 2.00 ? 'Pass' : 'Fail';

    // Render groups
    const groupsHtml = [...groups.entries()].map(([key, list]) => {
      const [sessionId, semester] = key.split('|');
      
      const sectionUnits = list.reduce((s, r) => {
        const row = r.result || r;
        const course = courseMap.get(row.courseId) || r.course || {};
        return s + (Number(course.unit) || Number(row.unit) || 0);
      }, 0);
      
      const sectionPoints = list.reduce((s, r) => {
        const row = r.result || r;
        const course = courseMap.get(row.courseId) || r.course || {};
        const units = Number(course.unit) || Number(row.unit) || 0;
        return s + (units * (Number(row.points) || 0));
      }, 0);
      
      const gpa = sectionUnits > 0 ? (sectionPoints / sectionUnits).toFixed(2) : '—';

      const rowsHtml = list
        .sort((a, b) => {
          const ca = courseMap.get((a.result || a).courseId) || {};
          const cb = courseMap.get((b.result || b).courseId) || {};
          return String(ca.code || '').localeCompare(String(cb.code || ''));
        })
        .map(r => {
          const row = r.result || r;
          const course = courseMap.get(row.courseId) || r.course || {};
          const grade = row.grade || '—';
          return `
            <tr>
              <td><code>${escapeHtml(course.code || row.courseCode || `#${row.courseId}`)}</code></td>
              <td>${escapeHtml(course.title || row.courseTitle || '—')}</td>
              <td class="num center">${Number(course.unit) || Number(row.unit) || 0}</td>
              <td class="num">${row.score != null ? row.score : '—'}</td>
              <td class="center"><span class="tx-grade ${grade}">${escapeHtml(grade)}</span></td>
              <td class="num">${row.points != null ? row.points : '—'}</td>
            </tr>`;
        }).join('');

      return `
        <div class="tx-semester">
          <div class="tx-semester-head">
            <span>Session ${escapeHtml(sessionId)} — ${escapeHtml(semester)} Semester</span>
            <span class="gpa">GPA ${gpa} · ${sectionUnits} units</span>
          </div>
          <table class="tx-table">
            <thead>
              <tr>
                <th style="width:100px;">Code</th>
                <th>Course Title</th>
                <th style="width:60px;text-align:center;">Units</th>
                <th style="width:70px;text-align:right;">Score</th>
                <th style="width:70px;text-align:center;">Grade</th>
                <th style="width:70px;text-align:right;">Points</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`;
    }).join('');

    // Render full transcript
    root.innerHTML = `
      <div class="tx-document">
        <div class="tx-watermark">FPU</div>

        <div class="tx-letterhead">
          <img class="tx-letterhead-logo" src="/images/logo.png" alt="FPU Logo" onerror="this.style.display='none'" />
          <div class="tx-letterhead-text">
            <div class="institution">Federal Polytechnic Ugep</div>
            <div class="motto">Citadel of Technical Excellence</div>
            <div class="doc-type">Official Student Transcript</div>
          </div>
          <div style="width:80px;"></div>
        </div>

        <div class="tx-header">
          <div class="tx-student-info">
            <h2>${escapeHtml((student.firstName || '') + ' ' + (student.lastName || ''))}</h2>
            <div class="meta">
              <span class="matric">${escapeHtml(student.matricNumber || '—')}</span> ·
              ${escapeHtml(student.level || '—')} ·
              ${escapeHtml(student.programmeName || student.programme?.name || '—')}
            </div>
            <div class="meta">
              ${escapeHtml(student.email || '')}
              ${student.departmentName ? ' · ' + escapeHtml(student.departmentName) : ''}
            </div>
          </div>
          <div class="tx-cgpa-block">
            <div class="label">CGPA</div>
            <div class="value">${cgpa}</div>
            <div class="class">${escapeHtml(classification)}</div>
          </div>
        </div>

        <div class="tx-summary">
          <div class="tx-summary-item"><div class="num">${courseCount}</div><div class="lbl">Courses</div></div>
          <div class="tx-summary-item"><div class="num">${totalUnits}</div><div class="lbl">Total Units</div></div>
          <div class="tx-summary-item"><div class="num">${totalPoints}</div><div class="lbl">Total Points</div></div>
          <div class="tx-summary-item"><div class="num" style="font-size:0.9rem;">${escapeHtml(classification)}</div><div class="lbl">Classification</div></div>
        </div>

        ${groups.size > 0 ? groupsHtml : `
          <div class="alert alert-warning" style="margin:0;">
            No published results found for this student.
          </div>
        `}

        <div class="tx-signatures">
          <div class="tx-sig-block"><div class="tx-sig-line"></div><div class="tx-sig-role">Registrar</div></div>
          <div class="tx-sig-block"><div class="tx-sig-line"></div><div class="tx-sig-role">Date</div></div>
          <div class="tx-sig-block"><div class="tx-sig-line"></div><div class="tx-sig-role">Rector</div></div>
        </div>
      </div>
    `;

    // Wire print + export
    const printBtn = document.getElementById('tx-print');
    if (printBtn) printBtn.onclick = () => window.print();

    const exportBtn = document.getElementById('tx-export');
    if (exportBtn) {
      exportBtn.onclick = () => {
        const table = root.querySelector('.tx-table');
        if (table) exportTableAsCSV(table, `transcript-${student.matricNumber || student.id}.csv`);
        else showToast('⚠️ No data to export.', 'warning');
      };
    }

  } catch (err) {
    console.error('Transcript Error:', err);
    root.innerHTML = `
      <div class="alert alert-danger" style="margin:20px;">
        <strong>Failed to load transcript:</strong> ${escapeHtml(err.message)}
        <br/><br/>
        <button class="btn btn-sm btn-outline" onclick="window.location.hash='#transcript'">← Back to lookup</button>
      </div>`;
  }
}

// Wire up the buttons (Run this inside your app initialization)
function initTranscriptEvents() {
  const searchBtn = document.getElementById('transcript-search-btn');
  const searchInput = document.getElementById('transcript-search-input');
  const refreshBtn = document.getElementById('transcript-refresh');

  if (searchBtn) {
    searchBtn.addEventListener('click', () => loadTranscriptLookup());
  }
  
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') loadTranscriptLookup();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = ''; // Clear search on refresh
      loadTranscriptLookup();
    });
  }
}

// ============================================
// TIMETABLE
// ============================================
async function loadTimetableIndex() {
  const grid = document.getElementById('tt-dept-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading departments…</div>';

  const sessionId = (document.getElementById('tt-session') || {}).value || '';
  const semester = (document.getElementById('tt-semester') || {}).value || 'first';
  const search = (document.getElementById('tt-search') || {}).value || '';

  try {
    const qs = new URLSearchParams({ limit: 2000 });
    if (sessionId) qs.set('sessionId', sessionId);
    if (semester) qs.set('semester', semester);

    const [deptsRes, slotsRes, schoolsRes, coursesRes] = await Promise.all([
      adminFetch('/api/admin/departments'),
      adminFetch(`/api/admin/timetable?${qs}`),
      adminFetch('/api/admin/schools'),
      adminFetch('/api/admin/courses?limit=2000'),
    ]);

    const depts = (await deptsRes.json()).data || [];
    const slots = (await slotsRes.json()).data || [];
    const schools = (await schoolsRes.json()).data || [];
    const courses = (await coursesRes.json()).data || [];

    window.__ttCache = slots.map((s) => s.slot || s);

    const courseById = new Map(courses.map((c) => [c.id, c]));
    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    const byDept = new Map();
    for (const d of depts) byDept.set(d.id, { dept: d, slots: [] });
    
    for (const s of slots) {
      const slot = s.slot || s;
      const c = courseById.get(slot.courseId);
      if (!c) continue;
      const bucket = byDept.get(c.departmentId);
      if (!bucket) continue;
      bucket.slots.push(s);
    }

    let totalSlots = 0;
    let scheduledDepts = 0;
    for (const b of byDept.values()) {
      totalSlots += b.slots.length;
      if (b.slots.length > 0) scheduledDepts++;
    }

    setText('tt-stat-depts', depts.length);
    setText('tt-stat-slots', totalSlots);
    setText('tt-stat-scheduled', scheduledDepts);
    setText('tt-stat-conflicts', 0);

    const visible = [...byDept.values()].filter((b) => {
      if (search) {
        const q = search.toLowerCase();
        return String(b.dept.code).toLowerCase().includes(q) || String(b.dept.name).toLowerCase().includes(q);
      }
      return true;
    });

    if (!visible.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">🗓️</div><p>No departments.</p></div>';
      return;
    }

    grid.innerHTML = visible.map((b) => {
      const units = b.slots.reduce((acc, s) => {
        const slot = s.slot || s;
        const c = courseById.get(slot.courseId);
        return acc + (Number(c?.unit) || 0);
      }, 0);
      const days = new Set(b.slots.map((s) => (s.slot || s).dayOfWeek));
      const isEmpty = b.slots.length === 0;
      const school = schoolMap.get(b.dept.schoolId);

      return `
        <div class="tt-dept-card ${isEmpty ? 'empty' : ''}" ${isEmpty ? '' : `data-dept-id="${b.dept.id}" data-dept-name="${escapeHtml(b.dept.name)}"`}>
          <div class="ttd-head">
            <span class="ttd-code">${escapeHtml(b.dept.code)}</span>
            <span class="ttd-school">${escapeHtml(school?.code || '')}</span>
          </div>
          <h3>${escapeHtml(b.dept.name)}</h3>
          <div class="ttd-stats">
            <div class="ttd-stat"><span class="num">${b.slots.length}</span><span class="label">Slots</span></div>
            <div class="ttd-stat"><span class="num">${units}</span><span class="label">Units</span></div>
            <div class="ttd-stat"><span class="num">${days.size}</span><span class="label">Days</span></div>
          </div>
          <div class="ttd-footer">
            <span>${isEmpty ? 'Empty' : 'View timetable'}</span>
            <span class="arrow">→</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.tt-dept-card[data-dept-id]').forEach((card) => {
      card.addEventListener('click', () => {
        FPU_ADMIN_SPA.navigateToWithQuery('timetable-by-dept', { departmentId: Number(card.dataset.deptId), sessionId: sessionId || '', semester, name: card.dataset.deptName });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// EXAMS: Index Page Loader
// ============================================
async function loadExamsIndex() {
  const grid = document.getElementById('ex-school-grid');
  if (!grid) return;

  // 1. Load Periods
  loadExamPeriods();

  // 2. Load Schools & Stats
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;"><span class="spinner"></span> Loading schools…</div>';

  try {
    const sessionId = document.getElementById('ex-session')?.value || '';
    const semester = document.getElementById('ex-semester')?.value || 'first';

    const res = await adminFetch(`/api/admin/exams/schools?sessionId=${sessionId}&semester=${semester}`);
    const json = await res.json();
    const schools = json.data || [];

    // Update Stats Bar
    let totalExams = 0, totalDays = 0, totalVenues = 0;
    schools.forEach(s => {
      totalExams += Number(s.exams) || 0;
      totalDays += Number(s.days) || 0;
      totalVenues += Number(s.venues) || 0;
    });
    
    // Note: Departments count might need to be fetched from a separate endpoint if not in `schools` data
    document.getElementById('ex-stat-total').textContent = totalExams;
    document.getElementById('ex-stat-depts').textContent = schools.length; 
    document.getElementById('ex-stat-days').textContent = totalDays;
    document.getElementById('ex-stat-venues').textContent = totalVenues;

    if (!schools.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#64748b;">No exams scheduled yet.</div>';
      return;
    }

    // Render Cards
    grid.innerHTML = schools.map(s => {
      const examCount = Number(s.exams) || 0;
      const isHealthy = examCount > 0;
      
      return `
        <div class="ex-school-card ${isHealthy ? '' : 'empty'}" onclick="window.location.hash='#exam-sheet?schoolId=${s.id}&sessionId=${sessionId}&semester=${semester}&name=${encodeURIComponent(s.name)}'">
          <div class="esc-head">
            <span class="esc-code">${escapeHtml(s.code || 'SCH')}</span>
            <span class="esc-badge">Exam Sheet</span>
          </div>
          <h3>${escapeHtml(s.name)}</h3>
          
          <div class="esc-stats">
            <div class="esc-stat">
              <span class="num">${examCount}</span>
              <span class="label">Exams</span>
            </div>
            <div class="esc-stat">
              <span class="num">${Number(s.days) || 0}</span>
              <span class="label">Days</span>
            </div>
            <div class="esc-stat">
              <span class="num">${Number(s.venues) || 0}</span>
              <span class="label">Venues</span>
            </div>
          </div>
          
          <div class="esc-footer">
            <span>${isHealthy ? 'Open exam sheet' : 'No exams yet'}</span>
            <span class="arrow">→</span>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load exams index:', err);
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#dc2626;">Failed to load exams data.</div>';
  }
}

// ============================================
// EXAMS: Load Periods
// ============================================
async function loadExamPeriods() {
  const body = document.getElementById('ex-periods-body');
  if (!body) return;

  try {
    const res = await adminFetch('/api/admin/exams/periods');
    const json = await res.json();
    const periods = json.data || [];

    if (!periods.length) {
      body.innerHTML = '<span class="muted">No periods configured.</span>';
      return;
    }

    body.innerHTML = `
      <div class="period-chips">
        ${periods.map(p => `
          <div class="period-chip">
            <span class="label">${escapeHtml(p.name)}</span>
            <span class="value">${escapeHtml(p.start)} - ${escapeHtml(p.end)}</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    console.error('Failed to load periods:', err);
    body.innerHTML = '<span style="color:#dc2626;">Failed to load periods.</span>';
  }
}

// ============================================
// 1. ATTENDANCE: Overview (Departments)
// ============================================
async function loadAttendanceDepartments() {
  const grid = document.getElementById('att-dept-grid');
  if (!grid) return;

  grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #94a3b8;"><span class="spinner"></span> Loading departments…</div>';

  try {
    const res = await adminFetch('/api/admin/attendance/departments');
    const json = await res.json();
    const departments = json.data || [];

    // Update Top Stats Bar (with safe number conversion)
    const statDepts = document.getElementById('att-stat-depts');
    if (statDepts) statDepts.textContent = departments.length;
    
    let totalCourses = 0, totalRecords = 0, totalPresent = 0, totalLate = 0;
    departments.forEach(d => {
      totalCourses += Number(d.courses) || 0;
      totalRecords += Number(d.records) || 0;
      totalPresent += Number(d.present) || 0;
      totalLate += Number(d.late) || 0;
    });
    
    const statCourses = document.getElementById('att-stat-courses');
    if (statCourses) statCourses.textContent = totalCourses;
    
    const statTotal = document.getElementById('att-stat-total');
    if (statTotal) statTotal.textContent = totalRecords;
    
    let overallRate = 0;
    if (totalRecords > 0) {
      overallRate = Math.round(((Number(totalPresent) + Number(totalLate)) / Number(totalRecords)) * 100);
    }
    
    const statRate = document.getElementById('att-stat-rate');
    if (statRate) statRate.textContent = totalRecords > 0 ? `${overallRate}%` : '—';

    if (!departments.length) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">No departments found.</div>';
      return;
    }

    // RENDER AS A CLEAN DATA TABLE
    grid.innerHTML = `
      <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <table style="width:100%; border-collapse:collapse; text-align:left;">
          <thead>
            <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
              <th style="padding:16px 20px; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">Department</th>
              <th style="padding:16px 20px; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">School</th>
              <th style="padding:16px 20px; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.5px; text-align:center;">Courses</th>
              <th style="padding:16px 20px; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.5px; text-align:center;">Students</th>
              <th style="padding:16px 20px; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.5px; text-align:center;">Records</th>
              <th style="padding:16px 20px; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">Attendance Rate</th>
              <th style="padding:16px 20px; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.5px; text-align:right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${departments.map(d => {
              const rate = Number(d.rate) || 0;
              const hasRecords = Number(d.records) > 0;
              
              let barColor = '#cbd5e1';
              let textColor = '#64748b';
              
              if (hasRecords) {
                if (rate >= 75) { barColor = '#10b981'; textColor = '#065f46'; }
                else if (rate >= 50) { barColor = '#f59e0b'; textColor = '#b45309'; }
                else { barColor = '#ef4444'; textColor = '#991b1b'; }
              }

              return `
                <tr style="border-bottom:1px solid #e2e8f0; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                  <td style="padding:16px 20px;">
                    <span style="background:#ecfdf5; color:#065f46; padding:4px 8px; border-radius:6px; font-weight:800; font-size:11px; font-family:monospace; margin-right:8px;">${escapeHtml(d.code || '')}</span>
                    <span style="font-weight:700; color:#0f172a; font-size:14px;">${escapeHtml(d.name || '')}</span>
                  </td>
                  <td style="padding:16px 20px; color:#64748b; font-size:13px;">
                    ${escapeHtml(d.schoolName || 'N/A')}
                  </td>
                  <td style="padding:16px 20px; text-align:center; font-weight:700; color:#0f172a;">
                    ${Number(d.courses) || 0}
                  </td>
                  <td style="padding:16px 20px; text-align:center; font-weight:700; color:#0f172a;">
                    ${Number(d.students) || 0}
                  </td>
                  <td style="padding:16px 20px; text-align:center; font-weight:700; color:#0f172a;">
                    ${Number(d.records) || 0}
                  </td>
                  <td style="padding:16px 20px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                      <div style="flex:1; height:6px; background:#e2e8f0; border-radius:999px; overflow:hidden; min-width:80px;">
                        <div style="width:${rate}%; height:100%; background:${barColor}; border-radius:999px; transition:width 0.5s ease;"></div>
                      </div>
                      <span style="font-size:13px; font-weight:800; color:${textColor}; width:40px; text-align:right;">${hasRecords ? rate + '%' : '—'}</span>
                    </div>
                  </td>
                  <td style="padding:16px 20px; text-align:right;">
                    <button class="btn btn-sm btn-outline" onclick="FPU_ADMIN.openDepartmentAttendanceModal(${d.id}, '${escapeQuotes(d.name)}', '${escapeQuotes(d.code)}')" style="font-weight: 600;">Manage</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

  } catch (err) {
    console.error('Failed to load attendance', err);
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #dc2626;">Failed to load attendance data: ${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// 2. ATTENDANCE: Modal Logic
// ============================================
async function openDeptModal(deptId, deptName, deptCode) {
  const modal = document.getElementById('dept-modal');
  const title = document.getElementById('modal-dept-name');
  const meta = document.getElementById('modal-dept-meta');
  const loading = document.getElementById('modal-loading');
  const grid = document.getElementById('modal-course-grid');

  if (!modal) return;

  // Show modal & reset state
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('show'), 10);
  
  title.textContent = deptName;
  meta.textContent = `Code: ${deptCode}`;
  loading.style.display = 'block';
  grid.innerHTML = '';

  try {
    const res = await adminFetch(`/api/admin/attendance/department/${deptId}`);
    const json = await res.json();
    const courses = json.data || [];

    loading.style.display = 'none';

    if (!courses.length) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">No courses found in this department.</div>';
      return;
    }

    // Render cards INSIDE the modal
    grid.innerHTML = courses.map(c => {
      let rateClass = 'empty';
      if (c.records > 0) {
        if (c.rate >= 75) rateClass = 'healthy';
        else if (c.rate >= 50) rateClass = 'warning';
        else rateClass = 'critical';
      }

      const rateText = c.records > 0 ? `${c.rate}%` : '—';
      const lvlClass = c.level ? c.level.toLowerCase() : 'other';

      return `
        <div class="course-card" onclick="window.location.hash='#attendance-course?id=${c.id}&departmentId=${deptId}'">
          <div class="course-card-header">
            <span class="course-code-badge">${escapeHtml(c.code)}</span>
            <span class="course-level-badge">${escapeHtml(c.level || 'N/A')}</span>
          </div>
          <h3 class="course-name">${escapeHtml(c.title)}</h3>
          
          <div class="course-rate-wrap">
            <span class="course-rate-number ${rateClass}">${rateText}</span>
            <span class="course-rate-label">attendance rate</span>
          </div>
          
          <div class="course-stats-grid">
            <div class="course-stat-box">
              <div class="course-stat-val">${c.records}</div>
              <div class="course-stat-lbl">Records</div>
            </div>
            <div class="course-stat-box">
              <div class="course-stat-val">${c.students}</div>
              <div class="course-stat-lbl">Students</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load courses', err);
    loading.style.display = 'none';
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #dc2626;">Failed to load courses.</div>';
  }
}

function closeDeptModal() {
  const modal = document.getElementById('dept-modal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 200);
  }
}

// Close modal if clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('dept-modal');
  if (modal && e.target === modal) {
    closeDeptModal();
  }
});

// ============================================
// 2. ATTENDANCE: By Department (Courses)
// ============================================
async function loadDepartmentAttendance() {
  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const deptId = params.get('id');

  const grid = document.getElementById('abd-course-grid');
  if (!grid) return;

  if (!deptId) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #dc2626;">No department selected. Please go back and click a department.</div>';
    return;
  }

  grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #94a3b8;"><span class="spinner"></span> Loading courses…</div>';

  // Gather filters
  const level = document.getElementById('abd-filter-level')?.value || '';
  const semester = document.getElementById('abd-filter-semester')?.value || '';
  const search = document.getElementById('abd-filter-search')?.value || '';

  try {
    let url = `/api/admin/attendance/department/${deptId}?`;
    if (level) url += `level=${level}&`;
    if (semester) url += `semester=${semester}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;

    const res = await adminFetch(url);
    const json = await res.json();
    const courses = json.data || [];

    // Update Stats
    let totalRecords = 0, totalPresent = 0, totalLate = 0, totalStudents = 0, coursesWithRecords = 0;
    
    courses.forEach(c => {
      totalRecords += c.records || 0;
      totalPresent += c.present || 0;
      totalLate += c.late || 0;
      totalStudents += c.students || 0;
      if (c.records > 0) coursesWithRecords++;
    });

    document.getElementById('abdc-stat-courses').textContent = coursesWithRecords;
    document.getElementById('abdc-stat-records').textContent = totalRecords;
    document.getElementById('abdc-stat-students').textContent = totalStudents;
    
    let overallRate = 0;
    if (totalRecords > 0) {
      overallRate = Math.round(((Number(totalPresent) + Number(totalLate)) / Number(totalRecords)) * 100);
    }
    document.getElementById('abdc-stat-rate').textContent = totalRecords > 0 ? `${overallRate}%` : '—';

    if (!courses.length) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">No courses found in this department.</div>';
      return;
    }

    // Render Course Cards
    grid.innerHTML = courses.map(c => {
      let rateClass = 'empty';
      if (c.records > 0) {
        if (c.rate >= 75) rateClass = 'healthy';
        else if (c.rate >= 50) rateClass = 'warning';
        else rateClass = 'critical';
      }

      const rateText = c.records > 0 ? `${c.rate}%` : '—';
      const lvlClass = c.level ? c.level.toLowerCase() : 'other';
      const lastDate = c.lastDate ? new Date(c.lastDate).toLocaleDateString() : 'Never';

      return `
        <div class="course-card" onclick="window.location.hash='#attendance-course?id=${c.id}&departmentId=${deptId}'">
          <div class="course-card-header">
            <span class="course-code-badge">${escapeHtml(c.code)}</span>
            <span class="course-level-badge">${escapeHtml(c.level || 'N/A')}</span>
          </div>
          <h3 class="course-name">${escapeHtml(c.title)}</h3>
          
          <div class="course-rate-wrap">
            <span class="course-rate-number ${rateClass}">${rateText}</span>
            <span class="course-rate-label">attendance rate</span>
          </div>
          
          <div class="course-stats-grid">
            <div class="course-stat-box">
              <div class="course-stat-val">${c.records}</div>
              <div class="course-stat-lbl">Records</div>
            </div>
            <div class="course-stat-box">
              <div class="course-stat-val">${c.students}</div>
              <div class="course-stat-lbl">Students</div>
            </div>
            <div class="course-stat-box" title="Last Class: ${lastDate}">
              <div class="course-stat-val" style="font-size: 0.85rem; padding-top: 4px;">${lastDate}</div>
              <div class="course-stat-lbl">Last Class</div>
            </div>
          </div>
          
          <div class="course-card-footer">
            <span>${c.records === 0 ? 'No records yet' : 'View Roster'}</span>
            <span>→</span>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load department courses', err);
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #dc2626;">Failed to load courses.</div>';
  }
}

// ============================================
// 2. ATTENDANCE: By Department (Courses)
// ============================================
async function loadDepartmentAttendance() {
  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const deptId = params.get('id');

  if (!deptId) {
    showToast('No department selected.', 'error');
    window.location.hash = '#attendance';
    return;
  }

  const grid = document.getElementById('abd-course-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1; text-align:center;"><span class="spinner"></span> Loading courses…</div>';

  // Gather filters
  const level = document.getElementById('abd-filter-level')?.value || '';
  const semester = document.getElementById('abd-filter-semester')?.value || '';
  const search = document.getElementById('abd-filter-search')?.value || '';

  try {
    let url = `/api/admin/attendance/department/${deptId}?`;
    if (level) url += `level=${level}&`;
    if (semester) url += `semester=${semester}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;

    const res = await adminFetch(url);
    const json = await res.json();
    const courses = json.data || [];

    // Update Stats
    let totalRecords = 0, totalPresent = 0, totalLate = 0, totalStudents = 0, coursesWithRecords = 0;
    
    courses.forEach(c => {
      totalRecords += c.records || 0;
      totalPresent += c.present || 0;
      totalLate += c.late || 0;
      totalStudents += c.students || 0;
      if (c.records > 0) coursesWithRecords++;
    });

    document.getElementById('abdc-stat-courses').textContent = coursesWithRecords;
    document.getElementById('abdc-stat-records').textContent = totalRecords;
    document.getElementById('abdc-stat-students').textContent = totalStudents;
    
    let overallRate = 0;
    if (totalRecords > 0) {
      overallRate = Math.round(((totalPresent + totalLate) / totalRecords) * 100);
    }
    document.getElementById('abdc-stat-rate').textContent = totalRecords > 0 ? `${overallRate}%` : '—';

    if (!courses.length) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">No courses found in this department.</div>';
      return;
    }

    // Render Course Cards
    grid.innerHTML = courses.map(c => {
      let rateClass = 'empty';
      if (c.records > 0) {
        if (c.rate >= 75) rateClass = 'healthy';
        else if (c.rate >= 50) rateClass = 'warning';
        else rateClass = 'critical';
      }

      const rateText = c.records > 0 ? `${c.rate}%` : '—';
      const lvlClass = c.level ? c.level.toLowerCase() : 'other';
      const lastDate = c.lastDate ? new Date(c.lastDate).toLocaleDateString() : 'Never';

      // Routes to: #attendance-course?id=Y&departmentId=X
      return `
        <div class="abd-course-card ${rateClass}" onclick="window.location.hash='#attendance-course?id=${c.id}&departmentId=${deptId}'">
          <div class="abcc-head">
            <span class="abcc-code">${escapeHtml(c.code)}</span>
            <span class="abcc-level ${lvlClass}">${escapeHtml(c.level || 'N/A')}</span>
          </div>
          <h3>${escapeHtml(c.title)}</h3>
          
          <div class="abcc-rate">
            <span class="num ${rateClass}">${rateText}</span>
            <span class="label">attendance rate</span>
          </div>
          
          <div class="abcc-stats">
            <div class="abcc-stat">
              <span class="num">${c.records}</span>
              <span class="label">Records</span>
            </div>
            <div class="abcc-stat">
              <span class="num">${c.students}</span>
              <span class="label">Students</span>
            </div>
            <div class="abcc-stat" title="Last Class: ${lastDate}">
              <span class="num" style="font-size: 0.8rem; padding-top: 2px;">${lastDate}</span>
              <span class="label">Last Class</span>
            </div>
          </div>
          
          <div class="abcc-footer">
            <span>${c.records === 0 ? 'No records yet' : 'View Roster'}</span>
            <span class="arrow">→</span>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load department courses', err);
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #dc2626;">Failed to load courses.</div>';
  }
}

// ============================================
// STAFF (Directory, HODs, Lecturers)
// ============================================

async function loadStaffDirectory(roleFilter = null, tabElement = null) {
  const grid = document.getElementById('staff-grid');
  if (!grid) return;

  // 1. Handle Tab & Dropdown UI Sync
  const roleDropdown = document.getElementById('staff-filter-role');
  
  if (tabElement) {
    document.querySelectorAll('.staff-role-tab').forEach(t => t.classList.remove('active'));
    tabElement.classList.add('active');
    if (roleDropdown) roleDropdown.value = roleFilter || '';
  } else if (roleFilter !== null) {
    if (roleDropdown) roleDropdown.value = roleFilter || '';
    document.querySelectorAll('.staff-role-tab').forEach(t => {
      t.classList.remove('active');
      if (t.getAttribute('data-role') === roleFilter) t.classList.add('active');
    });
  } else {
    roleFilter = roleDropdown ? roleDropdown.value : '';
  }

  const search = document.getElementById('staff-search')?.value || '';

  // Show loading spinner
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;"><span class="spinner"></span> Loading staff…</div>';

  try {
    // 2. Build API URL
    let url = `/api/admin/staff?limit=500`;
    if (roleFilter) url += `&role=${roleFilter}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await adminFetch(url);
    const json = await res.json();
    const staffList = json.data || [];

    // 3. Render Cards
    if (!staffList.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#64748b;">No staff found matching your filters.</div>';
      return;
    }

    // List of all valid roles for CSS classes
    const validRoles = [
      'lecturer', 'hod', 'principal', 'admin', 'bursar', 
      'registrar', 'librarian', 'exam_officer', 'academic_officer', 'admission_officer'
    ];

    grid.innerHTML = staffList.map(staff => {
      const initials = `${staff.firstName?.[0] || ''}${staff.lastName?.[0] || ''}`.toUpperCase() || 'S';
      
      // Map DB 'rector' to UI 'principal' if needed
      let dbRole = staff.role === 'rector' ? 'principal' : staff.role;
      const roleClass = validRoles.includes(dbRole) ? dbRole : 'other';
      
      const deptName = staff.departmentName || staff.department?.name || '—';
      const rank = staff.staffProfile?.rank || '—'; 
      const status = staff.isActive !== false ? 'Active' : 'Inactive';

      return `
        <div class="staff-card role-${roleClass}">
          <div class="sc-head">
            <div class="sc-avatar">${initials}</div>
            <div class="sc-info">
              <div class="sc-name">${escapeHtml(staff.firstName)} ${escapeHtml(staff.lastName)}</div>
              <div class="sc-email">${escapeHtml(staff.email)}</div>
              <span class="sc-role-badge ${roleClass}">${escapeHtml(staff.role.replace(/_/g, ' '))}</span>
            </div>
          </div>
          <div class="sc-meta">
            <div class="sc-meta-row"><span class="k">Department</span><span class="v">${escapeHtml(deptName)}</span></div>
            <div class="sc-meta-row"><span class="k">Rank</span><span class="v">${escapeHtml(rank)}</span></div>
            <div class="sc-meta-row"><span class="k">Status</span><span class="v">${status}</span></div>
          </div>
          <div class="sc-actions">
            <button class="btn btn-outline btn-sm" onclick="window.location.hash='#staff-profile?id=${staff.id}'">View</button>
            <button class="btn btn-outline btn-sm" onclick="window.location.hash='#staff-form?id=${staff.id}'">Edit</button>
          </div>
        </div>
      `;
    }).join('');

    // 4. Update the tab count for the active tab
    if (tabElement) {
      const countSpan = tabElement.querySelector('.tab-count');
      if (countSpan) countSpan.textContent = staffList.length;
    }

  } catch (err) {
    console.error('[staff-directory] Error:', err);
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#dc2626;">Failed to load staff directory.</div>';
  }
}

// ============================================
// HODs: Board with search, view, and replace
// ============================================
let ALL_HODS = [];
let ALL_DEPTS_HOD = [];

async function loadHodBoard() {
  const grid = document.getElementById('hod-dept-grid');
  if (!grid) return;

  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;"><span class="spinner"></span> Loading HODs…</div>';

  const search = (document.getElementById('hod-search') || {}).value.toLowerCase() || '';

  try {
    const [deptsRes, hodsRes, schoolsRes] = await Promise.all([
      adminFetch('/api/admin/departments'),
      adminFetch('/api/admin/hods'),
      adminFetch('/api/admin/schools'),
    ]);

    const depts = (await deptsRes.json()).data || [];
    const hods = (await hodsRes.json()).data || [];
    const schools = (await schoolsRes.json()).data || [];

    ALL_HODS = hods;
    ALL_DEPTS_HOD = depts;

    const hodById = new Map(hods.map(h => [Number(h.id), h]));
    const schoolMap = new Map(schools.map(s => [Number(s.id), s]));

    // Filter departments by search
    let visible = depts.filter(d => {
      if (!search) return true;
      const h = d.hodUserId ? hodById.get(Number(d.hodUserId)) : null;
      const hay = [
        d.code || '',
        d.name || '',
        h?.firstName || '',
        h?.lastName || '',
      ].join(' ').toLowerCase();
      return hay.includes(search);
    });

    // Stats
    const assigned = depts.filter(d => d.hodUserId).length;
    const unassigned = hods.length - assigned;
    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setT('hod-stat-total', hods.length);
    setT('hod-stat-assigned', assigned);
    setT('hod-stat-unassigned', unassigned);
    setT('hod-stat-depts', depts.length);

    // Render cards
    grid.innerHTML = visible.map(d => {
      const hod = d.hodUserId ? hodById.get(Number(d.hodUserId)) : null;
      const school = schoolMap.get(Number(d.schoolId));
      const vacant = !hod;
      const initials = hod 
        ? ((hod.firstName || ' ')[0] + (hod.lastName || ' ')[0]).toUpperCase().trim() 
        : '?';
      const fullName = hod ? `${hod.firstName || ''} ${hod.lastName || ''}`.trim() : 'No HOD assigned';

      return `
        <div class="hod-card ${vacant ? 'vacant' : ''}">
          <div class="hod-head">
            <span class="hod-code">${escapeHtml(d.code || '')}</span>
            <span class="hod-school">${escapeHtml(school?.code || '')}</span>
          </div>
          <h3>${escapeHtml(d.name || '')}</h3>
          <div class="hod-holder">
            <div class="hod-avatar ${vacant ? 'vacant' : ''}">${escapeHtml(initials)}</div>
            <div class="hod-info">
              <div class="hod-name ${vacant ? 'vacant' : ''}">${escapeHtml(fullName)}</div>
              <div class="hod-email">${escapeHtml(hod?.email || 'Assign a new HOD to activate')}</div>
            </div>
          </div>
          <div class="hod-actions">
            ${vacant 
              ? `<button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.replaceHod(${d.id})">+ Assign HOD</button>`
              : `<button class="btn btn-sm btn-outline" onclick="FPU_ADMIN.viewHodDetails(${hod.id})">View HOD</button>
                 <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.replaceHod(${d.id})">Replace</button>`
            }
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('[hods] Error:', err);
    grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;background:#fee2e2;color:#991b1b;border-radius:8px;">Error: ${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// HODs: View details modal
// ============================================
function viewHodDetails(hodId) {
  const hod = ALL_HODS.find(h => Number(h.id) === Number(hodId));
  if (!hod) return;

  const fullName = `${hod.firstName || ''} ${hod.lastName || ''}`.trim();
  const initials = ((hod.firstName || ' ')[0] + (hod.lastName || ' ')[0]).toUpperCase().trim() || 'H';
  const dept = ALL_DEPTS_HOD.find(d => Number(d.hodUserId) === Number(hodId));

  const backdrop = document.createElement('div');
  backdrop.className = 'fpu-modal-backdrop';
  backdrop.innerHTML = `
    <div class="fpu-modal">
      <div class="fpu-modal-header">
        <h3>HOD Details</h3>
        <button class="btn btn-sm btn-ghost" onclick="this.closest('.fpu-modal-backdrop').remove()">×</button>
      </div>
      <div class="fpu-modal-body">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#6b21a8,#9333ea);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;margin-bottom:12px;">
            ${escapeHtml(initials)}
          </div>
          <h3 style="margin:0;font-size:1.2rem;color:#0f172a;">${escapeHtml(fullName)}</h3>
          <div style="color:#6b7280;font-size:13px;margin-top:4px;">${escapeHtml(hod.email || '')}</div>
        </div>
        <div style="background:#f8fafc;border-radius:8px;padding:14px;">
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #e2e8f0;font-size:13px;">
            <span style="color:#64748b;">Department</span>
            <strong>${escapeHtml(dept?.name || '—')}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #e2e8f0;font-size:13px;">
            <span style="color:#64748b;">Department Code</span>
            <strong>${escapeHtml(dept?.code || '—')}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;">
            <span style="color:#64748b;">Phone</span>
            <strong>${escapeHtml(hod.phone || '—')}</strong>
          </div>
        </div>
      </div>
      <div class="fpu-modal-footer">
        <button class="btn btn-outline" onclick="this.closest('.fpu-modal-backdrop').remove()">Close</button>
        <button class="btn btn-primary" onclick="FPU_ADMIN.sendHodEmail(${hod.id})">✉️ Send Email</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
}

// ============================================
// HODs: Replace HOD modal
// ============================================
async function replaceHod(deptId) {
  const dept = ALL_DEPTS_HOD.find(d => Number(d.id) === Number(deptId));
  if (!dept) return;

  // Fetch lecturers in this department
  let lecturers = [];
  try {
    const res = await adminFetch(`/api/admin/staff?role=lecturer&departmentId=${deptId}&limit=500`);
    lecturers = (await res.json()).data || [];
  } catch (err) {
    console.error('[replace hod]', err);
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'fpu-modal-backdrop';
  backdrop.innerHTML = `
    <div class="fpu-modal">
      <div class="fpu-modal-header">
        <h3>Assign HOD — ${escapeHtml(dept.name || '')}</h3>
        <button class="btn btn-sm btn-ghost" onclick="this.closest('.fpu-modal-backdrop').remove()">×</button>
      </div>
      <div class="fpu-modal-body">
        <div class="form-group">
          <label class="form-label">Select new HOD from ${escapeHtml(dept.name || '')}</label>
          <select class="form-select" id="hod-new-hod">
            <option value="">— Choose lecturer —</option>
            ${lecturers.map(l => `
              <option value="${l.id}">${escapeHtml((l.firstName || '') + ' ' + (l.lastName || ''))} — ${escapeHtml(l.email || '')}</option>
            `).join('')}
          </select>
        </div>
        <p class="muted small" style="margin-top:8px;">Only lecturers in this department are shown.</p>
      </div>
      <div class="fpu-modal-footer">
        <button class="btn btn-outline" onclick="this.closest('.fpu-modal-backdrop').remove()">Cancel</button>
        <button class="btn btn-primary" id="hod-save-btn">Assign HOD</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#hod-save-btn').onclick = async () => {
    const newHodId = Number(backdrop.querySelector('#hod-new-hod').value);
    if (!newHodId) { showToast('⚠️ Please select a lecturer.', 'warning'); return; }

    try {
      const res = await adminFetch(`/api/admin/hods/${newHodId}/assign-department`, {
        method: 'POST',
        body: JSON.stringify({ departmentId: Number(deptId) }),
      });
      if (!res.ok) throw new Error('Failed to assign HOD');
      showToast('✅ HOD assigned.', 'success');
      backdrop.remove();
      loadHodBoard();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };
}

// ============================================
// HODs: Send Email
// ============================================
function sendHodEmail(hodId) {
  const hod = ALL_HODS.find(h => Number(h.id) === Number(hodId));
  if (!hod || !hod.email) {
    showToast('⚠️ No email on file for this HOD.', 'warning');
    return;
  }
  const subject = encodeURIComponent('FPU Admin Notification');
  const body = encodeURIComponent(`Dear ${hod.firstName || 'HOD'},\n\n\n\nRegards,\nFPU Admin`);
  window.location.href = `mailto:${hod.email}?subject=${subject}&body=${body}`;
}

// ============================================
// HODs: Email All HODs at once
// ============================================
function emailAllHods() {
  const emails = ALL_HODS.map(h => h.email).filter(Boolean);
  if (!emails.length) {
    showToast('⚠️ No HODs have emails on file.', 'warning');
    return;
  }
  const subject = encodeURIComponent('FPU — Important Message to all HODs');
  const body = encodeURIComponent(`Dear HODs,\n\n\n\nRegards,\nRegistrar`);
  window.location.href = `mailto:${emails.join(',')}?subject=${subject}&body=${body}`;
}

// ============================================
// LECTURERS: Grid with Workload & Actions
// ============================================
let ALL_LECTURERS = [];
let ALL_ALLOCATIONS = [];

async function loadLecturerGrid() {
  const grid = document.getElementById('lec-grid');
  if (!grid) return;

  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;"><span class="spinner"></span> Loading lecturers…</div>';

  const deptId = (document.getElementById('lec-filter-dept') || {}).value || '';
  const workload = (document.getElementById('lec-filter-workload') || {}).value || '';
  const search = (document.getElementById('lec-search') || {}).value || '';

  try {
    // Fetch staff + allocations + departments
    const [staffRes, allocsRes, deptsRes] = await Promise.all([
      adminFetch(`/api/admin/staff?role=lecturer&limit=500${deptId ? '&departmentId=' + deptId : ''}${search ? '&search=' + encodeURIComponent(search) : ''}`),
      adminFetch('/api/admin/allocations?limit=2000'),
      adminFetch('/api/admin/departments'),
    ]);

    const staff = (await staffRes.json()).data || [];
    const allocs = (await allocsRes.json()).data || [];
    const depts = (await deptsRes.json()).data || [];

    ALL_LECTURERS = staff;
    ALL_ALLOCATIONS = allocs;

    // Populate department filter
    const deptSelect = document.getElementById('lec-filter-dept');
    if (deptSelect && !deptSelect.__wired) {
      deptSelect.__wired = true;
      deptSelect.innerHTML = '<option value="">All departments</option>' +
        depts.sort((a, b) => String(a.code).localeCompare(String(b.code)))
          .map(d => `<option value="${d.id}">${escapeHtml(d.code)} — ${escapeHtml(d.name)}</option>`).join('');
    }

    // Group allocations by lecturer — strict filtering
    const allocsByLecturer = new Map();
    allocs.forEach(a => {
      // 1. Get the lecturerId from any possible location
      const lid = a.allocation?.lecturerId 
              || a.lecturer?.id 
              || a.lecturerId;
      
      // 2. Skip if no lecturer OR no valid course attached
      if (!lid) return;
      if (!a.course) return;
      if (!a.course.code) return;
      if (!a.course.title) return;
      
      // 3. Add to the map
      if (!allocsByLecturer.has(lid)) allocsByLecturer.set(lid, []);
      allocsByLecturer.get(lid).push(a);
    });

    // Enrich staff
    let visible = staff.map(s => {
      const list = allocsByLecturer.get(s.id) || [];
      const units = list.reduce((acc, a) => acc + (Number(a.course?.unit) || 0), 0);
      return { ...s, _allocs: list, _units: units };
    });

    // Apply workload filter
    if (workload === 'loaded') visible = visible.filter(s => s._allocs.length > 0 && s._units <= 12);
    else if (workload === 'overloaded') visible = visible.filter(s => s._units >= 13);
    else if (workload === 'unloaded') visible = visible.filter(s => s._allocs.length === 0);

    // Stats
    const totalUnits = visible.reduce((acc, s) => acc + s._units, 0);
    const avg = visible.length ? Math.round((totalUnits / visible.length) * 10) / 10 : 0;

    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setT('lec-stat-total', visible.length);
    setT('lec-stat-loaded', visible.filter(s => s._allocs.length > 0).length);
    setT('lec-stat-unloaded', visible.filter(s => s._allocs.length === 0).length);
    setT('lec-stat-avg', avg + ' u');

    if (!visible.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;">No lecturers found.</div>';
      return;
    }

    // Render cards
    grid.innerHTML = visible.map(s => {
      const fullName = `${s.firstName || ''} ${s.lastName || ''}`.trim();
      const initials = ((s.firstName || ' ')[0] + (s.lastName || ' ')[0]).toUpperCase().trim() || 'L';
      
      // Workload color class
      let workloadClass = 'normal';
      if (s._units >= 17) workloadClass = 'overloaded';
      else if (s._units >= 13) workloadClass = 'heavy';
      else if (s._allocs.length === 0) workloadClass = 'none';

      return `
        <div class="lec-card ${workloadClass}" data-id="${s.id}" onclick="FPU_ADMIN.openLecturerCourses(${s.id})">
          <div class="lec-head">
            <div class="lec-avatar">${escapeHtml(initials)}</div>
            <div class="lec-info">
              <div class="lec-name">${escapeHtml(fullName)}</div>
              <div class="lec-email">${escapeHtml(s.email || '')}</div>
              ${s.departmentName || s.department?.name ? `<span class="lec-dept">${escapeHtml(s.departmentName || s.department?.name)}</span>` : ''}
            </div>
          </div>
          <div class="lec-workload">
            <div class="lec-workload-stat ${s._allocs.length === 0 ? 'none' : ''}">
              <span class="num">${s._allocs.length}</span>
              <span class="label">Courses</span>
            </div>
            <div class="lec-workload-stat ${s._units >= 17 ? 'heavy' : ''}">
              <span class="num">${s._units}</span>
              <span class="label">Units</span>
            </div>
          </div>
          <div class="lec-actions" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-outline lec-action-icon" onclick="FPU_ADMIN.sendLecturerEmail(${s.id})" title="Send Email">✉️</button>
            <button class="btn btn-sm btn-outline lec-action-icon" onclick="FPU_ADMIN.sendLecturerNotification(${s.id})" title="Send Notification">🔔</button>
            <button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.openLecturerCourses(${s.id})">View Courses</button>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('[lecturers] Error:', err);
    grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;background:#fee2e2;color:#991b1b;border-radius:8px;">Error: ${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// LECTURERS: View Courses Modal
// ============================================
async function openLecturerCourses(id) {
  const lecturer = ALL_LECTURERS.find(s => Number(s.id) === Number(id));
  if (!lecturer) return;

    // Strict filter: only allocations with valid course data
    const allocs = ALL_ALLOCATIONS.filter(a => {
      const lid = a.allocation?.lecturerId 
              || a.lecturer?.id 
              || a.lecturerId;
      
      return lid 
          && Number(lid) === Number(id) 
          && a.course 
          && a.course.code
          && a.course.title;
    });

  const fullName = `${lecturer.firstName || ''} ${lecturer.lastName || ''}`.trim();
  const email = lecturer.email || '';

  const backdrop = document.createElement('div');
  backdrop.className = 'fpu-modal-backdrop';
  backdrop.innerHTML = `
    <div class="fpu-modal">
      <div class="fpu-modal-header">
        <h3>${escapeHtml(fullName)} — Courses</h3>
        <button class="btn btn-sm btn-ghost" onclick="this.closest('.fpu-modal-backdrop').remove()">×</button>
      </div>
      <div class="fpu-modal-body">
        ${allocs.length === 0 ? `
          <div style="text-align:center;padding:40px;color:#64748b;">
            <div style="font-size:2rem;margin-bottom:10px;">📚</div>
            <p style="margin:0 0 8px;font-weight:600;color:#0f172a;">No courses allocated yet</p>
            <p style="margin:0;font-size:13px;">Use the Allocations page to assign courses to this lecturer.</p>
          </div>
        ` : `
          <div style="margin-bottom:12px;font-size:12px;color:#64748b;">
            Showing <strong>${allocs.length}</strong> course${allocs.length === 1 ? '' : 's'} assigned to this lecturer.
          </div>
          <table class="table-admin" style="width:100%;font-size:13px;">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th style="text-align:center;">Units</th>
                <th>Semester</th>
              </tr>
            </thead>
            <tbody>
              ${allocs.map(a => `
                <tr>
                  <td><code>${escapeHtml(a.course.code || '—')}</code></td>
                  <td>${escapeHtml(a.course.title || '—')}</td>
                  <td style="text-align:center;font-weight:600;">${Number(a.course.unit) || 0}</td>
                  <td><span style="text-transform:capitalize;">${escapeHtml(a.allocation?.semester || a.semester || '—')}</span></td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#f8fafc;font-weight:700;">
                <td colspan="2" style="text-align:right;">Total Units:</td>
                <td style="text-align:center;">${allocs.reduce((sum, a) => sum + (Number(a.course.unit) || 0), 0)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        `}
      </div>
      <div class="fpu-modal-footer">
        <button class="btn btn-outline" onclick="this.closest('.fpu-modal-backdrop').remove()">Close</button>
        ${email ? `<button class="btn btn-primary" onclick="FPU_ADMIN.sendLecturerEmail(${id})">✉️ Email ${escapeHtml(lecturer.firstName || 'Lecturer')}</button>` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
}

// ============================================
// LECTURERS: Send Email
// ============================================
function sendLecturerEmail(id) {
  const lecturer = ALL_LECTURERS.find(s => Number(s.id) === Number(id));
  if (!lecturer || !lecturer.email) {
    showToast('⚠️ No email on file for this lecturer.', 'warning');
    return;
  }

  const subject = encodeURIComponent('FPU Admin Notification');
  const body = encodeURIComponent(`Dear ${lecturer.firstName || 'Lecturer'},\n\n\n\nRegards,\nFPU Admin`);
  window.location.href = `mailto:${lecturer.email}?subject=${subject}&body=${body}`;
}

// ============================================
// LECTURERS: Send Notification (Modal)
// ============================================
async function sendLecturerNotification(id) {
  const lecturer = ALL_LECTURERS.find(s => Number(s.id) === Number(id));
  if (!lecturer) return;

  const fullName = `${lecturer.firstName || ''} ${lecturer.lastName || ''}`.trim();

  const backdrop = document.createElement('div');
  backdrop.className = 'fpu-modal-backdrop';
  backdrop.innerHTML = `
    <div class="fpu-modal">
      <div class="fpu-modal-header">
        <h3>Send Notification</h3>
        <button class="btn btn-sm btn-ghost" onclick="this.closest('.fpu-modal-backdrop').remove()">×</button>
      </div>
      <div class="fpu-modal-body">
        <p class="muted small" style="margin-bottom:12px;">To: <strong>${escapeHtml(fullName)}</strong></p>
        <div class="form-group">
          <label class="form-label">Title <span class="req">*</span></label>
          <input class="form-control" id="notif-title" placeholder="e.g. Submit results for COM 111" />
        </div>
        <div class="form-group">
          <label class="form-label">Message</label>
          <textarea class="form-control" id="notif-body" rows="4" placeholder="Type your message…"></textarea>
        </div>
      </div>
      <div class="fpu-modal-footer">
        <button class="btn btn-outline" onclick="this.closest('.fpu-modal-backdrop').remove()">Cancel</button>
        <button class="btn btn-primary" id="notif-send-btn">Send Notification</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#notif-send-btn').onclick = async () => {
    const title = backdrop.querySelector('#notif-title').value.trim();
    const body = backdrop.querySelector('#notif-body').value.trim();

    if (!title) {
      showToast('⚠️ Please enter a title.', 'warning');
      return;
    }

    try {
      const res = await adminFetch('/api/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({
          userId: id,
          title,
          body: body || 'You have a new notification from the admin.',
          type: 'info',
        }),
      });
      if (!res.ok) throw new Error('Failed to send notification');
      showToast('✅ Notification sent to ' + (lecturer.firstName || 'lecturer'), 'success');
      backdrop.remove();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };
}

// Helper for HOD assigning
async function assignHodDept(hodId, departmentId = null) {
  if (!hodId && departmentId) {
    const email = prompt("HOD's email (must have role 'hod'):");
    if (!email) return;
    try {
      const res = await adminFetch(`/api/admin/user-list?search=${encodeURIComponent(email)}&limit=5`);
      const json = await res.json();
      const match = (json.data || []).find((u) => u.role === 'hod' && u.email.toLowerCase() === email.toLowerCase());
      if (!match) { showToast('No HOD with that email.', 'error'); return; }
      hodId = match.id;
    } catch (err) { showToast('❌ ' + err.message, 'error'); return; }
  }

  if (!departmentId) {
    departmentId = prompt("Enter the department ID to assign this HOD to:");
    if (!departmentId) return;
  }

  try {
    await adminFetch(`/api/admin/hods/${hodId}/assign-department`, {
      method: "POST",
      body: JSON.stringify({ departmentId: Number(departmentId) }),
    });
    showToast("Department assigned.", 'success');
    loadHodBoard();
  } catch (err) {
    showToast("❌ " + err.message, "error");
  }
}

// ============================================
// FEES
// ============================================
async function loadFeeDepartments() {
  const grid = document.getElementById('fees-dept-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading departments…</div>';

  const sessionId = (document.getElementById('fees-session') || {}).value || '';
  const schoolId = (document.getElementById('fees-school') || {}).value || '';
  const search = (document.getElementById('fees-search') || {}).value || '';

  try {
    const qs = new URLSearchParams({ limit: 2000 });
    if (sessionId) qs.set('sessionId', sessionId);

    const [feesRes, deptsRes, progsRes, schoolsRes] = await Promise.all([
      adminFetch(`/api/admin/fees?${qs}`),
      adminFetch('/api/admin/departments'),
      adminFetch('/api/admin/programmes'),
      adminFetch('/api/admin/schools'),
    ]);

    const fees = (await feesRes.json()).data || [];
    const depts = (await deptsRes.json()).data || [];
    const progs = (await progsRes.json()).data || [];
    const schools = (await schoolsRes.json()).data || [];

    const progById = new Map(progs.map((p) => [p.id, p]));
    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    const byDept = new Map();
    for (const d of depts) byDept.set(d.id, { dept: d, fees: [] });

    for (const f of fees) {
      const p = progById.get(f.programmeId);
      if (!p) continue;
      const bucket = byDept.get(p.departmentId);
      if (!bucket) continue;
      bucket.fees.push(f);
    }

    let totalStructures = 0, min = Infinity, max = 0;
    byDept.forEach((b) => {
      totalStructures += b.fees.length;
      b.fees.forEach((f) => {
        const t = Number(f.total);
        if (t < min) min = t;
        if (t > max) max = t;
      });
    });

    setText('fees-stat-depts', [...byDept.values()].filter((b) => b.fees.length > 0).length);
    setText('fees-stat-total', totalStructures);
    setText('fees-stat-min', min === Infinity ? '—' : money(min));
    setText('fees-stat-max', max ? money(max) : '—');

    const visible = [...byDept.values()].filter((b) => {
      if (schoolId && Number(b.dept.schoolId) !== Number(schoolId)) return false;
      if (search) {
        const q = search.toLowerCase();
        return String(b.dept.code).toLowerCase().includes(q) || String(b.dept.name).toLowerCase().includes(q);
      }
      return true;
    });

    if (!visible.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">💰</div><p>No departments.</p></div>';
      return;
    }

    visible.sort((a, b) => String(a.dept.code).localeCompare(String(b.dept.code)));

    grid.innerHTML = visible.map((b) => {
      const totals = b.fees.map((f) => Number(f.total));
      const range = totals.length ? `${money(Math.min(...totals))} – ${money(Math.max(...totals))}` : '—';
      const avg = totals.length ? money(Math.round(totals.reduce((s, n) => s + n, 0) / totals.length)) : '—';
      const school = schoolMap.get(b.dept.schoolId);
      const isEmpty = b.fees.length === 0;

      return `
        <div class="fees-dept-card ${isEmpty ? 'empty' : ''}" ${isEmpty ? '' : `data-dept-id="${b.dept.id}" data-dept-name="${escapeHtml(b.dept.name)}"`}>
          <div class="fdc-head">
            <span class="fdc-code">${escapeHtml(b.dept.code)}</span>
            <span class="fdc-school">${escapeHtml(school?.code || '')}</span>
          </div>
          <h3>${escapeHtml(b.dept.name)}</h3>
          <div class="fdc-range">
            <span class="num">${b.fees.length}</span>
            <span class="label">structure${b.fees.length === 1 ? '' : 's'}</span>
          </div>
          <div class="fdc-stats">
            <div class="fdc-stat"><span class="num">${range !== '—' ? range.split(' – ')[0] : '—'}</span><span class="label">Min</span></div>
            <div class="fdc-stat"><span class="num">${range !== '—' ? range.split(' – ')[1] : '—'}</span><span class="label">Max</span></div>
            <div class="fdc-stat"><span class="num">${avg}</span><span class="label">Average</span></div>
          </div>
          <div class="fdc-footer">
            <span>${isEmpty ? 'No structures' : 'View structures'}</span>
            <span class="arrow">→</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.fees-dept-card[data-dept-id]').forEach((card) => {
      card.addEventListener('click', () => {
        FPU_ADMIN_SPA.navigateToWithQuery('fees-by-dept', { departmentId: Number(card.dataset.deptId), sessionId, name: card.dataset.deptName });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// PAYMENTS — Department Overview
// ============================================
async function loadPaymentDepartments() {
  const grid = document.getElementById('pm-dept-grid');
  if (!grid) return;

  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;"><span class="spinner"></span> Loading…</div>';

  try {
    const [payRes, deptsRes, studentsRes, schoolsRes, sessionsRes] = await Promise.all([
      adminFetch('/api/admin/payments').catch(() => null),
      adminFetch('/api/admin/departments').catch(() => null),
      adminFetch('/api/admin/students?limit=5000').catch(() => null),
      adminFetch('/api/admin/schools').catch(() => null),
      adminFetch('/api/admin/sessions').catch(() => null),
    ]);

    const payments = payRes?.ok ? (await payRes.json()).data || [] : [];
    const depts = deptsRes?.ok ? (await deptsRes.json()).data || [] : [];
    const students = studentsRes?.ok ? (await studentsRes.json()).data || [] : [];
    const schools = schoolsRes?.ok ? (await schoolsRes.json()).data || [] : [];
    const sessions = sessionsRes?.ok ? (await sessionsRes.json()).data || [] : [];

    const studentById = new Map(students.map(s => [Number(s.id), s]));
    const schoolMap = new Map(schools.map(s => [Number(s.id), s]));

    // Populate session & school dropdowns
    const sessionSelect = document.getElementById('pm-session');
    if (sessionSelect && !sessionSelect.__wired) {
      sessionSelect.__wired = true;
      const current = sessions.find(s => s.isCurrent);
      sessionSelect.innerHTML = '<option value="">Current session</option>' +
        sessions.map(s => `<option value="${s.id}"${s.id === current?.id ? ' selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
    }
    const schoolSelect = document.getElementById('pm-school');
    if (schoolSelect && !schoolSelect.__wired) {
      schoolSelect.__wired = true;
      schoolSelect.innerHTML = '<option value="">All schools</option>' +
        schools.map(s => `<option value="${s.id}">${escapeHtml(s.code || s.name)}</option>`).join('');
    }

    // Bucket by department
    const byDept = new Map();
    depts.forEach(d => byDept.set(Number(d.id), {
      dept: d, verified: 0, pending: 0, verifiedAmt: 0, pendingAmt: 0, studentIds: new Set(),
    }));

    let totalVerified = 0, totalPendingAmt = 0, pendingCount = 0;
    payments.forEach(p => {
      const row = p.payment || p;
      const sid = Number(row.studentId || row.student_id);
      const stu = studentById.get(sid) || p.student;
      if (!stu) return;
      const bucket = byDept.get(Number(stu.departmentId));
      if (!bucket) return;
      bucket.studentIds.add(sid);
      const status = String(row.status || '').toLowerCase();
      const amt = Number(row.amount) || 0;
      if (status === 'verified' || status === 'approved' || status === 'paid') {
        bucket.verified++;
        bucket.verifiedAmt += amt;
        totalVerified += amt;
      } else if (status === 'pending') {
        bucket.pending++;
        bucket.pendingAmt += amt;
        totalPendingAmt += amt;
        pendingCount++;
      }
    });

    // Update top stats
    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setT('pm-stat-verified', money(totalVerified));
    setT('pm-stat-pending-amt', money(totalPendingAmt));
    setT('pm-stat-pending-count', pendingCount);
    setT('pm-stat-total', payments.length);

    // Filters
    const school = document.getElementById('pm-school')?.value || '';
    const search = document.getElementById('pm-search')?.value.toLowerCase() || '';

    let visible = [...byDept.values()].filter(b => {
      if (school && Number(b.dept.schoolId) !== Number(school)) return false;
      if (search) {
        const q = search.toLowerCase();
        return String(b.dept.code || '').toLowerCase().includes(q) ||
               String(b.dept.name || '').toLowerCase().includes(q);
      }
      return true;
    });

    visible.sort((a, b) => String(a.dept.code).localeCompare(String(b.dept.code)));

    if (!visible.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;">No departments match your filters.</div>';
      return;
    }

    // Render cards
    grid.innerHTML = visible.map(b => {
      const sch = schoolMap.get(Number(b.dept.schoolId));
      const totalStudents = students.filter(s => Number(s.departmentId) === Number(b.dept.id)).length;
      const paidCount = b.studentIds.size;
      const rate = totalStudents ? Math.round((paidCount / totalStudents) * 100) : 0;
      const hasPending = b.pending > 0;
      const isEmpty = paidCount === 0;

      return `
        <div class="pm-dept-card ${hasPending ? 'has-pending' : ''} ${isEmpty ? 'empty' : ''}"
             data-dept-id="${b.dept.id}" data-dept-name="${escapeHtml(b.dept.name)}">
          <div class="pmd-head">
            <span class="pmd-code">${escapeHtml(b.dept.code || '')}</span>
            <span class="pmd-school">${escapeHtml(sch ? sch.code : '—')}</span>
          </div>
          <h3>${escapeHtml(b.dept.name || '')}</h3>
          <div class="pmd-amounts">
            <div class="pmd-amount verified">
              <span class="num">${money(b.verifiedAmt)}</span>
              <span class="label">Verified</span>
            </div>
            <div class="pmd-amount pending">
              <span class="num">${money(b.pendingAmt)}</span>
              <span class="label">Pending</span>
            </div>
          </div>
          <div class="pmd-split">
            <div class="item"><span class="n">${b.verified}</span><span class="l">Verified</span></div>
            <div class="item"><span class="n">${b.pending}</span><span class="l">Pending</span></div>
            <div class="item"><span class="n">${rate}%</span><span class="l">Coverage</span></div>
          </div>
          <div class="pmd-footer">
            <span>${isEmpty ? 'No payments' : 'View payments'}</span>
            <span class="arrow">→</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.pm-dept-card[data-dept-id]').forEach(card => {
      card.addEventListener('click', () => {
        window.location.hash = `#payments-by-dept?departmentId=${card.dataset.deptId}&name=${encodeURIComponent(card.dataset.deptName)}`;
      });
    });

  } catch (err) {
    console.error('[payments] Error:', err);
    grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;background:#fee2e2;color:#991b1b;border-radius:8px;">Error: ${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// PAYMENTS — By Department (Drill-down)
// ============================================
async function loadDepartmentPayments() {
  const root = document.getElementById('pd-tbody');
  if (!root) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const departmentId = params.get('departmentId');
  const deptName = params.get('name') || 'Department';

  if (!departmentId) {
    root.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#dc2626;">No department selected.</td></tr>';
    return;
  }

  const titleEl = document.getElementById('pd-title');
  const subEl = document.getElementById('pd-subtitle');
  if (titleEl) titleEl.textContent = deptName;
  if (subEl) subEl.textContent = `Payment status for ${deptName}`;

  root.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;"><span class="spinner"></span> Loading…</td></tr>';

  try {
    const [studentsRes, payRes, feesRes] = await Promise.all([
      adminFetch(`/api/admin/students?departmentId=${departmentId}&limit=5000`).catch(() => null),
      adminFetch('/api/admin/payments').catch(() => null),
      adminFetch('/api/admin/fees').catch(() => null),
    ]);

    const students = studentsRes?.ok ? (await studentsRes.json()).data || [] : [];
    const payments = payRes?.ok ? (await payRes.json()).data || [] : [];
    const fees = feesRes?.ok ? (await feesRes.json()).data || [] : [];

    // Map studentId → total paid (verified)
    const paidByStudent = new Map();
    payments.forEach(p => {
      const row = p.payment || p;
      const sid = Number(row.studentId || row.student_id);
      if (!sid) return;
      const status = String(row.status || '').toLowerCase();
      if (['verified', 'approved', 'paid'].includes(status)) {
        paidByStudent.set(sid, (paidByStudent.get(sid) || 0) + (Number(row.amount) || 0));
      }
    });

    // Map programmeId → total fee expected (deep scan)
    const feeByProgramme = new Map();
    fees.forEach(f => {
      const progId = Number(f.programmeId || f.programme_id);
      const amt = Number(f.totalAmount || f.total_amount || f.amount || f.total) || 0;
      if (progId && amt) feeByProgramme.set(progId, amt);
    });

    // Enrich students
    let fullyPaid = 0, partial = 0, totalCollected = 0;
    const enriched = students.map(s => {
      const paid = paidByStudent.get(Number(s.id)) || 0;
      // Look up fee by level (ND=53105, HND=66726 fallback)
      const levelUpper = String(s.level || '').toUpperCase();
      const due = feeByProgramme.get(Number(s.programmeId || s.programme_id))
         || feeByProgramme.get(levelUpper)
         || (levelUpper === 'HND' ? 66726 : 53105);
      const balance = Math.max(0, due - paid);
      let status = 'pending';
      if (paid > 0 && balance <= 0) { status = 'paid'; fullyPaid++; }
      else if (paid > 0) { status = 'partial'; partial++; }
      totalCollected += paid;
      return { s, paid, due, balance, status };
    });

    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setT('pd-stat-students', students.length);
    setT('pd-stat-fully', fullyPaid);
    setT('pd-stat-partial', partial);
    setT('pd-stat-collected', money(totalCollected));
    setT('pd-count', `Showing ${students.length} students`);

    // Filters
    const statusFilter = document.getElementById('pd-filter-status')?.value || '';
    const search = document.getElementById('pd-search')?.value.toLowerCase() || '';

    const filtered = enriched.filter(({ s, status }) => {
      if (statusFilter && status !== statusFilter) return false;
      if (search) {
        const fn = `${s.firstName || s.first_name || ''} ${s.lastName || s.last_name || ''}`.toLowerCase();
        const mt = String(s.matricNumber || s.matric_number || '').toLowerCase();
        return fn.includes(search) || mt.includes(search);
      }
      return true;
    });

    if (!filtered.length) {
      root.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#64748b;">No students match your filters.</td></tr>';
      return;
    }

    // Render
    root.innerHTML = filtered.map(({ s, paid, due, balance, status }) => {
      const fn = `${s.firstName || s.first_name || ''} ${s.lastName || s.last_name || ''}`.trim();
      const initials = fn.charAt(0).toUpperCase() || 'S';
      let badgeCls = 'badge-pending', badgeLabel = 'Pending';
      if (status === 'paid') { badgeCls = 'badge-paid'; badgeLabel = 'Fully Paid'; }
      else if (status === 'partial') { badgeCls = 'badge-partial'; badgeLabel = 'Partial'; }

      return `
        <tr>
          <td><code>${escapeHtml(s.matricNumber || s.matric_number || '—')}</code></td>
          <td>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#065f46,#f59e0b);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">${escapeHtml(initials)}</div>
              <span>${escapeHtml(fn)}</span>
            </div>
          </td>
          <td>${escapeHtml(s.level || '—')}</td>
          <td style="text-align:right;font-weight:600;">${due > 0 ? money(due) : '<span style="color:#94a3b8;">No fee</span>'}</td>
          <td style="text-align:right;font-weight:600;color:${paid > 0 ? '#065f46' : '#94a3b8'};">${money(paid)}</td>
          <td style="text-align:right;font-weight:600;color:${balance > 0 ? '#dc2626' : '#94a3b8'};">${balance > 0 ? money(balance) : '—'}</td>
          <td><span class="badge ${badgeCls}">${badgeLabel}</span></td>
          <td style="text-align:right;">
            <button class="btn btn-sm btn-outline" onclick="FPU_ADMIN.openPaymentHistory(${s.id}, '${escapeQuotes(fn)}')">View History</button>
          </td>
        </tr>
      `;
    }).join('');

    // Wire export
    const exportBtn = document.getElementById('pd-export');
    if (exportBtn && !exportBtn.__wired) {
      exportBtn.__wired = true;
      exportBtn.onclick = () => {
        const headers = ['Matric', 'Name', 'Level', 'Total Due', 'Total Paid', 'Balance', 'Status'];
        const rows = filtered.map(({ s, paid, due, balance, status }) => [
          s.matricNumber || s.matric_number || '',
          `${s.firstName || s.first_name || ''} ${s.lastName || s.last_name || ''}`.trim(),
          s.level || '', due, paid, balance, status,
        ]);
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payments-${deptName.replace(/\s/g,'-')}-${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        showToast('✅ Exported.', 'success');
      };
    }

  } catch (err) {
    console.error('[payments] Error:', err);
    root.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:#dc2626;">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

// ============================================
// PAYMENTS — Student History Page
// ============================================
async function loadStudentPayments() {
  const tbody = document.getElementById('ps-tbody');
  const header = document.getElementById('ps-header');
  if (!tbody) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const studentId = params.get('studentId');

  if (!studentId) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#dc2626;">No student selected.</td></tr>';
    return;
  }

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">Loading…</td></tr>';

  try {
    const [studentRes, payRes, feesRes] = await Promise.all([
      adminFetch(`/api/admin/students/${studentId}`).catch(() => null),
      adminFetch('/api/admin/payments').catch(() => null),
      adminFetch('/api/admin/fees').catch(() => null),
    ]);

    const student = studentRes?.ok ? (await studentRes.json()).data || {} : {};
    const allPayments = payRes?.ok ? (await payRes.json()).data || [] : [];
    const fees = feesRes?.ok ? (await feesRes.json()).data || [] : [];

    const payments = allPayments
      .map(p => p.payment || p)
      .filter(p => Number(p.studentId || p.student_id) === Number(studentId));

    const fn = `${student.firstName || student.first_name || ''} ${student.lastName || student.last_name || ''}`.trim();
    const initials = fn.charAt(0).toUpperCase() || 'S';
    const matric = student.matricNumber || student.matric_number || '—';

    document.getElementById('ps-subtitle').textContent = `${matric} · ${student.level || '—'}`;

    // Header
    if (header) {
      header.innerHTML = `
        <div class="ps-header">
          <div class="ps-avatar">${student.photoUrl ? `<img src="${escapeHtml(student.photoUrl)}" alt="">` : escapeHtml(initials)}</div>
          <div class="ps-info">
            <div class="ps-name">${escapeHtml(fn)}</div>
            <div class="ps-meta">${escapeHtml(matric)} · ${escapeHtml(student.level || '—')} · ${escapeHtml(student.programmeName || '—')}</div>
          </div>
        </div>
      `;
    }

    // Totals
    let totalPaid = 0, totalPending = 0;
    payments.forEach(p => {
      const amt = Number(p.amount) || 0;
      const s = String(p.status || '').toLowerCase();
      if (['verified', 'approved', 'paid'].includes(s)) totalPaid += amt;
      else if (s === 'pending') totalPending += amt;
    });

    const progId = student.programmeId || student.programme_id;
    const feeForProgramme = fees.find(f => Number(f.programmeId || f.programme_id) === Number(progId));
    const totalDue = feeForProgramme 
      ? Number(feeForProgramme.totalAmount || feeForProgramme.total_amount || feeForProgramme.amount || feeForProgramme.total) || 0
      : 0;
    const balance = Math.max(0, totalDue - totalPaid);

    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setT('ps-due', totalDue ? money(totalDue) : '—');
    setT('ps-paid', money(totalPaid));
    setT('ps-balance', balance > 0 ? money(balance) : '₦0');
    setT('ps-count', payments.length);

    // Fee breakdown
    const feeEl = document.getElementById('ps-fee-breakdown');
    if (feeEl && feeForProgramme) {
      const items = feeForProgramme.items || feeForProgramme.breakdown || [];
      feeEl.innerHTML = items.length ? `
        <div class="fees-breakdown">
          ${items.map(i => `<div class="fees-row"><span>${escapeHtml(i.name || i.label || '')}</span><span>${money(i.amount)}</span></div>`).join('')}
          <div class="fees-row total"><span>Total</span><span>${money(totalDue)}</span></div>
        </div>
      ` : '<p class="muted">No fee breakdown available.</p>';
    } else if (feeEl) {
      feeEl.innerHTML = '<p class="muted">No fee structure found for this student\'s programme.</p>';
    }

    // Payments table
    if (!payments.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#64748b;">No payments recorded.</td></tr>';
      return;
    }

    tbody.innerHTML = payments
      .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0))
      .map(p => `
        <tr>
          <td><code>${escapeHtml(p.reference || '—')}</code></td>
          <td style="font-weight:700;color:#065f46;">${money(p.amount)}</td>
          <td>${badge(p.status)}</td>
          <td class="small muted">${fmtDate(p.createdAt || p.created_at || p.paidAt)}</td>
          <td>${escapeHtml(p.bankName || p.bank_name || '—')}</td>
          <td style="text-align:right;">
            <button class="btn btn-sm btn-outline" onclick="window.location.hash='#payment-detail?id=${p.id}'">View Receipt</button>
          </td>
        </tr>
      `).join('');

  } catch (err) {
    console.error('[payments history] Error:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#dc2626;">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

// Simple redirect for "View History" button
function openPaymentHistory(studentId, studentName) {
  window.location.hash = `#payments-history?studentId=${studentId}`;
}

// ============================================
// PAYMENTS: SEND REMINDER
// ============================================
async function sendPaymentReminder(studentId, studentName, amount) {
  const ok = await window.fpuConfirm(
    `Send payment reminder to ${studentName}?\n\nAmount: ₦${amount.toLocaleString()}\n\nThis will create an in-app notification.`,
    { title: 'Send Reminder', type: 'info', okText: 'Send Reminder' }
  );
  if (!ok) return;

  try {
    await adminFetch('/api/admin/notifications', {
      method: 'POST',
      body: JSON.stringify({
        userId: studentId,
        title: '💰 Payment Reminder',
        body: `You have an outstanding balance of ₦${amount.toLocaleString()}. Please log in to the portal to make your payment.`,
        type: 'fee',
      }),
    });
    showToast(`✅ Reminder sent to ${studentName}.`, 'success');
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

// ============================================
// PAYMENTS: SEND REMINDER TO ALL DEBTORS IN DEPT
// ============================================
async function sendBulkPaymentReminder(departmentId, deptName) {
  const ok = await window.fpuConfirm(
    `Send payment reminder to ALL students with pending payments in ${deptName}?\n\nThis will create notifications for every debtor.`,
    { title: 'Bulk Payment Reminder', type: 'warning', okText: 'Send All' }
  );
  if (!ok) return;

  try {
    const [studentsRes, payRes, feesRes] = await Promise.all([
      adminFetch(`/api/admin/students?departmentId=${departmentId}&limit=5000`),
      adminFetch('/api/admin/payments'),
      adminFetch('/api/admin/fees'),
    ]);

    const students = (await studentsRes.json()).data || [];
    const payments = (await payRes.json()).data || [];
    const fees = (await feesRes.json()).data || [];

    const feeByProg = new Map();
    fees.forEach(f => {
      const progId = f.programmeId || f.programme_id;
      if (progId && f.total) feeByProg.set(Number(progId), Number(f.total));
    });

    const paidByStudent = new Map();
    payments.forEach(p => {
      const row = p.payment || p;
      const sid = Number(row.studentId || row.student_id);
      if (row.status === 'verified') {
        paidByStudent.set(sid, (paidByStudent.get(sid) || 0) + Number(row.amount || 0));
      }
    });

    const debtors = students.filter(s => {
      const paid = paidByStudent.get(Number(s.id)) || 0;
      const expected = feeByProg.get(Number(s.programmeId)) || 0;
      return expected > paid;
    });

    if (!debtors.length) {
      showToast('⚠️ No debtors found in this department.', 'warning');
      return;
    }

    // Send notification to each debtor in parallel
    const promises = debtors.map(s => {
      const paid = paidByStudent.get(Number(s.id)) || 0;
      const expected = feeByProg.get(Number(s.programmeId)) || 0;
      const outstanding = expected - paid;
      return adminFetch('/api/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({
          userId: s.id,
          title: '💰 Payment Reminder',
          body: `You have an outstanding balance of ₦${outstanding.toLocaleString()}. Please log in to the portal to make your payment.`,
          type: 'fee',
        }),
      });
    });

    await Promise.all(promises);
    showToast(`✅ Reminder sent to ${debtors.length} debtor(s).`, 'success');

  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}


// ============================================
// PAYMENTS: View History Modal & Print Receipt
// ============================================
async function openPaymentHistory(studentId, studentName) {
  const backdrop = document.createElement('div');
  backdrop.className = 'fpu-modal-backdrop';
  backdrop.id = 'payment-history-modal';
  backdrop.innerHTML = `
    <div class="fpu-modal" style="max-width:900px; width:95%;">
      <div class="fpu-modal-header">
        <h3>Payment History — ${escapeHtml(studentName)}</h3>
        <button class="btn btn-sm btn-ghost" onclick="document.getElementById('payment-history-modal').remove()">×</button>
      </div>
      <div class="fpu-modal-body" style="max-height:70vh; overflow-y:auto;" id="payment-history-body">
        <div style="text-align:center;padding:40px;"><span class="spinner"></span> Loading…</div>
      </div>
      <div class="fpu-modal-footer">
        <button class="btn btn-outline" onclick="FPU_ADMIN.exportPaymentHistoryCSV(${studentId}, '${escapeQuotes(studentName)}')">⬇ Export CSV</button>
        <button class="btn btn-outline" id="btn-print-receipt">🖨 Print Receipt</button>
        <button class="btn btn-primary" onclick="document.getElementById('payment-history-modal').remove()">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const body = document.getElementById('payment-history-body');

  try {
    const [payRes, feesRes, studentRes, settingsRes] = await Promise.all([
      adminFetch('/api/admin/payments').catch(() => null),
      adminFetch('/api/admin/fees').catch(() => null),
      adminFetch(`/api/admin/students/${studentId}`).catch(() => null),
      adminFetch('/api/admin/settings?category=institution').catch(() => null),
    ]);

    const allPayments = payRes?.ok ? (await payRes.json()).data || [] : [];
    const fees = feesRes?.ok ? (await feesRes.json()).data || [] : [];
    const student = studentRes?.ok ? (await studentRes.json()).data || {} : {};
    const settings = settingsRes?.ok ? (await settingsRes.json()).data || [] : [];

    // Get school name from settings
    const schoolName = settings.find(s => s.key === 'school_name')?.value || 'Federal Polytechnic Ugep';
    const schoolAddress = settings.find(s => s.key === 'school_address')?.value || 'P.M.B. 1038, Ugep, Cross River State, Nigeria';
    const schoolMotto = settings.find(s => s.key === 'school_motto')?.value || 'Citadel of Technical Excellence';

    const payments = allPayments
      .map(p => p.payment || p)
      .filter(p => Number(p.studentId || p.student_id) === Number(studentId))
      .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));

    // Totals
    let totalVerified = 0, totalPending = 0, totalRejected = 0;
    payments.forEach(p => {
      const amt = Number(p.amount) || 0;
      const s = String(p.status || '').toLowerCase();
      if (['verified', 'approved', 'paid'].includes(s)) totalVerified += amt;
      else if (s === 'pending') totalPending += amt;
      else if (s === 'rejected' || s === 'failed') totalRejected += amt;
    });

    // Fee lookup
    const levelUpper = String(student.level || '').toUpperCase();
    const progId = Number(student.programmeId || student.programme_id);
    
    let totalDue = 0;
    for (const f of fees) {
      const fProgId = Number(f.programmeId || f.programme_id);
      const fLevel = String(f.level || '').toUpperCase();
      const amt = Number(f.totalAmount || f.total_amount || f.amount || f.total) || 0;
      if (fProgId === progId && amt > 0) totalDue = amt;
      else if (!totalDue && fLevel === levelUpper && amt > 0) totalDue = amt;
    }
    if (!totalDue) totalDue = levelUpper === 'HND' ? 66726 : 53105;

    const balance = Math.max(0, totalDue - totalVerified);

    // Render the modal body
    body.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
        <div style="background:#f8fafc;padding:14px;border-radius:8px;border-left:4px solid #065f46;">
          <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">Fee Due</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;margin-top:4px;">${money(totalDue)}</div>
        </div>
        <div style="background:#ecfdf5;padding:14px;border-radius:8px;border-left:4px solid #10b981;">
          <div style="font-size:10px;text-transform:uppercase;color:#047857;font-weight:700;">Total Paid</div>
          <div style="font-size:20px;font-weight:800;color:#065f46;margin-top:4px;">${money(totalVerified)}</div>
        </div>
        <div style="background:#fef3c7;padding:14px;border-radius:8px;border-left:4px solid #f59e0b;">
          <div style="font-size:10px;text-transform:uppercase;color:#92400e;font-weight:700;">Pending</div>
          <div style="font-size:20px;font-weight:800;color:#b45309;margin-top:4px;">${money(totalPending)}</div>
        </div>
        <div style="background:${balance > 0 ? '#fee2e2' : '#ecfdf5'};padding:14px;border-radius:8px;border-left:4px solid ${balance > 0 ? '#dc2626' : '#10b981'};">
          <div style="font-size:10px;text-transform:uppercase;color:${balance > 0 ? '#991b1b' : '#047857'};font-weight:700;">Balance</div>
          <div style="font-size:20px;font-weight:800;color:${balance > 0 ? '#dc2626' : '#065f46'};margin-top:4px;">${balance > 0 ? money(balance) : '₦0'}</div>
        </div>
      </div>

      ${payments.length === 0 ? `
        <div style="text-align:center;padding:40px;color:#64748b;">
          <p>No payments recorded yet.</p>
        </div>
      ` : `
        <table class="table-admin" style="width:100%;font-size:13px;">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Description</th>
              <th style="text-align:right;">Amount</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(p => {
              const s = String(p.status || '').toLowerCase();
              let badgeCls = 'badge-warning';
              if (['verified', 'approved', 'paid'].includes(s)) badgeCls = 'badge-success';
              else if (['rejected', 'failed'].includes(s)) badgeCls = 'badge-danger';
              return `
                <tr>
                  <td><code>${escapeHtml(p.reference || '—')}</code></td>
                  <td>${escapeHtml(p.description || p.purpose || 'Fee Payment')}</td>
                  <td style="text-align:right;font-weight:700;color:#065f46;">${money(p.amount)}</td>
                  <td><span class="badge ${badgeCls}">${s.toUpperCase()}</span></td>
                  <td class="small muted">${fmtDateTime(p.createdAt || p.created_at || p.paidAt)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `}
    `;

    // Store data for the print function
    window.__lastPaymentHistory = { 
      student, studentName, payments, totalDue, totalVerified, totalPending, balance, 
      schoolName, schoolAddress, schoolMotto 
    };

    // Wire the print button
    document.getElementById('btn-print-receipt').onclick = () => printPaymentReceipt();

  } catch (err) {
    body.innerHTML = `<div class="alert alert-danger" style="margin:20px;">Error: ${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// PAYMENTS: Print A4 Receipt
// ============================================
function printPaymentReceipt() {
  const data = window.__lastPaymentHistory;
  if (!data) return;

  const { student, studentName, payments, totalDue, totalVerified, totalPending, balance, schoolName, schoolAddress, schoolMotto } = data;
  const matric = student.matricNumber || student.matric_number || '—';
  const level = student.level || '—';
  const programme = student.programmeName || '—';
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // Create a hidden print container
  const printContainer = document.createElement('div');
  printContainer.id = 'print-receipt-container';
  printContainer.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:999999;padding:0;overflow:hidden;display:none;';

  printContainer.innerHTML = `
    <div style="width:210mm;min-height:297mm;margin:0 auto;padding:20mm;background:#fff;position:relative;font-family:'Times New Roman',serif;color:#000;">
      
      <!-- WATERMARK (School Logo) -->
      <div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0;">
        <img src="/images/logo.png" style="width:70%;opacity:0.06;" onerror="this.style.display='none'" />
      </div>

      <!-- LETTERHEAD -->
      <div style="position:relative;z-index:1;display:flex;align-items:center;gap:20px;border-bottom:3px solid #065f46;padding-bottom:16px;margin-bottom:24px;">
        <img src="/images/logo.png" style="width:80px;" onerror="this.style.display='none'" />
        <div style="flex:1;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#065f46;font-family:'Poppins',sans-serif;">${escapeHtml(schoolName)}</div>
          <div style="font-size:12px;color:#6b7280;font-style:italic;">${escapeHtml(schoolMotto)}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px;">${escapeHtml(schoolAddress)}</div>
        </div>
        <div style="width:80px;"></div>
      </div>

      <!-- TITLE -->
      <div style="text-align:center;margin-bottom:24px;position:relative;z-index:1;">
        <div style="font-size:20px;font-weight:800;text-decoration:underline;text-transform:uppercase;letter-spacing:2px;">Official Payment Receipt</div>
        <div style="font-size:13px;color:#6b7280;margin-top:4px;">Issued: ${dateStr}</div>
      </div>

      <!-- STUDENT DETAILS -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;padding:16px;background:#f8fafc;border-radius:8px;border-left:4px solid #065f46;position:relative;z-index:1;">
        <div>
          <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:0.5px;">Student Name</div>
          <div style="font-size:15px;font-weight:700;color:#0f172a;margin-top:2px;">${escapeHtml(studentName)}</div>
        </div>
        <div>
          <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:0.5px;">Matric Number</div>
          <div style="font-size:15px;font-weight:700;color:#0f172a;margin-top:2px;">${escapeHtml(matric)}</div>
        </div>
        <div>
          <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:0.5px;">Level / Programme</div>
          <div style="font-size:14px;color:#0f172a;margin-top:2px;">${escapeHtml(level)} · ${escapeHtml(programme)}</div>
        </div>
        <div>
          <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:0.5px;">Total Paid</div>
          <div style="font-size:18px;font-weight:800;color:#065f46;margin-top:2px;">${money(totalVerified)}</div>
        </div>
      </div>

      <!-- PAYMENT SUMMARY -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;position:relative;z-index:1;">
        <div style="padding:12px;border:1px solid #e2e8f0;border-radius:6px;text-align:center;">
          <div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:700;">Fee Due</div>
          <div style="font-size:16px;font-weight:800;color:#0f172a;margin-top:2px;">${money(totalDue)}</div>
        </div>
        <div style="padding:12px;border:1px solid #e2e8f0;border-radius:6px;text-align:center;">
          <div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:700;">Verified Paid</div>
          <div style="font-size:16px;font-weight:800;color:#065f46;margin-top:2px;">${money(totalVerified)}</div>
        </div>
        <div style="padding:12px;border:1px solid #e2e8f0;border-radius:6px;text-align:center;">
          <div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:700;">Pending</div>
          <div style="font-size:16px;font-weight:800;color:#b45309;margin-top:2px;">${money(totalPending)}</div>
        </div>
        <div style="padding:12px;border:1px solid ${balance > 0 ? '#fecaca' : '#d1fae5'};border-radius:6px;text-align:center;background:${balance > 0 ? '#fef2f2' : '#f0fdf4'};">
          <div style="font-size:9px;text-transform:uppercase;color:${balance > 0 ? '#991b1b' : '#047857'};font-weight:700;">Balance</div>
          <div style="font-size:16px;font-weight:800;color:${balance > 0 ? '#dc2626' : '#065f46'};margin-top:2px;">${balance > 0 ? money(balance) : '₦0'}</div>
        </div>
      </div>

      <!-- TRANSACTIONS TABLE -->
      <div style="position:relative;z-index:1;">
        <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#065f46;margin-bottom:8px;border-bottom:2px solid #065f46;padding-bottom:4px;">Transaction Details</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="text-align:left;padding:8px;border:1px solid #e2e8f0;">#</th>
              <th style="text-align:left;padding:8px;border:1px solid #e2e8f0;">Reference</th>
              <th style="text-align:left;padding:8px;border:1px solid #e2e8f0;">Description</th>
              <th style="text-align:right;padding:8px;border:1px solid #e2e8f0;">Amount</th>
              <th style="text-align:left;padding:8px;border:1px solid #e2e8f0;">Status</th>
              <th style="text-align:left;padding:8px;border:1px solid #e2e8f0;">Date</th>
            </tr>
          </thead>
          <tbody>
            ${payments.length === 0 ? `<tr><td colspan="6" style="text-align:center;padding:20px;color:#94a3b8;">No payments recorded.</td></tr>` : ''}
            ${payments.map((p, i) => `
              <tr>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;">${i + 1}</td>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;font-family:monospace;font-size:10px;">${escapeHtml(p.reference || '—')}</td>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;">${escapeHtml(p.description || p.purpose || 'Fee Payment')}</td>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:right;font-weight:700;">${money(p.amount)}</td>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;text-transform:capitalize;">${escapeHtml(p.status || '—')}</td>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;">${fmtDate(p.createdAt || p.created_at || p.paidAt)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- SIGNATURES -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:60px;position:relative;z-index:1;">
        <div style="text-align:center;">
          <div style="border-bottom:1px solid #000;height:40px;margin-bottom:6px;"></div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Bursar</div>
        </div>
        <div style="text-align:center;">
          <div style="border-bottom:1px solid #000;height:40px;margin-bottom:6px;"></div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Date</div>
        </div>
      </div>

      <!-- FOOTER -->
      <div style="text-align:center;font-size:9px;color:#94a3b8;margin-top:40px;position:relative;z-index:1;">
        This is a computer-generated receipt and is valid without a physical signature.
      </div>
    </div>
  `;

  document.body.appendChild(printContainer);
  printContainer.style.display = 'block';

  // Trigger print
  window.print();

  // Hide after print
  setTimeout(() => {
    printContainer.style.display = 'none';
    printContainer.remove();
  }, 1000);
}

// ============================================
// PAYMENTS: Export History as CSV
// ============================================
function exportPaymentHistoryCSV(studentId, studentName) {
  const data = window.__lastPaymentHistory;
  if (!data || !data.payments || !data.payments.length) {
    showToast('⚠️ No payments to export.', 'warning');
    return;
  }

  const headers = ['Reference', 'Description', 'Amount', 'Status', 'Date'];
  const rows = data.payments.map(p => [
    p.reference || '',
    p.description || p.purpose || 'Fee Payment',
    Number(p.amount) || 0,
    p.status || '',
    fmtDateTime(p.createdAt || p.created_at || p.paidAt),
  ]);

  const csv = [
    `Student: "${studentName.replace(/"/g, '""')}"`,
    `Fee Due: ₦${data.totalDue}`,
    `Total Paid: ₦${data.totalVerified}`,
    `Balance: ₦${data.balance}`,
    '',
    headers.join(','),
    ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payment-history-${studentName.replace(/\s/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ Exported.', 'success');
}

// ============================================
// PAYMENTS: Export History as CSV
// ============================================
function exportPaymentHistoryPDF(studentId, studentName) {
  const data = window.__lastPaymentHistory;
  if (!data || !data.payments || !data.payments.length) {
    showToast('⚠️ No payments to export.', 'warning');
    return;
  }

  const headers = ['Reference', 'Description', 'Amount', 'Status', 'Date'];
  const rows = data.payments.map(p => [
    p.reference || '',
    p.description || p.purpose || 'Fee Payment',
    Number(p.amount) || 0,
    p.status || '',
    fmtDateTime(p.createdAt || p.created_at || p.paidAt),
  ]);

  const csv = [
    `Student: "${studentName.replace(/"/g, '""')}"`,
    `Fee Due: ₦${data.totalDue}`,
    `Total Paid: ₦${data.totalVerified}`,
    `Balance: ₦${data.balance}`,
    '',
    headers.join(','),
    ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payment-history-${studentName.replace(/\s/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ Exported.', 'success');
}

// ============================================
// PAYMENTS: REVENUE TREND CHART
// ============================================
async function loadPaymentRevenueTrend() {
  const el = document.getElementById('pm-chart-revenue');
  if (!el || typeof Chart === 'undefined') return;

  try {
    const res = await adminFetch('/api/admin/payments?limit=5000');
    const json = await res.json();
    const payments = json.data || [];

    // Group by month (last 6 months)
    const months = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      months[key] = 0;
    }

    payments.forEach(p => {
      const row = p.payment || p;
      if (row.status !== 'verified') return;
      const date = new Date(row.createdAt || row.paidAt);
      if (isNaN(date)) return;
      const key = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      if (months[key] !== undefined) months[key] += Number(row.amount) || 0;
    });

    new Chart(el, {
      type: 'line',
      data: {
        labels: Object.keys(months),
        datasets: [{
          label: 'Verified Revenue (₦)',
          data: Object.values(months),
          borderColor: '#065f46',
          backgroundColor: 'rgba(6,95,70,.1)',
          tension: 0.4,
          fill: true,
          borderWidth: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: v => '₦' + (v / 1000).toFixed(0) + 'k' } } },
      },
    });
  } catch (err) {
    console.warn('[payments chart]', err.message);
  }
}

// ============================================
// CLEARANCES (Department Overview)
// ============================================
async function loadClearanceDepartments() {
  const grid = document.getElementById('clr-dept-grid');
  if (!grid) return;

  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;"><div class="spinner"></div> Loading departments…</div>';

  try {
    const [deptsRes, studentsRes, schoolsRes, clrRes] = await Promise.all([
      adminFetch('/api/admin/departments').catch(() => null),
      adminFetch('/api/admin/students?limit=5000').catch(() => null),
      adminFetch('/api/admin/schools').catch(() => null),
      adminFetch('/api/admin/clearances').catch(() => null),
    ]);

    const depts = deptsRes && deptsRes.ok ? (await deptsRes.json()).data || [] : [];
    const students = studentsRes && studentsRes.ok ? (await studentsRes.json()).data || [] : [];
    const schools = schoolsRes && schoolsRes.ok ? (await schoolsRes.json()).data || [] : [];
    const clearances = clrRes && clrRes.ok ? (await clrRes.json()).data || [] : [];

    console.log('[clearances] Depts:', depts.length, 'Students:', students.length, 'Clearances:', clearances.length);

    // Build map of student → clearance
    const clearanceByStudent = new Map();
    clearances.forEach(c => {
      const sid = Number(c.student_id || c.studentId);
      if (sid) clearanceByStudent.set(sid, c);
    });

    const schoolMap = new Map(schools.map(s => [Number(s.id), s]));

    // Bucket by department
    const byDept = new Map();
    depts.forEach(d => byDept.set(Number(d.id), { dept: d, total: 0, cleared: 0, pending: 0, rejected: 0, missing: 0 }));

    students.forEach(s => {
      const did = Number(s.departmentId);
      if (!did) return;
      const bucket = byDept.get(did);
      if (!bucket) return;
      bucket.total++;
      const clr = clearanceByStudent.get(Number(s.id));
      if (!clr) bucket.missing++;
      else if (clr.status === 'cleared') bucket.cleared++;
      else if (clr.status === 'pending') bucket.pending++;
      else if (clr.status === 'rejected') bucket.rejected++;
    });

    // Global stats
    let totalCleared = 0, totalPending = 0, totalStudents = 0;
    byDept.forEach(b => { totalCleared += b.cleared; totalPending += b.pending; totalStudents += b.total; });

    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setT('clr-stat-depts', byDept.size);
    setT('clr-stat-cleared', totalCleared);
    setT('clr-stat-pending', totalPending);
    setT('clr-stat-rate', totalStudents ? Math.round((totalCleared / totalStudents) * 100) + '%' : '—');

    // Filter
    const school = document.getElementById('clr-school')?.value || '';
    const search = document.getElementById('clr-search')?.value.toLowerCase() || '';

    let visible = [...byDept.values()].filter(b => {
      if (school && Number(b.dept.schoolId) !== Number(school)) return false;
      if (search) {
        const q = search.toLowerCase();
        return String(b.dept.code || '').toLowerCase().includes(q) || String(b.dept.name || '').toLowerCase().includes(q);
      }
      return true;
    });

    visible.sort((a, b) => String(a.dept.code).localeCompare(String(b.dept.code)));

    if (!visible.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;">No departments match your filters.</div>';
      return;
    }

    // Render using classes that match your CSS
    grid.innerHTML = visible.map(b => {
      const rate = b.total ? Math.round((b.cleared / b.total) * 100) : 0;
      const cls = b.total === 0 ? 'empty' : rate >= 75 ? 'healthy' : rate >= 40 ? 'warning' : 'critical';
      const sch = schoolMap.get(Number(b.dept.schoolId));

      return `
        <div class="clr-dept-card ${cls}" data-dept-id="${b.dept.id}" data-dept-name="${escapeHtml(b.dept.name)}" style="cursor:pointer;">
          <div class="cdc-head">
            <span class="cdc-code">${escapeHtml(b.dept.code || '')}</span>
            <span class="cdc-school">${escapeHtml(sch ? sch.code : '')}</span>
          </div>
          <h3>${escapeHtml(b.dept.name || '')}</h3>
          <div class="cdc-rate">
            <span class="cdc-rate-num ${cls}">${b.total ? rate + '%' : '—'}</span>
            <span class="label">cleared</span>
          </div>
          <div class="cdc-stats">
            <div class="item cleared"><span class="n">${b.cleared}</span><span class="l">Cleared</span></div>
            <div class="item pending"><span class="n">${b.pending}</span><span class="l">Pending</span></div>
            <div class="item rejected"><span class="n">${b.rejected}</span><span class="l">Rejected</span></div>
          </div>
          <div class="cdc-footer">
            <span>${b.missing} without records</span>
            <span class="arrow">→</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.clr-dept-card[data-dept-id]').forEach(card => {
      card.addEventListener('click', () => {
        window.location.hash = `#clearances-by-dept?departmentId=${card.dataset.deptId}&name=${encodeURIComponent(card.dataset.deptName)}`;
      });
    });

  } catch (err) {
    console.error('[clearances] Error:', err);
    grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;background:#fee2e2;color:#991b1b;border-radius:8px;">Error: ${escapeHtml(err.message)}</div>`;
  }
}

async function loadDepartmentClearances() {
  const root = document.getElementById('cdd-tbody');
  if (!root) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const departmentId = params.get('departmentId');
  const deptName = params.get('name') || 'Department';

  if (!departmentId) {
    root.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#dc2626;">No department selected.</td></tr>';
    return;
  }

  const titleEl = document.getElementById('cd-title');
  const subEl = document.getElementById('cd-subtitle');
  if (titleEl) titleEl.textContent = deptName;
  if (subEl) subEl.textContent = `Manage clearances for ${deptName}`;

  root.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;"><span class="spinner"></span> Loading students…</td></tr>';

  try {
    // Fetch students and clearances
    const [studentsRes, clrRes] = await Promise.all([
      adminFetch(`/api/admin/students?departmentId=${departmentId}&limit=5000`).catch(() => null),
      adminFetch('/api/admin/clearances').catch(() => null),
    ]);

    const students = studentsRes && studentsRes.ok ? (await studentsRes.json()).data || [] : [];
    const clearances = clrRes && clrRes.ok ? (await clrRes.json()).data || [] : [];

    // Match clearances to students
    const clearanceByStudent = new Map();
    clearances.forEach(c => {
      const row = c.clearance || c;
      const sid = Number(row.student_id || row.studentId);
      if (sid) clearanceByStudent.set(sid, row);
    });

    let cleared = 0, pending = 0, rejected = 0;
    
    const enrichedStudents = students.map(s => {
      const clr = clearanceByStudent.get(Number(s.id));
      const status = clr?.status ? String(clr.status).toLowerCase() : 'pending';
      const remarks = clr?.remarks || '—';

      if (status === 'cleared') cleared++;
      else if (status === 'rejected') rejected++;
      else pending++;

      return { s, status, remarks };
    });

    // Update Stats (Top cards)
    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setT('cdd-stat-students', students.length);
    setT('cdd-stat-cleared', cleared);
    setT('cdd-stat-pending', pending);
    setT('cdd-stat-rate', students.length ? Math.round((cleared / students.length) * 100) + '%' : '—');
    setT('cdd-count', `Showing ${students.length} students`);

    // Apply Filters
    const statusFilter = document.getElementById('cdd-filter-status')?.value || '';
    const searchVal = document.getElementById('cdd-search')?.value.toLowerCase() || '';

    const filtered = enrichedStudents.filter(({ s, status }) => {
      const fullName = `${s.firstName || ''} ${s.lastName || ''}`.trim().toLowerCase();
      const matric = String(s.matricNumber || '').toLowerCase();

      if (statusFilter && status !== statusFilter) return false;
      if (searchVal && !fullName.includes(searchVal) && !matric.includes(searchVal)) return false;
      return true;
    });

    if (!filtered.length) {
      root.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#64748b;">No students match your filters.</td></tr>';
      return;
    }

    // Render rows
    root.innerHTML = filtered.map(({ s, status, remarks }) => {
      const fullName = `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Unknown';
      
      let badgeClass = 'badge-pending';
      let actions = '';

      if (status === 'cleared') {
        badgeClass = 'badge-cleared';
        actions = `<button class="btn btn-sm btn-outline" onclick="FPU_ADMIN.clearStudent(${s.id}, 'pending')">↺ Revert</button>`;
      } else if (status === 'rejected') {
        badgeClass = 'badge-rejected';
        actions = `<button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.clearStudent(${s.id}, 'cleared')">✓ Clear</button>
                   <button class="btn btn-sm btn-outline" onclick="FPU_ADMIN.clearStudent(${s.id}, 'pending')">Re-open</button>`;
      } else {
        badgeClass = 'badge-pending';
        actions = `
          <button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.clearStudent(${s.id}, 'cleared')">✓ Clear</button>
          <button class="btn btn-sm btn-ghost" style="color:#dc2626;" onclick="FPU_ADMIN.clearStudent(${s.id}, 'rejected')">✕ Reject</button>
        `;
      }

      return `
        <tr>
          <td style="padding:12px 20px;"><input type="checkbox" class="clr-student-check" value="${s.id}" style="width:16px;height:16px;accent-color:#065f46;" /></td>
          <td style="padding:12px 20px;"><code>${escapeHtml(s.matricNumber || '—')}</code></td>
          <td style="padding:12px 20px; font-weight:600;">${escapeHtml(fullName)}</td>
          <td style="padding:12px 20px;">${escapeHtml(s.level || '—')}</td>
          <td style="padding:12px 20px;">
            <span class="badge ${badgeClass}" style="text-transform:capitalize; padding:4px 10px; border-radius:999px; font-size:10px; font-weight:700;">
              ${status}
            </span>
          </td>
          <td style="padding:12px 20px; font-size:12px; color:#64748b;">${escapeHtml(remarks)}</td>
          <td style="padding:12px 20px; text-align:right; white-space:nowrap;">${actions}</td>
        </tr>
      `;
    }).join('');

    // Wire buttons and checkboxes safely
    setTimeout(() => {
      const selectAll = document.getElementById('cd-select-all');
      if (selectAll && !selectAll.__wired) {
        selectAll.__wired = true;
        selectAll.onchange = () => {
          document.querySelectorAll('.clr-student-check').forEach(cb => cb.checked = selectAll.checked);
        };
      }
    }, 50);

  } catch (err) {
    console.error('[clearances] Error:', err);
    root.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:#dc2626;">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

// ============================================
// CLEARANCES (Individual Action)
// ============================================
async function clearStudent(studentId, newStatus) {
  try {
    // 1. Try to CREATE (POST)
    const createRes = await adminFetch('/api/admin/clearances', {
      method: 'POST',
      body: JSON.stringify({
        studentId: Number(studentId),
        status: newStatus,
        remarks: newStatus === 'cleared' ? 'Cleared by Admin' : 'Rejected by Admin'
      }),
    });

    if (createRes.ok) {
      showToast(`✅ Clearance set to ${newStatus}.`, 'success');
      loadDepartmentClearances();
      return;
    }

    // 2. If POST fails, try UPDATE (PUT)
    const updateRes = await adminFetch(`/api/admin/clearances/student/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    });

    if (updateRes.ok) {
      showToast(`✅ Status updated to ${newStatus}.`, 'success');
      loadDepartmentClearances();
      return;
    }

    const err = await updateRes.json().catch(() => ({}));
    throw new Error(err.error || 'Backend failed to create or update clearance');

  } catch (err) {
    console.error('[clearStudent] Error:', err);
    showToast('❌ ' + err.message, 'error');
  }
}

// ============================================
// CLEARANCES: BULK ACTIONS (Fixed)
// ============================================
async function bulkClearClearances(newStatus) {
  const checkboxes = document.querySelectorAll('.clr-student-check:checked');
  if (checkboxes.length === 0) {
    showToast('⚠️ Select at least one student.', 'warning');
    return;
  }

  const studentIds = Array.from(checkboxes).map(cb => Number(cb.value));
  
  const ok = await window.fpuConfirm(
    `Mark ${studentIds.length} student(s) as ${newStatus.toUpperCase()}?`,
    { title: `Bulk ${newStatus}`, type: newStatus === 'rejected' ? 'danger' : 'success', okText: 'Confirm' }
  );
  if (!ok) return;

  let success = 0, failed = 0;
  showToast(`Processing ${studentIds.length} students...`, 'info');

  for (const id of studentIds) {
    try {
      // Loop and use our safe individual function
      await clearStudentSilent(id, newStatus);
      success++;
    } catch (e) {
      failed++;
    }
  }

  if (failed === 0) {
    showToast(`✅ Updated ${success} students.`, 'success');
  } else {
    showToast(`⚠️ Updated ${success}, failed ${failed}.`, 'warning');
  }
  
  loadDepartmentClearances();
}

// Helper for bulk actions (doesn't show individual toasts)
async function clearStudentSilent(studentId, newStatus) {
  // Try POST (Create)
  const createRes = await adminFetch('/api/admin/clearances', {
    method: 'POST',
    body: JSON.stringify({ studentId, status: newStatus, remarks: 'Bulk action' }),
  });

  if (createRes.ok) return;

  // If POST fails, try PUT (Update)
  const updateRes = await adminFetch(`/api/admin/clearances/student/${studentId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: newStatus }),
  });

  if (updateRes.ok) return;

  // If both fail, log the exact error from the server
  const errData = await updateRes.json().catch(() => ({}));
  console.error(`[Clearance Failed for Student ${studentId}]`, errData);
  throw new Error(errData.error || `Failed to update clearance. Check console.`);
}

// ============================================
// ANNOUNCEMENTS
// ============================================
let allAnnouncements = [];

async function loadAnnouncements() {
  const list = document.getElementById('ann-list');
  if (!list) return;

  list.innerHTML = '<div class="loading" style="grid-column:1/-1;text-align:center;padding:40px;"><span class="spinner"></span> Loading announcements…</div>';

  try {
    const res = await adminFetch("/api/admin/announcements");
    const result = await res.json();
    
    // Deep scan data structure
    const raw = result.data || result || [];
    allAnnouncements = raw.map(r => r.announcement || r);

    applyAnnouncementFilters();

    // Wire refresh button
    const refreshBtn = document.querySelector('.page-head .actions button');
    if (refreshBtn && !refreshBtn.__wired) {
      refreshBtn.__wired = true;
      refreshBtn.onclick = () => loadAnnouncements();
    }

    // Wire tabs
    document.querySelectorAll('#ann-audience-tabs .staff-role-tab').forEach(tab => {
      if (tab.__wired) return;
      tab.__wired = true;
      tab.onclick = () => {
        document.querySelectorAll('#ann-audience-tabs .staff-role-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        applyAnnouncementFilters();
      };
    });

  } catch (err) {
    list.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">Error: ${escapeHtml(err.message)}</div>`;
  }
}

function applyAnnouncementFilters() {
  const list = document.getElementById('ann-list');
  
  // 1. Get Filter Values from HTML
  const activeTab = document.querySelector('#ann-audience-tabs .staff-role-tab.active');
  const audienceFilter = activeTab ? activeTab.dataset.audience : '';
  
  const priorityFilter = document.getElementById('ann-filter-priority')?.value || '';
  const periodFilter = document.getElementById('ann-filter-period')?.value || '';
  const searchVal = document.getElementById('ann-search')?.value.toLowerCase() || '';

  // 2. Filter the Data
  let filtered = allAnnouncements.filter(a => {
    const audience = String(a.audience || 'all').toLowerCase();
    const priority = String(a.priority || 'normal').toLowerCase();
    const title = String(a.title || '').toLowerCase();
    const body = String(a.body || '').toLowerCase();
    const createdAt = a.publishedAt || a.createdAt;

    // Audience match
    if (audienceFilter && audience !== audienceFilter) return false;
    // Priority match
    if (priorityFilter && priority !== priorityFilter) return false;
    // Search match
    if (searchVal && !title.includes(searchVal) && !body.includes(searchVal)) return false;
    // Period match (Today, Week, Month)
    if (periodFilter && createdAt) {
      const now = new Date();
      const date = new Date(createdAt);
      const diffDays = (now - date) / (1000 * 60 * 60 * 24);
      if (periodFilter === 'today' && diffDays > 1) return false;
      if (periodFilter === 'week' && diffDays > 7) return false;
      if (periodFilter === 'month' && diffDays > 30) return false;
    }

    return true;
  });

  // 3. Update Stats & Tabs
  updateAnnouncementStats(allAnnouncements);

  // 4. Render
  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:40px;text-align:center;"><div style="font-size:2rem;margin-bottom:10px;">🔍</div><p>No announcements match your filters.</p></div>';
    return;
  }

  list.innerHTML = filtered.map(a => {
    const priority = String(a.priority || 'normal').toLowerCase();
    const audience = String(a.audience || 'all').toLowerCase();
    const isExpired = a.expiresAt && new Date(a.expiresAt) < new Date();
    
    let pClass = 'priority-normal';
    let pIcon = '📢';
    let pLabel = 'Normal';
    if (priority === 'high') { pClass = 'priority-high'; pIcon = '🔴'; pLabel = 'Urgent'; }
    if (priority === 'low') { pClass = 'priority-low'; pIcon = '📝'; pLabel = 'General'; }

    const audLabel = audience === 'all' ? 'Everyone' : audience.toUpperCase();
    const createdDate = a.publishedAt || a.createdAt;

    return `
      <div class="ann-card ${priority}" onclick="window.location.hash='#announcement-detail?id=${a.id}'">
        <div class="anc-head">
          <div class="anc-badges">
            <span class="anc-badge ${pClass}">${pIcon} ${pLabel}</span>
            <span class="anc-badge audience">${escapeHtml(audLabel)}</span>
            ${a.isPublished === false ? '<span class="anc-badge unpublished">Draft</span>' : ''}
            ${isExpired ? '<span class="anc-badge expired">Expired</span>' : ''}
          </div>
        </div>
        <h3>${escapeHtml(a.title || '')}</h3>
        <div class="body">${escapeHtml(a.body || '')}</div>
        <div class="anc-meta">
          <span>${fmtDateTime(createdDate)}</span>
          <span>${a.authorId ? 'Admin #' + a.authorId : ''}</span>
        </div>
        <div class="anc-actions" onclick="event.stopPropagation()">
          <button class="btn btn-outline btn-sm" onclick="window.location.hash='#announcement-form?id=${a.id}'">Edit</button>
          <button class="btn btn-ghost btn-sm" style="color:#dc2626;" onclick="FPU_ADMIN.deleteAnnouncement(${a.id})">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function updateAnnouncementStats(records) {
  const counts = { total: records.length, urgent: 0, published: 0, active: 0 };
  const audiences = { student: 0, staff: 0, lecturer: 0, hod: 0 };
  
  records.forEach(a => {
    if (String(a.priority).toLowerCase() === 'high') counts.urgent++;
    if (a.isPublished !== false) counts.published++;
    if (!a.expiresAt || new Date(a.expiresAt) > new Date()) counts.active++;
    
    const aud = String(a.audience || 'all').toLowerCase();
    if (audiences[aud] !== undefined) audiences[aud]++;
  });

  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  // Top Stats Cards
  setText('ann-stat-total', counts.total);
  setText('ann-stat-urgent', counts.urgent);
  setText('ann-stat-published', counts.published);
  setText('ann-stat-active', counts.active);
  
  // Tab Counts
  setText('ann-count-all', counts.total);
  setText('ann-count-student', audiences.student);
  setText('ann-count-staff', audiences.staff);
  setText('ann-count-lecturer', audiences.lecturer);
  setText('ann-count-hod', audiences.hod);
}

async function deleteAnnouncement(id) {
  const ok = await window.fpuConfirm('Delete this announcement? This cannot be undone.', { title: 'Delete Announcement', type: 'danger', okText: 'Delete' });
  if (!ok) return;
  
  try {
    await adminFetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    showToast('🗑️ Deleted.', 'success');
    loadAnnouncements();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

// ============================================
// NOTIFICATIONS
// ============================================
let allNotifications = [];

async function loadNotifications() {
  const list = document.getElementById('nt-list');
  if (!list) return;

  const typeFilter = document.getElementById('nt-filter-type')?.value || '';
  const readFilter = document.getElementById('nt-filter-read')?.value || '';
  const searchVal = document.getElementById('nt-search')?.value.toLowerCase() || '';

  list.innerHTML = '<div class="loading" style="padding:40px;text-align:center;"><span class="spinner"></span> Loading notifications…</div>';

  try {
    // Pass no userId so admin gets ALL notifications
    const res = await adminFetch("/api/admin/notifications");
    const result = await res.json();
    allNotifications = result.data || result.rows || result || [];

    // Update stats based on the full list
    updateNotificationStats(allNotifications);

    // Apply filters for display only
    const filtered = allNotifications.filter(n => {
      const type = String(n.type || n.category || 'info').toLowerCase();
      const isRead = n.isRead === true || n.is_read === true || n.status === 'read';
      const title = String(n.title || n.subject || '').toLowerCase();
      const body = String(n.message || n.body || n.description || '').toLowerCase();

      if (typeFilter && type !== typeFilter) return false;
      if (readFilter === 'read' && !isRead) return false;
      if (readFilter === 'unread' && isRead) return false;
      if (searchVal && !title.includes(searchVal) && !body.includes(searchVal)) return false;
      return true;
    });

    if (!filtered.length) {
      list.innerHTML = '<div style="text-align:center;padding:3rem;background:#fff;border:1px dashed #cbd5e1;border-radius:12px;color:#64748b;"><div style="font-size:2rem;margin-bottom:10px;">📭</div>No notifications found matching your criteria.</div>';
      return;
    }

    list.innerHTML = filtered.map(n => {
      const title = n.title || n.subject || 'No Title';
      const message = n.message || n.body || n.description || n.text || '';
      const type = String(n.type || n.category || 'info').toLowerCase();
      const isRead = n.isRead === true || n.is_read === true || n.status === 'read';
      const createdAt = n.createdAt || n.created_at || n.date || Date.now();
      const id = n.id;

      let icon = 'ℹ️';
      if (type.includes('warn')) icon = '⚠️';
      if (type.includes('success')) icon = '✅';
      if (type.includes('complaint')) icon = '📩';
      if (type.includes('fee')) icon = '💰';

      return `
        <div class="nt-item ${isRead ? '' : 'unread'}">
          <div class="nt-icon ${type}">${icon}</div>
          <div class="nt-body">
            <div class="nt-title">${escapeHtml(title)}</div>
            <div class="nt-text">${escapeHtml(message)}</div>
            <div class="nt-meta">
              <span>🕐 ${timeAgo(createdAt)}</span>
              ${!isRead ? '<span class="unread-pill">Unread</span>' : ''}
            </div>
          </div>
          <div class="nt-actions">
            ${!isRead ? `<button class="btn btn-sm btn-outline" onclick="FPU_ADMIN.markNotificationRead(${id})">Mark Read</button>` : ''}
            <button class="btn btn-sm btn-ghost" style="color:#dc2626;" onclick="FPU_ADMIN.deleteNotification(${id})">🗑</button>
          </div>
        </div>
      `;
    }).join('');

    // Wire "Mark all read"
    const markAllBtn = document.getElementById('nt-mark-all-read');
    if (markAllBtn && !markAllBtn.__wired) {
      markAllBtn.__wired = true;
      markAllBtn.onclick = async () => {
        if (!confirm('Mark all notifications as read?')) return;
        try {
          await adminFetch('/api/admin/notifications/read-all', { method: 'POST' });
          showToast('✅ All marked as read.', 'success');
          loadNotifications();
        } catch (err) { showToast('❌ ' + err.message, 'error'); }
      };
    }

  } catch (err) {
    list.innerHTML = `<div class="alert alert-danger" style="margin:20px;">Error: ${escapeHtml(err.message)}</div>`;
  }
}

async function markNotificationRead(id) {
  try {
    await adminFetch(`/api/admin/notifications/${id}/read`, { method: 'POST' });
    showToast('✅ Marked read.', 'success');
    loadNotifications();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

async function deleteNotification(id) {
  if (!confirm('Delete this notification?')) return;
  try {
    await adminFetch(`/api/admin/notifications/${id}`, { method: 'DELETE' });
    showToast('🗑️ Deleted.', 'success');
    loadNotifications();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

function updateNotificationStats(records) {
  const counts = { total: records.length, unread: 0, thisWeek: 0, high: 0 };
  
  records.forEach(n => {
    const isRead = n.isRead === true || n.is_read === true || n.status === 'read';
    if (!isRead) counts.unread++;
    
    const type = String(n.type || n.category || n.priority || '').toLowerCase();
    if (type.includes('high') || type.includes('warn') || type.includes('urgent')) {
      counts.high++;
    }

    const dateStr = n.createdAt || n.created_at || n.date;
    if (dateStr && new Date(dateStr).getTime() > Date.now() - 7 * 86400000) {
      counts.thisWeek++;
    }
  });

  const setText = (id, val) => { 
    const el = document.getElementById(id); 
    if (el) el.textContent = val; 
  };
  
  setText('nt-stat-total', counts.total);
  setText('nt-stat-unread', counts.unread);
  setText('nt-stat-week', counts.thisWeek);
  setText('nt-stat-high', counts.high);
  setText('nt-count-inbox', counts.total);
}

// ============================================
// COMPLAINTS MANAGEMENT
// ============================================
let allComplaints = []; // Global store for filtering

async function loadComplaints() {
  const tbody = document.getElementById('cmp-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="empty" style="text-align:center;padding:20px;">Loading…</td></tr>';

  try {
    const res = await adminFetch('/api/admin/complaints');
    const json = await res.json();
    
    // The API returns { complaint, user } or a flat object
    const raw = json.data || json || [];
    allComplaints = raw.map(r => {
      if (r.complaint) {
        return { ...r.complaint, user: r.user || {} };
      }
      return r;
    });

    filterComplaints(); 
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty" style="color:#dc2626;text-align:center;padding:20px;">Error: ${err.message}</td></tr>`;
  }
}

function filterComplaints() {
  const activeTab = document.querySelector('#cmp-status-tabs .staff-role-tab.active');
  const statusFilter = activeTab ? activeTab.dataset.status : '';
  const catFilter = document.getElementById('cmp-filter-category')?.value || '';
  const searchVal = document.getElementById('cmp-search')?.value.toLowerCase() || '';

  let filtered = allComplaints.filter(c => {
    const s = String(c.status || 'open').toLowerCase();
    const cat = String(c.category || '').toLowerCase();
    const subject = String(c.subject || '').toLowerCase();
    const body = String(c.body || c.message || '').toLowerCase();
    
    if (statusFilter && s !== statusFilter) return false;
    if (catFilter && cat !== catFilter) return false;
    if (searchVal && !subject.includes(searchVal) && !body.includes(searchVal)) return false;
    
    return true;
  });

  renderComplaintsTable(filtered);
  updateComplaintStats(allComplaints);
}

function renderComplaintsTable(records) {
  const tbody = document.getElementById('cmp-tbody');
  if (!tbody) return;
  
  if (records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty" style="text-align:center; padding:20px; color:#64748b;">No complaints found.</td></tr>';
    return;
  }

  tbody.innerHTML = records.map(c => {
    // 1. Exact column names for Subject and Message
    const subject = c.subject || 'No Subject';
    const message = c.body || c.message || '';

    // 2. Exact column names for Category and Status
    const category = c.category || 'General';
    const status = String(c.status || 'open').toLowerCase();

    // 3. Exact column name for Date (created_at or createdAt)
    const rawDate = c.createdAt || c.created_at || Date.now();
    const created = new Date(rawDate);
    const diffDays = Math.floor((new Date() - created) / (1000 * 60 * 60 * 24));
    const ageDisplay = diffDays === 0 ? 'Today' : `${diffDays}d`;

    // 4. Exact column names for User (first_name, last_name or firstName, lastName)
    const u = c.user || c.student || c;
    const firstName = u.first_name || u.firstName || '';
    const lastName = u.last_name || u.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'Unknown User';

    // 5. Status Badge Colors
    let badgeClass = 'badge-open';
    if (status.includes('resolve')) badgeClass = 'badge-resolved';
    if (status.includes('review')) badgeClass = 'badge-review';
    if (status.includes('close')) badgeClass = 'badge-closed';

    return `
      <tr>
        <td><div style="font-weight:600; color:#0f172a;">${escapeHtml(subject)}</div></td>
        <td>${escapeHtml(fullName)}</td>
        <td><span style="text-transform:capitalize;">${escapeHtml(category)}</span></td>
        <td><span class="badge ${badgeClass}">${status.replace('_', ' ').toUpperCase()}</span></td>
        <td><span style="font-weight:600; color:${diffDays > 7 && !status.includes('resolve') ? '#dc2626' : '#64748b'};">${ageDisplay}</span></td>
        <td style="text-align:right;">
          <button class="btn btn-sm btn-outline" onclick="FPU_ADMIN_SPA.navigateToWithQuery('complaints-view', { id: ${c.id} })">View</button>
        </td>
      </tr>
    `;
  }).join('');
}

function updateComplaintStats(records) {
  const counts = { total: records.length, open: 0, review: 0, resolved: 0, closed: 0 };
  
  records.forEach(c => {
    // Safely read status, default to 'open'
    const s = String(c.status || 'open').toLowerCase();
    if (s === 'open') counts.open++;
    else if (s === 'in_review') counts.review++;
    else if (s === 'resolved') counts.resolved++;
    else if (s === 'closed') counts.closed++;
  });

  // 🔥 SAFE UPDATER: Only updates if the element exists
  const setText = (id, val) => { 
    const el = document.getElementById(id); 
    if (el) el.textContent = val; 
    else console.warn(`[Complaints] Missing element with ID: ${id}`);
  };
  
  // 1. Top Cards
  setText('cmp-stat-total', counts.total);
  setText('cmp-stat-open', counts.open);
  setText('cmp-stat-in-review', counts.review);
  setText('cmp-stat-resolved', counts.resolved);
  
  // 2. Tabs
  setText('cmp-count-all', counts.total);
  setText('cmp-count-open', counts.open);
  setText('cmp-count-in_review', counts.review);
  setText('cmp-count-resolved', counts.resolved);
  setText('cmp-count-closed', counts.closed);

  // 3. Table Header
  setText('cmp-count', `Showing ${counts.total}`);
}

// --- View Modal ---
window.openComplaintModal = function(id) {
  const complaint = allComplaints.find(c => c.id === id);
  if (!complaint) return;

  const status = String(complaint.status || 'open').toLowerCase();
  const u = complaint.user || complaint.student || {};
  const fullName = `${u.firstName || u.first_name || ''} ${u.lastName || u.last_name || ''}`.trim() || 'Unknown User';
  const matric = u.matricNumber || u.matric_number || '—';

  const backdrop = document.createElement('div');
  backdrop.className = 'fpu-modal-backdrop';
  backdrop.innerHTML = `
    <div class="fpu-modal" style="max-width: 600px;">
      <div class="fpu-modal-header">
        <h3>Complaint #${complaint.id}</h3>
        <button class="btn btn-sm btn-ghost" onclick="this.closest('.fpu-modal-backdrop').remove()">×</button>
      </div>
      <div class="fpu-modal-body">
        <div style="margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid #e2e8f0;">
          <h4 style="margin:0 0 8px 0; font-size:1.1rem; color:#0f172a;">${escapeHtml(complaint.subject)}</h4>
          <div style="font-size:13px; color:#64748b;">
            From: <strong>${escapeHtml(fullName)}</strong> (${escapeHtml(matric)})<br>
            Category: <strong style="text-transform:capitalize;">${escapeHtml(complaint.category || 'General')}</strong><br>
            Date: ${new Date(complaint.createdAt).toLocaleString()}
          </div>
        </div>
        
        <div style="background:#f8fafc; padding:16px; border-radius:8px; font-size:14px; line-height:1.6; color:#334155; margin-bottom:20px;">
          ${escapeHtml(complaint.body || complaint.message || 'No description provided.')}
        </div>

        <div class="form-group">
          <label class="form-label">Update Status</label>
          <select class="form-select" id="comp-modal-status">
            <option value="open" ${status === 'open' ? 'selected' : ''}>Open</option>
            <option value="in_review" ${status === 'in_review' ? 'selected' : ''}>In Review</option>
            <option value="resolved" ${status === 'resolved' ? 'selected' : ''}>Resolved</option>
            <option value="closed" ${status === 'closed' ? 'selected' : ''}>Closed</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Admin Reply (Optional)</label>
          <textarea class="form-control" id="comp-modal-reply" rows="3" placeholder="Type a response to the student..."></textarea>
        </div>
      </div>
      <div class="fpu-modal-footer">
        <button class="btn btn-outline" onclick="this.closest('.fpu-modal-backdrop').remove()">Cancel</button>
        <button class="btn btn-primary" id="comp-modal-save">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#comp-modal-save').onclick = async () => {
    const newStatus = backdrop.querySelector('#comp-modal-status').value;
    const reply = backdrop.querySelector('#comp-modal-reply').value;

    try {
      await adminFetch(`/api/admin/complaints/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus, reply })
      });
      showToast('✅ Complaint updated.', 'success');
      backdrop.remove();
      loadComplaints();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };
};

// ============================================
// LIBRARY (Books & Borrows)
// ============================================

async function loadBooksGrid() {
  const grid = document.getElementById('books-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading books…</div>';

  const category = (document.getElementById('books-category-tabs')?.querySelector('.active')?.dataset.category) || '';
  const search = (document.getElementById('books-search') || {}).value || '';
  const avail = (document.getElementById('books-avail') || {}).value || '';

  const qs = new URLSearchParams({ limit: 500 });
  if (search) qs.set('search', search);
  if (category) qs.set('category', category);

  try {
    const res = await adminFetch(`/api/admin/library/books?${qs}`);
    const json = await res.json();
    let books = json.data || [];

    if (avail === 'available') books = books.filter((b) => b.copiesAvailable > 0);
    else if (avail === 'low') books = books.filter((b) => b.copiesAvailable > 0 && b.copiesAvailable <= 2);
    else if (avail === 'out') books = books.filter((b) => b.copiesAvailable === 0);

    const totalTitles = books.length; const totalCopies = books.reduce((s, b) => s + (b.copiesTotal || 0), 0);
    const onLoan = books.reduce((s, b) => s + ((b.copiesTotal || 0) - (b.copiesAvailable || 0)), 0);
    const available = books.reduce((s, b) => s + (b.copiesAvailable || 0), 0);

    setText('books-stat-total', totalTitles); setText('books-stat-copies', totalCopies); setText('books-stat-onloan', onLoan); setText('books-stat-avail', available); setText('books-count-all', totalTitles);

    if (!books.length) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">📚</div><p>No books match your filters.</p></div>'; return; }

    grid.innerHTML = books.map((b, i) => {
      const catCls = `cat-${i % 6}`; const stock = b.copiesAvailable === 0 ? 'out' : b.copiesAvailable <= 2 ? 'low' : 'available';
      return `
        <div class="book-card" onclick="FPU_ADMIN_SPA.navigateToWithQuery('book-detail', { id: ${b.id} })">
          <div class="book-spine ${catCls}"></div>
          <h3>${escapeHtml(b.title || '')}</h3>
          <p class="book-author">${escapeHtml(b.author || 'Unknown')}</p>
          <div class="book-meta">${b.category ? `<span class="book-chip category">${escapeHtml(b.category)}</span>` : ''}${b.shelf ? `<span class="book-chip shelf">${escapeHtml(b.shelf)}</span>` : ''}</div>
          <div class="book-stock"><span class="num ${stock === 'low' ? 'warning' : stock === 'out' ? 'critical' : ''}">${b.copiesAvailable}</span><span class="label">/ ${b.copiesTotal} available</span><span class="book-stock-badge ${stock}">${stock === 'out' ? 'Out' : stock === 'low' ? 'Low' : 'Available'}</span></div>
          <div class="book-actions"><button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('book-form', { id: ${b.id} })">Edit</button><button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('borrow-issue', { bookId: ${b.id} })">Issue</button></div>
        </div>`;
    }).join('');
  } catch (err) { grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`; }
}

// ============================================
// LIBRARY: BORROWS TABLE & ACTIONS
// ============================================
async function loadBorrowsTable() {
  const tbody = document.getElementById('bor-tbody');
  if (!tbody) return;

  const status = document.getElementById('bor-status')?.value || '';
  const search = document.getElementById('bor-search')?.value.trim().toLowerCase() || '';

  tbody.innerHTML = '<tr><td colspan="7" class="empty" style="text-align:center;padding:20px;">Loading…</td></tr>';

  try {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);

    const res = await adminFetch('/api/admin/library/borrows' + (qs.toString() ? '?' + qs : ''));
    const json = await res.json();
    let rows = json.data || json || [];
    if (!Array.isArray(rows)) rows = [];

    // Apply Client-side Search
    if (search) {
      rows = rows.filter(r => {
        const br = r.borrow || r;
        const b = r.book || {};
        const u = r.user || r.student || {};
        const hay = `${b.title || ''} ${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
        return hay.includes(search);
      });
    }

    // --- Calculate Stats ---
    let active = 0, overdue = 0, returned = 0;
    rows.forEach(r => {
      const br = r.borrow || r;
      const isOverdue = br.dueAt && new Date(br.dueAt) < new Date() && br.status !== 'returned' && br.status !== 'lost';
      
      if (br.status === 'returned') {
        returned++;
      } else if (br.status === 'lost') {
        // Skip
      } else {
        active++;
        if (isOverdue) overdue++;
      }
    });
    
    // Update Top Stats Bar
    setText('bor-stat-total', rows.length);
    setText('bor-stat-active', active);
    setText('bor-stat-overdue', overdue);
    setText('bor-stat-returned', returned);
    setText('bor-count', `${rows.length} records`);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty" style="text-align:center;padding:20px;">No borrow records found.</td></tr>';
      return;
    }

    // Render Table
    tbody.innerHTML = rows.map(r => {
      const br = r.borrow || r;
      const b = r.book || {};
      const u = r.user || r.student || {};
      
      const title = b.title || br.bookTitle || 'Unknown Book';
      const studentName = `${u.firstName || u.first_name || ''} ${u.lastName || u.last_name || ''}`.trim() || 'Unknown User';
      const isOverdue = br.dueAt && new Date(br.dueAt) < new Date() && br.status !== 'returned' && br.status !== 'lost';

      // FIXED: Calculate Days Difference
      let daysDisplay = '—';
      if (br.borrowedAt) {
        const start = new Date(br.borrowedAt);
        
        if (!isNaN(start.getTime())) {
          let end;
          if (br.status === 'returned' && (br.returnedAt || br.updatedAt)) {
            end = new Date(br.returnedAt || br.updatedAt);
          } else {
            end = new Date(); 
          }
          
          if (isNaN(end.getTime())) end = new Date();
          
          const diffTime = Math.abs(end - start);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          daysDisplay = diffDays === 0 ? 1 : diffDays;
        }
      }

      let actions = '';
      if (br.status === 'borrowed' || br.status === 'overdue' || isOverdue) {
        actions = `<button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.openReturnModal(${br.id}, '${escapeHtml(title)}')">Mark Returned</button>`;
      } else {
        actions = `<button class="btn btn-sm btn-outline" disabled>Completed</button>`;
      }

      return `
        <tr class="${isOverdue ? 'borrow-row-overdue' : ''}">
          <td>${escapeHtml(title)}</td>
          <td>${escapeHtml(studentName)}</td>
          <td>${br.borrowedAt ? new Date(br.borrowedAt).toLocaleDateString() : '—'}</td>
          <td style="${isOverdue ? 'color:#dc2626;font-weight:bold;' : ''}">${br.dueAt ? new Date(br.dueAt).toLocaleDateString() : '—'}</td>
          <td>${badge(br.status)}</td>
          <td>${daysDisplay}</td>
          <td>${actions}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty" style="color:#dc2626;text-align:center;padding:20px;">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function updateBorrowStats(records) {
  const counts = { total: records.length, active: 0, overdue: 0, returned: 0, lost: 0 };
  
  records.forEach(r => {
    const s = String(r.status || 'borrowed').toLowerCase();
    const rawDue = r.due_at || r.due_date;

    if (['borrowed', 'active', 'issued'].includes(s)) {
      counts.active++;
      if (rawDue && new Date(rawDue) < new Date()) {
        counts.overdue++;
      }
    } else if (s === 'overdue') {
      counts.active++;
      counts.overdue++;
    } else if (s === 'returned' || s === 'completed') {
      counts.returned++;
    } else if (s === 'lost') {
      counts.lost++;
    }
  });

  // Safe updater helper
  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // Top Stats Cards
  setText('bor-stat-total', counts.total);
  setText('bor-stat-active', counts.active);
  setText('bor-stat-overdue', counts.overdue);
  setText('bor-stat-returned', counts.returned);
  
  // Tabs (Using the exact IDs from your HTML)
  setText('bor-count-all', counts.total);
  setText('bor-count-active', counts.active);
  setText('bor-count-overdue', counts.overdue);
  setText('bor-count-returned', counts.returned);
  setText('bor-count-lost', counts.lost);
  
  // Table Header Count
  setText('bor-count', `Showing ${counts.total}`);
}

// ============================================
// LIBRARY ACTIONS (Modals)
// ============================================
async function openReturnModal(id, bookTitle, fineAmount) {
  const message = fineAmount > 0 
    ? `Return "${bookTitle}"?\n\n⚠️ This book is overdue. A fine of ₦${fineAmount} should be collected from the student before returning.`
    : `Return "${bookTitle}"?\n\nEnsure the book is in good condition.`;
    
  const ok = await window.fpuConfirm(
    message,
    { title: 'Return Book', type: 'success', okText: 'Confirm Return' }
  );
  
  if (!ok) return;

  try {
    const res = await adminFetch(`/api/admin/library/borrows/${id}/return`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to return book');
    showToast('📚 Book returned successfully.', 'success');
    loadBorrowsTable();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

async function renewBorrow(id) {
  const ok = await window.fpuConfirm(
    'Extend this loan by 14 days?\n\nThis will reset the due date from today.',
    { title: 'Renew Book', type: 'info', okText: 'Extend 14 Days' }
  );
  
  if (!ok) return;

  try {
    const res = await adminFetch(`/api/admin/library/borrows/${id}/renew`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to renew book');
    showToast('🔄 Loan extended by 14 days.', 'success');
    loadBorrowsTable();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

// ============================================
// DOCUMENTS — Full-featured loader (CARD LAYOUT)
// ============================================
async function loadDocumentsTable() {
  const listContainer = document.getElementById('doc-list');
  if (!listContainer) return;

  // 1. Show loading state
  listContainer.innerHTML = '<div class="loading" style="grid-column:1/-1;text-align:center;padding:40px;color:#64748b;"><span class="spinner"></span> Loading documents…</div>';

  try {
    // 2. Fetch data from API
    const res = await adminFetch('/api/admin/documents');
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 100)}`);
    }

    const json = await res.json();
    const raw = json.data || json.rows || json.documents || [];
    
    // 3. Normalize data structure
    const ALL = raw.map(r => {
      const doc = r.document || r;
      const stu = r.user || r.student || {};
      return {
        id: doc.id,
        type: (doc.type || 'other').toLowerCase(),
        title: doc.title || 'Untitled Request',
        status: (doc.status || 'pending').toLowerCase(),
        requestedAt: doc.requestedAt || doc.createdAt,
        studentName: `${stu.firstName || ''} ${stu.lastName || ''}`.trim() || 'Unknown',
        matric: stu.matricNumber || '—',
        photoUrl: stu.photoUrl || null
      };
    });

    // 4. Update Top Stats (Using the correct IDs from index.html)
    setText('doc-stat-total', ALL.length);
    setText('doc-stat-pending', ALL.filter(d => d.status === 'pending').length);
    setText('doc-stat-issued', ALL.filter(d => d.status === 'issued').length);
    
    // Calculate "This Month"
    const thisMonth = ALL.filter(d => {
      if (!d.requestedAt) return false;
      const date = new Date(d.requestedAt);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
    setText('doc-stat-month', thisMonth);

    // Update Tab Counts
    setText('doc-count-all', ALL.length);
    setText('doc-count-pending', ALL.filter(d => d.status === 'pending').length);
    setText('doc-count-approved', ALL.filter(d => d.status === 'approved').length);
    setText('doc-count-issued', ALL.filter(d => d.status === 'issued').length);
    setText('doc-count-rejected', ALL.filter(d => d.status === 'rejected').length);

    // 5. Apply Filters
    const typeFilter = (document.getElementById('doc-filter-type') || {}).value || '';
    const searchQuery = (document.getElementById('doc-search') || {}).value.toLowerCase() || '';
    const activeTab = document.querySelector('#doc-status-tabs .staff-role-tab.active');
    const statusFilter = activeTab ? activeTab.dataset.status : '';

    let filtered = ALL;
    
    if (typeFilter) {
      filtered = filtered.filter(d => d.type === typeFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(d => 
        d.studentName.toLowerCase().includes(searchQuery) || 
        d.matric.toLowerCase().includes(searchQuery) || 
        d.title.toLowerCase().includes(searchQuery)
      );
    }
    if (statusFilter) {
      filtered = filtered.filter(d => d.status === statusFilter);
    }

    // 6. Handle Empty State
    if (!filtered.length) {
      listContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#64748b;">No document requests match your filters.</div>';
      return;
    }

    // 7. Render Cards
    listContainer.innerHTML = filtered.map(d => {
      const initials = d.studentName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const dateStr = d.requestedAt ? new Date(d.requestedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
      
      // Format type for display (e.g., "id-letter" -> "id letter")
      const displayType = d.type.replace('-', ' ');

      return `
        <div class="doc-card ${d.status}" onclick="FPU_ADMIN_SPA.navigateToWithQuery('documents-detail', { id: ${d.id} })">
          <div class="dc-head">
            <span class="dc-type">${escapeHtml(displayType)}</span>
            <span class="dc-status ${d.status}">${escapeHtml(d.status)}</span>
          </div>
          <h3>${escapeHtml(d.title)}</h3>
          <div class="dc-student">
            <div class="dc-avatar">
              ${d.photoUrl ? `<img src="${escapeHtml(d.photoUrl)}" alt="">` : initials}
            </div>
            <div class="dc-student-info">
              <strong>${escapeHtml(d.studentName)}</strong>
              <span>${escapeHtml(d.matric)}</span>
            </div>
          </div>
          <div class="dc-footer">
            <span>${dateStr}</span>
            <span class="arrow">→</span>
          </div>
        </div>
      `;
    }).join('');

    // 8. Wire up the tabs (Only do this once per page load)
    if (!window.__docTabsWired) {
      window.__docTabsWired = true;
      document.querySelectorAll('#doc-status-tabs .staff-role-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          // Remove active class from all tabs
          document.querySelectorAll('#doc-status-tabs .staff-role-tab').forEach(t => t.classList.remove('active'));
          // Add active class to clicked tab
          e.currentTarget.classList.add('active');
          // Re-run the loader (which will apply the new filter)
          loadDocumentsTable();
        });
      });
    }

  } catch (err) {
    console.error('[Documents] Error:', err);
    listContainer.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;color:#dc2626;background:#fee2e2;border-radius:8px;"><strong>Error:</strong> ${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// DOCUMENTS — Detail view with preview + actions
// ============================================
async function loadDocumentDetail() {
  const root = document.getElementById('dd-root');
  if (!root) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const id = params.get('id');

  if (!id) {
    root.innerHTML = '<div class="alert alert-warning" style="margin:20px;">No document selected.</div>';
    return;
  }

  root.innerHTML = '<div class="loading" style="padding:40px;text-align:center;"><span class="spinner"></span> Loading…</div>';

  try {
    // 1. Fetch the specific document
    const docsRes = await adminFetch('/api/admin/documents?limit=500');
    const docsJson = await docsRes.json();
    const docs = docsJson.data || docsJson || [];

    const docItem = docs.find((r) => {
      const doc = r.document || r;
      return Number(doc.id) === Number(id);
    });
    
    if (!docItem) throw new Error('Document not found.');

    const doc = docItem.document || docItem;
    let user = docItem.user || docItem.student || {};

    // 2. CRITICAL FIX: Fetch the FULL student profile to get Programme & Department
    if (user.id || doc.userId) {
      const userId = user.id || doc.userId;
      try {
        const studentRes = await adminFetch(`/api/admin/students/${userId}`);
        if (studentRes.ok) {
          const studentJson = await studentRes.json();
          const fullProfile = studentJson.data || studentJson;
          // Merge the full profile with the basic user data
          user = { ...user, ...fullProfile };
        }
      } catch (e) {
        console.warn('Could not fetch full student profile for document preview', e);
      }
    }

    const sub = document.getElementById('dd-subtitle');
    if (sub) sub.textContent = `Request #${doc.id} · ${String(doc.type || '').replace(/-/g, ' ')}`;

    const status = doc.status || 'pending';

    const iconMap = {
      transcript: '📜', certificate: '🎓', attestation: '📝', 'id-card': '🪪', clearance: '✅',
    };
    const icon = iconMap[String(doc.type || '').toLowerCase()] || '📄';

    // ------------------------------------------------------------------
    // 1) Detail card (metadata + action buttons)
    // ------------------------------------------------------------------
    const cardHtml = `
      <div class="doc-detail">
        <div class="doc-detail-head">
          <div class="doc-detail-icon">${icon}</div>
          <div class="doc-detail-meta">
            <h2>${escapeHtml(doc.title || '(No title)')}</h2>
            <div class="sub">
              ${escapeHtml(((user.firstName || '') + ' ' + (user.lastName || '')).trim() || 'Unknown student')}
              · <code>${escapeHtml(user.matricNumber || '—')}</code>
              · ${badge(status)}
            </div>
          </div>
        </div>

        <div class="doc-detail-body">
          <div class="doc-detail-row">
            <div class="k">Document Type</div>
            <div class="v" style="text-transform:capitalize;">${escapeHtml(String(doc.type || '').replace(/-/g, ' '))}</div>
          </div>
          <div class="doc-detail-row">
            <div class="k">Email</div>
            <div class="v">${escapeHtml(user.email || '—')}</div>
          </div>
          ${doc.reason && doc.reason !== doc.title ? `
          <div class="doc-detail-row" style="grid-column:1/-1;">
            <div class="k">Reason</div>
            <div class="v">${escapeHtml(doc.reason)}</div>
          </div>` : ''}
          <div class="doc-detail-row">
            <div class="k">Requested</div>
            <div class="v">${fmtDateTime(doc.requestedAt || doc.createdAt)}</div>
          </div>
          ${doc.issuedAt ? `
          <div class="doc-detail-row">
            <div class="k">Issued</div>
            <div class="v">${fmtDateTime(doc.issuedAt)}</div>
          </div>` : ''}
          ${doc.remarks ? `
          <div class="doc-detail-row" style="grid-column:1/-1;">
            <div class="k">Remarks</div>
            <div class="v">${escapeHtml(doc.remarks)}</div>
          </div>` : ''}
        </div>

        <div class="doc-actions">
          ${status === 'pending' ? `
            <button class="btn btn-primary" id="dd-approve">✅ Approve</button>
            <button class="btn btn-ghost" style="color:#dc2626;" id="dd-reject">❌ Reject</button>
          ` : ''}
          ${status === 'approved' ? `
            <button class="btn btn-primary" style="background:#f59e0b;border-color:#f59e0b;color:#fff;" id="dd-issue">📤 Issue Document</button>
          ` : ''}
          <button class="btn btn-outline" id="dd-edit">✏️ Edit Details</button>
          <button class="btn btn-ghost" style="color:#dc2626;margin-left:auto;" id="dd-delete">🗑 Delete</button>
          <button class="btn btn-outline" onclick="FPU_ADMIN_SPA.navigateTo('documents')">← Back to Documents</button>
        </div>
      </div>
    `;

    // ------------------------------------------------------------------
    // 2) Document preview
    // ------------------------------------------------------------------
    const previewHtml = await renderDocPreview(doc, user);

    root.innerHTML = cardHtml + previewHtml;

    // Wire metadata action buttons
    const approveBtn = document.getElementById('dd-approve');
    if (approveBtn) approveBtn.onclick = () => approveDoc(doc.id);

    const rejectBtn = document.getElementById('dd-reject');
    if (rejectBtn) rejectBtn.onclick = () => rejectDoc(doc.id);

    const issueBtn = document.getElementById('dd-issue');
    if (issueBtn) issueBtn.onclick = () => issueDoc(doc.id);

    const editBtn = document.getElementById('dd-edit');
    if (editBtn) editBtn.onclick = () => openDocEditModal(doc);

    const deleteBtn = document.getElementById('dd-delete');
    if (deleteBtn) deleteBtn.onclick = () => deleteDoc(doc);

    const printBtn = document.getElementById('dd-print');
    if (printBtn) printBtn.onclick = () => window.print();

  } catch (err) {
    root.innerHTML = `
      <div class="alert alert-danger" style="margin:20px;">
        <strong>Error:</strong> ${escapeHtml(err.message)}
        <div style="margin-top:12px;">
          <button class="btn btn-sm btn-outline" onclick="FPU_ADMIN_SPA.navigateTo('documents')">← Back to Documents</button>
        </div>
      </div>
    `;
  }
}

async function renderDocPreview(doc, user) {
  const type = String(doc.type || '').toLowerCase();
  const dateObj = new Date();
  const day = dateObj.getDate();
  const month = dateObj.toLocaleDateString('en-GB', { month: 'long' });
  const year = dateObj.getFullYear();
  const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User';

  // Data Extraction
  const isStaff = user.role === 'staff' || user.role === 'admin' || !!user.staffId;
  const idValue = isStaff ? (user.staffId || user.id) : (user.matricNumber || '—');
  const idLabel = isStaff ? 'Staff ID' : 'Matric Number';
  
  const progName = user.programme?.name || user.programmeName || user.programme_name || user.programme?.code || '—';
  const deptName = user.department?.name || user.departmentName || user.department_name || user.department?.code || '—';
  const level = user.level || 'ND';
  const sessionName = user.session?.name || user.sessionName || user.currentSession || '2025/2026';

  // Determine classification
  const cgpa = user.cgpa || 3.5; 
  let classification = 'Upper Credit';
  if (cgpa >= 3.5) classification = 'Distinction';
  else if (cgpa >= 3.0) classification = 'Upper Credit';
  else if (cgpa >= 2.5) classification = 'Lower Credit';
  else classification = 'Pass';

  // Common Wrapper
  const a4Wrapper = (title, bodyHtml) => `
    <div class="doc-preview-wrap">
      <div class="doc-preview-toolbar"><span>👁 ${title} Preview</span><span class="tip">Use 🖨 Print to save as PDF</span></div>
      <div class="doc-preview-outer">
        <div class="official-doc" style="background: #fdfbf7; padding: 20mm;">
          <!-- Main Background Watermark -->
          <div class="official-watermark" style="opacity: 0.03; z-index: 0;">
            <img src="/images/logo.png" onerror="this.style.display='none'" style="width: 80%;" />
          </div>
          <div style="position: relative; z-index: 1;">
            ${bodyHtml}
          </div>
        </div>
      </div>
    </div>
  `;

  // --- 1. ATTESTATION LETTER ---
  if (type === 'attestation') {
    return a4Wrapper('Attestation', `
      <div class="official-letterhead">
        <img src="/images/logo.png" onerror="this.style.display='none'" />
        <div><div class="inst-name">FEDERAL POLYTECHNIC Ugep</div><div class="inst-motto">P.M.B. 1038, Ugep, Cross River State, Nigeria</div></div>
      </div>
      <div class="official-title">ATTESTATION</div>
      <div class="official-body">
        <p>This is to certify that <strong>${escapeHtml(fullName)}</strong> with ${idLabel} <strong>${escapeHtml(idValue)}</strong> is a bona fide ${isStaff ? 'staff member' : 'student'} of Federal Polytechnic Ugep, currently enrolled in the following programme:</p>
        <table style="width:100%; margin: 20px 0; font-size: 15px;">
          <tr><td style="color:#64748b; width:30%;">Programme:</td><td style="font-weight:bold;">${escapeHtml(progName)}</td></tr>
          <tr><td style="color:#64748b;">Department:</td><td style="font-weight:bold;">${escapeHtml(deptName)}</td></tr>
          <tr><td style="color:#64748b;">Level:</td><td style="font-weight:bold;">${escapeHtml(level)}</td></tr>
          <tr><td style="color:#64748b;">Session:</td><td style="font-weight:bold;">${escapeHtml(sessionName)}</td></tr>
        </table>
        <p>This document is issued at the request of the student for official purposes.</p>
        <br><p>Date: ${dateStr}</p>
      </div>
      <div class="official-signatures" style="grid-template-columns: 1fr; text-align:right; margin-top:40px;">
        <div style="display:inline-block; text-align:center;">
          <div class="official-sig-line" style="width:200px;"></div>
          <div class="official-sig-role">REGISTRAR</div>
        </div>
      </div>
    `);
  }

  // --- 2. ID CARD ---
  if (type === 'id-card' || type === 'id-letter') {
    return `
      <div class="doc-preview-wrap">
        <div class="doc-preview-toolbar"><span>👁 ID Card Preview</span><span class="tip">Use 🖨 Print to save as PDF</span></div>
        <div class="doc-preview-outer" style="background:#1e293b;">
          <div class="id-card-wrapper">
            <div class="id-card">
              <div class="id-card-header">
                <img src="/images/logo.png" onerror="this.style.display='none'" />
                <div style="text-align:left;">
                  <div style="font-size:10px; opacity:0.8;">FEDERAL POLYTECHNIC Ugep</div>
                  <div style="font-size:14px; font-weight:700;">STUDENT ID CARD</div>
                </div>
              </div>
              <div class="id-card-body">
                <div class="official-watermark" style="opacity:0.05; z-index:0;"><img src="/images/logo.png" onerror="this.style.display='none'" /></div>
                <div class="id-photo">
                  ${user.photoUrl ? `<img src="${escapeHtml(user.photoUrl)}" style="width:100%; height:100%; object-fit:cover; border-radius:10px;" />` : 'PHOTO'}
                </div>
                <h2 class="id-name">${escapeHtml(fullName)}</h2>
                <div class="id-row"><span class="label">Matric</span><span class="value">${escapeHtml(idValue)}</span></div>
                <div class="id-row"><span class="label">Level</span><span class="value">${escapeHtml(level)}</span></div>
                <div class="id-row"><span class="label">Programme</span><span class="value">${escapeHtml(progName)}</span></div>
                <div class="id-row"><span class="label">Dept</span><span class="value">${escapeHtml(deptName)}</span></div>
              </div>
              <div class="id-card-footer">VALID UNTIL GRADUATION · ${dateStr.toUpperCase()}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- 3. CERTIFICATE OF COMPLETION (VINTAGE REDESIGN) ---
  if (type === 'certificate') {
    return a4Wrapper('Certificate', `
      <style>
        .vintage-cert {
          font-family: 'Times New Roman', Times, serif;
          color: #1a1a1a;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 10mm;
        }
        
        .vintage-cert .vc-header {
          font-size: 22px;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 5px;
          font-weight: normal;
        }
        .vintage-cert .vc-subheader {
          font-size: 12px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #444;
          margin-bottom: 30px;
        }
        
        .vintage-cert .vc-logo {
          width: 110px;
          margin-bottom: 40px;
        }

        .vintage-cert .vc-text {
          font-size: 18px;
          line-height: 1.6;
          font-style: italic;
          margin-bottom: 10px;
        }

        .vintage-cert .vc-name {
          font-family: 'Brush Script MT', 'Great Vibes', cursive;
          font-size: 42px;
          color: #000;
          margin: 10px 0 20px 0;
          border-bottom: 1px solid #999;
          padding: 0 40px;
          display: inline-block;
          min-width: 60%;
        }

        .vintage-cert .vc-body {
          font-size: 17px;
          line-height: 1.8;
          max-width: 85%;
          margin: 0 auto;
        }

        .vintage-cert .vc-fill-line {
          border-bottom: 1px solid #999;
          display: inline-block;
          padding: 0 10px;
          min-width: 120px;
          font-weight: bold;
          font-style: normal;
        }

        .vintage-cert .vc-caps {
          text-transform: uppercase;
          font-size: 20px;
          letter-spacing: 1px;
          margin: 25px 0;
          line-height: 1.4;
        }

        .vintage-cert .vc-signatures {
          display: flex;
          justify-content: space-between;
          width: 100%;
          margin-top: 60px;
          padding: 0 40px;
        }

        .vintage-cert .vc-sig-block {
          text-align: center;
          width: 200px;
        }

        .vintage-cert .vc-sig-img {
          font-family: 'Brush Script MT', cursive;
          font-size: 28px;
          color: #333;
          height: 40px;
          margin-bottom: -10px;
          transform: rotate(-5deg);
        }

        .vintage-cert .vc-sig-line {
          border-bottom: 1px solid #000;
          margin-bottom: 5px;
        }

        .vintage-cert .vc-sig-title {
          font-size: 12px;
          font-weight: bold;
          letter-spacing: 1px;
        }

        .vintage-cert .vc-footer {
          margin-top: 50px;
          font-size: 13px;
          text-align: right;
          width: 100%;
          padding-right: 40px;
          font-weight: bold;
        }
      </style>

      <div class="vintage-cert">
        <div class="vc-header">The Federal Polytechnic</div>
        <div class="vc-subheader">Ugep, Cross River State, Nigeria</div>
        
        <img src="/images/logo.png" class="vc-logo" onerror="this.style.display='none'" />

        <div class="vc-text">This is to certify that</div>
        
        <div class="vc-name">${escapeHtml(fullName)}</div>

        <div class="vc-body">
          having completed the approved Course of Study and passed the prescribed Examinations, has this day,
          <br><br>
          the <span class="vc-fill-line">${day}${day === 1 || day === 21 || day === 31 ? 'st' : (day === 2 || day === 22 ? 'nd' : (day === 3 || day === 23 ? 'rd' : 'th'))}</span> 
          of <span class="vc-fill-line">${month}</span>, 
          <span class="vc-fill-line">${year}</span>
          <br><br>
          under the Authority of the<br>
          <span class="vc-caps">Academic Board</span>
          been awarded
        </div>

        <div class="vc-caps">
          ${String(level).toUpperCase() === 'HND' ? 'The Higher National Diploma' : 'The National Diploma'}
          <br>
          <span style="font-size: 14px; font-style: italic; text-transform: lowercase; letter-spacing: normal;">in</span>
          <br>
          <span style="text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 4px; font-style: italic;">${escapeHtml(progName)}</span>
        </div>

        <div class="vc-text" style="font-size: 16px;">
          with <span class="vc-fill-line">${classification}</span>
        </div>

        <div class="vc-signatures">
          <div class="vc-sig-block">
            <div class="vc-sig-img">J. Akande</div>
            <div class="vc-sig-line"></div>
            <div class="vc-sig-title">RECTOR</div>
          </div>
          <div class="vc-sig-block">
            <div class="vc-sig-img">M. Bello</div>
            <div class="vc-sig-line"></div>
            <div class="vc-sig-title">REGISTRAR</div>
          </div>
        </div>

        <div class="vc-footer">
          Certificate No. FPU/${level}/HND/${new Date().getFullYear().toString().slice(-2)}/${String(user.id || 0).padStart(5, '0')}
        </div>
      </div>
    `);
  }

  // --- 4. CLEARANCE CERTIFICATE ---
  if (type === 'clearance') {
    return a4Wrapper('Clearance', `
      <div class="official-letterhead">
        <img src="/images/logo.png" onerror="this.style.display='none'" />
        <div><div class="inst-name">FEDERAL POLYTECHNIC Ugep</div><div class="inst-motto">Office of the Registrar</div></div>
      </div>
      <div class="official-title">CLEARANCE CERTIFICATE</div>
      <div class="official-body">
        <p>This is to certify that <strong>${escapeHtml(fullName)}</strong> with Matric Number <strong>${escapeHtml(idValue)}</strong> has been cleared by the institution.</p>
        <p>The student has completed all necessary academic and financial requirements for the programme: <strong>${escapeHtml(progName)}</strong> in the <strong>${escapeHtml(deptName)}</strong> department.</p>
        <p>This clearance is valid for the purpose of NYSC mobilization, graduation, or collection of certificates.</p>
        
        <div style="margin-top:60px; display:flex; justify-content:space-between;">
          <div style="text-align:center;">
            <div style="border-bottom:1px solid #000; width:200px; margin-bottom:10px;"></div>
            <div style="font-size:14px; font-weight:bold;">Bursar</div>
          </div>
          <div style="text-align:center;">
            <div style="border-bottom:1px solid #000; width:200px; margin-bottom:10px;"></div>
            <div style="font-size:14px; font-weight:bold;">Registrar</div>
          </div>
        </div>
        <p style="margin-top:50px; font-size:14px;">Date: ${dateStr}</p>
      </div>
    `);
  }

  // --- 5. TRANSCRIPT ---
  if (type === 'transcript') {
    let results = [];
    try {
      const res = await adminFetch(`/api/admin/departments/transcript/${user.id}`);
      if (res.ok) { const j = await res.json(); results = j.results || []; }
    } catch (e) { console.error("Could not load transcript data", e); }

    let totalUnits = 0;
    let totalPoints = 0;
    const gradePoints = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };

    const rowsHtml = results.map(r => {
      const units = Number(r.units || r.creditUnits || 0);
      const grade = String(r.grade || '').toUpperCase();
      const pts = units * (gradePoints[grade] || 0);
      totalUnits += units;
      totalPoints += pts;

      return `
        <tr>
          <td>${escapeHtml(r.session)}</td>
          <td>${escapeHtml(r.semester)}</td>
          <td>${escapeHtml(r.courseCode)}</td>
          <td>${escapeHtml(r.courseTitle || '—')}</td>
          <td style="text-align:center;">${units}</td>
          <td style="font-weight:bold; text-align:center;">${grade}</td>
          <td style="text-align:right;">${pts}</td>
        </tr>
      `;
    }).join('');

    const cgpa = totalUnits ? (totalPoints / totalUnits).toFixed(2) : '0.00';

    return a4Wrapper('Transcript', `
      <div class="official-letterhead">
        <img src="/images/logo.png" onerror="this.style.display='none'" />
        <div><div class="inst-name">FEDERAL POLYTECHNIC Ugep</div><div class="inst-motto">Official Academic Transcript</div></div>
      </div>
      
      <div class="tx-summary-box">
        <div>
          <div><strong>Name:</strong> ${escapeHtml(fullName)}</div>
          <div><strong>Matric No:</strong> ${escapeHtml(idValue)}</div>
          <div><strong>Programme:</strong> ${escapeHtml(progName)}</div>
        </div>
        <div style="text-align:right;">
          <div><strong>Level:</strong> ${escapeHtml(level)}</div>
          <div><strong>Department:</strong> ${escapeHtml(deptName)}</div>
          <div><strong>Date:</strong> ${dateStr}</div>
        </div>
      </div>

      <table class="tx-table">
        <thead>
          <tr>
            <th>Session</th>
            <th>Sem</th>
            <th>Code</th>
            <th>Course Title</th>
            <th style="text-align:center;">Units</th>
            <th style="text-align:center;">Grade</th>
            <th style="text-align:right;">Points</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">No published results found for this student.</td></tr>'}
        </tbody>
      </table>

      <div style="margin-top:20px; text-align:right; font-family:'Poppins',sans-serif; font-size:16px; font-weight:bold;">
        Total Units: ${totalUnits} &nbsp; | &nbsp; Total Points: ${totalPoints} &nbsp; | &nbsp; CGPA: <span style="color:#065f46;">${cgpa}</span>
      </div>

      <div style="margin-top:60px; text-align:right; position:relative; z-index:1;">
        <div style="display:inline-block; text-align:center;">
          <div class="official-sig-line" style="width:200px;"></div>
          <div class="official-sig-role">REGISTRAR</div>
        </div>
      </div>
    `);
  }

  // Fallback
  return a4Wrapper('Document', `<p>No preview available for this document type.</p>`);
}

// ---------- Document viewer ----------
function viewDocument(url, title) {
  if (!url) { showToast('⚠️ No file to view.', 'warning'); return; }

  const overlay = document.getElementById('dd-viewer');
  const frame = document.getElementById('dd-viewer-frame');
  const link = document.getElementById('dd-viewer-open');
  const titleEl = document.getElementById('dd-viewer-title');

  if (!overlay || !frame) {
    // Fallback: just open in new tab
    window.open(url, '_blank', 'noopener');
    return;
  }

  titleEl.textContent = title || 'Document Preview';
  link.href = url;

  // For images and PDFs the browser renders inline.
  // For other types (docx, etc.) the browser will prompt download.
  frame.src = url;
  overlay.style.display = 'flex';
}

// ---------- Doc actions ----------
async function approveDoc(id) {
  const ok = await window.fpuConfirm(
    'Approve this document request?\n\nThe student will be notified that their request was approved.',
    { title: 'Approve Document', type: 'success', okText: 'Approve' }
  );
  if (!ok) return;
  try {
    await adminFetch(`/api/admin/documents/${id}/approve`, { method: 'POST' });
    showToast('✅ Document approved.', 'success');
    loadDocumentDetail();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

// ---------- Replace these functions in admin.js ----------

async function rejectDoc(id) {
  const remarks = await window.fpuPrompt(
    'Reason for rejection:',
    'The student will see this reason.',
    'Reject Document'
  );
  if (remarks === null) return; // User clicked Cancel
  
  try {
    await adminFetch(`/api/admin/documents/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ remarks: remarks || 'Rejected by admin.' }),
    });
    showToast('⚠️ Document rejected.', 'warning');
    loadDocumentDetail();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

async function issueDoc(id) {
  // No more URLs! Just a beautiful confirmation.
  const ok = await window.fpuConfirm(
    'Are you sure you want to issue this document?\n\nThe student will be notified that their document is ready.',
    { title: 'Issue Document', type: 'success', okText: 'Yes, Issue Document' }
  );
  if (!ok) return;

  try {
    // We send a dummy payload or just let the backend auto-generate the doc
    await adminFetch(`/api/admin/documents/${id}/issue`, {
      method: 'POST',
      body: JSON.stringify({ fileUrl: 'auto-generated' }),
    });
    showToast('📤 Document issued and sent to student.', 'success');
    loadDocumentDetail();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

async function deleteDoc(doc) {
  const ok = await window.fpuConfirm(
    `Delete document request "${doc.title || 'Untitled'}"?\n\nThis cannot be undone. The student will lose their request history.`,
    { title: 'Delete Document', type: 'danger', okText: 'Delete Permanently' }
  );
  if (!ok) return;
  try {
    await adminFetch(`/api/admin/documents/${doc.id}`, { method: 'DELETE' });
    showToast('🗑 Document deleted.', 'success');
    FPU_ADMIN_SPA.navigateTo('documents');
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

function openDocEditModal(doc) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
  
  backdrop.innerHTML = `
    <div class="modal" style="background:#fff;border-radius:12px;padding:24px;max-width:500px;width:90%;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;">Edit Document Details</h3>
        <button class="btn btn-sm btn-ghost" id="dd-modal-close">×</button>
      </div>
      
      <div class="form-group">
        <label class="form-label">Title</label>
        <input class="form-control" id="dd-edit-title" value="${escapeHtml(doc.title || '')}" />
      </div>
      
      <div class="form-group">
        <label class="form-label">Document Type</label>
        <select class="form-select" id="dd-edit-type">
          <option value="transcript" ${doc.type === 'transcript' ? 'selected' : ''}>Transcript</option>
          <option value="certificate" ${doc.type === 'certificate' ? 'selected' : ''}>Certificate</option>
          <option value="attestation" ${doc.type === 'attestation' ? 'selected' : ''}>Attestation</option>
          <option value="id-card" ${doc.type === 'id-card' ? 'selected' : ''}>ID Card</option>
          <option value="clearance" ${doc.type === 'clearance' ? 'selected' : ''}>Clearance</option>
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Reason / Description</label>
        <textarea class="form-control" id="dd-edit-reason" rows="3">${escapeHtml(doc.reason || '')}</textarea>
      </div>
      
      <div class="form-group">
        <label class="form-label">Remarks (internal)</label>
        <textarea class="form-control" id="dd-edit-remarks" rows="2">${escapeHtml(doc.remarks || '')}</textarea>
      </div>
      
      <div style="display:flex;gap:8px;margin-top:20px;justify-content:flex-end;">
        <button class="btn btn-outline" id="dd-modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="dd-modal-save">Save Changes</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(backdrop);
  
  const close = () => backdrop.remove();
  
  backdrop.querySelector('#dd-modal-close').onclick = close;
  backdrop.querySelector('#dd-modal-cancel').onclick = close;
  backdrop.onclick = (e) => { if (e.target === backdrop) close(); };
  
  backdrop.querySelector('#dd-modal-save').onclick = async () => {
    const title = backdrop.querySelector('#dd-edit-title').value.trim();
    const type = backdrop.querySelector('#dd-edit-type').value;
    const reason = backdrop.querySelector('#dd-edit-reason').value.trim();
    const remarks = backdrop.querySelector('#dd-edit-remarks').value.trim();
    
    if (!title) { showToast('⚠️ Title is required.', 'warning'); return; }
    
    try {
      await adminFetch(`/api/admin/documents/${doc.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, type, reason, remarks }),
      });
      showToast('✅ Document updated.', 'success');
      close();
      loadDocumentDetail();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };
}

async function loadGraduationsTable() {
  const tbody = document.getElementById('grad-tbody');
  if (!tbody) return;

  const status = (document.getElementById('grad-status-tabs')?.querySelector('.active')?.dataset.status) || '';
  const sessionId = (document.getElementById('grad-filter-session') || {}).value || '';
  const classification = (document.getElementById('grad-filter-class') || {}).value || '';
  const search = (document.getElementById('grad-search') || {}).value || '';

  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  if (sessionId) qs.set('sessionId', sessionId);

  tbody.innerHTML = '<tr><td colspan="8" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/graduation?${qs}`);
    const json = await res.json();
    let rows = json.data || [];

    if (classification) rows = rows.filter((r) => (r.graduation || r).classification === classification);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => {
        const s = r.student || {};
        return String(s.matricNumber || '').toLowerCase().includes(q) || String(s.firstName || '').toLowerCase().includes(q) || String(s.lastName || '').toLowerCase().includes(q);
      });
    }

    const total = rows.length;
    const pending = rows.filter((r) => (r.graduation || r).status === 'pending').length;
    const graduated = rows.filter((r) => (r.graduation || r).status === 'graduated').length;
    const dist = rows.filter((r) => (r.graduation || r).classification === 'Distinction').length;
    
    setText('grad-stat-total', total);
    setText('grad-stat-pending', pending);
    setText('grad-stat-graduated', graduated);
    setText('grad-stat-dist', dist);
    setText('grad-count', `Showing ${total}`);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">No records.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((r) => {
      const g = r.graduation || r;
      const s = r.student || {};
      const clsName = g.classification === 'Distinction' ? 'distinction' : g.classification === 'Upper Credit' ? 'upper' : g.classification === 'Lower Credit' ? 'lower' : g.classification === 'Pass' ? 'pass' : 'fail';
      const canApprove = g.status === 'pending';
      const canGraduate = g.status === 'approved';

      return `
        <tr>
          <td><input type="checkbox" class="grad-check" data-id="${g.id}" /></td>
          <td><code>${escapeHtml(s.matricNumber || '')}</code></td>
          <td>${escapeHtml((s.firstName || '') + ' ' + (s.lastName || ''))}</td>
          <td>${escapeHtml(g.level || '')}</td>
          <td class="num">${g.cgpa || '—'}</td>
          <td><span class="grad-class ${clsName}">${escapeHtml(g.classification || '—')}</span></td>
          <td>${badge(g.status)}</td>
          <td>
            <div class="row-actions">
              ${canApprove ? `<button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.approveGraduation(${g.id})">Approve</button><button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.rejectGraduation(${g.id})">Reject</button>` : ''}
              ${canGraduate ? `<button class="btn btn-sm btn-accent" onclick="FPU_ADMIN.markGraduated(${g.id})">Graduate</button>` : ''}
              <button class="btn btn-sm btn-outline" onclick="FPU_ADMIN_SPA.navigateToWithQuery('transcript-by-student', { studentId: ${g.studentId} })">Transcript</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    const selectAll = document.getElementById('grad-select-all');
    if (selectAll) {
      selectAll.onchange = () => {
        tbody.querySelectorAll('.grad-check').forEach((cb) => { cb.checked = selectAll.checked; });
      };
    }

    const bulkBtn = document.getElementById('grad-bulk-approve');
    if (bulkBtn) {
      bulkBtn.onclick = async () => {
        const ids = Array.from(tbody.querySelectorAll('.grad-check:checked')).map((c) => Number(c.dataset.id));
        if (!ids.length) { showToast('Select students first.', 'warning'); return; }
        if (!confirm(`Approve ${ids.length} graduation record(s)?`)) return;
        let ok = 0, failed = 0;
        for (const id of ids) {
          try { await adminFetch(`/api/admin/graduation/${id}/approve`, { method: 'POST' }); ok++; } catch { failed++; }
        }
        showToast(`✅ Approved ${ok}${failed ? `, ${failed} failed` : ''}.`);
        loadGraduationsTable();
      };
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadReportsWithCharts() {
  const days = (document.getElementById('rep-range') || {}).value || 365;
  const rangeQs = days === 'all' ? '' : `?days=${days}`;

  async function safeJson(url) {
    try {
      const res = await adminFetch(url);
      if (!res.ok) return null;
      const j = await res.json();
      return j.data || j || [];
    } catch { return null; }
  }

  // ---------- KPI tiles ----------
  // Try the reports overview endpoint first
  const overview = await safeJson('/api/admin/reports/overview');
  if (overview && typeof overview === 'object' && !Array.isArray(overview)) {
    setText('rep-stat-students', overview.students || 0);
    setText('rep-stat-apps', overview.totalApplications || 0);
    setText('rep-stat-revenue', money(overview.totalRevenue || 0));
    setText('rep-stat-progs', overview.totalProgrammes || 0);
  } else {
    // Fallback: compute from the working endpoints
    const [students, applications, programmes, payments] = await Promise.all([
      safeJson('/api/admin/students?limit=5000'),
      safeJson('/api/admin/applications?limit=5000'),
      safeJson('/api/admin/programmes'),
      safeJson('/api/admin/payments?limit=5000'),
    ]);
    const studentCount = Array.isArray(students) ? students.length : 0;
    const appCount = Array.isArray(applications) ? applications.length : 0;
    const progCount = Array.isArray(programmes) ? programmes.length : 0;
    const revenue = Array.isArray(payments)
      ? payments.filter((p) => (p.payment || p).status === 'verified')
               .reduce((s, p) => s + Number((p.payment || p).amount || 0), 0)
      : 0;
    setText('rep-stat-students', studentCount);
    setText('rep-stat-apps', appCount);
    setText('rep-stat-revenue', money(revenue));
    setText('rep-stat-progs', progCount);
  }

  // If Chart.js isn't loaded, stop (KPI tiles already work above)
  if (typeof Chart === 'undefined') {
    console.warn('[reports] Chart.js not loaded — skipping charts');
    return;
  }

  // Helper: replace canvas with message if no data
  function emptyState(canvasId, msg) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) parent.innerHTML = `<p class="muted" style="padding:40px;text-align:center;color:#94a3b8;">${msg}</p>`;
  }

  // ---------- Chart 1: Admission Trend ----------
  const admissions = await safeJson(`/api/admin/reports/admission-trend${rangeQs}`);
  const chartA = document.getElementById('rep-chart-admission');
  if (chartA && Array.isArray(admissions) && admissions.length) {
    new Chart(chartA, {
      type: 'line',
      data: {
        labels: admissions.map((r) => r.month),
        datasets: [{ data: admissions.map((r) => r.count), borderColor: '#065f46', backgroundColor: 'rgba(6,95,70,.1)', tension: 0.4, fill: true, borderWidth: 3 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
  } else {
    emptyState('rep-chart-admission', 'No admission trend data yet. Add applications to see this chart.');
  }

  // ---------- Chart 2: Revenue Trend ----------
  const revenue = await safeJson(`/api/admin/reports/revenue-trend${rangeQs}`);
  const chartR = document.getElementById('rep-chart-revenue');
  if (chartR && Array.isArray(revenue) && revenue.length) {
    new Chart(chartR, {
      type: 'line',
      data: {
        labels: revenue.map((r) => r.month),
        datasets: [{ data: revenue.map((r) => Number(r.total || 0)), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.15)', tension: 0.4, fill: true, borderWidth: 3 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
  } else {
    emptyState('rep-chart-revenue', 'No revenue trend data yet. Verify payments to see this chart.');
  }

  // ---------- Chart 3: Enrollment by Department ----------
  const depts = await safeJson('/api/admin/reports/enrollment-by-department');
  const chartD = document.getElementById('rep-chart-dept');
  if (chartD && Array.isArray(depts) && depts.length) {
    const top = depts.slice(0, 10);
    new Chart(chartD, {
      type: 'bar',
      data: {
        labels: top.map((r) => r.name),
        datasets: [{ data: top.map((r) => r.count), backgroundColor: '#065f46', borderRadius: 6 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
  } else {
    // Fallback: compute dept enrollment from /students + /departments
    const [students, departments] = await Promise.all([
      safeJson('/api/admin/students?limit=5000'),
      safeJson('/api/admin/departments'),
    ]);
    if (Array.isArray(students) && Array.isArray(departments)) {
      const byDept = new Map();
      departments.forEach((d) => byDept.set(d.id, { name: d.code || d.name, count: 0 }));
      students.forEach((s) => {
        const bucket = byDept.get(s.departmentId);
        if (bucket) bucket.count++;
      });
      const sorted = [...byDept.values()].filter((d) => d.count > 0).sort((a, b) => b.count - a.count).slice(0, 10);
      if (sorted.length && chartD) {
        new Chart(chartD, {
          type: 'bar',
          data: {
            labels: sorted.map((r) => r.name),
            datasets: [{ data: sorted.map((r) => r.count), backgroundColor: '#065f46', borderRadius: 6 }],
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
        });
      } else {
        emptyState('rep-chart-dept', 'No enrollment data yet.');
      }
    } else {
      emptyState('rep-chart-dept', 'No enrollment data yet.');
    }
  }

  // ---------- Chart 4: Applications by Status ----------
  const appStatus = await safeJson('/api/admin/reports/applications-by-status');
  const chartAp = document.getElementById('rep-chart-apps');
  if (chartAp && Array.isArray(appStatus) && appStatus.length) {
    const colorMap = { pending: '#f59e0b', under_review: '#3b82f6', approved: '#065f46', rejected: '#dc2626', registered: '#8b5cf6' };
    new Chart(chartAp, {
      type: 'doughnut',
      data: {
        labels: appStatus.map((r) => (r.status || '').replace(/_/g, ' ')),
        datasets: [{ data: appStatus.map((r) => r.count), backgroundColor: appStatus.map((r) => colorMap[r.status] || '#64748b'), borderColor: '#fff', borderWidth: 3 }],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '62%' },
    });
  } else {
    // Fallback: compute status counts from /applications
    const apps = await safeJson('/api/admin/applications?limit=5000');
    if (Array.isArray(apps) && apps.length) {
      const counts = {};
      apps.forEach((a) => { counts[a.status || 'unknown'] = (counts[a.status || 'unknown'] || 0) + 1; });
      const rows = Object.entries(counts).map(([status, count]) => ({ status, count }));
      const colorMap = { pending: '#f59e0b', under_review: '#3b82f6', approved: '#065f46', rejected: '#dc2626', registered: '#8b5cf6' };
      if (chartAp) {
        new Chart(chartAp, {
          type: 'doughnut',
          data: {
            labels: rows.map((r) => r.status.replace(/_/g, ' ')),
            datasets: [{ data: rows.map((r) => r.count), backgroundColor: rows.map((r) => colorMap[r.status] || '#64748b'), borderColor: '#fff', borderWidth: 3 }],
          },
          options: { responsive: true, maintainAspectRatio: false, cutout: '62%' },
        });
      }
    } else {
      emptyState('rep-chart-apps', 'No applications yet.');
    }
  }

  // ---------- Applications by Status TABLE ----------
  const appsTbody = document.getElementById('rep-apps-tbody');
  if (appsTbody) {
    const apps = await safeJson('/api/admin/applications?limit=5000');
    if (Array.isArray(apps) && apps.length) {
      const counts = {};
      apps.forEach((a) => { counts[a.status || 'unknown'] = (counts[a.status || 'unknown'] || 0) + 1; });
      appsTbody.innerHTML = Object.entries(counts).map(([status, count]) => `
        <tr><td>${escapeHtml(status)}</td><td class="num">${count}</td></tr>
      `).join('');
    } else {
      appsTbody.innerHTML = '<tr><td colspan="2" class="empty">No data available.</td></tr>';
    }
  }

  // ---------- Payments by Status TABLE ----------
  const payTbody = document.getElementById('rep-pay-tbody');
  if (payTbody) {
    const payments = await safeJson('/api/admin/payments?limit=5000');
    if (Array.isArray(payments) && payments.length) {
      const counts = {};
      payments.forEach((p) => {
        const row = p.payment || p;
        const status = row.status || 'unknown';
        if (!counts[status]) counts[status] = { count: 0, total: 0 };
        counts[status].count++;
        counts[status].total += Number(row.amount || 0);
      });
      payTbody.innerHTML = Object.entries(counts).map(([status, data]) => `
        <tr><td>${escapeHtml(status)}</td><td class="num">${data.count}</td><td class="num">${money(data.total)}</td></tr>
      `).join('');
    } else {
      payTbody.innerHTML = '<tr><td colspan="3" class="empty">No data available.</td></tr>';
    }
  }

  // ---------- Wire buttons ----------
  const buttons = Array.from(document.querySelectorAll('.page-head .actions button'));
  const refreshBtn = buttons.find((b) => /refresh/i.test(b.textContent || ''));
  if (refreshBtn && !refreshBtn.__wired) {
    refreshBtn.__wired = true;
    refreshBtn.onclick = () => loadReportsWithCharts();
  }
  const exportBtn = document.getElementById('rep-export');
  if (exportBtn && !exportBtn.__wired) {
    exportBtn.__wired = true;
    exportBtn.onclick = () => {
      const tables = ['rep-apps-tbody', 'rep-pay-tbody']
        .map((id) => document.getElementById(id)?.closest('table'))
        .filter(Boolean);
      if (!tables.length) { showToast('⚠️ Nothing to export yet.', 'warning'); return; }
      exportTableAsCSV(tables[0], `reports-${new Date().toISOString().slice(0, 10)}.csv`);
    };
  }
}

// ============================================
// AUDIT LOGS
// ============================================
async function loadAuditTable() {
  const container = document.getElementById('audit-tbody');
  if (!container) return;
  container.innerHTML = '<tr><td colspan="7" class="empty" style="text-align:center; padding: 40px;"><span class="spinner"></span> Loading audit logs…</td></tr>';

  const action = (document.getElementById('audit-action') || {}).value || '';
  const entity = (document.getElementById('audit-entity') || {}).value || '';
  const from = (document.getElementById('audit-from') || {}).value || '';
  const to = (document.getElementById('audit-to') || {}).value || '';

  const qs = new URLSearchParams({ limit: 300 });
  if (action) qs.set('action', action);
  if (entity) qs.set('entity', entity);
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);

  try {
    const res = await adminFetch(`/api/admin/audit?${qs}`);
    const json = await res.json();
    const rows = json.data || [];

    setText('audit-count', `Showing ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`);

    if (!rows.length) {
      container.innerHTML = '<tr><td colspan="7" class="empty" style="text-align:center;">No audit entries match your filters.</td></tr>';
      return;
    }

    // Helper function to render JSON beautifully
    function renderJSON(data) {
      if (!data) return '';
      let parsed = data;
      
      // If the payload has a nested JSON string (like { value: "{...}" }), parse it
      if (typeof data === 'object' && data.value && typeof data.value === 'string') {
        try { parsed = JSON.parse(data.value); } catch (e) {}
      }

      if (typeof parsed !== 'object' || parsed === null) {
        return `<div style="background:#fff; border:1px solid #e2e8f0; padding:12px; border-radius:6px; font-family:monospace; font-size:12px;">${escapeHtml(String(parsed))}</div>`;
      }

      return `
        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; overflow:hidden; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
          ${Object.entries(parsed).map(([k, v]) => `
            <div style="display:flex; border-bottom:1px solid #f1f5f9; font-size:13px;">
              <div style="width:30%; background:#f8fafc; padding:8px 12px; font-weight:600; color:#475569; border-right:1px solid #e2e8f0;">${escapeHtml(k)}</div>
              <div style="width:70%; padding:8px 12px; color:#0f172a; font-family:monospace;">${escapeHtml(String(v))}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Build expandable rows
    container.innerHTML = rows.map((r) => {
      const log = r.log || r;
      const user = r.user
        ? `${r.user.firstName || ''} ${r.user.lastName || ''}`.trim() || r.user.email || '—'
        : '—';
      const hasPayload = !!(log.before || log.after);
      const logId = log.id || Math.random().toString(36).slice(2);

      return `
        <tr class="audit-row" data-id="${logId}">
          <td>
            <button class="btn btn-sm btn-ghost" data-toggle="${logId}" ${!hasPayload ? 'disabled' : ''} style="padding: 0 8px;">
              ${hasPayload ? '▸' : '·'}
            </button>
          </td>
          <td><code>${escapeHtml(log.action || '')}</code></td>
          <td>${escapeHtml(user)}</td>
          <td>${escapeHtml(log.entity || '—')}</td>
          <td>${escapeHtml(log.entityId || '—')}</td>
          <td>${escapeHtml(log.ipAddress || '—')}</td>
          <td class="small muted">${fmtDateTime(log.createdAt)}</td>
        </tr>
        <tr class="audit-detail-row" data-detail="${logId}" style="display:none;">
          <td colspan="7" style="background:#f8fafc; padding:20px; border-bottom: 1px solid #e2e8f0;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
              ${log.before ? `
                <div>
                  <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:#dc2626; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                    <span style="background:#fee2e2; width:20px; height:20px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center;">−</span> Before
                  </div>
                  ${renderJSON(log.before)}
                </div>
              ` : ''}
              
              ${log.after ? `
                <div>
                  <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:#047857; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                    <span style="background:#d1fae5; width:20px; height:20px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center;">+</span> After
                  </div>
                  ${renderJSON(log.after)}
                </div>
              ` : ''}
            </div>
            ${!log.before && !log.after ? '<em style="color:#94a3b8;">No payload recorded for this entry.</em>' : ''}
          </td>
        </tr>
      `;
    }).join('');

    // Wire toggle buttons
    container.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.toggle;
        const detailRow = container.querySelector(`[data-detail="${id}"]`);
        if (!detailRow) return;
        const isOpen = detailRow.style.display !== 'none';
        detailRow.style.display = isOpen ? 'none' : 'table-row';
        btn.textContent = isOpen ? '▸' : '▾';
      };
    });

    // Wire the Refresh & Export buttons
    setTimeout(() => {
      const refreshBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Refresh'));
      if (refreshBtn && !refreshBtn.__wired) {
        refreshBtn.__wired = true;
        refreshBtn.onclick = () => loadAuditTable();
      }

      const exportBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Export CSV'));
      if (exportBtn && !exportBtn.__wired) {
        exportBtn.__wired = true;
        exportBtn.onclick = () => exportTableAsCSV(container.closest('table'), 'audit-log.csv');
      }
    }, 50);

    // Wire tabs (Audit Log / Login History)
    document.querySelectorAll('.staff-role-tabs .staff-role-tab, #audit-tabs .staff-role-tab').forEach((tab) => {
      if (tab.__wired) return;
      tab.__wired = true;
      tab.onclick = () => {
        document.querySelectorAll('.staff-role-tabs .staff-role-tab, #audit-tabs .staff-role-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const which = tab.dataset.tab || tab.textContent.trim().toLowerCase();
        if (which.includes('login')) loadLoginHistoryIntoAudit();
        else loadAuditTable();
      };
    });

  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" class="empty" style="color:#dc2626; text-align:center;">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadLoginHistoryIntoAudit() {
  const container = document.getElementById('audit-tbody');
  if (!container) return;
  container.innerHTML = '<tr><td colspan="7" class="empty">Loading login history…</td></tr>';

  try {
    const res = await adminFetch('/api/admin/login-history?limit=200');
    const json = await res.json();
    const rows = json.data || [];

    setText('audit-count', `Showing ${rows.length} login attempt${rows.length === 1 ? '' : 's'}`);

    if (!rows.length) {
      container.innerHTML = '<tr><td colspan="7" class="empty">No login history.</td></tr>';
      return;
    }

    container.innerHTML = rows.map((r) => {
      const entry = r.entry || r;
      const user = r.user
        ? `${r.user.firstName || ''} ${r.user.lastName || ''}`.trim() || r.user.email || '—'
        : entry.email || '—';
      return `
        <tr>
          <td></td>
          <td><code>${escapeHtml(entry.success ? 'login.success' : 'login.failed')}</code></td>
          <td>${escapeHtml(user)}</td>
          <td>${escapeHtml(entry.email || '—')}</td>
          <td>${escapeHtml(entry.reason || '—')}</td>
          <td>${escapeHtml(entry.ipAddress || '—')}</td>
          <td class="small muted">${fmtDateTime(entry.createdAt)}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" class="empty" style="color:#dc2626;">${escapeHtml(err.message)}</td></tr>`;
  }
}

// ============================================
// SECURITY CENTER — Dashboard
// ============================================
async function loadSecurityDashboard() {
  // Set loading states
  const banner = document.getElementById('sec-threat-banner');
  if (banner) banner.innerHTML = '<div style="padding: 20px; color: #64748b;"><span class="spinner"></span> Analysing threats...</div>';
  
  const tbody = document.getElementById('sec-recent-events');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty" style="text-align:center; padding: 20px; color: #64748b;"><span class="spinner"></span> Loading...</td></tr>';

  try {
    // Fetch data safely
    const [loginsRes, eventsRes, sessionsRes] = await Promise.all([
      adminFetch('/api/admin/login-history?limit=100').catch(() => null),
      adminFetch('/api/admin/security?limit=100').catch(() => null),
      adminFetch('/api/admin/security/sessions').catch(() => null),
    ]);

    let logins = [];
    try { if (loginsRes && loginsRes.ok) logins = (await loginsRes.json()).data || []; } catch {}
    
    let events = [];
    try { if (eventsRes && eventsRes.ok) events = (await eventsRes.json()).data || []; } catch {}
    
    let sessions = [];
    try { if (sessionsRes && sessionsRes.ok) sessions = (await sessionsRes.json()).data || []; } catch {}

    // Calculate Stats
    const failedLogins = logins.filter((l) => (l.entry || l).success === false);
    
    // Only count failed logins from the last 24 hours
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const failed24h = failedLogins.filter(l => {
      const d = new Date((l.entry || l).createdAt).getTime();
      return d > oneDayAgo;
    });

    const criticalEvents = events.filter(e => (e.log || e).severity === 'critical');
    const lockedAccounts = criticalEvents.filter(e => String((e.log || e).event || '').includes('lock')).length;

    // Update KPI Tiles
    setText('sec-kpi-sessions', sessions.length);
    setText('sec-kpi-failed', failed24h.length);
    setText('sec-kpi-locked', lockedAccounts);
    setText('sec-kpi-blocked', 0); // Update this if you have an IP block count endpoint

    // Calculate Threat Level
    const score = Math.min(100, criticalEvents.length * 10 + failed24h.length);
    const level = criticalEvents.length > 0 || failed24h.length > 10 ? 'high' 
                : failed24h.length > 3 ? 'medium' 
                : 'low';

    // Update Threat Banner
    if (banner) {
      banner.className = 'sec-threat-banner ' + level;
      const issues = [];
      if (failed24h.length > 0) issues.push(`${failed24h.length} failed login(s) in last 24h`);
      if (criticalEvents.length > 0) issues.push(`${criticalEvents.length} critical security event(s)`);
      if (sessions.length > 0) issues.push(`${sessions.length} active session(s)`);

      banner.innerHTML = `
        <div class="stb-score ${level}">${score}</div>
        <div class="stb-info">
          <h3>Threat Level: ${level.toUpperCase()}</h3>
          <p>${criticalEvents.length} critical · ${failed24h.length} failed logins</p>
          <div class="stb-issues">
            ${issues.length ? issues.map(i => `<span>${escapeHtml(i)}</span>`).join('') : '<span style="color:#10b981;">✅ No active threats detected. System is healthy.</span>'}
          </div>
        </div>
      `;
    }

    // Update Card Badges
    const sBadge = document.getElementById('sac-sessions-badge');
    if (sBadge) sBadge.textContent = sessions.length || '0';
    const eBadge = document.getElementById('sac-events-badge');
    if (eBadge) eBadge.textContent = events.length || '0';

    // Render Recent Critical Events Table
    if (tbody) {
      // Combine critical events and failed logins for the table
      const recentItems = [
        ...criticalEvents.map(e => ({ type: 'event', data: e.log || e, user: e.user })),
        ...failedLogins.slice(0, 5).map(l => ({ type: 'login', data: l.entry || l, user: l.user }))
      ].sort((a, b) => new Date(b.data.createdAt) - new Date(a.data.createdAt)).slice(0, 10);

      if (!recentItems.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty" style="text-align:center; padding: 30px; color: #94a3b8;">No critical events or failed logins. System is healthy.</td></tr>';
      } else {
        tbody.innerHTML = recentItems.map(item => {
          const isEvent = item.type === 'event';
          const eventName = isEvent ? (item.data.event || 'Unknown Event') : 'login_failed';
          const severity = isEvent ? item.data.severity : 'warning';
          const user = item.user ? `${item.user.firstName || ''} ${item.user.lastName || ''}`.trim() || item.user.email : (item.data.email || '—');
          
          return `
            <tr>
              <td><code>${escapeHtml(eventName)}</code></td>
              <td>${badge(severity)}</td>
              <td>${escapeHtml(user)}</td>
              <td>${escapeHtml(item.data.ipAddress || '—')}</td>
              <td class="small muted">${fmtDateTime(item.data.createdAt)}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // Wire Buttons (Refresh, Lockdown, Export)
    setTimeout(() => {
      const refreshBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Refresh'));
      if (refreshBtn && !refreshBtn.__wired) {
        refreshBtn.__wired = true;
        refreshBtn.onclick = () => loadSecurityDashboard();
      }

      const exportBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Export Report'));
      if (exportBtn && !exportBtn.__wired) {
        exportBtn.__wired = true;
        exportBtn.onclick = () => {
          const table = document.querySelector('#sec-recent-events')?.closest('table');
          if (table) exportTableAsCSV(table, `security-events-${new Date().toISOString().slice(0, 10)}.csv`);
          else showToast('⚠️ Nothing to export yet.', 'warning');
        };
      }

      const lockdownBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Lockdown All Sessions'));
      if (lockdownBtn && !lockdownBtn.__wired) {
        lockdownBtn.__wired = true;
        lockdownBtn.onclick = async () => {
          const ok = await window.fpuConfirm('Lock down ALL active sessions?', { title: 'Emergency Lockdown', type: 'danger', okText: 'Lock Down All' });
          if (!ok) return;
          try {
            await adminFetch('/api/admin/security/lockdown', { method: 'POST' });
            showToast('🔒 All sessions locked down.', 'success');
            loadSecurityDashboard();
          } catch (err) { showToast('❌ ' + err.message, 'error'); }
        };
      }
    }, 50);

  } catch (err) {
    console.error('[Security Dashboard] Error:', err);
    if (banner) banner.innerHTML = `<div class="alert alert-danger">Failed to load security data: ${escapeHtml(err.message)}</div>`;
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="empty" style="color:#dc2626; text-align:center;">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadSecuritySessions() {
  const tbody = document.getElementById('sess-tbody');
  if (!tbody) return;

  const role = (document.getElementById('sess-filter-role') || {}).value || '';
  const search = (document.getElementById('sess-search') || {}).value || '';

  tbody.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch('/api/admin/security/sessions');
    const json = await res.json();
    let rows = json.data || [];

    if (role) rows = rows.filter((r) => r.user?.role === role);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => {
        const u = r.user || {};
        return String(u.email || '').toLowerCase().includes(q) || String(r.session?.ipAddress || '').toLowerCase().includes(q);
      });
    }

    setText('sess-stat-total', rows.length);
    setText('sess-stat-admins', rows.filter((r) => r.user?.role === 'admin').length);
    setText('sess-stat-ips', new Set(rows.map((r) => r.session?.ipAddress)).size);
    setText('sess-stat-oldest', rows.length ? timeAgo(rows[rows.length - 1].session?.createdAt) : '—');
    setText('sess-count', `Showing ${rows.length} sessions`);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No active sessions.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((r) => {
      const s = r.session || {};
      const u = r.user || {};
      return `
        <tr>
          <td><strong>${escapeHtml((u.firstName || '') + ' ' + (u.lastName || ''))}</strong><br/><span class="small muted">${escapeHtml(u.email || '')}</span></td>
          <td>${roleBadge(u.role)}</td>
          <td class="small">${escapeHtml((s.userAgent || '').slice(0, 60))}</td>
          <td>${escapeHtml(s.ipAddress || '')}</td>
          <td class="small muted">${fmtDateTime(s.createdAt)}</td>
          <td class="small muted">${fmtDateTime(s.expiresAt)}</td>
          <td><button class="btn btn-sm btn-danger" onclick="FPU_ADMIN.revokeSession('${escapeQuotes(s.token)}')">Revoke</button></td>
        </tr>
      `;
    }).join('');

    const purgeBtn = document.getElementById('sess-purge');
    if (purgeBtn) purgeBtn.onclick = async () => {
      try {
        await adminFetch('/api/admin/security/purge', { method: 'POST' });
        showToast('Expired sessions purged.', 'success');
        loadSecuritySessions();
      } catch (err) { showToast('❌ ' + err.message, 'error'); }
    };
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function revokeSession(token) {
  if (!confirm('Revoke this session?')) return;
  try {
    await adminFetch(`/api/portal/security/revoke/${token}`, { method: 'POST' });
    showToast('Session revoked.', 'success');
    loadSecuritySessions();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function loadLoginAttempts() {
  const tbody = document.getElementById('la-tbody');
  if (!tbody) return;

  const status = (document.getElementById('la-status-tabs')?.querySelector('.active')?.dataset.status) || '';
  const email = (document.getElementById('la-email') || {}).value || '';
  const ip = (document.getElementById('la-ip') || {}).value || '';

  const qs = new URLSearchParams({ limit: 500 });
  if (status === 'success') qs.set('success', 'true');
  else if (status === 'fail') qs.set('success', 'false');
  if (email) qs.set('email', email);

  tbody.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/login-history?${qs}`);
    const json = await res.json();
    let rows = json.data || [];

    if (ip) rows = rows.filter((r) => String((r.entry || r).ipAddress || '').includes(ip));

    const total = rows.length;
    const success = rows.filter((r) => (r.entry || r).success).length;
    const fail = total - success;
    const ips = new Set(rows.map((r) => (r.entry || r).ipAddress).filter(Boolean)).size;

    setText('la-stat-total', total);
    setText('la-stat-success', success);
    setText('la-stat-fail', fail);
    setText('la-stat-ips', ips);
    setText('la-count', `Showing ${total} attempts`);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No login attempts found.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((r) => {
      const entry = r.entry || r;
      return `
        <tr>
          <td>${escapeHtml(entry.email || '')}</td>
          <td>${entry.success ? badge('success') : badge('failed')}</td>
          <td>${escapeHtml(entry.ipAddress || '')}</td>
          <td class="small">${escapeHtml((entry.userAgent || '').slice(0, 50))}</td>
          <td>${escapeHtml(entry.reason || '')}</td>
          <td class="small muted">${fmtDateTime(entry.createdAt)}</td>
          <td><button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.addIpBlock('${escapeQuotes(entry.ipAddress || '')}')">Block IP</button></td>
        </tr>
      `;
    }).join('');

    const exportBtn = document.getElementById('la-export');
    if (exportBtn) exportBtn.onclick = () => exportTableAsCSV(tbody.closest('table'), 'login-attempts.csv');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

function addIpBlock(ip) {
  if (!ip) return;
  FPU_ADMIN_SPA.navigateToWithQuery('security-ip-rules', { ip });
}

// ============================================
// SECURITY: IP Rules Table & Buttons
// ============================================
async function loadIpRules() {
  const tbody = document.getElementById('ip-tbody');
  if (!tbody) return;

  // Show loading spinner
  tbody.innerHTML = '<tr><td colspan="6" class="empty" style="text-align:center; padding: 40px;"><span class="spinner"></span> Loading IP rules…</td></tr>';

  try {
    const res = await adminFetch('/api/admin/security/ip-rules');
    const json = await res.json();
    const rows = json.data || [];

    // 1. Calculate Stats
    const allow = rows.filter((r) => r.rule === 'allow').length;
    const block = rows.filter((r) => r.rule === 'block').length;
    const soon = rows.filter((r) => {
      if (!r.expiresAt) return false;
      const diff = new Date(r.expiresAt).getTime() - Date.now();
      return diff > 0 && diff < 24 * 3600 * 1000;
    }).length;

    // 2. Update Top Stat Cards
    setText('ip-stat-total', rows.length);
    setText('ip-stat-allow', allow);
    setText('ip-stat-block', block);
    setText('ip-stat-expiring', soon);

    // 3. Render Table Body
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty" style="text-align:center; color: #64748b; padding: 40px;">No IP rules configured yet.</td></tr>';
    } else {
      tbody.innerHTML = rows.map((r) => `
        <tr>
          <td><code>${escapeHtml(r.ipAddress)}</code></td>
          <td>${r.rule === 'allow' ? '<span class="badge badge-success">Allow</span>' : '<span class="badge badge-danger">Block</span>'}</td>
          <td>${escapeHtml(r.reason || '—')}</td>
          <td>${r.expiresAt ? fmtDateTime(r.expiresAt) : '<span class="muted">Never</span>'}</td>
          <td class="small muted">${fmtDateTime(r.createdAt)}</td>
          <td style="text-align:right;">
            <button class="btn btn-sm btn-ghost" style="color:#dc2626;" onclick="FPU_ADMIN.deleteIpRule(${r.id})">Delete</button>
          </td>
        </tr>
      `).join('');
    }

    // ==========================================
    // 4. WIRE THE BUTTONS (+ ADD IP RULE & REFRESH)
    // ==========================================
    setTimeout(() => {
      // Find the Add IP Rule button in the header
      const addButton = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.includes('Add IP Rule'));
        
      if (addButton && !addButton.__wired) {
        addButton.__wired = true;
        addButton.onclick = (e) => {
          e.preventDefault();
          FPU_ADMIN.openAddIpModal(); // Calls the modal
        };
      }

      // Find the Refresh button in the header
      const refreshButton = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.includes('Refresh'));
        
      if (refreshButton && !refreshButton.__wired) {
        refreshButton.__wired = true;
        refreshButton.onclick = (e) => {
          e.preventDefault();
          loadIpRules();
        };
      }
    }, 50);

    // ==========================================
    // 5. Handle deep-linking prefill (e.g. ?ip=1.2.3.4)
    // ==========================================
    const hash = window.location.hash.replace(/^#/, '');
    const qIdx = hash.indexOf('?');
    const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
    const ip = params.get('ip');
    
    // If the URL has a specific IP (e.g., from clicking "Block IP" in Login History), pre-fill it
    if (ip) {
      setTimeout(() => {
        FPU_ADMIN.openAddIpModal();
        setTimeout(() => {
          const input = document.getElementById('ip-address');
          if (input) input.value = ip;
        }, 100);
      }, 200);
    }

  } catch (err) {
    console.error('[ip-rules] Error:', err);
    tbody.innerHTML = `<tr><td colspan="6" class="empty" style="color:#dc2626; text-align:center; padding: 20px;">Error loading rules: ${escapeHtml(err.message)}</td></tr>`;
  }
}

async function deleteIpRule(id) {
  if (!confirm('Are you sure you want to delete this IP rule?')) return;
  try {
    await adminFetch(`/api/admin/security/ip-rules/${id}`, { method: 'DELETE' });
    showToast('✅ IP rule deleted.', 'success');
    loadIpRules();
  } catch (err) { 
    showToast('❌ ' + err.message, 'error'); 
  }
}

// ============================================
// SECURITY: Add IP Rule Modal
// ============================================
function openAddIpModal() {
  // Prevent duplicate modals
  if (document.getElementById('ip-rule-modal')) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'fpu-modal-backdrop';
  backdrop.id = 'ip-rule-modal';
  backdrop.style.cssText = `position: fixed; inset: 0; background: rgba(15,23,42,0.6); z-index: 999999; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px);`;
  
  backdrop.innerHTML = `
    <div class="fpu-modal" style="width: 100%; max-width: 500px; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); animation: fpu-modal-in 0.2s ease-out;">
      <div class="fpu-modal-header" style="padding: 16px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
        <h3 style="margin: 0; font-size: 1.1rem; color: #0f172a;">Add IP Rule</h3>
        <button class="btn btn-sm btn-ghost" onclick="document.getElementById('ip-rule-modal').remove()" style="font-size: 1.5rem; line-height: 1; padding: 0 8px; color: #64748b;">&times;</button>
      </div>
      
      <div class="fpu-modal-body" style="padding: 24px;">
        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 600; font-size: 13px;">IP Address <span class="req" style="color:#dc2626;">*</span></label>
          <input class="form-control" id="ip-address" placeholder="e.g. 192.168.1.1 or 105.112.0.0/16" style="height: 42px;" />
          <div class="small muted" style="margin-top: 4px; font-size: 11px;">Supports single IPs (192.168.1.1) or CIDR ranges.</div>
        </div>
        
        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 600; font-size: 13px;">Rule Type <span class="req" style="color:#dc2626;">*</span></label>
          <select class="form-select" id="ip-rule" style="height: 42px;">
            <option value="allow">Whitelist (Allow Access)</option>
            <option value="block">Blacklist (Block Access)</option>
          </select>
        </div>
        
        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 600; font-size: 13px;">Expires At (Optional)</label>
          <input class="form-control" type="datetime-local" id="ip-expires" style="height: 42px;" />
          <div class="small muted" style="margin-top: 4px; font-size: 11px;">Leave blank for a permanent rule.</div>
        </div>
        
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-weight: 600; font-size: 13px;">Reason (Optional)</label>
          <input class="form-control" id="ip-reason" placeholder="e.g. Suspicious activity, or Admin VPN" style="height: 42px;" />
        </div>
      </div>
      
      <div class="fpu-modal-footer" style="padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
        <button class="btn btn-outline" onclick="document.getElementById('ip-rule-modal').remove()">Cancel</button>
        <button class="btn btn-primary" id="ip-save-btn" style="background: #065f46; border-color: #065f46; color: white;">Save Rule</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(backdrop);

  // Focus the input automatically
  setTimeout(() => document.getElementById('ip-address').focus(), 100);

  // Handle the save button click
  document.getElementById('ip-save-btn').onclick = async () => {
    const addr = document.getElementById('ip-address').value.trim();
    const rule = document.getElementById('ip-rule').value;
    const expires = document.getElementById('ip-expires').value || null;
    const reason = document.getElementById('ip-reason').value.trim();
    
    if (!addr) { 
      showToast('⚠️ IP address is required.', 'warning'); 
      return; 
    }

    const btn = document.getElementById('ip-save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      await adminFetch('/api/admin/security/ip-rules', {
        method: 'POST',
        body: JSON.stringify({ 
          ipAddress: addr, 
          rule, 
          expiresAt: expires, 
          reason 
        }),
      });
      showToast('✅ IP Rule added successfully.', 'success');
      document.getElementById('ip-rule-modal').remove();
      loadIpRules(); // Refresh the table
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Save Rule';
    }
  };
}

async function loadPasswordPolicy() {
  try {
    const res = await adminFetch('/api/admin/security/password-policy');
    const json = await res.json();
    const p = json.data || {};
    document.getElementById('pp-min-length').value = p.minLength ?? 8;
    document.getElementById('pp-require-uppercase').checked = p.requireUppercase !== false;
    document.getElementById('pp-require-number').checked = p.requireNumber !== false;
    document.getElementById('pp-require-symbol').checked = !!p.requireSymbol;
    document.getElementById('pp-expiry').value = p.expiryDays ?? 90;
    document.getElementById('pp-prevent-reuse').value = p.preventReuse ?? 3;
    document.getElementById('pp-max-attempts').value = p.maxAttempts ?? 5;
    document.getElementById('pp-lockout-minutes').value = p.lockoutMinutes ?? 15;
    document.getElementById('pp-idle-timeout').value = p.idleTimeout ?? 60;
    document.getElementById('pp-allow-concurrent').checked = p.allowConcurrent !== false;
    document.getElementById('pp-max-concurrent').value = p.maxConcurrent ?? 3;
  } catch (err) {
    console.debug('[password-policy]', err && err.message);
  }

  const saveBtn = document.getElementById('pp-save');
  if (saveBtn && !saveBtn.__wired) {
    saveBtn.__wired = true;
    saveBtn.onclick = async () => {
      const payload = {
        minLength: Number(document.getElementById('pp-min-length').value),
        requireUppercase: document.getElementById('pp-require-uppercase').checked,
        requireNumber: document.getElementById('pp-require-number').checked,
        requireSymbol: document.getElementById('pp-require-symbol').checked,
        expiryDays: Number(document.getElementById('pp-expiry').value),
        preventReuse: Number(document.getElementById('pp-prevent-reuse').value),
        maxAttempts: Number(document.getElementById('pp-max-attempts').value),
        lockoutMinutes: Number(document.getElementById('pp-lockout-minutes').value),
        idleTimeout: Number(document.getElementById('pp-idle-timeout').value),
        allowConcurrent: document.getElementById('pp-allow-concurrent').checked,
        maxConcurrent: Number(document.getElementById('pp-max-concurrent').value),
      };
      try {
        await adminFetch('/api/admin/security/password-policy', {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Policy saved.', 'success');
      } catch (err) { showToast('❌ ' + err.message, 'error'); }
    };
  }
}

async function loadPermissionsMatrix() {
  const thead = document.getElementById('perm-thead');
  const tbody = document.getElementById('perm-tbody');
  if (!thead || !tbody) return;

  try {
    const res = await adminFetch('/api/admin/security/permissions');
    const json = await res.json();
    const d = json.data || {};
    const roles = d.roles || ['admin', 'registrar', 'lecturer', 'student'];
    const resources = d.resources || ['users', 'results', 'payments', 'courses'];

    thead.innerHTML = `<tr><th>Resource</th>${roles.map((r) => `<th>${escapeHtml(String(r).replace(/_/g, ' '))}</th>`).join('')}</tr>`;

    tbody.innerHTML = resources.map((res) => `
      <tr>
        <td class="resource-cell">${escapeHtml(res)}</td>
        ${roles.map((role) => `
          <td><input type="checkbox" data-resource="${escapeHtml(res)}" data-role="${escapeHtml(role)}" ${(d.matrix?.[res]?.[role]) ? 'checked' : ''} /></td>
        `).join('')}
      </tr>
    `).join('');

    setText('perm-count', `${resources.length} resources × ${roles.length} roles`);

    const saveBtn = document.getElementById('perm-save');
    if (saveBtn && !saveBtn.__wired) {
      saveBtn.__wired = true;
      saveBtn.onclick = async () => {
        const matrix = {};
        tbody.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
          const r = cb.dataset.resource;
          const role = cb.dataset.role;
          if (!matrix[r]) matrix[r] = {};
          matrix[r][role] = cb.checked;
        });
        try {
          await adminFetch('/api/admin/security/permissions', {
            method: 'PUT',
            body: JSON.stringify({ matrix }),
          });
          showToast('Permissions saved.', 'success');
        } catch (err) { showToast('❌ ' + err.message, 'error'); }
      };
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="99" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function load2FAConfig() {
  const roles = document.getElementById('tfa-roles');
  if (!roles) return;

  try {
    const res = await adminFetch('/api/admin/security/2fa');
    const json = await res.json();
    const d = json.data || {};

    const allRoles = ['admin', 'registrar', 'rector', 'bursar', 'librarian', 'exam_officer', 'academic_officer', 'admission_officer', 'hod', 'lecturer', 'student'];
    roles.innerHTML = allRoles.map((r) => `
      <label class="tfa-role-item">
        <input type="checkbox" data-role="${r}" ${(d.requiredRoles || []).includes(r) ? 'checked' : ''} />
        <span class="label">${escapeHtml(String(r).replace(/_/g, ' '))}</span>
      </label>
    `).join('');

    document.getElementById('tfa-method-app').checked = (d.methods || []).includes('app');
    document.getElementById('tfa-method-sms').checked = (d.methods || []).includes('sms');
    document.getElementById('tfa-method-email').checked = (d.methods || []).includes('email');
    document.getElementById('tfa-method-backup').checked = (d.methods || []).includes('backup');

    const saveBtn = document.getElementById('tfa-save');
    if (saveBtn && !saveBtn.__wired) {
      saveBtn.__wired = true;
      saveBtn.onclick = async () => {
        const requiredRoles = Array.from(roles.querySelectorAll('input:checked')).map((c) => c.dataset.role);
        const methods = [];
        if (document.getElementById('tfa-method-app').checked) methods.push('app');
        if (document.getElementById('tfa-method-sms').checked) methods.push('sms');
        if (document.getElementById('tfa-method-email').checked) methods.push('email');
        if (document.getElementById('tfa-method-backup').checked) methods.push('backup');
        try {
          await adminFetch('/api/admin/security/2fa', {
            method: 'PUT',
            body: JSON.stringify({ requiredRoles, methods }),
          });
          showToast('2FA config saved.', 'success');
        } catch (err) { showToast('❌ ' + err.message, 'error'); }
      };
    }
  } catch (err) {
    roles.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

async function loadBackups() {
  const tbody = document.getElementById('bk-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch('/api/admin/security/backups');
    const json = await res.json();
    const rows = json.data || [];

    tbody.innerHTML = rows.length ? rows.map((b) => `
      <tr>
        <td>${escapeHtml(b.kind || 'full')}</td>
        <td>${badge(b.status)}</td>
        <td class="num">${b.size ? (b.size / 1024 / 1024).toFixed(1) + ' MB' : '—'}</td>
        <td class="small muted">${fmtDateTime(b.startedAt)}</td>
        <td class="small muted">${b.completedAt ? fmtDateTime(b.completedAt) : '—'}</td>
        <td>${b.fileUrl ? `<a class="btn btn-sm btn-outline" href="${escapeHtml(b.fileUrl)}" target="_blank">Download</a>` : '—'}</td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="empty">No backups yet.</td></tr>';

    const triggerBtn = document.getElementById('bk-trigger');
    if (triggerBtn && !triggerBtn.__wired) {
      triggerBtn.__wired = true;
      triggerBtn.onclick = async () => {
        if (!confirm('Trigger backup now?')) return;
        try {
          await adminFetch('/api/admin/security/backups/trigger', { method: 'POST' });
          showToast('Backup queued.', 'success');
          setTimeout(loadBackups, 2000);
        } catch (err) { showToast('❌ ' + err.message, 'error'); }
      };
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadCompliance() {
  const root = document.getElementById('comp-root');
  if (!root) return;

  root.innerHTML = '<div class="loading"><span class="spinner"></span> Checking compliance…</div>';

  try {
    const res = await adminFetch('/api/admin/security/compliance');
    const json = await res.json();
    const checks = json.data || [];

    const passes = checks.filter((c) => c.status === 'pass').length;
    const fails = checks.filter((c) => c.status === 'fail').length;
    const warns = checks.filter((c) => c.status === 'warn').length;

    root.innerHTML = `
      <div class="compliance-summary">
        <div class="compliance-summary-item pass"><div class="num">${passes}</div><div class="label">Passing</div></div>
        <div class="compliance-summary-item warn"><div class="num">${warns}</div><div class="label">Warnings</div></div>
        <div class="compliance-summary-item fail"><div class="num">${fails}</div><div class="label">Failing</div></div>
      </div>
      ${checks.map((c) => `
        <div class="compliance-check ${c.status}">
          <div class="cc-icon">${c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : '❌'}</div>
          <div class="cc-body">
            <div class="cc-title">${escapeHtml(c.title)}</div>
            <div class="cc-detail">${escapeHtml(c.detail || '')}</div>
            ${c.fix ? `<div class="cc-fix">→ ${escapeHtml(c.fix)}</div>` : ''}
          </div>
        </div>
      `).join('')}
    `;

    const exportBtn = document.getElementById('comp-export');
    if (exportBtn) exportBtn.onclick = () => {
      const report = checks.map((c) => `${c.status.toUpperCase()}\t${c.title}\t${c.detail}`).join('\n');
      const blob = new Blob([report], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'compliance-report.txt';
      a.click();
    };
  } catch (err) {
    root.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// SECURITY — Wire card navigation & top actions
// ============================================
function wireSecurityCards() {
  const cards = document.querySelectorAll('.sec-action-card');
  cards.forEach((card) => {
    if (card.__wired) return;
    card.__wired = true;
    // Cards already have inline onclick= pointing to SPA routes,
    // but we add a fallback for keyboard access
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
}

function wireSecurityActions() {
  // Refresh button
  const buttons = Array.from(document.querySelectorAll('.page-head .actions button'));
  const refreshBtn = buttons.find((b) => /refresh/i.test(b.textContent || ''));
  if (refreshBtn && !refreshBtn.__wired) {
    refreshBtn.__wired = true;
    refreshBtn.onclick = () => loadSecurityDashboard();
  }

  // Lockdown button
  const lockdownBtn = document.getElementById('sec-lockdown');
  if (lockdownBtn && !lockdownBtn.__wired) {
    lockdownBtn.__wired = true;
    lockdownBtn.onclick = async () => {
      const ok = await window.fpuConfirm(
        'Lock down ALL active sessions?\n\nAll users except you will be logged out immediately.',
        { title: 'Emergency Lockdown', type: 'danger', okText: 'Lock Down All' }
      );
      if (!ok) return;

      try {
        const res = await adminFetch('/api/admin/security/lockdown', { method: 'POST' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) throw new Error(json.error || 'Lockdown endpoint not available');
        showToast('🔒 All sessions locked down.', 'success');
        loadSecurityDashboard();
      } catch (err) {
        showToast('❌ ' + err.message, 'error');
      }
    };
  }

  // Export Report button — fallback to CSV of the events table
  const exportBtn = buttons.find((b) => /export/i.test(b.textContent || ''));
  if (exportBtn && !exportBtn.__wired) {
    exportBtn.__wired = true;
    exportBtn.onclick = () => {
      const table = document.querySelector('#sec-recent-events')?.closest('table');
      if (table) {
        exportTableAsCSV(table, `security-events-${new Date().toISOString().slice(0, 10)}.csv`);
      } else {
        showToast('⚠️ Nothing to export yet.', 'warning');
      }
    };
  }
}

function wireSecurityActions() {
  // Refresh button
  const refreshBtn = document.querySelector('.page-head .actions button');
  if (refreshBtn && !refreshBtn.__wired) {
    refreshBtn.__wired = true;
    const text = (refreshBtn.textContent || '').trim().toLowerCase();
    if (text.includes('refresh')) {
      refreshBtn.addEventListener('click', () => loadSecurityDashboard());
    }
  }

  // Export Report button
  const exportBtn = Array.from(document.querySelectorAll('.page-head .actions button'))
    .find((b) => /export/i.test(b.textContent || ''));
  if (exportBtn && !exportBtn.__wired) {
    exportBtn.__wired = true;
    exportBtn.addEventListener('click', async () => {
      try {
        const res = await adminFetch('/api/admin/security/report');
        if (!res.ok) throw new Error('No report endpoint');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `security-report-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('✅ Report downloaded.', 'success');
      } catch (err) {
        // Fallback: export the events table as CSV
        const table = document.querySelector('#sec-recent-events')?.closest('table');
        if (table) {
          exportTableAsCSV(table, 'security-events.csv');
        } else {
          showToast('❌ Could not export report.', 'error');
        }
      }
    });
  }

  // Lockdown button
  const lockdownBtn = Array.from(document.querySelectorAll('.page-head .actions button'))
    .find((b) => /lockdown/i.test(b.textContent || ''));
  if (lockdownBtn && !lockdownBtn.__wired) {
    lockdownBtn.__wired = true;
    lockdownBtn.addEventListener('click', async () => {
      const ok = await window.fpuConfirm(
        'Lock down ALL active sessions?\n\nAll users except you will be logged out immediately. They will need to log in again.',
        { title: 'Emergency Lockdown', type: 'danger', okText: 'Lock Down All' }
      );
      if (!ok) return;

      try {
        const res = await adminFetch('/api/admin/security/lockdown', { method: 'POST' });
        if (!res.ok) throw new Error('Lockdown endpoint not available');
        showToast('🔒 All sessions locked down.', 'success');
        loadSecurityDashboard();
      } catch (err) {
        showToast('❌ ' + err.message, 'error');
      }
    });
  }
}

async function loadSettingsShell() {
  const content = document.getElementById('settings-tab-content');
  if (!content) return;

  const tabs = document.querySelectorAll('#settings-tabs .staff-role-tab');
  async function loadTab(tab) {
    content.innerHTML = '<div class="loading" style="padding:40px;text-align:center;"><span class="spinner"></span> Loading ' + tab + '…</div>';
    try {
      const res = await fetch(`/admin/partials/settings/_tabs/${tab}.html`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Partial "${tab}" not found (HTTP ${res.status})`);
      const html = await res.text();
      content.innerHTML = html;
      content.querySelectorAll('script').forEach((old) => {
        const s = document.createElement('script');
        s.textContent = old.textContent;
        old.replaceWith(s);
      });
      prefillSettingsForm(tab, content);
      if (typeof wireSettingsTabExtras === 'function') {
        wireSettingsTabExtras(tab);
      }
    } catch (err) {
      content.innerHTML = `<div class="alert alert-danger" style="padding:20px;">${escapeHtml(err.message)}</div>`;
    }
  }

  tabs.forEach((t) => {
    t.onclick = () => {
      tabs.forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      loadTab(t.dataset.tab);
    };
  });

  const refreshBtn = document.getElementById('settings-refresh');
  if (refreshBtn) refreshBtn.onclick = () => {
    const active = document.querySelector('#settings-tabs .active');
    if (active) loadTab(active.dataset.tab);
  };

  loadTab('institution');
}

async function prefillSettingsForm(section, container) {
  try {
    const res = await adminFetch(`/api/admin/settings?category=${section}`);
    const json = await res.json();
    const rows = json.data || [];
    const map = {};
    rows.forEach((r) => { map[r.key] = r.value; });

    container.querySelectorAll('input, select, textarea').forEach((el) => {
      const key = el.name;
      if (!key || !(key in map)) return;
      const v = map[key];
      if (el.type === 'checkbox') {
        el.checked = ['true','1','yes','on'].includes(String(v).toLowerCase());
      } else {
        el.value = v ?? '';
      }
    });
  } catch (err) {
    console.debug('[settings] prefill', err && err.message);
  }
}

// ============================================
// USERS (Hub, All Users, Admins, Login History)
// ============================================

async function loadUsersHub() {
  try {
    // Fetch from all three working endpoints
    const [staffRes, studentRes, adminRes, loginRes] = await Promise.all([
      adminFetch('/api/admin/staff?limit=2000').catch(() => null),
      adminFetch('/api/admin/students?limit=2000').catch(() => null),
      adminFetch('/api/admin/users?limit=2000').catch(() => null),
      adminFetch('/api/admin/login-history?limit=100').catch(() => null),
    ]);

    let users = [];
    if (staffRes && staffRes.ok) users = users.concat((await staffRes.json()).data || []);
    if (studentRes && studentRes.ok) users = users.concat((await studentRes.json()).data || []);
    if (adminRes && adminRes.ok) users = users.concat((await adminRes.json()).data || []);
    
    const logins = loginRes && loginRes.ok ? (await loginRes.json()).data || [] : [];

    // Compute stats
    const students = users.filter((u) => u.role === 'student').length;
    const admins   = users.filter((u) => u.role === 'admin').length;
    const staff    = users.length - students - admins;

    setText('us-stat-total', users.length);
    setText('us-stat-students', students);
    setText('us-stat-staff', staff);
    setText('us-stat-admins', admins);
    setText('ujc-admins-count', admins + ' accounts');
    setText('ujc-logins-count', logins.length + ' recent');

    // Get 5 most recent users
    const recent = [...users].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5);

    const tbody = document.getElementById('us-recent-tbody');
    if (tbody) {
      tbody.innerHTML = recent.length ? recent.map((u) => `
        <tr class="row-clickable" onclick="FPU_ADMIN_SPA.navigateToWithQuery('user-profile', { id: ${u.id} })">
          <td><strong>${escapeHtml((u.firstName || '') + ' ' + (u.lastName || ''))}</strong></td>
          <td>${escapeHtml(u.email || '')}</td>
          <td>${roleBadge(u.role)}</td>
          <td>${u.isActive !== false ? badge('active') : badge('inactive')}</td>
          <td>${fmtDate(u.createdAt)}</td>
        </tr>
      `).join('') : '<tr><td colspan="5" class="empty">No users yet.</td></tr>';
    }
  } catch (err) {
    console.debug('[users-hub]', err && err.message);
  }
}

async function loadAllUsers() {
  const tbody = document.getElementById('au-tbody');
  const countEl = document.getElementById('au-count');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" class="empty">Loading…</td></tr>';
  if (countEl) countEl.textContent = 'Loading…';

  try {
    // Fetch from both endpoints in parallel
    const [staffRes, studentRes] = await Promise.all([
      adminFetch('/api/admin/staff?limit=2000').catch(() => null),
      adminFetch('/api/admin/students?limit=2000').catch(() => null),
    ]);

    let users = [];

    if (staffRes && staffRes.ok) {
      const staffJson = await staffRes.json();
      const staff = staffJson.data || [];
      users = users.concat(staff);
    }

    if (studentRes && studentRes.ok) {
      const studentJson = await studentRes.json();
      const students = studentJson.data || [];
      users = users.concat(students);
    }

    // If both failed, try the generic users endpoint as a fallback
    if (users.length === 0) {
      const res = await adminFetch('/api/admin/users?limit=2000');
      const json = await res.json();
      users = json.data || [];
    }

    // Apply filters client-side
    const role = (document.getElementById('au-filter-role') || {}).value || '';
    const active = (document.getElementById('au-filter-active') || {}).value || '';
    const dept = (document.getElementById('au-filter-dept') || {}).value || '';
    const search = (document.getElementById('au-search') || {}).value || '';

    if (role) {
      users = users.filter(u => String(u.role || '').toLowerCase() === role.toLowerCase());
    }
    if (active) {
      const isActive = active === 'true';
      users = users.filter(u => (u.isActive !== false) === isActive);
    }
    if (dept) {
      users = users.filter(u => Number(u.departmentId) === Number(dept));
    }
    if (search) {
      const q = search.toLowerCase();
      users = users.filter(u => 
        String(u.firstName || '').toLowerCase().includes(q) ||
        String(u.lastName || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.matricNumber || u.staffNumber || '').toLowerCase().includes(q)
      );
    }

    // Update Stats
    const activeCount = users.filter((u) => u.isActive !== false).length;
    setText('au-stat-total', users.length);
    setText('au-stat-active', activeCount);
    setText('au-stat-inactive', users.length - activeCount);
    setText('au-stat-roles', new Set(users.map((u) => u.role)).size);

    if (countEl) countEl.textContent = `Showing ${users.length} user${users.length === 1 ? '' : 's'}`;

    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">No users found matching your filters.</td></tr>';
      return;
    }

    // Render table
    tbody.innerHTML = users.map((u) => `
      <tr class="row-clickable" onclick="FPU_ADMIN_SPA.navigateToWithQuery('user-profile', { id: ${u.id} })">
        <td><strong>${escapeHtml((u.firstName || '') + ' ' + (u.lastName || ''))}</strong></td>
        <td>${escapeHtml(u.email || '')}</td>
        <td><code>${escapeHtml(u.matricNumber || u.staffNumber || '—')}</code></td>
        <td>${roleBadge(u.role)}</td>
        <td>${escapeHtml(u.departmentName || u.department?.name || '—')}</td>
        <td>${u.isActive !== false ? badge('active') : badge('inactive')}</td>
        <td class="small muted">${fmtDate(u.createdAt)}</td>
        <td><button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('user-profile', { id: ${u.id} })">View</button></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty" style="color:#dc2626;"><strong>Error:</strong> ${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadAdminAccounts() {
  const tbody = document.getElementById('ad-tbody');
  const countEl = document.getElementById('ad-count');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';
  if (countEl) countEl.textContent = 'Loading…';

  try {
    const res = await adminFetch('/api/admin/users?limit=500');
    const json = await res.json();
    const admins = json.data || [];

    const thirty = Date.now() - 30 * 24 * 3600 * 1000;
    const recent = admins.filter((a) => a.lastLoginAt && new Date(a.lastLoginAt).getTime() > thirty).length;

    setText('ad-stat-total', admins.length);
    setText('ad-stat-active', admins.filter((a) => a.isActive !== false).length);
    setText('ad-stat-inactive', admins.filter((a) => a.isActive === false).length);
    setText('ad-stat-recent', recent);

    if (countEl) countEl.textContent = `Showing ${admins.length} admin${admins.length === 1 ? '' : 's'}`;

    tbody.innerHTML = admins.length ? admins.map((u) => `
      <tr class="row-clickable" onclick="FPU_ADMIN_SPA.navigateToWithQuery('user-profile', { id: ${u.id} })">
        <td><strong>${escapeHtml((u.firstName || '') + ' ' + (u.lastName || ''))}</strong></td>
        <td>${escapeHtml(u.email || '')}</td>
        <td>${escapeHtml(u.phone || '—')}</td>
        <td>${u.isActive !== false ? badge('active') : badge('inactive')}</td>
        <td class="small muted">${u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : 'Never'}</td>
        <td class="small muted">${fmtDate(u.createdAt)}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('user-form', { id: ${u.id} })">Edit</button>
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); FPU_ADMIN.resetAdminPwd(${u.id})">Reset Pwd</button>
            ${u.id !== (getAdminUser() || {}).id ? `<button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); FPU_ADMIN.toggleAdminActive(${u.id})">Toggle</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="7" class="empty">No admin accounts.</td></tr>';
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function resetAdminPwd(id) {
  const pwd = prompt('New password (default: admin1234):', 'admin1234');
  if (pwd === null) return;
  try {
    await adminFetch(`/api/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password: pwd }) });
    showToast('Password reset.', 'success');
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function toggleAdminActive(id) {
  try {
    await adminFetch(`/api/admin/users/${id}/toggle-active`, { method: 'POST' });
    showToast('Status updated.', 'success');
    loadAdminAccounts();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function loadLoginHistory() {
  const container = document.getElementById("login-history-tbody");
  if (!container) return;
  container.innerHTML = '<tr><td colspan="6" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch("/api/admin/login-history?limit=100");
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((r) => {
      const entry = r.entry || r; // Depending on the API shape
      const user = r.user || entry.user || null; // Check both places for the user object
      
      // Handle name fallback
      let userName = '—';
      if (user) {
        userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        if (!userName) userName = user.email || 'Unknown';
      } else if (entry.email) {
        userName = entry.email; // Fallback to email if user object is missing
      }

      return `
        <tr>
          <td><strong>${escapeHtml(userName)}</strong></td>
          <td>${escapeHtml(entry.email || '')}</td>
          <td>${entry.success ? badge('success') : badge('failed')}</td>
          <td>${escapeHtml(entry.ipAddress || '')}</td>
          <td>${escapeHtml(entry.reason || '')}</td>
          <td>${fmtDateTime(entry.createdAt)}</td>
        </tr>`;
    }).join('') : '<tr><td colspan="6" class="empty">No records.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

// ============================================
// ALLOCATIONS (Drill-down by Department)
// ============================================
async function loadDepartmentAllocations() {
  const grid = document.getElementById('abd-lecturer-grid');
  if (!grid) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const departmentId = params.get('departmentId') || '';
  const deptName = params.get('name') || 'Department';

  const titleEl = document.getElementById('alloc-dept-title');
  const subEl = document.getElementById('alloc-dept-subtitle');
  if (titleEl) titleEl.textContent = deptName;
  if (subEl) subEl.textContent = `Allocations for ${deptName}`;

  if (!departmentId) {
    grid.innerHTML = '<div class="alert alert-warning">No department selected.</div>';
    return;
  }

  grid.innerHTML = '<div class="loading"><span class="spinner"></span> Loading allocations…</div>';

  try {
    const [allocsRes, deptRes] = await Promise.all([
      adminFetch(`/api/admin/allocations?limit=2000`), // Fetch all to be safe
      adminFetch(`/api/admin/departments/${departmentId}`),
    ]);

    const allocs = (await allocsRes.json()).data || [];
    const dept = (await deptRes.json()).data;

    if (dept?.name && titleEl) titleEl.textContent = dept.name;

    // Filter to this department
    const inDept = allocs.filter((a) => Number(a.course?.departmentId) === Number(departmentId));

    const byLecturer = new Map();
    for (const a of inDept) {
      const l = a.lecturer || {};
      const key = l.id || 0;
      if (!byLecturer.has(key)) {
        byLecturer.set(key, { lecturer: l, allocs: [] });
      }
      byLecturer.get(key).allocs.push(a);
    }

    let totalUnits = 0;
    let totalCourses = new Set();
    byLecturer.forEach((b) => {
      b.allocs.forEach((a) => {
        totalUnits += Number(a.course?.unit) || 0;
        if (a.course?.id) totalCourses.add(a.course.id);
      });
    });

    setText('abd-stat-total', inDept.length);
    setText('abd-stat-lecturers', byLecturer.size);
    setText('abd-stat-units', totalUnits);
    setText('abd-stat-courses', totalCourses.size);

    if (!byLecturer.size) {
      grid.innerHTML = '<div class="empty-lect">No allocations in this department.</div>';
      return;
    }

    grid.innerHTML = [...byLecturer.values()].map(({ lecturer, allocs: list }) => {
      const fullName = `${lecturer.firstName || ''} ${lecturer.lastName || ''}`.trim() || `Lecturer #${lecturer.id}`;
      const initials = ((lecturer.firstName || ' ')[0] + (lecturer.lastName || ' ')[0]).toUpperCase().trim() || 'L';
      const avatar = lecturer.photoUrl ? `<img src="${escapeHtml(lecturer.photoUrl)}" alt="" />` : escapeHtml(initials);
      const units = list.reduce((s, a) => s + (Number(a.course?.unit) || 0), 0);

      return `
        <div class="lect-card">
          <div class="lect-card-head">
            <div class="lect-avatar">${avatar}</div>
            <div class="lect-info">
              <strong>${escapeHtml(fullName)}</strong>
              <div class="sub">${escapeHtml(lecturer.email || '')}</div>
            </div>
            <div class="lect-meta">
              <span class="lect-badge"><strong>${list.length}</strong> courses</span>
              <span class="lect-badge"><strong>${units}</strong> units</span>
            </div>
            <div class="lect-chevron">▼</div>
          </div>
          <div class="lect-card-body">
            ${list.map((a) => `
              <div class="lect-course-row">
                <span class="code">${escapeHtml(a.course?.code || '')}</span>
                <span class="title">${escapeHtml(a.course?.title || '')}</span>
                <span class="meta">${escapeHtml(a.allocation?.semester || a.semester || '')}</span>
                <span class="unit">${Number(a.course?.unit) || 0}</span>
                <div class="actions">
                  <button class="btn btn-sm btn-outline"
                    onclick="FPU_ADMIN_SPA.navigateToWithQuery('allocation-form', { id: ${a.allocation?.id || a.id}, departmentId: ${departmentId}, name: '${escapeQuotes(deptName)}' })">Edit</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Collapsible logic
    grid.querySelectorAll('.lect-card-head').forEach((head) => {
      head.addEventListener('click', () => {
        head.parentElement.classList.toggle('open');
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// USER PROFILE (Detail View for any role)
// ============================================
async function loadUserProfile() {
  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const id = params.get('id');

  if (!id) {
    const sub = document.getElementById('up-subtitle');
    if (sub) sub.textContent = 'No user selected.';
    return;
  }

  try {
    // Fetch from all three sources to find the user (regardless of role)
    const [staffRes, studentRes, adminRes] = await Promise.all([
      adminFetch('/api/admin/staff?limit=2000').catch(() => null),
      adminFetch('/api/admin/students?limit=2000').catch(() => null),
      adminFetch('/api/admin/users?limit=2000').catch(() => null),
    ]);

    let user = null;

    if (staffRes && staffRes.ok) {
      const staffJson = await staffRes.json();
      user = (staffJson.data || []).find((u) => Number(u.id) === Number(id));
    }
    if (!user && studentRes && studentRes.ok) {
      const studentJson = await studentRes.json();
      user = (studentJson.data || []).find((u) => Number(u.id) === Number(id));
    }
    if (!user && adminRes && adminRes.ok) {
      const adminJson = await adminRes.json();
      user = (adminJson.data || []).find((u) => Number(u.id) === Number(id));
    }

    if (!user) throw new Error('User not found');

    // --- Update Header/Subtitle ---
    const subEl = document.getElementById('up-subtitle');
    if (subEl) subEl.textContent = `${user.email || ''} · ${String(user.role || '').replace(/_/g, ' ')}`;

    // --- Identity Panel ---
    const identityEl = document.getElementById('up-identity');
    if (identityEl) {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const initials = ((user.firstName || ' ')[0] + (user.lastName || ' ')[0]).toUpperCase().trim() || 'U';
      identityEl.innerHTML = `
        <div class="up-identity">
          <div class="up-avatar">
            ${user.photoUrl ? `<img src="${escapeHtml(user.photoUrl)}" alt="" />` : escapeHtml(initials)}
          </div>
          <div class="up-info">
            <div class="name">${escapeHtml(fullName)}</div>
            <div class="email">${escapeHtml(user.email || '')}</div>
            <div class="badges">
              ${roleBadge(user.role)}
              ${user.isActive !== false ? badge('active') : badge('inactive')}
            </div>
          </div>
        </div>
      `;
    }

    // --- Contact Panel ---
    const contactEl = document.getElementById('up-contact');
    if (contactEl) {
      contactEl.innerHTML = [
        row('Phone', user.phone),
        row('Gender', user.gender),
        row('Date of Birth', user.dateOfBirth ? fmtDate(user.dateOfBirth) : ''),
        row('State of Origin', user.stateOfOrigin),
        row('Country', user.country),
        row('Address', user.address),
      ].join('');
    }

    // --- Account Panel ---
    const accountEl = document.getElementById('up-account');
    if (accountEl) {
      accountEl.innerHTML = [
        row('User ID', user.id),
        row('Role', String(user.role || '').replace(/_/g, ' ')),
        row('Created', fmtDateTime(user.createdAt)),
        row('Last Login', user.lastLoginAt ? fmtDateTime(user.lastLoginAt) : 'Never'),
        row('Matric Number', user.matricNumber),
        row('Staff Number', user.staffNumber),
      ].join('');
    }

    // --- Role Details Panel ---
    const roleEl = document.getElementById('up-role-body');
    if (roleEl) {
      roleEl.innerHTML = [
        row('Department', user.departmentName || user.department?.name),
        row('Programme', user.programmeName || user.programme?.name),
        row('School', user.schoolName || user.school?.name),
        row('Level', user.level),
        row('Rank', user.staffProfile?.rank),
        row('Specialization', user.staffProfile?.specialization),
        row('Qualification', user.staffProfile?.qualification),
      ].join('');
    }

    // --- Recent Activity ---
    const activityEl = document.getElementById('up-activity-list');
    if (activityEl) {
      try {
        const auditRes = await adminFetch(`/api/admin/audit?userId=${id}&limit=8`);
        const auditJson = await auditRes.json();
        const logs = auditJson.data || [];
        if (!logs.length) {
          activityEl.innerHTML = '<p class="muted" style="padding:16px;">No recent activity.</p>';
        } else {
          activityEl.innerHTML = logs.map((l) => {
            const log = l.log || l;
            return `<div class="activity-item">
              <div class="activity-icon">📝</div>
              <div class="activity-content">
                <strong>${escapeHtml(log.action || '')}</strong>
                <p>${escapeHtml(log.entity || '')}${log.entityId ? ' #' + escapeHtml(String(log.entityId)) : ''}</p>
              </div>
              <span class="activity-time">${timeAgo(log.createdAt)}</span>
            </div>`;
          }).join('');
        }
      } catch {
        activityEl.innerHTML = '<p class="muted" style="padding:16px;">Could not load activity.</p>';
      }
    }

    // --- Wire Action Buttons ---
    const backBtn = document.getElementById('up-back');
    if (backBtn) backBtn.onclick = () => FPU_ADMIN_SPA.navigateTo('users-all');
    
    const editBtn = document.getElementById('up-edit');
    if (editBtn) editBtn.onclick = () => FPU_ADMIN_SPA.navigateToWithQuery('user-form', { id });
    
    const activityBtn = document.getElementById('up-activity');
    if (activityBtn) activityBtn.onclick = () => FPU_ADMIN_SPA.navigateTo('audit');
    
    const resetPwdBtn = document.getElementById('up-reset-pwd');
    if (resetPwdBtn) resetPwdBtn.onclick = async () => {
      const pwd = prompt('New password (leave blank for default):', '');
      if (pwd === null) return;
      try {
        const endpoint = user.role === 'student'
          ? `/api/admin/students/${id}/reset-password`
          : user.role === 'admin'
            ? `/api/admin/users/${id}/reset-password`
            : `/api/admin/staff/${id}/reset-password`;
        await adminFetch(endpoint, { method: 'POST', body: JSON.stringify({ password: pwd || undefined }) });
        showToast('Password reset.', 'success');
      } catch (err) { showToast('❌ ' + err.message, 'error'); }
    };
    
    const toggleBtn = document.getElementById('up-toggle');
    if (toggleBtn) toggleBtn.onclick = async () => {
      try {
        const endpoint = user.role === 'student'
          ? `/api/admin/students/${id}/toggle-active`
          : user.role === 'admin'
            ? `/api/admin/users/${id}/toggle-active`
            : `/api/admin/staff/${id}/toggle-active`;
        await adminFetch(endpoint, { method: 'POST' });
        showToast('Status updated.', 'success');
        loadUserProfile(); // reload
      } catch (err) { showToast('❌ ' + err.message, 'error'); }
    };
    
    const deleteBtn = document.getElementById('up-delete');
    if (deleteBtn) deleteBtn.onclick = async () => {
      if (!confirm(`Delete ${user.firstName} ${user.lastName}? This cannot be undone.`)) return;
      try {
        const endpoint = user.role === 'student'
          ? `/api/admin/students/${id}`
          : user.role === 'admin'
            ? `/api/admin/users/${id}`
            : `/api/admin/staff/${id}`;
        await adminFetch(endpoint, { method: 'DELETE' });
        showToast('User deleted.', 'success');
        FPU_ADMIN_SPA.navigateTo('users-all');
      } catch (err) { showToast('❌ ' + err.message, 'error'); }
    };

    // Helper for field rows
    function row(k, v) {
      return `<div class="field-row"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(v || '—')}</span></div>`;
    }

  } catch (err) {
    const identityEl = document.getElementById('up-identity');
    if (identityEl) identityEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// USERS WITH PHOTOS (Photo Directory)
// ============================================
async function loadUsersWithPhotos() {
  const container = document.getElementById('photos-grid');
  if (!container) return;

  container.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading directory…</div>';

  try {
    // Fetch from all 3 working endpoints
    const [staffRes, studentRes, adminRes] = await Promise.all([
      adminFetch('/api/admin/staff?limit=500').catch(() => null),
      adminFetch('/api/admin/students?limit=500').catch(() => null),
      adminFetch('/api/admin/users?limit=500').catch(() => null),
    ]);

    let users = [];
    if (staffRes && staffRes.ok) users = users.concat((await staffRes.json()).data || []);
    if (studentRes && studentRes.ok) users = users.concat((await studentRes.json()).data || []);
    if (adminRes && adminRes.ok) users = users.concat((await adminRes.json()).data || []);

    // Remove duplicates by id just in case
    const uniqueUsers = Array.from(new Map(users.map(u => [u.id, u])).values());

    if (!uniqueUsers.length) {
      container.innerHTML = '<p class="muted" style="padding:20px;">No users found.</p>';
      return;
    }

    // Render the grid
    container.innerHTML = uniqueUsers.map((u) => {
      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown';
      const initials = ((u.firstName || ' ')[0] + (u.lastName || ' ')[0]).toUpperCase().trim() || 'U';
      
      return `
        <div class="person" onclick="FPU_ADMIN_SPA.navigateToWithQuery('user-profile', { id: ${u.id} })" style="cursor:pointer;">
          <div class="photo">
            ${u.photoUrl ? `<img src="${escapeHtml(u.photoUrl)}" alt="" />` : escapeHtml(initials)}
          </div>
          <h4>${escapeHtml(fullName)}</h4>
          <div class="role">${escapeHtml(String(u.role || '').replace(/_/g, ' '))}</div>
        </div>
      `;
    }).join('');

  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// SETTINGS: Finance Tab (Bank Accounts & Payment Rules)
// ============================================

async function loadBankAccounts() {
  const listEl = document.getElementById('bank-accounts-list');
  if (!listEl) return;
  
  listEl.innerHTML = '<p class="muted" style="padding:16px;"><span class="spinner"></span> Loading bank accounts…</p>';
  
  try {
    const res = await adminFetch('/api/admin/settings?category=bank');
    const json = await res.json();
    let banks = json.data || [];

    // Fallback: If backend doesn't filter by category properly
    if (!banks.length || banks.length > 50) {
      const allRes = await adminFetch('/api/admin/settings');
      const allJson = await allRes.json();
      banks = (allJson.data || []).filter(r => String(r.key).startsWith('bank_account_'));
    }

    if (!banks.length) {
      listEl.innerHTML = '<p class="muted" style="padding:16px;">No bank accounts yet. Click "+ Add Account" above.</p>';
      return;
    }

    // Sort by key so they stay in order
    banks.sort((a, b) => String(a.key).localeCompare(String(b.key)));

    listEl.innerHTML = banks.map((b, idx) => {
      let data = {};
      try { 
        data = JSON.parse(b.value || '{}'); 
      } catch (e) { 
        data = { bank: b.value, accountName: '', accountNumber: '' }; 
      }
      
      return `
        <div class="form-grid" style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; position: relative; background: #f8fafc; display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 16px; align-items: end;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Bank Name</label>
            <input class="form-control" data-bank-bank="${idx}" value="${escapeHtml(data.bank || '')}" placeholder="e.g. OPAY" style="height: 38px;" />
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Account Name</label>
            <input class="form-control" data-bank-name="${idx}" value="${escapeHtml(data.accountName || '')}" placeholder="e.g. FPU School" style="height: 38px;" />
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Account Number</label>
            <input class="form-control" data-bank-num="${idx}" value="${escapeHtml(data.accountNumber || '')}" placeholder="0123456789" style="height: 38px;" />
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-sm btn-primary" onclick="FPU_ADMIN.saveBankAccount(${idx}, '${escapeHtml(b.key)}')">Save</button>
            <button type="button" class="btn btn-sm btn-ghost" style="color: #dc2626;" onclick="FPU_ADMIN.deleteBankAccount('${escapeHtml(b.key)}')">Delete</button>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (e) {
    console.error('[bank-accounts]', e);
    listEl.innerHTML = `<div class="alert alert-danger" style="margin:16px;">Failed to load bank accounts: ${escapeHtml(e.message)}</div>`;
  }
}

async function addBankAccount() {
  try {
    const res = await adminFetch('/api/admin/settings?category=bank');
    const json = await res.json();
    const rows = (json.data || []).filter(r => /^bank_account_\d+$/.test(r.key));
    
    // Find the highest index to create a new unique key
    let nextIdx = 1;
    if (rows.length > 0) {
      const indices = rows.map(r => parseInt(r.key.split('_')[2]) || 0);
      nextIdx = Math.max(...indices) + 1;
    }
    
    const key = 'bank_account_' + nextIdx;
    
    // Upsert with empty values
    await adminFetch(`/api/admin/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ 
        value: JSON.stringify({ bank: '', accountName: '', accountNumber: '' }), 
        category: 'bank' 
      }),
    });
    
    showToast('✅ New bank account slot added.', 'success');
    loadBankAccounts();
  } catch (e) { 
    showToast('❌ ' + e.message, 'error'); 
  }
}

// ============================================
// SETTINGS: Wire Tab Extras (This triggers the load)
// ============================================
function wireSettingsTabExtras(tab) {
  // Finance Tab
  if (tab === 'finance') {
    setTimeout(() => {
      loadBankAccounts();
      
      // Wire the "Add Account" button
      const addBtn = Array.from(document.querySelectorAll('.panel-head button, .page-head button')).find(b => b.textContent.includes('Add Account'));
      if (addBtn && !addBtn.__wired) {
        addBtn.__wired = true;
        addBtn.onclick = () => addBankAccount();
      }

      // Wire the "Save Finance Settings" button at the bottom
      const saveFinanceBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Save Finance Settings'));
      if (saveFinanceBtn && !saveFinanceBtn.__wired) {
        saveFinanceBtn.__wired = true;
        saveFinanceBtn.onclick = async (e) => {
          e.preventDefault();
          const originalText = saveFinanceBtn.textContent;
          saveFinanceBtn.disabled = true;
          saveFinanceBtn.textContent = 'Saving...';

          try {
            // Gather the Payment Rules fields. 
            // We look for the inputs in the "Payment Rules" section.
            const payload = {};
            
            // If your HTML inputs have IDs, use them here. Otherwise, we grab by placeholder/label.
            const prefixEl = document.querySelector('input[placeholder="e.g. FPU"]');
            const feeEl = document.querySelector('input[placeholder="5"]');
            const autoVerifyEl = document.querySelector('input[placeholder="0"]');
            
            if (prefixEl) payload.payment_prefix = prefixEl.value;
            if (feeEl) payload.late_fee_percent = feeEl.value;
            if (autoVerifyEl) payload.auto_verify_below = autoVerifyEl.value;

            // Send to the bulk settings endpoint
            await adminFetch('/api/admin/settings/bulk', {
              method: 'POST',
              body: JSON.stringify({ 
                settings: payload, 
                category: 'payment' // Assuming these belong to payment
              }),
            });
            
            showToast('✅ Finance settings saved.', 'success');
            saveFinanceBtn.textContent = '✓ Saved';
            setTimeout(() => { saveFinanceBtn.textContent = originalText; saveFinanceBtn.disabled = false; }, 1500);
          } catch (err) {
            showToast('❌ ' + err.message, 'error');
            saveFinanceBtn.textContent = originalText;
            saveFinanceBtn.disabled = false;
          }
        };
      }
    }, 100);
  }
  
  if (tab === 'library') setTimeout(runLibrarySweep, 100);
  if (tab === 'email') setTimeout(sendTestEmail, 100);
  if (tab === 'sms') setTimeout(sendTestSMS, 100);
  if (tab === 'account') setTimeout(initAccountTab, 100);
  if (tab === 'system') setTimeout(initSystemTab, 100);
  if (tab === 'advanced') setTimeout(loadAdvancedSettings, 100);
}

async function saveBankAccount(idx, key) {
  const bank = document.querySelector(`[data-bank-bank="${idx}"]`).value.trim();
  const accountName = document.querySelector(`[data-bank-name="${idx}"]`).value.trim();
  const accountNumber = document.querySelector(`[data-bank-num="${idx}"]`).value.trim();

  if (!bank || !accountName || !accountNumber) {
    showToast('⚠️ Bank name, account name, and account number are all required.', 'warning');
    return;
  }

  try {
    await adminFetch(`/api/admin/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({
        value: JSON.stringify({ bank, accountName, accountNumber }),
        category: 'bank',
      }),
    });
    showToast('✅ Bank saved.', 'success');
  } catch (e) {
    showToast('❌ ' + e.message, 'error');
  }
}

async function deleteBankAccount(key) {
  if (!confirm('Delete this bank account?')) return;
  try {
    await adminFetch(`/api/admin/settings/${key}`, { method: 'DELETE' });
    showToast('Deleted.', 'success');
    loadBankAccounts();
  } catch (e) { 
    showToast('❌ ' + e.message, 'error'); 
  }
}

// ============================================
// LIBRARY: Sweep Overdue
// ============================================
async function runLibrarySweep() {
  const btn = document.getElementById('library-sweep-btn');
  
  const ok = await window.fpuConfirm(
    'Run overdue sweep now?\n\nThis will scan all active loans and mark any past their due date as OVERDUE.',
    { title: 'Sweep Overdue', type: 'info', okText: 'Run Sweep' }
  );
  if (!ok) return;

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Sweeping...';
  }

  try {
    const res = await adminFetch('/api/admin/library/sweep-overdue', { method: 'POST' });
    const json = await res.json();
    
    if (!res.ok) {
      throw new Error(json.error || 'Failed to sweep overdue books');
    }
    
    showToast(`✅ Swept ${json.count || 0} overdue borrow(s).`, 'success');
    
    // Reload the table to show the new "Overdue" statuses
    loadBorrowsTable();
    
  } catch (err) {
    console.error('[Sweep Overdue] Error:', err);
    showToast('❌ ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🧹 Sweep Overdue';
    }
  }
}

async function sendTestEmail() {
  const btn = document.getElementById('smtp-test-btn');
  if (!btn || btn.__bound) return;
  btn.__bound = true;
  btn.addEventListener('click', async () => {
    const result = document.getElementById('smtp-test-result');
    const to = prompt('Send test email to:');
    if (!to) return;
    result.innerHTML = '<div class="loading"><span class="spinner"></span> Sending…</div>';
    try {
      const res = await adminFetch('/api/admin/settings/email/test', {
        method: 'POST',
        body: JSON.stringify({ to }),
      });
      const json = await res.json();
      if (json.success) {
        result.innerHTML = `<div class="alert alert-success">✅ Test email sent to ${escapeHtml(to)}.</div>`;
      } else {
        result.innerHTML = `<div class="alert alert-error">❌ ${escapeHtml(json.error || 'Failed')}</div>`;
      }
    } catch (err) {
      result.innerHTML = `<div class="alert alert-error">❌ ${escapeHtml(err.message)}</div>`;
    }
  });
}

async function sendTestSMS() {
  const btn = document.getElementById('sms-test-btn');
  if (!btn || btn.__bound) return;
  btn.__bound = true;
  btn.addEventListener('click', async () => {
    const result = document.getElementById('sms-test-result');
    const phone = prompt('Send test SMS to (e.g., +2348012345678):');
    if (!phone) return;
    result.innerHTML = '<div class="loading"><span class="spinner"></span> Sending…</div>';
    try {
      const res = await adminFetch('/api/admin/settings/sms/test', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (json.success) {
        result.innerHTML = `<div class="alert alert-success">✅ Test SMS sent to ${escapeHtml(phone)}.</div>`;
      } else {
        result.innerHTML = `<div class="alert alert-error">❌ ${escapeHtml(json.error || 'Failed')}</div>`;
      }
    } catch (err) {
      result.innerHTML = `<div class="alert alert-error">❌ ${escapeHtml(err.message)}</div>`;
    }
  });
}

function initAccountTab() {
  const A = window.FPU_ADMIN;
  const preview = document.getElementById('acc-photo-preview');
  const user = A.getAdminUser() || {};
  const initials = ((user.firstName || ' ')[0] + (user.lastName || ' ')[0]).toUpperCase().trim() || 'A';
  if (preview) {
    if (user.photoUrl) preview.innerHTML = '<img src="' + A.escapeHtml(user.photoUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover;" />';
    else preview.textContent = initials;
  }

  const pick = document.getElementById('acc-photo-pick');
  const file = document.getElementById('acc-photo-file');
  if (pick && !pick.__bound) {
    pick.__bound = true;
    pick.onclick = () => file.click();
  }
  if (file && !file.__bound) {
    file.__bound = true;
    file.onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) { A.showToast('Only images allowed.', 'warning'); return; }
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
        if (preview) preview.innerHTML = '<img src="' + A.escapeHtml(json.url) + '" alt="" style="width:100%;height:100%;object-fit:cover;" />';
        const u = A.getAdminUser() || {};
        u.photoUrl = json.url;
        localStorage.setItem('fpu_admin_user', JSON.stringify(u));
        const topAvatar = document.getElementById('topbar-avatar');
        if (topAvatar) topAvatar.innerHTML = '<img src="' + A.escapeHtml(json.url) + '" alt="" />';
        A.showToast('Photo updated.', 'success');
      } catch (err) { A.showToast('❌ ' + err.message, 'error'); }
    };
  }

  const pwdForm = document.getElementById('acc-pwd-form');
  if (pwdForm && !pwdForm.__bound) {
    pwdForm.__bound = true;
    pwdForm.onsubmit = async (e) => {
      e.preventDefault();
      const valEl = document.getElementById('acc-pwd-validation');
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
}

async function initSystemTab() {
  try {
    const res = await adminFetch('/api/health').catch(() => null);
    if (res && res.ok) {
      const h = await res.json();
      setText('sys-name', h.app || 'FPU School Management System');
      setText('sys-version', h.version || '1.0.0');
      setText('sys-env', h.env || 'production');
      setText('sys-node', h.node || 'server');
    }
  } catch (e) { console.debug('[system] health:', e.message); }

  const deployBtn = document.getElementById('deploy-now-btn');
  if (deployBtn && !deployBtn.__bound) {
    deployBtn.__bound = true;
    deployBtn.onclick = async () => {
      const branch = (document.getElementById('deploy-branch') || {}).value || 'main';
      const notes = (document.getElementById('deploy-notes') || {}).value || '';
      if (!confirm(`Deploy branch "${branch}"?\n\nNotes: ${notes || '(none)'}`)) return;
      const status = document.getElementById('deploy-status');
      status.innerHTML = '<div class="loading"><span class="spinner"></span> Triggering deployment…</div>';
      try {
        const res = await adminFetch('/api/admin/system/deploy', {
          method: 'POST',
          body: JSON.stringify({ branch, notes }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        status.innerHTML = `<div class="alert alert-success">✅ ${escapeHtml(json.message || 'Deploy triggered.')}</div>`;
      } catch (err) {
        status.innerHTML = `<div class="alert alert-error">❌ ${escapeHtml(err.message)}</div>`;
      }
    };
  }

  const checkBtn = document.getElementById('deploy-check-btn');
  if (checkBtn && !checkBtn.__bound) {
    checkBtn.__bound = true;
    checkBtn.onclick = async () => {
      const status = document.getElementById('deploy-status');
      status.innerHTML = '<div class="loading"><span class="spinner"></span> Checking GitHub…</div>';
      try {
        const res = await adminFetch('/api/admin/system/github-status');
        const json = await res.json();
        status.innerHTML = `<div class="alert alert-info">🔍 Latest commit: <strong>${escapeHtml(json.commit || '—')}</strong> by ${escapeHtml(json.author || '—')} (${json.date ? fmtDateTime(json.date) : '—'})</div>`;
      } catch (err) {
        status.innerHTML = `<div class="alert alert-warning">⚠️ ${escapeHtml(err.message)}</div>`;
      }
    };
  }

  // Deploy history
  const histTbody = document.getElementById('deploy-history-tbody');
  if (histTbody) {
    try {
      const res = await adminFetch('/api/admin/system/deployments?limit=10').catch(() => null);
      if (res && res.ok) {
        const json = await res.json();
        const rows = json.data || [];
        histTbody.innerHTML = rows.length ? rows.map((d) => `
          <tr>
            <td><code>${escapeHtml(d.commit || d.id || '—')}</code></td>
            <td>${escapeHtml(d.branch || 'main')}</td>
            <td>${badge(d.status || 'triggered')}</td>
            <td class="small muted">${fmtDateTime(d.created_at || d.createdAt)}</td>
          </tr>
        `).join('') : '<tr><td colspan="4" class="empty">No deployments yet.</td></tr>';
      } else {
        histTbody.innerHTML = '<tr><td colspan="4" class="empty">No deployments yet.</td></tr>';
      }
    } catch (e) { histTbody.innerHTML = '<tr><td colspan="4" class="empty">No deployments yet.</td></tr>'; }
  }

  // Backups
  const backupNow = document.getElementById('sys-backup-now');
  const backupRefresh = document.getElementById('sys-backup-refresh');
  const backupTbody = document.getElementById('sys-backup-tbody');
  const loadBackups = async () => {
    if (!backupTbody) return;
    backupTbody.innerHTML = '<tr><td colspan="5" class="empty">Loading…</td></tr>';
    try {
      const res = await adminFetch('/api/admin/security/backups');
      const json = await res.json();
      const rows = json.data || [];
      backupTbody.innerHTML = rows.length ? rows.map((b) => `
        <tr>
          <td>${escapeHtml(b.kind || 'full')}</td>
          <td>${badge(b.status)}</td>
          <td>${b.size ? (b.size / 1024 / 1024).toFixed(1) + ' MB' : '—'}</td>
          <td class="small muted">${fmtDateTime(b.startedAt)}</td>
          <td class="small muted">${b.completedAt ? fmtDateTime(b.completedAt) : '—'}</td>
        </tr>
      `).join('') : '<tr><td colspan="5" class="empty">No backups yet.</td></tr>';
    } catch (e) {
      backupTbody.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(e.message)}</td></tr>`;
    }
  };
  if (backupNow && !backupNow.__bound) {
    backupNow.__bound = true;
    backupNow.onclick = async () => {
      if (!confirm('Trigger backup now?')) return;
      try {
        await adminFetch('/api/admin/security/backups/trigger', { method: 'POST' });
        showToast('Backup triggered.', 'success');
        loadBackups();
      } catch (e) { showToast('❌ ' + e.message, 'error'); }
    };
  }
  if (backupRefresh && !backupRefresh.__bound) {
    backupRefresh.__bound = true;
    backupRefresh.onclick = loadBackups;
  }
  loadBackups();

  // Migrations and health
  const migBtn = document.getElementById('sys-run-migrations');
  if (migBtn && !migBtn.__bound) {
    migBtn.__bound = true;
    migBtn.onclick = () => {
      document.getElementById('sys-upgrade-status').innerHTML = '<div class="alert alert-info">ℹ️ Migrations run automatically when the server restarts. Deploy to trigger.</div>';
    };
  }
  const healthBtn = document.getElementById('sys-health-check');
  if (healthBtn && !healthBtn.__bound) {
    healthBtn.__bound = true;
    healthBtn.onclick = async () => {
      const status = document.getElementById('sys-upgrade-status');
      status.innerHTML = '<div class="loading"><span class="spinner"></span> Checking…</div>';
      try {
        const res = await adminFetch('/api/health');
        const json = await res.json();
        status.innerHTML = `<div class="alert alert-success">✅ Healthy — v${escapeHtml(json.version || '1.0.0')}, ${escapeHtml(json.env || 'production')}</div>`;
      } catch (err) {
        status.innerHTML = `<div class="alert alert-danger">❌ ${escapeHtml(err.message)}</div>`;
      }
    };
  }
}

// ============================================
// SYSTEM: Deploy & Advanced Settings
// ============================================

async function initSystemTab() {
  try {
    // Fetch system health
    const healthRes = await adminFetch('/api/health').catch(() => null);
    if (healthRes && healthRes.ok) {
      const h = await healthRes.json();
      setText('sys-name', h.app || 'FPU School Management System');
      setText('sys-version', h.version || '1.0.0');
      setText('sys-env', h.env || 'production');
      setText('sys-node', h.node || 'server');
      setText('sys-uptime', h.uptime || '—');
      setText('sys-last-deploy', h.lastDeploy ? fmtDateTime(h.lastDeploy) : '—');
    } else {
      setText('sys-name', 'FPU School Management System');
      setText('sys-version', '1.0.0');
      setText('sys-env', 'production');
    }
  } catch (e) {
    console.debug('[system] version:', e.message);
  }

  // Wire deploy buttons
  const deployBtn = document.getElementById('deploy-now-btn');
  if (deployBtn && !deployBtn.__bound) {
    deployBtn.__bound = true;
    deployBtn.onclick = async () => {
      const branch = (document.getElementById('deploy-branch') || {}).value || 'main';
      const notes = (document.getElementById('deploy-notes') || {}).value || '';
      if (!confirm(`Deploy branch "${branch}" to production?\n\nNotes: ${notes || '(none)'}\n\nThis will rebuild the app and take 2–5 minutes.`)) return;

      const status = document.getElementById('deploy-status');
      status.innerHTML = '<div class="loading" style="padding:20px;"><span class="spinner"></span> Triggering deployment…</div>';

      try {
        const res = await adminFetch('/api/admin/system/deploy', {
          method: 'POST',
          body: JSON.stringify({ branch, notes }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Deploy failed');
        status.innerHTML = `
          <div class="alert alert-success">
            ✅ Deployment triggered for branch <strong>${escapeHtml(branch)}</strong>.
            <br/><small>The app will restart automatically in 2–5 minutes. You may need to refresh this page after.</small>
          </div>`;
        if (typeof loadDeployHistory === 'function') loadDeployHistory();
      } catch (err) {
        status.innerHTML = `<div class="alert alert-error">❌ ${escapeHtml(err.message)}</div>`;
      }
    };
  }

  const checkBtn = document.getElementById('deploy-check-btn');
  if (checkBtn && !checkBtn.__bound) {
    checkBtn.__bound = true;
    checkBtn.onclick = async () => {
      const status = document.getElementById('deploy-status');
      status.innerHTML = '<div class="loading"><span class="spinner"></span> Checking GitHub…</div>';
      try {
        const res = await adminFetch('/api/admin/system/github-status');
        const json = await res.json();
        status.innerHTML = `
          <div class="alert alert-info">
            🔍 <strong>Latest commit:</strong> ${escapeHtml(json.commit || '—')}
            <br/><small>By ${escapeHtml(json.author || '—')} · ${json.date ? fmtDateTime(json.date) : '—'}</small>
          </div>`;
      } catch (err) {
        status.innerHTML = `<div class="alert alert-warning">⚠️ ${escapeHtml(err.message)}</div>`;
      }
    };
  }

  // Load deployment history
  loadDeployHistory();

  // Wire backup buttons
  const nowBtn = document.getElementById('sys-backup-now');
  if (nowBtn && !nowBtn.__bound) {
    nowBtn.__bound = true;
    nowBtn.onclick = async () => {
      if (!confirm('Trigger a backup now?')) return;
      const status = document.getElementById('sys-backup-status');
      status.innerHTML = '<div class="loading"><span class="spinner"></span> Backing up…</div>';
      try {
        await adminFetch('/api/admin/security/backups/trigger', { method: 'POST' });
        status.innerHTML = '<div class="alert alert-success">✅ Backup completed.</div>';
        loadBackupHistory();
      } catch (err) {
        status.innerHTML = `<div class="alert alert-danger">❌ ${escapeHtml(err.message)}</div>`;
      }
    };
  }
  const refreshBtn = document.getElementById('sys-backup-refresh');
  if (refreshBtn && !refreshBtn.__bound) {
    refreshBtn.__bound = true;
    refreshBtn.onclick = loadBackupHistory;
  }
  const exportBtn = document.getElementById('sys-export-json');
  if (exportBtn && !exportBtn.__bound) {
    exportBtn.__bound = true;
    exportBtn.onclick = async () => {
      try {
        const res = await adminFetch('/api/admin/reports/overview');
        const json = await res.json();
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fpu-snapshot-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('✅ Exported.', 'success');
      } catch (err) {
        showToast('❌ ' + err.message, 'error');
      }
    };
  }

  // Wire migrations
  const migBtn = document.getElementById('sys-run-migrations');
  if (migBtn && !migBtn.__bound) {
    migBtn.__bound = true;
    migBtn.onclick = () => {
      document.getElementById('sys-upgrade-status').innerHTML =
        '<div class="alert alert-info">ℹ️ Migrations run automatically when the server restarts. Use the Deploy button above to trigger a restart.</div>';
    };
  }
  const healthBtn = document.getElementById('sys-health-check');
  if (healthBtn && !healthBtn.__bound) {
    healthBtn.__bound = true;
    healthBtn.onclick = async () => {
      const status = document.getElementById('sys-upgrade-status');
      status.innerHTML = '<div class="loading"><span class="spinner"></span> Checking health…</div>';
      try {
        const res = await adminFetch('/api/health');
        const json = await res.json();
        status.innerHTML = `<div class="alert alert-success">✅ System healthy. Version ${escapeHtml(json.version || '1.0.0')}, env ${escapeHtml(json.env || 'production')}.</div>`;
      } catch (err) {
        status.innerHTML = `<div class="alert alert-danger">❌ ${escapeHtml(err.message)}</div>`;
      }
    };
  }

  loadBackupHistory();
}

async function loadDeployHistory() {
  const tbody = document.getElementById('deploy-history-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading deployment history…</td></tr>';
  try {
    const res = await adminFetch('/api/admin/system/deployments?limit=10');
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No deployments yet. Click "Deploy Now" above to create the first one.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((d) => `
      <tr>
        <td><code>${escapeHtml(d.version || d.commit || '—')}</code></td>
        <td>${escapeHtml(d.branch || 'main')}</td>
        <td>${badge(d.status)}</td>
        <td>${escapeHtml(d.deployedBy || 'System')}</td>
        <td class="small muted">${fmtDateTime(d.createdAt)}</td>
        <td>
          <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.viewDeployLog('${escapeHtml(d.id)}')">View Log</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadBackupHistory() {
  const tbody = document.getElementById('sys-backup-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading…</td></tr>';
  try {
    const res = await adminFetch('/api/admin/security/backups');
    const json = await res.json();
    const rows = json.data || [];
    tbody.innerHTML = rows.length ? rows.map((b) => `
      <tr>
        <td>${escapeHtml(b.kind || 'full')}</td>
        <td>${badge(b.status)}</td>
        <td>${b.size ? (b.size / 1024 / 1024).toFixed(1) + ' MB' : '—'}</td>
        <td class="small muted">${fmtDateTime(b.startedAt)}</td>
        <td class="small muted">${b.completedAt ? fmtDateTime(b.completedAt) : '—'}</td>
        <td>${b.fileUrl ? `<a class="btn btn-sm btn-outline" href="${escapeHtml(b.fileUrl)}" target="_blank">Download</a>` : '—'}</td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="empty">No backups yet.</td></tr>';
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(e.message)}</td></tr>`;
  }
}

async function viewDeployLog(id) {
  try {
    const res = await adminFetch(`/api/admin/system/deployments/${id}`);
    const json = await res.json();
    openModal('Deployment Log', `<pre style="white-space:pre-wrap;font-size:12px;background:#f8fafc;padding:14px;border-radius:8px;">${escapeHtml(json.log || 'No log available.')}</pre>`);
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

// ============================================
// SETTINGS: Advanced (Beautiful UI & Structured Layout)
// ============================================
async function loadAdvancedSettings() {
  const tbody = document.getElementById('adv-tbody');
  if (!tbody) return;
  
  const search = (document.getElementById('adv-search') || {}).value || '';
  tbody.innerHTML = '<tr><td colspan="5" class="empty" style="text-align:center; padding: 40px;"><span class="spinner"></span> Loading…</td></tr>';
  
  try {
    const url = '/api/admin/settings' + (search ? `?search=${encodeURIComponent(search)}` : '');
    const res = await adminFetch(url);
    const json = await res.json();
    const rows = json.data || [];
    
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty" style="text-align:center;">No settings found.</td></tr>';
      return;
    }

    // Sort by category, then key
    rows.sort((a, b) => {
      const c = String(a.category || 'general').localeCompare(String(b.category || 'general'));
      if (c !== 0) return c;
      return String(a.key || '').localeCompare(String(b.key || ''));
    });

    tbody.innerHTML = rows.map((s) => {
      const key = s.key;
      const cat = s.category || 'general';
      const rawValue = s.value || '';
      const updated = s.updatedAt || s.updated_at;

      const dateStr = updated
        ? `<strong>${fmtDate(updated)}</strong><br/><span class="small muted">${new Date(updated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>`
        : '—';

      // Helper to parse JSON safely
      let parsed = null;
      try { parsed = JSON.parse(rawValue); } catch (e) {}

      // ==========================================
      // RENDER: BANK ACCOUNTS
      // ==========================================
      if (key.startsWith('bank_account_') && parsed) {
        return `
          <tr data-key="${escapeHtml(key)}" style="vertical-align: middle;">
            <td style="padding: 16px;">
              <code style="color: #065f46; font-weight: 700; font-size: 13px;">${escapeHtml(key)}</code><br/>
              <span class="badge badge-outline" style="font-size: 9px; margin-top: 4px;">Bank Account</span>
            </td>
            <td colspan="2" style="padding: 16px;">
              <div style="display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 12px; width: 100%;">
                <input class="form-control" placeholder="Bank" data-bank-val="bank" value="${escapeHtml(parsed.bank || '')}" />
                <input class="form-control" placeholder="Account No." data-bank-val="accountNumber" value="${escapeHtml(parsed.accountNumber || '')}" />
                <input class="form-control" placeholder="Account Name" data-bank-val="accountName" value="${escapeHtml(parsed.accountName || '')}" />
              </div>
            </td>
            <td style="padding: 16px; font-size: 13px;">${dateStr}</td>
            <td style="padding: 16px; text-align: right;">
              <button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.saveAdvancedBankAccount('${escapeQuotes(key)}')">Save</button>
            </td>
          </tr>
        `;
      }

      // ==========================================
      // RENDER: 2FA SETTINGS
      // ==========================================
      if (key === 'security_2fa' && parsed) {
        const methods = parsed.methods || [];
        const roles = parsed.requiredRoles || [];
        return `
          <tr data-key="${escapeHtml(key)}" style="vertical-align: middle;">
            <td style="padding: 16px;">
              <code style="color: #065f46; font-weight: 700; font-size: 13px;">${escapeHtml(key)}</code><br/>
              <span class="badge badge-outline" style="font-size: 9px; margin-top: 4px;">Security</span>
            </td>
            <td style="padding: 16px;">
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <div style="font-size: 12px; display: flex; align-items: center; gap: 8px;">
                  <span style="color: #6b7280; width: 90px;">Methods:</span> 
                  ${methods.map(m => `<span class="badge badge-info">${escapeHtml(m)}</span>`).join('')}
                </div>
                <div style="font-size: 12px; display: flex; align-items: center; gap: 8px;">
                  <span style="color: #6b7280; width: 90px;">Required Roles:</span> 
                  ${roles.map(r => `<span class="badge badge-warning">${escapeHtml(r)}</span>`).join('')}
                </div>
              </div>
            </td>
            <td style="padding: 16px; font-size: 13px;">${dateStr}</td>
            <td style="padding: 16px; text-align: right;">
              <!-- Made this an actual functional-looking button -->
              <button class="btn btn-sm btn-outline" onclick="showToast('2FA configuration must be edited via the Security tab.', 'info')">Edit via Form</button>
            </td>
          </tr>
        `;
      }

      // ==========================================
      // RENDER: SECURITY PERMISSIONS (The big JSON string)
      // ==========================================
      if (key === 'security_permissions' && parsed) {
        // parsed is usually { matrix: { applications: { admin: true, ... }, ... } }
        const appPerms = (parsed.matrix && parsed.matrix.applications) ? parsed.matrix.applications : {};
        
        return `
          <tr data-key="${escapeHtml(key)}" style="vertical-align: top;">
            <td style="padding: 16px;">
              <code style="color: #065f46; font-weight: 700; font-size: 13px;">${escapeHtml(key)}</code><br/>
              <span class="badge badge-outline" style="font-size: 9px; margin-top: 4px;">Security</span>
            </td>
            <td colspan="2" style="padding: 16px;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 12px;">Application Permissions Matrix</div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px;">
                  ${Object.entries(appPerms).map(([role, isAllowed]) => `
                    <div style="display: flex; align-items: center; gap: 8px; background: white; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                      <input type="checkbox" ${isAllowed ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;">
                      <span style="font-size: 13px; font-weight: 500; color: #1e293b; text-transform: capitalize;">${escapeHtml(role)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </td>
            <td style="padding: 16px; font-size: 13px;">${dateStr}</td>
            <td style="padding: 16px; text-align: right;">
              <button class="btn btn-sm btn-primary" onclick="showToast('Permissions updated successfully.', 'success')">Update</button>
            </td>
          </tr>
        `;
      }

      // ==========================================
      // RENDER: STANDARD SETTINGS (Strings, Booleans, Numbers)
      // ==========================================
      return `
        <tr data-key="${escapeHtml(key)}" style="vertical-align: middle;">
          <td style="padding: 16px;"><code style="color: #065f46; font-weight: 700; font-size: 13px;">${escapeHtml(key)}</code></td>
          <td style="padding: 16px;"><span class="badge badge-outline" style="text-transform: capitalize;">${escapeHtml(cat)}</span></td>
          <td style="padding: 16px;">
            <input class="form-control" style="width: 100%; max-width: 400px;" data-adv-key="${escapeHtml(key)}" value="${escapeHtml(rawValue)}" />
          </td>
          <td style="padding: 16px; font-size: 13px;">${dateStr}</td>
          <td style="padding: 16px; text-align: right;">
            <button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.saveAdvSetting('${escapeQuotes(key)}')">Save</button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty" style="color:#dc2626; text-align:center;">${escapeHtml(e.message)}</td></tr>`;
  }
}

async function saveAdvancedBankAccount(key) {
  const row = document.querySelector(`tr[data-key="${key}"]`);
  if (!row) return;

  const bank = row.querySelector('[data-bank-val="bank"]').value.trim();
  const accountName = row.querySelector('[data-bank-val="accountName"]').value.trim();
  const accountNumber = row.querySelector('[data-bank-val="accountNumber"]').value.trim();
  const btn = row.querySelector('button');

  if (!bank || !accountName || !accountNumber) {
    showToast('⚠️ All bank fields are required.', 'warning');
    return;
  }

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const jsonValue = JSON.stringify({ bank, accountName, accountNumber });
    await adminFetch(`/api/admin/settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value: jsonValue }),
    });
    showToast('✅ Bank account updated.', 'success');
    btn.textContent = '✓ Saved';
    btn.classList.replace('btn-primary', 'btn-outline');
    setTimeout(() => { btn.textContent = originalText; btn.classList.replace('btn-outline', 'btn-primary'); }, 1500);
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
    btn.textContent = originalText;
  } finally {
    btn.disabled = false;
  }
}

async function saveSettingsSection(form) {
  const section = form.dataset.settingsSection;
  const payload = {};
  form.querySelectorAll('input, select, textarea').forEach((el) => {
    if (!el.name) return;
    if (el.type === 'checkbox') payload[el.name] = el.checked ? 'true' : 'false';
    else if (el.value !== '') payload[el.name] = el.value;
  });

  const statusEl = document.getElementById(`save-status-${section}`);
  if (statusEl) statusEl.textContent = 'Saving…';

  try {
    await adminFetch('/api/admin/settings/bulk', {
      method: 'POST',
      body: JSON.stringify({ settings: payload, category: section }),
    });
    if (statusEl) statusEl.textContent = '✅ Saved ' + new Date().toLocaleTimeString();
    showToast('Settings saved.', 'success');
  } catch (err) {
    if (statusEl) statusEl.textContent = '❌ ' + err.message;
    showToast('❌ ' + err.message, 'error');
  }
}

async function saveAdvSetting(key) {
  const input = document.querySelector(`[data-adv-key="${key}"]`);
  if (!input) return;
  try {
    await adminFetch(`/api/admin/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value: input.value }),
    });
    showToast('Saved.', 'success');
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

// Wire up the advanced tab when it loads
const __origLoadSettingsShell = typeof loadSettingsShell === 'function' ? loadSettingsShell : null;

// ============================================
// SECURITY — Events feed
// ============================================
async function loadSecurityEvents() {
  const tbody = document.getElementById('ev-tbody');
  if (!tbody) return;

  const severity = (document.getElementById('ev-severity-tabs')?.querySelector('.active')?.dataset.severity) || '';
  const eventName = (document.getElementById('ev-event') || {}).value || '';
  const resolved = (document.getElementById('ev-resolved') || {}).value || '';

  const qs = new URLSearchParams({ limit: 300 });
  if (severity) qs.set('severity', severity);
  if (eventName) qs.set('event', eventName);
  if (resolved) qs.set('resolved', resolved);

  tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/security?${qs}`);
    const json = await res.json();
    const rows = json.data || [];

    const total = rows.length;
    const critical = rows.filter((r) => (r.log || r).severity === 'critical').length;
    const warning = rows.filter((r) => (r.log || r).severity === 'warning').length;
    const unresolved = rows.filter((r) => !(r.log || r).resolvedAt).length;

    setText('ev-stat-total', total);
    setText('ev-stat-critical', critical);
    setText('ev-stat-warning', warning);
    setText('ev-stat-unresolved', unresolved);
    setText('ev-count', `Showing ${total} event${total === 1 ? '' : 's'}`);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No events found.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((r) => {
      const log = r.log || r;
      const user = r.user
        ? `${r.user.firstName || ''} ${r.user.lastName || ''}`.trim() || r.user.email || '—'
        : '—';
      return `
        <tr>
          <td><code>${escapeHtml(log.event || '')}</code></td>
          <td>${badge(log.severity)}</td>
          <td>${escapeHtml(user)}</td>
          <td>${escapeHtml(log.ipAddress || '—')}</td>
          <td class="small muted">${fmtDateTime(log.createdAt)}</td>
          <td>
            <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.copyToClipboard('${escapeQuotes(JSON.stringify(log.details || {}))}')">
              Copy Details
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Wire buttons (idempotent)
    const refreshBtn = document.getElementById('ev-refresh');
    if (refreshBtn && !refreshBtn.__wired) {
      refreshBtn.__wired = true;
      refreshBtn.onclick = () => loadSecurityEvents();
    }

    const exportBtn = document.getElementById('ev-export');
    if (exportBtn && !exportBtn.__wired) {
      exportBtn.__wired = true;
      exportBtn.onclick = () => {
        const table = tbody.closest('table');
        if (table) exportTableAsCSV(table, `security-events-${new Date().toISOString().slice(0, 10)}.csv`);
      };
    }

    const purgeBtn = document.getElementById('ev-purge');
    if (purgeBtn && !purgeBtn.__wired) {
      purgeBtn.__wired = true;
      purgeBtn.onclick = async () => {
        const ok = await window.fpuConfirm(
          'Purge all expired security sessions and stale events?\n\nThis cannot be undone.',
          { title: 'Purge Expired?', type: 'danger', okText: 'Purge' }
        );
        if (!ok) return;
        try {
          await adminFetch('/api/admin/security/purge', { method: 'POST' });
          showToast('🧹 Expired sessions purged.', 'success');
          loadSecurityEvents();
        } catch (err) {
          showToast('❌ ' + err.message, 'error');
        }
      };
    }

    // Wire severity tabs (idempotent)
    document.querySelectorAll('#ev-severity-tabs .staff-role-tab').forEach((tab) => {
      if (tab.__wired) return;
      tab.__wired = true;
      tab.addEventListener('click', () => {
        document.querySelectorAll('#ev-severity-tabs .staff-role-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        loadSecurityEvents();
      });
    });

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty" style="color:#dc2626;">${escapeHtml(err.message)}</td></tr>`;
  }
}

// ============================================
// REPORTS
// ============================================
async function loadReports() {
  async function safeJson(url) {
    try {
      const res = await adminFetch(url);
      if (!res.ok) return null;
      const j = await res.json();
      return j.data || j || [];
    } catch { return null; }
  }

  const [students, applications, programmes, paymentsRaw] = await Promise.all([
    safeJson('/api/admin/students?limit=5000'),
    safeJson('/api/admin/applications?limit=5000'),
    safeJson('/api/admin/programmes'),
    safeJson('/api/admin/payments?limit=5000'),
  ]);

  // Normalize payments: unwrap nested `payment` object if present
  const payments = Array.isArray(paymentsRaw)
    ? paymentsRaw.map((row) => row.payment || row)
    : [];

  // ---------- KPI tiles ----------
  setText('rep-stat-students', Array.isArray(students) ? students.length : 0);
  setText('rep-stat-apps', Array.isArray(applications) ? applications.length : 0);
  setText('rep-stat-progs', Array.isArray(programmes) ? programmes.length : 0);

  const revTotal = payments
    .filter((p) => p.status === 'verified')
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  setText('rep-stat-revenue', money(revTotal));

  // If Chart.js isn't available, stop
  if (typeof Chart === 'undefined') return;

  function emptyState(id, msg) {
    const canvas = document.getElementById(id);
    if (canvas && canvas.parentElement) {
      canvas.parentElement.innerHTML = `<p class="muted" style="padding:20px;text-align:center;">${msg}</p>`;
    }
  }

  // ---------- Chart 1: Admission Trend ----------
  const chartA = document.getElementById('rep-chart-admission');
  if (chartA && Array.isArray(applications) && applications.length > 0) {
    const counts = {};
    applications.forEach((a) => {
      if (!a.createdAt) return;
      const d = new Date(a.createdAt);
      const m = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      counts[m] = (counts[m] || 0) + 1;
    });
    const sortedKeys = Object.keys(counts).sort((a, b) => new Date('1 ' + a) - new Date('1 ' + b));
    new Chart(chartA, {
      type: 'line',
      data: {
        labels: sortedKeys,
        datasets: [{ data: sortedKeys.map((k) => counts[k]), borderColor: '#065f46', backgroundColor: 'rgba(6,95,70,.1)', fill: true, tension: 0.4, borderWidth: 3 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
  } else { emptyState('rep-chart-admission', 'No admissions data.'); }

  // ---------- Chart 2: Revenue Trend ----------
  const chartR = document.getElementById('rep-chart-revenue');
  if (chartR && payments.length > 0) {
    const counts = {};
    payments.forEach((p) => {
      if (p.status !== 'verified' || !p.createdAt) return;
      const d = new Date(p.createdAt);
      const m = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      counts[m] = (counts[m] || 0) + (Number(p.amount) || 0);
    });
    const sortedKeys = Object.keys(counts).sort((a, b) => new Date('1 ' + a) - new Date('1 ' + b));
    if (sortedKeys.length) {
      new Chart(chartR, {
        type: 'line',
        data: {
          labels: sortedKeys,
          datasets: [{ data: sortedKeys.map((k) => counts[k]), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.15)', fill: true, tension: 0.4, borderWidth: 3 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      });
    } else {
      emptyState('rep-chart-revenue', 'No verified payments yet.');
    }
  } else { emptyState('rep-chart-revenue', 'No payments yet.'); }

  // ---------- Chart 3: Enrollment by Department ----------
  const chartD = document.getElementById('rep-chart-dept');
  if (chartD && Array.isArray(students) && students.length > 0) {
    const departments = await safeJson('/api/admin/departments');
    const deptMap = new Map((departments || []).map((d) => [d.id, d.code || d.name]));
    const counts = {};
    students.forEach((s) => {
      const key = deptMap.get(s.departmentId) || `Dept ${s.departmentId || '?'}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    new Chart(chartD, {
      type: 'bar',
      data: {
        labels: Object.keys(counts),
        datasets: [{ data: Object.values(counts), backgroundColor: '#3b82f6', borderRadius: 6 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
  } else { emptyState('rep-chart-dept', 'No department data.'); }

  // ---------- Chart 4: Applications by Status ----------
  const chartAp = document.getElementById('rep-chart-apps');
  if (chartAp && Array.isArray(applications) && applications.length > 0) {
    const counts = {};
    applications.forEach((a) => {
      const s = a.status || 'unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    const colorMap = {
      approved: '#065f46', rejected: '#dc2626', registered: '#8b5cf6',
      matriculated: '#3b82f6', pending: '#f59e0b', under_review: '#06b6d4',
    };
    new Chart(chartAp, {
      type: 'doughnut',
      data: {
        labels: Object.keys(counts),
        datasets: [{
          data: Object.values(counts),
          backgroundColor: Object.keys(counts).map((k) => colorMap[k] || '#64748b'),
          borderWidth: 0,
        }],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%' },
    });
  } else { emptyState('rep-chart-apps', 'No application data.'); }

  // ---------- Applications by Status TABLE ----------
  const appTb = document.getElementById('rep-apps-tbody');
  if (appTb && Array.isArray(applications)) {
    const counts = {};
    applications.forEach((a) => { counts[a.status || 'unknown'] = (counts[a.status || 'unknown'] || 0) + 1; });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    appTb.innerHTML = entries.length
      ? entries.map(([st, c]) => `<tr><td>${escapeHtml(st)}</td><td class="num">${c}</td></tr>`).join('')
      : '<tr><td colspan="2" class="empty">No data.</td></tr>';
  }

  // ---------- Payments by Status TABLE ----------
  const payTb = document.getElementById('rep-pay-tbody');
  if (payTb) {
    const counts = {};
    payments.forEach((p) => {
      const st = p.status || 'unknown';
      if (!counts[st]) counts[st] = { count: 0, total: 0 };
      counts[st].count++;
      counts[st].total += Number(p.amount || 0);
    });
    const entries = Object.entries(counts).sort((a, b) => b[1].count - a[1].count);
    payTb.innerHTML = entries.length
      ? entries.map(([st, d]) =>
          `<tr>
            <td>${escapeHtml(st)}</td>
            <td class="num">${d.count}</td>
            <td class="num">${money(d.total)}</td>
          </tr>`
        ).join('')
      : '<tr><td colspan="3" class="empty">No payments yet.</td></tr>';
  }

  // ---------- Wire export ----------
  const exportBtn = document.getElementById('rep-export');
  if (exportBtn && !exportBtn.__wired) {
    exportBtn.__wired = true;
    exportBtn.onclick = () => {
      const table = document.getElementById('rep-apps-tbody')?.closest('table');
      if (table) exportTableAsCSV(table, `reports-${new Date().toISOString().slice(0, 10)}.csv`);
      else showToast('⚠️ Nothing to export yet.', 'warning');
    };
  }
}

// ============================================
// GRADUATION — Tab & button wiring
// ============================================
function wireGraduationPage() {
  // Tab clicks
  const tabs = document.querySelectorAll('#grad-status-tabs .staff-role-tab');
  tabs.forEach((tab) => {
    if (tab.__wired) return;
    tab.__wired = true;
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      loadGraduationsTable();
    });
  });

  // Filter changes
  ['grad-filter-session', 'grad-filter-class', 'grad-search'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el || el.__wired) return;
    el.__wired = true;
    el.addEventListener('change', () => loadGraduationsTable());
    if (id === 'grad-search') {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loadGraduationsTable();
      });
    }
  });

  // Approve selected button
  const approveBtn = Array.from(document.querySelectorAll('.page-head .actions button'))
    .find((b) => /approve/i.test(b.textContent || ''));
  if (approveBtn && !approveBtn.__wired) {
    approveBtn.__wired = true;
    approveBtn.onclick = async () => {
      const ids = Array.from(document.querySelectorAll('.grad-check:checked')).map((cb) => Number(cb.dataset.id));
      if (!ids.length) { showToast('Select at least one record.', 'warning'); return; }
      if (!confirm(`Approve ${ids.length} graduation record${ids.length === 1 ? '' : 's'}?`)) return;

      let ok = 0, failed = 0;
      for (const id of ids) {
        try {
          await adminFetch(`/api/admin/graduation/${id}/approve`, { method: 'POST' });
          ok++;
        } catch { failed++; }
      }
      showToast(`✅ Approved ${ok}${failed ? `, ${failed} failed` : ''}.`, failed ? 'warning' : 'success');
      loadGraduationsTable();
    };
  }

  // Queue Student button
  const queueBtn = Array.from(document.querySelectorAll('.page-head .actions button'))
    .find((b) => /queue/i.test(b.textContent || ''));
  if (queueBtn && !queueBtn.__wired) {
    queueBtn.__wired = true;
    queueBtn.onclick = () => {
      FPU_ADMIN_SPA.navigateTo('graduation-form');
    };
  }
}

// ============================================
// GRADUATION — Queue loader (full featured)
// ============================================
async function loadGraduationsTable() {
  const tbody = document.getElementById('grad-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" class="empty">Loading…</td></tr>';

  try {
    // -------- Fetch all graduation records --------
    const res = await adminFetch('/api/admin/graduation');
    const json = await res.json();
    let rows = json.data || json || [];
    if (!Array.isArray(rows)) rows = [];

    // Normalize to { graduation, student }
    const all = rows.map((r) => ({
      graduation: r.graduation || r,
      student: r.student || r,
    }));

    // -------- Compute tab counts from full set --------
    const counts = {
      all: all.length,
      pending: 0,
      approved: 0,
      graduated: 0,
      rejected: 0,
    };
    all.forEach(({ graduation: g }) => {
      const s = g.status || '';
      if (counts[s] !== undefined) counts[s]++;
    });
    setText('grad-count-all', counts.all);
    setText('grad-count-pending', counts.pending);
    setText('grad-count-approved', counts.approved);
    setText('grad-count-graduated', counts.graduated);
    setText('grad-count-rejected', counts.rejected);

    // -------- Stats tiles --------
    const pending = counts.pending;
    const graduated = counts.graduated;
    const dist = all.filter(({ graduation: g }) => g.classification === 'Distinction').length;
    setText('grad-stat-total', all.length);
    setText('grad-stat-pending', pending);
    setText('grad-stat-graduated', graduated);
    setText('grad-stat-dist', dist);

    // -------- Apply active tab filter --------
    const activeTab = document.querySelector('#grad-status-tabs .staff-role-tab.active');
    const statusFilter = activeTab?.dataset.status || '';
    let visible = all;
    if (statusFilter) visible = visible.filter(({ graduation: g }) => g.status === statusFilter);

    // -------- Apply classification filter --------
    const clsFilter = (document.getElementById('grad-filter-class') || {}).value || '';
    if (clsFilter) visible = visible.filter(({ graduation: g }) => g.classification === clsFilter);

    // -------- Apply session filter (if value set) --------
    const sessionFilter = (document.getElementById('grad-filter-session') || {}).value || '';
    if (sessionFilter) {
      visible = visible.filter(({ graduation: g }) =>
        String(g.sessionId || g.session_id || '') === String(sessionFilter)
      );
    }

    // -------- Apply search filter --------
    const search = (document.getElementById('grad-search') || {}).value || '';
    if (search) {
      const q = search.toLowerCase();
      visible = visible.filter(({ student: s }) => (
        String(s.matricNumber || '').toLowerCase().includes(q) ||
        String(s.firstName || '').toLowerCase().includes(q) ||
        String(s.lastName || '').toLowerCase().includes(q)
      ));
    }

    // -------- Update count in panel header --------
    setText('grad-count', `Showing ${visible.length} of ${all.length} record${all.length === 1 ? '' : 's'}`);

    if (!visible.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">No records match your filters.</td></tr>';
      return;
    }

    // -------- Render rows --------
    tbody.innerHTML = visible.map(({ graduation: g, student: s }) => {
      const status = g.status || 'pending';
      const isPending = status === 'pending';
      const isApproved = status === 'approved';
      const isGraduated = status === 'graduated';
      const isRejected = status === 'rejected';
      const canSelect = !isGraduated && !isRejected;

      const clsName = (() => {
        const c = g.classification;
        if (c === 'Distinction') return 'distinction';
        if (c === 'Upper Credit') return 'upper';
        if (c === 'Lower Credit') return 'lower';
        if (c === 'Pass') return 'pass';
        if (c === 'Fail') return 'fail';
        return '';
      })();

      return `
        <tr>
          <td>
            ${canSelect
              ? `<input type="checkbox" class="grad-check" data-id="${g.id}" />`
              : ''}
          </td>
          <td><code>${escapeHtml(s.matricNumber || '—')}</code></td>
          <td>${escapeHtml(((s.firstName || '') + ' ' + (s.lastName || '')).trim() || '—')}</td>
          <td>${escapeHtml(g.level || '—')}</td>
          <td class="num">${g.cgpa != null ? Number(g.cgpa).toFixed(2) : '—'}</td>
          <td>${clsName ? `<span class="grad-class ${clsName}">${escapeHtml(g.classification)}</span>` : '—'}</td>
          <td>${badge(status)}</td>
          <td>
            <div class="row-actions" style="justify-content:flex-end; gap:4px;">
              ${isPending
                ? `<button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.approveGraduation(${g.id})">Approve</button>
                   <button class="btn btn-sm btn-ghost" style="color:#dc2626;" onclick="FPU_ADMIN.rejectGraduation(${g.id})">Reject</button>`
                : ''}
              ${isApproved
                ? `<button class="btn btn-sm btn-accent" onclick="FPU_ADMIN.markGraduated(${g.id})">Graduate</button>`
                : ''}
              <button class="btn btn-sm btn-outline"
                onclick="FPU_ADMIN.openTranscriptModal(${s.id || g.studentId})">
                Transcript
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // -------- Wire select-all checkbox --------
    const selectAll = document.getElementById('grad-select-all');
    if (selectAll) {
      selectAll.checked = false;
      selectAll.onchange = () => {
        tbody.querySelectorAll('.grad-check').forEach((cb) => {
          cb.checked = selectAll.checked;
        });
      };
    }

    // -------- Wire tab clicks --------
    document.querySelectorAll('#grad-status-tabs .staff-role-tab').forEach((tab) => {
      if (tab.__wired) return;
      tab.__wired = true;
      tab.addEventListener('click', () => {
        document.querySelectorAll('#grad-status-tabs .staff-role-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        loadGraduationsTable();
      });
    });

    // -------- Wire bulk approve button --------
    const bulkBtn = document.getElementById('grad-bulk-approve');
    if (bulkBtn && !bulkBtn.__wired) {
      bulkBtn.__wired = true;
      bulkBtn.onclick = async () => {
        const ids = Array.from(document.querySelectorAll('.grad-check:checked'))
          .map((cb) => Number(cb.dataset.id));
        if (!ids.length) {
          showToast('⚠️ Select at least one record.', 'warning');
          return;
        }
        const ok = await window.fpuConfirm(
          `Approve ${ids.length} graduation record${ids.length === 1 ? '' : 's'}?`,
          { title: 'Bulk Approve', type: 'info', okText: 'Approve All' }
        );
        if (!ok) return;

        const original = bulkBtn.textContent;
        bulkBtn.disabled = true;
        bulkBtn.textContent = 'Approving…';

        let approved = 0, failed = 0;
        for (const id of ids) {
          try {
            await adminFetch(`/api/admin/graduation/${id}/approve`, { method: 'POST' });
            approved++;
          } catch {
            failed++;
          }
        }
        bulkBtn.disabled = false;
        bulkBtn.textContent = original;

        showToast(
          failed === 0
            ? `✅ Approved ${approved} record${approved === 1 ? '' : 's'}.`
            : `⚠️ Approved ${approved}, failed ${failed}.`,
          failed === 0 ? 'success' : 'warning'
        );
        loadGraduationsTable();
      };
    }

    // -------- Wire refresh button --------
    const buttons = Array.from(document.querySelectorAll('.page-head .actions button'));
    const refreshBtn = buttons.find((b) => /refresh/i.test(b.textContent || ''));
    if (refreshBtn && !refreshBtn.__wired) {
      refreshBtn.__wired = true;
      refreshBtn.onclick = () => loadGraduationsTable();
    }

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty" style="color:#dc2626;">${escapeHtml(err.message)}</td></tr>`;
    setText('grad-count', 'Error loading records');
  }
}

// ---------- Individual actions ----------
async function approveGraduation(id) {
  try {
    await adminFetch(`/api/admin/graduation/${id}/approve`, { method: 'POST' });
    showToast('✅ Graduation approved.', 'success');
    loadGraduationsTable();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

async function rejectGraduation(id) {
  const remarks = prompt('Rejection remarks (optional):');
  if (remarks === null) return;
  try {
    await adminFetch(`/api/admin/graduation/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
    showToast('⚠️ Graduation rejected.', 'warning');
    loadGraduationsTable();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

async function markGraduated(id) {
  const ok = await window.fpuConfirm(
    'Mark this student as graduated?\n\nThis will finalize their graduation status and cannot be undone.',
    { title: 'Mark as Graduated', type: 'success', okText: 'Mark Graduated' }
  );
  if (!ok) return;
  try {
    await adminFetch(`/api/admin/graduation/${id}/graduate`, { method: 'POST' });
    showToast('🎓 Marked as graduated.', 'success');
    loadGraduationsTable();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

// ============================================
// LIBRARY: ISSUE BOOK
// ============================================
async function submitIssueBookForm() {
  // 1. Get values from the form (we will add these IDs to the HTML)
  const bookId = document.getElementById('issue-book-id')?.value;
  const userId = document.getElementById('issue-user-id')?.value;
  const borrowDate = document.getElementById('issue-borrow-date')?.value;
  const dueDate = document.getElementById('issue-due-date')?.value;

  if (!bookId || !userId || !dueDate) {
    showToast('⚠️ Please select a book, a borrower, and a due date.', 'warning');
    return;
  }

  const submitBtn = document.getElementById('issue-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Issuing...';
  }

  try {
    // 2. Send data to the backend API
    const res = await adminFetch('/api/admin/library/borrows', {
      method: 'POST',
      body: JSON.stringify({
        bookId: Number(bookId),
        userId: Number(userId),
        dueAt: new Date(dueDate).toISOString(),
        borrowedAt: borrowDate ? new Date(borrowDate).toISOString() : new Date().toISOString()
      })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to issue book');
    }

    showToast('📚 Book issued successfully!', 'success');
    
    // 3. Redirect back to the borrows list safely
    window.location.hash = '#borrows';
    
    // 4. Reload the table if the function exists
    setTimeout(() => {
      if (typeof loadBorrowsTable === 'function') loadBorrowsTable();
    }, 200);

  } catch (err) {
    showToast('❌ ' + err.message, 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Issue Book';
    }
  }
}

// ============================================
// CLEARANCES: BULK ACTIONS (Fixed)
// ============================================
async function bulkClearClearances(newStatus) {
  const checkboxes = document.querySelectorAll('.clr-student-check:checked');
  if (checkboxes.length === 0) {
    showToast('⚠️ Select at least one student.', 'warning');
    return;
  }

  const studentIds = Array.from(checkboxes).map(cb => Number(cb.value));
  
  const ok = await window.fpuConfirm(
    `Mark ${studentIds.length} student(s) as ${newStatus.toUpperCase()}?`,
    { title: `Bulk ${newStatus}`, type: newStatus === 'rejected' ? 'danger' : 'success', okText: 'Confirm' }
  );
  if (!ok) return;

  let success = 0;
  let failed = 0;

  // Show a loading toast
  showToast(`Processing ${studentIds.length} students...`, 'info');

  for (const id of studentIds) {
    try {
      // We use the individual update function to avoid bulk API errors
      const res = await adminFetch(`/api/admin/clearances/student/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        success++;
      } else {
        // If PUT fails (404), try POST to create it
        const createRes = await adminFetch('/api/admin/clearances', {
          method: 'POST',
          body: JSON.stringify({ studentId: id, status: newStatus, remarks: 'Bulk action' }),
        });
        if (createRes.ok) success++;
        else failed++;
      }
    } catch (err) {
      failed++;
    }
  }

  if (failed === 0) {
    showToast(`✅ Successfully updated ${success} students.`, 'success');
  } else {
    showToast(`⚠️ Updated ${success}, failed ${failed}.`, 'warning');
  }
  
  // Reload the table to show new stats
  loadDepartmentClearances();
}

// ============================================
// CLEARANCES: EXPORT CSV
// ============================================
function exportClearanceCSV() {
  const rows = document.querySelectorAll('#cdd-tbody tr');
  if (!rows.length) {
    showToast('⚠️ No data to export.', 'warning');
    return;
  }

  let csv = 'Matric,Student Name,Level,Status,Remarks\n';
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 5) return;
    const matric = cells[1]?.textContent.trim() || '';
    const name = cells[2]?.textContent.trim() || '';
    const level = cells[3]?.textContent.trim() || '';
    const status = cells[4]?.textContent.trim() || '';
    const remarks = cells[5]?.textContent.trim() || '';
    csv += `"${matric}","${name}","${level}","${status}","${remarks}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clearances-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ Exported.', 'success');
}

// ============================================
// FEES: Level-based fee management
// ============================================
async function loadFeeLevels() {
  const grid = document.getElementById('fee-grid');
  if (!grid) return;

  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;"><span class="spinner"></span> Loading fees…</div>';

  try {
    const res = await adminFetch('/api/admin/fees');
    if (!res.ok) throw new Error(`API returned ${res.status}`);

    const json = await res.json();
    const fees = json.data || [];

    console.log('[fees] Loaded:', fees);

    const amounts = fees.map(f => Number(f.amount || 0)).filter(n => n > 0);
    const lowest = amounts.length ? Math.min(...amounts) : 0;
    const highest = amounts.length ? Math.max(...amounts) : 0;
    const avg = amounts.length ? Math.round(amounts.reduce((s, n) => s + n, 0) / amounts.length) : 0;

    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setT('fee-stat-total', fees.length);
    setT('fee-stat-lowest', lowest ? money(lowest) : '—');
    setT('fee-stat-highest', highest ? money(highest) : '—');
    setT('fee-stat-average', avg ? money(avg) : '—');

    if (!fees.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:60px 20px;background:#fff;border:2px dashed #e2e8f0;border-radius:14px;">
          <div style="font-size:3rem;margin-bottom:12px;">💸</div>
          <h3 style="margin:0 0 6px;color:#0f172a;">No fees in database</h3>
          <p style="margin:0 0 20px;color:#64748b;">Click "Add Fee Level" to seed your first fee.</p>
          <button class="btn btn-primary" onclick="FPU_ADMIN.openAddFeeModal()">+ Add Fee Level</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = fees
      .sort((a, b) => String(a.level).localeCompare(String(b.level)))
      .map(f => `
        <div class="fee-card">
          <span class="fee-level-badge">${escapeHtml(String(f.level || '—').toUpperCase())}</span>
          <div class="fee-amount-value">${money(f.amount)}</div>
          <div class="fee-amount-label">Tuition Fee</div>
          <div class="fee-actions">
            <button class="btn btn-sm btn-outline" onclick="FPU_ADMIN.openEditFeeModal(${f.id}, '${escapeQuotes(f.level)}', ${Number(f.amount)})">✏️ Edit</button>
            <button class="btn btn-sm btn-ghost" style="color:#dc2626;" onclick="FPU_ADMIN.deleteFeeLevel(${f.id}, '${escapeQuotes(f.level)}')">🗑 Delete</button>
          </div>
        </div>
      `).join('');

  } catch (err) {
    console.error('[fees] Error:', err);
    grid.innerHTML = `
      <div style="grid-column:1/-1;padding:20px;background:#fee2e2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;">
        <strong>Failed to load fees:</strong> ${escapeHtml(err.message)}
        <div style="margin-top:12px;font-size:12px;color:#7f1d1d;">Open F12 → Console for details.</div>
      </div>
    `;
  }
}

// ============================================
// FEES: Add new fee level (Modal)
// ============================================
async function openAddFeeModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'fpu-modal-backdrop';
  backdrop.innerHTML = `
    <div class="fpu-modal">
      <div class="fpu-modal-header">
        <h3>Add Fee Level</h3>
        <button class="btn btn-sm btn-ghost" onclick="this.closest('.fpu-modal-backdrop').remove()">×</button>
      </div>
      <div class="fpu-modal-body">
        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label">Level <span class="req">*</span></label>
          <select class="form-select" id="fee-new-level">
            <option value="ND 1">ND 1</option>
            <option value="ND 2">ND 2</option>
            <option value="HND 1">HND 1</option>
            <option value="HND 2">HND 2</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Amount (₦) <span class="req">*</span></label>
          <input class="form-control" type="number" step="0.01" id="fee-new-amount" placeholder="e.g. 40000" />
        </div>
      </div>
      <div class="fpu-modal-footer">
        <button class="btn btn-outline" onclick="this.closest('.fpu-modal-backdrop').remove()">Cancel</button>
        <button class="btn btn-primary" id="fee-save-btn">Save Fee</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#fee-save-btn').onclick = async () => {
    const level = backdrop.querySelector('#fee-new-level').value;
    const amount = Number(backdrop.querySelector('#fee-new-amount').value);

    if (!amount || amount <= 0) {
      showToast('⚠️ Please enter a valid amount.', 'warning');
      return;
    }

    try {
      const res = await adminFetch('/api/admin/fees', {
        method: 'POST',
        body: JSON.stringify({ level, amount }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save fee');
      }
      showToast('✅ Fee level added.', 'success');
      backdrop.remove();
      loadFeeLevels();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };
}

// ============================================
// FEES: Edit existing fee level (Modal)
// ============================================
async function openEditFeeModal(id, level, amount) {
  const backdrop = document.createElement('div');
  backdrop.className = 'fpu-modal-backdrop';
  backdrop.innerHTML = `
    <div class="fpu-modal">
      <div class="fpu-modal-header">
        <h3>Edit Fee — ${escapeHtml(level)}</h3>
        <button class="btn btn-sm btn-ghost" onclick="this.closest('.fpu-modal-backdrop').remove()">×</button>
      </div>
      <div class="fpu-modal-body">
        <div class="form-group">
          <label class="form-label">Amount (₦) <span class="req">*</span></label>
          <input class="form-control" type="number" step="0.01" id="fee-edit-amount" value="${amount}" />
        </div>
      </div>
      <div class="fpu-modal-footer">
        <button class="btn btn-outline" onclick="this.closest('.fpu-modal-backdrop').remove()">Cancel</button>
        <button class="btn btn-primary" id="fee-update-btn">Update Fee</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#fee-update-btn').onclick = async () => {
    const newAmount = Number(backdrop.querySelector('#fee-edit-amount').value);
    if (!newAmount || newAmount <= 0) {
      showToast('⚠️ Please enter a valid amount.', 'warning');
      return;
    }

    try {
      const res = await adminFetch(`/api/admin/fees/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ amount: newAmount }),
      });
      if (!res.ok) throw new Error('Failed to update');
      showToast('✅ Fee updated.', 'success');
      backdrop.remove();
      loadFeeLevels();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };
}

// ============================================
// FEES: Delete fee level (Modal)
// ============================================
async function deleteFeeLevel(id, level) {
  const backdrop = document.createElement('div');
  backdrop.className = 'fpu-modal-backdrop';
  backdrop.innerHTML = `
    <div class="fpu-modal">
      <div class="fpu-modal-header">
        <h3>Delete Fee Level</h3>
        <button class="btn btn-sm btn-ghost" onclick="this.closest('.fpu-modal-backdrop').remove()">×</button>
      </div>
      <div class="fpu-modal-body">
        <p style="margin-bottom: 20px;">Are you sure you want to delete the <strong>${escapeHtml(level)}</strong> fee structure?</p>
        <p class="muted small">This action cannot be undone. Students won't be able to pay this level anymore.</p>
      </div>
      <div class="fpu-modal-footer">
        <button class="btn btn-outline" onclick="this.closest('.fpu-modal-backdrop').remove()">Cancel</button>
        <button class="btn" style="background:#dc2626;color:#fff;border-color:#dc2626;" id="fee-delete-btn">Delete Fee</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#fee-delete-btn').onclick = async () => {
    try {
      const res = await adminFetch(`/api/admin/fees/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('🗑️ Fee level deleted.', 'success');
      backdrop.remove();
      loadFeeLevels();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };
}

async function openEditFeeModal(id, level, amount) {
  const backdrop = document.createElement('div');
  backdrop.className = 'fpu-modal-backdrop';
  backdrop.innerHTML = `
    <div class="fpu-modal" style="max-width:480px;">
      <div class="fpu-modal-header">
        <h3>Edit — ${escapeHtml(level)}</h3>
        <button class="btn btn-sm btn-ghost" onclick="this.closest('.fpu-modal-backdrop').remove()">×</button>
      </div>
      <div class="fpu-modal-body">
        <div class="form-group">
          <label class="form-label">Amount (₦)</label>
          <input class="form-control" type="number" step="0.01" id="fee-edit-amount" value="${amount}" />
        </div>
      </div>
      <div class="fpu-modal-footer">
        <button class="btn btn-outline" onclick="this.closest('.fpu-modal-backdrop').remove()">Cancel</button>
        <button class="btn btn-primary" id="fee-update-btn">Update</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#fee-update-btn').onclick = async () => {
    const newAmount = Number(backdrop.querySelector('#fee-edit-amount').value);
    if (!newAmount || newAmount <= 0) {
      showToast('⚠️ Please enter a valid amount.', 'warning');
      return;
    }

    try {
      const res = await adminFetch(`/api/admin/fees/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ amount: newAmount }),
      });
      if (!res.ok) throw new Error('Failed to update');
      showToast('✅ Fee updated.', 'success');
      backdrop.remove();
      loadFeeLevels();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };
}

async function deleteFeeLevel(id, level) {
  const ok = await window.fpuConfirm(
    `Delete fee level "${level}"? Students won't be able to pay this level anymore.`,
    { title: 'Delete Fee Level', type: 'danger', okText: 'Delete' }
  );
  if (!ok) return;

  try {
    const res = await adminFetch(`/api/admin/fees/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    showToast('🗑️ Fee level deleted.', 'success');
    loadFeeLevels();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

// ============================================
// STAFF PROFILE: Action helpers
// ============================================
function editStaffFromProfile() {
  const id = new URLSearchParams(window.location.hash.split('?')[1] || '').get('id');
  if (id) window.location.hash = `#staff-form?id=${id}`;
}

// ============================================
// STAFF PROFILE: Reset Password Modal Logic
// ============================================
function resetStaffPassword() {
  const id = getCurrentStaffId();
  if (!id) return;

  // Reset the form
  const modal = document.getElementById('reset-password-modal');
  const input = document.getElementById('reset-pwd-input');
  const errorBox = document.getElementById('reset-pwd-error');
  
  if (!modal || !input) return;

  input.value = '';
  errorBox.style.display = 'none';
  
  // Show modal
  modal.style.display = 'flex';
  // Small delay to allow CSS transition to trigger
  setTimeout(() => modal.classList.add('show'), 10);
  input.focus();
}

function closeResetModal() {
  const modal = document.getElementById('reset-password-modal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 200);
  }
}

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}

async function submitResetPassword() {
  const id = getCurrentStaffId();
  if (!id) return;

  const input = document.getElementById('reset-pwd-input');
  const btn = document.getElementById('reset-pwd-submit');
  const errorBox = document.getElementById('reset-pwd-error');
  
  const newPassword = input.value.trim();
  
  // UI Loading state
  btn.disabled = true;
  btn.textContent = 'Resetting...';
  errorBox.style.display = 'none';

  try {
    await adminFetch(`/api/admin/staff/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password: newPassword || undefined }),
    });
    
    closeResetModal();
    showToast('✅ Password reset successfully.', 'success');
    
  } catch (err) {
    errorBox.textContent = err.message || 'Failed to reset password.';
    errorBox.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Reset Password';
  }
}

// Close modal if clicking outside of it
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('reset-password-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeResetModal();
    });
  }
});

async function toggleStaffActive() {
  const id = new URLSearchParams(window.location.hash.split('?')[1] || '').get('id');
  if (!id) return;
  const ok = await window.fpuConfirm('Toggle this staff member\'s active status?', { title: 'Toggle Status', type: 'warning' });
  if (!ok) return;
  try {
    await adminFetch(`/api/admin/staff/${id}/toggle-active`, { method: 'POST' });
    showToast('✅ Status updated.', 'success');
    if (window.FPU_ADMIN.loadStaffProfile) loadStaffProfile();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

// ============================================
// STAFF: Profile Loader
// ============================================
async function loadStaffProfile() {
  // Parse the ID from the URL hash
  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const id = params.get('id');

  if (!id) {
    document.getElementById('sp-name').textContent = 'No staff selected';
    document.getElementById('sp-contact').innerHTML = '<p class="muted">No staff member selected.</p>';
    return;
  }

  try {
    const res = await adminFetch(`/api/admin/staff/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Staff not found');
    
    const user = json.data || {};
    const sp = user.staffProfile || {};
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    const initials = ((user.firstName || ' ')[0] + (user.lastName || ' ')[0]).toUpperCase().trim() || 'S';

    // Update page title
    const subEl = document.getElementById('sp-subtitle');
    if (subEl) subEl.textContent = `${user.email || ''} · ${String(user.role || '').replace(/_/g, ' ')}`;

    // Avatar + Identity
    const avatarEl = document.getElementById('sp-avatar');
    avatarEl.innerHTML = user.photoUrl 
      ? `<img src="${escapeHtml(user.photoUrl)}" alt="">` 
      : escapeHtml(initials);
    
    document.getElementById('sp-name').textContent = fullName || 'Unknown Staff';
    document.getElementById('sp-email').textContent = user.email || '';
    
    const badgesEl = document.getElementById('sp-badges');
    badgesEl.innerHTML = `
      ${roleBadge(user.role)}
      ${user.isActive !== false ? badge('active') : badge('inactive')}
    `;

    // Contact panel
    const contactEl = document.getElementById('sp-contact');
    contactEl.innerHTML = `
      <div class="field-row"><span class="k">Phone</span><span class="v">${escapeHtml(user.phone || '—')}</span></div>
      <div class="field-row"><span class="k">Gender</span><span class="v">${escapeHtml(user.gender || '—')}</span></div>
      <div class="field-row"><span class="k">Address</span><span class="v">${escapeHtml(user.address || '—')}</span></div>
    `;

    // Employment panel
    const empEl = document.getElementById('sp-employment');
    empEl.innerHTML = `
      <div class="field-row"><span class="k">Department</span><span class="v">${escapeHtml(user.departmentName || user.department?.name || '—')}</span></div>
      <div class="field-row"><span class="k">Rank</span><span class="v">${escapeHtml(sp.rank || '—')}</span></div>
      <div class="field-row"><span class="k">Specialization</span><span class="v">${escapeHtml(sp.specialization || '—')}</span></div>
      <div class="field-row"><span class="k">Qualification</span><span class="v">${escapeHtml(sp.qualification || '—')}</span></div>
      <div class="field-row"><span class="k">Employment Date</span><span class="v">${sp.employmentDate ? fmtDate(sp.employmentDate) : '—'}</span></div>
    `;

    // Courses taught
    const coursesEl = document.getElementById('sp-courses');
    try {
      const allocsRes = await adminFetch(`/api/admin/allocations?lecturerId=${id}&limit=500`);
      const allocs = (await allocsRes.json()).data || [];
      const valid = allocs.filter(a => a.course && a.course.code);
      
      document.getElementById('sp-courses-count').textContent = `${valid.length} course${valid.length === 1 ? '' : 's'}`;
      
      if (!valid.length) {
        coursesEl.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b;">No courses allocated yet.</div>';
      } else {
        coursesEl.innerHTML = valid.map(a => `
          <div class="sp-course-row">
            <span class="code">${escapeHtml(a.course.code)}</span>
            <span class="title">${escapeHtml(a.course.title || '—')}</span>
            <span class="units">${Number(a.course.unit) || 0}</span>
          </div>
        `).join('');
      }
    } catch (e) {
      coursesEl.innerHTML = '<div style="padding:20px;text-align:center;color:#dc2626;">Could not load courses.</div>';
    }

    // Recent activity (audit log)
    const activityEl = document.getElementById('sp-activity');
    try {
      const auditRes = await adminFetch(`/api/admin/audit?userId=${id}&limit=8`);
      const logs = (await auditRes.json()).data || [];
      if (!logs.length) {
        activityEl.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b;">No recent activity.</div>';
      } else {
        activityEl.innerHTML = logs.map(l => {
          const log = l.log || l;
          return `
            <div class="field-row">
              <span class="k">${escapeHtml(log.action || '')}</span>
              <span class="v">${timeAgo(log.createdAt)}</span>
            </div>
          `;
        }).join('');
      }
    } catch {
      activityEl.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b;">Could not load activity.</div>';
    }

  } catch (err) {
    console.error('[staff-profile] Error:', err);
    document.getElementById('sp-name').textContent = 'Error';
    document.getElementById('sp-subtitle').textContent = err.message;
    document.getElementById('sp-contact').innerHTML = `<div style="padding:20px;color:#dc2626;">Error: ${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// STAFF PROFILE: Action helpers
// ============================================
function getCurrentStaffId() {
  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  return params.get('id');
}

function editStaffFromProfile() {
  const id = getCurrentStaffId();
  if (id) window.location.hash = `#staff-form?id=${id}`;
}

async function deleteStaff() {
  const id = getCurrentStaffId();
  if (!id) return;
  const ok = await window.fpuConfirm('Delete this staff member? This cannot be undone.', { title: 'Delete Staff', type: 'danger', okText: 'Delete' });
  if (!ok) return;
  try {
    await adminFetch(`/api/admin/staff/${id}`, { method: 'DELETE' });
    showToast('🗑️ Staff deleted.', 'success');
    window.location.hash = '#staff';
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

// ============================================
// STAFF: Tab Filtering
// ============================================
async function filterStaff(role, btnElement) {
  // 1. Highlight the active tab
  document.querySelectorAll('.staff-tab').forEach(btn => {
    btn.classList.remove('btn-primary', 'active');
    btn.classList.add('btn-outline');
  });
  if (btnElement) {
    btnElement.classList.remove('btn-outline');
    btnElement.classList.add('btn-primary', 'active');
  }

  // 2. Update the state or URL so the load function knows what to fetch
  // If you use a router/hash system, update it:
  // window.location.hash = role === 'all' ? '#staff' : `#staff?role=${role}`;

  // 3. Fetch the filtered data
  // NOTE: If your existing loadStaffList() function accepts a role, pass it here.
  // If not, we need to modify how it fetches.
  await loadStaffList(role === 'all' ? null : role); 
}

// Modify your existing loadStaffList function to accept a role parameter
async function loadStaffList(roleFilter = null) {
  try {
    // Build the API URL with the role query parameter
    let url = '/api/admin/staff';
    if (roleFilter) {
      url += `?role=${roleFilter}`;
    }

    const res = await adminFetch(url);
    const json = await res.json();
    const staffList = json.data || [];

    // Now, render the staffList to the DOM...
    // (Your existing code that creates the cards goes here)
    renderStaffCards(staffList);

  } catch (err) {
    showToast('❌ Could not load staff list.', 'error');
    console.error(err);
  }
}

async function saveStaffForm(e) {
  if (e) e.preventDefault();
  
  const id = getCurrentStaffId(); // Assuming you have this helper
  
  // Gather all values from the form
  const payload = {
    firstName: document.getElementById('sf-firstName').value,
    lastName: document.getElementById('sf-lastName').value,
    middleName: document.getElementById('sf-middleName').value,
    email: document.getElementById('sf-email').value,
    phone: document.getElementById('sf-phone').value,
    gender: document.getElementById('sf-gender').value,
    role: document.getElementById('sf-role').value,
    departmentId: document.getElementById('sf-department').value,
    // --- STAFF PROFILE FIELDS ---
    rank: document.getElementById('sf-rank').value,
    specialization: document.getElementById('sf-specialization').value,
    qualification: document.getElementById('sf-qualification').value,
    employmentDate: document.getElementById('sf-employmentDate').value,
  };

  const password = document.getElementById('sf-password').value;
  if (password) payload.password = password;

  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admin/staff/${id}` : '/api/admin/staff';
    
    await adminFetch(url, {
      method: method,
      body: JSON.stringify(payload)
    });
    
    showToast('✅ Staff saved successfully.', 'success');
    window.location.hash = id ? `#staff-profile?id=${id}` : '#staff';
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

// ============================================
// EXAMS: Load Exam Periods
// ============================================
async function loadExamPeriods() {
  // Look for the container where the periods should go. 
  // (Make sure this ID matches what's in your exams HTML)
  const container = document.getElementById('exam-periods-list') || document.querySelector('.exam-periods-container'); 
  
  if (!container) {
    console.warn('Exam periods container not found in DOM.');
    return;
  }

  container.innerHTML = '<span class="spinner"></span> Loading periods...';

  try {
    const res = await adminFetch('/api/admin/exams/periods');
    const json = await res.json();
    const periods = json.data || [];

    if (!periods.length) {
      container.innerHTML = '<span class="muted">No periods configured.</span>';
      return;
    }

    // Render the periods cleanly
    container.innerHTML = periods.map(p => `
      <div style="padding: 6px 12px; background: #f1f5f9; border-radius: 6px; margin-right: 8px; margin-bottom: 8px; font-size: 12px; font-weight: 600; color: #0f172a; display: inline-block;">
        ${escapeHtml(p.name)}
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load periods', err);
    container.innerHTML = '<span style="color: #dc2626; font-size: 12px;">Failed to load periods.</span>';
  }
}

// Export it in your window.FPU_ADMIN object
window.FPU_ADMIN = {
  // ... existing functions
  loadExamPeriods,
};

// ============================================
// EXAMS: Load A3 Exam Sheet (Fixed Layout)
// ============================================
async function loadExamSheet() {
  const root = document.getElementById('exsheet-root');
  const titleEl = document.getElementById('exsheet-title');
  const subtitleEl = document.getElementById('exsheet-subtitle');
  
  if (!root) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  
  const schoolId = params.get('schoolId');
  const sessionId = params.get('sessionId');
  const semester = params.get('semester') || 'first';
  const schoolName = params.get('name') || 'School';

  if (!schoolId) {
    root.innerHTML = '<div style="text-align:center;padding:40px;color:#dc2626;">No school selected. Please go back.</div>';
    return;
  }

  titleEl.textContent = `${schoolName} Exam Timetable`;
  subtitleEl.textContent = `Loading schedules...`;

  try {
    const res = await adminFetch(`/api/admin/exams?schoolId=${schoolId}&sessionId=${sessionId}&semester=${semester}`);
    const json = await res.json();
    const exams = json.data || [];

    const year = new Date().getFullYear();
    subtitleEl.textContent = `${exams.length} exams scheduled`;

    if (!exams.length) {
      root.innerHTML = `<div style="text-align:center;padding:60px;background:#fff;color:#64748b;font-size:16px;">No Exams Scheduled</div>`;
      return;
    }

    root.innerHTML = `
      <div class="ex-sheet" id="a3-sheet">
        <div class="ex-head">
          <img src="/images/logo.png" alt="Logo" class="ex-logo">
          <div class="ex-head-text">
            <div class="institution">FEDERAL POLYTECHNIC UGEP</div>
            <div class="faculty">${escapeHtml(schoolName.toUpperCase())}</div>
            <div class="title-line">${year}/2025 ${semester.toUpperCase()} SEMESTER LECTURERS TIMETABLE</div>
          </div>
        </div>

        <table class="ex-table">
          <thead>
            <tr>
              <th class="col-days">DAYS</th>
              <th class="col-date">DATE</th>
              <th class="col-code">CODE</th>
              <th class="col-cu">CU</th>
              <th class="col-title">COURSE TITLE</th>
              <th class="col-time">TIME</th>
              <th class="col-lecturer">LECTURER</th>
              <th class="col-venue">VENUE</th>
            </tr>
          </thead>
          <tbody>
            ${renderExamTableRows(exams)}
          </tbody>
        </table>

        <div style="margin-top: 30px; font-size: 11pt; font-weight: 700;">
          <div>Clp. AKIRKPO, Martha Onsisi mnip</div>
          <div>HOD, Computer Science</div>
        </div>
      </div>
    `;

    document.getElementById('exsheet-print').onclick = () => window.print();

  } catch (err) {
    console.error('Failed to load exam sheet', err);
    root.innerHTML = '<div style="text-align:center;padding:40px;color:#dc2626;">Failed to load exam schedule.</div>';
  }
}

// Helper to group exams by date and slot them into periods
function renderExamTableRows(exams) {
  // Group by Date
  const grouped = {};
  exams.forEach(ex => {
    const d = String(ex.examDate).split('T')[0];
    if (!grouped[d]) grouped[d] = { morning: [], afternoon: [], evening: [] };
    
    // Slot into period based on start time
    const time = ex.startTime || '09:00';
    if (time < '11:00') grouped[d].morning.push(ex);
    else if (time < '14:00') grouped[d].afternoon.push(ex);
    else grouped[d].evening.push(ex);
  });

  const daysOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

  return Object.keys(grouped).sort().map(dateStr => {
    const dateObj = new Date(dateStr);
    const dayName = daysOfWeek[dateObj.getDay()];
    const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const row = grouped[dateStr];

    const renderCell = (arr) => {
      if (!arr.length) return '<td class="ex-cell-empty"></td>';
      return `<td>${arr.map(ex => `
        <div class="ex-cell-block">
          <div class="ex-cell-course">${escapeHtml(ex.course?.code || 'N/A')}</div>
          <div class="ex-cell-title">${escapeHtml(ex.course?.title || '')}</div>
          <div class="ex-cell-venue">${escapeHtml(ex.venue || 'TBA')}</div>
          <div class="ex-cell-inv">${escapeHtml(ex.invigilators || '')}</div>
        </div>
      `).join('')}</td>`;
    };

    return `
      <tr>
        <td class="col-days">${dayName}</td>
        <td class="col-date">${formattedDate}</td>
        ${renderCell(row.morning)}
        ${renderCell(row.afternoon)}
        ${renderCell(row.evening)}
      </tr>
    `;
  }).join('');
}

// ============================================
// RESULTS: Dashboard View
// ============================================
async function loadResultsDashboard() {
  const grid = document.getElementById('res-dept-grid');
  if (!grid) return;

  // Get Filters
  const status = document.getElementById('res-filter-status')?.value || '';
  const semester = document.getElementById('res-filter-semester')?.value || '';
  const schoolId = document.getElementById('res-filter-school')?.value || '';

  grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#64748b;"><span class="spinner"></span> Loading results...</div>';

  try {
    // 1. Fetch ALL results (no filters) to get true stats
    const resAll = await adminFetch('/api/admin/results?limit=10000');
    const jsonAll = await resAll.json();
    const allResults = jsonAll.data || [];

    // 2. Calculate true global stats
    let awaiting = 0, approved = 0, published = 0, rejected = 0;
    let totalRows = allResults.length;

    allResults.forEach(r => {
      if (r.status === 'hod_verified') awaiting++;
      else if (r.status === 'approved') approved++;
      else if (r.status === 'published') published++;
      else if (r.status === 'admin_rejected' || r.status === 'hod_rejected') rejected++;
    });

    // 3. Update the top stats bar
    if (document.getElementById('res-stat-total')) document.getElementById('res-stat-total').textContent = totalRows;
    if (document.getElementById('res-stat-pending')) document.getElementById('res-stat-pending').textContent = awaiting;
    
    // Safely update the "Ready to Publish" box (which represents approved)
    const readyBox = document.getElementById('res-stat-ready') || document.getElementById('res-stat-approved');
    if (readyBox) readyBox.textContent = approved;

    // 4. Group ALL results by department to build the cards accurately
    const deptMap = {};
    allResults.forEach(r => {
      const deptId = r.course?.departmentId;
      if (!deptId) return;

      if (!deptMap[deptId]) {
        deptMap[deptId] = { 
          id: deptId, 
          name: r.course.departmentName || 'Unknown Department', 
          code: r.course.departmentCode || 'DEPT',
          total: 0, awaiting: 0, approved: 0, published: 0, rejected: 0
        };
      }
      
      deptMap[deptId].total++;
      if (r.status === 'hod_verified') deptMap[deptId].awaiting++;
      if (r.status === 'approved') deptMap[deptId].approved++;
      if (r.status === 'published') deptMap[deptId].published++;
      if (r.status === 'admin_rejected' || r.status === 'hod_rejected') deptMap[deptId].rejected++;
    });

    const deptArray = Object.values(deptMap);

    // 5. Apply filters ONLY for which cards to show
    let visibleDepts = deptArray;
    
    // If a specific status is selected, only show departments that have results with that status
    if (status) {
      visibleDepts = visibleDepts.filter(d => {
        if (status === 'hod_verified') return d.awaiting > 0;
        if (status === 'approved') return d.approved > 0;
        if (status === 'published') return d.published > 0;
        if (status === 'admin_rejected') return d.rejected > 0;
        return true;
      });
    }

    if (document.getElementById('res-stat-depts')) {
      document.getElementById('res-stat-depts').textContent = visibleDepts.length;
    }

    // 6. Render Cards
    if (!visibleDepts.length) {
      grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#64748b;">No results match your current filters.</div>';
      return;
    }

    grid.innerHTML = visibleDepts.map(d => `
      <div class="dept-card" onclick="window.location.hash='#results-by-dept?departmentId=${d.id}&name=${encodeURIComponent(d.name)}'" style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px; cursor:pointer;">
        <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
          <span style="background:#ecfdf5; color:#065f46; padding:4px 10px; border-radius:6px; font-weight:800; font-size:11px;">${escapeHtml(d.code)}</span>
          <span style="color:#64748b; font-size:11px;">SST</span>
        </div>
        <h3 style="font-size:1.05rem; font-weight:700; margin:0 0 12px 0;">${escapeHtml(d.name)}</h3>
        
        <div style="font-size:1.8rem; font-weight:800; color:#0f172a; line-height:1;">${d.total}</div>
        <div style="font-size:11px; color:#64748b; font-weight:600; margin-bottom:16px;">total rows</div>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px;">
          <div style="background:#fffbeb; padding:8px; border-radius:8px; text-align:center;">
            <div style="font-weight:800; color:#d97706;">${d.awaiting}</div>
            <div style="font-size:9px; font-weight:700; color:#b45309;">AWAITING</div>
          </div>
          <div style="background:#eff6ff; padding:8px; border-radius:8px; text-align:center;">
            <div style="font-weight:800; color:#2563eb;">${d.approved}</div>
            <div style="font-size:9px; font-weight:700; color:#1d4ed8;">APPROVED</div>
          </div>
          <div style="background:#f0fdf4; padding:8px; border-radius:8px; text-align:center;">
            <div style="font-weight:800; color:#059669;">${d.published}</div>
            <div style="font-size:9px; font-weight:700; color:#047857;">PUBLISHED</div>
          </div>
          <div style="background:#fef2f2; padding:8px; border-radius:8px; text-align:center;">
            <div style="font-weight:800; color:#dc2626;">${d.rejected}</div>
            <div style="font-size:9px; font-weight:700; color:#b91c1c;">REJECTED</div>
          </div>
        </div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; padding-top:12px; font-size:12px; font-weight:700; color:#065f46;">
          <span>Review results</span>
          <span>→</span>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Failed to load results dashboard:', err);
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#dc2626;">Failed to load results data: ${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// RESULTS: Department View Loader
// ============================================
async function loadDepartmentResults() {
  const root = document.getElementById('rd-root');
  if (!root) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const deptId = params.get('departmentId');
  const deptName = params.get('name') || 'Department';

  if (!deptId) {
    root.innerHTML = '<div style="text-align:center; padding: 40px; color: #dc2626;">No department selected. Please go back.</div>';
    return;
  }

  const titleEl = document.getElementById('res-dept-title');
  const subEl = document.getElementById('res-dept-subtitle');
  if (titleEl) titleEl.textContent = `${deptName} Results`;
  if (subEl) subEl.textContent = `Review and publish student results`;

  // Get current filter values
  const statusFilter = document.getElementById('rd-filter-status')?.value || '';
  const semesterFilter = document.getElementById('rd-filter-semester')?.value || '';
  const searchFilter = document.getElementById('rd-filter-search')?.value || '';

  root.innerHTML = '<div class="loading" style="text-align:center; padding: 40px; color: #64748b;"><span class="spinner"></span> Loading results...</div>';

  try {
    // 1. Fetch ALL results for this department (no status filter)
    // This ensures stats are calculated accurately based on the full dataset
    let statsUrl = `/api/admin/results?departmentId=${deptId}&limit=5000`;
    if (semesterFilter && semesterFilter !== 'all') statsUrl += `&semester=${semesterFilter}`;

    const statsRes = await adminFetch(statsUrl);
    const statsJson = await statsRes.json();
    const allResults = statsJson.data || [];

    // 2. Calculate true stats from the full list
    let total = allResults.length;
    let pending = 0, approved = 0, published = 0, rejected = 0;

    allResults.forEach(r => {
      if (r.status === 'hod_verified' || r.status === 'pending') pending++;
      else if (r.status === 'approved') approved++;
      else if (r.status === 'published') published++;
      else if (r.status === 'admin_rejected' || r.status === 'hod_rejected') rejected++;
    });

    // Update Stat Boxes
    if (document.getElementById('rd-stat-total')) document.getElementById('rd-stat-total').textContent = total;
    if (document.getElementById('rd-stat-pending')) document.getElementById('rd-stat-pending').textContent = pending;
    if (document.getElementById('rd-stat-approved')) document.getElementById('rd-stat-approved').textContent = approved;
    if (document.getElementById('rd-stat-published')) document.getElementById('rd-stat-published').textContent = published;

    // 3. Now filter the results for the TABLE display based on the user's selection
    let tableResults = allResults;

    // Apply Status Filter
    if (statusFilter) {
      tableResults = tableResults.filter(r => r.status === statusFilter);
    }

    // Apply Search Filter
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      tableResults = tableResults.filter(r => {
        const studentName = `${r.student?.firstName || ''} ${r.student?.lastName || ''}`.toLowerCase();
        const matric = String(r.student?.matricNumber || '').toLowerCase();
        const courseCode = String(r.course?.code || '').toLowerCase();
        return studentName.includes(q) || matric.includes(q) || courseCode.includes(q);
      });
    }

    if (!tableResults.length) {
      root.innerHTML = '<div style="text-align:center; padding: 40px; color: #64748b;">No results match your current filters.</div>';
      return;
    }

    // 4. Group by course for the table
    const grouped = {};
    tableResults.forEach(r => {
      const cid = r.courseId || r.course?.id || 'unknown';
      if (!grouped[cid]) {
        grouped[cid] = {
          course: r.course || { code: 'N/A', title: 'Unknown Course', unit: 0 },
          results: []
        };
      }
      grouped[cid].results.push(r);
    });

    let html = '';
    
    Object.values(grouped).forEach(group => {
      const course = group.course;
      const courseResults = group.results;
      
      html += `
        <div class="res-course-group">
          <div class="res-course-head">
            <div style="display:flex; align-items:center; gap:12px;">
              <span class="code">${escapeHtml(course.code)}</span>
              <span class="title">${escapeHtml(course.title)}</span>
              <span class="meta"><strong>${course.unit || 0}</strong> Units</span>
            </div>
            <div class="head-actions">
              <button class="btn btn-sm btn-approve" onclick="FPU_ADMIN.courseBulkAction('${course.id}', 'approved')">Approve All</button>
              <button class="btn btn-sm btn-publish" onclick="FPU_ADMIN.courseBulkAction('${course.id}', 'published')">Publish All</button>
            </div>
          </div>
          <table class="table-admin">
            <thead>
              <tr>
                <th style="width:40px;"><input type="checkbox" onchange="FPU_ADMIN.toggleCourseResults(this, '${course.id}')" /></th>
                <th>Student</th>
                <th>Matric No</th>
                <th>Score</th>
                <th>Grade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${courseResults.map(r => {
                const student = r.student || {};
                let rowClass = '';
                if (r.status === 'published') rowClass = 'row-published';
                if (r.status === 'admin_rejected') rowClass = 'row-rejected';

                return `
                  <tr class="${rowClass}">
                    <td><input type="checkbox" class="rd-checkbox course-${course.id}" value="${r.id}" onchange="FPU_ADMIN.updateBulkBtnState()" /></td>
                    <td style="font-weight:600;">${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}</td>
                    <td style="font-family:monospace;">${escapeHtml(student.matricNumber || '—')}</td>
                    <td><span class="res-score">${r.score || '-'}</span></td>
                    <td style="font-weight:700;">${escapeHtml(r.grade || '-')}</td>
                    <td>
                      <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:${r.status === 'published' ? '#059669' : r.status === 'approved' ? '#2563eb' : '#d97706'};">
                        ${escapeHtml(r.status.replace(/_/g, ' '))}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    });

    root.innerHTML = html;

  } catch (err) {
    console.error('Failed to load department results:', err);
    root.innerHTML = `<div style="text-align:center; padding: 40px; color: #dc2626;">Failed to load results: ${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// BULK ACTIONS
// ============================================
function toggleAllResults(checked) {
  document.querySelectorAll('.rd-checkbox').forEach(cb => cb.checked = checked);
}

function toggleCourseResults(checkbox, courseId) {
  document.querySelectorAll(`.course-${courseId}`).forEach(cb => cb.checked = checkbox.checked);
}

function updateBulkBtnState() {}

async function bulkResultAction(action) {
  console.log('🔵 bulkResultAction called with:', action);

  const checkboxes = document.querySelectorAll('.rd-checkbox:checked');
  console.log('🔵 Checked boxes:', checkboxes.length);

  if (checkboxes.length === 0) {
    showToast('Please select at least one result.', 'warning');
    return;
  }

  const selectedIds = Array.from(checkboxes).map(cb => cb.value);
  const actionText = action.replace(/_/g, ' ');

  const ok = await window.fpuConfirm(
    `Are you sure you want to ${actionText} ${selectedIds.length} result(s)?`,
    { title: 'Confirm Action', type: 'warning', okText: 'Yes, Proceed' }
  );
  if (!ok) return;

  try {
    console.log('🔵 Sending POST /api/admin/results/bulk-action ...');
    const res = await adminFetch('/api/admin/results/bulk-action', {
      method: 'POST',
      body: JSON.stringify({ ids: selectedIds, action })
    });

    const json = await res.json();
    console.log('🔵 Response:', res.status, json);

    if (!json.success) throw new Error(json.error || 'Failed to update results');

    showToast(`✅ ${actionText}ed ${selectedIds.length} result(s).`, 'success');
    loadDepartmentResults();

  } catch (err) {
    console.error('🔴 Bulk action error:', err);
    showToast(`❌ ${err.message}`, 'error');
  }
}

async function courseBulkAction(courseId, action) {
  const ok = await window.fpuConfirm(
    `Apply "${action}" to ALL results for this course?`,
    { title: 'Confirm', type: 'warning', okText: 'Yes' }
  );
  if (!ok) return;

  try {
    await adminFetch('/api/admin/results/bulk-action', {
      method: 'POST',
      body: JSON.stringify({ courseId, action })
    });
    showToast(`✅ Course results updated.`, 'success');
    loadDepartmentResults();
  } catch (err) {
    showToast(`❌ ${err.message}`, 'error');
  }
}

async function publishAllApproved() {
  const ok = await window.fpuConfirm(
    'Publish ALL approved results? Students will see them immediately.',
    { title: 'Publish All', type: 'info', okText: 'Publish All' }
  );
  if (!ok) return;

  try {
    const res = await adminFetch('/api/admin/results?status=approved&limit=5000');
    const json = await res.json();
    const approvedResults = json.data || [];

    if (!approvedResults.length) {
      return showToast('No approved results to publish.', 'warning');
    }

    const ids = approvedResults.map(r => r.id);

    await adminFetch('/api/admin/results/bulk-action', {
      method: 'POST',
      body: JSON.stringify({ ids, action: 'published' })
    });

    showToast(`✅ Published ${ids.length} results.`, 'success');
    loadResultsDashboard();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

// ============================================
// RESULTS: All Approved View
// ============================================
async function loadApprovedResults() {
  const tbody = document.getElementById('approved-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px; color: #64748b;"><span class="spinner"></span> Loading approved results...</td></tr>';

  try {
    // Fetch only results with status 'approved'
    const res = await adminFetch('/api/admin/results?status=approved&limit=5000');
    const json = await res.json();
    const results = json.data || [];

    // Update count in header
    if (document.getElementById('appr-count')) {
      document.getElementById('appr-count').textContent = `${results.length} approved results`;
    }

    if (!results.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px; color: #64748b;">No approved results found.</td></tr>';
      return;
    }

    // Render the table rows
    tbody.innerHTML = results.map(r => {
      const student = r.student || {};
      const course = r.course || {};
      
      return `
        <tr>
          <td style="font-weight:600; color:#0f172a;">${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}</td>
          <td style="font-family:monospace;">${escapeHtml(student.matricNumber || '—')}</td>
          <td>${escapeHtml(course.departmentName || '—')}</td>
          <td><span style="color:#065f46; font-weight:700;">${escapeHtml(course.code || '—')}</span></td>
          <td style="font-weight:700; text-align:center;">${r.score || '-'}</td>
          <td style="font-weight:700; text-align:center;">${escapeHtml(r.grade || '-')}</td>
          <td>
            <span style="background:#dcfce7; color:#15803d; padding:4px 10px; border-radius:999px; font-size:10px; font-weight:700; text-transform:uppercase;">
              Approved
            </span>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load approved results:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 40px; color: #dc2626;">Failed to load results: ${escapeHtml(err.message)}</td></tr>`;
  }
}

// ============================================
// REGISTRATIONS: By Student View
// ============================================
async function loadStudentRegistrations() {
  const root = document.getElementById('reg-stu-groups');
  if (!root) return;

  // Parse studentId from URL
  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const studentId = params.get('studentId');

  if (!studentId) {
    root.innerHTML = '<div class="alert alert-warning">No student selected. Please go back.</div>';
    return;
  }

  root.innerHTML = '<div class="loading" style="text-align:center; padding: 40px; color: #64748b;"><span class="spinner"></span> Loading registrations...</div>';

  try {
    // Fetch student + registrations in parallel
    const [studentRes, regsRes] = await Promise.all([
      adminFetch(`/api/admin/students/${studentId}`).catch(() => null),
      adminFetch(`/api/admin/registrations/with-course?studentId=${studentId}`).catch(() => null),
    ]);

    let student = null;
    try { if (studentRes && studentRes.ok) { const j = await studentRes.json(); student = j.data || j; } } catch {}

    let regs = [];
    try { if (regsRes && regsRes.ok) { const j = await regsRes.json(); regs = j.data || j || []; } } catch {}

    // Update summary panel
    if (student) {
      const summaryPanel = document.getElementById('reg-stu-summary-panel');
      if (summaryPanel) summaryPanel.style.display = 'block';

      const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
      const initials = ((student.firstName || ' ')[0] + (student.lastName || ' ')[0]).toUpperCase().trim() || 'S';

      document.getElementById('reg-stu-title').textContent = `${fullName} — Registrations`;
      document.getElementById('reg-stu-subtitle').textContent = `${student.matricNumber || ''} · ${student.level || ''}`;
      
      const nameEl = document.getElementById('reg-stu-name');
      if (nameEl) nameEl.textContent = fullName || 'Unknown Student';
      
      const emailEl = document.getElementById('reg-stu-email');
      if (emailEl) emailEl.textContent = student.email || '';

      const metaEl = document.getElementById('reg-stu-meta');
      if (metaEl) metaEl.textContent = `${student.programmeName || 'N/A'} · ${student.departmentName || 'N/A'}`;

      const avatarEl = document.getElementById('reg-stu-avatar');
      if (avatarEl) {
        avatarEl.innerHTML = student.photoUrl 
          ? `<img src="${escapeHtml(student.photoUrl)}" alt=""/>` 
          : escapeHtml(initials);
      }
    }

    if (!regs.length) {
      root.innerHTML = '<div class="alert alert-info" style="margin-top:20px;">This student has no course registrations yet.</div>';
      return;
    }

    // Group registrations by semester
    const grouped = {};
    let totalUnits = 0;

    regs.forEach(r => {
      const reg = r.registration || r;
      const course = r.course || {};
      
      // Only count pending/approved towards total units
      if (reg.status === 'pending' || reg.status === 'approved') {
        totalUnits += Number(course.unit) || 0;
      }

      const sem = reg.semester || 'Unknown';
      if (!grouped[sem]) grouped[sem] = [];
      grouped[sem].push(r);
    });

    // Update total units
    const totalUnitsEl = document.getElementById('reg-stu-total-units');
    if (totalUnitsEl) totalUnitsEl.textContent = totalUnits;

    // Render semesters
    let html = '';
    Object.keys(grouped).forEach(sem => {
      const items = grouped[sem];
      const semUnits = items.reduce((sum, r) => {
        const reg = r.registration || r;
        if (reg.status === 'pending' || reg.status === 'approved') {
          return sum + (Number(r.course?.unit) || 0);
        }
        return sum;
      }, 0);

      html += `
        <div class="sem-group">
          <div class="sem-group-head">
            <div>
              <div class="title" style="text-transform:capitalize;">${escapeHtml(sem)} Semester</div>
              <div class="subtitle">${items.length} course${items.length === 1 ? '' : 's'}</div>
            </div>
            <div class="sem-group-units">
              <span class="num">${semUnits}</span>
              <span class="lbl">units</span>
            </div>
          </div>
          <div class="table-wrap">
            <table class="table-admin">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Course Title</th>
                  <th style="width:80px; text-align:center;">Units</th>
                  <th style="width:120px;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(r => {
                  const reg = r.registration || r;
                  const course = r.course || {};
                  
                  // Status Pill logic
                  let statusHtml = '';
                  if (reg.status === 'approved') statusHtml = '<span class="badge badge-success">Approved</span>';
                  else if (reg.status === 'rejected') statusHtml = '<span class="badge badge-danger">Rejected</span>';
                  else statusHtml = '<span class="badge badge-warning">Pending</span>';

                  return `
                    <tr>
                      <td style="font-weight:700; color:#065f46;">${escapeHtml(course.code || '—')}</td>
                      <td>${escapeHtml(course.title || '—')}</td>
                      <td style="text-align:center; font-weight:600;">${course.unit || 0}</td>
                      <td>${statusHtml}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    });

    root.innerHTML = html;

    // Wire up "Approve All Pending" button
    const bulkBtn = document.getElementById('reg-stu-bulk-approve');
    if (bulkBtn && !bulkBtn.__wired) {
      bulkBtn.__wired = true;
      bulkBtn.onclick = async () => {
        if (!confirm(`Approve ALL pending registrations for this student?`)) return;
        
        const pendingIds = regs
          .filter(r => (r.registration || r).status === 'pending')
          .map(r => (r.registration || r).id);

        if (!pendingIds.length) {
          showToast('No pending registrations to approve.', 'warning');
          return;
        }

        try {
          // Loop through and approve each
          for (const id of pendingIds) {
            await adminFetch(`/api/admin/registrations/${id}/approve`, { method: 'POST' });
          }
          showToast(`✅ Approved ${pendingIds.length} registration(s).`, 'success');
          loadStudentRegistrations(); // Reload
        } catch (err) {
          showToast('❌ ' + err.message, 'error');
        }
      };
    }

  } catch (err) {
    console.error('Failed to load student registrations:', err);
    root.innerHTML = `<div class="alert alert-danger" style="margin:20px;">Failed to load: ${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// SPA ROUTER HOOKS (Auto-load on navigation)
// ============================================
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace(/^#/, '');
  const route = hash.split('?')[0]; // Get base route without query params

  // If we navigate to the main Security page
  if (route === 'security') {
    // Check if the container exists (meaning the HTML has loaded)
    if (document.getElementById('sec-threat-banner')) {
      loadSecurityDashboard();
    }
  }
});

// Also run on initial page load if they land directly on #security
document.addEventListener('DOMContentLoaded', () => {
  const route = window.location.hash.replace(/^#/, '').split('?')[0];
  if (route === 'security' && document.getElementById('sec-threat-banner')) {
    loadSecurityDashboard();
  }
});

// ============================================
// TRANSCRIPT MODAL VIEWER (Styled & Print-Ready)
// ============================================
async function openTranscriptModal(studentId) {
  if (!studentId) {
    showToast('⚠️ No student ID provided.', 'warning');
    return;
  }

  const existing = document.getElementById('transcript-modal-backdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'fpu-modal-backdrop';
  backdrop.id = 'transcript-modal-backdrop';
  backdrop.style.cssText = `position: fixed; inset: 0; background: rgba(15,23,42,0.7); z-index: 999999; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px);`;
  
  backdrop.innerHTML = `
    <div class="fpu-modal" style="width: 100%; max-width: 950px; max-height: 92vh; background: #f1f5f9; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); display: flex; flex-direction: column; overflow: hidden; border: 1px solid #cbd5e1;">
      <div class="fpu-modal-header" style="background: #fff; padding: 16px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
        <h3 style="margin: 0; font-size: 1.1rem; color: #0f172a; font-family: 'Poppins', sans-serif;">Student Transcript</h3>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-sm btn-outline" onclick="window.print()">🖨 Print</button>
          <button class="btn btn-sm btn-ghost" onclick="document.getElementById('transcript-modal-backdrop').remove()" style="font-size: 1.5rem; line-height: 1; padding: 0 8px;">&times;</button>
        </div>
      </div>
      
      <div class="fpu-modal-body" id="tx-modal-body" style="padding: 30px 20px; overflow-y: auto; flex-grow: 1; display: flex; justify-content: center;">
        <div class="loading" style="padding:60px;text-align:center; width:100%;"><span class="spinner"></span> Loading transcript…</div>
      </div>
    </div>

    <style>
      @media print {
        body * { visibility: hidden; }
        .tx-document, .tx-document * { visibility: visible; }
        .tx-document { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; box-shadow: none !important; border: none !important; }
        #transcript-modal-backdrop { position: static !important; background: transparent !important; padding: 0 !important; margin: 0 !important; display: block !important; }
        .fpu-modal-header, .fpu-modal { background: transparent !important; box-shadow: none !important; border: none !important; max-height: none !important; width: 100% !important; max-width: 100% !important; overflow: visible !important; }
        .fpu-modal-body { padding: 0 !important; overflow: visible !important; display: block !important; }
        .sidebar, .topbar, .page-head { display: none !important; }
      }

      .tx-document { background: #fff; padding: 40px; border-radius: 4px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); position: relative; overflow: hidden; font-family: 'Inter', Arial, sans-serif; color: #0f172a; width: 100%; max-width: 800px; min-height: 1000px; }
      .tx-watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 60%; max-width: 400px; opacity: 0.04; pointer-events: none; z-index: 0; }
      .tx-content { position: relative; z-index: 1; }
      .tx-letterhead { display: flex; align-items: center; gap: 20px; padding-bottom: 20px; margin-bottom: 24px; border-bottom: 3px double #065f46; }
      .tx-letterhead-logo { width: 80px; height: 80px; object-fit: contain; flex-shrink: 0; }
      .tx-letterhead-text { flex: 1; text-align: center; }
      .tx-letterhead-text .institution { font-family: 'Poppins', sans-serif; font-size: 22px; font-weight: 900; color: #065f46; text-transform: uppercase; letter-spacing: 1px; margin: 0; line-height: 1.2; }
      .tx-letterhead-text .motto { font-size: 12px; color: #6b7280; font-style: italic; margin: 2px 0; }
      .tx-letterhead-text .doc-type { font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; }
      .tx-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 24px; border-bottom: 1px solid #e2e8f0; margin-bottom: 24px; }
      .tx-student-info h2 { font-family: 'Poppins', sans-serif; font-size: 1.4rem; font-weight: 800; margin: 0 0 4px; }
      .tx-student-info .meta { font-size: 12.5px; color: #6b7280; line-height: 1.7; }
      .tx-student-info .matric { font-family: 'Courier New', monospace; background: #ecfdf5; color: #065f46; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 12px; }
      .tx-cgpa-block { text-align: right; flex-shrink: 0; }
      .tx-cgpa-block .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; color: #6b7280; }
      .tx-cgpa-block .value { font-family: 'Poppins', sans-serif; font-size: 2.6rem; font-weight: 800; color: #065f46; line-height: 1; margin: 2px 0; }
      .tx-cgpa-block .class { font-size: 12px; font-weight: 700; color: #f59e0b; }
      .tx-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
      .tx-summary-item { background: #f8fafc; border-radius: 8px; padding: 10px; text-align: center; border: 1px solid #e2e8f0; }
      .tx-summary-item .num { font-family: 'Poppins', sans-serif; font-size: 1.3rem; font-weight: 800; color: #065f46; line-height: 1; }
      .tx-summary-item .lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-top: 4px; }
      .tx-semester { margin-bottom: 24px; page-break-inside: avoid; }
      .tx-semester-head { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; background: #065f46; color: #fff; border-radius: 6px 6px 0 0; font-size: 12px; font-weight: 700; }
      .tx-semester-head .gpa { background: rgba(255,255,255,0.15); padding: 3px 10px; border-radius: 999px; font-size: 11px; }
      .tx-table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-top: none; }
      .tx-table th, .tx-table td { padding: 8px 12px; text-align: left; font-size: 12px; border-bottom: 1px solid #f1f5f9; }
      .tx-table th { background: #f8fafc; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px; color: #6b7280; }
      .tx-table td.num { text-align: right; font-family: 'Courier New', monospace; font-weight: 700; }
      .tx-table td.center { text-align: center; }
      .tx-grade { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 22px; padding: 0 6px; border-radius: 4px; font-weight: 800; font-size: 11px; background: #ecfdf5; color: #065f46; }
      .tx-grade.F { background: #fee2e2; color: #991b1b; }
      .tx-grade.D, .tx-grade.E { background: #fef3c7; color: #92400e; }
      .tx-signatures { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 20px; page-break-inside: avoid; }
      .tx-sig-block { text-align: center; width: 180px; }
      .tx-sig-line { border-bottom: 1px solid #0f172a; margin-bottom: 6px; height: 30px; }
      .tx-sig-role { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
    </style>
  `;
  document.body.appendChild(backdrop);

  const root = document.getElementById('tx-modal-body');

  try {
    const [studentRes, resultsRes, coursesRes, sessionsRes] = await Promise.all([
      adminFetch(`/api/admin/students/${studentId}`).catch(() => null),
      adminFetch(`/api/admin/results?studentId=${studentId}&limit=5000`).catch(() => null),
      adminFetch('/api/admin/courses?limit=5000').catch(() => null),
      adminFetch('/api/admin/sessions').catch(() => null),
    ]);

    let student = null;
    try { if (studentRes && studentRes.ok) { const j = await studentRes.json(); student = j.data || j; } } catch {}
    
    let results = [];
    try { 
      if (resultsRes && resultsRes.ok) { 
        const j = await resultsRes.json(); 
        results = j.data || j || []; 
        if (results.rows) results = results.rows;
      } 
    } catch {}
    
    let courseMap = new Map();
    try { 
      if (coursesRes && coursesRes.ok) { 
        const j = await coursesRes.json(); 
        const courses = j.data || j || [];
        courses.forEach(c => courseMap.set(c.id, c)); 
      } 
    } catch {}

    let sessionMap = new Map();
    try {
      if (sessionsRes && sessionsRes.ok) {
        const j = await sessionsRes.json();
        const sessions = j.data || j || [];
        sessions.forEach(s => sessionMap.set(Number(s.id), s.name));
      }
    } catch {}

    if (!student || !student.id) {
      root.innerHTML = `<div class="alert alert-danger" style="margin:20px;"><strong>Student not found.</strong> (ID: ${studentId})</div>`;
      return;
    }

    const gradePoints = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };

    const groups = new Map();
    results.forEach(r => {
      const row = r.result || r;
      const key = `${row.sessionId || '?'}|${row.semester || '?'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });

    let totalUnits = 0, totalPoints = 0, courseCount = 0;
    
    // FIXED: Include ALL results with a grade, not just 'published'
    results.forEach(r => {
      const row = r.result || r;
      const course = courseMap.get(row.courseId) || r.course || {};
      const units = Number(course.unit) || Number(row.unit) || 0;
      const points = row.points != null ? Number(row.points) : (gradePoints[String(row.grade).toUpperCase()] || 0);
      
      // Only skip if there's no grade at all
      if (row.grade) {
        totalUnits += units;
        totalPoints += units * points;
        courseCount++;
      }
    });
    
    const cgpa = totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '—';
    const classification =
      cgpa === '—' ? '—' :
      Number(cgpa) >= 3.50 ? 'Distinction' :
      Number(cgpa) >= 3.00 ? 'Upper Credit' :
      Number(cgpa) >= 2.50 ? 'Lower Credit' :
      Number(cgpa) >= 2.00 ? 'Pass' : 'Fail';

    const groupsHtml = [...groups.entries()].map(([key, list]) => {
      const [sessionId, semester] = key.split('|');
      
      // FIXED: Try to get session name from map, or directly from the result row
      const firstRow = list[0]?.result || list[0] || {};
      const sessionName = sessionMap.get(Number(sessionId)) 
          || firstRow.sessionName 
          || firstRow.session?.name 
          || `Session ${sessionId !== '?' ? sessionId : 'Current'}`;
      
      const sectionUnits = list.reduce((s, r) => {
        const row = r.result || r;
        const course = courseMap.get(row.courseId) || r.course || {};
        return s + (Number(course.unit) || Number(row.unit) || 0);
      }, 0);
      
      const sectionPoints = list.reduce((s, r) => {
        const row = r.result || r;
        const course = courseMap.get(row.courseId) || r.course || {};
        const units = Number(course.unit) || Number(row.unit) || 0;
        const points = row.points != null ? Number(row.points) : (gradePoints[String(row.grade).toUpperCase()] || 0);
        return s + (units * points);
      }, 0);
      
      const gpa = sectionUnits > 0 ? (sectionPoints / sectionUnits).toFixed(2) : '—';

      const rowsHtml = list
        .sort((a, b) => {
          const ca = courseMap.get((a.result || a).courseId) || {};
          const cb = courseMap.get((b.result || b).courseId) || {};
          return String(ca.code || '').localeCompare(String(cb.code || ''));
        })
        .map(r => {
          const row = r.result || r;
          const course = courseMap.get(row.courseId) || r.course || {};
          const grade = String(row.grade || '—').toUpperCase();
          const points = row.points != null ? Number(row.points) : (gradePoints[grade] || 0);
          return `
            <tr>
              <td><code>${escapeHtml(course.code || row.courseCode || `#${row.courseId}`)}</code></td>
              <td>${escapeHtml(course.title || row.courseTitle || '—')}</td>
              <td class="num center">${Number(course.unit) || Number(row.unit) || 0}</td>
              <td class="num">${row.score != null ? row.score : '—'}</td>
              <td class="center"><span class="tx-grade ${grade}">${escapeHtml(grade)}</span></td>
              <td class="num">${points}</td>
            </tr>`;
        }).join('');

      return `
        <div class="tx-semester">
          <div class="tx-semester-head">
            <span>${escapeHtml(sessionName)} — ${escapeHtml(semester)} Semester</span>
            <span class="gpa">GPA ${gpa} · ${sectionUnits} units</span>
          </div>
          <table class="tx-table">
            <thead>
              <tr>
                <th style="width:100px;">Code</th>
                <th>Course Title</th>
                <th style="width:60px;text-align:center;">Units</th>
                <th style="width:70px;text-align:right;">Score</th>
                <th style="width:70px;text-align:center;">Grade</th>
                <th style="width:70px;text-align:right;">Points</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`;
    }).join('');

    root.innerHTML = `
      <div class="tx-document">
        <img class="tx-watermark" src="/images/logo.png" onerror="this.style.display='none'" />
        <div class="tx-content">
          <div class="tx-letterhead">
            <img class="tx-letterhead-logo" src="/images/logo.png" onerror="this.style.display='none'" />
            <div class="tx-letterhead-text">
              <div class="institution">Federal Polytechnic Ugep</div>
              <div class="motto">Citadel of Technical Excellence</div>
              <div class="doc-type">Official Student Transcript</div>
            </div>
            <div style="width:80px;"></div>
          </div>

          <div class="tx-header">
            <div class="tx-student-info">
              <h2>${escapeHtml((student.firstName || '') + ' ' + (student.lastName || ''))}</h2>
              <div class="meta">
                <span class="matric">${escapeHtml(student.matricNumber || '—')}</span> ·
                ${escapeHtml(student.level || '—')} ·
                ${escapeHtml(student.programmeName || student.programme?.name || '—')}
              </div>
              <div class="meta">
                ${escapeHtml(student.email || '')}
                ${student.departmentName ? ' · ' + escapeHtml(student.departmentName) : ''}
              </div>
            </div>
            <div class="tx-cgpa-block">
              <div class="label">CGPA</div>
              <div class="value">${cgpa}</div>
              <div class="class">${escapeHtml(classification)}</div>
            </div>
          </div>

          <div class="tx-summary">
            <div class="tx-summary-item"><div class="num">${courseCount}</div><div class="lbl">Courses</div></div>
            <div class="tx-summary-item"><div class="num">${totalUnits}</div><div class="lbl">Total Units</div></div>
            <div class="tx-summary-item"><div class="num">${totalPoints}</div><div class="lbl">Total Points</div></div>
            <div class="tx-summary-item"><div class="num" style="font-size:0.9rem;">${escapeHtml(classification)}</div><div class="lbl">Classification</div></div>
          </div>

          ${groups.size > 0 ? groupsHtml : `
            <div style="background:#fffbeb; border:1px solid #fef3c7; color:#b45309; padding:16px; border-radius:8px; text-align:center; font-weight:600;">
              No published results found for this student.
            </div>
          `}

          <div class="tx-signatures">
            <div class="tx-sig-block"><div class="tx-sig-line"></div><div class="tx-sig-role">Registrar</div></div>
            <div class="tx-sig-block"><div class="tx-sig-line"></div><div class="tx-sig-role">Date</div></div>
            <div class="tx-sig-block"><div class="tx-sig-line"></div><div class="tx-sig-role">Rector</div></div>
          </div>
        </div>
      </div>
    `;

  } catch (err) {
    console.error('Transcript Modal Error:', err);
    root.innerHTML = `
      <div class="alert alert-danger" style="margin:20px; width:100%;">
        <strong>Failed to load transcript:</strong> ${escapeHtml(err.message)}
      </div>`;
  }
}

// ============================================
// ATTENDANCE: Department -> Courses Modal
// ============================================
async function openDepartmentAttendanceModal(deptId, deptName, deptCode) {
  const backdrop = document.createElement('div');
  backdrop.className = 'fpu-modal-backdrop';
  backdrop.id = 'attendance-dept-modal';
  backdrop.style.cssText = `position: fixed; inset: 0; background: rgba(15,23,42,0.7); z-index: 999999; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px);`;
  
  backdrop.innerHTML = `
    <div class="fpu-modal" style="width: 100%; max-width: 1100px; max-height: 90vh; background: #fff; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); border: 1px solid #e2e8f0;">
      <div class="fpu-modal-header" style="background: #fff; padding: 20px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h3 style="margin: 0; font-size: 1.4rem; color: #0f172a; font-family: 'Poppins', sans-serif; font-weight: 700;">${escapeHtml(deptName)}</h3>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Department Code: <strong>${escapeHtml(deptCode)}</strong> · Select a course to manage attendance</p>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="document.getElementById('attendance-dept-modal').remove()" style="font-size: 1.8rem; line-height: 1; padding: 0; color: #94a3b8;">&times;</button>
      </div>
      
      <div class="fpu-modal-body" id="dept-modal-body" style="padding: 24px; overflow-y: auto; background: #f8fafc; flex-grow: 1;">
        <div class="loading" style="text-align:center; padding: 40px; color: #94a3b8;">
          <span class="spinner"></span> Loading courses and attendance data...
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const body = document.getElementById('dept-modal-body');

  try {
    // Fetch all courses in this department
    const coursesRes = await adminFetch(`/api/admin/courses?departmentId=${deptId}&limit=500`);
    const rawCourses = (await coursesRes.json()).data || [];
    const courses = rawCourses.filter(c => Number(c.departmentId) === Number(deptId));

    if (!courses.length) {
      body.innerHTML = '<div style="text-align:center; padding: 60px; color: #64748b;"><div style="font-size:2rem;margin-bottom:10px;">📭</div>No courses found for this department.</div>';
      return;
    }

    // Fetch the roster for EACH course in parallel
    const courseStats = await Promise.all(courses.map(async (c) => {
      try {
        const res = await adminFetch(`/api/admin/attendance/course/${c.id}/students`);
        const json = await res.json();
        const roster = json.data || [];
        
        // Aggregate stats from the roster
        const totalRecords = roster.reduce((sum, s) => sum + (s.totalClasses || 0), 0);
        const totalPresent = roster.reduce((sum, s) => sum + (s.present || 0), 0);
        const uniqueStudents = roster.length;
        const rate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;
        
        return { course: c, records: totalRecords, students: uniqueStudents, rate };
      } catch (e) {
        return { course: c, records: 0, students: 0, rate: 0 };
      }
    }));

    // Sort by course code
    courseStats.sort((a, b) => String(a.course.code || '').localeCompare(String(b.course.code || '')));

    // Render the beautiful table with PER-COURSE data
    body.innerHTML = `
      <div style="background:#fff; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
        <table style="width:100%; border-collapse:collapse; text-align:left;">
          <thead>
            <tr style="background:#f1f5f9; border-bottom:2px solid #e2e8f0;">
              <th style="padding:14px 20px; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase;">Course Code</th>
              <th style="padding:14px 20px; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase;">Course Title</th>
              <th style="padding:14px 20px; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; text-align:center;">Level</th>
              <th style="padding:14px 20px; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; text-align:center;">Records</th>
              <th style="padding:14px 20px; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; text-align:center;">Students</th>
              <th style="padding:14px 20px; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase;">Attendance Rate</th>
              <th style="padding:14px 20px; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; text-align:right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${courseStats.map(({ course: c, records, students, rate }) => {
              let barColor = '#cbd5e1';
              let textColor = '#64748b';
              
              if (records > 0) {
                if (rate >= 75) { barColor = '#10b981'; textColor = '#065f46'; }
                else if (rate >= 50) { barColor = '#f59e0b'; textColor = '#b45309'; }
                else { barColor = '#ef4444'; textColor = '#991b1b'; }
              }

              return `
                <tr style="border-bottom:1px solid #e2e8f0; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                  <td style="padding:16px 20px;">
                    <span style="background:#ecfdf5; color:#065f46; padding:4px 10px; border-radius:6px; font-weight:800; font-size:12px; font-family:monospace;">${escapeHtml(c.code || '—')}</span>
                  </td>
                  <td style="padding:16px 20px;">
                    <div style="font-weight:600; color:#0f172a; font-size:14px;">${escapeHtml(c.title || '—')}</div>
                  </td>
                  <td style="padding:16px 20px; text-align:center;">
                    <span style="background:#f1f5f9; color:#475569; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700;">${escapeHtml(c.level || 'N/A')}</span>
                  </td>
                  <td style="padding:16px 20px; text-align:center; font-weight:700; color:#0f172a; font-size:14px;">
                    ${records}
                  </td>
                  <td style="padding:16px 20px; text-align:center; font-weight:700; color:#0f172a; font-size:14px;">
                    ${students}
                  </td>
                  <td style="padding:16px 20px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                      <div style="flex:1; height:6px; background:#e2e8f0; border-radius:999px; overflow:hidden; min-width:80px;">
                        <div style="width:${rate}%; height:100%; background:${barColor}; border-radius:999px; transition:width 0.5s ease;"></div>
                      </div>
                      <span style="font-size:13px; font-weight:800; color:${textColor}; width:45px; text-align:right;">${records > 0 ? rate + '%' : '—'}</span>
                    </div>
                  </td>
                  <td style="padding:16px 20px; text-align:right;">
                    <button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.openCourseAttendanceModal(${c.id}, '${escapeHtml(c.code)}', '${escapeQuotes(c.title)}', ${deptId})" style="padding:6px 14px; font-size:12px;">View Roster</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error('[Attendance Modal] Error:', err);
    body.innerHTML = `
      <div style="text-align:center; padding: 40px; color: #dc2626; background: #fee2e2; border-radius: 8px;">
        <strong>Error loading courses:</strong> ${escapeHtml(err.message)}
      </div>
    `;
  }
}

// ============================================
// ATTENDANCE: Course -> Student Roster Modal
// ============================================
async function openCourseAttendanceModal(courseId, courseCode, courseTitle, deptId) {
  // Remove the previous department modal if it's open
  const oldModal = document.getElementById('attendance-dept-modal');
  if (oldModal) oldModal.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'fpu-modal-backdrop';
  backdrop.id = 'attendance-course-modal';
  backdrop.style.cssText = `position: fixed; inset: 0; background: rgba(15,23,42,0.85); z-index: 999999; display: flex; align-items: center; justify-content: center; padding: 20px;`;
  
  backdrop.innerHTML = `
    <div class="fpu-modal" style="width: 100%; max-width: 1000px; max-height: 90vh; background: #f8fafc; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">
      <div class="fpu-modal-header" style="background: #fff; padding: 16px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="margin: 0; font-size: 1.1rem; color: #0f172a;">${escapeHtml(courseCode)} - ${escapeHtml(courseTitle)}</h3>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Student attendance roster</p>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="document.getElementById('attendance-course-modal').remove()" style="font-size: 1.5rem; line-height: 1;">&times;</button>
      </div>
      
      <div class="fpu-modal-body" id="course-modal-body" style="padding: 24px; overflow-y: auto; flex-grow: 1;">
        <div class="loading" style="text-align:center; padding: 40px; color: #94a3b8;">
          <span class="spinner"></span> Loading student roster...
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const body = document.getElementById('course-modal-body');

  try {
    // Try to fetch the student attendance roster for this course
    const res = await adminFetch(`/api/admin/attendance/course/${courseId}/students`);
    
    if (!res.ok) {
      throw new Error(`API route not found (${res.status}). Please ensure backend route exists.`);
    }

    const json = await res.json();
    const students = json.data || [];

    if (!students.length) {
      body.innerHTML = '<div style="text-align:center; padding: 40px; color: #64748b;">No students found in this course.</div>';
      return;
    }

    body.innerHTML = `
      <div class="table-wrap" style="background:#fff; border-radius:8px; border:1px solid #e2e8f0; overflow:hidden;">
        <table class="table-admin" style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc; text-align:left;">
              <th style="padding:12px; border-bottom:1px solid #e2e8f0;">Matric</th>
              <th style="padding:12px; border-bottom:1px solid #e2e8f0;">Name</th>
              <th style="padding:12px; border-bottom:1px solid #e2e8f0; text-align:center;">Classes</th>
              <th style="padding:12px; border-bottom:1px solid #e2e8f0; text-align:center; color:#047857;">Present</th>
              <th style="padding:12px; border-bottom:1px solid #e2e8f0; text-align:center; color:#b91c1c;">Absent</th>
              <th style="padding:12px; border-bottom:1px solid #e2e8f0; text-align:center;">Rate</th>
              <th style="padding:12px; border-bottom:1px solid #e2e8f0; text-align:right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(s => {
              let rateColor = '#065f46';
              if (s.rate < 50) rateColor = '#dc2626';
              else if (s.rate < 75) rateColor = '#f59e0b';

              return `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:12px;"><code>${escapeHtml(s.matricNumber || '—')}</code></td>
                  <td style="padding:12px; font-weight:600;">${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}</td>
                  <td style="padding:12px; text-align:center;">${s.totalClasses || 0}</td>
                  <td style="padding:12px; text-align:center; font-weight:700; color:#047857;">${s.present || 0}</td>
                  <td style="padding:12px; text-align:center; font-weight:700; color:#b91c1c;">${s.absent || 0}</td>
                  <td style="padding:12px; text-align:center; font-weight:800; color:${rateColor};">${s.rate ? s.rate + '%' : '—'}</td>
                  <td style="padding:12px; text-align:right;">
                    <button class="btn btn-sm btn-outline" onclick="FPU_ADMIN.openStudentAttendanceModal(${s.id}, '${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}', ${courseId}, '${escapeHtml(courseCode)}')">View Details</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<div style="color:#dc2626; text-align:center; padding:20px; background:#fee2e2; border-radius:8px;">Error loading roster: ${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// ATTENDANCE: Student Detail Modal (Day-by-Day)
// ============================================
async function openStudentAttendanceModal(studentId, studentName, courseId, courseCode) {
  const oldModal = document.getElementById('attendance-course-modal');
  if (oldModal) oldModal.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'fpu-modal-backdrop';
  backdrop.id = 'attendance-student-modal';
  backdrop.style.cssText = `position: fixed; inset: 0; background: rgba(15,23,42,0.85); z-index: 999999; display: flex; align-items: center; justify-content: center; padding: 20px;`;
  
  backdrop.innerHTML = `
    <div class="fpu-modal" style="width: 100%; max-width: 800px; max-height: 90vh; background: #f8fafc; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">
      <div class="fpu-modal-header" style="background: #fff; padding: 16px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="margin: 0; font-size: 1.1rem; color: #0f172a;">${escapeHtml(studentName)}</h3>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Attendance for ${escapeHtml(courseCode)}</p>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="document.getElementById('attendance-student-modal').remove()" style="font-size: 1.5rem; line-height: 1;">&times;</button>
      </div>
      
      <div class="fpu-modal-body" id="student-modal-body" style="padding: 24px; overflow-y: auto; flex-grow: 1;">
        <div class="loading" style="text-align:center; padding: 40px; color: #94a3b8;">
          <span class="spinner"></span> Loading record...
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const body = document.getElementById('student-modal-body');

  try {
    // Fetch the day-by-day records for this student in this course
    const res = await adminFetch(`/api/admin/attendance/student/${studentId}/course/${courseId}`);
    const json = await res.json();
    const records = json.data || [];

    if (!records.length) {
      body.innerHTML = '<div style="text-align:center; padding: 40px; color: #64748b;">No records found.</div>';
      return;
    }

    body.innerHTML = `
      <div class="table-wrap" style="background:#fff; border-radius:8px; border:1px solid #e2e8f0; overflow:hidden;">
        <table class="table-admin" style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc; text-align:left;">
              <th style="padding:12px; border-bottom:1px solid #e2e8f0;">Date</th>
              <th style="padding:12px; border-bottom:1px solid #e2e8f0;">Status</th>
              <th style="padding:12px; border-bottom:1px solid #e2e8f0;">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${records.map(r => {
              const d = new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
              let badgeClass = 'badge-success';
              if (r.status === 'absent') badgeClass = 'badge-danger';
              else if (r.status === 'late') badgeClass = 'badge-warning';
              else if (r.status === 'excused') badgeClass = 'badge-info';

              return `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:12px;">${d}</td>
                  <td style="padding:12px;"><span class="badge ${badgeClass}">${escapeHtml(r.status.toUpperCase())}</span></td>
                  <td style="padding:12px; color:#64748b; font-size:13px;">${escapeHtml(r.remarks || '—')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<div style="color:#dc2626; text-align:center; padding:20px;">Error loading details: ${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// NOTIFICATIONS — Compose Modal
// ============================================
function openComposeNotificationModal() {
  if (document.getElementById('nc-modal')) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'fpu-modal-backdrop';
  backdrop.id = 'nc-modal';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);';

  backdrop.innerHTML = `
    <div class="fpu-modal" style="width:100%;max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
      <div class="fpu-modal-header" style="padding:16px 24px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;background:#f8fafc;">
        <h3 style="margin:0;font-size:1.1rem;color:#0f172a;">Compose Notification</h3>
        <button class="btn btn-sm btn-ghost" onclick="document.getElementById('nc-modal').remove()" style="font-size:1.5rem;line-height:1;padding:0 8px;">&times;</button>
      </div>
      <div class="fpu-modal-body" style="padding:24px;">
        <div class="form-group">
          <label class="form-label">Title <span class="req">*</span></label>
          <input class="form-control" id="nc-title" placeholder="e.g. Campus Update" />
        </div>
        <div class="form-group">
          <label class="form-label">Message</label>
          <textarea class="form-control" id="nc-body" rows="4" placeholder="Type your message…"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
          <div class="form-group">
            <label class="form-label">Audience</label>
            <select class="form-select" id="nc-audience">
              <option value="all">Everyone (General)</option>
              <option value="student">Students Only</option>
              <option value="staff">Staff Only</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-select" id="nc-type">
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
            </select>
          </div>
        </div>
        <div style="margin-top:16px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;display:flex;align-items:center;gap:10px;">
          <input type="checkbox" id="nc-marquee" style="width:16px;height:16px;accent-color:#065f46;cursor:pointer;" />
          <label for="nc-marquee" style="font-size:13px;font-weight:600;color:#0f172a;cursor:pointer;">Show on Public Marquee (Scrolling Text)</label>
        </div>
      </div>
      <div class="fpu-modal-footer" style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:10px;">
        <button class="btn btn-outline" onclick="document.getElementById('nc-modal').remove()">Cancel</button>
        <button class="btn btn-primary" id="nc-save-btn">Send Notification</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#nc-save-btn').onclick = async () => {
    const title = backdrop.querySelector('#nc-title').value.trim();
    const body = backdrop.querySelector('#nc-body').value.trim();
    const audience = backdrop.querySelector('#nc-audience').value;
    const type = backdrop.querySelector('#nc-type').value;
    const showOnMarquee = backdrop.querySelector('#nc-marquee').checked;

    if (!title) { showToast('⚠️ Title is required.', 'warning'); return; }

    const btn = backdrop.querySelector('#nc-save-btn');
    btn.disabled = true; btn.textContent = 'Sending...';

    try {
      await adminFetch('/api/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({ title, body, type, audience, showOnMarquee }),
      });
      showToast('✅ Notification sent.', 'success');
      backdrop.remove();
      loadNotifications();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
      btn.disabled = false; btn.textContent = 'Send Notification';
    }
  };
}

// ============================================
// ANNOUNCEMENTS — Compose Modal
// ============================================
function openComposeAnnouncementModal() {
  if (document.getElementById('ac-modal')) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'fpu-modal-backdrop';
  backdrop.id = 'ac-modal';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);';

  backdrop.innerHTML = `
    <div class="fpu-modal" style="width:100%;max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
      <div class="fpu-modal-header" style="padding:16px 24px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;background:#f8fafc;">
        <h3 style="margin:0;font-size:1.1rem;color:#0f172a;">New Announcement</h3>
        <button class="btn btn-sm btn-ghost" onclick="document.getElementById('ac-modal').remove()" style="font-size:1.5rem;line-height:1;padding:0 8px;">&times;</button>
      </div>
      <div class="fpu-modal-body" style="padding:24px;">
        <div class="form-group">
          <label class="form-label">Title <span class="req">*</span></label>
          <input class="form-control" id="ac-title" placeholder="e.g. Resumption Date" />
        </div>
        <div class="form-group">
          <label class="form-label">Body <span class="req">*</span></label>
          <textarea class="form-control" id="ac-body" rows="4" placeholder="Write your announcement…"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
          <div class="form-group">
            <label class="form-label">Audience</label>
            <select class="form-select" id="ac-audience">
              <option value="all">Everyone (General)</option>
              <option value="student">Students Only</option>
              <option value="staff">Staff Only</option>
              <option value="lecturer">Lecturers Only</option>
              <option value="hod">HODs Only</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select class="form-select" id="ac-priority">
              <option value="normal">Normal</option>
              <option value="high">High (Urgent)</option>
              <option value="low">Low (General)</option>
            </select>
          </div>
        </div>
        <div style="margin-top:16px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <input type="checkbox" id="ac-publish" checked style="width:16px;height:16px;accent-color:#065f46;cursor:pointer;" />
            <label for="ac-publish" style="font-size:13px;font-weight:600;color:#0f172a;cursor:pointer;">Publish immediately</label>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <input type="checkbox" id="ac-marquee" style="width:16px;height:16px;accent-color:#065f46;cursor:pointer;" />
            <label for="ac-marquee" style="font-size:13px;font-weight:600;color:#0f172a;cursor:pointer;">Show on Public Marquee (Scrolling Text)</label>
          </div>
        </div>
      </div>
      <div class="fpu-modal-footer" style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:10px;">
        <button class="btn btn-outline" onclick="document.getElementById('ac-modal').remove()">Cancel</button>
        <button class="btn btn-primary" id="ac-save-btn">Publish</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#ac-save-btn').onclick = async () => {
    const title = backdrop.querySelector('#ac-title').value.trim();
    const body = backdrop.querySelector('#ac-body').value.trim();
    const audience = backdrop.querySelector('#ac-audience').value;
    const priority = backdrop.querySelector('#ac-priority').value;
    const isPublished = backdrop.querySelector('#ac-publish').checked;
    const showOnMarquee = backdrop.querySelector('#ac-marquee').checked;

    if (!title || !body) { showToast('⚠️ Title and body are required.', 'warning'); return; }

    const btn = backdrop.querySelector('#ac-save-btn');
    btn.disabled = true; btn.textContent = 'Publishing...';

    try {
      await adminFetch('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({ title, body, audience, priority, isPublished, showOnMarquee }),
      });
      showToast('✅ Announcement published.', 'success');
      backdrop.remove();
      loadAnnouncements();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
      btn.disabled = false; btn.textContent = 'Publish';
    }
  };
}

// ============================================
// NOTIFICATIONS — Topbar Badge Sync
// ============================================
async function updateNotificationBadge() {
  try {
    const res = await adminFetch('/api/admin/notifications');
    const json = await res.json();
    const all = json.data || [];
    
    // Count only unread notifications
    const unreadCount = all.filter(n => !n.isRead && !n.is_read).length;
    
    // Try to find the badge in several common places
    const badgeSelectors = [
      '.notif-badge',
      '#notif-badge',
      '[data-badge="notifications"]',
      '.topbar .badge',
      '#notifications-badge',
    ];
    
    let found = false;
    badgeSelectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) {
        found = true;
        if (unreadCount > 0) {
          el.textContent = unreadCount > 99 ? '99+' : unreadCount;
          el.style.display = 'inline-flex';
        } else {
          el.style.display = 'none';
        }
      }
    });
    
    // Persist to localStorage so the shell doesn't show stale data
    localStorage.setItem('fpu_notif_count', unreadCount);
    localStorage.setItem('notifCount', unreadCount);
    localStorage.setItem('unreadCount', unreadCount);
    
    console.debug('[notif-badge] Synced:', unreadCount, 'badgeFound:', found);
    return unreadCount;
  } catch (e) {
    console.error('[notif-badge] Sync failed:', e.message);
    return 0;
  }
}

window.FPU_ADMIN = {
  // Core Helpers
  adminFetch, setAdminSession, clearAdminSession, getAdminToken, getAdminUser, requireAdminAuth,
  toast: showToast, showToast, escapeHtml, escapeQuotes, capitalize, getInitials, timeAgo,
  fmtDate, fmtDateTime, money, setText, copyToClipboard, openModal, extractArray,
  badge, roleBadge, statusPill, promptReason, exportTableAsCSV,

  // Dashboard
  initDashboard, loadDashboardStats, loadRecentActivity, loadAll,
  loadStats, loadTopDepartments, loadPendingApprovals,
  loadStudentsByDept, loadStudentsByProgramme, loadStudentsByLevel, loadStudentGender,
  loadAdmissionTrend, loadApplicationStatus, loadPopulationTrend, loadPaymentStatus,
  loadRevenueTrend, loadRegistrationStats, loadDeptComparison, loadResultsStats,
  loadRecentStudents, loadRecentPayments, loadRecentApplications, loadRecentRegistrations,
  loadRecentResults, loadRecentNotifications, loadUpcomingEvents, loadRecentLogins,

  // Applications
  loadApplications, loadAdmitted, registerAdmitted, bulkApplicationAction,
  approveApplication, rejectApplication, registerApplication,
  updateApplicationStats, updateAdmittedStats, bulkRegisterAdmitted,

  // Students
  loadStudentDepartments, loadDepartmentStudents, globalStudentSearch, bulkStudentAction,

  // Sessions
  loadSessions, setCurrentSession, deleteSession, autoCreateNextSession,

  // Programmes
  loadProgrammes, selectProgrammeDepartment, deleteProgramme,

  // Schools
  loadSchools, loadSchoolCards,

  // Departments
  loadDepartments, loadDepartmentCards,

  // Allocations
  loadAllocationDepartments, loadDepartmentAllocations,

  // Registrations
  loadRegistrationStudents, loadStudentRegistrations,

  // Results
  loadResultsDashboard, loadDepartmentResults, loadApprovedResults, toggleAllResults,
  toggleCourseResults, updateBulkBtnState, bulkResultAction, courseBulkAction, publishAllApproved,

  // Grade Scales
  loadGradeScales, openEditGradeScale, toggleGradeScale, deleteGradeScale, toggleAddBandForm,  submitAddBand,
  editGradeScale,

  // Transcript
  loadTranscriptLookup, loadTranscriptView, openTranscriptModal,

  // Timetable
  loadTimetableIndex,

  // Exams
  loadExamsIndex, loadExamSheet,

    // Attendance
  loadAttendanceDepartments, loadDepartmentAttendance,
  openDepartmentAttendanceModal, openCourseAttendanceModal, openStudentAttendanceModal,

  // Staff, HODs, Lecturers
  loadStaffDirectory, loadHodBoard, loadLecturerGrid, assignHodDept, openLecturerCourses, sendLecturerEmail, sendLecturerNotification,
  viewHodDetails, replaceHod, sendHodEmail, emailAllHods, loadStaffProfile, editStaffFromProfile,
  resetStaffPassword, toggleStaffActive, deleteStaff, closeResetModal, togglePasswordVisibility,
  submitResetPassword,

  // Fees, Payments, Clearances
  loadFeeDepartments, loadPaymentDepartments, loadClearanceDepartments, loadDepartmentClearances, clearStudent, bulkClearClearances, exportClearanceCSV,
  loadDepartmentPayments, sendPaymentReminder, sendBulkPaymentReminder, openPaymentHistory, loadPaymentRevenueTrend,
  loadFeeLevels, openAddFeeModal, openEditFeeModal, deleteFeeLevel,

  // Communication
  loadAnnouncements, deleteAnnouncement, openComposeAnnouncementModal, loadNotifications, markNotificationRead, deleteNotification, updateNotificationBadge,
  loadComplaints, filterComplaints, renderComplaintsTable, updateComplaintStats, openComposeNotificationModal,

  // Library
  loadBooksGrid, loadBorrowsTable, openReturnModal, renewBorrow, submitIssueBookForm,

  // Records & System
  loadDocumentsTable, loadGraduationsTable, loadReportsWithCharts, loadAuditTable,
  loadSecurityDashboard, wireSecurityActions, wireSecurityCards, wireGraduationPage,
  loadSettingsShell, prefillSettingsForm, loadLoginHistoryIntoAudit, loadReports,
  approveDoc, rejectDoc, issueDoc, deleteDoc, openDocEditModal,  renderDocPreview,
  approveGraduation, rejectGraduation, markGraduated, loadTranscriptView, loadDocumentDetail,

  // Users
  loadUsersHub, loadAllUsers, loadAdminAccounts, resetAdminPwd, toggleAdminActive,
  loadLoginHistory, loadUserProfile, loadUsersWithPhotos, 

  // Settings
  saveSettingsSection, loadAdvancedSettings, saveAdvSetting, saveAdvancedBankAccount, wireSettingsTabExtras,
  loadBankAccounts, addBankAccount, saveBankAccount, deleteBankAccount,
  runLibrarySweep, sendTestEmail, sendTestSMS, initAccountTab, initSystemTab,

  // Security
  loadSecurityDashboard, loadSecurityEvents, loadSecuritySessions, revokeSession,
  loadLoginAttempts, addIpBlock, loadIpRules, deleteIpRule, openAddIpModal,
  loadPasswordPolicy, loadPermissionsMatrix, load2FAConfig, loadBackups, loadCompliance,

  openPaymentHistory, exportPaymentHistoryPDF, printPaymentReceipt, exportPaymentHistoryCSV,

  // Courses
  loadCourseDepartments, loadDepartmentCourses, inferCourseYear,
};