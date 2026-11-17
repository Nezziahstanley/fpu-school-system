'use strict';

const { eq, and } = require('drizzle-orm');
const { db, schema } = require('../db');
const { users } = schema;

/**
 * Resolve a single active institutional signatory with a saved signature.
 * Never choose an arbitrary account when a role has duplicate active users.
 */
async function getUniqueSignedSignatory(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  const allowedRoles = ['admission_officer', 'bursar', 'registrar', 'rector'];
  if (!allowedRoles.includes(normalizedRole)) {
    return { ok: false, status: 400, error: 'Unsupported signatory role.' };
  }

  const matches = await db.select({
    id: users.id,
    firstName: users.firstName,
    lastName: users.lastName,
    signatureUrl: users.signatureUrl,
  }).from(users)
    .where(and(eq(users.role, normalizedRole), eq(users.isActive, true)))
    .limit(2);

  if (matches.length > 1) {
    return { ok: false, status: 409, error: `More than one active ${normalizedRole.replace(/_/g, ' ')} account exists. Confirm the designated signatory.` };
  }
  if (!matches.length) {
    return { ok: false, status: 409, error: `No active ${normalizedRole.replace(/_/g, ' ')} account is configured.` };
  }

  const signer = matches[0];
  if (!signer.signatureUrl) {
    return { ok: false, status: 409, error: `The designated ${normalizedRole.replace(/_/g, ' ')} must save an electronic signature before this letter can be issued.` };
  }

  return {
    ok: true,
    data: {
      id: signer.id,
      fullName: [signer.firstName, signer.lastName].filter(Boolean).join(' ').trim(),
      signatureUrl: signer.signatureUrl,
      role: normalizedRole,
    },
  };
}

module.exports = { getUniqueSignedSignatory };
