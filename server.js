// ============================================================
// FPU School Management System — Express 5 entry point
// ============================================================

'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ------------------------------------------------------------
// Helmet + CSP
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
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
} catch {}

// ------------------------------------------------------------
// CORS
// ------------------------------------------------------------
try {
  const cors = require('cors');
  // Same-origin hosting needs no CORS headers. Cross-origin clients must be
  // explicitly listed in CORS_ORIGINS (comma-separated) before credentials
  // are allowed; never reflect arbitrary Origin headers.
  const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
        return callback(null, true);
      }
      return callback(null, false);
    },
  }));
} catch {}

// ------------------------------------------------------------
// Rate limits
// ------------------------------------------------------------
try {
  const { loginLimiter, adminLimiter, publicLimiter } = require('./middleware/rateLimits');
  app.use(['/api/admin/auth/login', '/api/login'], loginLimiter);
  app.use('/api/admin', adminLimiter);
  app.use('/api/public/verify', publicLimiter);
} catch {}

// ------------------------------------------------------------
// Body parsers
// ------------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ------------------------------------------------------------
// Public Verification Route (Fail-Safe)
// ------------------------------------------------------------
// ------------------------------------------------------------
// Public Verification Route (No Auth Required)
// ------------------------------------------------------------
app.get('/api/public/verify', async (req, res) => {
  try {
    const matric = req.query.id;
    if (!matric) return res.status(400).json({ success: false, error: 'Missing ID' });

    // CORRECT FIX: Destructure 'pool' from your exported db module
    const { pool } = require('./db');

    const result = await pool.query(`
      SELECT 
        u.id, 
        u.first_name AS "firstName", 
        u.last_name AS "lastName", 
        COALESCE(u.id_card_photo_url, u.photo_url) AS "photoUrl",
        u.matric_number AS "matricNumber", 
        u.level,
        p.name AS "programmeName",
        d.name AS "departmentName",
        COALESCE(
          student_session.name,
          (SELECT current_session.name FROM academic_sessions current_session
           WHERE current_session.is_current = true LIMIT 1)
        ) AS "sessionName"
      FROM users u
      LEFT JOIN programmes p ON u.programme_id = p.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN academic_sessions student_session ON student_session.id = u.current_session_id
      WHERE UPPER(u.matric_number) = UPPER($1)
      LIMIT 1
    `, [matric]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    const studentData = result.rows[0];
    res.json({ success: true, data: studentData });
  } catch (err) {
    console.error('Verify error:', err?.message || 'Unknown verification error');
    res.status(500).json({
      success: false,
      error: 'Unable to verify this record right now. Please try again later.',
    });
  }
});

// ------------------------------------------------------------
// Static files
// ------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0, extensions: ['html'] }));

const uploadDir = process.env.UPLOAD_DIR || 'public/uploads';
app.use(`/${uploadDir.replace(/^public\//, '')}`, express.static(path.join(__dirname, uploadDir), { maxAge: '1d' }));

// ------------------------------------------------------------
// API
// ------------------------------------------------------------
app.use('/api', require('./routes'));

// ------------------------------------------------------------
// 404 + error handler
// ------------------------------------------------------------
const { notFound, errorHandler } = require('./middleware/errorHandler');
app.use(notFound);
app.use(errorHandler);

// ------------------------------------------------------------
// Listen
// ------------------------------------------------------------
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`\n  ✅ FPU running on http://localhost:${PORT}\n`);
});

module.exports = app;