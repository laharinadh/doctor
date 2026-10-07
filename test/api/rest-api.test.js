const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../app');
const config = require('../../config');
const db = require('../../config/database');

test.describe('API Testing: REST Endpoints, Contracts, Headers & Status Codes', () => {
  const origAuthMode = config.auth.mode;

  test.before(() => {
    config.auth.mode = 'test';
  });

  test.after(async () => {
    config.auth.mode = origAuthMode;
    await db.end();
  });

  test.describe('1. System & Security Headers', () => {
    test('GET /api/v1/health returns 200 and healthy status payload', async () => {
      const res = await request(app).get('/api/v1/health');

      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'].includes('application/json'), true);
      assert.equal(res.body.success, true);
      assert.match(res.body.message, /healthy/i);
      assert.ok(typeof res.body.uptime === 'number');
      assert.ok(res.body.timestamp);
    });

    test('Security headers verified: x-powered-by is disabled, nosniff present', async () => {
      const res = await request(app).get('/api/v1/health');

      assert.equal(res.headers['x-powered-by'], undefined);
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
    });
  });

  test.describe('2. Authentication Endpoints', () => {
    test('POST /api/v1/auth/send-otp succeeds with valid E.164 phone', async () => {
      const res = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({ phone: '+919988776655' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.match(res.body.message, /OTP sent/i);
    });

    test('GET /api/v1/auth/me returns current authenticated user identity', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('x-test-user-id', '3'); // Patient

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.user.role, 'PATIENT');
      assert.equal(res.body.data.profile.email, 'rahul.verma@example.com');
    });
  });

  test.describe('3. Patient REST Endpoints', () => {
    test('GET /api/v1/patient/departments returns array of active departments', async () => {
      const res = await request(app)
        .get('/api/v1/patient/departments')
        .set('x-test-user-id', '3');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    test('GET /api/v1/patient/doctors returns paginated doctor directory', async () => {
      const res = await request(app)
        .get('/api/v1/patient/doctors?page=1&limit=5')
        .set('x-test-user-id', '3');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items));
      assert.ok(res.body.data.pagination);
      assert.equal(res.body.data.pagination.page, 1);
      assert.equal(res.body.data.pagination.limit, 5);
    });

    test('GET /api/v1/patient/profile returns patient personal profile', async () => {
      const res = await request(app)
        .get('/api/v1/patient/profile')
        .set('x-test-user-id', '3');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.email, 'rahul.verma@example.com');
    });

    test('GET /api/v1/patient/appointments returns patient appointment history', async () => {
      const res = await request(app)
        .get('/api/v1/patient/appointments')
        .set('x-test-user-id', '3');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items));
    });
  });

  test.describe('4. Doctor REST Endpoints', () => {
    test('GET /api/v1/doctor/profile returns doctor details', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/profile')
        .set('x-test-user-id', '2');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.email, 'dr.sharma@example.com');
      assert.ok(res.body.data.verification_status);
    });

    test('GET /api/v1/doctor/schedule returns doctor weekly availability schedule', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/schedule')
        .set('x-test-user-id', '2');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    test('GET /api/v1/doctor/appointments returns doctor scheduled consultations', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/appointments')
        .set('x-test-user-id', '2');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items));
    });
  });

  test.describe('5. Admin REST Endpoints', () => {
    test('GET /api/v1/admin/dashboard returns operational metrics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('x-test-user-id', '1');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.doctors);
      assert.ok(res.body.data.patients);
    });

    test('GET /api/v1/admin/doctors returns paginated list of all doctors', async () => {
      const res = await request(app)
        .get('/api/v1/admin/doctors')
        .set('x-test-user-id', '1');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items));
    });

    test('GET /api/v1/admin/patients returns registered patient list', async () => {
      const res = await request(app)
        .get('/api/v1/admin/patients')
        .set('x-test-user-id', '1');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items));
    });

    test('GET /api/v1/admin/departments returns department catalog', async () => {
      const res = await request(app)
        .get('/api/v1/admin/departments')
        .set('x-test-user-id', '1');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    test('GET /api/v1/admin/payments returns platform payments transaction list', async () => {
      const res = await request(app)
        .get('/api/v1/admin/payments')
        .set('x-test-user-id', '1');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items));
    });
  });
});
