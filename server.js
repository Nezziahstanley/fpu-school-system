// ============================================================
// FPU School Management System — Express 5 entry point
// ------------------------------------------------------------
// Boot order:
//   1. dotenv
//   2. security (helmet + CSP) & CORS
//   3. rate limits
//   4. body parsers
//   5. IP guard (custom IP rules from settings)
//   6. static /public
//   7. /api routes
//   8. notFound + errorHandler
//   9. app.listen + graceful shutdown
// ============================================================

'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');

// ---------------- App-wide setup ----------------
const app = express();

// Behind Render/Neon, trust the first proxy hop so req.ip is accurate
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ------------------------------------------------------------
// Helmet + CSP
// ------------------------------------------------------------
// CSP allows 'unsafe-inline' for styles & scripts (needed for
// onsumbit= attributes and inline event handlers used throughout
// the vanilla-JS UI), and CDN for Chart.js.
// ------------------------------------------------------------
let helmet;
try {
  helmet = require('helmet');
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          'script-src-attr': ["'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'connect-src': ["'self'", 'https:'],
          'frame-ancestors': ["'self'"],
          'form-action': ["'self'"],
          'base-uri': ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
} catch {
  // helmet not installed — continue without it
}

// ------------------------------------------------------------
// CORS
// ------------------------------------------------------------
try {
  const cors = require('cors');
  const origins = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true); // server-to-server or same-origin
        if (origins.length === 0) return cb(null, true);
        if (origins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    })
  );
} catch {
  // cors not installed — continue without it
}

// ------------------------------------------------------------
// Rate limits (mounted before body parsers so they see req.ip)
// ------------------------------------------------------------
const { loginLimiter, adminLimiter, publicLimiter } = require('./middleware/rateLimits');

app.use(['/api/admin/auth/login', '/api/login'], loginLimiter);
app.use('/api/admin', adminLimiter);
app.use(
  [
    '/api/apply',
    '/api/apply-hnd',
    '/api/apply-status',
    '/api/contact',
    '/api/register-token',
    '/api/public/id-lookup',
  ],
  publicLimiter
);

// ------------------------------------------------------------
// Body parsers
// ------------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ------------------------------------------------------------
// IP guard — enforces security_ip_rules from settings
// Fails open: if the settings lookup errors, requests pass.
// ------------------------------------------------------------
try {
  const ipGuard = require('./middleware/ipGuard');
  app.use(ipGuard);
} catch {
  // ipGuard not installed yet — continue without it
}

// ------------------------------------------------------------
// Static files (public site, admin, portal, uploads)
// ------------------------------------------------------------
app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: false,
    maxAge: 0,
    extensions: ['html'],
  })
);

// Uploads directory (if not under public/)
const uploadDir = process.env.UPLOAD_DIR || 'public/uploads';
app.use(
  `/${uploadDir.replace(/^public\//, '')}`,
  express.static(path.join(__dirname, uploadDir), { maxAge: '1d' })
);

// ------------------------------------------------------------
// API
// ------------------------------------------------------------
app.use('/api', require('./routes'));

// ------------------------------------------------------------
// 404 + centralized error handler
// ------------------------------------------------------------
const { notFound, errorHandler } = require('./middleware/errorHandler');
app.use(notFound);
app.use(errorHandler);

// ------------------------------------------------------------
// Listen + graceful shutdown
// ------------------------------------------------------------
const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `\n  ✅ FPU School Management System running on http://localhost:${PORT}` +
    `\n  🌍 Environment: ${process.env.NODE_ENV || 'development'}` +
    `\n  📅 ${new Date().toISOString()}\n`
  );
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  // eslint-disable-next-line no-console
  console.log(`\n[server] ${signal} received — shutting down…`);

  const forceExit = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error('[server] forced shutdown after 10s');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    try {
      const { close } = require('./db');
      await close();
    } catch {
      // db already closed or unreachable
    }
    // eslint-disable-next-line no-console
    console.log('[server] closed cleanly.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[server] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[server] uncaughtException:', err);
});

module.exports = app;