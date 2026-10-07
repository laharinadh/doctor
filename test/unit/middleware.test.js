const test = require('node:test');
const assert = require('node:assert/strict');
const Joi = require('joi');
const authorize = require('../../middleware/role');
const validate = require('../../middleware/validate');
const { ROLES } = require('../../utils/constants');
const { BadRequestError, UnauthorizedError, ForbiddenError } = require('../../utils/errors');

test.describe('Unit Tests: Middleware Isolation', () => {
  test.describe('authorize(roles) Middleware', () => {
    test('calls next(UnauthorizedError) when req.user is missing', () => {
      const middleware = authorize(ROLES.DOCTOR);
      const req = {};
      const res = {};
      let calledError = null;

      middleware(req, res, (err) => {
        calledError = err;
      });

      assert.ok(calledError instanceof UnauthorizedError);
      assert.equal(calledError.statusCode, 401);
    });

    test('calls next(ForbiddenError) when req.user.role is not permitted', () => {
      const middleware = authorize(ROLES.ADMIN);
      const req = { user: { id: 1, role: ROLES.PATIENT } };
      const res = {};
      let calledError = null;

      middleware(req, res, (err) => {
        calledError = err;
      });

      assert.ok(calledError instanceof ForbiddenError);
      assert.equal(calledError.statusCode, 403);
    });

    test('calls next() with no error when role matches single allowed role', () => {
      const middleware = authorize(ROLES.DOCTOR);
      const req = { user: { id: 2, role: ROLES.DOCTOR } };
      const res = {};
      let calledNext = false;
      let calledError = null;

      middleware(req, res, (err) => {
        calledNext = true;
        calledError = err;
      });

      assert.equal(calledNext, true);
      assert.equal(calledError, undefined);
    });

    test('calls next() when user role matches one of multiple allowed roles', () => {
      const middleware = authorize(ROLES.DOCTOR, ROLES.ADMIN);
      const req = { user: { id: 1, role: ROLES.ADMIN } };
      const res = {};
      let calledNext = false;

      middleware(req, res, (err) => {
        calledNext = true;
      });

      assert.equal(calledNext, true);
    });
  });

  test.describe('validate(schema, source) Middleware', () => {
    const testSchema = Joi.object({
      name: Joi.string().required(),
      age: Joi.number().integer().min(18).required(),
    });

    test('passes valid payload and cleans unwhitelisted attributes', () => {
      const middleware = validate(testSchema);
      const req = {
        body: {
          name: 'Jane Doe',
          age: 25,
          maliciousField: 'drop table users',
        },
      };
      const res = {};
      let nextCalled = false;

      middleware(req, res, (err) => {
        assert.equal(err, undefined);
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(req.body.name, 'Jane Doe');
      assert.equal(req.body.age, 25);
      assert.equal(req.body.maliciousField, undefined); // Stripped!
    });

    test('passes BadRequestError with field-level details on validation failure', () => {
      const middleware = validate(testSchema);
      const req = {
        body: {
          name: 'John',
          age: 15, // under 18!
        },
      };
      const res = {};
      let caughtError = null;

      middleware(req, res, (err) => {
        caughtError = err;
      });

      assert.ok(caughtError instanceof BadRequestError);
      assert.equal(caughtError.statusCode, 400);
      assert.equal(caughtError.message, 'Validation failed');
      assert.ok(Array.isArray(caughtError.errors));
      assert.equal(caughtError.errors[0].field, 'age');
    });
  });
});
