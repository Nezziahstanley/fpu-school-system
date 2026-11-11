'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'production';
const { errorHandler, notFound } = require('../middleware/errorHandler');

function responseMock() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test('production unique-constraint errors do not expose database detail', () => {
  const res = responseMock();
  errorHandler(
    { code: '23505', detail: 'Key (email)=(private@example.com) already exists' },
    { method: 'POST', path: '/api/users' },
    res,
    () => {}
  );
  assert.equal(res.statusCode, 409);
  assert.equal(res.payload.error, 'A record with those values already exists.');
  assert.equal(JSON.stringify(res.payload).includes('private@example.com'), false);
});

test('production unexpected errors do not expose internal messages, codes or stacks', () => {
  const res = responseMock();
  errorHandler(
    Object.assign(new Error('secret database hostname'), { code: 'ECONNREFUSED' }),
    { method: 'GET', path: '/api/private' },
    res,
    () => {}
  );
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.payload, { success: false, error: 'Request could not be processed.' });
});

test('invalid error status values are normalised to 500', () => {
  const res = responseMock();
  errorHandler(
    Object.assign(new Error('bad status'), { status: 700 }),
    { method: 'GET', path: '/api/test' },
    res,
    () => {}
  );
  assert.equal(res.statusCode, 500);
});

test('API 404 response does not reflect query-string secrets', () => {
  const res = responseMock();
  notFound(
    { path: '/api/missing', method: 'GET', originalUrl: '/api/missing?token=secret-value' },
    res,
    () => {}
  );
  assert.equal(res.statusCode, 404);
  assert.equal(res.payload.error, 'Route not found: GET /api/missing');
  assert.equal(JSON.stringify(res.payload).includes('secret-value'), false);
});
