// ============================================================
// FPU — Password utilities (bcryptjs)
// ------------------------------------------------------------
// No Mongoose pre-save hooks exist in SQL. Routes must call
// hashPassword() before persisting a user, and comparePassword()
// during login.
// ============================================================

'use strict';

require('dotenv').config();

const bcrypt = require('bcryptjs');

const ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;

// ------------------------------------------------------------
// Hash a plaintext password.
// ------------------------------------------------------------
async function hashPassword(plain) {
  if (typeof plain !== 'string' || !plain) {
    throw new Error('hashPassword: password must be a non-empty string');
  }
  const salt = await bcrypt.genSalt(ROUNDS);
  return bcrypt.hash(plain, salt);
}

// Alias — some callers prefer the shorter name.
const hash = hashPassword;

// ------------------------------------------------------------
// Compare plaintext against a stored hash.
// ------------------------------------------------------------
async function comparePassword(plain, storedHash) {
  if (typeof plain !== 'string' || !storedHash) return false;
  try {
    return await bcrypt.compare(plain, storedHash);
  } catch {
    return false;
  }
}

// Alias
const compare = comparePassword;

// ------------------------------------------------------------
// Validate password strength.
// Rules: 6+ chars. Must contain at least one letter and one digit.
// Returns { valid, reasons[] } so callers can show the user why.
// ------------------------------------------------------------
function validatePassword(plain) {
  const reasons = [];
  if (typeof plain !== 'string' || plain.length < 6) {
    reasons.push('Password must be at least 6 characters long.');
  }
  if (plain && !/[A-Za-z]/.test(plain)) {
    reasons.push('Password must contain at least one letter.');
  }
  if (plain && !/[0-9]/.test(plain)) {
    reasons.push('Password must contain at least one number.');
  }
  return { valid: reasons.length === 0, reasons };
}

// ------------------------------------------------------------
// Convenience: hash + validate + throw on invalid
// ------------------------------------------------------------
async function hashOrThrow(plain) {
  const check = validatePassword(plain);
  if (!check.valid) {
    const err = new Error(check.reasons.join(' '));
    err.status = 400;
    err.code = 'WEAK_PASSWORD';
    throw err;
  }
  return hashPassword(plain);
}

module.exports = {
  hashPassword,
  hash,
  comparePassword,
  compare,
  validatePassword,
  hashOrThrow,
  ROUNDS,
};