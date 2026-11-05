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
// GRADE SCALES
// ============================================
async function loadGradeScales() {
  const container = document.getElementById("grade-scales-tbody");
  if (!container) return;
  
  container.innerHTML = '<tr><td colspan="6" class="empty">Loading…</td></tr>';
  
  try {
    const res = await adminFetch("/api/admin/grade-scales");
    const result = await res.json();
    const rows = extractArray(result);

    if (!rows.length) {
      container.innerHTML = '<tr><td colspan="6" class="empty">No grade scales defined.</td></tr>';
      return;
    }

    // Sort rows by minimum score descending
    rows.sort((a, b) => Number(b.minScore) - Number(a.minScore));

    container.innerHTML = rows.map((g) => `
      <tr>
        <td><span class="gs-grade-chip ${escapeHtml(g.grade)}">${escapeHtml(g.grade)}</span></td>
        <td><span class="gs-range">${g.minScore} – ${g.maxScore}</span></td>
        <td><span class="gs-points">${g.points}</span></td>
        <td>${escapeHtml(g.remark || '')}</td>
        <td>${g.isActive ? badge('active') : badge('inactive')}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-sm btn-outline" onclick="FPU_ADMIN.openEditGradeScale(${g.id})">Edit</button>
            <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.toggleGradeScale(${g.id}, ${!g.isActive})">${g.isActive ? 'Deactivate' : 'Activate'}</button>
            <button class="btn btn-sm btn-ghost" style="color:#dc2626;" onclick="FPU_ADMIN.deleteGradeScale(${g.id})">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    // Pass data to the health checker and live preview
    renderGradeScaleHealth(rows);
    setupGradeScalePreview(rows);

  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

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

async function deleteGradeScale(id) {
  if (!confirm('Delete this grade band?')) return;
  try {
    await adminFetch(`/api/admin/grade-scales/${id}`, { method: 'DELETE' });
    showToast('Deleted.', 'success');
    loadGradeScales();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

// ============================================
// TRANSCRIPT (Lookup Directory)
// ============================================
async function loadTranscriptLookup() {
  const tbody = document.getElementById('tx-search-tbody');
  const countEl = document.getElementById('tx-count');
  const input = document.getElementById('tx-search');
  const searchBtn = document.getElementById('tx-search-btn');
  
  if (!tbody) return;

  const q = (input || {}).value || '';

  tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading…</td></tr>';

  try {
    const qs = new URLSearchParams({ limit: q ? 100 : 50 });
    if (q) qs.set('search', q);
    
    const res = await adminFetch(`/api/admin/students?${qs}`);
    const json = await res.json();
    const rows = json.data || [];

    if (countEl) countEl.textContent = `${rows.length} result${rows.length === 1 ? '' : 's'}`;

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No students found.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((s) => `
      <tr class="row-clickable" onclick="FPU_ADMIN_SPA.navigateToWithQuery('transcript-by-student', { studentId: ${s.id} })">
        <td><code>${escapeHtml(s.matricNumber || '')}</code></td>
        <td><strong>${escapeHtml((s.firstName || '') + ' ' + (s.lastName || ''))}</strong></td>
        <td>${escapeHtml(s.level || '')}</td>
        <td>${escapeHtml(s.programmeName || s.programme?.name || '—')}</td>
        <td>${s.isActive !== false ? badge('active') : badge('inactive')}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('transcript-by-student', { studentId: ${s.id} })">
            Open Transcript
          </button>
        </td>
      </tr>
    `).join('');

    // Wire search button if it exists
    if (searchBtn && !searchBtn.__wired) {
      searchBtn.__wired = true;
      searchBtn.onclick = () => loadTranscriptLookup();
    }
    
    // Wire enter key on search input
    if (input && !input.__wired) {
      input.__wired = true;
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          loadTranscriptLookup();
        }
      });
    }

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
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
// EXAMS
// ============================================
async function loadExamsIndex() {
  const grid = document.getElementById('ex-school-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading schools…</div>';

  const sessionId = (document.getElementById('ex-session') || {}).value || '';
  const semester = (document.getElementById('ex-semester') || {}).value || 'first';
  const schoolId = (document.getElementById('ex-school') || {}).value || '';

  try {
    const qs = new URLSearchParams();
    if (sessionId) qs.set('sessionId', sessionId);
    if (semester) qs.set('semester', semester);

    const [schoolsRes, examsRes, deptsRes, coursesRes] = await Promise.all([
      adminFetch('/api/admin/schools'),
      adminFetch(`/api/admin/exams?${qs}`),
      adminFetch('/api/admin/departments'),
      adminFetch('/api/admin/courses?limit=2000'),
    ]);

    const schools = (await schoolsRes.json()).data || [];
    const exams = (await examsRes.json()).data || [];
    const depts = (await deptsRes.json()).data || [];
    const courses = (await coursesRes.json()).data || [];

    const courseById = new Map(courses.map((c) => [c.id, c]));
    const deptById = new Map(depts.map((d) => [d.id, d]));

    const bySchool = new Map();
    for (const s of schools) bySchool.set(s.id, { school: s, exams: [] });

    for (const e of exams) {
      const c = courseById.get(e.exam?.courseId || e.courseId);
      if (!c) continue;
      const d = deptById.get(c.departmentId);
      if (!d) continue;
      const bucket = bySchool.get(d.schoolId);
      if (!bucket) continue;
      bucket.exams.push(e);
    }

    let total = 0, totalDays = new Set(), totalVenues = new Set();
    for (const b of bySchool.values()) {
      total += b.exams.length;
      b.exams.forEach((e) => {
        const exam = e.exam || e;
        if (exam.examDate) totalDays.add(String(exam.examDate).slice(0, 10));
        if (exam.venue) totalVenues.add(exam.venue);
      });
    }

    setText('ex-stat-total', total);
    setText('ex-stat-depts', depts.length);
    setText('ex-stat-days', totalDays.size);
    setText('ex-stat-venues', totalVenues.size);

    const visible = [...bySchool.values()].filter((b) => {
      if (!schoolId) return true;
      return Number(b.school.id) === Number(schoolId);
    });

    grid.innerHTML = visible.map((b) => {
      const isEmpty = b.exams.length === 0;
      return `
        <div class="ex-school-card ${isEmpty ? 'empty' : ''}" ${isEmpty ? '' : `data-school-id="${b.school.id}" data-school-name="${escapeHtml(b.school.name)}"`}>
          <div class="esc-head">
            <span class="esc-code">${escapeHtml(b.school.code)}</span>
            <span class="esc-badge">Exam Sheet</span>
          </div>
          <h3>${escapeHtml(b.school.name)}</h3>
          <div class="esc-stats">
            <div class="esc-stat"><span class="num">${b.exams.length}</span><span class="label">Exams</span></div>
            <div class="esc-stat"><span class="num">${new Set(b.exams.map((e) => (e.exam || e).examDate)).size}</span><span class="label">Days</span></div>
            <div class="esc-stat"><span class="num">${new Set(b.exams.map((e) => (e.exam || e).venue).filter(Boolean)).size}</span><span class="label">Venues</span></div>
          </div>
          <div class="esc-footer">
            <span>${isEmpty ? 'No exams yet' : 'Open exam sheet'}</span>
            <span class="arrow">→</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.ex-school-card[data-school-id]').forEach((card) => {
      card.addEventListener('click', () => {
        FPU_ADMIN_SPA.navigateToWithQuery('exam-sheet', { schoolId: Number(card.dataset.schoolId), sessionId: sessionId || '', semester, name: card.dataset.schoolName });
      });
    });

  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// ATTENDANCE
// ============================================
async function loadAttendanceDepartments() {
  const grid = document.getElementById('att-dept-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading departments…</div>';

  const sessionId = (document.getElementById('att-filter-session') || {}).value || '';
  const semester = (document.getElementById('att-filter-semester') || {}).value || '';
  const schoolId = (document.getElementById('att-filter-school') || {}).value || '';
  const search = (document.getElementById('att-filter-search') || {}).value || '';

  try {
    const qs = new URLSearchParams({ limit: 5000 });
    if (sessionId) qs.set('sessionId', sessionId);
    if (semester) qs.set('semester', semester);

    const [attRes, deptsRes, coursesRes, schoolsRes] = await Promise.all([
      adminFetch(`/api/admin/attendance?${qs}`),
      adminFetch('/api/admin/departments'),
      adminFetch('/api/admin/courses?limit=2000'),
      adminFetch('/api/admin/schools'),
    ]);

    const records = (await attRes.json()).data || [];
    const depts = (await deptsRes.json()).data || [];
    const courses = (await coursesRes.json()).data || [];
    const schools = (await schoolsRes.json()).data || [];

    const courseById = new Map(courses.map((c) => [c.id, c]));
    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    const byDept = new Map();
    for (const d of depts) byDept.set(d.id, { dept: d, records: [], courses: new Set(), students: new Set(), present: 0, total: 0 });

    for (const r of records) {
      const course = courseById.get(r.courseId);
      if (!course) continue;
      const bucket = byDept.get(course.departmentId);
      if (!bucket) continue;
      bucket.records.push(r);
      bucket.courses.add(course.id);
      bucket.students.add(r.studentId);
      bucket.total++;
      if (r.status === 'present') bucket.present++;
    }

    let totalRecords = 0, totalPresent = 0;
    byDept.forEach((b) => { totalRecords += b.total; totalPresent += b.present; });

    setText('att-stat-depts', [...byDept.values()].filter((b) => b.total > 0).length);
    setText('att-stat-courses', courses.length);
    setText('att-stat-rate', totalRecords ? Math.round((totalPresent / totalRecords) * 100) + '%' : '—');
    setText('att-stat-total', totalRecords);

    const visible = [...byDept.values()].filter((b) => {
      if (schoolId && Number(b.dept.schoolId) !== Number(schoolId)) return false;
      if (search) {
        const q = search.toLowerCase();
        return String(b.dept.code).toLowerCase().includes(q) || String(b.dept.name).toLowerCase().includes(q);
      }
      return true;
    });

    if (!visible.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">📋</div><p>No departments.</p></div>';
      return;
    }

    visible.sort((a, b) => String(a.dept.code).localeCompare(String(b.dept.code)));

    grid.innerHTML = visible.map((b) => {
      const rate = b.total ? Math.round((b.present / b.total) * 100) : 0;
      const cls = b.total === 0 ? 'empty' : rate >= 75 ? 'healthy' : rate >= 50 ? 'warning' : 'critical';
      const school = schoolMap.get(b.dept.schoolId);
      return `
        <div class="att-dept-card ${cls}" ${b.total === 0 ? '' : `data-dept-id="${b.dept.id}" data-dept-name="${escapeHtml(b.dept.name)}"`}>
          <div class="adc-head">
            <span class="adc-code">${escapeHtml(b.dept.code)}</span>
            <span class="adc-school">${escapeHtml(school?.code || '')}</span>
          </div>
          <h3>${escapeHtml(b.dept.name)}</h3>
          <div class="adc-rate">
            <span class="adc-rate-num ${cls}">${b.total ? rate + '%' : '—'}</span>
            <span class="label">attendance rate</span>
          </div>
          <div class="adc-stats">
            <div class="adc-stat"><span class="num">${b.courses.size}</span><span class="label">Courses</span></div>
            <div class="adc-stat"><span class="num">${b.students.size}</span><span class="label">Students</span></div>
            <div class="adc-stat"><span class="num">${b.total}</span><span class="label">Records</span></div>
          </div>
          <div class="adc-footer">
            <span>${b.total === 0 ? 'No records' : 'View courses'}</span>
            <span class="arrow">→</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.att-dept-card[data-dept-id]').forEach((card) => {
      card.addEventListener('click', () => {
        FPU_ADMIN_SPA.navigateToWithQuery('attendance-by-dept', { departmentId: Number(card.dataset.deptId), sessionId, semester, name: card.dataset.deptName });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// STAFF (Directory, HODs, Lecturers)
// ============================================

// 1. Staff Directory (All Staff)
async function loadStaffDirectory() {
  const grid = document.getElementById('staff-grid');
  if (!grid) return;

  const role = (document.getElementById('staff-role-tabs')?.querySelector('.active')?.dataset.role) || '';
  const deptId = (document.getElementById('staff-filter-dept') || {}).value || '';
  const search = (document.getElementById('staff-search') || {}).value || '';

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading staff…</div>';

  try {
    const qs = new URLSearchParams({ limit: 500 });
    if (role && role !== 'principal') qs.set('role', role);
    if (deptId) qs.set('departmentId', deptId);
    if (search) qs.set('search', search);

    const res = await adminFetch(`/api/admin/staff?${qs}`);
    const json = await res.json();
    let rows = json.data || [];

    if (role === 'principal') {
      const principalRoles = ['bursar', 'registrar', 'rector', 'librarian', 'exam_officer', 'academic_officer', 'admission_officer'];
      rows = rows.filter((u) => principalRoles.includes(u.role));
    }

    // Counts
    const allRes = await adminFetch('/api/admin/staff?limit=500');
    const allStaff = (await allRes.json()).data || [];
    setText('staff-count-all', allStaff.length);
    setText('staff-count-lecturer', allStaff.filter((s) => s.role === 'lecturer').length);
    setText('staff-count-hod', allStaff.filter((s) => s.role === 'hod').length);
    setText('staff-count-principal', allStaff.filter((s) => ['bursar','registrar','rector','librarian','exam_officer','academic_officer','admission_officer'].includes(s.role)).length);
    setText('staff-count-admin', allStaff.filter((s) => s.role === 'admin').length);

    if (!rows.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">👥</div><p>No staff.</p></div>';
      return;
    }

    grid.innerHTML = rows.map((s) => {
      const fullName = `${s.firstName || ''} ${s.lastName || ''}`.trim();
      const initials = ((s.firstName || ' ')[0] + (s.lastName || ' ')[0]).toUpperCase().trim() || 'S';
      const avatar = s.photoUrl ? `<img src="${escapeHtml(s.photoUrl)}" alt="" />` : escapeHtml(initials);
      const roleClass = s.role === 'lecturer' ? 'lecturer' : s.role === 'hod' ? 'hod' : s.role === 'admin' ? 'admin' : 'principal';
      const cardClass = s.isActive === false ? 'inactive' : roleClass;

      return `
        <div class="staff-card role-${cardClass}" data-id="${s.id}">
          <div class="sc-head">
            <div class="sc-avatar">${avatar}</div>
            <div class="sc-info">
              <div class="sc-name">${escapeHtml(fullName)}</div>
              <div class="sc-email">${escapeHtml(s.email || '')}</div>
              <span class="sc-role-badge ${roleClass}">${escapeHtml(s.role || '').replace(/_/g, ' ')}</span>
            </div>
          </div>
          <div class="sc-meta">
            <div class="sc-meta-row"><span class="k">Department</span><span class="v">${escapeHtml(s.departmentName || s.department?.name || '—')}</span></div>
            <div class="sc-meta-row"><span class="k">Rank</span><span class="v">${escapeHtml(s.staffProfile?.rank || '—')}</span></div>
            <div class="sc-meta-row"><span class="k">Status</span><span class="v">${s.isActive !== false ? 'Active' : 'Inactive'}</span></div>
          </div>
          <div class="sc-actions">
            <button class="btn btn-sm btn-outline" onclick="FPU_ADMIN_SPA.navigateToWithQuery('staff-profile', { id: ${s.id} })">View</button>
            <button class="btn btn-sm btn-outline" onclick="FPU_ADMIN_SPA.navigateToWithQuery('staff-form', { id: ${s.id} })">Edit</button>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.staff-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        FPU_ADMIN_SPA.navigateToWithQuery('staff-profile', { id: Number(card.dataset.id) });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

// 2. HODs Board
async function loadHodBoard() {
  const grid = document.getElementById('hod-dept-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading HODs…</div>';

  try {
    const [deptsRes, hodsRes, schoolsRes] = await Promise.all([
      adminFetch('/api/admin/departments'),
      adminFetch('/api/admin/hods'),
      adminFetch('/api/admin/schools'),
    ]);

    const depts = (await deptsRes.json()).data || [];
    const hods = (await hodsRes.json()).data || [];
    const schools = (await schoolsRes.json()).data || [];

    const hodById = new Map(hods.map((h) => [h.id, h]));
    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    const assigned = new Set();
    depts.forEach((d) => { if (d.hodUserId) assigned.add(d.hodUserId); });

    const unassigned = hods.filter((h) => !assigned.has(h.id));

    setText('hod-stat-total', hods.length);
    setText('hod-stat-assigned', assigned.size);
    setText('hod-stat-unassigned', unassigned.length);
    setText('hod-stat-depts', depts.length);

    const unassignedPanel = document.getElementById('hod-unassigned-panel');
    const unassignedBody = document.getElementById('hod-unassigned-body');
    if (unassigned.length && unassignedPanel && unassignedBody) {
      unassignedPanel.style.display = 'block';
      unassignedBody.innerHTML = unassigned.map((h) => `
        <div class="session-item">
          <div class="meta"><strong>${escapeHtml(h.firstName + ' ' + h.lastName)}</strong>${escapeHtml(h.email)}</div>
          <button class="btn btn-sm btn-outline" onclick="FPU_ADMIN.assignHodDept(${h.id})">Assign Dept</button>
        </div>
      `).join('');
    } else if (unassignedPanel) {
      unassignedPanel.style.display = 'none';
    }

    grid.innerHTML = depts.map((d) => {
      const hod = d.hodUserId ? hodById.get(d.hodUserId) : null;
      const school = schoolMap.get(d.schoolId);
      const vacant = !hod;
      const initials = hod ? ((hod.firstName || ' ')[0] + (hod.lastName || ' ')[0]).toUpperCase().trim() : '—';

      return `
        <div class="hod-dept-card ${vacant ? 'vacant' : ''}">
          <div class="hdc-head">
            <span class="hdc-code">${escapeHtml(d.code)}</span>
            <span class="hdc-school">${escapeHtml(school?.code || '')}</span>
          </div>
          <h3>${escapeHtml(d.name)}</h3>
          <div class="hdc-hod ${vacant ? 'vacant' : ''}">
            <div class="hdc-avatar ${vacant ? 'vacant' : ''}">${hod?.photoUrl ? `<img src="${escapeHtml(hod.photoUrl)}" alt="" />` : escapeHtml(initials)}</div>
            <div class="hdc-hod-info">
              <div class="hdc-hod-name">${vacant ? 'Vacant' : escapeHtml(`${hod.firstName} ${hod.lastName}`)}</div>
              <div class="hdc-hod-email">${vacant ? 'No HOD assigned' : escapeHtml(hod.email)}</div>
            </div>
          </div>
          <div class="hdc-actions">
            ${vacant
              ? `<button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.assignHodDept(null, ${d.id})">Assign HOD</button>`
              : `<button class="btn btn-sm btn-outline" onclick="FPU_ADMIN_SPA.navigateToWithQuery('user-profile', { id: ${hod.id} })">View HOD</button><button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.assignHodDept(null, ${d.id})">Replace</button>`}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

// 3. Lecturers Grid
async function loadLecturerGrid() {
  const grid = document.getElementById('lec-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading lecturers…</div>';

  const deptId = (document.getElementById('lec-filter-dept') || {}).value || '';
  const workload = (document.getElementById('lec-filter-workload') || {}).value || '';
  const search = (document.getElementById('lec-search') || {}).value || '';

  try {
    const qs = new URLSearchParams({ role: 'lecturer', limit: 500 });
    if (deptId) qs.set('departmentId', deptId);
    if (search) qs.set('search', search);

    const [staffRes, allocsRes] = await Promise.all([
      adminFetch(`/api/admin/staff?${qs}`),
      adminFetch('/api/admin/allocations?limit=2000'),
    ]);

    const staff = (await staffRes.json()).data || [];
    const allocs = (await allocsRes.json()).data || [];

    const allocsByLecturer = new Map();
    allocs.forEach((a) => {
      const lid = a.lecturer?.id || a.allocation?.lecturerId;
      if (!lid) return;
      if (!allocsByLecturer.has(lid)) allocsByLecturer.set(lid, []);
      allocsByLecturer.get(lid).push(a);
    });

    let visible = staff.map((s) => {
      const list = allocsByLecturer.get(s.id) || [];
      const units = list.reduce((acc, a) => acc + (Number(a.course?.unit) || 0), 0);
      return { ...s, _allocs: list, _units: units };
    });

    if (workload === 'loaded') visible = visible.filter((s) => s._allocs.length > 0);
    else if (workload === 'unloaded') visible = visible.filter((s) => s._allocs.length === 0);
    else if (workload === 'overloaded') visible = visible.filter((s) => s._units >= 12);

    const totalUnits = visible.reduce((acc, s) => acc + s._units, 0);
    const avg = visible.length ? Math.round((totalUnits / visible.length) * 10) / 10 : 0;

    setText('lec-stat-total', visible.length);
    setText('lec-stat-loaded', visible.filter((s) => s._allocs.length > 0).length);
    setText('lec-stat-unloaded', visible.filter((s) => s._allocs.length === 0).length);
    setText('lec-stat-avg', avg + ' u');

    if (!visible.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">👨‍🏫</div><p>No lecturers.</p></div>';
      return;
    }

    grid.innerHTML = visible.map((s) => {
      const fullName = `${s.firstName || ''} ${s.lastName || ''}`.trim();
      const initials = ((s.firstName || ' ')[0] + (s.lastName || ' ')[0]).toUpperCase().trim() || 'L';
      const avatar = s.photoUrl ? `<img src="${escapeHtml(s.photoUrl)}" alt="" />` : escapeHtml(initials);
      const cls = s._units >= 12 ? 'heavy' : s._units >= 6 ? 'loaded' : s._units > 0 ? 'light' : 'none';

      return `
        <div class="lec-card ${cls}" data-id="${s.id}">
          <div class="lc-head">
            <div class="lc-avatar">${avatar}</div>
            <div class="lc-info">
              <div class="lc-name">${escapeHtml(fullName)}</div>
              <div class="lc-email">${escapeHtml(s.email || '')}</div>
              ${s.departmentName || s.department?.name ? `<span class="lc-dept">${escapeHtml(s.departmentName || s.department?.name)}</span>` : ''}
            </div>
          </div>
          <div class="lc-workload">
            <div class="lc-workload-stat ${s._allocs.length === 0 ? 'none' : ''}">
              <span class="num">${s._allocs.length}</span>
              <span class="label">Courses</span>
            </div>
            <div class="lc-workload-stat ${s._units >= 12 ? 'heavy' : ''}">
              <span class="num">${s._units}</span>
              <span class="label">Units</span>
            </div>
          </div>
          ${s._allocs.length === 0 ? '<div class="lc-empty">⚠️ No courses allocated</div>' : ''}
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.lec-card').forEach((card) => {
      card.addEventListener('click', () => {
        FPU_ADMIN_SPA.navigateToWithQuery('staff-workload', { id: Number(card.dataset.id) });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
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
// PAYMENTS
// ============================================
async function loadPaymentDepartments() {
  const grid = document.getElementById('pm-dept-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading departments…</div>';

  const sessionId = (document.getElementById('pm-session') || {}).value || '';
  const schoolId = (document.getElementById('pm-school') || {}).value || '';
  const search = (document.getElementById('pm-search') || {}).value || '';

  try {
    const qs = new URLSearchParams();
    if (sessionId) qs.set('sessionId', sessionId);

    const [payRes, deptsRes, studentsRes, schoolsRes] = await Promise.all([
      adminFetch(`/api/admin/payments?${qs}`),
      adminFetch('/api/admin/departments'),
      adminFetch('/api/admin/students?limit=5000'),
      adminFetch('/api/admin/schools'),
    ]);

    const payments = (await payRes.json()).data || [];
    const depts = (await deptsRes.json()).data || [];
    const students = (await studentsRes.json()).data || [];
    const schools = (await schoolsRes.json()).data || [];

    const studentById = new Map(students.map((s) => [s.id, s]));
    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    const byDept = new Map();
    for (const d of depts) byDept.set(d.id, { dept: d, verified: 0, pending: 0, verifiedAmt: 0, pendingAmt: 0, studentIds: new Set() });

    let totalVerified = 0, totalPendingAmt = 0, pendingCount = 0;
    for (const p of payments) {
      const row = p.payment || p;
      const stu = studentById.get(row.studentId) || p.student;
      if (!stu) continue;
      const bucket = byDept.get(stu.departmentId);
      if (!bucket) continue;
      bucket.studentIds.add(row.studentId);
      if (row.status === 'verified') {
        bucket.verified++;
        bucket.verifiedAmt += Number(row.amount) || 0;
        totalVerified += Number(row.amount) || 0;
      } else if (row.status === 'pending') {
        bucket.pending++;
        bucket.pendingAmt += Number(row.amount) || 0;
        totalPendingAmt += Number(row.amount) || 0;
        pendingCount++;
      }
    }

    setText('pm-stat-verified', money(totalVerified));
    setText('pm-stat-pending-amt', money(totalPendingAmt));
    setText('pm-stat-pending-count', pendingCount);
    setText('pm-stat-total', payments.length);

    const visible = [...byDept.values()].filter((b) => {
      if (schoolId && Number(b.dept.schoolId) !== Number(schoolId)) return false;
      if (search) {
        const q = search.toLowerCase();
        return String(b.dept.code).toLowerCase().includes(q) || String(b.dept.name).toLowerCase().includes(q);
      }
      return true;
    });

    if (!visible.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">💳</div><p>No departments.</p></div>';
      return;
    }

    visible.sort((a, b) => String(a.dept.code).localeCompare(String(b.dept.code)));

    grid.innerHTML = visible.map((b) => {
      const school = schoolMap.get(b.dept.schoolId);
      const hasPending = b.pending > 0;
      const totalStudents = students.filter((s) => s.departmentId === b.dept.id).length;
      const paidCount = b.studentIds.size;
      const rate = totalStudents ? Math.round((paidCount / totalStudents) * 100) : 0;

      return `
        <div class="pm-dept-card ${hasPending ? 'has-pending' : ''} ${paidCount === 0 ? 'empty' : ''}" ${paidCount === 0 ? '' : `data-dept-id="${b.dept.id}" data-dept-name="${escapeHtml(b.dept.name)}"`}>
          <div class="pmd-head">
            <span class="pmd-code">${escapeHtml(b.dept.code)}</span>
            <span class="pmd-school">${escapeHtml(school?.code || '')}</span>
          </div>
          <h3>${escapeHtml(b.dept.name)}</h3>
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
            <span>${paidCount === 0 ? 'No payments' : 'View payments'}</span>
            <span class="arrow">→</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.pm-dept-card[data-dept-id]').forEach((card) => {
      card.addEventListener('click', () => {
        FPU_ADMIN_SPA.navigateToWithQuery('payments-by-dept', { departmentId: Number(card.dataset.deptId), sessionId, name: card.dataset.deptName });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// CLEARANCES
// ============================================
async function loadClearanceDepartments() {
  const grid = document.getElementById('clr-dept-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading departments…</div>';

  const sessionId = (document.getElementById('clr-session') || {}).value || '';
  const schoolId = (document.getElementById('clr-school') || {}).value || '';
  const search = (document.getElementById('clr-search') || {}).value || '';

  try {
    const qs = new URLSearchParams();
    if (sessionId) qs.set('sessionId', sessionId);

    const [clrRes, deptsRes, studentsRes, schoolsRes] = await Promise.all([
      adminFetch(`/api/admin/clearances?${qs}`),
      adminFetch('/api/admin/departments'),
      adminFetch('/api/admin/students?limit=5000'),
      adminFetch('/api/admin/schools'),
    ]);

    const clearances = (await clrRes.json()).data || [];
    const depts = (await deptsRes.json()).data || [];
    const students = (await studentsRes.json()).data || [];
    const schools = (await schoolsRes.json()).data || [];

    const studentById = new Map(students.map((s) => [s.id, s]));
    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    const byDept = new Map();
    for (const d of depts) byDept.set(d.id, { dept: d, cleared: 0, pending: 0, rejected: 0, missing: 0, total: 0 });
    
    for (const s of students) {
      if (!s.departmentId) continue;
      const bucket = byDept.get(s.departmentId);
      if (!bucket) continue;
      bucket.total++;
    }

    for (const c of clearances) {
      const row = c.clearance || c;
      const stu = studentById.get(row.studentId) || c.student;
      if (!stu) continue;
      const bucket = byDept.get(stu.departmentId);
      if (!bucket) continue;
      if (row.status === 'cleared') bucket.cleared++;
      else if (row.status === 'pending') bucket.pending++;
      else if (row.status === 'rejected') bucket.rejected++;
    }

    // Missing = students without any clearance
    byDept.forEach((b) => {
      const total = clearances.filter((c) => {
        const stu = studentById.get((c.clearance || c).studentId);
        return stu && Number(stu.departmentId) === Number(b.dept.id);
      }).length;
      b.missing = Math.max(0, b.total - total);
    });

    let totalCleared = 0, totalPending = 0;
    byDept.forEach((b) => { totalCleared += b.cleared; totalPending += b.pending; });

    setText('clr-stat-depts', [...byDept.values()].filter((b) => b.total > 0).length);
    setText('clr-stat-cleared', totalCleared);
    setText('clr-stat-pending', totalPending);
    setText('clr-stat-rate', students.length ? Math.round((totalCleared / students.length) * 100) + '%' : '—');

    const visible = [...byDept.values()].filter((b) => {
      if (schoolId && Number(b.dept.schoolId) !== Number(schoolId)) return false;
      if (search) {
        const q = search.toLowerCase();
        return String(b.dept.code).toLowerCase().includes(q) || String(b.dept.name).toLowerCase().includes(q);
      }
      return true;
    });

    if (!visible.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">✅</div><p>No departments.</p></div>';
      return;
    }

    visible.sort((a, b) => String(a.dept.code).localeCompare(String(b.dept.code)));

    grid.innerHTML = visible.map((b) => {
      const rate = b.total ? Math.round((b.cleared / b.total) * 100) : 0;
      const cls = b.total === 0 ? 'empty' : rate >= 75 ? 'healthy' : rate >= 40 ? 'warning' : 'critical';
      const school = schoolMap.get(b.dept.schoolId);

      return `
        <div class="clr-dept-card ${cls}" ${b.total === 0 ? '' : `data-dept-id="${b.dept.id}" data-dept-name="${escapeHtml(b.dept.name)}"`}>
          <div class="cdc-head">
            <span class="cdc-code">${escapeHtml(b.dept.code)}</span>
            <span class="cdc-school">${escapeHtml(school?.code || '')}</span>
          </div>
          <h3>${escapeHtml(b.dept.name)}</h3>
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

    grid.querySelectorAll('.clr-dept-card[data-dept-id]').forEach((card) => {
      card.addEventListener('click', () => {
        FPU_ADMIN_SPA.navigateToWithQuery('clearances-by-dept', { departmentId: Number(card.dataset.deptId), sessionId, name: card.dataset.deptName });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// COMMUNICATION (Announcements, Notifications, Complaints)
// ============================================

async function loadAnnouncements() {
  const box = document.getElementById("announcements-list");
  const grid = document.getElementById("ann-list");
  const target = box || grid;
  if (!target) return;

  target.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading…</div>';

  try {
    const res = await adminFetch("/api/admin/announcements");
    const result = await res.json();
    const rows = extractArray(result);

    if (!rows.length) {
      target.innerHTML = '<p class="muted" style="padding:20px;">No announcements.</p>';
      return;
    }

    if (grid) {
      target.innerHTML = rows.map((r) => {
        const a = r.announcement || r;
        const priority = a.priority || 'normal';
        const isExpired = a.expiresAt && new Date(a.expiresAt).getTime() < Date.now();
        return `
          <div class="ann-card ${priority} ${a.isPublished === false ? 'unpublished' : ''}" onclick="FPU_ADMIN_SPA.navigateToWithQuery('announcement-detail', { id: ${a.id} })">
            <div class="anc-head">
              <div class="anc-badges">
                <span class="anc-badge priority-${priority}">${priority === 'high' ? '🔴 Urgent' : priority === 'low' ? '📝 General' : '📢 Normal'}</span>
                <span class="anc-badge audience">${escapeHtml(a.audience === 'all' ? 'Everyone' : a.audience || '')}</span>
                ${a.isPublished === false ? '<span class="anc-badge unpublished">Draft</span>' : ''}
                ${isExpired ? '<span class="anc-badge expired">Expired</span>' : ''}
              </div>
            </div>
            <h3>${escapeHtml(a.title || '')}</h3>
            <div class="body">${escapeHtml(a.body || '')}</div>
            <div class="anc-meta"><span>${fmtDateTime(a.publishedAt || a.createdAt)}</span><span>${a.authorId ? 'Admin #' + a.authorId : ''}</span></div>
            <div class="anc-actions">
              <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('announcement-form', { id: ${a.id} })">Edit</button>
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); FPU_ADMIN.deleteAnnouncement(${a.id})">Delete</button>
            </div>
          </div>`;
      }).join('');
    } else {
      target.innerHTML = rows.map((r) => {
        const a = r.announcement || r;
        const badgeCls = a.priority === 'high' ? 'danger' : a.priority === 'low' ? 'muted' : 'info';
        return `<article class="panel" style="margin-bottom:.75rem;"><div class="panel-body"><span class="badge badge-${badgeCls}">${escapeHtml(a.priority || 'normal')}</span><h3 style="margin:.4rem 0;">${escapeHtml(a.title || '')}</h3><p>${escapeHtml(a.body || '')}</p><p class="small muted">${fmtDateTime(a.publishedAt || a.createdAt)}</p></div></article>`;
      }).join('');
    }

    const total = rows.length;
    const urgent = rows.filter((r) => (r.announcement || r).priority === 'high').length;
    const published = rows.filter((r) => (r.announcement || r).isPublished !== false).length;
    const active = rows.filter((r) => { const a = r.announcement || r; return !a.expiresAt || new Date(a.expiresAt).getTime() > Date.now(); }).length;
    setText('ann-stat-total', total);
    setText('ann-stat-urgent', urgent);
    setText('ann-stat-published', published);
    setText('ann-stat-active', active);
  } catch (err) {
    target.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

async function deleteAnnouncement(id) {
  if (!confirm('Delete this announcement?')) return;
  try {
    await adminFetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    showToast('Deleted.', 'success');
    loadAnnouncements();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function loadNotifications() {
  const box = document.getElementById("notifications-list");
  const list = document.getElementById("nt-list");
  if (!box && !list) return;

  const target = list || box;
  target.innerHTML = list ? '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading…</div>' : '<div class="loading"><span class="spinner"></span> Loading…</div>';

  try {
    const res = await adminFetch("/api/admin/notifications");
    const result = await res.json();
    const rows = extractArray(result);

    if (!rows.length) { target.innerHTML = '<p class="muted" style="padding:20px;">No notifications.</p>'; return; }

    if (list) {
      target.innerHTML = rows.map((n) => `
        <div class="nt-item ${n.isRead ? '' : 'unread'}" onclick="FPU_ADMIN_SPA.navigateToWithQuery('notification-detail', { id: ${n.id} })">
          <div class="nt-icon ${escapeHtml(n.type || 'default')}">${n.type === 'warning' ? '⚠️' : n.type === 'success' ? '✅' : n.type === 'complaint' ? '📩' : n.type === 'fee' ? '💰' : 'ℹ️'}</div>
          <div class="nt-body">
            <div class="nt-title">${escapeHtml(n.title || '')}</div>
            <div class="nt-text">${escapeHtml(n.body || '')}</div>
            <div class="nt-meta"><span>${timeAgo(n.createdAt)}</span>${!n.isRead ? '<span class="unread-pill">Unread</span>' : ''}</div>
          </div>
          <div class="nt-actions">
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); FPU_ADMIN.markNotificationRead(${n.id})">Read</button>
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); FPU_ADMIN.deleteNotification(${n.id})">Delete</button>
          </div>
        </div>
      `).join('');

      const total = rows.length; const unread = rows.filter((n) => !n.isRead).length;
      const week = rows.filter((n) => new Date(n.createdAt).getTime() > Date.now() - 7 * 86400000).length;
      const high = rows.filter((n) => n.type === 'warning').length;
      setText('nt-stat-total', total); setText('nt-stat-unread', unread); setText('nt-stat-week', week); setText('nt-stat-high', high);
    } else {
      target.innerHTML = rows.map((n) => `
        <div class="session-item ${n.isRead ? '' : 'current'}"><div class="meta"><strong>${escapeHtml(n.title || '')}</strong>${escapeHtml(n.body || '')}</div><div class="small muted">${fmtDateTime(n.createdAt)}</div></div>
      `).join('');
    }
  } catch (err) { target.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`; }
}

async function markNotificationRead(id) {
  try { await adminFetch(`/api/admin/notifications/${id}/read`, { method: 'POST' }); showToast('Marked read.', 'success'); loadNotifications(); } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function deleteNotification(id) {
  if (!confirm('Delete this notification?')) return;
  try { await adminFetch(`/api/admin/notifications/${id}`, { method: 'DELETE' }); showToast('Deleted.', 'success'); loadNotifications(); } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function loadComplaints() {
  const container = document.getElementById("complaints-tbody");
  const tbody2 = document.getElementById("cmp-tbody");
  const target = container || tbody2;
  if (!target) return;

  const cols = target.id === 'cmp-tbody' ? 6 : 5;
  target.innerHTML = `<tr><td colspan="${cols}" class="empty">Loading…</td></tr>`;

  const status = (document.getElementById('cmp-status-tabs')?.querySelector('.active')?.dataset.status) || '';
  const category = (document.getElementById('cmp-filter-category') || {}).value || '';
  const search = (document.getElementById('cmp-search') || {}).value || '';
  const sort = (document.getElementById('cmp-filter-sort') || {}).value || 'newest';

  const qs = new URLSearchParams({ limit: 500 });
  if (status) qs.set('status', status);

  try {
    const res = await adminFetch(`/api/admin/complaints?${qs}`);
    const json = await res.json();
    let rows = json.data || [];

    if (category) rows = rows.filter((r) => (r.complaint || r).category === category);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => { const c = r.complaint || r; return String(c.subject || '').toLowerCase().includes(q) || String(c.body || '').toLowerCase().includes(q); });
    }
    if (sort === 'oldest') rows.sort((a, b) => new Date((a.complaint || a).createdAt) - new Date((b.complaint || b).createdAt));

    if (container) {
      container.innerHTML = rows.length ? rows.map((r) => {
        const c = r.complaint || r;
        return `<tr><td>${escapeHtml(c.subject || '')}</td><td>${r.user ? `${escapeHtml(r.user.firstName)} ${escapeHtml(r.user.lastName)}` : '—'}</td><td>${badge(c.status)}</td><td>${fmtDateTime(c.createdAt)}</td><td><div class="row-actions"><button class="btn btn-sm btn-outline" onclick="FPU_ADMIN_SPA.navigateToWithQuery('complaint-view', { id: ${c.id} })">View</button></div></td></tr>`;
      }).join('') : '<tr><td colspan="5" class="empty">No complaints.</td></tr>';
    } else {
      const now = Date.now();
      target.innerHTML = rows.length ? rows.map((r) => {
        const c = r.complaint || r;
        const ageDays = Math.floor((now - new Date(c.createdAt).getTime()) / 86400000);
        let ageCls = '';
        if (c.status === 'open' && ageDays >= 7) ageCls = 'sla-critical'; else if (c.status === 'open' && ageDays >= 3) ageCls = 'sla-warning';
        return `<tr><td>${escapeHtml(c.subject || '')}</td><td>${r.user ? `${escapeHtml(r.user.firstName)} ${escapeHtml(r.user.lastName)}` : '—'}</td><td>${escapeHtml(c.category || '—')}</td><td>${badge(c.status)}</td><td class="${ageCls}">${ageDays}d</td><td><button class="btn btn-sm btn-outline" onclick="FPU_ADMIN_SPA.navigateToWithQuery('complaint-view', { id: ${c.id} })">View</button></td></tr>`;
      }).join('') : `<tr><td colspan="6" class="empty">No complaints.</td></tr>`;

      const open = rows.filter((r) => (r.complaint || r).status === 'open').length;
      const inReview = rows.filter((r) => (r.complaint || r).status === 'in_review').length;
      const resolved = rows.filter((r) => (r.complaint || r).status === 'resolved').length;
      setText('cmp-stat-total', rows.length); setText('cmp-stat-open', open); setText('cmp-stat-in-review', inReview); setText('cmp-stat-resolved', resolved); setText('cmp-count', `Showing ${rows.length}`);
    }
  } catch (err) { target.innerHTML = `<tr><td colspan="${cols}" class="empty">${escapeHtml(err.message)}</td></tr>`; }
}

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

async function loadBorrowsTable() {
  const tbody = document.getElementById('bor-tbody');
  if (!tbody) return;

  const status = (document.getElementById('borrows-status-tabs')?.querySelector('.active')?.dataset.status) || '';
  const search = (document.getElementById('bor-search') || {}).value || '';
  const due = (document.getElementById('bor-due-filter') || {}).value || '';

  const qs = new URLSearchParams();
  if (status) qs.set('status', status);

  tbody.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/library/borrows?${qs}`);
    const json = await res.json();
    let rows = json.data || [];

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => { const user = r.user || {}; const book = r.book || {}; return String(user.firstName || '').toLowerCase().includes(q) || String(user.lastName || '').toLowerCase().includes(q) || String(user.matricNumber || '').toLowerCase().includes(q) || String(book.title || '').toLowerCase().includes(q); });
    }

    if (due) {
      const days = Number(due); const limit = Date.now() + days * 86400000;
      rows = rows.filter((r) => { const b = r.borrow || r; if (b.status !== 'borrowed') return false; return new Date(b.dueAt).getTime() <= limit; });
    }

    const total = rows.length; const active = rows.filter((r) => ['borrowed', 'overdue'].includes((r.borrow || r).status)).length;
    const overdue = rows.filter((r) => (r.borrow || r).status === 'overdue').length; const returned = rows.filter((r) => (r.borrow || r).status === 'returned').length;

    setText('bor-stat-total', total); setText('bor-stat-active', active); setText('bor-stat-overdue', overdue); setText('bor-stat-returned', returned); setText('bor-count', `Showing ${total}`);

    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No borrows.</td></tr>'; return; }

    tbody.innerHTML = rows.map((r) => {
      const b = r.borrow || r; const user = r.user || {}; const book = r.book || {};
      const overdue = b.status === 'overdue'; const due = new Date(b.dueAt); const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);
      const daysCls = b.status === 'returned' ? 'done' : overdue ? 'danger' : daysLeft <= 3 ? 'warning' : 'ok';
      const daysText = b.status === 'returned' ? 'Returned' : overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`;

      return `<tr class="${overdue ? 'borrow-row-overdue' : ''}"><td>${escapeHtml(book.title || '')}</td><td>${escapeHtml((user.firstName || '') + ' ' + (user.lastName || ''))}</td><td>${fmtDate(b.borrowedAt)}</td><td>${fmtDate(b.dueAt)}</td><td>${badge(b.status)}</td><td><span class="days-badge ${daysCls}">${daysText}</span></td><td><div class="row-actions">${b.status === 'borrowed' || b.status === 'overdue' ? `<button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.returnBorrow(${b.id})">Return</button><button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.markBorrowLost(${b.id})">Lost</button>` : ''}</div></td></tr>`;
    }).join('');
  } catch (err) { tbody.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`; }
}

// ============================================
// RECORDS (Documents, Graduation)
// ============================================

async function loadDocumentsTable() {
  const list = document.getElementById('doc-list');
  if (!list) return;

  list.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading documents…</div>';

  const status = (document.getElementById('doc-status-tabs')?.querySelector('.active')?.dataset.status) || '';
  const type = (document.getElementById('doc-filter-type') || {}).value || '';
  const search = (document.getElementById('doc-search') || {}).value || '';

  try {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (type) qs.set('type', type);

    const [docsRes, usersRes] = await Promise.all([
      adminFetch(`/api/admin/documents?${qs}`),
      adminFetch('/api/admin/user-list?limit=2000'),
    ]);

    const docs = (await docsRes.json()).data || [];
    const users = (await usersRes.json()).data || [];
    const userById = new Map(users.map((u) => [u.id, u]));

    let visible = docs;
    if (search) {
      const q = search.toLowerCase();
      visible = docs.filter((r) => {
        const d = r.document || r;
        const user = r.user || userById.get(d.userId);
        return (
          String(d.title || '').toLowerCase().includes(q) ||
          String(d.type || '').toLowerCase().includes(q) ||
          String(user?.firstName || '').toLowerCase().includes(q) ||
          String(user?.lastName || '').toLowerCase().includes(q) ||
          String(user?.matricNumber || '').toLowerCase().includes(q)
        );
      });
    }

    const total = visible.length;
    const pending = visible.filter((r) => (r.document || r).status === 'pending').length;
    const issued = visible.filter((r) => (r.document || r).status === 'issued').length;
    const month = visible.filter((r) => {
      const d = r.document || r;
      return new Date(d.requestedAt || d.createdAt).getTime() > Date.now() - 30 * 86400000;
    }).length;

    setText('doc-stat-total', total);
    setText('doc-stat-pending', pending);
    setText('doc-stat-issued', issued);
    setText('doc-stat-month', month);

    if (!visible.length) {
      list.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">📄</div><p>No documents match your filters.</p></div>';
      return;
    }

    list.innerHTML = visible.map((r) => {
      const d = r.document || r;
      const user = r.user || userById.get(d.userId) || {};
      const initials = ((user.firstName || ' ')[0] + (user.lastName || ' ')[0]).toUpperCase().trim() || 'U';
      return `
        <div class="doc-card ${d.status}" onclick="FPU_ADMIN_SPA.navigateToWithQuery('documents-detail', { id: ${d.id} })">
          <div class="dc-head">
            <span class="dc-type">${escapeHtml(String(d.type || '').replace(/-/g, ' '))}</span>
            <span class="dc-status ${d.status}">${escapeHtml(d.status)}</span>
          </div>
          <h3>${escapeHtml(d.title || '')}</h3>
          <div class="dc-student">
            <div class="dc-avatar">${user.photoUrl ? `<img src="${escapeHtml(user.photoUrl)}" alt="" />` : escapeHtml(initials)}</div>
            <div class="dc-student-info">
              <strong>${escapeHtml((user.firstName || '') + ' ' + (user.lastName || ''))}</strong>
              <span>${escapeHtml(user.matricNumber || user.email || '')}</span>
            </div>
          </div>
          <div class="dc-footer">
            <span>Requested ${fmtDate(d.requestedAt || d.createdAt)}</span>
            <span class="arrow">View →</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    list.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
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

// ============================================
// SYSTEM (Reports, Audit, Security, Settings)
// ============================================

async function loadReportsWithCharts() {
  try {
    const days = (document.getElementById('rep-range') || {}).value || 365;
    const qs = days === 'all' ? '' : `?days=${days}`;

    const res = await adminFetch(`/api/admin/reports/overview`);
    const json = await res.json();
    const d = json.data || json;

    setText('rep-stat-students', d.students || 0);
    setText('rep-stat-apps', d.totalApplications || 0);
    setText('rep-stat-revenue', money(d.totalRevenue || 0));
    setText('rep-stat-progs', d.totalProgrammes || 0);

    if (typeof Chart === 'undefined') return;

    const admissionRes = await adminFetch(`/api/admin/reports/admission-trend${qs}`);
    const admissionRows = (await admissionRes.json()).data || [];
    const chartA = document.getElementById('rep-chart-admission');
    if (chartA && admissionRows.length) {
      new Chart(chartA, { type: 'line', data: { labels: admissionRows.map((r) => r.month), datasets: [{ data: admissionRows.map((r) => r.count), borderColor: '#065f46', backgroundColor: 'rgba(6,95,70,.1)', tension: .4, fill: true, borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    }

    const revenueRes = await adminFetch(`/api/admin/reports/revenue-trend${qs}`);
    const revenueRows = (await revenueRes.json()).data || [];
    const chartR = document.getElementById('rep-chart-revenue');
    if (chartR && revenueRows.length) {
      new Chart(chartR, { type: 'line', data: { labels: revenueRows.map((r) => r.month), datasets: [{ data: revenueRows.map((r) => Number(r.total || 0)), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.15)', tension: .4, fill: true, borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    }

    const deptRes = await adminFetch('/api/admin/reports/enrollment-by-department');
    const deptRows = (await deptRes.json()).data || [];
    const chartD = document.getElementById('rep-chart-dept');
    if (chartD && deptRows.length) {
      new Chart(chartD, { type: 'bar', data: { labels: deptRows.slice(0, 10).map((r) => r.name), datasets: [{ data: deptRows.slice(0, 10).map((r) => r.count), backgroundColor: '#065f46', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    }

    const appRes = await adminFetch('/api/admin/reports/applications-by-status');
    const appRows = (await appRes.json()).data || [];
    const chartAp = document.getElementById('rep-chart-apps');
    if (chartAp && appRows.length) {
      const colorMap = { pending: '#f59e0b', under_review: '#3b82f6', approved: '#065f46', rejected: '#dc2626', registered: '#8b5cf6' };
      new Chart(chartAp, { type: 'doughnut', data: { labels: appRows.map((r) => (r.status || '').replace(/_/g, ' ')), datasets: [{ data: appRows.map((r) => r.count), backgroundColor: appRows.map((r) => colorMap[r.status] || '#64748b'), borderColor: '#fff', borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '62%' } });
    }

    const appsTbody = document.getElementById('rep-apps-tbody');
    if (appsTbody) {
      appsTbody.innerHTML = appRows.length ? appRows.map((r) => `<tr><td>${escapeHtml(r.status)}</td><td class="num">${r.count}</td></tr>`).join('') : '<tr><td colspan="2" class="empty">No data.</td></tr>';
    }

    const payRes = await adminFetch('/api/admin/reports/payments-by-status');
    const payRows = (await payRes.json()).data || [];
    const payTbody = document.getElementById('rep-pay-tbody');
    if (payTbody) {
      payTbody.innerHTML = payRows.length ? payRows.map((r) => `<tr><td>${escapeHtml(r.status)}</td><td class="num">${r.count}</td><td class="num">${money(r.total)}</td></tr>`).join('') : '<tr><td colspan="3" class="empty">No data.</td></tr>';
    }
  } catch (err) {
    console.debug('[reports]', err && err.message);
  }
}

async function loadAuditTable() {
  const container = document.getElementById('audit-tbody');
  if (!container) return;
  container.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';

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

    setText('audit-count', `Showing ${rows.length}`);

    container.innerHTML = rows.length ? rows.map((r) => {
      const log = r.log || r;
      return `
        <tr class="audit-row">
          <td><button class="btn btn-sm btn-ghost" data-toggle="${log.id}">▾</button></td>
          <td><code>${escapeHtml(log.action || '')}</code></td>
          <td>${r.user ? `${escapeHtml(r.user.firstName)} ${escapeHtml(r.user.lastName)}` : '—'}</td>
          <td>${escapeHtml(log.entity || '')}</td>
          <td>${escapeHtml(log.entityId || '')}</td>
          <td>${escapeHtml(log.ipAddress || '')}</td>
          <td class="small muted">${fmtDateTime(log.createdAt)}</td>
        </tr>
        <tr class="audit-detail-row" data-detail="${log.id}">
          <td colspan="7" class="audit-detail">
            ${log.before ? `<strong>Before:</strong> ${escapeHtml(JSON.stringify(log.before, null, 2))}<br/><br/>` : ''}
            ${log.after ? `<strong>After:</strong> ${escapeHtml(JSON.stringify(log.after, null, 2))}` : ''}
            ${!log.before && !log.after ? '<em>No payload recorded.</em>' : ''}
          </td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="7" class="empty">No audit entries.</td></tr>';

    container.querySelectorAll('[data-toggle]').forEach((b) => {
      b.onclick = () => {
        const row = container.querySelector(`[data-detail="${b.dataset.toggle}"]`);
        if (row) row.classList.toggle('open');
      };
    });
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadSecurityDashboard() {
  var summaryRes = null, eventsRes = null, loginsRes = null;
  try { summaryRes = await adminFetch("/api/admin/security/summary"); } catch (e) { console.debug("[sd] summary", e.message); }
  try { eventsRes = await adminFetch("/api/admin/security?limit=100"); } catch (e) { console.debug("[sd] events", e.message); }
  try { loginsRes = await adminFetch("/api/admin/login-history?limit=100&success=false"); } catch (e) { console.debug("[sd] logins", e.message); }

  var summaryRows = [], eventRows = [], failedRows = [];
  try { if (summaryRes) summaryRows = (await summaryRes.json()).data || []; } catch (e) {}
  try { if (eventsRes) eventRows = (await eventsRes.json()).data || []; } catch (e) {}
  try { if (loginsRes) failedRows = (await loginsRes.json()).data || []; } catch (e) {}

  var critical = 0, warning = 0, info = 0;
  summaryRows.forEach(function (r) {
    if (r.severity === "critical") critical = r.c || 0;
    else if (r.severity === "warning") warning = r.c || 0;
    else if (r.severity === "info") info = r.c || 0;
  });

  setText("sec-kpi-sessions", 0);
  setText("sec-kpi-failed", failedRows.length);
  setText("sec-kpi-locked", 0);
  setText("sec-kpi-blocked", 0);

  var banner = document.getElementById("sec-threat-banner");
  if (banner) {
    var score = critical * 10 + warning * 3 + info;
    var level = critical > 0 ? "high" : warning > 5 ? "medium" : "low";
    banner.className = "sec-threat-banner " + level;
    var issues = "";
    if (failedRows.length > 5) issues += "<span>" + failedRows.length + " failed logins recently</span>";
    if (critical > 0) issues += "<span>" + critical + " critical security event(s)</span>";
    banner.innerHTML = '<div class="stb-score ' + level + '">' + Math.min(100, score) + '</div><div class="stb-info"><h3>Threat Level: ' + level.toUpperCase() + '</h3><p>' + critical + ' critical &middot; ' + warning + ' warning &middot; ' + info + ' info events</p><div class="stb-issues">' + issues + '</div></div>';
  }

  setText("sac-events-badge", eventRows.length);
  setText("sac-sessions-badge", "—");

  var recent = eventRows.filter(function (r) { return (r.log || r).severity === "critical"; }).slice(0, 10);
  var tbody = document.getElementById("sec-recent-events");
  if (tbody) {
    if (!recent.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No critical events.</td></tr>';
    } else {
      tbody.innerHTML = recent.map(function (r) {
        var log = r.log || r;
        var user = r.user ? escapeHtml(r.user.firstName) + " " + escapeHtml(r.user.lastName) : "—";
        return '<tr><td>' + escapeHtml(log.event || "") + '</td><td>' + badge(log.severity) + '</td><td>' + user + '</td><td>' + escapeHtml(log.ipAddress || "") + '</td><td class="small muted">' + fmtDateTime(log.createdAt) + '</td></tr>';
      }).join("");
    }
  }
}

async function loadSettingsShell() {
  const content = document.getElementById('settings-tab-content');
  if (!content) return;

  const tabs = document.querySelectorAll('#settings-tabs .staff-role-tab');
  async function loadTab(tab) {
    content.innerHTML = '<div class="loading"><span class="spinner"></span> Loading…</div>';
    try {
      const res = await fetch(`/admin/partials/settings/_tabs/${tab}.html`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Partial ${tab} not found`);
      const html = await res.text();
      content.innerHTML = html;
      if (window.FPU_EXECUTE_PARTIAL_SCRIPTS) {
        window.FPU_EXECUTE_PARTIAL_SCRIPTS(content);
      } else {
        content.querySelectorAll('script').forEach((old) => {
          const s = document.createElement('script');
          s.textContent = old.textContent;
          old.replaceWith(s);
        });
      }
      prefillSettingsForm(tab, content);
    } catch (err) {
      content.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
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
    const [allRes, loginRes] = await Promise.all([
      adminFetch('/api/admin/user-list?limit=2000'),
      adminFetch('/api/admin/login-history?limit=100'),
    ]);
    const users = (await allRes.json()).data || [];
    const logins = (await loginRes.json()).data || [];

    const students = users.filter((u) => u.role === 'student').length;
    const admins   = users.filter((u) => u.role === 'admin').length;
    const staff    = users.length - students - admins;

    setText('us-stat-total', users.length);
    setText('us-stat-students', students);
    setText('us-stat-staff', staff);
    setText('us-stat-admins', admins);
    setText('ujc-admins-count', admins + ' accounts');
    setText('ujc-logins-count', logins.length + ' recent');

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
// USER PROFILE (Detail View)
// ============================================
async function loadUserProfile() {
  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const id = params.get('id');

  if (!id) {
    document.getElementById('page-subtitle').textContent = 'No user ID provided.';
    return;
  }

  try {
    // Try to find the user in the combined list (staff + students)
    const [staffRes, studentRes] = await Promise.all([
      adminFetch('/api/admin/staff?limit=2000').catch(() => null),
      adminFetch('/api/admin/students?limit=2000').catch(() => null),
    ]);

    let user = null;

    if (staffRes && staffRes.ok) {
      const staffJson = await staffRes.json();
      const staff = staffJson.data || [];
      user = staff.find((u) => Number(u.id) === Number(id));
    }

    if (!user && studentRes && studentRes.ok) {
      const studentJson = await studentRes.json();
      const students = studentJson.data || [];
      user = students.find((u) => Number(u.id) === Number(id));
    }

    // If not found, try the admin users endpoint
    if (!user) {
      const adminRes = await adminFetch('/api/admin/users?limit=1000').catch(() => null);
      if (adminRes && adminRes.ok) {
        const adminJson = await adminRes.json();
        const admins = adminJson.data || [];
        user = admins.find((u) => Number(u.id) === Number(id));
      }
    }

    if (!user) throw new Error('User not found');

    // ----- 1. Update Header -----
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User';
    document.getElementById('page-subtitle').textContent = `${user.email || ''} · ${String(user.role || '').replace(/_/g, ' ')}`;
    document.getElementById('up-name').textContent = fullName;
    document.getElementById('up-role').innerHTML = roleBadge(user.role);

    const avatarEl = document.getElementById('up-avatar');
    if (avatarEl) {
      const initials = ((user.firstName || ' ')[0] + (user.lastName || ' ')[0]).toUpperCase().trim() || 'U';
      if (user.photoUrl) {
        avatarEl.innerHTML = `<img src="${escapeHtml(user.photoUrl)}" alt="" />`;
      } else {
        avatarEl.textContent = initials;
      }
    }

    // ----- 2. Contact Panel -----
    const contactEl = document.getElementById('up-contact');
    if (contactEl) {
      contactEl.innerHTML = `
        <div class="field-row"><div class="k">Email</div><div class="v">${escapeHtml(user.email || '—')}</div></div>
        <div class="field-row"><div class="k">Phone</div><div class="v">${escapeHtml(user.phone || '—')}</div></div>
        <div class="field-row"><div class="k">Gender</div><div class="v">${escapeHtml(user.gender || '—')}</div></div>
        <div class="field-row"><div class="k">Date of Birth</div><div class="v">${user.dateOfBirth ? fmtDate(user.dateOfBirth) : '—'}</div></div>
        <div class="field-row"><div class="k">State of Origin</div><div class="v">${escapeHtml(user.stateOfOrigin || '—')}</div></div>
      `;
    }

    // ----- 3. Account Panel -----
    const accountEl = document.getElementById('up-account');
    if (accountEl) {
      accountEl.innerHTML = `
        <div class="field-row"><div class="k">Role</div><div class="v">${roleBadge(user.role)}</div></div>
        <div class="field-row"><div class="k">Status</div><div class="v">${user.isActive !== false ? badge('active') : badge('inactive')}</div></div>
        <div class="field-row"><div class="k">Created</div><div class="v">${fmtDate(user.createdAt)}</div></div>
        <div class="field-row"><div class="k">Last Login</div><div class="v">${user.lastLoginAt ? fmtDateTime(user.lastLoginAt) : 'Never'}</div></div>
      `;
    }

    // ----- 4. Role Details Panel -----
    const roleEl = document.getElementById('up-role-details');
    if (roleEl) {
      let roleHtml = '';
      if (user.role === 'student') {
        roleHtml = `
          <div class="field-row"><div class="k">Matric No</div><div class="v"><code>${escapeHtml(user.matricNumber || '—')}</code></div></div>
          <div class="field-row"><div class="k">Level</div><div class="v">${escapeHtml(user.level || '—')}</div></div>
          <div class="field-row"><div class="k">Department</div><div class="v">${escapeHtml(user.departmentName || user.department?.name || '—')}</div></div>
          <div class="field-row"><div class="k">Programme</div><div class="v">${escapeHtml(user.programmeName || user.programme?.name || '—')}</div></div>
        `;
      } else if (user.role === 'admin') {
        roleHtml = `<p class="muted">No additional profile fields for administrators.</p>`;
      } else {
        const sp = user.staffProfile || {};
        roleHtml = `
          <div class="field-row"><div class="k">Staff No</div><div class="v"><code>${escapeHtml(user.staffNumber || '—')}</code></div></div>
          <div class="field-row"><div class="k">Department</div><div class="v">${escapeHtml(user.departmentName || user.department?.name || '—')}</div></div>
          <div class="field-row"><div class="k">Rank</div><div class="v">${escapeHtml(sp.rank || '—')}</div></div>
          <div class="field-row"><div class="k">Specialization</div><div class="v">${escapeHtml(sp.specialization || '—')}</div></div>
        `;
      }
      roleEl.innerHTML = roleHtml;
    }

    // ----- 5. Recent Activity Panel -----
    const activityEl = document.getElementById('up-activity');
    if (activityEl) {
      try {
        const auditRes = await adminFetch(`/api/admin/audit?userId=${id}&limit=5`);
        const auditJson = await auditRes.json();
        const logs = auditJson.data || [];
        if (!logs.length) {
          activityEl.innerHTML = '<p class="muted" style="padding:10px;">No recent activity.</p>';
        } else {
          activityEl.innerHTML = logs.map((l) => {
            const log = l.log || l;
            return `
              <div class="activity-item" style="padding:8px 0; border-bottom:1px solid #f1f5f9;">
                <div style="font-size:13px;"><strong>${escapeHtml(log.action || '')}</strong></div>
                <div class="small muted">${escapeHtml(log.entity || '')} · ${timeAgo(log.createdAt)}</div>
              </div>
            `;
          }).join('');
        }
      } catch (e) {
        activityEl.innerHTML = '<p class="muted" style="padding:10px;">Could not load activity.</p>';
      }
    }

    // ----- 6. Wire Action Buttons -----
    document.getElementById('up-back').onclick = () => history.back();
    document.getElementById('up-edit').onclick = () => FPU_ADMIN_SPA.navigateToWithQuery('user-form', { id });
    document.getElementById('up-reset-pwd').onclick = async () => {
      const pwd = prompt('New password (leave blank for default "student1234" or "admin1234"):', '');
      if (pwd === null) return;
      try {
        await adminFetch(`/api/admin/users/${id}/reset-password`, {
          method: 'POST',
          body: JSON.stringify({ password: pwd || undefined }),
        });
        showToast('Password reset.', 'success');
      } catch (err) { showToast('❌ ' + err.message, 'error'); }
    };
    document.getElementById('up-toggle-active').onclick = async () => {
      try {
        await adminFetch(`/api/admin/users/${id}/toggle-active`, { method: 'POST' });
        showToast('Status toggled.', 'success');
        loadUserProfile();
      } catch (err) { showToast('❌ ' + err.message, 'error'); }
    };
    document.getElementById('up-delete').onclick = async () => {
      if (!confirm(`Delete user "${fullName}"?`)) return;
      try {
        const role = user.role;
        let url = `/api/admin/users/${id}`;
        if (role === 'student') url = `/api/admin/students/${id}`;
        else if (role !== 'admin') url = `/api/admin/staff/${id}`;

        await adminFetch(url, { method: 'DELETE' });
        showToast('User deleted.', 'success');
        FPU_ADMIN_SPA.navigateTo('users-all');
      } catch (err) { showToast('❌ ' + err.message, 'error'); }
    };

  } catch (err) {
    document.getElementById('page-subtitle').textContent = 'Error loading profile';
    const contactEl = document.getElementById('up-contact');
    if (contactEl) {
      contactEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
    const accountEl = document.getElementById('up-account');
    if (accountEl) accountEl.innerHTML = '';
    const roleEl = document.getElementById('up-role-details');
    if (roleEl) roleEl.innerHTML = '';
    const activityEl = document.getElementById('up-activity');
    if (activityEl) activityEl.innerHTML = '';
  }
}

// ============================================
// EXPORTS
// ============================================
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
  loadRegistrationStudents,

  // Results
  loadResultDepartments,

  // Grade Scales
  loadGradeScales, openEditGradeScale, toggleGradeScale, deleteGradeScale,

  // Transcript
  loadTranscriptLookup,

  // Timetable
  loadTimetableIndex, 
  
  // Exams
  loadExamsIndex,

  // Attendance
  loadAttendanceDepartments,

  // Staff, HODs, Lecturers
  loadStaffDirectory, loadHodBoard, loadLecturerGrid, assignHodDept,

  // Fees, Payments, Clearances
  loadFeeDepartments, loadPaymentDepartments, loadClearanceDepartments,
  
  // Communication
  loadAnnouncements, deleteAnnouncement, loadNotifications, markNotificationRead, deleteNotification, loadComplaints,
  
  // Library
  loadBooksGrid, loadBorrowsTable,

  // Records & System
  loadDocumentsTable, loadGraduationsTable, loadReportsWithCharts, loadAuditTable, loadSecurityDashboard, loadSettingsShell, prefillSettingsForm,

  // Users
  loadUsersHub, loadAllUsers, loadAdminAccounts, resetAdminPwd, toggleAdminActive, loadLoginHistory, loadUserProfile,
  
  // Courses
  loadCourseDepartments, loadDepartmentCourses, inferCourseYear
};