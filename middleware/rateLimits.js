// ============================================================
// FPU — Rate limiters (express-rate-limit)
// ------------------------------------------------------------
// Three limiters as specified in the master prompt:
//   loginLimiter   20 requests / 15 min
//   adminLimiter   300 requests / 1 min
//   publicLimiter  60 requests / 1 min
// Values can be overridden via .env (LOGIN_MAX, ADMIN_MAX, ...).
// ============================================================

'use strict';

require('dotenv').config();

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// ------------------------------------------------------------
function readInt(envKey, fallback) {
  const n = Number(process.env[envKey]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ------------------------------------------------------------
// Common options
// ------------------------------------------------------------
const common = {
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please slow down and try again shortly.',
    });
  },
};

// ------------------------------------------------------------
// LOGIN — 20 / 15 min (keyed by IP + attempted email)
// ------------------------------------------------------------
const loginLimiter = rateLimit({
  ...common,
  windowMs: readInt('LOGIN_WINDOW_MIN', 15) * 60 * 1000,
  max: readInt('LOGIN_MAX', 20),
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req);       // <-- proper IPv6-aware IP
    const email = (req.body?.email || '').toString().toLowerCase().trim();
    return email ? `${ip}|${email}` : ip;
  },
});

// ------------------------------------------------------------
// ADMIN — 300 / 1 min
// ------------------------------------------------------------
const adminLimiter = rateLimit({
  ...common,
  windowMs: readInt('ADMIN_WINDOW_MIN', 1) * 60 * 1000,
  max: readInt('ADMIN_MAX', 300),
});

// ------------------------------------------------------------
// PUBLIC — 60 / 1 min
// ------------------------------------------------------------
const publicLimiter = rateLimit({
  ...common,
  windowMs: readInt('PUBLIC_WINDOW_MIN', 1) * 60 * 1000,
  max: readInt('PUBLIC_MAX', 60),
});

module.exports = {
  loginLimiter,
  adminLimiter,
  publicLimiter,
};