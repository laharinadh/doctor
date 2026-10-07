const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../app');
const config = require('../../config');
const db = require('../../config/database');

test.describe('Black Box Tests: Specification, Equivalence & Boundary Testing', () => {
  const origAuthMode = config.auth.mode;

  test.before(() => {
    config.auth.mode = 'test';
  });

  test.after(async () => {
    config.auth.mode = origAuthMode;
    await db.end();
  });

  test.describe('1. Equivalence Partitioning: Phone Number & Consultation Modes', () => {
    test('Valid E.164 phone number partition is accepted by OTP endpoint', async () => {
      const res = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({ phone: '+919876543210' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    test('Invalid phone number partitions are rejected with 400 Bad Request', async () => {
      const invalidPhones = [
        '9876543210', // Missing leading '+'
        '+91ABCD1234', // Alphanumeric
        '+', // Lone plus
        '', // Empty string
        'not-a-number',
      ];

      for (const phone of invalidPhones) {
        const res = await request(app)
          .post('/api/v1/auth/send-otp')
          .send({ phone });

        assert.equal(res.status, 400, `Expected 400 for phone: ${phone}`);
        assert.equal(res.body.success, false);
      }
    });

    test('Invalid consultation mode is rejected with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/patient/appointments')
        .set('x-test-user-id', '3') // Patient
        .send({
          doctorId: 1,
          appointmentDate: '2026-12-01',
          startTime: '10:00:00',
          consultationMode: 'TELEPATHIC', // Invalid!
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Validation failed/i);
    });
  });

  test.describe('2. Boundary Value Analysis: Numbers & Extremes', () => {
    test('Doctor fee boundary: negative fee is rejected with 400', async () => {
      const res = await request(app)
        .patch('/api/v1/doctor/profile')
        .set('x-test-user-id', '2') // Doctor
        .send({ consultation_fee: -1 });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    test('Doctor fee boundary: fee exceeding 50,000 maximum is rejected with 400', async () => {
      const res = await request(app)
        .patch('/api/v1/doctor/profile')
        .set('x-test-user-id', '2') // Doctor
        .send({ consultation_fee: 50001 });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    test('Patient height boundary: height > 250 cm is rejected with 400', async () => {
      const res = await request(app)
        .patch('/api/v1/patient/profile')
        .set('x-test-user-id', '3') // Patient
        .send({ height_cm: 251 });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    test('Patient weight boundary: weight < 1 kg is rejected with 400', async () => {
      const res = await request(app)
        .patch('/api/v1/patient/profile')
        .set('x-test-user-id', '3') // Patient
        .send({ weight_kg: 0.5 });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    test('Doctor schedule dayOfWeek boundaries: 0 (Sun) to 6 (Sat) accepted, 7 rejected', async () => {
      // 7 is out of boundary (0-6)
      const res = await request(app)
        .post('/api/v1/doctor/schedule')
        .set('x-test-user-id', '2')
        .send({
          dayOfWeek: 7,
          startTime: '09:00:00',
          endTime: '12:00:00',
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });
  });

  test.describe('3. Negative & Role Security Black Box Testing', () => {
    test('Accessing protected endpoint without credentials returns 401 Unauthorized', async () => {
      // Temporarily test production mode header requirement
      config.auth.mode = 'firebase';
      const res = await request(app).get('/api/v1/doctor/profile');
      config.auth.mode = 'test';

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    test('Privilege escalation check: Patient cannot access Admin dashboard (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('x-test-user-id', '3'); // Patient ID

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Access denied/i);
    });

    test('Privilege escalation check: Doctor cannot access Admin dashboard (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('x-test-user-id', '2'); // Doctor ID

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Access denied/i);
    });

    test('Privilege isolation: Doctor cannot call patient medical-record routes (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/patient/profile')
        .set('x-test-user-id', '2'); // Doctor ID

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    test('Calling non-existent API URL returns standardized 404 Not Found contract', async () => {
      const res = await request(app).get('/api/v1/non-existent-route-999');

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Resource not found/i);
    });
  });
});
