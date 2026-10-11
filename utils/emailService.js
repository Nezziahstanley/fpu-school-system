// ============================================================
// FPU — Email service
// ------------------------------------------------------------
// Two transports, tried in this order:
//   1. Resend HTTP API   (RESEND_API_KEY)   ← works on Render free tier
//   2. Nodemailer SMTP   (SMTP_HOST + creds)
//
// If neither is available, every send* becomes an instant
// no-op with { skipped: true }. No hanging.
//
// Public API:
//   baseTemplate(title, body)
//   sendMail({ to, subject, html, text })
//   sendApplicationReceived(app)
//   sendApplicationApproved(app)
//   sendApplicationRejected(app, reason)
//   sendRegistrationComplete(user)
//   sendMatriculationLetter(app)
//   sendRejectionLetter(app)
//   isEmailEnabled()
// ============================================================

'use strict';

require('dotenv').config();

const nodemailer = require('nodemailer');

const {
  EMAIL_ENABLED,
  RESEND_API_KEY,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
  INSTITUTION_NAME,
} = process.env;

const INSTITUTION = INSTITUTION_NAME || 'Federal Polytechnic Ugep';
const DEFAULT_FROM = EMAIL_FROM || `"${INSTITUTION}" <onboarding@resend.dev>`;

const SEND_TIMEOUT_MS = Number(process.env.SMTP_TIMEOUT_MS) || 8000;

// ------------------------------------------------------------
// Config detection
// ------------------------------------------------------------
function hasResend() {
  return !!RESEND_API_KEY;
}

function hasSMTP() {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

function isEmailEnabled() {
  if (String(EMAIL_ENABLED).toLowerCase() !== 'true') return false;
  return hasResend() || hasSMTP();
}

// ------------------------------------------------------------
// Transport selector
// ------------------------------------------------------------
let smtpTransport = null;
let smtpInit = false;

function getSMTPTransport() {
  if (smtpInit) return smtpTransport;
  smtpInit = true;

  if (!hasSMTP()) {
    smtpTransport = null;
    return null;
  }

  try {
    smtpTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: String(SMTP_SECURE).toLowerCase() === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: SEND_TIMEOUT_MS,
      greetingTimeout: SEND_TIMEOUT_MS,
      socketTimeout: SEND_TIMEOUT_MS,
      pool: false,
    });
  } catch (err) {
    console.error('[email] SMTP transport init failed:', err.message);
    smtpTransport = null;
  }
  return smtpTransport;
}

// ------------------------------------------------------------
// Base HTML template
// ------------------------------------------------------------
function baseTemplate(title, body) {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#065f46;padding:22px 28px;color:#ffffff;">
              <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:.85;">${escapeHtml(INSTITUTION)}</div>
              <div style="font-size:22px;font-weight:bold;margin-top:4px;">${escapeHtml(title)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px;font-size:15px;line-height:1.6;color:#1f2937;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#f9fafb;color:#6b7280;font-size:12px;text-align:center;border-top:1px solid #e5e7eb;">
              &copy; ${year} ${escapeHtml(INSTITUTION)} &mdash; Citadel of Technical Excellence<br/>
              This is an automated message. Please do not reply directly to this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ------------------------------------------------------------
// Parse "Name <email@domain>" into { name, email }
// ------------------------------------------------------------
function parseFrom(from) {
  const m = String(from).match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1].replace(/^"|"$/g, '').trim() || INSTITUTION, email: m[2].trim() };
  return { name: INSTITUTION, email: String(from).trim() };
}

