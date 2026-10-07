const test = require('node:test');
const assert = require('node:assert/strict');
const errorHandler = require('../../middleware/errorHandler');
const { AppError, NotFoundError, BadRequestError } = require('../../utils/errors');

function createMockResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const mockReq = {
  originalUrl: '/api/v1/test',
  method: 'GET',
  ip: '127.0.0.1',
};

test.describe('White Box Tests: Error Handler Branch Coverage', () => {
  test('Branch 1: AppError without errors field', () => {
    const res = createMockResponse();
    const err = new NotFoundError('Doctor not found');

    errorHandler(err, mockReq, res, () => {});

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Doctor not found');
    assert.equal(res.body.errors, undefined);
  });

  test('Branch 1b: AppError with custom errors array', () => {
    const res = createMockResponse();
    const validationDetails = [{ field: 'phone', message: 'invalid format' }];
    const err = new BadRequestError('Bad input payload', validationDetails);

    errorHandler(err, mockReq, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Bad input payload');
    assert.deepEqual(res.body.errors, validationDetails);
  });

  test('Branch 2: MulterError with LIMIT_FILE_SIZE code', () => {
    const res = createMockResponse();
    const err = new Error('File too large');
    err.name = 'MulterError';
    err.code = 'LIMIT_FILE_SIZE';

    errorHandler(err, mockReq, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'File size exceeds maximum allowed limit');
  });

  test('Branch 2b: MulterError with other generic code', () => {
    const res = createMockResponse();
    const err = new Error('Unexpected field');
    err.name = 'MulterError';
    err.code = 'LIMIT_UNEXPECTED_FILE';

    errorHandler(err, mockReq, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'File upload error');
  });

  test('Branch 3: MySQL ER_DUP_ENTRY duplicate constraint', () => {
    const res = createMockResponse();
    const err = new Error("Duplicate entry '+919999999999' for key 'users.phone'");
    err.code = 'ER_DUP_ENTRY';

    errorHandler(err, mockReq, res, () => {});

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'A duplicate record already exists');
  });

  test('Branch 4: Default generic unhandled 500 error in development mode (includes stack)', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const res = createMockResponse();
      const err = new Error('Database connection failed');

      errorHandler(err, mockReq, res, () => {});

      assert.equal(res.statusCode, 500);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Database connection failed');
      assert.ok(res.body.stack !== undefined);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  test('Branch 4b: Generic 500 error in production mode masks internal message and hides stack', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = createMockResponse();
      const err = new Error('Sensitive DB leak table password column failed');

      errorHandler(err, mockReq, res, () => {});

      assert.equal(res.statusCode, 500);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Internal server error'); // Masked!
      assert.equal(res.body.stack, undefined); // Hidden!
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});
