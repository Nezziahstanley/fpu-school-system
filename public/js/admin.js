// ============================================
// FPU ADMIN.JS — Federal Polytechnic Ugep
// Complete consolidated version (v10)
// Includes: dashboard, applications, students (dept-first),
// courses (dept-first), sessions, programmes, schools,
// departments, allocations, registrations, results, grade
// scales, transcript, staff, HODs, lecturers, timetable,
// exams, attendance, fees, payments, clearances, comms,
// records, library, reports, audit, security, settings, users.
// ============================================

// ============================================================
// FPU ADMIN — STYLED CONFIRM/ALERT MODALS
// Replaces browser confirm() / alert() with styled modals
// ============================================================
(function() {
  'use strict';

  // Create the modal DOM once
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

  // ============================================================
  // fpuConfirm — styled confirmation dialog (returns Promise<boolean>)
  // ============================================================
  window.fpuConfirm = function(message, options) {
    options = options || {};
    const type = options.type || 'warning'; // warning | danger | info | success
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

      // Set content
      iconEl.className = 'fpu-modal-icon ' + type;
      iconEl.textContent =
        type === 'danger' ? '❌' :
        type === 'info' ? 'ℹ️' :
        type === 'success' ? '✅' : '⚠️';
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
      function onOverlayClick(e) {
        if (e.target === overlay) cleanup(false);
      }
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

  // ============================================================
  // fpuAlert — styled alert (returns Promise<void>)
  // ============================================================
  window.fpuAlert = function(message, options) {
    options = options || {};
    return window.fpuConfirm(message, {
      title: options.title || 'Notice',
      type: options.type || 'info',
      okText: options.okText || 'OK',
      showCancel: false,
    });
  };

  // ============================================================
  // fpuPrompt — styled text input dialog (returns Promise<string|null>)
  // ============================================================
  window.fpuPrompt = function(message, defaultValue, options) {
    defaultValue = defaultValue || '';
    options = options || {};
    const title = options.title || 'Input Required';
    const okText = options.okText || 'OK';
    const cancelText = options.cancelText || 'Cancel';
    const inputType = options.inputType || 'text';
    const placeholder = options.placeholder || '';

    // Build the prompt modal DOM (separate from confirm modal)
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

    // Update content for this call
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
      setTimeout(() => {
        inputEl.focus();
        inputEl.select();
      }, 50);

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
      function onOverlayClick(e) {
        if (e.target === overlay) cleanup(null);
      }

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      inputEl.addEventListener('keydown', onKey);
      overlay.addEventListener('click', onOverlayClick);
    });
  };

  // ============================================================
  // Override global confirm() and alert() — falls back gracefully
  // ============================================================
  if (!window.__fpuModalOverridden) {
    window.__fpuModalOverridden = true;

    window.confirm = function(message) {
      if (window.__fpuUsingNativeConfirm) {
        return window.__fpuNativeConfirm.call(window, message);
      }
      window.fpuConfirm(message, { type: 'warning' });
      return false;
    };

    window.alert = function(message) {
      window.fpuAlert(message, { type: 'info' });
    };
  }

  // Save native for fallback
  if (!window.__fpuNativeConfirm) {
    window.__fpuNativeConfirm = window.confirm.bind(window);
  }
})();

// ============================================
// ADMIN AUTH HELPERS
// ============================================
function getAdminToken() {
  return localStorage.getItem("fpu_admin_token")
    || localStorage.getItem("portal_token");
}