// ------------------------------------------------------------
// Resend HTTP API transport
// ------------------------------------------------------------
async function sendViaResend({ to, subject, html, text }) {
  const from = parseFrom(DEFAULT_FROM);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${from.name} <${from.email}>`,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text: text || undefined,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      let parsed = null;
      try { parsed = JSON.parse(bodyText); } catch { /* not JSON */ }
      const msg = parsed?.message || parsed?.error || bodyText || `HTTP ${res.status}`;
      console.error('[email] Resend API error:', res.status, msg);
      return { ok: false, error: msg };
    }

    const json = await res.json().catch(() => ({}));
    return { ok: true, messageId: json.id || null, provider: 'resend' };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { ok: false, error: `Resend request timed out after ${SEND_TIMEOUT_MS}ms` };
    }
    console.error('[email] Resend fetch failed:', err.message);
    return { ok: false, error: err.message };
  }
}

// ------------------------------------------------------------
// SMTP transport (fallback)
// ------------------------------------------------------------
async function sendViaSMTP({ to, subject, html, text }) {
  const t = getSMTPTransport();
  if (!t) return { skipped: true, reason: 'no-smtp' };

  try {
    const info = await t.sendMail({
      from: DEFAULT_FROM,
      to,
      subject,
      html,
      text: text || undefined,
    });
    return { ok: true, messageId: info.messageId, provider: 'smtp' };
  } catch (err) {
    console.error('[email] SMTP send failed:', err.message);
    return { ok: false, error: err.message };
  }
}

// ------------------------------------------------------------
// Public sendMail — picks transport
// ------------------------------------------------------------
async function sendMail({ to, subject, html, text }) {
  if (!isEmailEnabled()) return { skipped: true, reason: 'disabled' };

  if (hasResend()) {
    return sendViaResend({ to, subject, html, text });
  }
  if (hasSMTP()) {
    return sendViaSMTP({ to, subject, html, text });
  }
  return { skipped: true, reason: 'no-transport' };
}

// ============================================================
// TEMPLATE 1 — Application received
// ============================================================
async function sendApplicationReceived(app) {
  const name = `${app.firstName || ''} ${app.lastName || ''}`.trim();
  const body = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>Thank you for your application to <strong>${escapeHtml(INSTITUTION)}</strong>. We have successfully received your application and it is now being processed.</p>
    <p style="background:#ecfdf5;border-left:4px solid #065f46;padding:12px 14px;border-radius:4px;">
      <strong>Application Number:</strong> ${escapeHtml(app.applicationNumber)}<br/>
      <strong>Programme Level:</strong> ${escapeHtml(app.type || app.level || 'ND')}<br/>
      <strong>Status:</strong> Pending Review
    </p>
    <p>You can check the status of your application at any time using your application number and the email address you supplied.</p>
    <p>If you did not submit this application, please contact us immediately.</p>
    <p>Warm regards,<br/><strong>Admissions Office</strong><br/>${escapeHtml(INSTITUTION)}</p>
  `;
  return sendMail({
    to: app.email,
    subject: `Application Received — ${app.applicationNumber}`,
    html: baseTemplate('Application Received', body),
  });
}

// ============================================================
// TEMPLATE 2 — Application approved (Provisional admission)
// ============================================================
async function sendApplicationApproved(app) {
  const name = `${app.firstName || ''} ${app.lastName || ''}`.trim();
  const body = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>Congratulations! We are pleased to inform you that your application to <strong>${escapeHtml(INSTITUTION)}</strong> has been <strong style="color:#065f46;">APPROVED</strong>.</p>
    <p style="background:#ecfdf5;border-left:4px solid #065f46;padding:12px 14px;border-radius:4px;">
      <strong>Application Number:</strong> ${escapeHtml(app.applicationNumber)}<br/>
      <strong>Programme Level:</strong> ${escapeHtml(app.type || app.level || 'ND')}<br/>
      <strong>Status:</strong> Approved
    </p>
    <p>Please proceed to complete your registration and payment of fees to secure your admission.</p>
    <p>Warm regards,<br/><strong>Admissions Office</strong><br/>${escapeHtml(INSTITUTION)}</p>
  `;
  return sendMail({
    to: app.email,
    subject: `Congratulations — Your application has been approved (${app.applicationNumber})`,
    html: baseTemplate('Application Approved', body),
  });
}

// ============================================================
// TEMPLATE 3 — Application rejected
// ============================================================
async function sendApplicationRejected(app, reason) {
  const name = `${app.firstName || ''} ${app.lastName || ''}`.trim();
  const body = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>Thank you for your interest in <strong>${escapeHtml(INSTITUTION)}</strong>. After careful review, we regret to inform you that your application could not be successful at this time.</p>
    <p style="background:#fef2f2;border-left:4px solid #b91c1c;padding:12px 14px;border-radius:4px;">
      <strong>Application Number:</strong> ${escapeHtml(app.applicationNumber)}<br/>
      <strong>Reason:</strong> ${escapeHtml(reason || 'Application did not meet current requirements.')}
    </p>
    <p>You are welcome to reapply in a future admission cycle should you meet the requirements.</p>
    <p>Warm regards,<br/><strong>Admissions Office</strong><br/>${escapeHtml(INSTITUTION)}</p>
  `;
  return sendMail({
    to: app.email,
    subject: `Application Update — ${app.applicationNumber}`,
    html: baseTemplate('Application Update', body),
  });
}

