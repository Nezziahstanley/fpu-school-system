// ============================================================
// FPU — Centralized error handler
// ============================================================

'use strict';

const path = require('path');

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

function notFound(req, res, _next) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      // Do not reflect query strings: they can contain tokens or personal data.
      error: `Route not found: ${req.method} ${req.path}`,
    });
  }
  return res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
}

function translatePgError(err) {
  switch (err.code) {
    case '23505':
      return { status: 409, message: 'A record with those values already exists.' };
    case '23503':
      return { status: 400, message: 'Referenced record does not exist.' };
    case '23502':
      return { status: 400, message: 'A required field is missing.' };
    case '23514':
      return { status: 400, message: 'A constraint was violated.' };
    case '22P02':
      return { status: 400, message: 'Invalid input format.' };
    case '22001':
      return { status: 400, message: 'One of the provided values is too long.' };
    case '40001':
      return { status: 409, message: 'Concurrent update conflict. Please retry.' };
    case '57014':
      return { status: 504, message: 'Database query timed out.' };
    default:
      return null;
  }
}

// Express error handler: (err, req, res, next).
function errorHandler(err, req, res, next) {
  const translated = translatePgError(err);
  const candidateStatus = translated ? translated.status : Number(err.status || err.statusCode || 500);
  const status = Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus <= 599
    ? candidateStatus
    : 500;

  const message = translated
    ? translated.message
    : (isProduction ? 'Request could not be processed.' : (err.message || 'An unexpected error occurred.'));

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.path}`, err);
  } else if (!isProduction) {
    console.warn(`[warn] ${status} ${req.method} ${req.path}: ${message}`);
  }

  if (res.headersSent) return next(err);

  const payload = { success: false, error: message };
  // Internal error codes and stack traces are useful locally, never in production.
  if (!isProduction && err.code) payload.code = err.code;
  if (!isProduction && err.stack) payload.stack = err.stack.split('\n').slice(0, 8).join('\n');

  return res.status(status).json(payload);
}

module.exports = errorHandler;
module.exports.notFound = notFound;
module.exports.errorHandler = errorHandler;
module.exports.translatePgError = translatePgError;