function getAdminUser() {
  try {
    const raw = localStorage.getItem("fpu_admin_user")
      || localStorage.getItem("portal_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
  if (!token) {
    window.location.href = "/login.html";
    return false;
  }
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
        setTimeout(() => {
          window.location.href = "/login.html";
        }, 1200);
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
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeQuotes(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

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
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
}

function fmtDateTime(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("en-GB"); } catch { return "—"; }
}

function money(n) {
  return "₦" + Number(n || 0).toLocaleString();
}

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
  const bg = type === "error" ? "#b91c1c"
           : type === "warning" ? "#b45309"
           : type === "info" ? "#1e40af"
           : "#0a7d2a";
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px;
    background: ${bg}; color: #fff;
    padding: 14px 24px; border-radius: 10px;
    font-size: 14px; font-weight: 600;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    z-index: 99999;
    font-family: 'Inter', sans-serif;
    max-width: 340px; word-break: break-word;
  `;
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
    navigator.clipboard.writeText(text)
      .then(() => showToast("✅ Copied: " + text))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); showToast("✅ Copied: " + text); }
  catch (e) { alert("Copy manually:\n" + text); }
  document.body.removeChild(ta);
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
  const label = r.replace(/_/g, " ");
  return `<span class="badge role-${r}">${escapeHtml(label)}</span>`;
}

function statusPill(status) {
  const map = {
    pending:      { cls: 'warning', icon: '⏳' },
    under_review: { cls: 'info',    icon: '🔎' },
    approved:     { cls: 'success', icon: '✅' },
    rejected:     { cls: 'danger',  icon: '❌' },
    registered:   { cls: 'primary', icon: '🎓' },
  };
  const m = map[status] || map.pending;
  return `<span class="badge badge-${m.cls}">${m.icon} ${escapeHtml(String(status || 'pending').replace(/_/g, ' '))}</span>`;
}

function promptReason(label = "Reason:") {
  const v = prompt(label);
  if (v === null) return null;
  if (!v.trim()) {
    showToast("⚠️ A reason is required.", "warning");
    return null;
  }
  return v.trim();
}

function exportTableAsCSV(table, filename = "export.csv") {
  if (!table) return;
  const rows = Array.from(table.querySelectorAll("tr"));
  const csv = rows.map((tr) => {
    const cells = Array.from(tr.querySelectorAll("th,td"));
    return cells.map((c) => {
      const text = (c.textContent || "").replace(/\s+/g, " ").trim();
      return '"' + text.replace(/"/g, '""') + '"';
    }).join(",");
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

// ------------------------------------------------------------
// Time helpers for the timetable module
// ------------------------------------------------------------
function __ttTimeToMin(hhmm) {
  if (typeof hhmm !== "string") return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

function __ttFindConflicts({ sessionId, semester, dayOfWeek, startTime, endTime, lecturerId, venue, excludeId }) {
  if (!window.__ttCache) return [];
  const [a1, a2] = [__ttTimeToMin(startTime), __ttTimeToMin(endTime)];
  if (a1 === null || a2 === null) return [];
  const out = [];
  window.__ttCache.forEach((slot) => {
    if (Number(slot.sessionId) !== Number(sessionId)) return;
    if (slot.semester !== semester) return;
    if (slot.dayOfWeek !== dayOfWeek) return;
    if (excludeId && Number(slot.id) === Number(excludeId)) return;
    const [b1, b2] = [__ttTimeToMin(slot.startTime), __ttTimeToMin(slot.endTime)];
    if (b1 === null || b2 === null) return;
    if (!(a1 < b2 && b1 < a2)) return;
    if (lecturerId && Number(slot.lecturerId) === Number(lecturerId)) {
      out.push(`Lecturer already booked at ${slot.startTime}–${slot.endTime}`);
    }
    if (venue && slot.venue && String(slot.venue).toLowerCase() === String(venue).toLowerCase()) {
      out.push(`Venue "${slot.venue}" already booked at ${slot.startTime}–${slot.endTime}`);
    }
  });
  return out;
}

// ============================================
// DASHBOARD
// ============================================
async function initDashboard() {
  // Dashboard partial self-bootstraps.
}

async function loadDashboardStats() {
  try {
    const res = await adminFetch("/api/admin/reports/overview");
    const result = await res.json();
    if (!result.success) return;
    const s = result.data || result.stats || result;

    setText("stat-students",   s.students);
    setText("stat-lecturers",  s.lecturers);
    setText("stat-apps",       s.pendingApplications);
    setText("stat-results",    s.pendingResults);
    setText("stat-payments",   s.pendingPayments);
    setText("stat-clearances", s.pendingClearances);
    setText("stat-complaints", s.openComplaints);
    setText("stat-borrows",    s.activeBorrows);

    const badgeEl = document.getElementById("pending-badge");
    if (badgeEl) {
      const pending = s.pendingApplications || 0;
      if (pending > 0) {
        badgeEl.textContent = pending;
        badgeEl.style.display = "inline-flex";
      } else {
        badgeEl.style.display = "none";
      }
    }
  } catch (err) {
    console.debug("[dashboard] stats:", err && err.message);
  }
}

async function loadRecentActivity() {
  const container = document.getElementById("activity-list");
  if (!container) return;
  try {
    const res = await adminFetch("/api/admin/audit?limit=6");
    const result = await res.json();
    const logs = extractArray(result);
    if (!logs.length) {
      container.innerHTML = `<p style="text-align:center;color:#94a3b8;padding:20px;font-size:14px;">No activity yet</p>`;
      return;
    }
    container.innerHTML = logs.map((r) => {
      const log = r.log || r;
      return `
        <div class="activity-item">
          <div class="activity-icon">📝</div>
          <div class="activity-content">
            <strong>${escapeHtml(log.action || '')}</strong>
            <p>${escapeHtml(log.entity || '')}${log.entityId ? ` #${escapeHtml(String(log.entityId))}` : ''}</p>
          </div>
          <span class="activity-time">${timeAgo(log.createdAt)}</span>
        </div>`;
    }).join("");
  } catch (err) {
    console.debug("[dashboard] activity:", err && err.message);
  }
}

// ============================================
// DASHBOARD CHART LOADERS
// ============================================
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
    box.innerHTML = rows.map((r) => {
      const pct = Math.round((r.count / max) * 100);
      return `
        <div class="progress-list-item">
          <div class="progress-header">
            <span>${escapeHtml(r.name)}</span>
            <span class="progress-value">${r.count}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>`;
    }).join("");
  } catch (err) {
    box.innerHTML = `<p class="muted">Could not load.</p>`;
  }
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
      { label: "Pending results",      value: d.pendingResults || 0,      page: "results" },
      { label: "Pending payments",     value: d.pendingPayments || 0,     page: "payments" },
      { label: "Pending clearances",   value: d.pendingClearances || 0,   page: "clearances" },
      { label: "Open complaints",      value: d.openComplaints || 0,      page: "complaints" },
    ];
    box.innerHTML = items.map((it) => `
      <div class="session-item" style="cursor:pointer;" onclick="FPU_ADMIN_SPA.navigateTo('${it.page}')">
        <div class="meta"><strong>${escapeHtml(it.label)}</strong></div>
        <div>${badge(it.value > 0 ? 'pending' : 'approved')}</div>
      </div>
    `).join("");
  } catch (err) {
    box.innerHTML = `<p class="muted">Could not load.</p>`;
  }
}

async function loadStudentsByDept() {
  const el = document.getElementById("chart-students-dept");
  if (!el) return;
  if (typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/reports/enrollment-by-department");
    const json = await res.json();
    const rows = (json.data || []).slice(0, 12);
    if (!rows.length) return;
    new Chart(el, {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.name),
        datasets: [{ label: 'Students', data: rows.map((r) => r.count), backgroundColor: '#065f46', borderRadius: 6 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
  } catch (err) { console.debug('[dashboard] students-by-dept:', err && err.message); }
}

async function loadStudentsByProgramme() {
  const el = document.getElementById("chart-students-prog");
  if (!el) return;
  if (typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/reports/enrollment-by-programme");
    const json = await res.json();
    const rows = (json.data || []).slice(0, 12);
    if (!rows.length) return;
    new Chart(el, {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.name),
        datasets: [{ label: 'Students', data: rows.map((r) => r.count), backgroundColor: '#3b82f6', borderRadius: 6 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
  } catch (err) { console.debug('[dashboard] students-by-prog:', err && err.message); }
}

async function loadStudentsByLevel() {
  const el = document.getElementById("chart-students-level");
  if (!el) return;
  if (typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/reports/enrollment-by-level");
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) return;
    new Chart(el, {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.level || 'Unknown'),
        datasets: [{ label: 'Students', data: rows.map((r) => r.count), backgroundColor: '#8b5cf6', borderRadius: 6 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
  } catch (err) { console.debug('[dashboard] students-by-level:', err && err.message); }
}

async function loadStudentGender() {
  const el = document.getElementById("chart-students-gender");
  if (!el) return;
  if (typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/students?limit=1000");
    const json = await res.json();
    const rows = json.data || [];
    let male = 0, female = 0, other = 0;
    rows.forEach((s) => {
      const g = String(s.gender || '').toLowerCase();
      if (g === 'male') male++;
      else if (g === 'female') female++;
      else other++;
    });
    if (male + female + other === 0) return;
    new Chart(el, {
      type: 'doughnut',
      data: {
        labels: ['Male', 'Female', 'Not Specified'],
        datasets: [{ data: [male, female, other], backgroundColor: ['#3b82f6', '#ec4899', '#64748b'], borderColor: '#ffffff', borderWidth: 3 }],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '62%' },
    });
  } catch (err) { console.debug('[dashboard] students-gender:', err && err.message); }
}

async function loadAdmissionTrend() {
  const el = document.getElementById("chart-admission-trend");
  if (!el) return;
  if (typeof Chart === 'undefined') return;
  try {
    const days = window.__dashRangeDays || 365;
    const res = await adminFetch(`/api/admin/reports/admission-trend?days=${days}`);
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) return;
    new Chart(el, {
      type: 'line',
      data: {
        labels: rows.map((r) => r.month),
        datasets: [{ label: 'Admissions', data: rows.map((r) => r.count), borderColor: '#065f46', backgroundColor: 'rgba(6, 95, 70, 0.1)', tension: 0.4, fill: true, borderWidth: 3 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
  } catch (err) { console.debug('[dashboard] admission-trend:', err && err.message); }
}

async function loadApplicationStatus() {
  const el = document.getElementById("chart-app-status");
  if (!el) return;
  if (typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/reports/applications-by-status");
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) return;
    const colorMap = { pending: '#f59e0b', under_review: '#3b82f6', approved: '#065f46', rejected: '#dc2626', registered: '#8b5cf6' };
    new Chart(el, {
      type: 'doughnut',
      data: {
        labels: rows.map((r) => (r.status || 'unknown').replace(/_/g, ' ')),
        datasets: [{ data: rows.map((r) => r.count), backgroundColor: rows.map((r) => colorMap[r.status] || '#64748b'), borderColor: '#ffffff', borderWidth: 3 }],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '62%' },
    });
  } catch (err) { console.debug('[dashboard] app-status:', err && err.message); }
}

async function loadPopulationTrend() {
  const el = document.getElementById("chart-population-trend");
  if (!el) return;
  if (typeof Chart === 'undefined') return;
  try {
    const days = window.__dashRangeDays || 365;
    const res = await adminFetch(`/api/admin/reports/population-trend?days=${days}`);
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) return;
    new Chart(el, {
      type: 'line',
      data: {
        labels: rows.map((r) => r.month),
        datasets: [{ label: 'Total Students', data: rows.map((r) => r.total), borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', tension: 0.4, fill: true, borderWidth: 3 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
  } catch (err) { console.debug('[dashboard] population-trend:', err && err.message); }
}

async function loadPaymentStatus() {
  const el = document.getElementById("chart-payment-status");
  if (!el) return;
  if (typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/reports/payments-by-status");
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) return;
    const colorMap = { pending: '#f59e0b', verified: '#065f46', rejected: '#dc2626', refunded: '#3b82f6' };
    new Chart(el, {
      type: 'doughnut',
      data: {
        labels: rows.map((r) => r.status || 'unknown'),
        datasets: [{ data: rows.map((r) => r.count), backgroundColor: rows.map((r) => colorMap[r.status] || '#64748b'), borderColor: '#ffffff', borderWidth: 3 }],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '62%' },
    });
  } catch (err) { console.debug('[dashboard] payment-status:', err && err.message); }
}

async function loadRevenueTrend() {
  const el = document.getElementById("chart-revenue-trend");
  if (!el) return;
  if (typeof Chart === 'undefined') return;
  try {
    const days = window.__dashRangeDays || 365;
    const res = await adminFetch(`/api/admin/reports/revenue-trend?days=${days}`);
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) return;
    new Chart(el, {
      type: 'line',
      data: {
        labels: rows.map((r) => r.month),
        datasets: [{ label: 'Revenue (₦)', data: rows.map((r) => Number(r.total || 0)), borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.15)', tension: 0.4, fill: true, borderWidth: 3 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
  } catch (err) { console.debug('[dashboard] revenue-trend:', err && err.message); }
}

async function loadRegistrationStats() {
  const el = document.getElementById("chart-registrations");
  if (!el) return;
  if (typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/reports/registrations-by-status");
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) return;
    const colorMap = { pending: '#f59e0b', approved: '#065f46', rejected: '#dc2626' };
    new Chart(el, {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.status),
        datasets: [{ label: 'Registrations', data: rows.map((r) => r.count), backgroundColor: rows.map((r) => colorMap[r.status] || '#64748b'), borderRadius: 6 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
  } catch (err) { console.debug('[dashboard] registrations:', err && err.message); }
}

async function loadDeptComparison() {
  const el = document.getElementById("chart-dept-comparison");
  if (!el) return;
  if (typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/reports/enrollment-by-department");
    const json = await res.json();
    const rows = (json.data || []).slice(0, 10);
    if (!rows.length) return;
    new Chart(el, {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.name),
        datasets: [{ label: 'Students', data: rows.map((r) => r.count), backgroundColor: '#14b8a6', borderRadius: 6 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
  } catch (err) { console.debug('[dashboard] dept-comparison:', err && err.message); }
}

async function loadResultsStats() {
  const el = document.getElementById("chart-results-stats");
  if (!el) return;
  if (typeof Chart === 'undefined') return;
  try {
    const res = await adminFetch("/api/admin/reports/results-by-status");
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) return;
    const colorMap = { draft: '#64748b', submitted: '#3b82f6', hod_verified: '#8b5cf6', approved: '#065f46', published: '#10b981', hod_rejected: '#dc2626', admin_rejected: '#dc2626' };
    new Chart(el, {
      type: 'bar',
      data: {
        labels: rows.map((r) => (r.status || '').replace(/_/g, ' ')),
        datasets: [{ label: 'Results', data: rows.map((r) => r.count), backgroundColor: rows.map((r) => colorMap[r.status] || '#64748b'), borderRadius: 6 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
  } catch (err) { console.debug('[dashboard] results-stats:', err && err.message); }
}

async function loadRecentStudents() {
  const tbody = document.getElementById("recent-students-tbody");
  if (!tbody) return;
  try {
    const res = await adminFetch("/api/admin/students?limit=8");
    const json = await res.json();
    const rows = json.data || [];
    tbody.innerHTML = rows.length ? rows.map((s) => `
      <tr>
        <td><code>${escapeHtml(s.matricNumber || '')}</code></td>
        <td><strong>${escapeHtml(s.firstName || '')} ${escapeHtml(s.lastName || '')}</strong></td>
        <td>${escapeHtml(s.level || '')}</td>
        <td>${escapeHtml(s.programmeName || s.programme?.name || '—')}</td>
        <td>${fmtDate(s.createdAt)}</td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="empty">No students yet.</td></tr>';
  } catch (err) { console.debug('[dashboard] recent-students:', err && err.message); }
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
      return `
        <tr>
          <td><code>${escapeHtml(p.reference || '')}</code></td>
          <td>${escapeHtml(studentName)}</td>
          <td class="num">${money(p.amount)}</td>
          <td>${badge(p.status)}</td>
        </tr>`;
    }).join('') : '<tr><td colspan="4" class="empty">No payments yet.</td></tr>';
  } catch (err) { console.debug('[dashboard] recent-payments:', err && err.message); }
}

