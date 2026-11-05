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

  window.fpuPrompt = function(message, defaultValue, options) {
    defaultValue = defaultValue || '';
    options = options || {};
    const title = options.title || 'Input Required';
    const okText = options.okText || 'OK';
    const cancelText = options.cancelText || 'Cancel';
    const inputType = options.inputType || 'text';
    const placeholder = options.placeholder || '';

    let overlay = document.getElementById('fpu-prompt-container');
    if (!overlay) {
      const html = `
        <div class="fpu-prompt-overlay" id="fpu-prompt-container">
          <div class="fpu-prompt-box">
            <h3 class="fpu-prompt-title" id="fpu-prompt-title">${title}</h3>
            <p class="fpu-prompt-message" id="fpu-prompt-message">${message}</p>
            <input type="${inputType}" class="fpu-prompt-input" id="fpu-prompt-input" placeholder="${placeholder}" />
            <div class="fpu-prompt-actions">
              <button type="button" class="fpu-prompt-btn fpu-prompt-btn-cancel" id="fpu-prompt-cancel">${cancelText}</button>
              <button type="button" class="fpu-prompt-btn fpu-prompt-btn-ok" id="fpu-prompt-ok">${okText}</button>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', html);
      overlay = document.getElementById('fpu-prompt-container');
    }

    const titleEl = document.getElementById('fpu-prompt-title');
    const msgEl = document.getElementById('fpu-prompt-message');
    const inputEl = document.getElementById('fpu-prompt-input');
    const okBtn = document.getElementById('fpu-prompt-ok');
    const cancelBtn = document.getElementById('fpu-prompt-cancel');

    titleEl.textContent = title;
    msgEl.textContent = message;
    inputEl.type = inputType;
    inputEl.placeholder = placeholder;
    inputEl.value = defaultValue;
    okBtn.textContent = okText;
    cancelBtn.textContent = cancelText;

    return new Promise((resolve) => {
      overlay.classList.add('show');
      setTimeout(() => { inputEl.focus(); inputEl.select(); }, 50);

      function cleanup(result) {
        overlay.classList.remove('show');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        inputEl.removeEventListener('keydown', onKey);
        overlay.removeEventListener('click', onOverlayClick);
        resolve(result);
      }
      function onOk() { cleanup(inputEl.value); }
      function onCancel() { cleanup(null); }
      function onKey(e) {
        if (e.key === 'Enter') { e.preventDefault(); cleanup(inputEl.value); }
        if (e.key === 'Escape') { e.preventDefault(); cleanup(null); }
      }
      function onOverlayClick(e) { if (e.target === overlay) cleanup(null); }

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      inputEl.addEventListener('keydown', onKey);
      overlay.addEventListener('click', onOverlayClick);
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
// EXPORTS
// ============================================
window.FPU_ADMIN = {
  adminFetch, setAdminSession, clearAdminSession, getAdminToken, getAdminUser, requireAdminAuth,
  toast: showToast, showToast, escapeHtml, escapeQuotes, capitalize, getInitials, timeAgo, fmtDate, fmtDateTime, money, setText, copyToClipboard, openModal,
  extractArray, badge, roleBadge, statusPill, promptReason, exportTableAsCSV,
  
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
  
  // Courses
  loadCourseDepartments, loadDepartmentCourses, inferCourseYear

};