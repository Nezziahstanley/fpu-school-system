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
  // Client-side pre-check that reads from the cached timetable.
  // Returns an array of strings (human-readable conflict labels).
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
            <td><div class="row-actions"><button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('application-view', { id: ${a.id} })">View</button></div></td>
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
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.dept-card[data-dept-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const deptId   = Number(card.dataset.deptId);
        const deptName = card.dataset.deptName;
        FPU_ADMIN_SPA.navigateToWithQuery('students-by-dept', {
          departmentId: deptId,
          name: deptName,
        });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

async function globalStudentSearch() {
  const term = (document.getElementById('stu-global-search') || {}).value || '';
  if (!term.trim()) {
    showToast('Enter a search term.', 'warning');
    return;
  }
  FPU_ADMIN_SPA.navigateToWithQuery('students-by-dept', {
    departmentId: '',
    name: 'Search Results',
    q: term.trim(),
  });
}

async function loadDepartmentStudents() {
  const container = document.getElementById('dept-students-tbody');
  if (!container) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const departmentId = params.get('departmentId') || '';
  const deptName     = params.get('name') || 'Department';
  const globalQuery  = params.get('q') || '';

  const titleEl = document.getElementById('dept-page-title');
  const tableTitle = document.getElementById('dept-table-title');
  if (titleEl) titleEl.textContent = deptName;
  if (tableTitle) tableTitle.textContent = `${deptName} — Students`;

  const subtitleEl = document.getElementById('dept-page-subtitle');
  if (subtitleEl) {
    subtitleEl.textContent = departmentId
      ? `Students enrolled in ${deptName}`
      : `Search results for "${globalQuery}"`;
  }

  const progSelect = document.getElementById('dept-filter-programme');
  if (progSelect && departmentId) {
    progSelect.dataset.extraParams = JSON.stringify({ departmentId });
    if (window.FPU_LOOKUPS && window.FPU_LOOKUPS.populate) {
      window.FPU_LOOKUPS.populate(progSelect);
    }
  }

  const level     = (document.getElementById('dept-filter-level') || {}).value || '';
  const programme = (document.getElementById('dept-filter-programme') || {}).value || '';
  const status    = (document.getElementById('dept-filter-status') || {}).value || '';
  const search    = (document.getElementById('dept-filter-search') || {}).value || globalQuery;

  const qs = new URLSearchParams({ limit: 5000 });
  if (departmentId) qs.set('departmentId', departmentId);
  if (level)        qs.set('level', level);
  if (programme)    qs.set('programmeId', programme);
  if (status)       qs.set('isActive', status === 'active' ? 'true' : 'false');
  if (search)       qs.set('search', search);

  container.innerHTML = '<tr><td colspan="8" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/students?${qs}`);
    const result = await res.json();
    const students = extractArray(result);

    setText('dept-stat-total', students.length);
    setText('dept-stat-active', students.filter((u) => u.isActive !== false).length);
    setText('dept-stat-nd', students.filter((u) => u.level === 'ND').length);
    setText('dept-stat-hnd', students.filter((u) => u.level === 'HND').length);

    if (!students.length) {
      container.innerHTML = `<tr><td colspan="8" class="empty">No students found.</td></tr>`;
      return;
    }

    if (window.FPU_PAGINATE && typeof window.FPU_PAGINATE.mount === 'function') {
      window.FPU_PAGINATE.mount(container, students, {
        pageSize: 25,
        renderRow: (u) => {
          const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
          const initials = ((u.firstName || ' ')[0] + (u.lastName || ' ')[0]).toUpperCase().trim() || 'S';
          const avatar = u.photoUrl ? `<img src="${escapeHtml(u.photoUrl)}" alt="" />` : escapeHtml(initials);

          return `
            <tr class="row-clickable" data-id="${u.id}">
              <td style="width:32px;">
                <input type="checkbox" class="stu-check" data-id="${u.id}" onclick="event.stopPropagation()" />
              </td>
              <td><code>${escapeHtml(u.matricNumber || u.matric || '')}</code></td>
              <td>
                <div class="applicant-cell">
                  <div class="applicant-avatar">${avatar}</div>
                  <div>
                    <div class="applicant-name">${escapeHtml(fullName)}</div>
                    <div class="applicant-meta">${escapeHtml(u.email || '')}</div>
                  </div>
                </div>
              </td>
              <td>${escapeHtml(u.level || '')}</td>
              <td>${escapeHtml(u.programmeName || u.programme?.name || '—')}</td>
              <td>${escapeHtml(u.phone || '—')}</td>
              <td>${u.isActive !== false ? badge('active') : badge('inactive')}</td>
              <td>
                <div class="row-actions">
                  <button class="btn btn-sm btn-outline"
                    onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('student-profile', { id: ${u.id} })">
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
            FPU_ADMIN_SPA.navigateToWithQuery('student-profile', { id: Number(tr.dataset.id) });
          });
        });
      }, 0);
    } else {
      container.innerHTML = students.map((u) => {
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
        const initials = ((u.firstName || ' ')[0] + (u.lastName || ' ')[0]).toUpperCase().trim() || 'S';
        const avatar = u.photoUrl ? `<img src="${escapeHtml(u.photoUrl)}" alt="" />` : escapeHtml(initials);
        return `
          <tr class="row-clickable" data-id="${u.id}">
            <td><input type="checkbox" class="stu-check" data-id="${u.id}" onclick="event.stopPropagation()" /></td>
            <td><code>${escapeHtml(u.matricNumber || '')}</code></td>
            <td><div class="applicant-cell"><div class="applicant-avatar">${avatar}</div><div><div class="applicant-name">${escapeHtml(fullName)}</div><div class="applicant-meta">${escapeHtml(u.email || '')}</div></div></div></td>
            <td>${escapeHtml(u.level || '')}</td>
            <td>${escapeHtml(u.programmeName || u.programme?.name || '')}</td>
            <td>${escapeHtml(u.phone || '')}</td>
            <td>${u.isActive !== false ? badge('active') : badge('inactive')}</td>
            <td><div class="row-actions"><button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('student-profile', { id: ${u.id} })">View</button></div></td>
          </tr>
        `;
      }).join('');

      container.querySelectorAll('tr[data-id]').forEach((tr) => {
        tr.addEventListener('click', () => {
          FPU_ADMIN_SPA.navigateToWithQuery('student-profile', { id: Number(tr.dataset.id) });
        });
      });
    }

    const selectAll = document.getElementById('dept-select-all');
    if (selectAll) {
      selectAll.checked = false;
      selectAll.onchange = () => {
        container.querySelectorAll('.stu-check').forEach((cb) => { cb.checked = selectAll.checked; });
      };
    }
  } catch (err) {
    container.innerHTML = `<tr><td colspan="8" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function bulkStudentAction(action) {
  const ids = Array.from(document.querySelectorAll('.stu-check:checked')).map((cb) => Number(cb.dataset.id));
  if (ids.length === 0) {
    showToast('⚠️ Select at least one student.', 'warning');
    return;
  }

  let password = null;
  if (action === 'reset-password') {
    password = prompt(`Reset password for ${ids.length} student(s) to:`, 'student1234');
    if (password === null) return;
    if (!password.trim()) { showToast('⚠️ A password is required.', 'warning'); return; }
  } else {
    if (!confirm(`${action === 'delete' ? 'Delete' : action === 'activate' ? 'Activate' : 'Deactivate'} ${ids.length} student(s)?`)) return;
  }

  let ok = 0, failed = 0;
  for (const id of ids) {
    try {
      if (action === 'delete') {
        await adminFetch(`/api/admin/students/${id}`, { method: 'DELETE' });
      } else if (action === 'activate' || action === 'deactivate') {
        const cur = await adminFetch(`/api/admin/students/${id}`).then(r => r.json());
        const isCurrentlyActive = cur.data.isActive !== false;
        const shouldBeActive = action === 'activate';
        if (isCurrentlyActive !== shouldBeActive) {
          await adminFetch(`/api/admin/students/${id}/toggle-active`, { method: 'POST' });
        }
      } else if (action === 'reset-password') {
        await adminFetch(`/api/admin/students/${id}/reset-password`, {
          method: 'POST',
          body: JSON.stringify({ password }),
        });
      }
      ok++;
    } catch (e) {
      failed++;
    }
  }

  showToast(failed === 0 ? `✅ ${ok} student(s) processed.` : `⚠️ ${ok} ok, ${failed} failed.`, failed > 0 ? 'warning' : 'success');
  loadDepartmentStudents();
}

// ============================================
// USERS
// ============================================
async function loadUsers() {
  const container = document.getElementById("users-tbody");
  if (!container) return;
  container.innerHTML = '<tr><td colspan="5" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch("/api/admin/user-list?limit=300");
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((u) => `
      <tr>
        <td>${escapeHtml(u.firstName || '')} ${escapeHtml(u.lastName || '')}</td>
        <td>${escapeHtml(u.email || '')}</td>
        <td>${escapeHtml(String(u.role || '').replace(/_/g,' '))}</td>
        <td>${u.isActive !== false ? 'Active' : 'Inactive'}</td>
        <td>${fmtDate(u.createdAt)}</td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="empty">No users.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadAdmins() {
  const container = document.getElementById("users-tbody");
  if (!container) return;
  container.innerHTML = '<tr><td colspan="4" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch("/api/admin/users?limit=500");
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((u) => `
      <tr>
        <td><strong>${escapeHtml(u.firstName || "")} ${escapeHtml(u.lastName || "")}</strong></td>
        <td>${escapeHtml(u.email || "")}</td>
        <td>${u.isActive !== false ? badge("active") : badge("inactive")}</td>
        <td>${fmtDate(u.createdAt)}</td>
      </tr>
    `).join("") : '<tr><td colspan="4" class="empty">No admin accounts.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="4" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadUsersWithPhotos() {
  const container = document.getElementById("photos-grid");
  if (!container) return;

  try {
    const res = await adminFetch("/api/admin/user-list?limit=60");
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((u) => {
      const initials = ((u.firstName || ' ')[0] + (u.lastName || ' ')[0]).toUpperCase().trim() || 'U';
      return `
        <div class="person">
          <div class="photo">${
            u.photoUrl
              ? `<img src="${escapeHtml(u.photoUrl)}" alt=""/>`
              : initials
          }</div>
          <h4>${escapeHtml(u.firstName || '')} ${escapeHtml(u.lastName || '')}</h4>
          <div class="role">${escapeHtml(String(u.role || '').replace(/_/g, ' '))}</div>
        </div>`;
    }).join('') : '<p class="muted">No users.</p>';
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
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
      const entry = r.entry || r;
      const user = r.user || null;
      return `
        <tr>
          <td>${user ? escapeHtml(`${user.firstName || ''} ${user.lastName || ''}`.trim()) : '—'}</td>
          <td>${escapeHtml(entry.email || '')}</td>
          <td>${entry.success ? 'Success' : 'Failed'}</td>
          <td>${escapeHtml(entry.ipAddress || '')}</td>
          <td>${escapeHtml(entry.reason || '')}</td>
          <td>${fmtDateTime(entry.createdAt)}</td>
        </tr>`;
    }).join('') : '<tr><td colspan="6" class="empty">No records.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

// ---------- Users hub (list.html) ----------
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

    const recent = [...users].sort((a, b) =>
      new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    ).slice(0, 5);

    const tbody = document.getElementById('us-recent-tbody');
    if (tbody) {
      tbody.innerHTML = recent.length ? recent.map((u) => `
        <tr class="row-clickable"
            onclick="FPU_ADMIN_SPA.navigateToWithQuery('user-profile', { id: ${u.id} })">
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

// ---------- All users (flat table) ----------
async function loadAllUsers() {
  const tbody = document.getElementById('au-tbody');
  const countEl = document.getElementById('au-count');
  if (!tbody) return;

  const role   = (document.getElementById('au-filter-role') || {}).value || '';
  const active = (document.getElementById('au-filter-active') || {}).value || '';
  const dept   = (document.getElementById('au-filter-dept') || {}).value || '';
  const search = (document.getElementById('au-search') || {}).value || '';

  const qs = new URLSearchParams({ limit: 500 });
  if (role)   qs.set('role', role);
  if (active) qs.set('isActive', active);
  if (dept)   qs.set('departmentId', dept);
  if (search) qs.set('search', search);

  tbody.innerHTML = '<tr><td colspan="8" class="empty">Loading…</td></tr>';
  if (countEl) countEl.textContent = 'Loading…';

  try {
    const res = await adminFetch(`/api/admin/user-list?${qs}`);
    const json = await res.json();
    const users = json.data || [];

    const activeCount = users.filter((u) => u.isActive !== false).length;
    setText('au-stat-total', users.length);
    setText('au-stat-active', activeCount);
    setText('au-stat-inactive', users.length - activeCount);
    setText('au-stat-roles', new Set(users.map((u) => u.role)).size);

    if (countEl) countEl.textContent = `Showing ${users.length} user${users.length === 1 ? '' : 's'}`;

    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">No users found.</td></tr>';
      return;
    }

    if (window.FPU_PAGINATE && typeof window.FPU_PAGINATE.mount === 'function') {
      window.FPU_PAGINATE.mount(tbody, users, {
        pageSize: 25,
        renderRow: (u) => `
          <tr class="row-clickable"
              onclick="FPU_ADMIN_SPA.navigateToWithQuery('user-profile', { id: ${u.id} })">
            <td><strong>${escapeHtml((u.firstName || '') + ' ' + (u.lastName || ''))}</strong></td>
            <td>${escapeHtml(u.email || '')}</td>
            <td><code>${escapeHtml(u.matricNumber || u.staffNumber || '—')}</code></td>
            <td>${roleBadge(u.role)}</td>
            <td>${escapeHtml(u.departmentName || u.department?.name || '—')}</td>
            <td>${u.isActive !== false ? badge('active') : badge('inactive')}</td>
            <td class="small muted">${fmtDate(u.createdAt)}</td>
            <td>
              <button class="btn btn-sm btn-outline"
                onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('user-profile', { id: ${u.id} })">View</button>
            </td>
          </tr>`,
      });
    } else {
      tbody.innerHTML = users.map((u) => `
        <tr class="row-clickable"
            onclick="FPU_ADMIN_SPA.navigateToWithQuery('user-profile', { id: ${u.id} })">
          <td><strong>${escapeHtml((u.firstName || '') + ' ' + (u.lastName || ''))}</strong></td>
          <td>${escapeHtml(u.email || '')}</td>
          <td><code>${escapeHtml(u.matricNumber || u.staffNumber || '—')}</code></td>
          <td>${roleBadge(u.role)}</td>
          <td>${escapeHtml(u.departmentName || u.department?.name || '—')}</td>
          <td>${u.isActive !== false ? badge('active') : badge('inactive')}</td>
          <td class="small muted">${fmtDate(u.createdAt)}</td>
          <td>
            <button class="btn btn-sm btn-outline"
              onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('user-profile', { id: ${u.id} })">View</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

// ---------- Admin accounts only ----------
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
      <tr class="row-clickable"
          onclick="FPU_ADMIN_SPA.navigateToWithQuery('user-profile', { id: ${u.id} })">
        <td><strong>${escapeHtml((u.firstName || '') + ' ' + (u.lastName || ''))}</strong></td>
        <td>${escapeHtml(u.email || '')}</td>
        <td>${escapeHtml(u.phone || '—')}</td>
        <td>${u.isActive !== false ? badge('active') : badge('inactive')}</td>
        <td class="small muted">${u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : 'Never'}</td>
        <td class="small muted">${fmtDate(u.createdAt)}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-sm btn-outline"
              onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('user-form', { id: ${u.id} })">Edit</button>
            <button class="btn btn-sm btn-ghost"
              onclick="event.stopPropagation(); FPU_ADMIN.resetAdminPwd(${u.id})">Reset Pwd</button>
            ${u.id !== (getAdminUser() || {}).id
              ? `<button class="btn btn-sm btn-ghost"
                  onclick="event.stopPropagation(); FPU_ADMIN.toggleAdminActive(${u.id})">Toggle</button>`
              : ''}
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
    await adminFetch(`/api/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password: pwd }),
    });
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

// ============================================
// SESSIONS
// ============================================
async function loadSessions() {
  const container = document.getElementById("sessions-tbody");
  if (!container) return;
  container.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch("/api/admin/sessions");
    const result = await res.json();
    const rows = extractArray(result);

    if (!rows.length) {
      container.innerHTML = '<tr><td colspan="7" class="empty">No sessions yet. Create the first one.</td></tr>';
      return;
    }

    const sorted = [...rows].sort((a, b) => String(b.name).localeCompare(String(a.name)));

    const current = sorted.find((s) => s.isCurrent);
    const currPanel = document.getElementById('current-session-panel');
    if (current && currPanel) {
      currPanel.style.display = 'block';
      setText('current-session-name', current.name);
      setText('current-session-dates',
        `${current.startDate ? fmtDate(current.startDate) : '—'} → ${current.endDate ? fmtDate(current.endDate) : '—'}`
      );
      adminFetch(`/api/admin/students?limit=1&sessionId=${current.id}`)
        .then((r) => r.json())
        .then((j) => setText('current-session-count', (j.data || []).length))
        .catch(() => setText('current-session-count', '—'));
    } else if (currPanel) {
      currPanel.style.display = 'none';
    }

    const now = Date.now();
    const upcoming = sorted.filter((s) => s.startDate && new Date(s.startDate).getTime() > now).length;
    const past = sorted.filter((s) => s.endDate && new Date(s.endDate).getTime() < now).length;
    setText('ses-stat-total', sorted.length);
    setText('ses-stat-current', current ? 1 : 0);
    setText('ses-stat-upcoming', upcoming);
    setText('ses-stat-past', past);

    container.innerHTML = sorted.map((s) => {
      let duration = '—';
      if (s.startDate && s.endDate) {
        const ms = new Date(s.endDate) - new Date(s.startDate);
        const days = Math.round(ms / (1000 * 60 * 60 * 24));
        duration = `${days} days`;
      }

      return `
        <tr style="${s.isCurrent ? 'background:#ecfdf5;' : ''}">
          <td><strong>${escapeHtml(s.name)}</strong></td>
          <td>${fmtDate(s.startDate)}</td>
          <td>${fmtDate(s.endDate)}</td>
          <td>${escapeHtml(duration)}</td>
          <td>—</td>
          <td>${s.isCurrent ? badge('active') : (s.startDate && new Date(s.startDate) > new Date() ? badge('pending') : badge('muted'))}</td>
          <td>
            <div class="row-actions">
              ${!s.isCurrent
                ? `<button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.setCurrentSession(${s.id})">Set Current</button>`
                : '<span class="small muted">Current</span>'}
              <button class="btn btn-sm btn-ghost"
                onclick="FPU_ADMIN.deleteSession(${s.id}, '${escapeHtml(s.name)}')">Delete</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function setCurrentSession(id) {
  if (!confirm('Set this session as the current session?')) return;
  try {
    await adminFetch(`/api/admin/sessions/${id}/set-current`, { method: "POST" });
    showToast("Session updated.");
    loadSessions();
  } catch (err) { showToast("❌ " + err.message, "error"); }
}

async function deleteSession(id, name) {
  if (!confirm(`Delete session "${name}"? This does not delete enrollments but removes the session record.`)) return;
  try {
    await adminFetch(`/api/admin/sessions/${id}`, { method: 'DELETE' });
    showToast('Session deleted.');
    loadSessions();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

// ============================================
// PROGRAMMES
// ============================================
async function loadProgrammes() {
  const container = document.getElementById("programmes-tbody");
  if (!container) return;
  container.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';

  const level = (document.getElementById("prog-filter-level") || {}).value || "";
  const departmentId = (document.getElementById("prog-filter-dept") || {}).value || "";
  const search = (document.getElementById("prog-filter-search") || {}).value || "";

  const qs = new URLSearchParams();
  if (level) qs.set("level", level);
  if (departmentId) qs.set("departmentId", departmentId);
  if (search) qs.set("search", search);

  try {
    const res = await adminFetch(`/api/admin/programmes?${qs}`);
    const result = await res.json();
    const rows = extractArray(result);

    const nd   = rows.filter((p) => p.level === 'ND').length;
    const hnd  = rows.filter((p) => p.level === 'HND').length;
    const cert = rows.filter((p) => p.level === 'CERT').length;
    setText('prog-stat-total', rows.length);
    setText('prog-stat-nd', nd);
    setText('prog-stat-hnd', hnd);
    setText('prog-stat-cert', cert);

    container.innerHTML = rows.length ? rows.map((p) => `
      <tr>
        <td><code>${escapeHtml(p.code)}</code></td>
        <td>${escapeHtml(p.name)}</td>
        <td>${badge(p.level)}</td>
        <td>${escapeHtml(p.departmentName || p.department?.name || '—')}</td>
        <td>${p.durationYears || 2} yrs</td>
        <td>${p.studentsCount || 0}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-sm btn-outline"
              onclick="FPU_ADMIN_SPA.navigateToWithQuery('programme-form', { id: ${p.id} })">Edit</button>
          </div>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="7" class="empty">No programmes.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

// ============================================
// COURSES (department-first)
// ============================================
function inferCourseYear(course) {
  if (course.yearOfStudy) return Number(course.yearOfStudy);
  const m = String(course.code || '').match(/(\d)(\d)(\d)/);
  if (!m) return null;
  const digit = Number(m[1]);
  return digit === 1 ? 1 : digit === 2 ? 2 : null;
}

async function loadCourseDepartments() {
  const grid = document.getElementById('course-dept-grid');
  if (!grid) return;

  const schoolId = (document.getElementById('course-filter-school') || {}).value || '';

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading departments…</div>';

  try {
    const [deptRes, courseRes, schoolRes] = await Promise.all([
      adminFetch('/api/admin/departments'),
      adminFetch('/api/admin/courses?limit=2000'),
      adminFetch('/api/admin/schools'),
    ]);

    const depts   = (await deptRes.json()).data   || [];
    const courses = (await courseRes.json()).data || [];
    const schools = (await schoolRes.json()).data || [];

    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    const byDept = new Map();
    for (const d of depts) {
      byDept.set(d.id, { dept: d, courses: [] });
    }
    for (const c of courses) {
      if (!c.departmentId) continue;
      if (!byDept.has(c.departmentId)) continue;
      byDept.get(c.departmentId).courses.push(c);
    }

    const visible = [...byDept.values()].filter(({ dept }) => {
      if (!schoolId) return true;
      return Number(dept.schoolId) === Number(schoolId);
    });

    let totalCourses = 0;
    let totalUnits = 0;
    for (const { courses: list } of visible) {
      totalCourses += list.length;
      totalUnits   += list.reduce((s, c) => s + (Number(c.unit) || 0), 0);
    }
    setText('crs-stat-total', totalCourses);
    setText('crs-stat-units', totalUnits);
    setText('crs-stat-departments', visible.length);
    setText('crs-stat-with-courses', visible.filter((d) => d.courses.length > 0).length);

    if (!visible.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
        <div class="icon">📚</div>
        <p>No departments found.</p>
      </div>`;
      return;
    }

    visible.sort((a, b) => String(a.dept.code).localeCompare(String(b.dept.code)));

    grid.innerHTML = visible.map(({ dept, courses: list }) => {
      const total = list.length;
      const units = list.reduce((s, c) => s + (Number(c.unit) || 0), 0);
      const school = schoolMap.get(dept.schoolId);

      const ndCount  = list.filter((c) => c.level === 'ND').length;
      const hndCount = list.filter((c) => c.level === 'HND').length;

      const isEmpty = total === 0;

      return `
        <div class="course-dept-card ${isEmpty ? 'empty' : ''}"
             ${isEmpty ? '' : `data-dept-id="${dept.id}" data-dept-name="${escapeHtml(dept.name)}"`}>
          <div class="cdc-head">
            <span class="cdc-code">${escapeHtml(dept.code)}</span>
            <span class="cdc-school">${escapeHtml(school?.code || '')}</span>
          </div>
          <h3>${escapeHtml(dept.name)}</h3>
          <div class="cdc-stats">
            <div class="cdc-stat">
              <span class="num">${total}</span>
              <span class="label">course${total === 1 ? '' : 's'}</span>
            </div>
            <div class="cdc-stat units">
              <span class="num">${units}</span>
              <span class="label">credit unit${units === 1 ? '' : 's'}</span>
            </div>
          </div>
          <div class="cdc-split">
            ${ndCount  ? `<span class="cdc-chip nd">ND: ${ndCount}</span>` : ''}
            ${hndCount ? `<span class="cdc-chip hnd">HND: ${hndCount}</span>` : ''}
            ${!ndCount && !hndCount ? `<span class="cdc-chip">No courses</span>` : ''}
          </div>
          <div class="cdc-footer">
            <span>${isEmpty ? 'No courses yet' : 'View courses →'}</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.course-dept-card[data-dept-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const deptId   = Number(card.dataset.deptId);
        const deptName = card.dataset.deptName;
        FPU_ADMIN_SPA.navigateToWithQuery('courses-by-dept', {
          departmentId: deptId,
          name: deptName,
        });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

async function loadDepartmentCourses() {
  const root = document.getElementById('course-by-dept-root');
  if (!root) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const departmentId = params.get('departmentId') || '';
  const deptName     = params.get('name') || 'Department';

  const titleEl = document.getElementById('course-dept-title');
  const subEl   = document.getElementById('course-dept-subtitle');
  if (titleEl) titleEl.textContent = deptName;
  if (subEl)   subEl.textContent   = `Courses offered by ${deptName}, grouped by level, year, and semester`;

  if (!departmentId) {
    root.innerHTML = '<div class="alert alert-warning">No department selected.</div>';
    return;
  }

  root.innerHTML = '<div class="loading"><span class="spinner"></span> Loading courses…</div>';

  try {
    const res = await adminFetch(`/api/admin/courses?departmentId=${departmentId}&limit=500`);
    const json = await res.json();
    const courses = json.data || [];

    const totalCourses = courses.length;
    const totalUnits   = courses.reduce((s, c) => s + (Number(c.unit) || 0), 0);
    setText('cbd-stat-total', totalCourses);
    setText('cbd-stat-units', totalUnits);

    if (!courses.length) {
      root.innerHTML = `
        <div class="empty-state">
          <div class="icon">📖</div>
          <p>No courses have been created for this department yet.</p>
          <div style="margin-top:14px;">
            <button class="btn btn-primary"
              onclick="FPU_ADMIN_SPA.navigateToWithQuery('course-form', { departmentId: ${departmentId} })">
              + Add First Course
            </button>
          </div>
        </div>`;
      return;
    }

    const LEVELS = ['ND', 'HND', 'CERT'];
    const SEMESTERS = ['first', 'second'];
    const YEARS = [1, 2];

    const buckets = {};
    for (const lvl of LEVELS) {
      for (const yr of YEARS) {
        for (const sem of SEMESTERS) {
          buckets[`${lvl}-${yr}-${sem}`] = [];
        }
      }
    }
    delete buckets['CERT-2-first'];
    delete buckets['CERT-2-second'];

    const unclassified = [];

    for (const c of courses) {
      const lvl = String(c.level || 'ND').toUpperCase();
      const yr  = inferCourseYear(c);
      const sem = String(c.semester || 'first').toLowerCase();

      const key = `${lvl}-${yr}-${sem}`;
      if (buckets[key]) {
        buckets[key].push(c);
      } else {
        unclassified.push(c);
      }
    }

    const renderSection = (lvl, yr, sem) => {
      const key = `${lvl}-${yr}-${sem}`;
      const list = buckets[key] || [];
      if (!list.length) return '';

      const sectionUnits = list.reduce((s, c) => s + (Number(c.unit) || 0), 0);

      return `
        <div class="course-section">
          <div class="course-section-head">
            <div>
              <span class="course-section-title">${lvl} ${yr} — ${sem === 'first' ? 'First' : 'Second'} Semester</span>
              <span class="course-section-count">${list.length} course${list.length === 1 ? '' : 's'}</span>
            </div>
            <div class="course-section-units">
              <span class="units-num">${sectionUnits}</span>
              <span class="units-lbl">credit unit${sectionUnits === 1 ? '' : 's'}</span>
            </div>
          </div>
          <div class="table-wrap">
            <table class="table-admin">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Unit</th>
                  <th>Type</th>
                  <th style="width:100px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${list.map((c) => `
                  <tr>
                    <td><code>${escapeHtml(c.code || '')}</code></td>
                    <td>${escapeHtml(c.title || '')}</td>
                    <td class="num">${Number(c.unit) || 0}</td>
                    <td>${c.isElective ? '<span class="tag-pill gold">Elective</span>' : '<span class="tag-pill">Core</span>'}</td>
                    <td>
                      <div class="row-actions">
                        <button class="btn btn-sm btn-outline"
                          onclick="FPU_ADMIN_SPA.navigateToWithQuery('course-form', { id: ${c.id} })">
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    };

    const renderLevelBlock = (lvl) => {
      const blocks = [];
      for (const yr of YEARS) {
        for (const sem of SEMESTERS) {
          const html = renderSection(lvl, yr, sem);
          if (html) blocks.push(html);
        }
      }
      if (!blocks.length) {
        return `<p class="muted" style="padding:20px 0;">No ${lvl} courses registered.</p>`;
      }
      return blocks.join('');
    };

    const levelTotals = {};
    for (const lvl of LEVELS) {
      let count = 0;
      let units = 0;
      for (const yr of YEARS) {
        for (const sem of SEMESTERS) {
          const list = buckets[`${lvl}-${yr}-${sem}`] || [];
          count += list.length;
          units += list.reduce((s, c) => s + (Number(c.unit) || 0), 0);
        }
      }
      levelTotals[lvl] = { count, units };
    }

    root.innerHTML = `
      <div class="course-level-tabs" role="tablist">
        ${LEVELS.map((lvl, i) => `
          <button class="course-level-tab ${i === 0 ? 'active' : ''}"
                  data-level="${lvl}">
            ${lvl}
            <span class="tab-count">${levelTotals[lvl].count} · ${levelTotals[lvl].units}u</span>
          </button>
        `).join('')}
      </div>

      ${LEVELS.map((lvl, i) => `
        <div class="course-level-panel ${i === 0 ? 'active' : ''}" data-level-panel="${lvl}">
          ${renderLevelBlock(lvl)}
        </div>
      `).join('')}

      ${unclassified.length ? `
        <div class="course-section">
          <div class="course-section-head">
            <div>
              <span class="course-section-title">Unclassified</span>
              <span class="course-section-count">${unclassified.length} course${unclassified.length === 1 ? '' : 's'}</span>
            </div>
          </div>
          <div class="table-wrap">
            <table class="table-admin">
              <thead>
                <tr><th>Code</th><th>Title</th><th>Unit</th><th>Level</th><th>Semester</th></tr>
              </thead>
              <tbody>
                ${unclassified.map((c) => `
                  <tr>
                    <td><code>${escapeHtml(c.code || '')}</code></td>
                    <td>${escapeHtml(c.title || '')}</td>
                    <td class="num">${Number(c.unit) || 0}</td>
                    <td>${escapeHtml(c.level || '')}</td>
                    <td>${escapeHtml(c.semester || '')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
    `;

    root.querySelectorAll('.course-level-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.course-level-tab').forEach((b) => b.classList.remove('active'));
        root.querySelectorAll('.course-level-panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        const lvl = btn.dataset.level;
        const panel = root.querySelector(`.course-level-panel[data-level-panel="${lvl}"]`);
        if (panel) panel.classList.add('active');
      });
    });
  } catch (err) {
    root.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

async function loadCourses() {
  const container = document.getElementById("courses-tbody");
  if (!container) return;

  const level = (document.getElementById("courses-level") || {}).value || "";
  const semester = (document.getElementById("courses-semester") || {}).value || "";
  const search = (document.getElementById("courses-search") || {}).value || "";

  const qs = new URLSearchParams({ limit: 500 });
  if (level) qs.set("level", level);
  if (semester) qs.set("semester", semester);
  if (search) qs.set("search", search);

  container.innerHTML = '<tr><td colspan="6" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/courses?${qs}`);
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((c) => `
      <tr>
        <td><code>${escapeHtml(c.code)}</code></td>
        <td>${escapeHtml(c.title)}</td>
        <td class="num">${c.unit}</td>
        <td>${escapeHtml(c.level)}</td>
        <td>${escapeHtml(c.semester)}</td>
        <td>${c.isElective ? 'Elective' : 'Core'}</td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="empty">No courses.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

// ============================================
// SCHOOLS
// ============================================
async function loadSchools() {
  const container = document.getElementById("schools-tbody");
  if (!container) return;
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

// ============================================
// DEPARTMENTS
// ============================================
async function loadDepartments() {
  const container = document.getElementById("departments-tbody");
  if (!container) return;
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

    grid.innerHTML = depts.map((d) => {
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

// ============================================
// ALLOCATIONS
// ============================================
async function loadAllocations() {
  const container = document.getElementById("allocations-tbody");
  if (!container) return;
  container.innerHTML = '<tr><td colspan="5" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch("/api/admin/allocations");
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.course?.code || '')} — ${escapeHtml(r.course?.title || '')}</td>
        <td>${escapeHtml(r.lecturer?.firstName || '')} ${escapeHtml(r.lecturer?.lastName || '')}</td>
        <td>${escapeHtml(r.allocation?.semester || r.semester || '')}</td>
        <td>${r.allocation?.sessionId || r.sessionId || ''}</td>
        <td>—</td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="empty">No allocations.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadAllocationDepartments() {
  const grid = document.getElementById('alloc-dept-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading allocations…</div>';

  try {
    const [deptsRes, allocsRes, schoolsRes] = await Promise.all([
      adminFetch('/api/admin/departments'),
      adminFetch('/api/admin/allocations'),
      adminFetch('/api/admin/schools'),
    ]);

    const depts   = (await deptsRes.json()).data   || [];
    const allocs  = (await allocsRes.json()).data  || [];
    const schools = (await schoolsRes.json()).data || [];

    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    const byDept = new Map();
    for (const d of depts) {
      byDept.set(d.id, { dept: d, allocs: [] });
    }
    for (const a of allocs) {
      const course = a.course || {};
      const deptId = course.departmentId;
      if (!deptId || !byDept.has(deptId)) continue;
      byDept.get(deptId).allocs.push(a);
    }

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

    const visible = [...byDept.values()].filter((d) => d.allocs.length > 0);

    if (!visible.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">🔗</div><p>No allocations yet.</p></div>';
      return;
    }

    visible.sort((a, b) => String(a.dept.code).localeCompare(String(b.dept.code)));

    grid.innerHTML = visible.map(({ dept, allocs: list }) => {
      const units = list.reduce((s, a) => s + (Number(a.course?.unit) || 0), 0);
      const lecturerSet = new Set(list.map((a) => a.lecturer?.id).filter(Boolean));
      const school = schoolMap.get(dept.schoolId);

      return `
        <div class="alloc-dept-card" data-dept-id="${dept.id}" data-dept-name="${escapeHtml(dept.name)}">
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
            <span>View allocations</span>
            <span class="arrow">→</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.alloc-dept-card[data-dept-id]').forEach((card) => {
      card.addEventListener('click', () => {
        FPU_ADMIN_SPA.navigateToWithQuery('allocations-by-dept', {
          departmentId: Number(card.dataset.deptId),
          name: card.dataset.deptName,
        });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

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
      adminFetch(`/api/admin/allocations?courseId=`),
      adminFetch(`/api/admin/departments/${departmentId}`),
    ]);

    const allocs = (await allocsRes.json()).data || [];
    const dept = (await deptRes.json()).data;

    if (dept?.name && titleEl) titleEl.textContent = dept.name;

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
          </div>
          <div class="lect-card-body">
            ${list.map((a) => `
              <div class="lect-course-row">
                <span class="code">${escapeHtml(a.course?.code || '')}</span>
                <span class="title">${escapeHtml(a.course?.title || '')}</span>
                <span class="meta">${escapeHtml(a.allocation?.semester || '')}</span>
                <span class="unit">${Number(a.course?.unit) || 0}</span>
                <div class="actions">
                  <button class="btn btn-sm btn-outline"
                    onclick="FPU_ADMIN_SPA.navigateToWithQuery('allocation-form', { id: ${a.allocation?.id || a.id} })">Edit</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

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
// REGISTRATIONS
// ============================================
async function loadRegistrations() {
  const container = document.getElementById("reg-list-tbody") || document.getElementById("registrations-tbody");
  if (!container) return;

  const cols = container.id === "reg-list-tbody" ? 8 : 6;
  container.innerHTML = `<tr><td colspan="${cols}" class="empty">Loading…</td></tr>`;

  try {
    const res = await adminFetch("/api/admin/registrations/with-course?limit=200");
    const result = await res.json();
    const rows = extractArray(result);

    if (!rows.length) {
      container.innerHTML = `<tr><td colspan="${cols}" class="empty">No registrations.</td></tr>`;
      return;
    }

    container.innerHTML = rows.map((r) => {
      const reg = r.registration;
      const c = r.course || {};
      const courseLabel = `${escapeHtml(c.code || '')} — ${escapeHtml(c.title || '')}`;

      if (container.id === "reg-list-tbody") {
        return `
          <tr>
            <td>#${reg.id}</td>
            <td>Student #${reg.studentId}</td>
            <td>${courseLabel}</td>
            <td>${escapeHtml(reg.semester)}</td>
            <td>Session ${reg.sessionId}</td>
            <td>${badge(reg.status)}</td>
            <td>${fmtDate(reg.createdAt)}</td>
            <td>
              ${reg.status === "pending"
                ? `<div class="row-actions">
                     <button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.approveRegistration(${reg.id})">Approve</button>
                     <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.rejectRegistration(${reg.id})">Reject</button>
                   </div>`
                : "—"}
            </td>
          </tr>`;
      }

      return `
        <tr>
          <td>#${reg.id}</td>
          <td>Student #${reg.studentId}</td>
          <td>${courseLabel}</td>
          <td>${escapeHtml(reg.semester)}</td>
          <td>${badge(reg.status)}</td>
          <td>${fmtDate(reg.createdAt)}</td>
        </tr>`;
    }).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="${cols}" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function approveRegistration(id) {
  try {
    await adminFetch(`/api/admin/registrations/${id}/approve`, { method: "POST" });
    showToast("Registration approved.");
    loadRegistrations();
  } catch (err) { showToast("❌ " + err.message, "error"); }
}

async function rejectRegistration(id) {
  const reason = promptReason("Reason for rejection:");
  if (!reason) return;
  try {
    await adminFetch(`/api/admin/registrations/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    showToast("Registration rejected.", "warning");
    loadRegistrations();
  } catch (err) { showToast("❌ " + err.message, "error"); }
}

async function loadRegistrationStudents() {
  const grid = document.getElementById('reg-student-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading registrations…</div>';

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
// RESULTS
// ============================================
async function loadResults() {
  const container = document.getElementById("results-tbody");
  if (!container) return;

  const status = (document.getElementById("results-status") || {}).value || "";
  const qs = new URLSearchParams({ limit: 500 });
  if (status) qs.set("status", status);

  container.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/results?${qs}`);
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((r) => `
      <tr>
        <td>#${r.id}</td>
        <td>Student ${r.studentId}</td>
        <td>Course ${r.courseId}</td>
        <td class="num">${r.score}</td>
        <td>${r.grade ? `<span class="grade ${escapeHtml(r.grade)}">${escapeHtml(r.grade)}</span>` : '—'}</td>
        <td>${badge(r.status)}</td>
        <td>${fmtDate(r.updatedAt)}</td>
      </tr>
    `).join('') : '<tr><td colspan="7" class="empty">No results.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

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

  const status = (document.getElementById('rd-filter-status') || {}).value || '';
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
              ${pending ? `<button class="btn btn-sm btn-approve"
                onclick="FPU_ADMIN.bulkApproveCourseResults(${courseId})">✓ Approve All (${pending})</button>` : ''}
              ${approved ? `<button class="btn btn-sm btn-publish"
                onclick="FPU_ADMIN.bulkPublishCourseResults(${courseId})">📢 Publish (${approved})</button>` : ''}
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
    try {
      await adminFetch(`/api/admin/results/${id}/approve`, { method: 'POST' });
      ok++;
    } catch { failed++; }
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
      await adminFetch(`/api/admin/results/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
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
      try {
        await adminFetch(`/api/admin/results/${r.id}/approve`, { method: 'POST' });
        ok++;
      } catch { failed++; }
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

async function loadGradeScales() {
  const container = document.getElementById("grade-scales-tbody");
  if (!container) return;
  try {
    const res = await adminFetch("/api/admin/grade-scales");
    const result = await res.json();
    const rows = extractArray(result);
    container.innerHTML = rows.length ? rows.map((g) => `
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
            <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.deleteGradeScale(${g.id})">Delete</button>
          </div>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="empty">No grade scales.</td></tr>';

    // Health banner
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
    coverage += (max - min + 1);
    lastMax = Math.max(lastMax, max);
  }
  const cls = overlaps.length ? 'err' : coverage === 101 ? 'ok' : 'warn';
  health.innerHTML = `
    <div class="panel-body">
      <div class="gs-health-grid">
        <div class="gs-health-item">
          <div class="num ${cls}">${coverage}</div>
          <div class="label">Score coverage</div>
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
      ${overlaps.length ? `<div class="gs-overlap-list">${overlaps.map(escapeHtml).join('<br/>')}</div>` : ''}
    </div>`;
}

function setupGradeScalePreview(rows) {
  const input = document.getElementById('gs-preview-score');
  const result = document.getElementById('gs-preview-result');
  if (!input || !result) return;
  const render = () => {
    const v = Number(input.value);
    if (!Number.isFinite(v) || input.value === '') {
      result.innerHTML = '<div class="gs-preview-empty">Enter a score to preview</div>';
      return;
    }
    const active = rows.filter((r) => r.isActive !== false);
    const hit = active.find((b) => v >= Number(b.minScore) && v <= Number(b.maxScore));
    if (!hit) {
      result.innerHTML = `<div class="gs-preview-miss">Score ${v} falls outside all active bands.<br/>Students scoring this would get an F.</div>`;
      return;
    }
    result.innerHTML = `
      <div class="gs-preview-hit">
        <div class="gs-preview-grade ${escapeHtml(hit.grade)}">${escapeHtml(hit.grade)}</div>
        <div class="gs-preview-meta">
          <div class="label">Grade</div>
          <div class="value">${escapeHtml(hit.grade)} — ${escapeHtml(hit.remark || '')}</div>
          <div class="sub">${hit.minScore}–${hit.maxScore} → ${hit.points} points</div>
        </div>
      </div>`;
  };
  input.oninput = render;
  render();
}

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

async function loadTranscriptLookup() {
  const tbody = document.getElementById('tx-search-tbody');
  const countEl = document.getElementById('tx-count');
  const input = document.getElementById('tx-search');
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

    tbody.innerHTML = rows.length ? rows.map((s) => `
      <tr>
        <td><code>${escapeHtml(s.matricNumber || '')}</code></td>
        <td>${escapeHtml((s.firstName || '') + ' ' + (s.lastName || ''))}</td>
        <td>${escapeHtml(s.level || '')}</td>
        <td>${escapeHtml(s.programmeName || s.programme?.name || '—')}</td>
        <td>${s.isActive !== false ? badge('active') : badge('inactive')}</td>
        <td>
          <button class="btn btn-sm btn-primary"
            onclick="FPU_ADMIN_SPA.navigateToWithQuery('transcript-by-student', { studentId: ${s.id} })">
            Open
          </button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="empty">No students found.</td></tr>';
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadStudentTranscript() {
  const root = document.getElementById('tx-root');
  if (!root) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const studentId = params.get('studentId') || '';

  if (!studentId) {
    root.innerHTML = '<div class="alert alert-warning">No student selected.</div>';
    return;
  }

  root.innerHTML = '<div class="loading"><span class="spinner"></span> Loading transcript…</div>';

  try {
    const res = await adminFetch(`/api/admin/transcript/${studentId}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Could not load transcript');

    const student = json.student || {};
    const summary = json.summary || {};
    const rows = json.rows || [];

    const subEl = document.getElementById('tx-subtitle');
    if (subEl) subEl.textContent = `${student.matricNumber || ''} · ${student.firstName || ''} ${student.lastName || ''}`;

    const initials = ((student.firstName || ' ')[0] + (student.lastName || ' ')[0]).toUpperCase().trim() || 'S';

    // Group rows by session + semester
    const groups = new Map();
    for (const r of rows) {
      const key = `${r.result?.sessionId || '?'}|${r.result?.semester || '?'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }

    root.innerHTML = `
      <div class="tx-letterhead">
        <h1>Federal Polytechnic Ugep</h1>
        <div class="motto">Citadel of Technical Excellence</div>
        <div class="doc-type">Official Academic Transcript</div>
      </div>

      <div class="tx-bio">
        <div class="tx-bio-photo">${
          student.photoUrl ? `<img src="${escapeHtml(student.photoUrl)}" alt="" />` : escapeHtml(initials)
        }</div>
        <div class="tx-bio-fields">
          <div class="row"><span class="k">Full Name</span><span class="v">${escapeHtml((student.firstName || '') + ' ' + (student.lastName || ''))}</span></div>
          <div class="row"><span class="k">Matric No</span><span class="v">${escapeHtml(student.matricNumber || '—')}</span></div>
          <div class="row"><span class="k">Level</span><span class="v">${escapeHtml(student.level || '—')}</span></div>
          <div class="row"><span class="k">Email</span><span class="v">${escapeHtml(student.email || '—')}</span></div>
        </div>
        <div class="tx-bio-fields">
          <div class="row"><span class="k">Department</span><span class="v">${escapeHtml(student.department?.name || '—')}</span></div>
          <div class="row"><span class="k">Programme</span><span class="v">${escapeHtml(student.programme?.name || '—')}</span></div>
          <div class="row"><span class="k">School</span><span class="v">${escapeHtml(student.school?.name || '—')}</span></div>
          <div class="row"><span class="k">Printed</span><span class="v">${fmtDateTime(new Date())}</span></div>
        </div>
      </div>

      <div class="tx-summary-grid">
        <div class="tx-summary-tile cgpa">
          <div class="label">CGPA</div>
          <div class="value">${Number(summary.cgpa || 0).toFixed(2)}</div>
          <div class="sub">${escapeHtml(summary.classification || '—')}</div>
        </div>
        <div class="tx-summary-tile">
          <div class="label">Total Units</div>
          <div class="value">${summary.totalUnits || 0}</div>
        </div>
        <div class="tx-summary-tile">
          <div class="label">Total Points</div>
          <div class="value">${summary.totalPoints || 0}</div>
        </div>
        <div class="tx-summary-tile">
          <div class="label">Courses</div>
          <div class="value">${rows.length}</div>
        </div>
      </div>

      ${[...groups.entries()].map(([key, list]) => {
        const [sid, sem] = key.split('|');
        const units = list.reduce((s, r) => s + (Number(r.course?.unit) || 0), 0);
        const points = list.reduce((s, r) => s + (Number(r.course?.unit) || 0) * (Number(r.result?.points) || 0), 0);
        const gpa = units > 0 ? points / units : 0;
        return `
          <div class="tx-sheet">
            <div class="tx-sheet-head">
              <span class="title">Session ${sid} — ${escapeHtml(sem)} Semester</span>
              <span class="gpa"><strong>${gpa.toFixed(2)}</strong> GPA</span>
            </div>
            <div class="table-wrap">
              <table class="table-admin result-table">
                <thead>
                  <tr><th>Code</th><th>Title</th><th>Unit</th><th>Score</th><th>Grade</th><th>Points</th></tr>
                </thead>
                <tbody>
                  ${list.map((r) => `
                    <tr>
                      <td><code>${escapeHtml(r.course?.code || '')}</code></td>
                      <td>${escapeHtml(r.course?.title || '')}</td>
                      <td class="num">${Number(r.course?.unit) || 0}</td>
                      <td class="num">${r.result?.score ?? '—'}</td>
                      <td><span class="grade ${escapeHtml(r.result?.grade || '')}">${escapeHtml(r.result?.grade || '—')}</span></td>
                      <td class="num">${r.result?.points ?? '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }).join('')}

      <div class="tx-signature-block">
        <div>
          <div class="tx-sig-line"></div>
          <div class="tx-sig-caption">Registrar's Signature &amp; Date</div>
        </div>
        <div>
          <div class="tx-sig-line"></div>
          <div class="tx-sig-caption">Official Stamp</div>
        </div>
      </div>
    `;

    const printBtn = document.getElementById('tx-print');
    if (printBtn) printBtn.onclick = () => window.print();
    const exportBtn = document.getElementById('tx-export');
    if (exportBtn) exportBtn.onclick = () => exportTableAsCSV(root.querySelector('.table-admin'), `transcript-${student.matricNumber || student.id}.csv`);
  } catch (err) {
    root.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// STAFF
// ============================================
async function loadStaff() {
  const container = document.getElementById("staff-tbody");
  if (!container) return;

  const role = (document.getElementById("staff-role") || {}).value || "";
  const qs = new URLSearchParams();
  if (role) qs.set("role", role);

  container.innerHTML = '<tr><td colspan="5" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/staff?${qs}`);
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((s) => `
      <tr>
        <td>${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}</td>
        <td>${escapeHtml(s.email)}</td>
        <td>${escapeHtml(String(s.role || '').replace(/_/g, ' '))}</td>
        <td>${s.departmentId || '—'}</td>
        <td>${s.isActive !== false ? 'Active' : 'Inactive'}</td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="empty">No staff.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

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
    setText('staff-count-principal', allStaff.filter((s) =>
      ['bursar','registrar','rector','librarian','exam_officer','academic_officer','admission_officer'].includes(s.role)
    ).length);
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

async function loadStaffProfile() {
  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const id = params.get('id');
  if (!id) return;

  const subEl = document.getElementById('sp-subtitle');
  try {
    const res = await adminFetch(`/api/admin/staff/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    const u = json.data;

    if (subEl) subEl.textContent = `${u.email || ''} · ${String(u.role || '').replace(/_/g, ' ')}`;

    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    const initials = ((u.firstName || ' ')[0] + (u.lastName || ' ')[0]).toUpperCase().trim() || 'S';
    const avatar = document.getElementById('sp-avatar');
    if (avatar) {
      if (u.photoUrl) avatar.innerHTML = `<img src="${escapeHtml(u.photoUrl)}" alt="" />`;
      else avatar.textContent = initials;
    }
    setText('sp-name', fullName);
    setText('sp-email', u.email);

    const badges = document.getElementById('sp-badges');
    if (badges) {
      badges.innerHTML = roleBadge(u.role) + ' ' + (u.isActive !== false ? badge('active') : badge('inactive'));
    }

    function row(k, v) {
      return `<div class="field-row"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(v || '—')}</span></div>`;
    }

    const contact = document.getElementById('sp-contact');
    if (contact) {
      contact.innerHTML = [
        row('Phone', u.phone),
        row('Gender', u.gender),
        row('Date of Birth', u.dateOfBirth ? fmtDate(u.dateOfBirth) : ''),
        row('Address', u.address),
        row('State of Origin', u.stateOfOrigin),
      ].join('');
    }

    const emp = document.getElementById('sp-employment');
    if (emp) {
      const sp = u.staffProfile || {};
      emp.innerHTML = [
        row('Department', u.department?.name),
        row('School', u.school?.name),
        row('Rank', sp.rank),
        row('Specialization', sp.specialization),
        row('Qualification', sp.qualification),
        row('Employment Date', sp.employmentDate ? fmtDate(sp.employmentDate) : ''),
      ].join('');
    }

    // Courses taught
    try {
      const coursesRes = await adminFetch(`/api/admin/allocations?lecturerId=${id}&limit=500`);
      const coursesJson = await coursesRes.json();
      const allocs = coursesJson.data || [];
      const courseBody = document.getElementById('sp-courses');
      const countEl = document.getElementById('sp-courses-count');
      if (countEl) countEl.textContent = `${allocs.length} course${allocs.length === 1 ? '' : 's'}`;
      if (courseBody) {
        courseBody.innerHTML = allocs.length ? allocs.map((a) => `
          <div class="sp-course-row">
            <span class="code">${escapeHtml(a.course?.code || '')}</span>
            <span class="title">${escapeHtml(a.course?.title || '')}</span>
            <span class="units">${Number(a.course?.unit) || 0} u</span>
          </div>
        `).join('') : '<p class="muted" style="padding:16px;">No courses allocated.</p>';
      }
    } catch { /* silent */ }

    // Recent activity
    try {
      const auditRes = await adminFetch(`/api/admin/audit?userId=${id}&limit=8`);
      const auditJson = await auditRes.json();
      const logs = auditJson.data || [];
      const activity = document.getElementById('sp-activity');
      if (activity) {
        activity.innerHTML = logs.length ? logs.map((l) => {
          const log = l.log || l;
          return `
            <div class="activity-item">
              <div class="icon">📝</div>
              <div class="body">
                <strong>${escapeHtml(log.action)}</strong>
                <p>${escapeHtml(log.entity || '')}${log.entityId ? ' #' + escapeHtml(log.entityId) : ''}</p>
              </div>
              <span class="time">${timeAgo(log.createdAt)}</span>
            </div>`;
        }).join('') : '<p class="muted">No activity.</p>';
      }
    } catch { /* silent */ }

    // Wire action buttons
    document.getElementById('sp-back').onclick = () => history.back();
    document.getElementById('sp-edit').onclick = () => FPU_ADMIN_SPA.navigateToWithQuery('staff-form', { id });
    document.getElementById('sp-view-workload').onclick = () => FPU_ADMIN_SPA.navigateToWithQuery('staff-workload', { id });
    document.getElementById('sp-reset-pwd').onclick = async () => {
      const pwd = prompt('New password (default: principal1234):', 'principal1234');
      if (pwd === null) return;
      try {
        await adminFetch(`/api/admin/staff/${id}/reset-password`, {
          method: 'POST',
          body: JSON.stringify({ password: pwd }),
        });
        showToast('Password reset.', 'success');
      } catch (e) { showToast('❌ ' + e.message, 'error'); }
    };
    document.getElementById('sp-toggle-active').onclick = async () => {
      try {
        await adminFetch(`/api/admin/staff/${id}/toggle-active`, { method: 'POST' });
        showToast('Toggled.', 'success');
        loadStaffProfile();
      } catch (e) { showToast('❌ ' + e.message, 'error'); }
    };
    document.getElementById('sp-delete').onclick = async () => {
      if (!confirm(`Delete ${fullName}?`)) return;
      try {
        await adminFetch(`/api/admin/staff/${id}`, { method: 'DELETE' });
        showToast('Deleted.', 'success');
        FPU_ADMIN_SPA.navigateTo('staff');
      } catch (e) { showToast('❌ ' + e.message, 'error'); }
    };
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

async function loadStaffWorkload() {
  const lecturerSel = document.getElementById('sw-lecturer');
  const sessionSel = document.getElementById('sw-session');
  const result = document.getElementById('sw-result');
  if (!result) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const initialId = params.get('id');

  document.getElementById('sw-back').onclick = () => history.back();

  document.getElementById('sw-load').onclick = async () => {
    const lecturerId = lecturerSel?.value;
    const sessionId = sessionSel?.value;
    if (!lecturerId) { showToast('Select a staff member.', 'warning'); return; }

    result.innerHTML = '<div class="loading"><span class="spinner"></span> Loading workload…</div>';
    try {
      const qs = new URLSearchParams();
      if (sessionId) qs.set('sessionId', sessionId);
      const res = await adminFetch(`/api/admin/staff/${lecturerId}/workload?${qs}`);
      const json = await res.json();
      const d = json.data || {};
      const allocs = d.allocations || [];

      result.innerHTML = `
        <div class="stats-inline">
          <div class="stat-inline"><div class="label">Courses</div><div class="value">${d.totalCourses || 0}</div></div>
          <div class="stat-inline stat-inline-accent"><div class="label">Total Units</div><div class="value">${d.totalUnits || 0}</div></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Allocations</h3></div>
          <div class="panel-body flush">
            ${allocs.length ? allocs.map((a) => `
              <div class="sp-course-row">
                <span class="code">${escapeHtml(a.course?.code || '')}</span>
                <span class="title">${escapeHtml(a.course?.title || '')}</span>
                <span class="units">${Number(a.course?.unit) || 0} u</span>
              </div>
            `).join('') : '<p class="muted" style="padding:16px;">No allocations.</p>'}
          </div>
        </div>
      `;
    } catch (err) {
      result.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  };

  if (initialId && lecturerSel) {
    setTimeout(() => {
      lecturerSel.value = initialId;
      document.getElementById('sw-load').click();
    }, 400);
  }
}

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
          <button class="btn btn-sm btn-outline"
            onclick="FPU_ADMIN.assignHodDept(${h.id})">Assign Dept</button>
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
            <div class="hdc-avatar ${vacant ? 'vacant' : ''}">${
              hod?.photoUrl ? `<img src="${escapeHtml(hod.photoUrl)}" alt="" />` : escapeHtml(initials)
            }</div>
            <div class="hdc-hod-info">
              <div class="hdc-hod-name">${vacant ? 'Vacant' : escapeHtml(`${hod.firstName} ${hod.lastName}`)}</div>
              <div class="hdc-hod-email">${vacant ? 'No HOD assigned' : escapeHtml(hod.email)}</div>
            </div>
          </div>
          <div class="hdc-actions">
            ${vacant
              ? `<button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.assignHodDept(null, ${d.id})">Assign HOD</button>`
              : `<button class="btn btn-sm btn-outline" onclick="FPU_ADMIN_SPA.navigateToWithQuery('user-profile', { id: ${hod.id} })">View HOD</button>
                 <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.assignHodDept(null, ${d.id})">Replace</button>`}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

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

    const wlBtn = document.getElementById('lec-view-workloads');
    if (wlBtn) {
      wlBtn.onclick = () => FPU_ADMIN_SPA.navigateTo('staff');
    }
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

async function loadHods() {
  const container = document.getElementById("staff-tbody");
  if (!container) return;
  container.innerHTML = '<tr><td colspan="4" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch("/api/admin/hods");
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((h) => `
      <tr>
        <td><strong>${escapeHtml(h.firstName || "")} ${escapeHtml(h.lastName || "")}</strong></td>
        <td>${escapeHtml(h.email || "")}</td>
        <td>${h.departmentId || "—"}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="FPU_ADMIN.assignHodDept(${h.id})">Assign Dept</button>
        </td>
      </tr>
    `).join("") : '<tr><td colspan="4" class="empty">No HODs assigned.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="4" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadLecturers() {
  const container = document.getElementById("staff-tbody");
  if (!container) return;
  container.innerHTML = '<tr><td colspan="5" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch("/api/admin/lecturers");
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((l) => `
      <tr>
        <td><strong>${escapeHtml(l.firstName || "")} ${escapeHtml(l.lastName || "")}</strong></td>
        <td>${escapeHtml(l.email || "")}</td>
        <td>${escapeHtml(String(l.role || "").replace(/_/g, " "))}</td>
        <td>${l.departmentId || "—"}</td>
        <td>${l.isActive !== false ? badge("active") : badge("inactive")}</td>
      </tr>
    `).join("") : '<tr><td colspan="5" class="empty">No lecturers found.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function assignHodDept(hodId, departmentId = null) {
  if (!hodId && departmentId) {
    // Assign flow starting from department
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
    loadHods();
  } catch (err) {
    showToast("❌ " + err.message, "error");
  }
}

// ============================================
// TIMETABLE
// ============================================
async function loadTimetable() {
  const container = document.getElementById("timetable-tbody");
  if (!container) return;
  try {
    const res = await adminFetch("/api/admin/timetable");
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.course?.code || '')}</td>
        <td>${escapeHtml(r.slot?.dayOfWeek || r.dayOfWeek || '')}</td>
        <td>${escapeHtml(r.slot?.startTime || r.startTime || '')} – ${escapeHtml(r.slot?.endTime || r.endTime || '')}</td>
        <td>${escapeHtml(r.slot?.venue || r.venue || '')}</td>
        <td>${r.lecturer ? `${escapeHtml(r.lecturer.firstName)} ${escapeHtml(r.lecturer.lastName)}` : '—'}</td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="empty">No slots.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

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
    for (const d of depts) {
      byDept.set(d.id, { dept: d, slots: [] });
    }
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
        <div class="tt-dept-card ${isEmpty ? 'empty' : ''}"
             ${isEmpty ? '' : `data-dept-id="${b.dept.id}" data-dept-name="${escapeHtml(b.dept.name)}"`}>
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
        FPU_ADMIN_SPA.navigateToWithQuery('timetable-by-dept', {
          departmentId: Number(card.dataset.deptId),
          sessionId: sessionId || '',
          semester,
          name: card.dataset.deptName,
        });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

async function loadTimetableSheet() {
  const root = document.getElementById('tsheet-root');
  if (!root) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const departmentId = params.get('departmentId') || '';
  const sessionId = params.get('sessionId') || '';
  const semester = params.get('semester') || 'first';
  const deptName = params.get('name') || 'Department';

  const titleEl = document.getElementById('tsheet-title');
  const subEl = document.getElementById('tsheet-subtitle');
  if (titleEl) titleEl.textContent = deptName;
  if (subEl) subEl.textContent = `${semester} semester timetable`;

  if (!departmentId) {
    root.innerHTML = '<div class="alert alert-warning">No department selected.</div>';
    return;
  }

  root.innerHTML = '<div class="loading"><span class="spinner"></span> Loading timetable…</div>';

  try {
    const qs = new URLSearchParams({ limit: 1000 });
    if (sessionId) qs.set('sessionId', sessionId);
    if (semester) qs.set('semester', semester);

    const [slotsRes, deptRes, coursesRes, usersRes] = await Promise.all([
      adminFetch(`/api/admin/timetable?${qs}`),
      adminFetch(`/api/admin/departments/${departmentId}`),
      adminFetch('/api/admin/courses?limit=2000'),
      adminFetch('/api/admin/user-list?limit=500'),
    ]);

    const slots = (await slotsRes.json()).data || [];
    const dept = (await deptRes.json()).data || {};
    const courses = (await coursesRes.json()).data || [];
    const users = (await usersRes.json()).data || [];

    const courseById = new Map(courses.map((c) => [c.id, c]));
    const userById = new Map(users.map((u) => [u.id, u]));

    const deptSlots = slots
      .map((s) => ({ slot: s.slot || s, lecturer: s.lecturer, course: s.course }))
      .filter(({ course, slot }) => {
        const c = course || courseById.get(slot.courseId);
        return c && Number(c.departmentId) === Number(departmentId);
      })
      .sort((a, b) => {
        const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const d = days.indexOf(a.slot.dayOfWeek) - days.indexOf(b.slot.dayOfWeek);
        if (d !== 0) return d;
        return String(a.slot.startTime).localeCompare(String(b.slot.startTime));
      });

    const byDay = {};
    for (const s of deptSlots) {
      const day = s.slot.dayOfWeek;
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(s);
    }

    const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    root.innerHTML = `
      <div class="tt-sheet">
        <div class="tt-head">
          <div class="tt-head-logo">
            <img src="/images/logo.png" alt="FPU" />
          </div>
          <div class="tt-head-text">
            <div class="institution">Federal Polytechnic Ugep</div>
            <div class="school">Citadel of Technical Excellence</div>
            <div class="dept">${escapeHtml(dept.name || deptName)}</div>
            <div class="session-line">${escapeHtml(semester)} Semester Timetable ${sessionId ? ' · Session ' + sessionId : ''}</div>
          </div>
        </div>

        ${deptSlots.length === 0 ? `<div class="tt-empty">No timetable slots published for this semester yet.</div>` : `
          <table class="tt-table">
            <thead>
              <tr>
                <th class="col-days">Days</th>
                <th class="col-code">Code</th>
                <th class="col-cu">CU</th>
                <th class="col-title">Course Title</th>
                <th class="col-time">Time</th>
                <th class="col-lecturer">Lecturer</th>
                <th class="col-venue">Venue</th>
              </tr>
            </thead>
            <tbody>
              ${DAYS.filter((d) => byDay[d]).map((day) => {
                const list = byDay[day];
                return list.map((s, idx) => {
                  const c = s.course || courseById.get(s.slot.courseId) || {};
                  const lecturer = s.lecturer || userById.get(s.slot.lecturerId);
                  const lecturerName = lecturer ? `${lecturer.firstName || ''} ${lecturer.lastName || ''}`.trim() : '—';
                  const isFirst = idx === 0;
                  return `
                    <tr class="${isFirst ? 'day-row' : ''}">
                      ${isFirst ? `<td class="day-cell" rowspan="${list.length}">${day}</td>` : ''}
                      <td class="col-code">${escapeHtml(c.code || '')}</td>
                      <td class="col-cu">${Number(c.unit) || 0}</td>
                      <td class="col-title">${escapeHtml(c.title || '')}</td>
                      <td class="col-time">${escapeHtml(s.slot.startTime)} – ${escapeHtml(s.slot.endTime)}</td>
                      <td class="col-lecturer">${escapeHtml(lecturerName)}</td>
                      <td class="col-venue">${escapeHtml(s.slot.venue || '')}</td>
                    </tr>
                  `;
                }).join('');
              }).join('')}
            </tbody>
          </table>
        `}

        <div class="tt-signature">
          <div class="tt-signature-block">
            <div class="name">___________________________</div>
            <div class="role">Head of Department</div>
          </div>
        </div>
      </div>
    `;

    const printBtn = document.getElementById('tsheet-print');
    if (printBtn) printBtn.onclick = () => window.print();

    const exportBtn = document.getElementById('tsheet-export');
    if (exportBtn) exportBtn.onclick = () => {
      const table = root.querySelector('.tt-table');
      if (table) exportTableAsCSV(table, `timetable-${dept.code || departmentId}.csv`);
    };

    const addBtn = document.getElementById('tsheet-add');
    if (addBtn) addBtn.onclick = () => FPU_ADMIN_SPA.navigateToWithQuery('timetable-form', {
      departmentId,
      sessionId,
      semester,
      name: deptName,
    });

    const switchBtn = document.getElementById('tsheet-switch-sem');
    if (switchBtn) switchBtn.onclick = () => {
      const next = semester === 'first' ? 'second' : 'first';
      FPU_ADMIN_SPA.navigateToWithQuery('timetable-by-dept', {
        departmentId,
        sessionId,
        semester: next,
        name: deptName,
      });
    };
  } catch (err) {
    root.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// EXAMS
// ============================================
async function loadExams() {
  const container = document.getElementById("exams-tbody");
  if (!container) return;
  try {
    const res = await adminFetch("/api/admin/exams");
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.course?.code || '')}</td>
        <td>${fmtDate(r.exam?.examDate || r.examDate)}</td>
        <td>${escapeHtml(r.exam?.startTime || r.startTime || '')} – ${escapeHtml(r.exam?.endTime || r.endTime || '')}</td>
        <td>${escapeHtml(r.exam?.venue || r.venue || '')}</td>
        <td>${escapeHtml(r.exam?.invigilators || r.invigilators || '')}</td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="empty">No exams.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

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

    let total = 0, totalDepts = new Set(), totalDays = new Set(), totalVenues = new Set();
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
        <div class="ex-school-card ${isEmpty ? 'empty' : ''}"
             ${isEmpty ? '' : `data-school-id="${b.school.id}" data-school-name="${escapeHtml(b.school.name)}"`}>
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
        FPU_ADMIN_SPA.navigateToWithQuery('exam-sheet', {
          schoolId: Number(card.dataset.schoolId),
          sessionId: sessionId || '',
          semester,
          name: card.dataset.schoolName,
        });
      });
    });

    // Periods display
    const periodsBody = document.getElementById('ex-periods-body');
    if (periodsBody) {
      const periods = window.__examPeriods || [
        { label: 'Period 1', start: '09:00', end: '11:00' },
        { label: 'Period 2', start: '11:00', end: '13:00' },
        { label: 'Period 3', start: '13:00', end: '15:00' },
        { label: 'Period 4', start: '15:00', end: '17:00' },
      ];
      periodsBody.innerHTML = `<div class="period-chips">${periods.map((p) => `
        <div class="period-chip">
          <span class="label">${escapeHtml(p.label)}</span>
          <span class="value">${escapeHtml(p.start)} – ${escapeHtml(p.end)}</span>
        </div>
      `).join('')}</div>`;
    }
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

async function loadExamSheet() {
  const root = document.getElementById('exsheet-root');
  if (!root) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const schoolId = params.get('schoolId') || '';
  const sessionId = params.get('sessionId') || '';
  const semester = params.get('semester') || 'first';
  const schoolName = params.get('name') || 'School';

  const titleEl = document.getElementById('exsheet-title');
  const subEl = document.getElementById('exsheet-subtitle');
  if (titleEl) titleEl.textContent = `${schoolName} Exam Timetable`;
  if (subEl) subEl.textContent = `${semester} semester · Session ${sessionId || 'current'}`;

  if (!schoolId) {
    root.innerHTML = '<div class="alert alert-warning">No school selected.</div>';
    return;
  }

  root.innerHTML = '<div class="loading"><span class="spinner"></span> Loading exams…</div>';

  try {
    const [examsRes, deptsRes, coursesRes, schoolsRes] = await Promise.all([
      adminFetch(`/api/admin/exams?${new URLSearchParams({ sessionId, semester })}`),
      adminFetch('/api/admin/departments'),
      adminFetch('/api/admin/courses?limit=2000'),
      adminFetch('/api/admin/schools'),
    ]);

    const exams = (await examsRes.json()).data || [];
    const depts = (await deptsRes.json()).data || [];
    const courses = (await coursesRes.json()).data || [];
    const schools = (await schoolsRes.json()).data || [];

    const school = schools.find((s) => Number(s.id) === Number(schoolId));
    const schoolDeptIds = new Set(depts.filter((d) => Number(d.schoolId) === Number(schoolId)).map((d) => d.id));
    const courseById = new Map(courses.map((c) => [c.id, c]));

    const filtered = exams
      .map((e) => ({ exam: e.exam || e, course: courseById.get(e.exam?.courseId || e.courseId) }))
      .filter(({ course }) => course && schoolDeptIds.has(course.departmentId));

    const periods = [
      { label: 'Period 1', start: '09:00', end: '11:00' },
      { label: 'Period 2', start: '11:00', end: '13:00' },
      { label: 'Period 3', start: '13:00', end: '15:00' },
      { label: 'Period 4', start: '15:00', end: '17:00' },
    ];

    // Group by date
    const byDate = new Map();
    for (const item of filtered) {
      const d = String(item.exam.examDate).slice(0, 10);
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d).push(item);
    }

    const sortedDates = [...byDate.keys()].sort();

    const cellFor = (items, period) => {
      const matching = items.filter(({ exam }) => {
        const s = __ttTimeToMin(exam.startTime) ?? -1;
        const e = __ttTimeToMin(exam.endTime) ?? -1;
        const ps = __ttTimeToMin(period.start) ?? -1;
        const pe = __ttTimeToMin(period.end) ?? -1;
        return s < pe && ps < e;
      });
      if (!matching.length) return '<td class="col-period"><div class="ex-cell-empty">—</div></td>';
      return `<td class="col-period">${matching.map(({ exam, course }) => `
        <div class="ex-cell-block">
          <div class="ex-cell-course">${escapeHtml(course.code || '')}</div>
          <div class="ex-cell-title">${escapeHtml(course.title || '')}</div>
          <div class="ex-cell-venue">${escapeHtml(exam.venue || '')}</div>
          ${exam.invigilators ? `<div class="ex-cell-inv">${escapeHtml(exam.invigilators)}</div>` : ''}
        </div>
      `).join('')}</td>`;
    };

    root.innerHTML = `
      <div class="ex-sheet">
        <div class="ex-head">
          <div class="ex-head-logo"><img src="/images/logo.png" alt="FPU" /></div>
          <div class="ex-head-text">
            <div class="institution">Federal Polytechnic Ugep</div>
            <div class="faculty">${escapeHtml(school?.name || schoolName)}</div>
            <div class="title-line">Examination Timetable</div>
            <div class="level-line">${escapeHtml(semester)} Semester · ${sessionId ? 'Session ' + sessionId : ''}</div>
          </div>
          <div class="ex-draft-badge">${window.__examFinal ? '' : 'FIRST DRAFT COPY'}</div>
        </div>

        ${sortedDates.length === 0 ? `<div class="tt-empty">No exam schedules published.</div>` : `
          <table class="ex-table">
            <thead>
              <tr>
                <th class="col-days">DAYS</th>
                <th class="col-date">DATE</th>
                ${periods.map((p) => `<th class="col-period">${escapeHtml(p.label)}<br/><span style="font-size:6.5pt;font-weight:500;">${escapeHtml(p.start)}–${escapeHtml(p.end)}</span></th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${sortedDates.map((date) => {
                const items = byDate.get(date);
                const d = new Date(date + 'T00:00:00');
                const dayName = d.toLocaleDateString('en-GB', { weekday: 'long' });
                const dayShort = dayName.slice(0, 3).toUpperCase();
                const dateLabel = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                return `
                  <tr>
                    <td class="col-days">${dayShort}</td>
                    <td class="col-date">${dateLabel}</td>
                    ${periods.map((p) => cellFor(items, p)).join('')}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `}

        <div class="ex-foot">
          <div class="ex-foot-sig">
            <div class="role">Examination Officer</div>
            <div class="name">_______________________</div>
          </div>
          <div class="ex-foot-sig">
            <div class="role">Registrar</div>
            <div class="name">_______________________</div>
          </div>
        </div>
      </div>
    `;

    const printBtn = document.getElementById('exsheet-print');
    if (printBtn) printBtn.onclick = () => window.print();

    const draftToggle = document.getElementById('exsheet-draft-toggle');
    if (draftToggle) {
      draftToggle.textContent = window.__examFinal ? 'Mark DRAFT' : 'Mark FINAL';
      draftToggle.onclick = () => {
        window.__examFinal = !window.__examFinal;
        loadExamSheet();
      };
    }

    const addBtn = document.getElementById('exsheet-add');
    if (addBtn) addBtn.onclick = () => FPU_ADMIN_SPA.navigateToWithQuery('exam-form', {
      sessionId, semester, name: schoolName,
    });

    const exportBtn = document.getElementById('exsheet-export');
    if (exportBtn) exportBtn.onclick = () => {
      const table = root.querySelector('.ex-table');
      if (table) exportTableAsCSV(table, `exam-${school?.code || schoolId}.csv`);
    };
  } catch (err) {
    root.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

// ============================================
// ATTENDANCE
// ============================================
async function loadAttendance() {
  const container = document.getElementById("attendance-tbody");
  if (!container) return;

  const courseId = (document.getElementById("att-course-id") || {}).value || "";
  const date = (document.getElementById("att-date") || {}).value || "";

  const qs = new URLSearchParams();
  if (courseId) qs.set("courseId", courseId);
  if (date) qs.set("date", date);

  container.innerHTML = '<tr><td colspan="4" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/attendance?${qs}`);
    const result = await res.json();
    const rows = extractArray(result);

    if (!rows.length) {
      container.innerHTML = '<tr><td colspan="4" class="empty">No attendance records.</td></tr>';
      return;
    }

    container.innerHTML = rows.map((r) => {
      const rec = r.record || r;
      const s = r.student || {};
      const course = r.course || {};
      return `
        <tr>
          <td>${escapeHtml((s.firstName || "") + " " + (s.lastName || "")).trim() || `Student #${rec.studentId}`}</td>
          <td>${escapeHtml(course.code || `Course #${rec.courseId}`)}${course.title ? " — " + escapeHtml(course.title) : ""}</td>
          <td>${fmtDate(rec.date)}</td>
          <td>${badge(rec.status)}</td>
        </tr>`;
    }).join("");
  } catch (err) {
    container.innerHTML = `<tr><td colspan="4" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

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
    for (const d of depts) {
      byDept.set(d.id, { dept: d, records: [], courses: new Set(), students: new Set(), present: 0, total: 0 });
    }

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
        <div class="att-dept-card ${cls}"
             ${b.total === 0 ? '' : `data-dept-id="${b.dept.id}" data-dept-name="${escapeHtml(b.dept.name)}"`}>
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
        FPU_ADMIN_SPA.navigateToWithQuery('attendance-by-dept', {
          departmentId: Number(card.dataset.deptId),
          sessionId,
          semester,
          name: card.dataset.deptName,
        });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

async function loadDepartmentAttendance() {
  const grid = document.getElementById('abd-course-grid');
  if (!grid) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? qIdx + 1 : '');
  const departmentId = params.get('departmentId') || '';
  const sessionId = params.get('sessionId') || '';
  const semester = params.get('semester') || '';
  const deptName = params.get('name') || 'Department';

  const titleEl = document.getElementById('abd-title');
  const subEl = document.getElementById('abd-subtitle');
  if (titleEl) titleEl.textContent = `${deptName} Attendance`;
  if (subEl) subEl.textContent = 'Course-level attendance summary';

  if (!departmentId) {
    grid.innerHTML = '<div class="alert alert-warning">No department selected.</div>';
    return;
  }

  grid.innerHTML = '<div class="loading"><span class="spinner"></span> Loading courses…</div>';

  try {
    const level = (document.getElementById('abd-filter-level') || {}).value || '';
    const sem = (document.getElementById('abd-filter-semester') || {}).value || semester;
    const search = (document.getElementById('abd-filter-search') || {}).value || '';

    const coursesQs = new URLSearchParams({ departmentId, limit: 1000 });
    if (level) coursesQs.set('level', level);
    if (sem) coursesQs.set('semester', sem);

    const attQs = new URLSearchParams({ limit: 5000 });
    if (sessionId) attQs.set('sessionId', sessionId);
    if (sem) attQs.set('semester', sem);

    const [coursesRes, attRes] = await Promise.all([
      adminFetch(`/api/admin/courses?${coursesQs}`),
      adminFetch(`/api/admin/attendance?${attQs}`),
    ]);

    const courses = (await coursesRes.json()).data || [];
    const records = (await attRes.json()).data || [];

    const recordsByCourse = new Map();
    records.forEach((r) => {
      if (!recordsByCourse.has(r.courseId)) recordsByCourse.set(r.courseId, []);
      recordsByCourse.get(r.courseId).push(r);
    });

    let totalRecords = 0, totalPresent = 0;
    const trackedStudents = new Set();
    courses.forEach((c) => {
      const list = recordsByCourse.get(c.id) || [];
      totalRecords += list.length;
      list.forEach((r) => {
        if (r.status === 'present') totalPresent++;
        trackedStudents.add(r.studentId);
      });
    });

    setText('abdc-stat-courses', courses.filter((c) => (recordsByCourse.get(c.id) || []).length > 0).length);
    setText('abdc-stat-records', totalRecords);
    setText('abdc-stat-rate', totalRecords ? Math.round((totalPresent / totalRecords) * 100) + '%' : '—');
    setText('abdc-stat-students', trackedStudents.size);

    const visible = search
      ? courses.filter((c) => {
          const q = search.toLowerCase();
          return String(c.code || '').toLowerCase().includes(q) || String(c.title || '').toLowerCase().includes(q);
        })
      : courses;

    if (!visible.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">📖</div><p>No courses in this department.</p></div>';
      return;
    }

    grid.innerHTML = visible.map((c) => {
      const list = recordsByCourse.get(c.id) || [];
      const present = list.filter((r) => r.status === 'present').length;
      const rate = list.length ? Math.round((present / list.length) * 100) : 0;
      const students = new Set(list.map((r) => r.studentId)).size;
      const cls = list.length === 0 ? 'empty' : rate >= 75 ? 'healthy' : rate >= 50 ? 'warning' : 'critical';
      const lastDate = list.length ? list.map((r) => r.date).sort().slice(-1)[0] : null;

      const levelCls = (c.level || 'ND').toLowerCase();

      return `
        <div class="abd-course-card ${cls}"
             ${list.length === 0 ? '' : `data-course-id="${c.id}"`}>
          <div class="abcc-head">
            <span class="abcc-code">${escapeHtml(c.code || '')}</span>
            <span class="abcc-level ${levelCls}">${escapeHtml(c.level || '')}</span>
          </div>
          <h3>${escapeHtml(c.title || '')}</h3>
          <div class="abcc-rate">
            <span class="num ${cls}">${list.length ? rate + '%' : '—'}</span>
            <span class="label">attendance</span>
          </div>
          <div class="abcc-stats">
            <div class="abcc-stat"><span class="num">${students}</span><span class="label">Students</span></div>
            <div class="abcc-stat"><span class="num">${list.length}</span><span class="label">Records</span></div>
            <div class="abcc-stat"><span class="num">${present}</span><span class="label">Present</span></div>
          </div>
          <div class="abcc-footer">
            <span>${lastDate ? 'Last: ' + fmtDate(lastDate) : 'No records'}</span>
            <span class="arrow">→</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.abd-course-card[data-course-id]').forEach((card) => {
      card.addEventListener('click', () => {
        FPU_ADMIN_SPA.navigateToWithQuery('attendance-by-course', {
          courseId: Number(card.dataset.courseId),
          sessionId,
          semester: sem,
        });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

async function loadCourseAttendance() {
  const tbody = document.getElementById('abc-tbody');
  if (!tbody) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const courseId = params.get('courseId') || '';
  const sessionId = params.get('sessionId') || '';
  const semester = params.get('semester') || '';

  if (!courseId) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty">No course selected.</td></tr>';
    return;
  }

  const status = (document.getElementById('abc-filter-status') || {}).value || '';
  const from = (document.getElementById('abc-filter-from') || {}).value || '';
  const to = (document.getElementById('abc-filter-to') || {}).value || '';
  const search = (document.getElementById('abc-filter-search') || {}).value || '';

  tbody.innerHTML = '<tr><td colspan="10" class="empty">Loading…</td></tr>';

  try {
    const qs = new URLSearchParams({ courseId, limit: 5000 });
    if (sessionId) qs.set('sessionId', sessionId);
    if (semester) qs.set('semester', semester);
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    if (status) qs.set('status', status);

    const [attRes, courseRes, studentsRes] = await Promise.all([
      adminFetch(`/api/admin/attendance/with-student?${qs}`),
      adminFetch(`/api/admin/courses/${courseId}`),
      adminFetch('/api/admin/students?limit=5000'),
    ]);

    const records = (await attRes.json()).data || [];
    const course = (await courseRes.json()).data || {};
    const students = (await studentsRes.json()).data || [];

    const studentById = new Map(students.map((s) => [s.id, s]));

    const titleEl = document.getElementById('abc-title');
    const subEl = document.getElementById('abc-subtitle');
    if (titleEl) titleEl.textContent = `${course.code || ''} — ${course.title || 'Course Attendance'}`;
    if (subEl) subEl.textContent = `${records.length} record${records.length === 1 ? '' : 's'} across ${new Set(records.map((r) => r.date)).size} class day${new Set(records.map((r) => r.date)).size === 1 ? '' : 's'}`;

    // Group by student
    const byStudent = new Map();
    for (const r of records) {
      const s = r.student || studentById.get(r.studentId) || {};
      const key = r.studentId;
      if (!byStudent.has(key)) {
        byStudent.set(key, {
          student: s,
          present: 0, absent: 0, late: 0, excused: 0, total: 0,
        });
      }
      const b = byStudent.get(key);
      b.total++;
      if (r.status === 'present') b.present++;
      else if (r.status === 'absent') b.absent++;
      else if (r.status === 'late') b.late++;
      else if (r.status === 'excused') b.excused++;
    }

    // Filter by search
    let visible = [...byStudent.values()];
    if (search) {
      const q = search.toLowerCase();
      visible = visible.filter((b) => {
        const s = b.student || {};
        return (
          String(s.matricNumber || '').toLowerCase().includes(q) ||
          String(s.firstName || '').toLowerCase().includes(q) ||
          String(s.lastName || '').toLowerCase().includes(q)
        );
      });
    }

    const totalPresent = visible.reduce((acc, b) => acc + b.present, 0);
    const totalRecords = visible.reduce((acc, b) => acc + b.total, 0);

    setText('abc-stat-students', visible.length);
    setText('abc-stat-days', new Set(records.map((r) => r.date)).size);
    setText('abc-stat-rate', totalRecords ? Math.round((totalPresent / totalRecords) * 100) + '%' : '—');
    setText('abc-stat-records', totalRecords);
    setText('abc-count', `Showing ${visible.length} student${visible.length === 1 ? '' : 's'}`);

    if (!visible.length) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty">No attendance records.</td></tr>';
      return;
    }

    tbody.innerHTML = visible.map((b) => {
      const s = b.student || {};
      const rate = b.total ? Math.round((b.present / b.total) * 100) : 0;
      const cls = rate >= 75 ? 'healthy' : rate >= 50 ? 'warning' : 'critical';
      const initials = ((s.firstName || ' ')[0] + (s.lastName || ' ')[0]).toUpperCase().trim() || 'S';

      return `
        <tr class="row-clickable" data-student-id="${s.id || 0}">
          <td><code>${escapeHtml(s.matricNumber || '—')}</code></td>
          <td>${escapeHtml((s.firstName || '') + ' ' + (s.lastName || '')) || '—'}</td>
          <td>${escapeHtml(s.level || '')}</td>
          <td class="num">${b.total}</td>
          <td class="num">${b.present}</td>
          <td class="num">${b.absent}</td>
          <td class="num">${b.late}</td>
          <td class="num">${b.excused}</td>
          <td>
            <div class="att-rate">
              <div class="att-rate-bar"><div class="att-rate-fill ${cls}" style="width:${rate}%"></div></div>
              <span class="pct ${cls}">${rate}%</span>
            </div>
          </td>
          <td>
            <button class="btn btn-sm btn-outline"
              onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('attendance-by-student', { courseId: ${courseId}, studentId: ${s.id} })">
              View
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr[data-student-id]').forEach((tr) => {
      tr.addEventListener('click', () => {
        FPU_ADMIN_SPA.navigateToWithQuery('attendance-by-student', {
          courseId: Number(courseId),
          studentId: Number(tr.dataset.studentId),
        });
      });
    });

    const exportBtn = document.getElementById('abc-export');
    if (exportBtn) exportBtn.onclick = () => exportTableAsCSV(tbody.closest('table'), `attendance-${course.code || courseId}.csv`);

    const markBtn = document.getElementById('abc-mark');
    if (markBtn) markBtn.onclick = () => {
      showToast('Open the lecturer portal or Attendance → Mark to record today\'s class.', 'info');
    };

    const backBtn = document.getElementById('abc-back');
    if (backBtn) backBtn.onclick = () => history.back();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadStudentCourseAttendance() {
  const tbody = document.getElementById('abs-tbody');
  if (!tbody) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const courseId = params.get('courseId') || '';
  const studentId = params.get('studentId') || '';

  if (!courseId || !studentId) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Missing course or student.</td></tr>';
    return;
  }

  tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading…</td></tr>';

  try {
    const [attRes, stuRes, courseRes] = await Promise.all([
      adminFetch(`/api/admin/attendance?courseId=${courseId}&studentId=${studentId}&limit=500`),
      adminFetch(`/api/admin/students/${studentId}`),
      adminFetch(`/api/admin/courses/${courseId}`),
    ]);

    const records = (await attRes.json()).data || [];
    const student = (await stuRes.json()).data || {};
    const course = (await courseRes.json()).data || {};

    const subEl = document.getElementById('abs-subtitle');
    if (subEl) subEl.textContent = `${course.code || ''} — ${student.firstName || ''} ${student.lastName || ''}`;

    const avatar = document.getElementById('abs-avatar');
    if (avatar) {
      const initials = ((student.firstName || ' ')[0] + (student.lastName || ' ')[0]).toUpperCase().trim() || 'S';
      if (student.photoUrl) avatar.innerHTML = `<img src="${escapeHtml(student.photoUrl)}" alt="" />`;
      else avatar.textContent = initials;
    }
    setText('abs-name', `${student.firstName || ''} ${student.lastName || ''}`);
    setText('abs-meta', `${student.matricNumber || ''} · ${student.level || ''}`);

    const present = records.filter((r) => r.status === 'present').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const late = records.filter((r) => r.status === 'late').length;
    const excused = records.filter((r) => r.status === 'excused').length;
    const rate = records.length ? Math.round((present / records.length) * 100) : 0;

    setText('abs-total', records.length);
    setText('abs-present', present);
    setText('abs-absent', absent);
    setText('abs-late', late);
    setText('abs-excused', excused);
    setText('abs-rate', records.length ? rate + '%' : '—');
    setText('abs-count', `${records.length} record${records.length === 1 ? '' : 's'}`);

    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No attendance records for this student.</td></tr>';
      return;
    }

    records.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    tbody.innerHTML = records.map((r) => {
      const d = new Date(r.date);
      const dayName = d.toLocaleDateString('en-GB', { weekday: 'long' });
      return `
        <tr>
          <td>${fmtDate(r.date)}</td>
          <td>${escapeHtml(dayName)}</td>
          <td>${badge(r.status)}</td>
          <td>${escapeHtml(r.remarks || '—')}</td>
          <td class="small muted">${timeAgo(r.createdAt)}</td>
          <td>
            <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.deleteAttendance(${r.id})">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    const backBtn = document.getElementById('abs-back');
    if (backBtn) backBtn.onclick = () => history.back();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function deleteAttendance(id) {
  if (!confirm('Delete this attendance record?')) return;
  try {
    await adminFetch(`/api/admin/attendance/${id}`, { method: 'DELETE' });
    showToast('Deleted.', 'success');
    loadStudentCourseAttendance();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

// ============================================
// FEES / PAYMENTS / CLEARANCES
// ============================================
async function loadFees() {
  const container = document.getElementById("fees-tbody");
  if (!container) return;
  try {
    const res = await adminFetch("/api/admin/fees");
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((f) => `
      <tr>
        <td>Programme ${f.programmeId}</td>
        <td>${escapeHtml(f.level)}</td>
        <td>Session ${f.sessionId}</td>
        <td class="num">${money(f.tuition)}</td>
        <td class="num"><strong>${money(f.total)}</strong></td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="empty">No fee structures.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

// batch3: fees two-sessions helper
async function __getLatestTwoSessionIds() {
  try {
    const res = await adminFetch('/api/admin/sessions');
    const json = await res.json();
    const sessions = (json.data || []).slice().sort((a, b) => Number(b.id) - Number(a.id));
    return sessions.slice(0, 2).map((s) => Number(s.id));
  } catch { return []; }
}

async function loadFeeDepartments() {
  // batch3a: fees latest 2 sessions
  const __limitToLatestTwoSessions = true;

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
        <div class="fees-dept-card ${isEmpty ? 'empty' : ''}"
             ${isEmpty ? '' : `data-dept-id="${b.dept.id}" data-dept-name="${escapeHtml(b.dept.name)}"`}>
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
        FPU_ADMIN_SPA.navigateToWithQuery('fees-by-dept', {
          departmentId: Number(card.dataset.deptId),
          sessionId,
          name: card.dataset.deptName,
        });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

async function loadDepartmentFees() {
  const grid = document.getElementById('fd-grid');
  if (!grid) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const departmentId = params.get('departmentId') || '';
  const sessionId = params.get('sessionId') || '';
  const deptName = params.get('name') || 'Department';

  const titleEl = document.getElementById('fd-title');
  const subEl = document.getElementById('fd-subtitle');
  if (titleEl) titleEl.textContent = `${deptName} Fees`;
  if (subEl) subEl.textContent = 'Fee structures for this department';

  if (!departmentId) {
    grid.innerHTML = '<div class="alert alert-warning">No department selected.</div>';
    return;
  }

  grid.innerHTML = '<div class="loading"><span class="spinner"></span> Loading fee structures…</div>';

  try {
    const level = (document.getElementById('fd-filter-level') || {}).value || '';

    const [feesRes, progsRes] = await Promise.all([
      adminFetch(`/api/admin/fees?${new URLSearchParams({ sessionId })}`),
      adminFetch('/api/admin/programmes'),
    ]);

    const fees = (await feesRes.json()).data || [];
    const progs = (await progsRes.json()).data || [];

    const progById = new Map(progs.map((p) => [p.id, p]));
    let inDept = fees.filter((f) => {
      const p = progById.get(f.programmeId);
      return p && Number(p.departmentId) === Number(departmentId);
    });

    if (level) inDept = inDept.filter((f) => f.level === level);

    const totals = inDept.map((f) => Number(f.total));
    setText('fd-stat-total', inDept.length);
    setText('fd-stat-min', totals.length ? money(Math.min(...totals)) : '—');
    setText('fd-stat-max', totals.length ? money(Math.max(...totals)) : '—');
    setText('fd-stat-avg', totals.length ? money(Math.round(totals.reduce((s, n) => s + n, 0) / totals.length)) : '—');

    if (!inDept.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">💰</div><p>No fee structures for this department.</p></div>';
      return;
    }

    grid.innerHTML = inDept.map((f) => {
      const prog = progById.get(f.programmeId) || {};
      const cls = (f.level || 'ND').toLowerCase();
      return `
        <div class="fee-card ${f.isActive === false ? 'inactive' : ''}"
             onclick="FPU_ADMIN_SPA.navigateToWithQuery('fee-form', { id: ${f.id} })">
          <div class="fc-head">
            <span class="fc-code">${escapeHtml(prog.code || '')}</span>
            <span class="fc-level ${cls}">${escapeHtml(f.level || '')}</span>
          </div>
          <h3>${escapeHtml(prog.name || '')}</h3>
          <div class="fc-total">
            <span class="num">${money(f.total)}</span>
            <span class="label">total fee</span>
          </div>
          <div class="fc-breakdown">
            <div class="item"><span class="k">Tuition</span><span class="v">${money(f.tuition)}</span></div>
            <div class="item"><span class="k">Acceptance</span><span class="v">${money(f.acceptance)}</span></div>
            <div class="item"><span class="k">Medical</span><span class="v">${money(f.medical)}</span></div>
            <div class="item"><span class="k">Library</span><span class="v">${money(f.library)}</span></div>
            <div class="item"><span class="k">ICT</span><span class="v">${money(f.ict)}</span></div>
            <div class="item"><span class="k">Sports</span><span class="v">${money(f.sports)}</span></div>
          </div>
          <div class="fc-footer">
            <span>${f.isActive !== false ? 'Active' : 'Inactive'}</span>
            <span class="arrow">Edit →</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

async function loadPayments() {
  const container = document.getElementById("payments-tbody");
  if (!container) return;

  const status = (document.getElementById("payments-status") || {}).value || "";
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);

  container.innerHTML = '<tr><td colspan="6" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/payments?${qs}`);
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((r) => {
      const p = r.payment || r;
      const student = r.student || {};
      return `
        <tr>
          <td><code>${escapeHtml(p.reference || "")}</code></td>
          <td>${escapeHtml((student.firstName || "") + " " + (student.lastName || "")).trim() || "—"}</td>
          <td class="num">${money(p.amount)}</td>
          <td>${badge(p.status)}</td>
          <td>${fmtDate(p.createdAt)}</td>
          <td>
            ${p.status === "pending"
              ? `<div class="row-actions">
                   <button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.verifyPayment(${p.id})">Verify</button>
                   <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.rejectPayment(${p.id})">Reject</button>
                 </div>`
              : "—"}
          </td>
        </tr>`;
    }).join("") : '<tr><td colspan="6" class="empty">No payments.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

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
        <div class="pm-dept-card ${hasPending ? 'has-pending' : ''} ${paidCount === 0 ? 'empty' : ''}"
             ${paidCount === 0 ? '' : `data-dept-id="${b.dept.id}" data-dept-name="${escapeHtml(b.dept.name)}"`}>
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
        FPU_ADMIN_SPA.navigateToWithQuery('payments-by-dept', {
          departmentId: Number(card.dataset.deptId),
          sessionId,
          name: card.dataset.deptName,
        });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

async function loadDepartmentPayments() {
  const tbody = document.getElementById('pdd-tbody');
  if (!tbody) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const departmentId = params.get('departmentId') || '';
  const sessionId = params.get('sessionId') || '';
  const deptName = params.get('name') || 'Department';

  if (!departmentId) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty">No department selected.</td></tr>';
    return;
  }

  const titleEl = document.getElementById('pd-title');
  const subEl = document.getElementById('pd-subtitle');
  if (titleEl) titleEl.textContent = `${deptName} Payments`;
  if (subEl) subEl.textContent = 'Students who have paid';

  tbody.innerHTML = '<tr><td colspan="9" class="empty">Loading…</td></tr>';

  try {
    const status = (document.getElementById('pdd-filter-status') || {}).value || '';
    const programme = (document.getElementById('pdd-filter-programme') || {}).value || '';
    const search = (document.getElementById('pdd-search') || {}).value || '';

    const payQs = new URLSearchParams({ limit: 5000 });
    if (sessionId) payQs.set('sessionId', sessionId);

    const [payRes, studentsRes, feesRes, progsRes] = await Promise.all([
      adminFetch(`/api/admin/payments?${payQs}`),
      adminFetch('/api/admin/students?limit=5000'),
      adminFetch(`/api/admin/fees?${new URLSearchParams({ sessionId })}`),
      adminFetch('/api/admin/programmes'),
    ]);

    const payments = (await payRes.json()).data || [];
    const students = (await studentsRes.json()).data || [];
    const fees = (await feesRes.json()).data || [];
    const progs = (await progsRes.json()).data || [];

    const studentById = new Map(students.map((s) => [s.id, s]));
    const progById = new Map(progs.map((p) => [p.id, p]));

    // Group payments by student
    const byStudent = new Map();
    for (const p of payments) {
      const row = p.payment || p;
      const student = studentById.get(row.studentId) || p.student;
      if (!student) continue;
      if (Number(student.departmentId) !== Number(departmentId)) continue;
      if (!byStudent.has(student.id)) byStudent.set(student.id, { student, payments: [] });
      byStudent.get(student.id).payments.push(row);
    }

    let visible = [...byStudent.values()];

    if (programme) visible = visible.filter((b) => Number(b.student.programmeId) === Number(programme));
    if (search) {
      const q = search.toLowerCase();
      visible = visible.filter((b) => {
        const s = b.student || {};
        return (
          String(s.matricNumber || '').toLowerCase().includes(q) ||
          String(s.firstName || '').toLowerCase().includes(q) ||
          String(s.lastName || '').toLowerCase().includes(q)
        );
      });
    }

    // Compute totals
    const computed = visible.map((b) => {
      const s = b.student;
      const fee = fees.find((f) => Number(f.programmeId) === Number(s.programmeId) && f.level === (s.level || 'ND'));
      const totalDue = fee ? Number(fee.total) : 0;
      const totalPaid = b.payments.filter((p) => p.status === 'verified').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      const hasPending = b.payments.some((p) => p.status === 'pending');
      const balance = Math.max(0, totalDue - totalPaid);
      const lastPayment = b.payments.map((p) => p.createdAt).sort().slice(-1)[0];
      return { ...b, totalDue, totalPaid, balance, hasPending, lastPayment };
    });

    // Status filter
    let filtered = computed;
    if (status === 'fully') filtered = computed.filter((b) => b.totalDue > 0 && b.balance === 0);
    else if (status === 'partial') filtered = computed.filter((b) => b.totalPaid > 0 && b.balance > 0);
    else if (status === 'pending') filtered = computed.filter((b) => b.hasPending);

    const totalCollected = filtered.reduce((s, b) => s + b.totalPaid, 0);

    setText('pdd-stat-students', filtered.length);
    setText('pdd-stat-fully', filtered.filter((b) => b.balance === 0 && b.totalDue > 0).length);
    setText('pdd-stat-partial', filtered.filter((b) => b.balance > 0 && b.totalPaid > 0).length);
    setText('pdd-stat-collected', money(totalCollected));
    setText('pdd-count', `Showing ${filtered.length} student${filtered.length === 1 ? '' : 's'}`);

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty">No payments match your filters.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map((b) => {
      const s = b.student || {};
      const statusBadge = b.balance === 0 && b.totalDue > 0
        ? '<span class="badge badge-success">Fully Paid</span>'
        : b.totalPaid > 0
          ? '<span class="badge badge-warning">Partial</span>'
          : '<span class="badge badge-muted">No Payment</span>';

      return `
        <tr class="row-clickable"
            onclick="FPU_ADMIN_SPA.navigateToWithQuery('payments-by-student', { studentId: ${s.id} })">
          <td><code>${escapeHtml(s.matricNumber || '—')}</code></td>
          <td>${escapeHtml((s.firstName || '') + ' ' + (s.lastName || ''))}</td>
          <td>${escapeHtml(s.level || '')}</td>
          <td class="num">${money(b.totalDue)}</td>
          <td class="num">${money(b.totalPaid)}</td>
          <td class="num">${money(b.balance)}</td>
          <td>${statusBadge}</td>
          <td class="small muted">${b.lastPayment ? fmtDate(b.lastPayment) : '—'}</td>
          <td>
            <button class="btn btn-sm btn-outline"
              onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('payments-by-student', { studentId: ${s.id} })">
              View
            </button>
          </td>
        </tr>
      `;
    }).join('');

    const exportBtn = document.getElementById('pd-export');
    if (exportBtn) exportBtn.onclick = () => exportTableAsCSV(tbody.closest('table'), `payments-${deptName}.csv`);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadStudentPayments() {
  const tbody = document.getElementById('ps-tbody');
  if (!tbody) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const studentId = params.get('studentId') || '';

  if (!studentId) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">No student selected.</td></tr>';
    return;
  }

  tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading…</td></tr>';

  try {
    const [payRes, stuRes, feeRes] = await Promise.all([
      adminFetch(`/api/admin/payments?studentId=${studentId}&limit=500`),
      adminFetch(`/api/admin/students/${studentId}`),
      adminFetch('/api/admin/fees'),
    ]);

    const payments = (await payRes.json()).data || [];
    const student = (await stuRes.json()).data || {};
    const fees = (await feeRes.json()).data || [];

    const fee = fees.find((f) => Number(f.programmeId) === Number(student.programmeId) && f.level === (student.level || 'ND'));
    const totalDue = fee ? Number(fee.total) : 0;
    const totalPaid = payments.filter((p) => (p.payment || p).status === 'verified').reduce((s, p) => s + (Number((p.payment || p).amount) || 0), 0);
    const balance = Math.max(0, totalDue - totalPaid);

    setText('ps-due', money(totalDue));
    setText('ps-paid', money(totalPaid));
    setText('ps-balance', money(balance));
    setText('ps-count', payments.length);
    setText('ps-fee-session', fee ? `Session ${fee.sessionId}` : '');

    const subEl = document.getElementById('ps-subtitle');
    if (subEl) subEl.textContent = `${student.matricNumber || ''} · ${student.firstName || ''} ${student.lastName || ''}`;

    // Header
    const header = document.getElementById('ps-header');
    if (header) {
      const initials = ((student.firstName || ' ')[0] + (student.lastName || ' ')[0]).toUpperCase().trim() || 'S';
      header.innerHTML = `
        <div class="ps-header">
          <div class="ps-avatar">${student.photoUrl ? `<img src="${escapeHtml(student.photoUrl)}" alt="" />` : escapeHtml(initials)}</div>
          <div class="ps-info">
            <div class="ps-name">${escapeHtml((student.firstName || '') + ' ' + (student.lastName || ''))}</div>
            <div class="ps-meta">${escapeHtml(student.matricNumber || '')} · ${escapeHtml(student.level || '')} · ${escapeHtml(student.programme?.name || '')}</div>
          </div>
        </div>`;
    }

    // Fee breakdown
    const bd = document.getElementById('ps-fee-breakdown');
    if (bd) {
      if (fee) {
        const rows = [
          ['Tuition', fee.tuition],
          ['Acceptance', fee.acceptance],
          ['Medical', fee.medical],
          ['Library', fee.library],
          ['ICT', fee.ict],
          ['Sports', fee.sports],
          ['Other', fee.other],
        ];
        bd.innerHTML = rows.map(([k, v]) => `
          <div class="fees-row"><span>${k}</span><strong>${money(v)}</strong></div>
        `).join('') + `<div class="fees-row total"><span>Total Due</span><strong>${money(fee.total)}</strong></div>`;
      } else {
        bd.innerHTML = '<p class="muted">No fee structure for this student\'s programme.</p>';
      }
    }

    if (!payments.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No payments yet.</td></tr>';
      return;
    }

    tbody.innerHTML = payments.map((r) => {
      const p = r.payment || r;
      return `
        <tr>
          <td><code>${escapeHtml(p.reference || '')}</code></td>
          <td class="num">${money(p.amount)}</td>
          <td>${badge(p.status)}</td>
          <td>${fmtDate(p.createdAt)}</td>
          <td>${escapeHtml(p.bankName || '')}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-sm btn-outline"
                onclick="FPU_ADMIN_SPA.navigateToWithQuery('payment-detail', { id: ${p.id} })">View</button>
              ${p.status === 'pending' ? `
                <button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.verifyPayment(${p.id})">Verify</button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    const newBtn = document.getElementById('ps-new-payment');
    if (newBtn) newBtn.onclick = () => FPU_ADMIN_SPA.navigateTo('payment-form');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadPaymentDetail() {
  const root = document.getElementById('pd2-root');
  if (!root) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const id = params.get('id');

  if (!id) {
    root.innerHTML = '<div class="alert alert-warning">No payment selected.</div>';
    return;
  }

  root.innerHTML = '<div class="loading"><span class="spinner"></span> Loading payment…</div>';

  try {
    const res = await adminFetch(`/api/admin/payments/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    const p = json.data;

    const studentRes = await adminFetch(`/api/admin/students/${p.studentId}`);
    const student = (await studentRes.json()).data || {};

    const subEl = document.getElementById('pd2-subtitle');
    if (subEl) subEl.textContent = `${p.reference} · ${student.matricNumber || ''}`;

    root.innerHTML = `
      <div class="receipt">
        <div class="receipt-head">
          <h1>Federal Polytechnic Ugep</h1>
          <div class="sub">Citadel of Technical Excellence</div>
          <div class="doc-type">Payment Receipt</div>
        </div>

        <div class="receipt-amount">
          <div class="num">${money(p.amount)}</div>
          <div class="ref">${escapeHtml(p.reference || '')}</div>
        </div>

        <div class="receipt-status">${badge(p.status)}</div>

        <div class="receipt-rows">
          <div class="receipt-row"><span class="k">Student</span><span class="v">${escapeHtml((student.firstName || '') + ' ' + (student.lastName || ''))}</span></div>
          <div class="receipt-row"><span class="k">Matric No</span><span class="v">${escapeHtml(student.matricNumber || '—')}</span></div>
          <div class="receipt-row"><span class="k">Level</span><span class="v">${escapeHtml(student.level || '—')}</span></div>
          <div class="receipt-row"><span class="k">Bank</span><span class="v">${escapeHtml(p.bankName || '—')}</span></div>
          <div class="receipt-row"><span class="k">Depositor</span><span class="v">${escapeHtml(p.depositorName || '—')}</span></div>
          <div class="receipt-row"><span class="k">Deposit Date</span><span class="v">${p.depositDate ? fmtDate(p.depositDate) : '—'}</span></div>
          <div class="receipt-row"><span class="k">Recorded</span><span class="v">${fmtDateTime(p.createdAt)}</span></div>
          ${p.verifiedAt ? `<div class="receipt-row"><span class="k">Verified</span><span class="v">${fmtDateTime(p.verifiedAt)}</span></div>` : ''}
          ${p.rejectionReason ? `<div class="receipt-row"><span class="k">Reason</span><span class="v">${escapeHtml(p.rejectionReason)}</span></div>` : ''}
        </div>

        ${p.status === 'pending' ? `
          <div class="receipt-actions">
            <button class="btn btn-primary" onclick="FPU_ADMIN.verifyPayment(${p.id})">✓ Verify</button>
            <button class="btn btn-ghost" onclick="FPU_ADMIN.rejectPayment(${p.id})">✕ Reject</button>
          </div>
        ` : ''}
      </div>
    `;

    const backBtn = document.getElementById('pd2-back');
    if (backBtn) backBtn.onclick = () => history.back();
  } catch (err) {
    root.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

async function verifyPayment(id) {
  try {
    await adminFetch(`/api/admin/payments/${id}/verify`, { method: "POST" });
    showToast("Payment verified.");
    loadPayments();
  } catch (err) { showToast("❌ " + err.message, "error"); }
}

async function rejectPayment(id) {
  const reason = promptReason("Reason for rejection:");
  if (!reason) return;
  try {
    await adminFetch(`/api/admin/payments/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    showToast("Payment rejected.", "warning");
    loadPayments();
  } catch (err) { showToast("❌ " + err.message, "error"); }
}

async function loadClearances() {
  const container = document.getElementById("clearances-tbody");
  if (!container) return;

  const status = (document.getElementById("clearances-status") || {}).value || "";
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);

  container.innerHTML = '<tr><td colspan="5" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/clearances?${qs}`);
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((r) => {
      const c = r.clearance || r;
      const s = r.student || {};
      return `
        <tr>
          <td>${escapeHtml((s.firstName || "") + " " + (s.lastName || "")).trim() || `Student #${c.studentId}`}</td>
          <td>${escapeHtml(c.type || "semester")}</td>
          <td>${badge(c.status)}</td>
          <td>${fmtDate(c.createdAt)}</td>
          <td>
            ${c.status === "pending"
              ? `<div class="row-actions">
                   <button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.clearClearance(${c.id})">Clear</button>
                   <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.rejectClearance(${c.id})">Reject</button>
                 </div>`
              : "—"}
          </td>
        </tr>`;
    }).join("") : '<tr><td colspan="5" class="empty">No clearances.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

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
    for (const d of depts) {
      byDept.set(d.id, { dept: d, cleared: 0, pending: 0, rejected: 0, missing: 0, total: 0 });
    }
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
        <div class="clr-dept-card ${cls}"
             ${b.total === 0 ? '' : `data-dept-id="${b.dept.id}" data-dept-name="${escapeHtml(b.dept.name)}"`}>
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
        FPU_ADMIN_SPA.navigateToWithQuery('clearances-by-dept', {
          departmentId: Number(card.dataset.deptId),
          sessionId,
          name: card.dataset.deptName,
        });
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

async function loadDepartmentClearances() {
  const tbody = document.getElementById('cdd-tbody');
  if (!tbody) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const departmentId = params.get('departmentId') || '';
  const sessionId = params.get('sessionId') || '';
  const deptName = params.get('name') || 'Department';

  if (!departmentId) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">No department selected.</td></tr>';
    return;
  }

  const titleEl = document.getElementById('cd-title');
  const subEl = document.getElementById('cd-subtitle');
  if (titleEl) titleEl.textContent = `${deptName} Clearances`;
  if (subEl) subEl.textContent = 'Student clearance status';

  tbody.innerHTML = '<tr><td colspan="8" class="empty">Loading…</td></tr>';

  try {
    const statusFilter = (document.getElementById('cdd-filter-status') || {}).value || '';
    const search = (document.getElementById('cdd-search') || {}).value || '';

    const qs = new URLSearchParams({ departmentId });
    if (sessionId) qs.set('sessionId', sessionId);

    const [studentsRes, clrRes] = await Promise.all([
      adminFetch(`/api/admin/students?${qs}&limit=5000`),
      adminFetch(`/api/admin/clearances?${new URLSearchParams({ sessionId })}`),
    ]);

    const students = (await studentsRes.json()).data || [];
    const clearances = (await clrRes.json()).data || [];

    const clrByStudent = new Map();
    clearances.forEach((c) => {
      const row = c.clearance || c;
      const stu = c.student || {};
      if (!clrByStudent.has(row.studentId)) clrByStudent.set(row.studentId, row);
    });

    let visible = students.map((s) => {
      const c = clrByStudent.get(s.id) || null;
      return { student: s, clearance: c };
    });

    if (search) {
      const q = search.toLowerCase();
      visible = visible.filter(({ student }) =>
        String(student.matricNumber || '').toLowerCase().includes(q) ||
        String(student.firstName || '').toLowerCase().includes(q) ||
        String(student.lastName || '').toLowerCase().includes(q)
      );
    }

    if (statusFilter === 'missing') visible = visible.filter(({ clearance }) => !clearance);
    else if (statusFilter) visible = visible.filter(({ clearance }) => clearance && clearance.status === statusFilter);

    const cleared = visible.filter(({ clearance }) => clearance && clearance.status === 'cleared').length;
    const pending = visible.filter(({ clearance }) => clearance && clearance.status === 'pending').length;
    const rate = visible.length ? Math.round((cleared / visible.length) * 100) : 0;

    setText('cdd-stat-students', visible.length);
    setText('cdd-stat-cleared', cleared);
    setText('cdd-stat-pending', pending);
    setText('cdd-stat-rate', rate + '%');
    setText('cdd-count', `Showing ${visible.length} student${visible.length === 1 ? '' : 's'}`);

    if (!visible.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">No students match your filters.</td></tr>';
      return;
    }

    tbody.innerHTML = visible.map(({ student, clearance }) => {
      const status = clearance ? clearance.status : 'missing';
      const badgeHtml = status === 'cleared' ? badge('cleared') : status === 'pending' ? badge('pending') : status === 'rejected' ? badge('rejected') : '<span class="badge badge-muted">No record</span>';
      return `
        <tr>
          <td>
            ${clearance ? `<input type="checkbox" class="cd-check" data-id="${clearance.id}" />` : ''}
          </td>
          <td><code>${escapeHtml(student.matricNumber || '')}</code></td>
          <td>${escapeHtml((student.firstName || '') + ' ' + (student.lastName || ''))}</td>
          <td>${escapeHtml(student.level || '')}</td>
          <td>${badgeHtml}</td>
          <td>${clearance?.clearedAt ? fmtDate(clearance.clearedAt) : '—'}</td>
          <td>${escapeHtml(clearance?.remarks || '—')}</td>
          <td>
            <div class="row-actions">
              ${clearance && clearance.status === 'pending' ? `
                <button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.clearClearance(${clearance.id})">Clear</button>
                <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.rejectClearance(${clearance.id})">Reject</button>
              ` : ''}
              ${!clearance ? `
                <button class="btn btn-sm btn-outline" onclick="FPU_ADMIN.createClearance(${student.id}, '${escapeQuotes(sessionId)}')">Create</button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    const exportBtn = document.getElementById('cd-export');
    if (exportBtn) exportBtn.onclick = () => exportTableAsCSV(tbody.closest('table'), `clearances-${deptName}.csv`);

    const selectAll = document.getElementById('cd-select-all');
    if (selectAll) {
      selectAll.onchange = () => {
        tbody.querySelectorAll('.cd-check').forEach((cb) => { cb.checked = selectAll.checked; });
      };
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function createClearance(studentId, sessionId) {
  if (!sessionId) {
    sessionId = prompt('Session ID:');
    if (!sessionId) return;
  }
  try {
    await adminFetch('/api/admin/clearances', {
      method: 'POST',
      body: JSON.stringify({ studentId, sessionId: Number(sessionId), type: 'semester' }),
    });
    showToast('Clearance created.', 'success');
    loadDepartmentClearances();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function clearClearance(id) {
  try {
    await adminFetch(`/api/admin/clearances/${id}/clear`, { method: "POST" });
    showToast("Clearance approved.");
    loadClearances();
    loadDepartmentClearances();
  } catch (err) { showToast("❌ " + err.message, "error"); }
}

async function rejectClearance(id) {
  const remarks = promptReason("Reason for rejection:");
  if (!remarks) return;
  try {
    await adminFetch(`/api/admin/clearances/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ remarks }),
    });
    showToast("Clearance rejected.", "warning");
    loadClearances();
    loadDepartmentClearances();
  } catch (err) { showToast("❌ " + err.message, "error"); }
}

async function bulkClearClearances() {
  const ids = Array.from(document.querySelectorAll('.cd-check:checked')).map((c) => Number(c.dataset.id));
  if (!ids.length) { showToast('Select students first.', 'warning'); return; }
  if (!confirm(`Mark ${ids.length} student(s) cleared?`)) return;
  let ok = 0, failed = 0;
  for (const id of ids) {
    try {
      await adminFetch(`/api/admin/clearances/${id}/clear`, { method: 'POST' });
      ok++;
    } catch { failed++; }
  }
  showToast(`✅ Cleared ${ok}${failed ? `, ${failed} failed` : ''}.`);
  loadDepartmentClearances();
}

async function bulkRejectClearances() {
  const ids = Array.from(document.querySelectorAll('.cd-check:checked')).map((c) => Number(c.dataset.id));
  if (!ids.length) { showToast('Select students first.', 'warning'); return; }
  const remarks = prompt('Reason (applied to all):');
  if (remarks === null) return;
  let ok = 0, failed = 0;
  for (const id of ids) {
    try {
      await adminFetch(`/api/admin/clearances/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ remarks }),
      });
      ok++;
    } catch { failed++; }
  }
  showToast(`⚠️ Rejected ${ok}${failed ? `, ${failed} failed` : ''}.`, 'warning');
  loadDepartmentClearances();
}

// ============================================
// ANNOUNCEMENTS / NOTIFICATIONS / COMPLAINTS
// ============================================
async function loadAnnouncements() {
  // batch3: announcements filter
  const __annAudience = document.querySelector('#ann-audience-tabs .staff-role-tab.active')?.dataset.audience || '';
  const __annPriority = document.getElementById('ann-filter-priority')?.value || '';
  const __annSearch   = document.getElementById('ann-search')?.value || '';

  // batch3a: announcements filter
  const _annAudience = document.querySelector('#ann-audience-tabs .staff-role-tab.active')?.dataset.audience || '';
  const _annPriority = document.getElementById('ann-filter-priority')?.value || '';
  const _annSearch   = document.getElementById('ann-search')?.value || '';

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
      target.innerHTML = '<p class="muted">No announcements.</p>';
      return;
    }

    if (grid) {
      // Card layout for list.html
      target.innerHTML = rows.map((r) => {
        const a = r.announcement || r;
        const priority = a.priority || 'normal';
        const isExpired = a.expiresAt && new Date(a.expiresAt).getTime() < Date.now();
        return `
          <div class="ann-card ${priority} ${a.isPublished === false ? 'unpublished' : ''}"
               onclick="FPU_ADMIN_SPA.navigateToWithQuery('announcement-detail', { id: ${a.id} })">
            <div class="anc-head">
              <div class="anc-badges">
                <span class="anc-badge priority-${priority}">
                  ${priority === 'high' ? '🔴 Urgent' : priority === 'low' ? '📝 General' : '📢 Normal'}
                </span>
                <span class="anc-badge audience">${escapeHtml(a.audience === 'all' ? 'Everyone' : a.audience || '')}</span>
                ${a.isPublished === false ? '<span class="anc-badge unpublished">Draft</span>' : ''}
                ${isExpired ? '<span class="anc-badge expired">Expired</span>' : ''}
              </div>
            </div>
            <h3>${escapeHtml(a.title || '')}</h3>
            <div class="body">${escapeHtml(a.body || '')}</div>
            <div class="anc-meta">
              <span>${fmtDateTime(a.publishedAt || a.createdAt)}</span>
              <span>${a.authorId ? 'Admin #' + a.authorId : ''}</span>
            </div>
            <div class="anc-actions">
              <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('announcement-form', { id: ${a.id} })">Edit</button>
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); FPU_ADMIN.deleteAnnouncement(${a.id})">Delete</button>
            </div>
          </div>
        `;
      }).join('');
    } else {
      // Simple list layout
      target.innerHTML = rows.map((r) => {
        const a = r.announcement || r;
        const badgeCls = a.priority === 'high' ? 'danger' : a.priority === 'low' ? 'muted' : 'info';
        return `
          <article class="panel" style="margin-bottom:.75rem;">
            <div class="panel-body">
              <span class="badge badge-${badgeCls}">${escapeHtml(a.priority || 'normal')}</span>
              <h3 style="margin:.4rem 0;">${escapeHtml(a.title || '')}</h3>
              <p>${escapeHtml(a.body || '')}</p>
              <p class="small muted">${fmtDateTime(a.publishedAt || a.createdAt)}</p>
            </div>
          </article>`;
      }).join('');
    }

    // Update stats on list page
    const total = rows.length;
    const urgent = rows.filter((r) => (r.announcement || r).priority === 'high').length;
    const published = rows.filter((r) => (r.announcement || r).isPublished !== false).length;
    const active = rows.filter((r) => {
      const a = r.announcement || r;
      return !a.expiresAt || new Date(a.expiresAt).getTime() > Date.now();
    }).length;
    setText('ann-stat-total', total);
    setText('ann-stat-urgent', urgent);
    setText('ann-stat-published', published);
    setText('ann-stat-active', active);
  } catch (err) {
    target.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
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
  target.innerHTML = list
    ? '<div class="loading" style="grid-column:1/-1;"><span class="spinner"></span> Loading…</div>'
    : '<div class="loading"><span class="spinner"></span> Loading…</div>';

  try {
    const res = await adminFetch("/api/admin/notifications");
    const result = await res.json();
    const rows = extractArray(result);

    if (!rows.length) {
      target.innerHTML = '<p class="muted">No notifications.</p>';
      return;
    }

    if (list) {
      target.innerHTML = rows.map((n) => `
        <div class="nt-item ${n.isRead ? '' : 'unread'}"
             onclick="FPU_ADMIN_SPA.navigateToWithQuery('notification-detail', { id: ${n.id} })">
          <div class="nt-icon ${escapeHtml(n.type || 'default')}">${n.type === 'warning' ? '⚠️' : n.type === 'success' ? '✅' : n.type === 'complaint' ? '📩' : n.type === 'fee' ? '💰' : 'ℹ️'}</div>
          <div class="nt-body">
            <div class="nt-title">${escapeHtml(n.title || '')}</div>
            <div class="nt-text">${escapeHtml(n.body || '')}</div>
            <div class="nt-meta">
              <span>${timeAgo(n.createdAt)}</span>
              ${!n.isRead ? '<span class="unread-pill">Unread</span>' : ''}
            </div>
          </div>
          <div class="nt-actions">
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); FPU_ADMIN.markNotificationRead(${n.id})">Read</button>
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); FPU_ADMIN.deleteNotification(${n.id})">Delete</button>
          </div>
        </div>
      `).join('');

      // Update stats
      const total = rows.length;
      const unread = rows.filter((n) => !n.isRead).length;
      const week = rows.filter((n) => new Date(n.createdAt).getTime() > Date.now() - 7 * 86400000).length;
      const high = rows.filter((n) => n.type === 'warning').length;
      setText('nt-stat-total', total);
      setText('nt-stat-unread', unread);
      setText('nt-stat-week', week);
      setText('nt-stat-high', high);
    } else {
      target.innerHTML = rows.map((n) => `
        <div class="session-item ${n.isRead ? '' : 'current'}">
          <div class="meta"><strong>${escapeHtml(n.title || '')}</strong>${escapeHtml(n.body || '')}</div>
          <div class="small muted">${fmtDateTime(n.createdAt)}</div>
        </div>
      `).join('');
    }
  } catch (err) {
    target.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

async function markNotificationRead(id) {
  try {
    await adminFetch(`/api/admin/notifications/${id}/read`, { method: 'POST' });
    showToast('Marked read.', 'success');
    loadNotifications();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function deleteNotification(id) {
  if (!confirm('Delete this notification?')) return;
  try {
    await adminFetch(`/api/admin/notifications/${id}`, { method: 'DELETE' });
    showToast('Deleted.', 'success');
    loadNotifications();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function loadComplaints() {
  // batch3: complaints filter
  const __cmpStatus = document.querySelector('#cmp-status-tabs .staff-role-tab.active')?.dataset.status || '';
  const __cmpCategory = document.getElementById('cmp-filter-category')?.value || '';
  const __cmpSearch = document.getElementById('cmp-search')?.value || '';
  const __cmpSort = document.getElementById('cmp-filter-sort')?.value || 'newest';

  // batch3a: complaints filter
  const _cmpStatus = document.querySelector('#cmp-status-tabs .staff-role-tab.active')?.dataset.status || '';
  const _cmpCategory = document.getElementById('cmp-filter-category')?.value || '';
  const _cmpSearch = document.getElementById('cmp-search')?.value || '';
  const _cmpSort = document.getElementById('cmp-filter-sort')?.value || 'newest';

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
      rows = rows.filter((r) => {
        const c = r.complaint || r;
        return String(c.subject || '').toLowerCase().includes(q) || String(c.body || '').toLowerCase().includes(q);
      });
    }
    if (sort === 'oldest') {
      rows.sort((a, b) => new Date((a.complaint || a).createdAt) - new Date((b.complaint || b).createdAt));
    }

    if (container) {
      container.innerHTML = rows.length ? rows.map((r) => {
        const c = r.complaint || r;
        return `
          <tr>
            <td>${escapeHtml(c.subject || '')}</td>
            <td>${r.user ? `${escapeHtml(r.user.firstName)} ${escapeHtml(r.user.lastName)}` : '—'}</td>
            <td>${badge(c.status)}</td>
            <td>${fmtDateTime(c.createdAt)}</td>
            <td>
              <div class="row-actions">
                <button class="btn btn-sm btn-outline"
                  onclick="FPU_ADMIN_SPA.navigateToWithQuery('complaint-view', { id: ${c.id} })">View</button>
              </div>
            </td>
          </tr>`;
      }).join('') : '<tr><td colspan="5" class="empty">No complaints.</td></tr>';
    } else {
      // Card/table layout for list.html
      const now = Date.now();
      target.innerHTML = rows.length ? rows.map((r) => {
        const c = r.complaint || r;
        const ageDays = Math.floor((now - new Date(c.createdAt).getTime()) / 86400000);
        let ageCls = '';
        if (c.status === 'open' && ageDays >= 7) ageCls = 'sla-critical';
        else if (c.status === 'open' && ageDays >= 3) ageCls = 'sla-warning';
        return `
          <tr>
            <td>${escapeHtml(c.subject || '')}</td>
            <td>${r.user ? `${escapeHtml(r.user.firstName)} ${escapeHtml(r.user.lastName)}` : '—'}</td>
            <td>${escapeHtml(c.category || '—')}</td>
            <td>${badge(c.status)}</td>
            <td class="${ageCls}">${ageDays}d</td>
            <td>
              <button class="btn btn-sm btn-outline"
                onclick="FPU_ADMIN_SPA.navigateToWithQuery('complaint-view', { id: ${c.id} })">View</button>
            </td>
          </tr>`;
      }).join('') : `<tr><td colspan="6" class="empty">No complaints.</td></tr>`;

      // Stats
      const open = rows.filter((r) => (r.complaint || r).status === 'open').length;
      const inReview = rows.filter((r) => (r.complaint || r).status === 'in_review').length;
      const resolved = rows.filter((r) => (r.complaint || r).status === 'resolved').length;
      setText('cmp-stat-total', rows.length);
      setText('cmp-stat-open', open);
      setText('cmp-stat-in-review', inReview);
      setText('cmp-stat-resolved', resolved);
      setText('cmp-count', `Showing ${rows.length}`);
    }
  } catch (err) {
    target.innerHTML = `<tr><td colspan="${cols}" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

// ============================================
// DOCUMENTS / GRADUATIONS
// ============================================
async function loadDocuments() {
  const container = document.getElementById("documents-tbody");
  if (!container) return;
  try {
    const res = await adminFetch("/api/admin/documents");
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((r) => {
      const d = r.document || r;
      return `
        <tr>
          <td>${escapeHtml(d.title || '')}</td>
          <td>${escapeHtml(d.type || '')}</td>
          <td>${badge(d.status)}</td>
          <td>${fmtDate(d.requestedAt || d.createdAt)}</td>
          <td>
            <button class="btn btn-sm btn-outline"
              onclick="FPU_ADMIN_SPA.navigateToWithQuery('documents-detail', { id: ${d.id} })">View</button>
          </td>
        </tr>`;
    }).join('') : '<tr><td colspan="5" class="empty">No documents.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadDocumentsTable() {
  // batch3: documents filter
  const __docStatus = document.querySelector('#doc-status-tabs .staff-role-tab.active')?.dataset.status || '';
  const __docType = document.getElementById('doc-filter-type')?.value || '';
  const __docSearch = document.getElementById('doc-search')?.value || '';

  // batch3a: documents filter
  const _docStatus = document.querySelector('#doc-status-tabs .staff-role-tab.active')?.dataset.status || '';
  const _docType = document.getElementById('doc-filter-type')?.value || '';
  const _docSearch = document.getElementById('doc-search')?.value || '';

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
        <div class="doc-card ${d.status}"
             onclick="FPU_ADMIN_SPA.navigateToWithQuery('documents-detail', { id: ${d.id} })">
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

async function loadDocumentDetail() {
  const root = document.getElementById('dd-root');
  if (!root) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const id = params.get('id');

  if (!id) {
    root.innerHTML = '<div class="alert alert-warning">No document selected.</div>';
    return;
  }

  root.innerHTML = '<div class="loading"><span class="spinner"></span> Loading…</div>';

  try {
    const res = await adminFetch(`/api/admin/documents?limit=500`);
    const json = await res.json();
    const rows = json.data || [];
    const row = rows.find((r) => Number((r.document || r).id) === Number(id));
    if (!row) throw new Error('Document not found');

    const d = row.document || row;
    const user = row.user || {};

    root.innerHTML = `
      <div class="doc-detail">
        <div class="doc-detail-head">
          <div class="doc-detail-icon">📄</div>
          <div class="doc-detail-meta">
            <h2>${escapeHtml(d.title || '')}</h2>
            <div class="sub">${escapeHtml(String(d.type || '').replace(/-/g, ' '))}</div>
          </div>
        </div>

        <div class="doc-detail-body">
          <div class="doc-detail-row"><div class="k">Student</div><div class="v">${escapeHtml((user.firstName || '') + ' ' + (user.lastName || ''))}</div></div>
          <div class="doc-detail-row"><div class="k">Matric</div><div class="v">${escapeHtml(user.matricNumber || '—')}</div></div>
          <div class="doc-detail-row"><div class="k">Email</div><div class="v">${escapeHtml(user.email || '—')}</div></div>
          <div class="doc-detail-row"><div class="k">Status</div><div class="v">${badge(d.status)}</div></div>
          <div class="doc-detail-row"><div class="k">Requested</div><div class="v">${fmtDateTime(d.requestedAt || d.createdAt)}</div></div>
          <div class="doc-detail-row"><div class="k">Issued</div><div class="v">${d.issuedAt ? fmtDateTime(d.issuedAt) : '—'}</div></div>
          <div class="doc-detail-row"><div class="k">Remarks</div><div class="v">${escapeHtml(d.remarks || '—')}</div></div>
        </div>

        <div class="doc-actions">
          ${d.status === 'pending' ? `
            <button class="btn btn-primary" onclick="FPU_ADMIN.approveDoc(${d.id})">Approve</button>
            <button class="btn btn-ghost" onclick="FPU_ADMIN.rejectDoc(${d.id})">Reject</button>
          ` : ''}
          ${d.status === 'approved' ? `
            <button class="btn btn-primary" onclick="FPU_ADMIN.issueDoc(${d.id})">Issue</button>
          ` : ''}
          ${d.fileUrl ? `<a class="btn btn-outline" href="${escapeHtml(d.fileUrl)}" target="_blank">Open File</a>` : ''}
        </div>
      </div>
    `;

    document.getElementById('dd-print').onclick = () => window.print();
  } catch (err) {
    root.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

async function approveDoc(id) {
  try {
    await adminFetch(`/api/admin/documents/${id}/approve`, { method: 'POST' });
    showToast('Document approved.', 'success');
    loadDocumentDetail();
    loadDocumentsTable();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function rejectDoc(id) {
  const remarks = prompt('Rejection remarks:');
  if (remarks === null) return;
  try {
    await adminFetch(`/api/admin/documents/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
    showToast('Document rejected.', 'warning');
    loadDocumentDetail();
    loadDocumentsTable();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function issueDoc(id) {
  const fileUrl = prompt('File URL (optional):');
  if (fileUrl === null) return;
  try {
    await adminFetch(`/api/admin/documents/${id}/issue`, {
      method: 'POST',
      body: JSON.stringify({ fileUrl: fileUrl || null }),
    });
    showToast('Document issued.', 'success');
    loadDocumentDetail();
    loadDocumentsTable();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function loadGraduations() {
  const container = document.getElementById("grad-queue-tbody") || document.getElementById("graduations-tbody");
  if (!container) return;
  container.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch("/api/admin/graduation");
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((r) => {
      const g = r.graduation || r;
      const s = r.student || {};
      return `
        <tr>
          <td>${escapeHtml((s.firstName || '') + ' ' + (s.lastName || '')).trim() || `Student #${g.studentId}`}</td>
          <td>${escapeHtml(s.matricNumber || '')}</td>
          <td>${escapeHtml(g.level || '')}</td>
          <td class="num">${g.cgpa || '—'}</td>
          <td>${escapeHtml(g.classification || '')}</td>
          <td>${badge(g.status)}</td>
          <td>—</td>
        </tr>`;
    }).join('') : '<tr><td colspan="7" class="empty">No graduations.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`;
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
        return (
          String(s.matricNumber || '').toLowerCase().includes(q) ||
          String(s.firstName || '').toLowerCase().includes(q) ||
          String(s.lastName || '').toLowerCase().includes(q)
        );
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
      const clsName = g.classification === 'Distinction' ? 'distinction'
        : g.classification === 'Upper Credit' ? 'upper'
        : g.classification === 'Lower Credit' ? 'lower'
        : g.classification === 'Pass' ? 'pass' : 'fail';
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
              ${canApprove ? `
                <button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.approveGraduation(${g.id})">Approve</button>
                <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.rejectGraduation(${g.id})">Reject</button>
              ` : ''}
              ${canGraduate ? `
                <button class="btn btn-sm btn-accent" onclick="FPU_ADMIN.markGraduated(${g.id})">Graduate</button>
              ` : ''}
              <button class="btn btn-sm btn-outline"
                onclick="FPU_ADMIN_SPA.navigateToWithQuery('transcript-by-student', { studentId: ${g.studentId} })">Transcript</button>
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
          try {
            await adminFetch(`/api/admin/graduation/${id}/approve`, { method: 'POST' });
            ok++;
          } catch { failed++; }
        }
        showToast(`✅ Approved ${ok}${failed ? `, ${failed} failed` : ''}.`);
        loadGraduationsTable();
      };
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function approveGraduation(id) {
  try {
    await adminFetch(`/api/admin/graduation/${id}/approve`, { method: 'POST' });
    showToast('Approved.', 'success');
    loadGraduationsTable();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function rejectGraduation(id) {
  const remarks = prompt('Rejection remarks:');
  if (remarks === null) return;
  try {
    await adminFetch(`/api/admin/graduation/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
    showToast('Rejected.', 'warning');
    loadGraduationsTable();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function markGraduated(id) {
  if (!confirm('Mark this student as graduated?')) return;
  try {
    await adminFetch(`/api/admin/graduation/${id}/graduate`, { method: 'POST' });
    showToast('Marked graduated.', 'success');
    loadGraduationsTable();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

// ============================================
// LIBRARY
// ============================================
async function loadLibrary() {
  const container = document.getElementById("books-tbody");
  if (!container) return;
  try {
    const res = await adminFetch("/api/admin/library/books?limit=200");
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((b) => `
      <tr>
        <td>${escapeHtml(b.title || '')}</td>
        <td>${escapeHtml(b.author || '')}</td>
        <td>${escapeHtml(b.category || '')}</td>
        <td class="num">${b.copiesAvailable}/${b.copiesTotal}</td>
        <td>${escapeHtml(b.shelf || '')}</td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="empty">No books.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadBooksGrid() {
  // batch3: books filter
  const __bksCategory = document.querySelector('#books-category-tabs .staff-role-tab.active')?.dataset.category || '';
  const __bksSearch = document.getElementById('books-search')?.value || '';
  const __bksAvail = document.getElementById('books-avail')?.value || '';

  // batch3a: books filter
  const _bksCategory = document.querySelector('#books-category-tabs .staff-role-tab.active')?.dataset.category || '';
  const _bksSearch = document.getElementById('books-search')?.value || '';
  const _bksAvail = document.getElementById('books-avail')?.value || '';

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

    const totalTitles = books.length;
    const totalCopies = books.reduce((s, b) => s + (b.copiesTotal || 0), 0);
    const onLoan = books.reduce((s, b) => s + ((b.copiesTotal || 0) - (b.copiesAvailable || 0)), 0);
    const available = books.reduce((s, b) => s + (b.copiesAvailable || 0), 0);

    setText('books-stat-total', totalTitles);
    setText('books-stat-copies', totalCopies);
    setText('books-stat-onloan', onLoan);
    setText('books-stat-avail', available);
    setText('books-count-all', totalTitles);

    if (!books.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">📚</div><p>No books match your filters.</p></div>';
      return;
    }

    grid.innerHTML = books.map((b, i) => {
      const catCls = `cat-${i % 6}`;
      const stock = b.copiesAvailable === 0 ? 'out' : b.copiesAvailable <= 2 ? 'low' : 'available';
      return `
        <div class="book-card"
             onclick="FPU_ADMIN_SPA.navigateToWithQuery('book-detail', { id: ${b.id} })">
          <div class="book-spine ${catCls}"></div>
          <h3>${escapeHtml(b.title || '')}</h3>
          <p class="book-author">${escapeHtml(b.author || 'Unknown')}</p>
          <div class="book-meta">
            ${b.category ? `<span class="book-chip category">${escapeHtml(b.category)}</span>` : ''}
            ${b.shelf ? `<span class="book-chip shelf">${escapeHtml(b.shelf)}</span>` : ''}
          </div>
          <div class="book-stock">
            <span class="num ${stock === 'low' ? 'warning' : stock === 'out' ? 'critical' : ''}">${b.copiesAvailable}</span>
            <span class="label">/ ${b.copiesTotal} available</span>
            <span class="book-stock-badge ${stock}">${stock === 'out' ? 'Out' : stock === 'low' ? 'Low' : 'Available'}</span>
          </div>
          <div class="book-actions">
            <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('book-form', { id: ${b.id} })">Edit</button>
            <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); FPU_ADMIN_SPA.navigateToWithQuery('borrow-issue', { bookId: ${b.id} })">Issue</button>
          </div>
        </div>
      `;
    }).join('');

    const sweepBtn = document.getElementById('books-sweep-overdue');
    if (sweepBtn) sweepBtn.onclick = () => adminFetch('/api/admin/library/sweep-overdue', { method: 'POST' }).then(() => showToast('Swept.', 'success'));
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger" style="grid-column:1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

async function loadBookDetail() {
  const root = document.getElementById('bd-header');
  if (!root) return;

  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  const id = params.get('id');

  if (!id) {
    root.innerHTML = '<div class="alert alert-warning">No book selected.</div>';
    return;
  }

  try {
    const res = await adminFetch(`/api/admin/library/books/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    const b = json.data;

    document.getElementById('bd-subtitle').textContent = b.isbn ? `ISBN ${b.isbn}` : '';

    root.innerHTML = `
      <div class="book-header-card">
        <div class="book-header-icon">📖</div>
        <div class="book-header-info">
          <h2>${escapeHtml(b.title || '')}</h2>
          <div class="author">${escapeHtml(b.author || 'Unknown')}</div>
          <div class="chips">
            ${b.category ? `<span class="tag-pill">${escapeHtml(b.category)}</span>` : ''}
            ${b.shelf ? `<span class="tag-pill gold">Shelf: ${escapeHtml(b.shelf)}</span>` : ''}
            ${b.year ? `<span class="tag-pill">${b.year}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="bd-stat-row">
        <div class="bd-stat"><span class="num">${b.copiesTotal}</span><span class="label">Total</span></div>
        <div class="bd-stat avail"><span class="num">${b.copiesAvailable}</span><span class="label">Available</span></div>
        <div class="bd-stat loan"><span class="num">${b.copiesTotal - b.copiesAvailable}</span><span class="label">On loan</span></div>
      </div>
    `;

    // Metadata
    const meta = document.getElementById('bd-metadata');
    if (meta) {
      const rows = [
        ['Title', b.title],
        ['Author', b.author],
        ['ISBN', b.isbn],
        ['Category', b.category],
        ['Publisher', b.publisher],
        ['Year', b.year],
        ['Shelf', b.shelf],
      ];
      meta.innerHTML = rows.map(([k, v]) => `
        <div class="field-row"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(v || '—')}</span></div>
      `).join('');
    }

    // Borrows
    try {
      const borrowsRes = await adminFetch(`/api/admin/library/borrows?limit=500`);
      const borrows = (await borrowsRes.json()).data || [];
      const bookBorrows = borrows.filter((r) => Number((r.borrow || r).bookId) === Number(id));

      const active = bookBorrows.filter((r) => (r.borrow || r).status === 'borrowed' || (r.borrow || r).status === 'overdue');
      const history = bookBorrows.filter((r) => (r.borrow || r).status === 'returned');

      const activeBody = document.getElementById('bd-active-borrows');
      const historyBody = document.getElementById('bd-history');
      const countEl = document.getElementById('bd-borrowed-count');

      if (countEl) countEl.textContent = `${active.length} active`;
      if (activeBody) {
        activeBody.innerHTML = active.length ? active.map((r) => {
          const borrow = r.borrow || r;
          const user = r.user || {};
          const initials = ((user.firstName || ' ')[0] + (user.lastName || ' ')[0]).toUpperCase().trim() || 'U';
          const overdue = borrow.status === 'overdue';
          return `
            <div class="borrow-row ${overdue ? 'overdue' : ''}">
              <div class="borrow-avatar">${user.photoUrl ? `<img src="${escapeHtml(user.photoUrl)}" alt="" />` : escapeHtml(initials)}</div>
              <div class="borrow-info">
                <strong>${escapeHtml((user.firstName || '') + ' ' + (user.lastName || ''))}</strong>
                <span>Due ${fmtDate(borrow.dueAt)}</span>
              </div>
              <button class="btn btn-sm btn-primary"
                onclick="event.stopPropagation(); FPU_ADMIN.returnBorrow(${borrow.id})">Return</button>
            </div>
          `;
        }).join('') : '<p class="muted" style="padding:16px;">No active borrows.</p>';
      }
      if (historyBody) {
        historyBody.innerHTML = history.length ? history.slice(0, 10).map((r) => {
          const borrow = r.borrow || r;
          const user = r.user || {};
          return `
            <div class="borrow-row">
              <div class="borrow-info">
                <strong>${escapeHtml((user.firstName || '') + ' ' + (user.lastName || ''))}</strong>
                <span>Returned ${fmtDate(borrow.returnedAt)}</span>
              </div>
            </div>
          `;
        }).join('') : '<p class="muted" style="padding:16px;">No history.</p>';
      }
    } catch { /* silent */ }

    document.getElementById('bd-edit').onclick = () => FPU_ADMIN_SPA.navigateToWithQuery('book-form', { id });
    document.getElementById('bd-issue').onclick = () => FPU_ADMIN_SPA.navigateToWithQuery('borrow-issue', { bookId: id });
    document.getElementById('bd-delete').onclick = async () => {
      if (!confirm('Delete this book?')) return;
      try {
        await adminFetch(`/api/admin/library/books/${id}`, { method: 'DELETE' });
        showToast('Deleted.', 'success');
        FPU_ADMIN_SPA.navigateTo('library');
      } catch (e) { showToast('❌ ' + e.message, 'error'); }
    };
  } catch (err) {
    root.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

async function loadBorrows() {
  const container = document.getElementById("borrows-tbody");
  if (!container) return;
  try {
    const res = await adminFetch("/api/admin/library/borrows");
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((r) => {
      const b = r.borrow || r;
      return `
        <tr>
          <td>${escapeHtml(r.book?.title || '')}</td>
          <td>${r.user ? `${escapeHtml(r.user.firstName)} ${escapeHtml(r.user.lastName)}` : '—'}</td>
          <td>${fmtDate(b.borrowedAt)}</td>
          <td>${fmtDate(b.dueAt)}</td>
          <td>${badge(b.status)}</td>
          <td>—</td>
        </tr>`;
    }).join('') : '<tr><td colspan="6" class="empty">No borrows.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadBorrowsTable() {
  // batch3: borrows filter
  const __borStatus = document.querySelector('#borrows-status-tabs .staff-role-tab.active')?.dataset.status || '';
  const __borSearch = document.getElementById('bor-search')?.value || '';
  const __borDue = document.getElementById('bor-due-filter')?.value || '';

  // batch3a: borrows filter
  const _borStatus = document.querySelector('#borrows-status-tabs .staff-role-tab.active')?.dataset.status || '';
  const _borSearch = document.getElementById('bor-search')?.value || '';
  const _borDue = document.getElementById('bor-due-filter')?.value || '';

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
      rows = rows.filter((r) => {
        const user = r.user || {};
        const book = r.book || {};
        return (
          String(user.firstName || '').toLowerCase().includes(q) ||
          String(user.lastName || '').toLowerCase().includes(q) ||
          String(user.matricNumber || '').toLowerCase().includes(q) ||
          String(book.title || '').toLowerCase().includes(q)
        );
      });
    }

    if (due) {
      const days = Number(due);
      const limit = Date.now() + days * 86400000;
      rows = rows.filter((r) => {
        const b = r.borrow || r;
        if (b.status !== 'borrowed') return false;
        return new Date(b.dueAt).getTime() <= limit;
      });
    }

    const total = rows.length;
    const active = rows.filter((r) => ['borrowed', 'overdue'].includes((r.borrow || r).status)).length;
    const overdue = rows.filter((r) => (r.borrow || r).status === 'overdue').length;
    const returned = rows.filter((r) => (r.borrow || r).status === 'returned').length;
    setText('bor-stat-total', total);
    setText('bor-stat-active', active);
    setText('bor-stat-overdue', overdue);
    setText('bor-stat-returned', returned);
    setText('bor-count', `Showing ${total}`);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No borrows.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((r) => {
      const b = r.borrow || r;
      const user = r.user || {};
      const book = r.book || {};
      const overdue = b.status === 'overdue';
      const due = new Date(b.dueAt);
      const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);

      const daysCls = b.status === 'returned' ? 'done' : overdue ? 'danger' : daysLeft <= 3 ? 'warning' : 'ok';
      const daysText = b.status === 'returned' ? 'Returned' : overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`;

      return `
        <tr class="${overdue ? 'borrow-row-overdue' : ''}">
          <td>${escapeHtml(book.title || '')}</td>
          <td>${escapeHtml((user.firstName || '') + ' ' + (user.lastName || ''))}</td>
          <td>${fmtDate(b.borrowedAt)}</td>
          <td>${fmtDate(b.dueAt)}</td>
          <td>${badge(b.status)}</td>
          <td><span class="days-badge ${daysCls}">${daysText}</span></td>
          <td>
            <div class="row-actions">
              ${b.status === 'borrowed' || b.status === 'overdue' ? `
                <button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.returnBorrow(${b.id})">Return</button>
                <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.markBorrowLost(${b.id})">Lost</button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    const sweepBtn = document.getElementById('borrows-sweep');
    if (sweepBtn) {
      sweepBtn.onclick = async () => {
        try {
          await adminFetch('/api/admin/library/sweep-overdue', { method: 'POST' });
          showToast('Swept overdue borrows.', 'success');
          loadBorrowsTable();
        } catch (err) { showToast('❌ ' + err.message, 'error'); }
      };
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function returnBorrow(id) {
  if (!confirm('Mark this book as returned?')) return;
  try {
    await adminFetch(`/api/admin/library/borrows/${id}/return`, { method: 'POST' });
    showToast('Returned.', 'success');
    loadBorrowsTable();
    loadBookDetail();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function markBorrowLost(id) {
  if (!confirm('Mark this book as lost?')) return;
  try {
    await adminFetch(`/api/admin/library/borrows/${id}/lost`, { method: 'POST' });
    showToast('Marked lost.', 'warning');
    loadBorrowsTable();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function loadFinesTable() {
  const tbody = document.getElementById('fines-tbody');
  if (!tbody) return;

  const status = (document.getElementById('fines-status-tabs')?.querySelector('.active')?.dataset.status) || '';

  const qs = new URLSearchParams();
  if (status === 'paid') qs.set('isPaid', 'true');
  else if (status === 'unpaid') qs.set('isPaid', 'false');

  tbody.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/library/fines?${qs}`);
    const json = await res.json();
    const rows = json.data || [];

    const unpaid = rows.filter((r) => !(r.fine || r).isPaid);
    const paid = rows.filter((r) => (r.fine || r).isPaid);
    const unpaidAmt = unpaid.reduce((s, r) => s + Number((r.fine || r).amount), 0);
    const paidAmt = paid.reduce((s, r) => s + Number((r.fine || r).amount), 0);

    setText('fines-stat-total', rows.length);
    setText('fines-stat-unpaid', money(unpaidAmt));
    setText('fines-stat-paid', money(paidAmt));
    setText('fines-stat-unpaid-count', unpaid.length);
    setText('fines-count', `Showing ${rows.length}`);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No fines.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((r) => {
      const f = r.fine || r;
      const user = r.user || {};
      return `
        <tr>
          <td><input type="checkbox" class="fine-check" data-id="${f.id}" /></td>
          <td>${escapeHtml((user.firstName || '') + ' ' + (user.lastName || ''))}</td>
          <td class="num">${money(f.amount)}</td>
          <td>${escapeHtml(f.reason || '—')}</td>
          <td>${f.isPaid ? badge('paid') : badge('pending')}</td>
          <td>${fmtDate(f.createdAt)}</td>
          <td>
            <div class="row-actions">
              ${!f.isPaid ? `<button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.payFine(${f.id})">Mark Paid</button>` : ''}
              <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.deleteFine(${f.id})">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    const selectAll = document.getElementById('fines-select-all');
    if (selectAll) {
      selectAll.onchange = () => {
        tbody.querySelectorAll('.fine-check').forEach((cb) => { cb.checked = selectAll.checked; });
      };
    }

    const bulkPaid = document.getElementById('fines-bulk-paid');
    if (bulkPaid) {
      bulkPaid.onclick = async () => {
        const ids = Array.from(tbody.querySelectorAll('.fine-check:checked')).map((c) => Number(c.dataset.id));
        if (!ids.length) { showToast('Select fines first.', 'warning'); return; }
        if (!confirm(`Mark ${ids.length} fine(s) paid?`)) return;
        let ok = 0, failed = 0;
        for (const id of ids) {
          try {
            await adminFetch(`/api/admin/library/fines/${id}/pay`, { method: 'POST' });
            ok++;
          } catch { failed++; }
        }
        showToast(`✅ ${ok} marked paid${failed ? `, ${failed} failed` : ''}.`);
        loadFinesTable();
      };
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function payFine(id) {
  try {
    await adminFetch(`/api/admin/library/fines/${id}/pay`, { method: 'POST' });
    showToast('Marked paid.', 'success');
    loadFinesTable();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function deleteFine(id) {
  if (!confirm('Delete this fine?')) return;
  try {
    await adminFetch(`/api/admin/library/fines/${id}`, { method: 'DELETE' });
    showToast('Deleted.', 'success');
    loadFinesTable();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function loadReservationsTable() {
  const tbody = document.getElementById('res-tbody');
  if (!tbody) return;

  const status = (document.getElementById('res-status-tabs')?.querySelector('.active')?.dataset.status) || '';

  const qs = new URLSearchParams();
  if (status) qs.set('status', status);

  tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/library/reservations?${qs}`);
    const json = await res.json();
    const rows = json.data || [];

    const total = rows.length;
    const pending = rows.filter((r) => (r.reservation || r).status === 'pending').length;
    const ready = rows.filter((r) => (r.reservation || r).status === 'ready').length;
    const fulfilled = rows.filter((r) => (r.reservation || r).status === 'fulfilled').length;
    setText('res-stat-total', total);
    setText('res-stat-pending', pending);
    setText('res-stat-ready', ready);
    setText('res-stat-fulfilled', fulfilled);
    setText('res-count', `Showing ${total}`);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No reservations.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((r) => {
      const res = r.reservation || r;
      const book = r.book || {};
      const user = r.user || {};
      return `
        <tr>
          <td>${escapeHtml(book.title || '')}</td>
          <td>${escapeHtml((user.firstName || '') + ' ' + (user.lastName || ''))}</td>
          <td>${badge(res.status)}</td>
          <td>${fmtDate(res.reservedAt)}</td>
          <td>${res.expiresAt ? fmtDate(res.expiresAt) : '—'}</td>
          <td>
            <div class="row-actions">
              ${res.status === 'pending' ? `<button class="btn btn-sm btn-outline" onclick="FPU_ADMIN.markReservationReady(${res.id})">Mark Ready</button>` : ''}
              ${res.status === 'ready' ? `<button class="btn btn-sm btn-primary" onclick="FPU_ADMIN.fulfillReservation(${res.id})">Fulfill</button>` : ''}
              ${['pending', 'ready'].includes(res.status) ? `<button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.cancelReservation(${res.id})">Cancel</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function markReservationReady(id) {
  try {
    await adminFetch(`/api/admin/library/reservations/${id}/ready`, { method: 'POST' });
    showToast('Marked ready.', 'success');
    loadReservationsTable();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function fulfillReservation(id) {
  try {
    await adminFetch(`/api/admin/library/reservations/${id}/fulfill`, { method: 'POST' });
    showToast('Fulfilled.', 'success');
    loadReservationsTable();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function cancelReservation(id) {
  if (!confirm('Cancel this reservation?')) return;
  try {
    await adminFetch(`/api/admin/library/reservations/${id}/cancel`, { method: 'POST' });
    showToast('Cancelled.', 'warning');
    loadReservationsTable();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

// ============================================
// REPORTS / AUDIT / SECURITY / SETTINGS
// ============================================
async function loadReports() {
  const box = document.getElementById("reports-box");
  const hasCharts = document.getElementById('rep-chart-admission');
  if (hasCharts) return loadReportsWithCharts();

  if (!box) return;
  try {
    const res = await adminFetch("/api/admin/reports/overview");
    const result = await res.json();
    const d = result.data || result;

    function humanize(k) {
      return k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
    }

    const items = Object.entries(d).filter(([, v]) => typeof v === 'number');
    box.innerHTML = items.map(([k, v]) => `
      <div class="stat">
        <div class="meta">
          <span class="label">${escapeHtml(humanize(k))}</span>
          <span class="value">${v}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    box.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

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
      new Chart(chartA, {
        type: 'line',
        data: {
          labels: admissionRows.map((r) => r.month),
          datasets: [{ data: admissionRows.map((r) => r.count), borderColor: '#065f46', backgroundColor: 'rgba(6,95,70,.1)', tension: .4, fill: true, borderWidth: 3 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      });
    }

    const revenueRes = await adminFetch(`/api/admin/reports/revenue-trend${qs}`);
    const revenueRows = (await revenueRes.json()).data || [];
    const chartR = document.getElementById('rep-chart-revenue');
    if (chartR && revenueRows.length) {
      new Chart(chartR, {
        type: 'line',
        data: {
          labels: revenueRows.map((r) => r.month),
          datasets: [{ data: revenueRows.map((r) => Number(r.total || 0)), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.15)', tension: .4, fill: true, borderWidth: 3 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      });
    }

    const deptRes = await adminFetch('/api/admin/reports/enrollment-by-department');
    const deptRows = (await deptRes.json()).data || [];
    const chartD = document.getElementById('rep-chart-dept');
    if (chartD && deptRows.length) {
      new Chart(chartD, {
        type: 'bar',
        data: {
          labels: deptRows.slice(0, 10).map((r) => r.name),
          datasets: [{ data: deptRows.slice(0, 10).map((r) => r.count), backgroundColor: '#065f46', borderRadius: 6 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      });
    }

    const appRes = await adminFetch('/api/admin/reports/applications-by-status');
    const appRows = (await appRes.json()).data || [];
    const chartAp = document.getElementById('rep-chart-apps');
    if (chartAp && appRows.length) {
      const colorMap = { pending: '#f59e0b', under_review: '#3b82f6', approved: '#065f46', rejected: '#dc2626', registered: '#8b5cf6' };
      new Chart(chartAp, {
        type: 'doughnut',
        data: {
          labels: appRows.map((r) => (r.status || '').replace(/_/g, ' ')),
          datasets: [{ data: appRows.map((r) => r.count), backgroundColor: appRows.map((r) => colorMap[r.status] || '#64748b'), borderColor: '#fff', borderWidth: 3 }],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '62%' },
      });
    }

    // Tables
    const appsTbody = document.getElementById('rep-apps-tbody');
    if (appsTbody) {
      appsTbody.innerHTML = appRows.length ? appRows.map((r) => `
        <tr><td>${escapeHtml(r.status)}</td><td class="num">${r.count}</td></tr>
      `).join('') : '<tr><td colspan="2" class="empty">No data.</td></tr>';
    }

    const payRes = await adminFetch('/api/admin/reports/payments-by-status');
    const payRows = (await payRes.json()).data || [];
    const payTbody = document.getElementById('rep-pay-tbody');
    if (payTbody) {
      payTbody.innerHTML = payRows.length ? payRows.map((r) => `
        <tr><td>${escapeHtml(r.status)}</td><td class="num">${r.count}</td><td class="num">${money(r.total)}</td></tr>
      `).join('') : '<tr><td colspan="3" class="empty">No data.</td></tr>';
    }

    const exportBtn = document.getElementById('rep-export');
    if (exportBtn) exportBtn.onclick = () => {
      const tables = document.querySelectorAll('.table-admin');
      if (tables.length) exportTableAsCSV(tables[0], 'reports.csv');
    };
  } catch (err) {
    console.debug('[reports]', err && err.message);
  }
}

async function loadAudit() {
  const container = document.getElementById("audit-tbody");
  if (!container) return;

  const action = (document.getElementById("audit-action") || {}).value || "";
  const entity = (document.getElementById("audit-entity") || {}).value || "";
  const from = (document.getElementById("audit-from") || {}).value || "";
  const to = (document.getElementById("audit-to") || {}).value || "";

  const qs = new URLSearchParams();
  if (action) qs.set("action", action);
  if (entity) qs.set("entity", entity);
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  container.innerHTML = '<tr><td colspan="5" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/audit?${qs}`);
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((r) => {
      const log = r.log || r;
      return `
        <tr>
          <td><code>${escapeHtml(log.action || '')}</code></td>
          <td>${r.user ? `${escapeHtml(r.user.firstName)} ${escapeHtml(r.user.lastName)}` : '—'}</td>
          <td>${escapeHtml(log.entity || '')}</td>
          <td>${escapeHtml(log.entityId || '')}</td>
          <td>${fmtDateTime(log.createdAt)}</td>
        </tr>`;
    }).join('') : '<tr><td colspan="5" class="empty">No audit entries.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(err.message)}</td></tr>`;
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

    // Also load login history
    const loginTbody = document.getElementById('login-tbody');
    if (loginTbody) {
      const lr = await adminFetch('/api/admin/login-history?limit=100');
      const lj = await lr.json();
      const lrows = lj.data || [];
      setText('login-count', `Showing ${lrows.length}`);
      loginTbody.innerHTML = lrows.length ? lrows.map((r) => {
        const entry = r.entry || r;
        const user = r.user || {};
        return `
          <tr>
            <td>${user ? escapeHtml(`${user.firstName || ''} ${user.lastName || ''}`.trim()) : '—'}</td>
            <td>${escapeHtml(entry.email || '')}</td>
            <td>${entry.success ? badge('success') : badge('failed')}</td>
            <td>${escapeHtml(entry.ipAddress || '')}</td>
            <td>${escapeHtml(entry.reason || '')}</td>
            <td>${fmtDateTime(entry.createdAt)}</td>
          </tr>
        `;
      }).join('') : '<tr><td colspan="6" class="empty">No records.</td></tr>';
    }

    // Tabs
    const auditTabs = document.querySelectorAll('#audit-tabs .staff-role-tab');
    auditTabs.forEach((t) => {
      t.onclick = () => {
        auditTabs.forEach((x) => x.classList.remove('active'));
        t.classList.add('active');
        const audit = document.getElementById('audit-panel');
        const login = document.getElementById('login-panel');
        const filters = document.getElementById('audit-filters');
        if (t.dataset.tab === 'login') {
          if (audit) audit.style.display = 'none';
          if (login) login.style.display = 'block';
          if (filters) filters.style.display = 'none';
        } else {
          if (audit) audit.style.display = 'block';
          if (login) login.style.display = 'none';
          if (filters) filters.style.display = 'flex';
        }
      };
    });

    const exportBtn = document.getElementById('audit-export');
    if (exportBtn) exportBtn.onclick = () => exportTableAsCSV(container.closest('table'), 'audit.csv');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadSecurity() {
  const container = document.getElementById("security-tbody");
  if (!container) return;
  try {
    const res = await adminFetch("/api/admin/security");
    const result = await res.json();
    const rows = extractArray(result);

    container.innerHTML = rows.length ? rows.map((r) => {
      const log = r.log || r;
      return `
        <tr>
          <td>${escapeHtml(log.event || '')}</td>
          <td>${escapeHtml(log.severity || '')}</td>
          <td>${r.user ? `${escapeHtml(r.user.firstName)} ${escapeHtml(r.user.lastName)}` : '—'}</td>
          <td>${escapeHtml(log.ipAddress || '')}</td>
          <td>${fmtDateTime(log.createdAt)}</td>
        </tr>`;
    }).join('') : '<tr><td colspan="5" class="empty">No security events.</td></tr>';
  } catch (err) {
    container.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadSecurityDashboard() {
  try {
    const [summary, events, logins] = await Promise.all([
      adminFetch('/api/admin/security/summary'),
      adminFetch('/api/admin/security?limit=100'),
      adminFetch('/api/admin/login-history?limit=100&success=false'),
    ]);

    const summaryRows = (await summary.json()).data || [];
    const eventRows = (await events.json()).data || [];
    const failedRows = (await logins.json()).data || [];

    const critical = summaryRows.find((r) => r.severity === 'critical')?.c || 0;
    const warning = summaryRows.find((r) => r.severity === 'warning')?.c || 0;
    const info = summaryRows.find((r) => r.severity === 'info')?.c || 0;

    setText('sec-kpi-sessions', 0);
    setText('sec-kpi-failed', failedRows.length);
    setText('sec-kpi-locked', 0);
    setText('sec-kpi-blocked', 0);

    // Threat banner
    const banner = document.getElementById('sec-threat-banner');
    if (banner) {
      const score = critical * 10 + warning * 3 + info;
      const level = critical > 0 ? 'high' : warning > 5 ? 'medium' : 'low';
      banner.className = `sec-threat-banner ${level}`;
      banner.innerHTML = `
        <div class="stb-score ${level}">${Math.min(100, score)}</div>
        <div class="stb-info">
          <h3>Threat Level: ${level.toUpperCase()}</h3>
          <p>${critical} critical · ${warning} warning · ${info} info events</p>
          <div class="stb-issues">
            ${failedRows.length > 5 ? `<span>${failedRows.length} failed logins in the last 24h</span>` : ''}
            ${critical > 0 ? `<span>${critical} critical security event(s) recorded</span>` : ''}
          </div>
        </div>
      `;
    }

    setText('sac-events-badge', eventRows.length);
    setText('sac-sessions-badge', '—');

    // Recent critical events
    const recent = eventRows.filter((r) => (r.log || r).severity === 'critical').slice(0, 10);
    const tbody = document.getElementById('sec-recent-events');
    if (tbody) {
      tbody.innerHTML = recent.length ? recent.map((r) => {
        const log = r.log || r;
        return `
          <tr>
            <td>${escapeHtml(log.event || '')}</td>
            <td>${badge(log.severity)}</td>
            <td>${r.user ? `${escapeHtml(r.user.firstName)} ${escapeHtml(r.user.lastName)}` : '—'}</td>
            <td>${escapeHtml(log.ipAddress || '')}</td>
            <td class="small muted">${fmtDateTime(log.createdAt)}</td>
          </tr>
        `;
      }).join('') : '<tr><td colspan="5" class="empty">No critical events.</td></tr>';
    }
  } catch (err) {
    console.debug('[security-dashboard]', err && err.message);
  }
}

async function loadSecurityEvents() {
  const tbody = document.getElementById('ev-tbody');
  if (!tbody) return;

  const severity = (document.getElementById('ev-severity-tabs')?.querySelector('.active')?.dataset.severity) || '';
  const event = (document.getElementById('ev-event') || {}).value || '';
  const resolved = (document.getElementById('ev-resolved') || {}).value || '';

  const qs = new URLSearchParams({ limit: 300 });
  if (severity) qs.set('severity', severity);
  if (event) qs.set('event', event);

  tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/security?${qs}`);
    const json = await res.json();
    const rows = json.data || [];

    const total = rows.length;
    const critical = rows.filter((r) => (r.log || r).severity === 'critical').length;
    const warning = rows.filter((r) => (r.log || r).severity === 'warning').length;
    setText('ev-stat-total', total);
    setText('ev-stat-critical', critical);
    setText('ev-stat-warning', warning);
    setText('ev-stat-unresolved', total);
    setText('ev-count', `Showing ${total}`);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No security events.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((r) => {
      const log = r.log || r;
      return `
        <tr>
          <td><code>${escapeHtml(log.event || '')}</code></td>
          <td>${badge(log.severity)}</td>
          <td>${r.user ? `${escapeHtml(r.user.firstName)} ${escapeHtml(r.user.lastName)}` : '—'}</td>
          <td>${escapeHtml(log.ipAddress || '')}</td>
          <td class="small muted">${fmtDateTime(log.createdAt)}</td>
          <td>
            <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.copyToClipboard('${escapeQuotes(JSON.stringify(log.details || {}))}')">Copy Details</button>
          </td>
        </tr>
      `;
    }).join('');

    const exportBtn = document.getElementById('ev-export');
    if (exportBtn) exportBtn.onclick = () => exportTableAsCSV(tbody.closest('table'), 'security-events.csv');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
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
    setText('sess-count', `Showing ${rows.length}`);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No active sessions.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((r) => {
      const s = r.session || {};
      const u = r.user || {};
      return `
        <tr>
          <td>${escapeHtml((u.firstName || '') + ' ' + (u.lastName || ''))}<br/><span class="small muted">${escapeHtml(u.email || '')}</span></td>
          <td>${roleBadge(u.role)}</td>
          <td class="small">${escapeHtml((s.userAgent || '').slice(0, 60))}</td>
          <td>${escapeHtml(s.ipAddress || '')}</td>
          <td class="small muted">${fmtDateTime(s.createdAt)}</td>
          <td class="small muted">${fmtDateTime(s.expiresAt)}</td>
          <td>
            <button class="btn btn-sm btn-danger"
              onclick="FPU_ADMIN.revokeSession('${escapeQuotes(s.token)}')">Revoke</button>
          </td>
        </tr>
      `;
    }).join('');

    const purgeBtn = document.getElementById('sess-purge');
    if (purgeBtn) {
      purgeBtn.onclick = async () => {
        try {
          await adminFetch('/api/admin/security/purge', { method: 'POST' });
          showToast('Purged expired sessions.', 'success');
          loadSecuritySessions();
        } catch (err) { showToast('❌ ' + err.message, 'error'); }
      };
    }
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
    setText('la-count', `Showing ${total}`);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No login attempts.</td></tr>';
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
          <td>
            <button class="btn btn-sm btn-ghost"
              onclick="FPU_ADMIN.addIpBlock('${escapeQuotes(entry.ipAddress || '')}')">Block IP</button>
          </td>
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

async function loadIpRules() {
  const tbody = document.getElementById('ip-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch('/api/admin/security/ip-rules');
    const json = await res.json();
    const rows = json.data || [];

    const allow = rows.filter((r) => r.rule === 'allow').length;
    const block = rows.filter((r) => r.rule === 'block').length;
    const soon = rows.filter((r) => {
      if (!r.expiresAt) return false;
      const diff = new Date(r.expiresAt).getTime() - Date.now();
      return diff > 0 && diff < 24 * 3600 * 1000;
    }).length;

    setText('ip-stat-total', rows.length);
    setText('ip-stat-allow', allow);
    setText('ip-stat-block', block);
    setText('ip-stat-expiring', soon);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No IP rules.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.ipAddress)}</code></td>
        <td>${r.rule === 'allow' ? badge('active') : badge('rejected')}</td>
        <td>${escapeHtml(r.reason || '—')}</td>
        <td>${r.expiresAt ? fmtDateTime(r.expiresAt) : '—'}</td>
        <td class="small muted">${fmtDateTime(r.createdAt)}</td>
        <td>
          <button class="btn btn-sm btn-ghost" onclick="FPU_ADMIN.deleteIpRule(${r.id})">Delete</button>
        </td>
      </tr>
    `).join('');

    // Prefill IP if navigated from attempts
    const hash = window.location.hash.replace(/^#/, '');
    const qIdx = hash.indexOf('?');
    const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
    const ip = params.get('ip');
    if (ip) {
      document.getElementById('ip-add-panel').style.display = 'block';
      document.getElementById('ip-address').value = ip;
    }

    // Add form
    const addBtn = document.getElementById('ip-add-btn');
    const panel = document.getElementById('ip-add-panel');
    if (addBtn) addBtn.onclick = () => panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    document.getElementById('ip-add-cancel').onclick = () => panel.style.display = 'none';
    document.getElementById('ip-save').onclick = async () => {
      const address = document.getElementById('ip-address').value.trim();
      const rule = document.getElementById('ip-rule').value;
      const expires = document.getElementById('ip-expires').value || null;
      const reason = document.getElementById('ip-reason').value.trim();
      if (!address) { showToast('IP address required.', 'warning'); return; }
      try {
        await adminFetch('/api/admin/security/ip-rules', {
          method: 'POST',
          body: JSON.stringify({ ipAddress: address, rule, expiresAt: expires, reason }),
        });
        showToast('Rule added.', 'success');
        loadIpRules();
      } catch (err) { showToast('❌ ' + err.message, 'error'); }
    };
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function deleteIpRule(id) {
  if (!confirm('Delete this IP rule?')) return;
  try {
    await adminFetch(`/api/admin/security/ip-rules/${id}`, { method: 'DELETE' });
    showToast('Deleted.', 'success');
    loadIpRules();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
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
  if (saveBtn) {
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
    const roles = d.roles || [];
    const resources = d.resources || [];

    thead.innerHTML = `<tr><th>Resource</th>${roles.map((r) => `<th>${escapeHtml(String(r).replace(/_/g, ' '))}</th>`).join('')}</tr>`;

    tbody.innerHTML = resources.map((res) => `
      <tr>
        <td class="resource-cell">${escapeHtml(res)}</td>
        ${roles.map((role) => `
          <td><input type="checkbox"
            data-resource="${escapeHtml(res)}"
            data-role="${escapeHtml(role)}"
            ${(d.matrix?.[res]?.[role]) ? 'checked' : ''} /></td>
        `).join('')}
      </tr>
    `).join('');

    setText('perm-count', `${resources.length} resources × ${roles.length} roles`);

    const saveBtn = document.getElementById('perm-save');
    if (saveBtn) {
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
    if (saveBtn) {
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
        <td>
          ${b.fileUrl ? `<a class="btn btn-sm btn-outline" href="${escapeHtml(b.fileUrl)}" target="_blank">Download</a>` : ''}
        </td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="empty">No backups yet.</td></tr>';

    const triggerBtn = document.getElementById('bk-trigger');
    if (triggerBtn) {
      triggerBtn.onclick = async () => {
        if (!confirm('Trigger a manual backup now?')) return;
        try {
          await adminFetch('/api/admin/security/backups/trigger', { method: 'POST' });
          showToast('Backup queued.', 'success');
          setTimeout(loadBackups, 2000);
        } catch (err) { showToast('❌ ' + err.message, 'error'); }
      };
    }

    const saveBtn = document.getElementById('bk-save-config');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const payload = {
          schedule: document.getElementById('bk-schedule').value,
          retentionDays: Number(document.getElementById('bk-retention').value),
          storage: document.getElementById('bk-storage').value,
        };
        try {
          await adminFetch('/api/admin/security/backups/config', {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          showToast('Backup config saved.', 'success');
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
    if (exportBtn) {
      exportBtn.onclick = () => {
        const report = checks.map((c) => `${c.status.toUpperCase()}\t${c.title}\t${c.detail}`).join('\n');
        const blob = new Blob([report], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'compliance-report.txt';
        a.click();
      };
    }
  } catch (err) {
    root.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

async function loadSettings() {
  const box = document.getElementById("settings-box");
  if (!box) return;
  try {
    const res = await adminFetch("/api/admin/settings");
    const result = await res.json();
    const rows = extractArray(result);

    box.innerHTML = rows.map((s) => `
      <div class="form-group">
        <label class="form-label">${escapeHtml(s.key)} <span class="small muted">(${escapeHtml(s.category || 'general')})</span></label>
        <input class="form-control" data-setting-key="${escapeHtml(s.key)}" value="${escapeHtml(s.value || '')}" />
      </div>
    `).join('') + `
      <div class="form-actions">
        <button class="btn btn-primary" id="save-settings">Save All</button>
      </div>`;

    const saveBtn = document.getElementById("save-settings");
    if (saveBtn) saveBtn.addEventListener("click", async () => {
      const payload = {};
      box.querySelectorAll("[data-setting-key]").forEach((inp) => {
        payload[inp.dataset.settingKey] = inp.value;
      });
      try {
        await adminFetch("/api/admin/settings/bulk", {
          method: "POST",
          body: JSON.stringify({ settings: payload }),
        });
        showToast("Settings saved.");
      } catch (err) {
        showToast("❌ " + err.message, "error");
      }
    });
  } catch (err) {
    box.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
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
      // Prefill values from server
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

async function saveSettingsSection(form) {
  const A = window.FPU_ADMIN;
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

async function loadAdvancedSettings() {
  const tbody = document.getElementById('adv-tbody');
  if (!tbody) return;

  const search = (document.getElementById('adv-search') || {}).value || '';

  tbody.innerHTML = '<tr><td colspan="4" class="empty">Loading…</td></tr>';

  try {
    const res = await adminFetch('/api/admin/settings');
    const json = await res.json();
    let rows = json.data || [];

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => String(r.key || '').toLowerCase().includes(q));
    }

    tbody.innerHTML = rows.map((s) => `
      <tr>
        <td><code>${escapeHtml(s.key)}</code></td>
        <td>${escapeHtml(s.category || '')}</td>
        <td><input class="form-control" data-adv-key="${escapeHtml(s.key)}" value="${escapeHtml(s.value || '')}" /></td>
        <td>
          <button class="btn btn-sm btn-primary"
            onclick="FPU_ADMIN.saveAdvSetting('${escapeQuotes(s.key)}')">Save</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="4" class="empty">No settings.</td></tr>';
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">${escapeHtml(err.message)}</td></tr>`;
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

// ============================================
// EXPORTS
// ============================================

// ==== FPU Batch 1 additions ====
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
// ==== END FPU Batch 1 additions ====


// ==== FPU Batch 2 additions ====
// ------------------------------------------------------------
// Grade Scale — Add Band + Edit Band form handlers
// ------------------------------------------------------------
function wireGradeScaleForms() {
  const btn = document.getElementById('gs-add-btn');
  const panel = document.getElementById('gs-add-panel');
  const cancel1 = document.getElementById('gs-add-cancel');
  const cancel2 = document.getElementById('gs-add-cancel-2');
  const modal = document.getElementById('gs-modal');
  const modalClose = document.getElementById('gs-modal-close');
  const editCancel = document.getElementById('gs-edit-cancel');
  const addForm = document.getElementById('gs-add-form');
  const editForm = document.getElementById('gs-edit-form');

  if (btn && panel && !btn.__bound) {
    btn.__bound = true;
    btn.onclick = () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; };
  }
  if (cancel1) cancel1.onclick = () => { if (panel) panel.style.display = 'none'; };
  if (cancel2) cancel2.onclick = () => { if (panel) panel.style.display = 'none'; };
  if (modalClose) modalClose.onclick = () => { if (modal) modal.style.display = 'none'; };
  if (editCancel) editCancel.onclick = () => { if (modal) modal.style.display = 'none'; };

  if (addForm && !addForm.__bound) {
    addForm.__bound = true;
    addForm.onsubmit = async (e) => {
      e.preventDefault();
      const valEl = document.getElementById('gs-add-validation');
      if (valEl) valEl.innerHTML = '';

      const payload = {
        grade: String(document.getElementById('gs-add-grade').value || '').trim().toUpperCase(),
        minScore: Number(document.getElementById('gs-add-min').value),
        maxScore: Number(document.getElementById('gs-add-max').value),
        points: Number(document.getElementById('gs-add-points').value),
        remark: String(document.getElementById('gs-add-remark').value || '').trim(),
        isActive: document.getElementById('gs-add-active').checked,
      };

      if (!payload.grade) {
        if (valEl) valEl.innerHTML = '<div class="alert alert-error">⚠️ Grade is required.</div>';
        return;
      }
      if (!(payload.minScore >= 0 && payload.maxScore <= 100 && payload.minScore < payload.maxScore)) {
        if (valEl) valEl.innerHTML = '<div class="alert alert-error">⚠️ Score range must be 0–100 with min &lt; max.</div>';
        return;
      }

      try {
        await adminFetch('/api/admin/grade-scales', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Band added.', 'success');
        panel.style.display = 'none';
        addForm.reset();
        loadGradeScales();
      } catch (err) {
        if (valEl) valEl.innerHTML = '<div class="alert alert-error">❌ ' + escapeHtml(err.message) + '</div>';
      }
    };
  }

  if (editForm && !editForm.__bound) {
    editForm.__bound = true;
    editForm.onsubmit = async (e) => {
      e.preventDefault();
      const id = editForm.dataset.id;
      if (!id) return;
      const payload = {
        grade: String(document.getElementById('gs-edit-grade').value || '').trim().toUpperCase(),
        minScore: Number(document.getElementById('gs-edit-min').value),
        maxScore: Number(document.getElementById('gs-edit-max').value),
        points: Number(document.getElementById('gs-edit-points').value),
        remark: String(document.getElementById('gs-edit-remark').value || '').trim(),
        isActive: document.getElementById('gs-edit-active').checked,
      };
      try {
        await adminFetch('/api/admin/grade-scales/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Band updated.', 'success');
        modal.style.display = 'none';
        loadGradeScales();
      } catch (err) {
        const valEl = document.getElementById('gs-edit-validation');
        if (valEl) valEl.innerHTML = '<div class="alert alert-error">❌ ' + escapeHtml(err.message) + '</div>';
      }
    };
  }
}

// ------------------------------------------------------------
// Fees — Copy from prior session modal + session filter
// ------------------------------------------------------------
async function openCopyFeesModal() {
  const modal = document.getElementById('fees-copy-modal');
  if (!modal) return;

  try {
    const res = await adminFetch('/api/admin/sessions');
    const json = await res.json();
    const sessions = json.data || [];

    const fromSel = document.getElementById('copy-from-session');
    const toSel = document.getElementById('copy-to-session');
    if (fromSel && toSel) {
      const opts = sessions.map((s) => '<option value="' + s.id + '">' + escapeHtml(s.name) + '</option>').join('');
      fromSel.innerHTML = '<option value="">— Choose —</option>' + opts;
      toSel.innerHTML   = '<option value="">— Choose —</option>' + opts;
    }
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
}

async function copyFeesFromSession() {
  const fromId = (document.getElementById('copy-from-session') || {}).value;
  const toId   = (document.getElementById('copy-to-session') || {}).value;
  const valEl  = document.getElementById('copy-validation');

  if (valEl) valEl.innerHTML = '';

  if (!fromId || !toId) {
    if (valEl) valEl.innerHTML = '<div class="alert alert-error">⚠️ Choose both sessions.</div>';
    return;
  }
  if (fromId === toId) {
    if (valEl) valEl.innerHTML = '<div class="alert alert-error">⚠️ Source and target must differ.</div>';
    return;
  }

  try {
    const res = await adminFetch('/api/admin/fees/copy', {
      method: 'POST',
      body: JSON.stringify({ fromSessionId: Number(fromId), toSessionId: Number(toId) }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showToast('✅ Copied ' + json.copied + ' structure(s).');
    document.getElementById('fees-copy-modal').style.display = 'none';
    loadFeeDepartments();
  } catch (err) {
    if (valEl) valEl.innerHTML = '<div class="alert alert-error">❌ ' + escapeHtml(err.message) + '</div>';
  }
}

function wireFeesCopyButton() {
  const copyBtn = document.getElementById('fees-copy-btn');
  if (copyBtn && !copyBtn.__bound) {
    copyBtn.__bound = true;
    copyBtn.onclick = openCopyFeesModal;
  }
  const confirmCopy = document.getElementById('copy-confirm-btn');
  if (confirmCopy && !confirmCopy.__bound) {
    confirmCopy.__bound = true;
    confirmCopy.onclick = copyFeesFromSession;
  }
  const copyClose = document.getElementById('fees-copy-close');
  if (copyClose) copyClose.onclick = () => { document.getElementById('fees-copy-modal').style.display = 'none'; };
  const copyCancel = document.getElementById('fees-copy-cancel');
  if (copyCancel) copyCancel.onclick = () => { document.getElementById('fees-copy-modal').style.display = 'none'; };
}

// ------------------------------------------------------------
// Lecturer — Workload Summary button
// ------------------------------------------------------------
function wireLecturerWorkloadButton() {
  const wlBtn = document.getElementById('lec-view-workloads');
  if (wlBtn && !wlBtn.__bound) {
    wlBtn.__bound = true;
    wlBtn.onclick = () => FPU_ADMIN_SPA.navigateTo('staff-workload');
  }
}

// ------------------------------------------------------------
// Timetable — Print All
// ------------------------------------------------------------
async function printAllTimetableSheets() {
  try {
    const res = await adminFetch('/api/admin/departments');
    const depts = (await res.json()).data || [];
    if (!depts.length) { showToast('No departments.', 'warning'); return; }

    const sessionId = (document.getElementById('tt-session') || {}).value || '';
    const semester  = (document.getElementById('tt-semester') || {}).value || 'first';

    showToast('Opening ' + depts.length + ' department sheet(s)…', 'info');
    for (const d of depts) {
      FPU_ADMIN_SPA.navigateToWithQuery('timetable-by-dept', {
        departmentId: d.id, sessionId, semester, name: d.name,
      });
      await new Promise((r) => setTimeout(r, 900));
      window.print();
      await new Promise((r) => setTimeout(r, 400));
    }
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

function wireTimetablePrintAll() {
  const printAll = document.getElementById('tt-print-all');
  if (printAll && !printAll.__bound) {
    printAll.__bound = true;
    printAll.onclick = printAllTimetableSheets;
  }
}

// ------------------------------------------------------------
// Exams — Print All + Exam Periods modal
// ------------------------------------------------------------
async function printAllExamSheets() {
  try {
    const res = await adminFetch('/api/admin/schools');
    const schools = (await res.json()).data || [];
    const sessionId = (document.getElementById('ex-session') || {}).value || '';
    const semester  = (document.getElementById('ex-semester') || {}).value || 'first';

    showToast('Opening ' + schools.length + ' school sheet(s)…', 'info');
    for (const s of schools) {
      FPU_ADMIN_SPA.navigateToWithQuery('exam-sheet', {
        schoolId: s.id, sessionId, semester, name: s.name,
      });
      await new Promise((r) => setTimeout(r, 900));
      window.print();
      await new Promise((r) => setTimeout(r, 400));
    }
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

function openExamPeriodsModal() {
  const modal = document.getElementById('ex-periods-modal');
  if (!modal) return;

  let periods;
  try { periods = JSON.parse(localStorage.getItem('fpu_exam_periods') || 'null'); } catch { periods = null; }
  if (!Array.isArray(periods) || !periods.length) {
    periods = [
      { label: 'Period 1', start: '09:00', end: '11:00' },
      { label: 'Period 2', start: '11:00', end: '13:00' },
      { label: 'Period 3', start: '13:00', end: '15:00' },
      { label: 'Period 4', start: '15:00', end: '17:00' },
    ];
  }

  const editor = document.getElementById('ex-periods-editor');
  if (!editor) return;
  editor.innerHTML = periods.map((p, i) =>
    '<div class="period-edit-row">' +
      '<input class="form-control" data-period-label="' + i + '" value="' + escapeHtml(p.label) + '" placeholder="Label" />' +
      '<input class="form-control" type="time" data-period-start="' + i + '" value="' + escapeHtml(p.start) + '" />' +
      '<input class="form-control" type="time" data-period-end="' + i + '" value="' + escapeHtml(p.end) + '" />' +
      '<button type="button" class="del-btn" data-period-del="' + i + '">×</button>' +
    '</div>'
  ).join('');

  modal.style.display = 'flex';
  modal.classList.add('open');
}

function saveExamPeriods() {
  const rows = document.querySelectorAll('#ex-periods-editor .period-edit-row');
  const periods = [];
  rows.forEach((row, i) => {
    const label = row.querySelector('[data-period-label="' + i + '"]').value.trim();
    const start = row.querySelector('[data-period-start="' + i + '"]').value;
    const end   = row.querySelector('[data-period-end="' + i + '"]').value;
    if (label && start && end) periods.push({ label, start, end });
  });
  if (!periods.length) { showToast('At least one period required.', 'warning'); return; }
  localStorage.setItem('fpu_exam_periods', JSON.stringify(periods));
  window.__examPeriods = periods;
  document.getElementById('ex-periods-modal').style.display = 'none';
  showToast('Exam periods saved.', 'success');
  if (window.FPU_ADMIN.loadExamsIndex) loadExamsIndex();
}

function wireExamPrintAll() {
  const printAll = document.getElementById('ex-print-all');
  if (printAll && !printAll.__bound) {
    printAll.__bound = true;
    printAll.onclick = printAllExamSheets;
  }
  const editBtn = document.getElementById('ex-edit-periods');
  if (editBtn && !editBtn.__bound) {
    editBtn.__bound = true;
    editBtn.onclick = openExamPeriodsModal;
  }
  const saveBtn = document.getElementById('ex-periods-save');
  if (saveBtn && !saveBtn.__bound) {
    saveBtn.__bound = true;
    saveBtn.onclick = saveExamPeriods;
  }
  const closeBtn = document.getElementById('ex-periods-close');
  if (closeBtn) closeBtn.onclick = () => { document.getElementById('ex-periods-modal').style.display = 'none'; };
  const cancelBtn = document.getElementById('ex-periods-cancel');
  if (cancelBtn) cancelBtn.onclick = () => { document.getElementById('ex-periods-modal').style.display = 'none'; };
  const addBtn = document.getElementById('ex-periods-add');
  if (addBtn && !addBtn.__bound) {
    addBtn.__bound = true;
    addBtn.onclick = () => {
      const editor = document.getElementById('ex-periods-editor');
      if (!editor) return;
      const idx = editor.children.length;
      const row = document.createElement('div');
      row.className = 'period-edit-row';
      row.innerHTML =
        '<input class="form-control" data-period-label="' + idx + '" placeholder="Label" />' +
        '<input class="form-control" type="time" data-period-start="' + idx + '" />' +
        '<input class="form-control" type="time" data-period-end="' + idx + '" />' +
        '<button type="button" class="del-btn" data-period-del="' + idx + '">×</button>';
      editor.appendChild(row);
    };
  }
}

// ------------------------------------------------------------
// Auto-wire all Batch 2 page-specific buttons
// ------------------------------------------------------------
function wireBatch2() {
  wireGradeScaleForms();
  wireFeesCopyButton();
  wireLecturerWorkloadButton();
  wireTimetablePrintAll();
  wireExamPrintAll();
}

function wireBatch3() {
  // batch3a: extra wiring
  // Grade scale add-form (already in batch2 but ensure present)
  if (typeof wireGradeScaleForms === 'function') wireGradeScaleForms();
}


document.addEventListener('DOMContentLoaded', () => {
  wireBatch2();
  const view = document.getElementById('page-view');
  if (view) new MutationObserver(() => { wireBatch2(); wireBatch3(); }).observe(view, { childList: true, subtree: true });
});

window.addEventListener('hashchange', () => setTimeout(() => { wireBatch2(); wireBatch3(); }, 120));

// ==== END FPU Batch 2 additions ====

window.FPU_ADMIN = {
  adminFetch, setAdminSession, clearAdminSession, getAdminToken, getAdminUser,
  requireAdminAuth,
  toast: showToast, showToast, escapeHtml, escapeQuotes, capitalize, getInitials,
  timeAgo, fmtDate, fmtDateTime, money, setText, copyToClipboard, openModal,
  extractArray, badge, roleBadge, statusPill, promptReason, exportTableAsCSV,

  // dashboard
  initDashboard, loadDashboardStats, loadRecentActivity, loadAll,

  // dashboard chart loaders
  loadStats, loadTopDepartments, loadPendingApprovals,
  loadStudentsByDept, loadStudentsByProgramme, loadStudentsByLevel, loadStudentGender,
  loadAdmissionTrend, loadApplicationStatus, loadPopulationTrend, loadPaymentStatus,
  loadRevenueTrend, loadRegistrationStats, loadDeptComparison, loadResultsStats,
  loadRecentStudents, loadRecentPayments, loadRecentApplications, loadRecentRegistrations,
  loadRecentResults, loadRecentNotifications, loadUpcomingEvents, loadRecentLogins,

  // applications
  loadApplications, loadAdmitted, registerAdmitted, bulkApplicationAction,
  updateApplicationStats, updateAdmittedStats, bulkRegisterAdmitted,

  // students (department-first)
  loadStudentDepartments, loadDepartmentStudents, globalStudentSearch, bulkStudentAction,

  // users
  loadUsers, loadAdmins, loadUsersWithPhotos, loadLoginHistory,
  loadUsersHub, loadAllUsers, loadAdminAccounts,
  resetAdminPwd, toggleAdminActive,

  // sessions
  loadSessions, setCurrentSession, deleteSession,

  // academics
  loadProgrammes, loadSchools, loadSchoolCards,
  loadDepartments, loadDepartmentCards,
  loadAllocations, loadAllocationDepartments, loadDepartmentAllocations,
  loadRegistrations, approveRegistration, rejectRegistration,
  loadRegistrationStudents, loadCourseRegistrations, loadStudentRegistrations,
  approveAllPendingCourse,
  loadResults, loadResultDepartments, loadDepartmentResults,
  approveResult, rejectResult, publishResult,
  bulkApproveResults, bulkRejectResults, bulkPublishResults,
  bulkApproveCourseResults, bulkPublishCourseResults,
  loadGradeScales, openEditGradeScale, toggleGradeScale, deleteGradeScale,
  loadTranscriptLookup, loadStudentTranscript,

  // courses (department-first)
  loadCourseDepartments, loadDepartmentCourses, loadCourses,
  inferCourseYear,

  // staff
  loadStaff, loadStaffDirectory, loadStaffProfile, loadStaffWorkload,
  loadHods, loadLecturers, loadHodBoard, loadLecturerGrid,
  assignHodDept,

  // timetable
  loadTimetable, loadTimetableIndex, loadTimetableSheet,

  // exams
  loadExams, loadExamsIndex, loadExamSheet,

  // attendance
  loadAttendance, loadAttendanceDepartments, loadDepartmentAttendance,
  loadCourseAttendance, loadStudentCourseAttendance, deleteAttendance,

  // finance
  loadFees, loadFeeDepartments, loadDepartmentFees,
  loadPayments, loadPaymentDepartments, loadDepartmentPayments,
  loadStudentPayments, loadPaymentDetail,
  verifyPayment, rejectPayment,
  loadClearances, loadClearanceDepartments, loadDepartmentClearances,
  createClearance, clearClearance, rejectClearance,
  bulkClearClearances, bulkRejectClearances,

  // comms
  loadAnnouncements, deleteAnnouncement,
  loadNotifications, markNotificationRead, deleteNotification,
  loadComplaints,

  // records
  loadDocuments, loadDocumentsTable, loadDocumentDetail,
  approveDoc, rejectDoc, issueDoc,
  loadGraduations, loadGraduationsTable,
  approveGraduation, rejectGraduation, markGraduated,

  // library
  loadLibrary, loadBooksGrid, loadBookDetail,
  loadBorrows, loadBorrowsTable, returnBorrow, markBorrowLost,
  loadFinesTable, payFine, deleteFine,
  loadReservationsTable, markReservationReady, fulfillReservation, cancelReservation,

  // system
  loadReports, loadReportsWithCharts,
  loadAudit, loadAuditTable,
  loadSecurity, loadSecurityDashboard, loadSecurityEvents,
  loadSecuritySessions, revokeSession,
  loadLoginAttempts, addIpBlock,
  loadIpRules, deleteIpRule,
  loadPasswordPolicy, loadPermissionsMatrix, load2FAConfig,
  loadBackups, loadCompliance,
  loadSettings, loadSettingsShell, saveSettingsSection,
  loadAdvancedSettings, saveAdvSetting,

  // timetable helpers
  __ttTimeToMin, __ttFindConflicts,
  // Batch 1 additions
  goBack,
  wireStaffRoleTabs,
  wireSelectAll,
  initNotificationBell,
  // Batch 2 additions
  wireGradeScaleForms,
  openCopyFeesModal,
  copyFeesFromSession,
  wireFeesCopyButton,
  wireLecturerWorkloadButton,
  printAllTimetableSheets,
  wireTimetablePrintAll,
  printAllExamSheets,
  openExamPeriodsModal,
  saveExamPeriods,
  wireExamPrintAll,
  wireBatch2,
  // batch3a additions
  wireBatch3,
};