async function loadRecentApplications() {
  const tbody = document.getElementById("recent-apps-tbody");
  if (!tbody) return;
  try {
    const res = await adminFetch("/api/admin/applications?limit=8");
    const json = await res.json();
    const rows = json.data || [];
    tbody.innerHTML = rows.length ? rows.map((a) => `
      <tr>
        <td><code>${escapeHtml(a.applicationNumber || '')}</code></td>
        <td>${escapeHtml((a.firstName || '') + ' ' + (a.lastName || ''))}</td>
        <td>${escapeHtml(a.type || 'ND')}</td>
        <td>${statusPill(a.status)}</td>
      </tr>
    `).join('') : '<tr><td colspan="4" class="empty">No applications yet.</td></tr>';
  } catch (err) { console.debug('[dashboard] recent-applications:', err && err.message); }
}

async function loadRecentRegistrations() {
  const tbody = document.getElementById("recent-registrations-tbody");
  if (!tbody) return;
  try {
    const res = await adminFetch("/api/admin/registrations/with-student?limit=8");
    const json = await res.json();
    const rows = json.data || [];
    tbody.innerHTML = rows.length ? rows.map((r) => {
      const student = r.student || {};
      const course = r.course || {};
      const reg = r.registration || r;
      return `
        <tr>
          <td>${escapeHtml((student.firstName || '') + ' ' + (student.lastName || '')) || 'Student ' + reg.studentId}</td>
          <td>${escapeHtml(course.code || ('Course ' + reg.courseId))}</td>
          <td>${escapeHtml(reg.semester || '')}</td>
          <td>${badge(reg.status)}</td>
        </tr>`;
    }).join('') : '<tr><td colspan="4" class="empty">No registrations yet.</td></tr>';
  } catch (err) { console.debug('[dashboard] recent-registrations:', err && err.message); }
}

