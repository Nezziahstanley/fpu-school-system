// ============================================================
// FPU — Auth middleware
// ------------------------------------------------------------
// Exports:
//   requireUser            — any authenticated user (portal or admin)
//   requireRole(...roles)  — user with one of the given roles
//   requireAdmin           — admin only (accepts admin_sessions)
//   optionalUser           — attaches req.user if token present, else continues
// ------------------------------------------------------------
// Token is read from: Authorization: Bearer <token>
// Sessions are looked up in user_sessions OR admin_sessions
// depending on which table the token exists in.
// ------------------------------------------------------------
// RULE: never trust client-supplied IDs. After requireRole(),
// always use req.user.id. NEVER read a userId from the body.
// ============================================================

'use strict';

const sessionQueries = require('../db/queries/sessions');
const userQueries = require('../db/queries/users');

// ------------------------------------------------------------
function extractToken(req) {
  const h = req.headers?.authorization || req.headers?.Authorization;
  if (!h || typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// ------------------------------------------------------------
// Look up the token in both session tables, in order:
//   1. admin_sessions
//   2. user_sessions
// Returns { user, source: 'admin' | 'user', session } or null.
// ------------------------------------------------------------
async function resolveSession(token) {
  if (!token) return null;

  const adminSess = await sessionQueries.findAdminSession(token);
  if (adminSess) {
    const user = await userQueries.findById(adminSess.userId);
    if (user && user.isActive) {
      return { user, source: 'admin', session: adminSess };
    }
  }

  const userSess = await sessionQueries.findUserSession(token);
  if (userSess) {
    const user = await userQueries.findById(userSess.userId);
    if (user && user.isActive) {
      return { user, source: 'user', session: userSess };
    }
  }

  return null;
}

// ------------------------------------------------------------
// Load req.user from token. Returns true if authenticated.
// ------------------------------------------------------------
async function attachUser(req) {
  const token = extractToken(req);
  if (!token) return false;

  const found = await resolveSession(token);
  if (!found) return false;

  req.user = found.user;
  req.session = found.session;
  req.sessionSource = found.source;
  req.authToken = token;
  return true;
}

// ============================================================
// requireUser — any authenticated user
// ============================================================
async function requireUser(req, res, next) {
  try {
    const ok = await attachUser(req);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

// ============================================================
// requireRole(...roles) — user with one of the given roles
// ============================================================
function requireRole(...roles) {
  const allowed = roles.flat().filter(Boolean);
  return async function (req, res, next) {
    try {
      const ok = await attachUser(req);
      if (!ok) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }
      if (allowed.length && !allowed.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to perform this action.',
        });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

// ============================================================
// requireAdmin — role must be 'admin'
// ============================================================
async function requireAdmin(req, res, next) {
  try {
    const ok = await attachUser(req);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required.' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

// ============================================================
// optionalUser — attaches req.user if a valid token is present,
// otherwise continues as anonymous. Never 401s.
// ============================================================
async function optionalUser(req, _res, next) {
  try {
    await attachUser(req);
  } catch {
    // swallow — treat as anonymous
  }
  return next();
}

// ============================================================
// Convenience role bundles
// ============================================================
const PRINCIPAL_ROLES = [
  'rector',
  'registrar',
  'bursar',
  'librarian',
  'exam_officer',
  'academic_officer',
  'admission_officer',
  'admin',
];

const STAFF_ROLES = [
  'lecturer',
  'hod',
  ...PRINCIPAL_ROLES,
];

module.exports = {
  requireUser,
  requireRole,
  requireAdmin,
  optionalUser,
  PRINCIPAL_ROLES,
  STAFF_ROLES,
};