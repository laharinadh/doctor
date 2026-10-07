const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} = require('../../utils/errors');
const {
  generateAppointmentNumber,
  timeToMinutes,
  minutesToTime,
  addMinutesToTime,
  timingSafeCompare,
} = require('../../utils/helpers');
const { getPaginationParams } = require('../../utils/pagination');
const response = require('../../utils/response');

test.describe('Unit Tests: Utils & Errors', () => {
  test.describe('Custom Error Classes', () => {
    test('AppError default and properties', () => {
      const err = new AppError('Something went wrong', 500);
      assert.equal(err.message, 'Something went wrong');
      assert.equal(err.statusCode, 500);
      assert.equal(err.status, 'error');
      assert.equal(err.isOperational, true);
      assert.equal(err.errors, null);
    });

    test('BadRequestError has 400 statusCode and fail status', () => {
      const err = new BadRequestError('Bad input', [{ field: 'name', message: 'required' }]);
      assert.equal(err.statusCode, 400);
      assert.equal(err.status, 'fail');
      assert.deepEqual(err.errors, [{ field: 'name', message: 'required' }]);
    });

    test('UnauthorizedError has 401 statusCode', () => {
      const err = new UnauthorizedError('Please log in');
      assert.equal(err.statusCode, 401);
      assert.equal(err.status, 'fail');
      assert.equal(err.message, 'Please log in');
    });

    test('ForbiddenError has 403 statusCode', () => {
      const err = new ForbiddenError('Not allowed');
      assert.equal(err.statusCode, 403);
      assert.equal(err.status, 'fail');
      assert.equal(err.message, 'Not allowed');
    });

    test('NotFoundError has 404 statusCode', () => {
      const err = new NotFoundError('Doctor not found');
      assert.equal(err.statusCode, 404);
      assert.equal(err.status, 'fail');
      assert.equal(err.message, 'Doctor not found');
    });

    test('ConflictError has 409 statusCode', () => {
      const err = new ConflictError('Slot already booked');
      assert.equal(err.statusCode, 409);
      assert.equal(err.status, 'fail');
      assert.equal(err.message, 'Slot already booked');
    });
  });

  test.describe('Helper Functions', () => {
    test('generateAppointmentNumber returns expected format APT-YYYYMMDD-HEX', () => {
      const aptNumber = generateAppointmentNumber();
      assert.match(aptNumber, /^APT-\d{8}-[A-F0-9]{6}$/);
      // Verify uniqueness across consecutive calls
      const aptNumber2 = generateAppointmentNumber();
      assert.notEqual(aptNumber, aptNumber2);
    });

    test('timeToMinutes correctly converts HH:MM string to integer minutes', () => {
      assert.equal(timeToMinutes('00:00'), 0);
      assert.equal(timeToMinutes('09:30'), 570);
      assert.equal(timeToMinutes('13:45'), 825);
      assert.equal(timeToMinutes('23:59'), 1439);
      assert.equal(timeToMinutes(''), 0);
      assert.equal(timeToMinutes(null), 0);
    });

    test('minutesToTime correctly converts minutes to HH:MM:00 string', () => {
      assert.equal(minutesToTime(0), '00:00:00');
      assert.equal(minutesToTime(570), '09:30:00');
      assert.equal(minutesToTime(825), '13:45:00');
      assert.equal(minutesToTime(1439), '23:59:00');
    });

    test('addMinutesToTime computes next slot timestamp', () => {
      assert.equal(addMinutesToTime('09:00', 30), '09:30:00');
      assert.equal(addMinutesToTime('11:45', 30), '12:15:00');
      assert.equal(addMinutesToTime('23:30', 30), '24:00:00');
    });

    test('timingSafeCompare correctly compares strings in constant time', () => {
      assert.equal(timingSafeCompare('secret-key-123', 'secret-key-123'), true);
      assert.equal(timingSafeCompare('secret-key-123', 'secret-key-999'), false);
      assert.equal(timingSafeCompare('short', 'longer-string'), false);
      assert.equal(timingSafeCompare(null, 'test'), false);
      assert.equal(timingSafeCompare('test', 123), false);
    });
  });

  test.describe('Pagination Params', () => {
    test('uses defaults when query parameters are missing', () => {
      const result = getPaginationParams({});
      assert.equal(result.page, 1);
      assert.equal(result.limit, 10);
      assert.equal(result.offset, 0);
    });

    test('parses custom page and limit with proper offset', () => {
      const result = getPaginationParams({ page: '3', limit: '20' });
      assert.equal(result.page, 3);
      assert.equal(result.limit, 20);
      assert.equal(result.offset, 40);
    });

    test('clamps minimum page to 1 and enforces max limit of 100', () => {
      const resultMin = getPaginationParams({ page: '-5', limit: '-10' });
      assert.equal(resultMin.page, 1);
      assert.equal(resultMin.limit, 1);
      assert.equal(resultMin.offset, 0);

      const resultMax = getPaginationParams({ page: '1', limit: '500' });
      assert.equal(resultMax.limit, 100);
    });
  });

  test.describe('Standard API Response Formatter', () => {
    test('success formats 200 payload', () => {
      const mockRes = {
        statusCode: 0,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          return this;
        },
      };

      response.success(mockRes, { user: 'test' }, 'User fetched');
      assert.equal(mockRes.statusCode, 200);
      assert.equal(mockRes.body.success, true);
      assert.equal(mockRes.body.message, 'User fetched');
      assert.deepEqual(mockRes.body.data, { user: 'test' });
    });

    test('created formats 201 payload', () => {
      const mockRes = {
        statusCode: 0,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          return this;
        },
      };

      response.created(mockRes, { id: 101 }, 'Resource created');
      assert.equal(mockRes.statusCode, 201);
      assert.equal(mockRes.body.success, true);
      assert.equal(mockRes.body.message, 'Resource created');
    });

    test('paginated calculates totalPages and navigation flags', () => {
      const mockRes = {
        statusCode: 0,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          return this;
        },
      };

      response.paginated(mockRes, ['item1', 'item2'], 25, 2, 10);
      assert.equal(mockRes.statusCode, 200);
      assert.equal(mockRes.body.data.pagination.total, 25);
      assert.equal(mockRes.body.data.pagination.page, 2);
      assert.equal(mockRes.body.data.pagination.limit, 10);
      assert.equal(mockRes.body.data.pagination.totalPages, 3);
      assert.equal(mockRes.body.data.pagination.hasNextPage, true);
      assert.equal(mockRes.body.data.pagination.hasPrevPage, true);
    });
  });
});