async function loadRecentResults() {
  const tbody = document.getElementById("recent-results-tbody");
  if (!tbody) return;
  try {
    const res = await adminFetch("/api/admin/results?limit=8");
    const json = await res.json();
    const rows = json.data || [];
    tbody.innerHTML = rows.length ? rows.map((r) => `
      <tr>
        <td>Student ${r.studentId}</td>
        <td>Course ${r.courseId}</td>
        <td class="num">${r.score}</td>
        <td>${badge(r.status)}</td>
      </tr>
    `).join('') : '<tr><td colspan="4" class="empty">No results yet.</td></tr>';
  } catch (err) { console.debug('[dashboard] recent-results:', err && err.message); }
}

async function loadRecentNotifications() {
  const box = document.getElementById("recent-notifications");
  if (!box) return;
  try {
    const res = await adminFetch("/api/admin/notifications");
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) { box.innerHTML = '<p class="muted">No notifications.</p>'; return; }
    box.innerHTML = rows.slice(0, 6).map((n) => `
      <div class="session-item">
        <div class="meta"><strong>${escapeHtml(n.title || '')}</strong>${escapeHtml((n.body || '').slice(0, 80))}</div>
        <div class="small muted">${timeAgo(n.createdAt)}</div>
      </div>
    `).join('');
  } catch (err) { console.debug('[dashboard] recent-notifications:', err && err.message); }
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
      const exam = r.exam || r;
      const course = r.course || {};
      return `
        <div class="session-item">
          <div class="meta">
            <strong>${escapeHtml(course.code || '')} — ${escapeHtml(course.title || 'Exam')}</strong>
            <div class="small">${exam.startTime || ''} ${exam.endTime ? '- ' + exam.endTime : ''} · ${escapeHtml(exam.venue || '')}</div>
          </div>
          <div class="small muted">${exam.examDate ? fmtDate(exam.examDate) : ''}</div>
        </div>`;
    }).join('');
  } catch (err) { console.debug('[dashboard] upcoming-events:', err && err.message); }
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
      const entry = r.entry || r;
      const user = r.user || {};
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || entry.email || 'Unknown';
      return `
        <div class="session-item">
          <div class="meta">
            <strong>${entry.success ? '✅' : '❌'} ${escapeHtml(name)}</strong>
            <div class="small">${escapeHtml(entry.ipAddress || '')}</div>
          </div>
          <div class="small muted">${timeAgo(entry.createdAt)}</div>
        </div>`;
    }).join('');
  } catch (err) { console.debug('[dashboard] recent-logins:', err && err.message); }
}

