// ============================================================
// FPU — Centralized error handler
// ------------------------------------------------------------
// Mounted LAST in server.js:
//   app.use(require('./middleware/errorHandler'))
//
// Never leaks stack traces in production. Returns JSON always.
// Translates common PostgreSQL errors to proper HTTP statuses.
// ============================================================

'use strict';

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

// ------------------------------------------------------------
// 404 handler — mounted just before the error handler.
// ------------------------------------------------------------
function notFound(req, res, _next) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: `Route not found: ${req.method} ${req.originalUrl}`,
    });
  }
  return res.status(404).sendFile(require('path').join(__dirname, '..', 'public', '404.html'));
}

// ------------------------------------------------------------
// PostgreSQL error code → HTTP status mapping
// ------------------------------------------------------------
function translatePgError(err) {
  switch (err.code) {
    case '23505': // unique_violation
      return {
        status: 409,
        message: err.detail
          ? `A record with those values already exists (${err.detail}).`
          : 'A record with those values already exists.',
      };
    case '23503': // foreign_key_violation
      return {
        status: 400,
        message: 'Referenced record does not exist.',
      };
    case '23502': // not_null_violation
      return {
        status: 400,
        message: `A required field is missing${err.column ? ' (' + err.column + ')' : ''}.`,
      };
    case '23514': // check_violation
      return {
        status: 400,
        message: 'A constraint was violated.',
      };
    case '22P02': // invalid_text_representation
      return {
        status: 400,
        message: 'Invalid input format.',
      };
    case '22001': // string_data_right_truncation
      return {
        status: 400,
        message: 'One of the provided values is too long.',
      };
    case '40001': // serialization_failure
      return {
        status: 409,
        message: 'Concurrent update conflict. Please retry.',
      };
    case '57014': // query_canceled (statement timeout)
      return {
        status: 504,
        message: 'Database query timed out.',
      };
    default:
      return null;
  }
}

// ------------------------------------------------------------
// Error handler — takes (err, req, res, next).
// ------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  // First, try to translate PG errors into a clean HTTP status
  const translated = translatePgError(err);

  const status = translated
    ? translated.status
    : Number(err.status || err.statusCode || 500);

  const baseMessage = translated
    ? translated.message
    : (err.message || 'An unexpected error occurred.');

  const code = err.code || null;

  // Log server errors; quiet on 4xx
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  } else if (!isProduction) {
    // eslint-disable-next-line no-console
    console.warn(`[warn] ${status} ${req.method} ${req.originalUrl}: ${baseMessage}`);
  }

  const payload = {
    success: false,
    error: status >= 500 && isProduction
      ? 'Internal server error.'
      : baseMessage,
  };
  if (code && !translated) payload.code = code;

  if (!isProduction && err.stack) {
    payload.stack = err.stack.split('\n').slice(0, 8).join('\n');
  }

  if (res.headersSent) {
    return _next(err);
  }

  return res.status(status).json(payload);
}

module.exports = errorHandler;
module.exports.notFound = notFound;
module.exports.errorHandler = errorHandler;