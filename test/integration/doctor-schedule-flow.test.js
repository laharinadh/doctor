const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../app');
const config = require('../../config');
const db = require('../../config/database');

test.describe('Integration Tests: Doctor Profile, Schedule & Slot Engine Flow', () => {
  const origAuthMode = config.auth.mode;

  test.before(() => {
    config.auth.mode = 'test';
  });

  test.after(async () => {
    config.auth.mode = origAuthMode;
    await db.end();
  });

  test('1. Doctor fetches own profile with role attachment from DB', async () => {
    const res = await request(app)
      .get('/api/v1/doctor/profile')
      .set('x-test-user-id', '2'); // Doctor user

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data);
    assert.equal(res.body.data.email, 'dr.sharma@example.com');
  });

  test('2. Doctor updates bio and fee in DB and verifies persisted changes', async () => {
    const newFee = 650.00;
    const newBio = 'Senior consultant specializing in preventive and family medicine.';

    const patchRes = await request(app)
      .patch('/api/v1/doctor/profile')
      .set('x-test-user-id', '2')
      .send({
        consultation_fee: newFee,
        bio: newBio,
      });

    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.success, true);

    // Verify directly from MySQL database
    const [rows] = await db.query('SELECT consultation_fee, bio FROM doctors WHERE user_id = ?', [2]);
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].consultation_fee), newFee);
    assert.equal(rows[0].bio, newBio);
  });

  test('3. Doctor configures schedule, patient queries slot generation engine', async () => {
    // Upsert a schedule for Tuesday (day 2): 10:00 to 12:00 (4 slots of 30 mins)
    const schedRes = await request(app)
      .post('/api/v1/doctor/schedule')
      .set('x-test-user-id', '2')
      .send({
        dayOfWeek: 2, // Tuesday
        startTime: '10:00:00',
        endTime: '12:00:00',
        slotDurationMinutes: 30,
        status: 'ACTIVE',
      });

    assert.equal(schedRes.status, 200);
    assert.equal(schedRes.body.success, true);

    // Fetch doctor's ID
    const [docs] = await db.query('SELECT id FROM doctors WHERE user_id = ?', [2]);
    const doctorId = docs[0].id;

    // Pick a future Tuesday: 2026-11-03 is Tuesday
    const testTuesday = '2026-11-03';
    const slotsRes = await request(app)
      .get(`/api/v1/patient/doctors/${doctorId}/slots?date=${testTuesday}`)
      .set('x-test-user-id', '3'); // Patient

    assert.equal(slotsRes.status, 200);
    assert.equal(slotsRes.body.success, true);
    assert.ok(Array.isArray(slotsRes.body.data));
    
    // Verify 4 slots generated: 10:00, 10:30, 11:00, 11:30
    const startTimes = slotsRes.body.data.map(s => s.startTime);
    assert.ok(startTimes.includes('10:00:00'));
    assert.ok(startTimes.includes('10:30:00'));
    assert.ok(startTimes.includes('11:00:00'));
    assert.ok(startTimes.includes('11:30:00'));
  });
});
