// ============================================================
// FPU — Email service (Nodemailer)
// ------------------------------------------------------------
// Public API:
//   baseTemplate(title, body)         -> HTML string
//   sendApplicationReceived(app)      -> Promise
//   sendApplicationApproved(app)      -> Promise
//   sendApplicationRejected(app, reason)
//   sendRegistrationComplete(user)    -> Promise
//   isEmailEnabled()                  -> boolean
//   sendMail({ to, subject, html })   -> Promise
// If EMAIL_ENABLED=false, every send* is a silent no-op.
// ============================================================

'use strict';

require('dotenv').config();

const nodemailer = require('nodemailer');

const {
  EMAIL_ENABLED,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
  INSTITUTION_NAME,
} = process.env;

const INSTITUTION = INSTITUTION_NAME || 'Federal Polytechnic Ugep';
const FROM = EMAIL_FROM || `"${INSTITUTION}" <no-reply@fedpolyugep.edu.ng>`;

let transporter = null;
let transporterInitAttempted = false;

// ------------------------------------------------------------
function isEmailEnabled() {
  return String(EMAIL_ENABLED).toLowerCase() === 'true';
}

// ------------------------------------------------------------
function getTransporter() {
  if (transporterInitAttempted) return transporter;
  transporterInitAttempted = true;

  if (!isEmailEnabled()) {
    transporter = null;
    return null;
  }

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // eslint-disable-next-line no-console
    console.warn('[email] EMAIL_ENABLED=true but SMTP credentials are incomplete. Emails will be skipped.');
    transporter = null;
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: String(SMTP_SECURE).toLowerCase() === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

// ------------------------------------------------------------
// Base HTML template (used by every email)
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
          <!-- Header -->
          <tr>
            <td style="background:#065f46;padding:22px 28px;color:#ffffff;">
              <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:.85;">${escapeHtml(INSTITUTION)}</div>
              <div style="font-size:22px;font-weight:bold;margin-top:4px;">${escapeHtml(title)}</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:26px 28px;font-size:15px;line-height:1.6;color:#1f2937;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
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

// ------------------------------------------------------------
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
// Low-level send
// ------------------------------------------------------------
async function sendMail({ to, subject, html, text }) {
  if (!isEmailEnabled()) return { skipped: true };
  const t = getTransporter();
  if (!t) return { skipped: true };

  try {
    const info = await t.sendMail({
      from: FROM,
      to,
      subject,
      html,
      text: text || undefined,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] send failed:', err.message);
    return { ok: false, error: err.message };
  }
}

// ============================================================
// TEMPLATE 1 — Application received
// ============================================================
async function sendApplicationReceived(app) {
  if (!isEmailEnabled()) return { skipped: true };
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
// TEMPLATE 2 — Application approved
// ============================================================
async function sendApplicationApproved(app) {
  if (!isEmailEnabled()) return { skipped: true };
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
  if (!isEmailEnabled()) return { skipped: true };
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
  if (!isEmailEnabled()) return { skipped: true };
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

module.exports = {
  baseTemplate,
  isEmailEnabled,
  sendMail,
  sendApplicationReceived,
  sendApplicationApproved,
  sendApplicationRejected,
  sendRegistrationComplete,
};