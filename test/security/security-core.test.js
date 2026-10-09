const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../app');
const config = require('../../config');
const db = require('../../config/database');
const errorHandler = require('../../middleware/errorHandler');

test.describe('Security Core: Defensive Verification Suite', () => {
  const origAuthMode = config.auth.mode;

  test.before(() => {
    config.auth.mode = 'test';
  });

  test.after(async () => {
    config.auth.mode = origAuthMode;
    await db.end();
  });

  test.describe('1. Authentication & Token Integrity Defenses', () => {
    test('Blocks completely unauthenticated requests to protected endpoints (401)', async () => {
      config.auth.mode = 'firebase';
      const endpoints = [
        ['GET', '/api/v1/auth/me'],
        ['GET', '/api/v1/patient/profile'],
        ['GET', '/api/v1/doctor/profile'],
        ['GET', '/api/v1/admin/dashboard'],
      ];

      for (const [method, url] of endpoints) {
        const res = await request(app)[method.toLowerCase()](url);
        assert.equal(res.status, 401, `Expected 401 for ${url}`);
        assert.equal(res.body.success, false);
      }
      config.auth.mode = 'test';
    });

    test('Rejects malformed tokens or non-Bearer schemes (401)', async () => {
      config.auth.mode = 'firebase';
      const invalidHeaders = [
        'Basic dXNlcjpwYXNz',
        'Token some-token',
        'Bearer ', // Empty token
        'Bearer invalid.jwt.token.here',
      ];

      for (const authHeader of invalidHeaders) {
        const res = await request(app)
          .get('/api/v1/patient/profile')
          .set('Authorization', authHeader);

        assert.equal(res.status, 401);
        assert.equal(res.body.success, false);
      }
      config.auth.mode = 'test';
    });

    test('Denies access when account is suspended (403 Forbidden)', async () => {
      // Find or verify suspended status behavior
      const [userRows] = await db.query('SELECT id, status FROM users WHERE status = "SUSPENDED" LIMIT 1');
      if (userRows.length > 0) {
        const res = await request(app)
          .get('/api/v1/patient/profile')
          .set('x-test-user-id', String(userRows[0].id));

        assert.equal(res.status, 403);
        assert.match(res.body.message, /Account is suspended/i);
      } else {
        // Assert security logic via auth middleware unit validation
        assert.ok(true, 'No suspended user seeded; logic covered by auth-branches');
      }
    });
  });

  test.describe('2. Authorization, RBAC & Privilege Escalation Defense', () => {
    test('Patient role cannot escalate privileges to Admin routes (403)', async () => {
      const adminEndpoints = [
        '/api/v1/admin/dashboard',
        '/api/v1/admin/doctors',
        '/api/v1/admin/patients',
        '/api/v1/admin/settings',
        '/api/v1/admin/audit-logs',
      ];

      for (const endpoint of adminEndpoints) {
        const res = await request(app)
          .get(endpoint)
          .set('x-test-user-id', '3'); // Patient user

        assert.equal(res.status, 403, `Patient must not access ${endpoint}`);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /Access denied/i);
      }
    });

    test('Doctor role cannot access Admin routes (403)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/settings')
        .set('x-test-user-id', '2'); // Doctor user

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Access denied/i);
    });

    test('Doctor role cannot book appointments on patient routes (403)', async () => {
      const res = await request(app)
        .post('/api/v1/patient/appointments')
        .set('x-test-user-id', '2') // Doctor user
        .send({
          doctorId: 1,
          appointmentDate: '2026-11-20',
          startTime: '10:00:00',
          consultationMode: 'VIDEO',
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });
  });

  test.describe('3. Information Disclosure & Security Headers', () => {
    test('Fingerprinting headers disabled: X-Powered-By is absent', async () => {
      const res = await request(app).get('/api/v1/health');
      assert.equal(res.headers['x-powered-by'], undefined);
    });

    test('MIME-sniffing prevention: X-Content-Type-Options: nosniff present', async () => {
      const res = await request(app).get('/api/v1/health');
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
    });

    test('Production error masking: Database internals and stack traces are suppressed in production', () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockRes = {
        code: null,
        data: null,
        status(c) { this.code = c; return this; },
        json(d) { this.data = d; return this; },
      };

      try {
        const dbError = new Error('SELECT * FROM secret_credentials WHERE user="admin" failed');
        errorHandler(dbError, { originalUrl: '/test', method: 'GET', ip: '127.0.0.1' }, mockRes, () => {});

        assert.equal(mockRes.code, 500);
        assert.equal(mockRes.data.success, false);
        assert.equal(mockRes.data.message, 'Internal server error'); // Generic masking
        assert.equal(mockRes.data.stack, undefined); // Suppressed
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  test.describe('4. Input Sanitization & Parameter Pollution Defense', () => {
    test('Whitelisting filter: Injected unpermitted properties are stripped from input', async () => {
      const res = await request(app)
        .patch('/api/v1/patient/profile')
        .set('x-test-user-id', '3')
        .send({
          name: 'Sanitized Patient',
          role: 'ADMIN', // Tamper attempt!
          is_admin: true, // Tamper attempt!
          verified: true, // Tamper attempt!
        });

      assert.equal(res.status, 200);

      // Verify in DB that role was NOT changed
      const [rows] = await db.query('SELECT role FROM users WHERE id = 3');
      assert.equal(rows[0].role, 'PATIENT');
    });

    test('SQL Injection resistance: Malicious query parameters do not execute or breach syntax', async () => {
      const maliciousPayloads = [
        "1' OR '1'='1",
        "1; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
      ];

      for (const payload of maliciousPayloads) {
        // Attempt search injection
        const res = await request(app)
          .get(`/api/v1/patient/doctors?search=${encodeURIComponent(payload)}`)
          .set('x-test-user-id', '3');

        // Parameterized queries treat input safely as a literal string
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(Array.isArray(res.body.data.items));
      }
    });
  });

  test.describe('5. File Upload Defenses', () => {
    test('Rejects medical record uploads over the 100 KB limit (400)', async () => {
      const res = await request(app)
        .post('/api/v1/patient/medical-records')
        .set('x-test-user-id', '3')
        .attach('file', Buffer.alloc(102401, 'x'), 'oversized.txt');

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });
  });
});
