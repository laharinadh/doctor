const test = require('node:test');
const assert = require('node:assert/strict');
const authenticate = require('../../middleware/auth');
const config = require('../../config');
const { UnauthorizedError, ForbiddenError } = require('../../utils/errors');
const db = require('../../config/database');

test.describe('White Box Tests: Authentication Middleware Branches', () => {
  const origAuthMode = config.auth.mode;

  test.after(async () => {
    config.auth.mode = origAuthMode;
    await db.end();
  });

  test('Branch: Missing Authorization header in non-test mode yields 401', async () => {
    config.auth.mode = 'firebase';
    const req = { headers: {} };
    const res = {};
    let errResult = null;

    await authenticate(req, res, (err) => {
      errResult = err;
    });

    assert.ok(errResult instanceof UnauthorizedError);
    assert.equal(errResult.statusCode, 401);
    assert.match(errResult.message, /Missing or malformed/);
  });

  test('Branch: Malformed Authorization header (missing Bearer prefix) yields 401', async () => {
    config.auth.mode = 'firebase';
    const req = { headers: { authorization: 'Basic some-credentials' } };
    const res = {};
    let errResult = null;

    await authenticate(req, res, (err) => {
      errResult = err;
    });

    assert.ok(errResult instanceof UnauthorizedError);
    assert.equal(errResult.statusCode, 401);
  });

  test('Branch: Test mode with valid active Doctor x-test-user-id attaches doctor profile', async () => {
    config.auth.mode = 'test';
    // User ID 2 is the seeded Doctor
    const req = { headers: { 'x-test-user-id': '2' } };
    const res = {};
    let nextCalled = false;
    let errResult = null;

    await authenticate(req, res, (err) => {
      nextCalled = true;
      errResult = err;
    });

    assert.equal(nextCalled, true);
    assert.equal(errResult, undefined);
    assert.ok(req.user);
    assert.equal(req.user.role, 'DOCTOR');
    assert.equal(typeof req.user.doctorId, 'number');
    assert.ok(req.user.doctorName);
  });

  test('Branch: Test mode with valid active Patient x-test-user-id attaches patient profile', async () => {
    config.auth.mode = 'test';
    // User ID 3 is the seeded Patient
    const req = { headers: { 'x-test-user-id': '3' } };
    const res = {};
    let nextCalled = false;
    let errResult = null;

    await authenticate(req, res, (err) => {
      nextCalled = true;
      errResult = err;
    });

    assert.equal(nextCalled, true);
    assert.equal(errResult, undefined);
    assert.ok(req.user);
    assert.equal(req.user.role, 'PATIENT');
    assert.equal(typeof req.user.patientId, 'number');
  });

  test('Branch: Test mode with non-existent user ID yields 401', async () => {
    config.auth.mode = 'test';
    const req = { headers: { 'x-test-user-id': '999999' } };
    const res = {};
    let errResult = null;

    await authenticate(req, res, (err) => {
      errResult = err;
    });

    assert.ok(errResult instanceof UnauthorizedError);
    assert.equal(errResult.statusCode, 401);
    assert.equal(errResult.message, 'Test user not found');
  });
});
