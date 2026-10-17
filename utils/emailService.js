// ============================================================
// FPU — Email service (SendGrid HTTP API)
// ============================================================

'use strict';

require('dotenv').config();

const {
  EMAIL_ENABLED,
  SENDGRID_API_KEY,
  EMAIL_FROM,
  INSTITUTION_NAME,
  PUBLIC_URL,
} = process.env;

const INSTITUTION = INSTITUTION_NAME || 'Federal Polytechnic Ugep';
const DEFAULT_FROM = EMAIL_FROM || `"${INSTITUTION}" <no-reply@fedpolyugep.edu.ng>`;
const BASE_URL = PUBLIC_URL || 'https://fpu-school-systems.onrender.com';

const SEND_TIMEOUT_MS = 8000;

function hasSendGrid() { return !!SENDGRID_API_KEY; }
function isEmailEnabled() {
  if (String(EMAIL_ENABLED).toLowerCase() !== 'true') return false;
  return hasSendGrid();
}

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
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildButton(url, text) {
  return `
    <div style="text-align:center;margin:30px 0;">
      <a href="${url}" style="background:#065f46;color:#ffffff;padding:14px 24px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;display:inline-block;">
        ${text}
      </a>
    </div>
  `;
}

async function sendViaSendGrid({ to, subject, html, text }) {
  let fromEmail = DEFAULT_FROM;
  let fromName = INSTITUTION;
  const m = String(DEFAULT_FROM).match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) {
    fromName = m[1].replace(/^"|"$/g, '').trim() || INSTITUTION;
    fromEmail = m[2].trim();
  } else {
    fromEmail = String(DEFAULT_FROM).trim();
  }

  const payload = {
    personalizations: [{ to: [{ email: Array.isArray(to) ? to[0] : to }], subject: subject }],
    from: { email: fromEmail, name: fromName },
    content: [{ type: 'text/html', value: html }],
  };
  if (text) payload.content.unshift({ type: 'text/plain', value: text });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      let errorMsg = `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(bodyText);
        if (parsed.errors && parsed.errors.length > 0) errorMsg = parsed.errors.map(e => e.message).join(', ');
      } catch {}
      return { ok: false, error: errorMsg };
    }
    return { ok: true, provider: 'sendgrid' };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err.message };
  }
}

async function sendMail({ to, subject, html, text }) {
  if (!isEmailEnabled()) return { skipped: true, reason: 'disabled' };
  return sendViaSendGrid({ to, subject, html, text });
}

// ============================================================
// TEMPLATES
// ============================================================

async function sendApplicationReceived(app) {
  const name = `${app.firstName || ''} ${app.lastName || ''}`.trim();
  const body = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>Thank you for your application to <strong>${escapeHtml(INSTITUTION)}</strong>. We have successfully received your application and it is now being processed.</p>
    <p style="background:#ecfdf5;border-left:4px solid #065f46;padding:12px 14px;border-radius:4px;">
      <strong>Application Number:</strong> ${escapeHtml(app.applicationNumber)}<br/>
      <strong>Programme Level:</strong> ${escapeHtml(app.type || app.level || 'ND')}
    </p>
    <p>Warm regards,<br/><strong>Admissions Office</strong></p>
  `;
  return sendMail({ to: app.email, subject: `Application Received — ${app.applicationNumber}`, html: baseTemplate('Application Received', body) });
}

