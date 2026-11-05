// ============================================
// FPU ADMIN.JS — Federal Polytechnic Ugep
// Complete consolidated version (v12)
// Fixed: Results, Department drill-downs, Result Detail, Registrations
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

async function loadCourseRegistrations() {
  const root = document.getElementById('reg-course-root');
  if (!root) return;

  root.innerHTML = '<div class="loading"><span class="spinner"></span> Loading roster…</div>';

  const sessionId = (document.getElementById('reg-course-session') || {}).value || '';
  const semester = (document.getElementById('reg-course-semester') || {}).value || '';
  const deptId = (document.getElementById('reg-course-dept') || {}).value || '';
  const courseId = (document.getElementById('reg-course-course') || {}).value || '';
  const status = (document.getElementById('reg-course-status') || {}).value || '';

  const qs = new URLSearchParams({ limit: 2000 });
  if (sessionId) qs.set('sessionId', sessionId);
  if (semester) qs.set('semester', semester);
  if (courseId) qs.set('courseId', courseId);
  if (status) qs.set('status', status);

  try {
    const res = await adminFetch(`/api/admin/registrations/with-student?${qs}`);
    const json = await res.json();
    let rows = json.data || [];

    if (deptId) {
      rows = rows.filter((r) => Number(r.course?.departmentId) === Number(deptId));
    }

    // Group by course
    const byCourse = new Map();
    for (const r of rows) {
      const c = r.course || {};
      const key = c.id || 0;
      if (!byCourse.has(key)) byCourse.set(key, { course: c, rows: [] });
      byCourse.get(key).rows.push(r);
    }

    let totalPending = 0, totalApproved = 0;
    rows.forEach((r) => {
      if (r.registration.status === 'pending') totalPending++;
      else if (r.registration.status === 'approved') totalApproved++;
    });

    setText('reg-crs-stat-courses', byCourse.size);
    setText('reg-crs-stat-rows', rows.length);
    setText('reg-crs-stat-pending', totalPending);
    setText('reg-crs-stat-approved', totalApproved);

    if (!byCourse.size) {
      root.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>No registrations match your filters.</p></div>';
      return;
    }

    root.innerHTML = [...byCourse.values()].map(({ course, rows: list }) => {
      const units = list
        .filter((r) => ['pending','approved'].includes(r.registration.status))
        .reduce((s, r) => s + (Number(course.unit) || 0), 0);
      const pending = list.filter((r) => r.registration.status === 'pending').length;

      return `
        <div class="roster-course">
          <div class="roster-course-head">
            <div>
              <span class="code">${escapeHtml(course.code || '')}</span>
              <span class="title">${escapeHtml(course.title || '')}</span>
              <div class="meta">${list.length} students · <strong>${units}</strong> credit units${pending ? ` · ${pending} pending` : ''}</div>
            </div>
            ${pending > 0 ? `
              <button class="btn btn-sm btn-accent"
                onclick="FPU_ADMIN.approveAllPendingCourse(${course.id})">
                Approve All Pending
              </button>
            ` : ''}
          </div>
          <div class="table-wrap">
            <table class="table-admin">
              <thead>
                <tr>
                  <th>Matric</th>
                  <th>Student</th>
                  <th>Semester</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${list.map((r) => {
                  const s = r.student || {};
                  const reg = r.registration || {};
                  return `
                    <tr>
                      <td><code>${escapeHtml(s.matricNumber || '')}</code></td>
                      <td>${escapeHtml((s.firstName || '') + ' ' + (s.lastName || ''))}</td>
                      <td>${escapeHtml(reg.semester || '')}</td>
                      <td>${badge(reg.status)}</td>
                      <td>
                        ${reg.status === 'pending' ? `
                          <div class="row-actions">
                            <button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.approveRegistration(${reg.id})">Approve</button>
                            <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.rejectRegistration(${reg.id})">Reject</button>
                          </div>
                        ` : '—'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    root.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

async function approveAllPendingCourse(courseId) {
  if (!confirm('Approve all pending registrations for this course?')) return;
  try {
    const res = await adminFetch(`/api/admin/registrations?courseId=${courseId}&status=pending&limit=500`);
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) { showToast('No pending registrations.', 'info'); return; }

    let ok = 0, failed = 0;
    for (const r of rows) {
      try {
        await adminFetch(`/api/admin/registrations/${r.id}/approve`, { method: 'POST' });
        ok++;
      } catch { failed++; }
    }
    showToast(`✅ Approved ${ok}${failed ? `, ${failed} failed` : ''}.`);
    loadCourseRegistrations();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

async function loadStudentRegistrations() {
  const groups = document.getElementById('reg-stu-groups');
  if (!groups) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const studentId = params.get('studentId') || '';

  if (!studentId) {
    groups.innerHTML = '<div class="alert alert-warning">No student selected.</div>';
    return;
  }

  groups.innerHTML = '<div class="loading"><span class="spinner"></span> Loading registrations…</div>';

  try {
    const [regsRes, stuRes] = await Promise.all([
      adminFetch(`/api/admin/registrations/with-course?studentId=${studentId}&limit=500`),
      adminFetch(`/api/admin/students/${studentId}`),
    ]);

    const regs = (await regsRes.json()).data || [];
    const student = (await stuRes.json()).data || {};

    const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
    const initials = ((student.firstName || ' ')[0] + (student.lastName || ' ')[0]).toUpperCase().trim() || 'S';

    const summaryPanel = document.getElementById('reg-stu-summary-panel');
    if (summaryPanel) summaryPanel.style.display = 'block';

    const avatar = document.getElementById('reg-stu-avatar');
    if (avatar) {
      avatar.textContent = initials;
      if (student.photoUrl) {
        avatar.innerHTML = `<img src="${escapeHtml(student.photoUrl)}" alt="" />`;
      }
    }
    setText('reg-stu-name', fullName || '—');
    setText('reg-stu-email', student.email || '—');
    setText('reg-stu-meta', `Matric: ${student.matricNumber || '—'} · Level: ${student.level || '—'}`);

    const titleEl = document.getElementById('reg-stu-title');
    const subEl = document.getElementById('reg-stu-subtitle');
    if (titleEl) titleEl.textContent = fullName || 'Student Registrations';
    if (subEl) subEl.textContent = `${student.matricNumber || '—'} · ${regs.length} registration(s)`;

    // Group by semester
    const bySem = new Map();
    for (const r of regs) {
      const reg = r.registration || {};
      const key = `${reg.sessionId || '?'}|${reg.semester || '?'}`;
      if (!bySem.has(key)) bySem.set(key, { sessionId: reg.sessionId, semester: reg.semester, rows: [] });
      bySem.get(key).rows.push(r);
    }

    let totalUnits = 0;
    regs.forEach((r) => {
      if (['pending','approved'].includes(r.registration.status)) {
        totalUnits += Number(r.course?.unit) || 0;
      }
    });
    setText('reg-stu-total-units', totalUnits);

    if (!bySem.size) {
      groups.innerHTML = '<div class="empty-state"><div class="icon">📝</div><p>No registrations.</p></div>';
      return;
    }

    groups.innerHTML = [...bySem.values()].map(({ sessionId, semester, rows }) => {
      const units = rows
        .filter((r) => ['pending','approved'].includes(r.registration.status))
        .reduce((s, r) => s + (Number(r.course?.unit) || 0), 0);

      return `
        <div class="sem-group">
          <div class="sem-group-head">
            <div>
              <span class="title">Session ${sessionId} — ${escapeHtml(semester)} Semester</span>
              <div class="subtitle">${rows.length} course${rows.length === 1 ? '' : 's'}</div>
            </div>
            <div class="sem-group-units">
              <span class="num">${units}</span>
              <span class="lbl">units</span>
            </div>
          </div>
          <div class="table-wrap">
            <table class="table-admin">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Unit</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((r) => {
                  const c = r.course || {};
                  const reg = r.registration || {};
                  return `
                    <tr>
                      <td><code>${escapeHtml(c.code || '')}</code></td>
                      <td>${escapeHtml(c.title || '')}</td>
                      <td class="num">${Number(c.unit) || 0}</td>
                      <td>${badge(reg.status)}</td>
                      <td>
                        ${reg.status === 'pending' ? `
                          <div class="row-actions">
                            <button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.approveRegistration(${reg.id})">Approve</button>
                            <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.rejectRegistration(${reg.id})">Reject</button>
                          </div>
                        ` : '—'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    // Bulk approve
    const bulkBtn = document.getElementById('reg-stu-bulk-approve');
    if (bulkBtn) {
      bulkBtn.onclick = async () => {
        const pending = regs.filter((r) => r.registration.status === 'pending').map((r) => r.registration.id);
        if (!pending.length) { showToast('No pending registrations.', 'info'); return; }
        if (!confirm(`Approve ${pending.length} pending registration(s)?`)) return;
        let ok = 0, failed = 0;
        for (const id of pending) {
          try {
            await adminFetch(`/api/admin/registrations/${id}/approve`, { method: 'POST' });
            ok++;
          } catch { failed++; }
        }
        showToast(`✅ Approved ${ok}${failed ? `, ${failed} failed` : ''}.`);
        loadStudentRegistrations();
      };
    }
  } catch (err) {
    groups.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// RESULTS (Department Overview)
// ============================================
async function loadResultDepartments() {
  const grid = document.getElementById('res-dept-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading results…</div>';

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

    // Group results by department
    const byDept = new Map();
    for (const d of depts) {
      byDept.set(d.id, { dept: d, pending: 0, approved: 0, published: 0, rejected: 0, total: 0 });
    }

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

    // Overall stats
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

    // Filter and render
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

  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

async function loadDepartmentResults() {
  const root = document.getElementById('rd-root');
  if (!root) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const departmentId = params.get('departmentId') || '';
  const deptName = params.get('name') || 'Department';

  const titleEl = document.getElementById('res-dept-title');
  const subEl = document.getElementById('res-dept-subtitle');
  if (titleEl) titleEl.textContent = deptName;
  if (subEl) subEl.textContent = `Results for ${deptName}`;

  if (!departmentId) {
    root.innerHTML = '<div class="alert alert-warning">No department selected.</div>';
    return;
  }

  root.innerHTML = '<div class="loading"><span class="spinner"></span> Loading results…</div>';

  const status = (document.getElementById('rd-filter-status') || {}).value || 'hod_verified';
  const semester = (document.getElementById('rd-filter-semester') || {}).value || '';
  const search = (document.getElementById('rd-filter-search') || {}).value || '';

  const qs = new URLSearchParams({ limit: 2000 });
  if (status) qs.set('status', status);
  if (semester) qs.set('semester', semester);

  try {
    const [resultsRes, coursesRes, studentsRes] = await Promise.all([
      adminFetch(`/api/admin/results/with-student?${qs}`),
      adminFetch('/api/admin/courses?limit=2000'),
      adminFetch('/api/admin/students?limit=5000'),
    ]);

    let rows = (await resultsRes.json()).data || [];
    const courses = (await coursesRes.json()).data || [];
    const courseById = new Map(courses.map((c) => [c.id, c]));

    // Filter to dept
    rows = rows.filter((r) => {
      const c = courseById.get(r.result?.courseId || r.courseId);
      return c && Number(c.departmentId) === Number(departmentId);
    });

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => {
        const s = r.student || {};
        const c = courseById.get(r.result?.courseId || r.courseId) || {};
        return (
          String(s.matricNumber || '').toLowerCase().includes(q) ||
          String(s.firstName || '').toLowerCase().includes(q) ||
          String(s.lastName || '').toLowerCase().includes(q) ||
          String(c.code || '').toLowerCase().includes(q) ||
          String(c.title || '').toLowerCase().includes(q)
        );
      });
    }

    let totalPending = 0, totalApproved = 0, totalPublished = 0;
    rows.forEach((r) => {
      const st = r.result?.status || r.status;
      if (st === 'hod_verified') totalPending++;
      else if (st === 'approved') totalApproved++;
      else if (st === 'published') totalPublished++;
    });

    setText('rd-stat-total', rows.length);
    setText('rd-stat-pending', totalPending);
    setText('rd-stat-approved', totalApproved);
    setText('rd-stat-published', totalPublished);

    // Group by course
    const byCourse = new Map();
    for (const r of rows) {
      const res = r.result || r;
      const key = res.courseId;
      if (!byCourse.has(key)) byCourse.set(key, { courseId: key, rows: [] });
      byCourse.get(key).rows.push(r);
    }

    if (!byCourse.size) {
      root.innerHTML = '<div class="empty-state"><div class="icon">📊</div><p>No results match your filters.</p></div>';
      return;
    }

    root.innerHTML = [...byCourse.values()].map(({ courseId, rows: list }) => {
      const c = courseById.get(courseId) || {};
      const units = Number(c.unit) || 0;
      const pending = list.filter((r) => (r.result?.status || r.status) === 'hod_verified').length;
      const approved = list.filter((r) => (r.result?.status || r.status) === 'approved').length;

      return `
        <div class="res-course-group">
          <div class="res-course-head">
            <div>
              <span class="code">${escapeHtml(c.code || '')}</span>
              <span class="title">${escapeHtml(c.title || '')}</span>
              <div class="meta">
                ${list.length} student${list.length === 1 ? '' : 's'} · <strong>${units}</strong> credit units
                ${pending ? ` · ${pending} awaiting` : ''}
                ${approved ? ` · ${approved} approved` : ''}
              </div>
            </div>
            <div class="head-actions">
              ${pending ? `<button class="btn btn-sm btn-approve" onclick="FPU_ADMIN.bulkApproveCourseResults(${courseId})">✓ Approve All (${pending})</button>` : ''}
              ${approved ? `<button class="btn btn-sm btn-publish" onclick="FPU_ADMIN.bulkPublishCourseResults(${courseId})">📢 Publish (${approved})</button>` : ''}
            </div>
          </div>
          <div class="table-wrap">
            <table class="table-admin">
              <thead>
                <tr>
                  <th style="width:32px;"><input type="checkbox" class="rd-course-check" data-course="${courseId}" /></th>
                  <th>Matric</th>
                  <th>Student</th>
                  <th>Score</th>
                  <th>Grade</th>
                  <th>Status</th>
                  <th style="width:200px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${list.map((r) => {
                  const res = r.result || r;
                  const s = r.student || {};
                  const st = res.status;
                  const rowClass = st === 'published' ? 'row-published' : (st && st.includes('rejected')) ? 'row-rejected' : '';
                  return `
                    <tr class="${rowClass}">
                      <td><input type="checkbox" class="rd-check" data-id="${res.id}" onclick="event.stopPropagation()" /></td>
                      <td><code>${escapeHtml(s.matricNumber || '')}</code></td>
                      <td>${escapeHtml((s.firstName || '') + ' ' + (s.lastName || ''))}</td>
                      <td class="num"><span class="res-score">${res.score}</span></td>
                      <td>${res.grade ? `<span class="grade ${escapeHtml(res.grade)}">${escapeHtml(res.grade)}</span>` : '—'}</td>
                      <td>${badge(st)}</td>
                      <td>
                        <div class="row-actions">
                          ${st === 'hod_verified' ? `
                            <button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.approveResult(${res.id})">Approve</button>
                            <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.rejectResult(${res.id})">Reject</button>
                          ` : ''}
                          ${st === 'approved' ? `
                            <button class="btn btn-sm btn-accent" onclick="FPU_ADMIN.publishResult(${res.id})">Publish</button>
                          ` : ''}
                          <button class="btn btn-sm btn-outline" onclick="FPU_ADMIN_SPA.navigateToWithQuery('result-edit', { id: ${res.id} })">Edit</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    // select-all bar
    const selectAll = document.getElementById('rd-select-all');
    if (selectAll) {
      selectAll.onchange = () => {
        root.querySelectorAll('.rd-check').forEach((cb) => { cb.checked = selectAll.checked; });
      };
    }
  } catch (err) {
    root.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// RESULT DETAIL VIEW
// ============================================
async function loadResultDetail() {
  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const id = params.get('id');

  if (!id) {
    const sub = document.getElementById('res-detail-subtitle');
    if (sub) sub.textContent = 'No result ID provided.';
    return;
  }

  try {
    const res = await adminFetch(`/api/admin/results/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    const r = json.data;
    
    // Fetch related student and course info
    const [stuRes, courseRes] = await Promise.all([
      adminFetch(`/api/admin/students/${r.studentId}`),
      adminFetch(`/api/admin/courses/${r.courseId}`)
    ]);
    
    const stu = (await stuRes.json()).data || {};
    const course = (await courseRes.json()).data || {};

    const sub = document.getElementById('res-detail-subtitle');
    if (sub) sub.textContent = `${stu.matricNumber || '—'} · ${course.code || '—'}`;

    // 1. Student Panel
    const studentPanel = document.getElementById('res-detail-student');
    if (studentPanel) {
      const initials = ((stu.firstName || ' ')[0] + (stu.lastName || ' ')[0]).toUpperCase().trim() || 'S';
      const avatar = stu.photoUrl ? `<img src="${escapeHtml(stu.photoUrl)}" alt="" />` : escapeHtml(initials);
      studentPanel.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px;">
          <div style="width:64px; height:64px; border-radius:50%; background:#065f46; color:#fff; display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:bold; overflow:hidden;">
            ${avatar}
          </div>
          <div>
            <h4 style="margin:0 0 4px 0; font-size:16px;">${escapeHtml((stu.firstName || '') + ' ' + (stu.lastName || ''))}</h4>
            <div class="small muted">${escapeHtml(stu.level || '')} · ${escapeHtml(stu.programmeName || stu.programme?.name || '—')}</div>
          </div>
        </div>
      `;
    }

    // 2. Course Panel
    const coursePanel = document.getElementById('res-detail-course');
    if (coursePanel) {
      coursePanel.innerHTML = `
        <div class="field-row"><div class="k">Code</div><div class="v"><code>${escapeHtml(course.code || '')}</code></div></div>
        <div class="field-row"><div class="k">Title</div><div class="v">${escapeHtml(course.title || '')}</div></div>
        <div class="field-row"><div class="k">Credit Units</div><div class="v">${Number(course.unit) || 0}</div></div>
        <div class="field-row"><div class="k">Level</div><div class="v">${badge(course.level)}</div></div>
      `;
    }

    // 3. Score & Grade Panel
    const scorePanel = document.getElementById('res-detail-score');
    if (scorePanel) {
      const isFail = String(r.grade || '').toUpperCase() === 'F';
      scorePanel.innerHTML = `
        <div class="score-display">
          <div class="num ${isFail ? 'fail' : ''}">${r.score}<span class="max">/ 100</span></div>
          <div class="grade-badge ${r.grade}">${escapeHtml(r.grade || '—')}</div>
        </div>
      `;
    }

    // 4. Workflow Panel
    const workflowPanel = document.getElementById('res-detail-workflow');
    if (workflowPanel) {
      const steps = [
        { label: 'Score Entered', status: 'done', date: r.createdAt },
        { label: 'Submitted', status: 'done', date: r.submittedAt || r.createdAt },
        { label: 'HOD Verified', status: 'done', date: r.hodVerifiedAt || r.createdAt },
        { label: 'Admin Approved', status: r.status === 'approved' || r.status === 'published' ? 'done' : (r.status === 'admin_rejected' ? 'rejected' : 'current'), date: r.approvedAt },
        { label: 'Published', status: r.status === 'published' ? 'done' : 'pending', date: r.publishedAt }
      ];

      workflowPanel.innerHTML = steps.map(s => `
        <div class="workflow-step ${s.status}">
          <div class="dot">${s.status === 'done' ? '✓' : s.status === 'rejected' ? '✕' : ''}</div>
          <div class="info">
            <strong>${escapeHtml(s.label)}</strong>
            ${s.date ? `<small>${fmtDateTime(s.date)}</small>` : ''}
          </div>
        </div>
      `).join('');
    }

    // 5. Actions Panel
    const actionsPanel = document.getElementById('res-detail-actions');
    if (actionsPanel) {
      actionsPanel.innerHTML = `
        ${r.status === 'hod_verified' ? `
          <button class="btn btn-primary" onclick="FPU_ADMIN.approveResult(${r.id})">Approve</button>
          <button class="btn btn-ghost" onclick="FPU_ADMIN.rejectResult(${r.id})">Reject</button>
        ` : ''}
        ${r.status === 'approved' ? `
          <button class="btn btn-accent" onclick="FPU_ADMIN.publishResult(${r.id})">Publish</button>
        ` : ''}
        <button class="btn btn-outline" onclick="FPU_ADMIN_SPA.navigateToWithQuery('result-edit', { id: ${r.id} })">Edit Score</button>
      `;
    }

  } catch (err) {
    const sub = document.getElementById('res-detail-subtitle');
    if (sub) sub.textContent = `Error: ${err.message}`;
    const studentPanel = document.getElementById('res-detail-student');
    if (studentPanel) studentPanel.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// RESULT ACTIONS
// ============================================
async function approveResult(id) {
  try {
    await adminFetch(`/api/admin/results/${id}/approve`, { method: 'POST' });
    showToast('Approved.', 'success');
    loadDepartmentResults();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function rejectResult(id) {
  const reason = prompt('Reason for rejecting:');
  if (reason === null) return;
  try {
    await adminFetch(`/api/admin/results/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    showToast('Rejected.', 'warning');
    loadDepartmentResults();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function publishResult(id) {
  try {
    await adminFetch(`/api/admin/results/${id}/publish`, { method: 'POST' });
    showToast('Published.', 'success');
    loadDepartmentResults();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function bulkApproveResults() {
  const ids = Array.from(document.querySelectorAll('.rd-check:checked')).map((c) => Number(c.dataset.id));
  if (!ids.length) { showToast('Select results first.', 'warning'); return; }
  if (!confirm(`Approve ${ids.length} result(s)?`)) return;
  let ok = 0, failed = 0;
  for (const id of ids) {
    try { await adminFetch(`/api/admin/results/${id}/approve`, { method: 'POST' }); ok++; } catch { failed++; }
  }
  showToast(`✅ Approved ${ok}${failed ? `, ${failed} failed` : ''}.`);
  loadDepartmentResults();
}

async function bulkRejectResults() {
  const ids = Array.from(document.querySelectorAll('.rd-check:checked')).map((c) => Number(c.dataset.id));
  if (!ids.length) { showToast('Select results first.', 'warning'); return; }
  const reason = prompt('Rejection reason (applied to all):');
  if (reason === null) return;
  let ok = 0, failed = 0;
  for (const id of ids) {
    try {
      await adminFetch(`/api/admin/results/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
      ok++;
    } catch { failed++; }
  }
  showToast(`⚠️ Rejected ${ok}${failed ? `, ${failed} failed` : ''}.`, 'warning');
  loadDepartmentResults();
}

async function bulkPublishResults() {
  const ids = Array.from(document.querySelectorAll('.rd-check:checked')).map((c) => Number(c.dataset.id));
  if (!ids.length) { showToast('Select results first.', 'warning'); return; }
  if (!confirm(`Publish ${ids.length} result(s)?`)) return;
  try {
    await adminFetch('/api/admin/results/publish-batch', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
    showToast(`✅ Published ${ids.length}.`, 'success');
    loadDepartmentResults();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function bulkApproveCourseResults(courseId) {
  if (!confirm('Approve all hod_verified results for this course?')) return;
  try {
    const res = await adminFetch(`/api/admin/results?courseId=${courseId}&status=hod_verified&limit=500`);
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) { showToast('Nothing to approve.', 'info'); return; }
    let ok = 0, failed = 0;
    for (const r of rows) {
      try { await adminFetch(`/api/admin/results/${r.id}/approve`, { method: 'POST' }); ok++; } catch { failed++; }
    }
    showToast(`✅ Approved ${ok}${failed ? `, ${failed} failed` : ''}.`);
    loadDepartmentResults();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function bulkPublishCourseResults(courseId) {
  if (!confirm('Publish all approved results for this course?')) return;
  try {
    const res = await adminFetch(`/api/admin/results?courseId=${courseId}&status=approved&limit=500`);
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) { showToast('Nothing to publish.', 'info'); return; }
    const ids = rows.map((r) => r.id);
    await adminFetch('/api/admin/results/publish-batch', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
    showToast(`✅ Published ${ids.length}.`, 'success');
    loadDepartmentResults();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
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
  loadRegistrationStudents, loadCourseRegistrations, approveAllPendingCourse,
  approveRegistration, rejectRegistration,

  // Results
  loadResultDepartments, loadDepartmentResults, loadResultDetail, 
  approveResult, rejectResult, publishResult,
  bulkApproveResults, bulkRejectResults, bulkPublishResults,
  bulkApproveCourseResults, bulkPublishCourseResults,

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
  loadUsersHub, loadAllUsers, loadAdminAccounts, resetAdminPwd, toggleAdminActive, loadLoginHistory,
  
  // Courses
  loadCourseDepartments, loadDepartmentCourses, inferCourseYear
};