// ============================================================
// TEMPLATE 4 — Registration complete
// ============================================================
async function sendRegistrationComplete(user) {
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const body = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>Welcome to <strong>${escapeHtml(INSTITUTION)}</strong>! Your admission and registration have been completed successfully.</p>
    <p style="background:#ecfdf5;border-left:4px solid #065f46;padding:12px 14px;border-radius:4px;">
      <strong>Matric Number:</strong> ${escapeHtml(user.matricNumber || '—')}<br/>
      <strong>Email:</strong> ${escapeHtml(user.email)}<br/>
      <strong>Level:</strong> ${escapeHtml(user.level || 'ND')}
    </p>
    <p>Please log in to the student portal to view your dashboard, register courses, and access your results.</p>
    <p>Warm regards,<br/><strong>Registrar's Office</strong><br/>${escapeHtml(INSTITUTION)}</p>
  `;
  return sendMail({
    to: user.email,
    subject: `Welcome to ${INSTITUTION} — Registration Complete`,
    html: baseTemplate('Registration Complete', body),
  });
}

// ============================================================
// TEMPLATE 5 — Matriculation letter (BULK)
// ============================================================
async function sendMatriculationLetter(app) {
  const name = `${app.firstName || ''} ${app.lastName || ''}`.trim();
  const body = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>We are pleased to confirm that you have been formally matriculated as a student of <strong>${escapeHtml(INSTITUTION)}</strong>.</p>
    <p style="background:#ecfdf5;border-left:4px solid #065f46;padding:12px 14px;border-radius:4px;text-align:center;">
      <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#065f46;">Matriculation Number</div>
      <div style="font-family:'Courier New',monospace;font-size:20px;font-weight:bold;color:#065f46;margin-top:6px;">
        ${escapeHtml(app.matricNumber || '—')}
      </div>
    </p>
    <p><strong>Programme:</strong> ${escapeHtml(app.programmeName || '—')}<br/>
       <strong>Department:</strong> ${escapeHtml(app.departmentName || '—')}<br/>
       <strong>Level:</strong> ${escapeHtml(app.level || '—')}</p>
    <p>You may now log in to the student portal with your matric number to register your courses and access your results.</p>
    <p>Warm regards,<br/><strong>Registrar's Office</strong><br/>${escapeHtml(INSTITUTION)}</p>
  `;
  return sendMail({
    to: app.email,
    subject: `Matriculation Confirmed — ${app.matricNumber || ''}`,
    html: baseTemplate('Matriculation Confirmation', body),
  });
}

// ============================================================
// TEMPLATE 6 — Rejection letter (formal)
// ============================================================
async function sendRejectionLetter(app) {
  const name = `${app.firstName || ''} ${app.lastName || ''}`.trim();
  const reason = app.rejectionReason || 'Application did not meet current requirements.';
  const body = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>We refer to your application (<strong>${escapeHtml(app.applicationNumber)}</strong>) for admission into ${escapeHtml(app.programmeName || 'the programme')} at ${escapeHtml(INSTITUTION)}.</p>
    <p>After careful review, we regret to inform you that your application <strong>was not successful</strong> in this admission cycle.</p>
    <p style="background:#fef2f2;border-left:4px solid #b91c1c;padding:12px 14px;border-radius:4px;">
      <strong>Reason:</strong> ${escapeHtml(reason)}
    </p>
    <p>This decision does not preclude you from applying again in future admission cycles.</p>
    <p>Warm regards,<br/><strong>Admissions Office</strong><br/>${escapeHtml(INSTITUTION)}</p>
  `;
  return sendMail({
    to: app.email,
    subject: `Application Outcome — ${app.applicationNumber}`,
    html: baseTemplate('Application Outcome', body),
  });
}

// ============================================================
// Diagnostic — useful to run in Render shell:
//   node -e "console.log(require('./utils/emailService').describe())"
// ============================================================
function describe() {
  return {
    emailEnabled: isEmailEnabled(),
    resendConfigured: hasResend(),
    smtpConfigured: hasSMTP(),
    from: DEFAULT_FROM,
    timeoutMs: SEND_TIMEOUT_MS,
  };
}

module.exports = {
  baseTemplate,
  isEmailEnabled,
  sendMail,
  sendApplicationReceived,
  sendApplicationApproved,
  sendApplicationRejected,
  sendRegistrationComplete,
  sendMatriculationLetter,
  sendRejectionLetter,
  describe,
};