async function sendApplicationApproved(app) {
  const name = `${app.firstName || ''} ${app.lastName || ''}`.trim();
  const letterUrl = `${BASE_URL}/api/letters/${app.applicationNumber}?type=provisional`;
  const body = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>Congratulations! Your application to <strong>${escapeHtml(INSTITUTION)}</strong> has been <strong>APPROVED</strong>.</p>
    <p style="background:#ecfdf5;border-left:4px solid #065f46;padding:12px 14px;border-radius:4px;">
      <strong>Application Number:</strong> ${escapeHtml(app.applicationNumber)}<br/>
      <strong>Programme Level:</strong> ${escapeHtml(app.type || app.level || 'ND')}
    </p>
    ${buildButton(letterUrl, '📄 View & Download Admission Letter')}
    <p>Please proceed to complete your registration and payment of fees to secure your admission.</p>
    <p>Warm regards,<br/><strong>Admissions Office</strong></p>
  `;
  return sendMail({ to: app.email, subject: `Admission Letter — ${app.applicationNumber}`, html: baseTemplate('Application Approved', body) });
}

async function sendApplicationRejected(app, reason) {
  const name = `${app.firstName || ''} ${app.lastName || ''}`.trim();
  const letterUrl = `${BASE_URL}/api/letters/${app.applicationNumber}?type=rejection`;
  const body = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>After careful review, we regret to inform you that your application could not be successful at this time.</p>
    <p style="background:#fef2f2;border-left:4px solid #b91c1c;padding:12px 14px;border-radius:4px;">
      <strong>Application Number:</strong> ${escapeHtml(app.applicationNumber)}<br/>
      <strong>Reason:</strong> ${escapeHtml(reason || 'Did not meet requirements.')}
    </p>
    ${buildButton(letterUrl, '📄 View Rejection Letter')}
    <p>Warm regards,<br/><strong>Admissions Office</strong></p>
  `;
  return sendMail({ to: app.email, subject: `Application Update — ${app.applicationNumber}`, html: baseTemplate('Application Update', body) });
}

async function sendMatriculationLetter(app) {
  const name = `${app.firstName || ''} ${app.lastName || ''}`.trim();
  const letterUrl = `${BASE_URL}/api/letters/${app.applicationNumber}?type=matriculation`;
  const body = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>You have been formally matriculated as a student of <strong>${escapeHtml(INSTITUTION)}</strong>.</p>
    <p style="background:#ecfdf5;border-left:4px solid #065f46;padding:12px 14px;border-radius:4px;text-align:center;">
      <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#065f46;">Matriculation Number</div>
      <div style="font-family:'Courier New',monospace;font-size:20px;font-weight:bold;color:#065f46;margin-top:6px;">
        ${escapeHtml(app.matricNumber || '—')}
      </div>
    </p>
    ${buildButton(letterUrl, '📄 View & Download Matriculation Letter')}
    <p>Warm regards,<br/><strong>Registrar\'s Office</strong></p>
  `;
  return sendMail({ to: app.email, subject: `Matriculation Confirmed — ${app.matricNumber || ''}`, html: baseTemplate('Matriculation Confirmation', body) });
}

async function sendRejectionLetter(app) {
  const name = `${app.firstName || ''} ${app.lastName || ''}`.trim();
  const letterUrl = `${BASE_URL}/api/letters/${app.applicationNumber}?type=rejection`;
  const body = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>We refer to your application for admission into ${escapeHtml(app.programmeName || 'the programme')}.</p>
    <p>After careful review, we regret to inform you that your application was not successful.</p>
    ${buildButton(letterUrl, '📄 View Rejection Letter')}
    <p>Warm regards,<br/><strong>Admissions Office</strong></p>
  `;
  return sendMail({ to: app.email, subject: `Application Outcome — ${app.applicationNumber}`, html: baseTemplate('Application Outcome', body) });
}

async function sendRegistrationComplete(user) {
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const body = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>Welcome to <strong>${escapeHtml(INSTITUTION)}</strong>! Your registration is complete.</p>
    <p style="background:#ecfdf5;border-left:4px solid #065f46;padding:12px 14px;border-radius:4px;">
      <strong>Matric Number:</strong> ${escapeHtml(user.matricNumber || '—')}<br/>
      <strong>Email:</strong> ${escapeHtml(user.email)}
    </p>
    <p>Warm regards,<br/><strong>Registrar\'s Office</strong></p>
  `;
  return sendMail({ to: user.email, subject: `Welcome to ${INSTITUTION} — Registration Complete`, html: baseTemplate('Registration Complete', body) });
}

module.exports = {
  baseTemplate, isEmailEnabled, sendMail,
  sendApplicationReceived, sendApplicationApproved, sendApplicationRejected,
  sendRegistrationComplete, sendMatriculationLetter, sendRejectionLetter,
};