// ------------------------------------------------------------
// loadAll — runs every defined loader, swallows errors
// ------------------------------------------------------------
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
      if (p && typeof p.catch === 'function') {
        p.catch((err) => console.debug(`[dashboard]:`, err && err.message));
      }
      promises.push(p);
    } catch (err) {
      console.debug(`[dashboard] threw:`, err && err.message);
    }
  }
  await Promise.allSettled(promises);
}

// ============================================
// APPLICATIONS
// ============================================
async function loadApplications() {
  const container = document.getElementById("applications-tbody");
  if (!container) return;

  const status   = (document.getElementById("applications-status-filter") || {}).value || "";
  const type     = (document.getElementById("applications-type-filter") || {}).value || "";
  const country  = (document.getElementById("applications-country-filter") || {}).value || "";
  const state    = (document.getElementById("applications-state-filter") || {}).value || "";
  const search   = (document.getElementById("applications-search") || {}).value || "";

  const qs = new URLSearchParams({ limit: 500 });
  if (status)  qs.set("status", status);
  if (type)    qs.set("type", type);
  if (country) qs.set("country", country);
  if (state)   qs.set("state", state);
  if (search)  qs.set("search", search);

  container.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/applications?${qs}`);
    const result = await res.json();
    const apps = extractArray(result);

    updateApplicationStats(apps);

    if (!apps.length) {
      container.innerHTML = `<tr><td colspan="7" class="empty">No applications found.</td></tr>`;
      return;
    }

    if (window.FPU_PAGINATE && typeof window.FPU_PAGINATE.mount === 'function') {
      window.__appsPager = window.FPU_PAGINATE.mount(container, apps, {
        pageSize: 25,
        renderRow: (a) => {
          const fullName = `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Applicant';
          const initials = ((a.firstName || ' ')[0] + (a.lastName || ' ')[0]).toUpperCase().trim() || 'A';
          const avatar = a.passportUrl
            ? `<img src="${escapeHtml(a.passportUrl)}" alt="" />`
            : escapeHtml(initials);

          return `
            <tr class="row-clickable" data-id="${a.id}">
              <td style="width:32px;">
                <input type="checkbox" class="app-check" data-id="${a.id}" onclick="event.stopPropagation()" />
              </td>
              <td><code>${escapeHtml(a.applicationNumber || '')}</code></td>
              <td>
                <div class="applicant-cell">
                  <div class="applicant-avatar">${avatar}</div>
                  <div>
                    <div class="applicant-name">${escapeHtml(fullName)}</div>
                    <div class="applicant-meta">${escapeHtml(a.email || '')}</div>
                  </div>
                </div>
              </td>
              <td>${escapeHtml(a.type || 'ND')}</td>
              <td>${statusPill(a.status)}</td>
              <td class="small muted">${fmtDate(a.createdAt)}</td>
              <td>
                <div class="row-actions">
                  <button class="btn btn-sm btn-outline"
                    onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('application-view', { id: ${a.id} })">
                    View
                  </button>
                </div>
              </td>
            </tr>
          `;
        },
      });

      setTimeout(() => {
        container.querySelectorAll('tr[data-id]').forEach((tr) => {
          if (tr.__fpuClickBound) return;
          tr.__fpuClickBound = true;
          tr.addEventListener('click', () => {
            FPU_ADMIN_SPA.navigateToWithQuery('application-view', { id: Number(tr.dataset.id) });
          });
        });
      }, 0);
    } else {
      container.innerHTML = apps.map((a) => {
        const fullName = `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Applicant';
        const initials = ((a.firstName || ' ')[0] + (a.lastName || ' ')[0]).toUpperCase().trim() || 'A';
        const avatar = a.passportUrl ? `<img src="${escapeHtml(a.passportUrl)}" alt="" />` : escapeHtml(initials);
        return `
          <tr class="row-clickable" data-id="${a.id}">
            <td style="width:32px;"><input type="checkbox" class="app-check" data-id="${a.id}" onclick="event.stopPropagation()" /></td>
            <td><code>${escapeHtml(a.applicationNumber || '')}</code></td>
            <td><div class="applicant-cell"><div class="applicant-avatar">${avatar}</div><div><div class="applicant-name">${escapeHtml(fullName)}</div><div class="applicant-meta">${escapeHtml(a.email || '')}</div></div></div></td>
            <td>${escapeHtml(a.type || 'ND')}</td>
            <td>${statusPill(a.status)}</td>
            <td class="small muted">${fmtDate(a.createdAt)}</td>
            <td><div class="row-actions" style="white-space:nowrap;">
              <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('application-view', { id: ${a.id} })">👁 View</button>
              ${['pending','under_review'].includes(String(a.status).toLowerCase()) ? `
                <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); FPU_ADMIN.approveApplication(${a.id})">✅ Approve</button>
                <button class="btn btn-sm btn-ghost" style="color:#dc2626;" onclick="event.stopPropagation(); FPU_ADMIN.rejectApplication(${a.id})">❌ Reject</button>
              ` : ''}
              ${String(a.status).toLowerCase() === 'approved' ? `
                <button class="btn btn-sm" style="background:#3b82f6;color:white;border-color:#3b82f6;" onclick="event.stopPropagation(); FPU_ADMIN.registerApplication(${a.id})">🎓 Register</button>
              ` : ''}
            </div></td>
          </tr>
        `;
      }).join("");

      container.querySelectorAll('tr[data-id]').forEach((tr) => {
        tr.addEventListener('click', () => {
          FPU_ADMIN_SPA.navigateToWithQuery('application-view', { id: Number(tr.dataset.id) });
        });
      });
    }

    const selectAll = document.getElementById('apps-select-all');
    if (selectAll) {
      selectAll.checked = false;
      selectAll.onchange = () => {
        container.querySelectorAll('.app-check').forEach((cb) => { cb.checked = selectAll.checked; });
      };
    }
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

function updateApplicationStats(rows) {
  const counts = { total: rows.length, pending: 0, approved: 0, registered: 0 };
  rows.forEach((r) => {
    if (r.status === 'pending' || r.status === 'under_review') counts.pending += 1;
    else if (r.status === 'approved') counts.approved += 1;
    else if (r.status === 'registered') counts.registered += 1;
  });
  Object.keys(counts).forEach((k) => {
    const el = document.getElementById(`app-stat-${k}`);
    if (el) el.textContent = counts[k];
  });
}

async function bulkApplicationAction(action) {
  const ids = Array.from(document.querySelectorAll('.app-check:checked')).map((cb) => Number(cb.dataset.id));
  if (ids.length === 0) {
    showToast('⚠️ Select at least one application.', 'warning');
    return;
  }

  let reason = null;
  if (action === 'reject') {
    reason = prompt(`Reason for rejecting ${ids.length} application(s):`);
    if (reason === null) return;
    if (!reason.trim()) { showToast('⚠️ A reason is required.', 'warning'); return; }
  } else {
    if (!confirm(`${action === 'delete' ? 'Delete' : 'Approve'} ${ids.length} application(s)?`)) return;
  }

  try {
    const res = await adminFetch('/api/admin/applications/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids, action, reason }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showToast(`✅ ${json.processed} of ${ids.length} processed.`);
    loadApplications();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

// ============================================
// INDIVIDUAL APPLICATION ACTIONS
// ============================================

async function approveApplication(id) {
  if (!confirm('Approve this application?')) return;
  try {
    const res = await adminFetch(`/api/admin/applications/${id}/approve`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Approve failed');
    showToast('✅ Application approved.', 'success');
    loadApplications();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

async function rejectApplication(id) {
  const reason = prompt('Enter rejection reason (optional):');
  if (reason === null) return;
  try {
    const res = await adminFetch(`/api/admin/applications/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason.trim() || 'Did not meet requirements.' })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Reject failed');
    showToast('⚠️ Application rejected.', 'warning');
    loadApplications();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
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
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

async function loadAdmitted() {
  const container = document.getElementById("admitted-tbody");
  if (!container) return;

  const statusFilter = (document.getElementById("admitted-status-filter") || {}).value;
  const typeFilter   = (document.getElementById("admitted-type-filter") || {}).value || "";
  const search       = (document.getElementById("admitted-search") || {}).value || "";

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

    if (!rows.length) {
      container.innerHTML = `<tr><td colspan="7" class="empty">No applicants found.</td></tr>`;
      return;
    }

    if (window.FPU_PAGINATE && typeof window.FPU_PAGINATE.mount === 'function') {
      window.FPU_PAGINATE.mount(container, rows, {
        pageSize: 25,
        renderRow: (a) => {
          const fullName = `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Applicant';
          const initials = ((a.firstName || ' ')[0] + (a.lastName || ' ')[0]).toUpperCase().trim() || 'A';
          const avatar = a.passportUrl
            ? `<img src="${escapeHtml(a.passportUrl)}" alt="" />`
            : escapeHtml(initials);
          const isRegistered = a.status === 'registered';

          return `
            <tr class="row-clickable" data-id="${a.id}">
              <td style="width:32px;">
                ${!isRegistered
                  ? `<input type="checkbox" class="adm-check" data-id="${a.id}" onclick="event.stopPropagation()" />`
                  : ''}
              </td>
              <td><code>${escapeHtml(a.applicationNumber || '')}</code></td>
              <td>
                <div class="applicant-cell">
                  <div class="applicant-avatar">${avatar}</div>
                  <div>
                    <div class="applicant-name">${escapeHtml(fullName)}</div>
                    <div class="applicant-meta">${escapeHtml(a.email || '')}</div>
                  </div>
                </div>
              </td>
              <td>${escapeHtml(a.type || 'ND')}</td>
              <td>${statusPill(a.status)}</td>
              <td class="small muted">${a.reviewedAt ? fmtDate(a.reviewedAt) : '—'}</td>
              <td>
                <div class="row-actions">
                  <button class="btn btn-sm btn-outline"
                    onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('application-view', { id: ${a.id} })">
                    View
                  </button>
                  ${!isRegistered
                    ? `<button class="btn btn-sm btn-accent"
                         onclick="event.stopPropagation(); FPU_ADMIN.registerAdmitted(${a.id})">Register</button>`
                    : `<span class="badge badge-primary">🎓 ${escapeHtml(a.matricNumber || 'Registered')}</span>`}
                </div>
              </td>
            </tr>
          `;
        },
      });

      setTimeout(() => {
        container.querySelectorAll('tr[data-id]').forEach((tr) => {
          if (tr.__fpuClickBound) return;
          tr.__fpuClickBound = true;
          tr.addEventListener('click', () => {
            FPU_ADMIN_SPA.navigateToWithQuery('application-view', { id: Number(tr.dataset.id) });
          });
        });
      }, 0);
    } else {
      container.innerHTML = rows.map((a) => {
        const fullName = `${a.firstName || ''} ${a.lastName || ''}`.trim();
        const initials = ((a.firstName || ' ')[0] + (a.lastName || ' ')[0]).toUpperCase().trim() || 'A';
        const avatar = a.passportUrl ? `<img src="${escapeHtml(a.passportUrl)}" alt="" />` : escapeHtml(initials);
        const isRegistered = a.status === 'registered';
        return `
          <tr class="row-clickable" data-id="${a.id}">
            <td>${!isRegistered ? `<input type="checkbox" class="adm-check" data-id="${a.id}" onclick="event.stopPropagation()" />` : ''}</td>
            <td><code>${escapeHtml(a.applicationNumber || '')}</code></td>
            <td><div class="applicant-cell"><div class="applicant-avatar">${avatar}</div><div><div class="applicant-name">${escapeHtml(fullName)}</div><div class="applicant-meta">${escapeHtml(a.email || '')}</div></div></div></td>
            <td>${escapeHtml(a.type || 'ND')}</td>
            <td>${statusPill(a.status)}</td>
            <td class="small muted">${a.reviewedAt ? fmtDate(a.reviewedAt) : '—'}</td>
            <td><div class="row-actions"><button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('application-view', { id: ${a.id} })">View</button>${!isRegistered ? `<button class="btn btn-sm btn-accent" onclick="event.stopPropagation(); FPU_ADMIN.registerAdmitted(${a.id})">Register</button>` : ''}</div></td>
          </tr>
        `;
      }).join("");

      container.querySelectorAll('tr[data-id]').forEach((tr) => {
        tr.addEventListener('click', () => {
          FPU_ADMIN_SPA.navigateToWithQuery('application-view', { id: Number(tr.dataset.id) });
        });
      });
    }

    const selectAll = document.getElementById('adm-select-all');
    if (selectAll) {
      selectAll.checked = false;
      selectAll.onchange = () => {
        container.querySelectorAll('.adm-check').forEach((cb) => { cb.checked = selectAll.checked; });
      };
    }
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

function updateAdmittedStats(rows) {
  const awaiting   = rows.filter((r) => r.status === 'approved').length;
  const registered = rows.filter((r) => r.status === 'registered').length;
  const nd         = rows.filter((r) => r.type === 'ND').length;
  const hnd        = rows.filter((r) => r.type === 'HND').length;

  setText('adm-stat-total', rows.length);
  setText('adm-stat-awaiting', awaiting);
  setText('adm-stat-registered', registered);
  setText('adm-stat-split', `${nd} / ${hnd}`);
}

async function bulkRegisterAdmitted() {
  const ids = Array.from(document.querySelectorAll('.adm-check:checked')).map((cb) => Number(cb.dataset.id));
  if (ids.length === 0) {
    showToast('⚠️ Select at least one applicant.', 'warning');
    return;
  }
  if (!confirm(`Create student accounts for ${ids.length} applicant(s)?\n\nEach will be assigned a matric number and default password "student1234".`)) return;

  let ok = 0, failed = 0;
  for (const id of ids) {
    try {
      const res = await adminFetch(`/api/admin/applications/${id}/register`, { method: 'POST' });
      const json = await res.json();
      if (json.success) ok++;
      else failed++;
    } catch (e) {
      failed++;
    }
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
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

// ============================================
// STUDENTS (department-first)
// ============================================
async function loadStudentDepartments() {
  const grid = document.getElementById('dept-grid');
  if (!grid) return;

  const schoolId = (document.getElementById('stu-filter-school') || {}).value || '';

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading departments…</div>';

  try {
    const [deptRes, studentRes, schoolRes] = await Promise.all([
      adminFetch('/api/admin/departments'),
      adminFetch(`/api/admin/students?limit=5000${schoolId ? '&schoolId=' + schoolId : ''}`),
      adminFetch('/api/admin/schools'),
    ]);

    const depts    = (await deptRes.json()).data    || [];
    const students = (await studentRes.json()).data || [];
    const schools  = (await schoolRes.json()).data  || [];

    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    const byDept = new Map();
    for (const d of depts) {
      byDept.set(d.id, { dept: d, students: [] });
    }
    for (const u of students) {
      if (!u.departmentId) continue;
      if (!byDept.has(u.departmentId)) continue;
      byDept.get(u.departmentId).students.push(u);
    }

    const visible = [...byDept.values()].filter(({ dept }) => {
      if (!schoolId) return true;
      return Number(dept.schoolId) === Number(schoolId);
    });

    const totalStudents = visible.reduce((s, d) => s + d.students.length, 0);
    const activeCount   = visible.reduce((s, d) => s + d.students.filter((u) => u.isActive !== false).length, 0);
    const ndCount       = visible.reduce((s, d) => s + d.students.filter((u) => u.level === 'ND').length, 0);
    const hndCount      = visible.reduce((s, d) => s + d.students.filter((u) => u.level === 'HND').length, 0);

    setText('stu-stat-total', totalStudents);
    setText('stu-stat-active', activeCount);
    setText('stu-stat-nd', ndCount);
    setText('stu-stat-hnd', hndCount);

    if (!visible.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
        <div class="icon">🏫</div>
        <p>No departments found.</p>
      </div>`;
      return;
    }

    visible.sort((a, b) => String(a.dept.code).localeCompare(String(b.dept.code)));

    grid.innerHTML = visible.map(({ dept, students: list }) => {
      const count   = list.length;
      const active  = list.filter((u) => u.isActive !== false).length;
      const nd      = list.filter((u) => u.level === 'ND').length;
      const hnd     = list.filter((u) => u.level === 'HND').length;
      const cert    = list.filter((u) => u.level === 'CERT').length;
      const school  = schoolMap.get(dept.schoolId);

      const isEmpty = count === 0;

      return `
        <div class="dept-card ${isEmpty ? 'empty' : ''}"
             ${isEmpty ? '' : `data-dept-id="${dept.id}" data-dept-name="${escapeHtml(dept.name)}"`}>
          <div class="dept-head">
            <span class="dept-code">${escapeHtml(dept.code)}</span>
            <span class="dept-school">${escapeHtml(school?.code || '')}</span>
          </div>
          <h3>${escapeHtml(dept.name)}</h3>
          <div class="dept-count">
            <span class="num">${count}</span>
            <span class="label">student${count === 1 ? '' : 's'}</span>
          </div>
          <div class="dept-split">
            ${nd   ? `<span class="dept-chip nd">ND: ${nd}</span>` : ''}
            ${hnd  ? `<span class="dept-chip hnd">HND: ${hnd}</span>` : ''}
            ${cert ? `<span class="dept-chip cert">CERT: ${cert}</span>` : ''}
            ${(!nd && !hnd && !cert) ? `<span class="dept-chip">No students</span>` : ''}
          </div>
          <div class="dept-footer">
            <span>${active} active</span>
            <span class="arrow">View students →</span>
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('.dept-card[data-dept-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const id = Number(card.dataset.deptId);
        const name = card.dataset.deptName;
        window.FPU_ADMIN_SPA.navigateToWithQuery('students-by-dept', { departmentId: id, name });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// COURSES (Department Directory)
// ============================================
async function loadCourses() {
  const grid = document.getElementById('course-dept-grid') || document.getElementById('dept-grid');
  if (!grid) {
    console.error('[Courses] Container not found');
    return;
  }

  const search = (document.getElementById('course-search') || {}).value || '';
  const schoolFilter = (document.getElementById('course-school-filter') || {}).value || '';
  const levelFilter = (document.getElementById('course-level-filter') || {}).value || '';
  const sortBy = (document.getElementById('course-sort') || {}).value || 'code-asc';

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;text-align:center;padding:2rem;"><span class="spinner"></span> Loading departments…</div>';

  try {
    const [deptRes, courseRes, schoolRes] = await Promise.all([
      adminFetch('/api/admin/departments'),
      adminFetch('/api/admin/courses?limit=5000'),
      adminFetch('/api/admin/schools'),
    ]);

    const depts = (await deptRes.json()).data || [];
    const courses = (await courseRes.json()).data || [];
    const schools = (await schoolRes.json()).data || [];

    const schoolMap = new Map(schools.map(s => [s.id, s]));

    // Aggregate courses by department
    const deptCourses = new Map();
    for (const c of courses) {
      if (!c.departmentId) continue;
      if (!deptCourses.has(c.departmentId)) deptCourses.set(c.departmentId, []);
      deptCourses.get(c.departmentId).push(c);
    }

    // Build visible list
    let visible = depts.map(dept => {
      const list = deptCourses.get(dept.id) || [];
      return { dept, courses: list };
    });

    // Apply filters
    if (schoolFilter) visible = visible.filter(v => Number(v.dept.schoolId) === Number(schoolFilter));
    if (levelFilter) visible = visible.filter(v => v.courses.some(c => String(c.level).toUpperCase() === levelFilter));
    if (search) {
      const q = search.toLowerCase();
      visible = visible.filter(v => 
        (v.dept.name || '').toLowerCase().includes(q) || 
        (v.dept.code || '').toLowerCase().includes(q) ||
        v.courses.some(c => (c.code || '').toLowerCase().includes(q) || (c.title || '').toLowerCase().includes(q))
      );
    }

    // Sort
    visible.sort((a, b) => {
      if (sortBy === 'name-asc') return String(a.dept.name).localeCompare(String(b.dept.name));
      if (sortBy === 'courses-desc') return b.courses.length - a.courses.length;
      return String(a.dept.code).localeCompare(String(b.dept.code)); // default code-asc
    });

    // Stats
    const totalCourses = visible.reduce((s, v) => s + v.courses.length, 0);
    const totalUnits = visible.reduce((s, v) => s + v.courses.reduce((cs, c) => cs + (Number(c.unit) || 0), 0), 0);
    const totalDepts = visible.length;
    const deptsWithCourses = visible.filter(v => v.courses.length > 0).length;

    if (document.getElementById('c-stat-total')) document.getElementById('c-stat-total').textContent = totalCourses;
    if (document.getElementById('c-stat-units')) document.getElementById('c-stat-units').textContent = totalUnits;
    if (document.getElementById('c-stat-depts')) document.getElementById('c-stat-depts').textContent = totalDepts;
    if (document.getElementById('c-stat-active')) document.getElementById('c-stat-active').textContent = deptsWithCourses;

    if (!visible.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:3rem;">
        <div class="icon" style="font-size:2rem;margin-bottom:1rem;">📚</div>
        <p>No departments found matching your filters.</p>
      </div>`;
      return;
    }

    // Render cards
    grid.innerHTML = visible.map(({ dept, courses: list }) => {
      const count = list.length;
      const nd = list.filter(c => String(c.level || '').toUpperCase() === 'ND').length;
      const hnd = list.filter(c => String(c.level || '').toUpperCase() === 'HND').length;
      const school = schoolMap.get(dept.schoolId);
      const isEmpty = count === 0;

      return `
        <div class="dept-card ${isEmpty ? 'empty' : ''}" data-dept-id="${dept.id}" data-dept-name="${escapeHtml(dept.name)}">
          <div class="dept-head">
            <span class="dept-code">${escapeHtml(dept.code || '')}</span>
            <span class="dept-school">${escapeHtml(school?.code || '')}</span>
          </div>
          <h3>${escapeHtml(dept.name)}</h3>
          <div class="dept-count">
            <span class="num">${count}</span>
            <span class="label">course${count === 1 ? '' : 's'}</span>
          </div>
          <div class="dept-split">
            ${nd ? `<span class="dept-chip nd">ND: ${nd}</span>` : ''}
            ${hnd ? `<span class="dept-chip hnd">HND: ${hnd}</span>` : ''}
            ${(!nd && !hnd) ? `<span class="dept-chip">No courses</span>` : ''}
          </div>
          <div class="dept-footer">
            <span>View courses →</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.dept-card[data-dept-id]').forEach(card => {
      card.addEventListener('click', () => {
        const id = Number(card.dataset.deptId);
        const name = card.dataset.deptName;
        window.FPU_ADMIN_SPA.navigateToWithQuery('courses-by-dept', { departmentId: id, name });
      });
    });

  } catch (err) {
    console.error('[Courses] Error:', err);
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">Failed to load departments: ${escapeHtml(err.message)}</div>`;
  }
}

window.FPU_ADMIN = {
  loadCourses,             // <--- MAKE SURE THIS IS HERE
  loadDepartmentCourses,   // <--- MAKE SURE THIS IS HERE
  approveApplication,
  rejectApplication,
  registerApplication,
  bulkApplicationAction,
  bulkRegisterAdmitted,
  registerAdmitted,
  loadAll,
  loadApplications,
  loadAdmitted,
  loadStudentDepartments,
  showToast,
  // ... other functions
};