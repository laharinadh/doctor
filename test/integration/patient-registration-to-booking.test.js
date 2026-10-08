const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../app');
const config = require('../../config');
const db = require('../../config/database');

test.describe('End-to-End Patient Flow: Account Creation to Confirmed Booking', () => {
  const origAuthMode = config.auth.mode;
  const testPhone = `+91981${Math.floor(1000000 + Math.random() * 9000000)}`;
  let patientUserId;
  let patientProfileId;
  let testDoctorId;
  let appointmentDate;
  let selectedSlot;
  let appointmentId;
  let razorpayOrderId;

  test.before(async () => {
    config.auth.mode = 'test';

    // Fetch verified doctor from database
    const [doctors] = await db.query(
      `SELECT d.id, d.name, d.department_id 
       FROM doctors d 
       WHERE d.verification_status = 'APPROVED' AND d.status = 'ACTIVE' 
       LIMIT 1`
    );
    assert.ok(doctors.length > 0, 'Must have at least 1 verified doctor seeded');
    testDoctorId = doctors[0].id;

    // Use a future date (3 days from now)
    const futureDate = new Date(Date.now() + 3 * 864e5);
    appointmentDate = futureDate.toISOString().slice(0, 10);
    const dayOfWeek = futureDate.getUTCDay();

    // Ensure doctor has an active schedule for this day of week
    await db.query(
      `INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, status)
       VALUES (?, ?, '09:00:00', '13:00:00', 30, 'ACTIVE')
       ON DUPLICATE KEY UPDATE start_time = '09:00:00', end_time = '13:00:00', status = 'ACTIVE'`,
      [testDoctorId, dayOfWeek]
    );
  });

  test.after(async () => {
    // Cleanup created test records
    if (appointmentId) {
      await db.query('DELETE FROM payments WHERE appointment_id = ?', [appointmentId]);
      await db.query('DELETE FROM consultations WHERE appointment_id = ?', [appointmentId]);
      await db.query('DELETE FROM appointment_events WHERE appointment_id = ?', [appointmentId]);
      await db.query('DELETE FROM appointments WHERE id = ?', [appointmentId]);
    }
    if (patientProfileId) {
      await db.query('DELETE FROM patients WHERE id = ?', [patientProfileId]);
    }
    if (patientUserId) {
      await db.query('DELETE FROM users WHERE id = ?', [patientUserId]);
    }

    config.auth.mode = origAuthMode;
    await db.end();
  });

  test('Step 1: Patient receives OTP on phone number', async () => {
    const res = await request(app)
      .post('/api/v1/auth/send-otp')
      .send({ phone: testPhone });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.match(res.body.message, /OTP sent successfully/i);
  });

  test('Step 2: Patient verifies OTP & automatically creates new Patient Account', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({
        phone: testPhone,
        role: 'PATIENT',
        name: 'Aarav Sharma',
        email: 'aarav.sharma@example.com',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.isNewUser, true);
    assert.equal(res.body.data.user.role, 'PATIENT');
    assert.equal(res.body.data.profile.name, 'Aarav Sharma');

    patientUserId = res.body.data.user.id;
    patientProfileId = res.body.data.profile.id;
    assert.ok(patientUserId > 0);
    assert.ok(patientProfileId > 0);
  });

  test('Step 3: Patient checks and updates profile with health metrics', async () => {
    const updateRes = await request(app)
      .patch('/api/v1/patient/profile')
      .set('x-test-user-id', String(patientUserId))
      .send({
        name: 'Aarav Sharma Updated',
        height_cm: 176.0,
        weight_kg: 72.0,
      });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.success, true);

    const getRes = await request(app)
      .get('/api/v1/patient/profile')
      .set('x-test-user-id', String(patientUserId));

    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.data.name, 'Aarav Sharma Updated');
    assert.equal(Number(getRes.body.data.height_cm), 176.0);
    assert.equal(Number(getRes.body.data.weight_kg), 72.0);
  });

  test('Step 4: Patient browses doctors and views doctor detail & credentials', async () => {
    const res = await request(app)
      .get('/api/v1/patient/doctors')
      .set('x-test-user-id', String(patientUserId));

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.items));
    assert.ok(res.body.data.items.length > 0);

    const detailRes = await request(app)
      .get(`/api/v1/patient/doctors/${testDoctorId}`)
      .set('x-test-user-id', String(patientUserId));

    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.data.id, testDoctorId);
    assert.ok(detailRes.body.data.qualification);
  });

  test('Step 5: Patient inspects available slots for the selected date', async () => {
    const res = await request(app)
      .get(`/api/v1/patient/doctors/${testDoctorId}/slots?date=${appointmentDate}`)
      .set('x-test-user-id', String(patientUserId));

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0, 'Should have available slots in doctor schedule');

    selectedSlot = typeof res.body.data[0] === 'object' ? res.body.data[0].startTime : res.body.data[0];
    assert.ok(typeof selectedSlot === 'string');
  });

  test('Step 6: Patient locks/holds slot (POST /patient/appointments)', async () => {
    const res = await request(app)
      .post('/api/v1/patient/appointments')
      .set('x-test-user-id', String(patientUserId))
      .send({
        doctorId: testDoctorId,
        appointmentDate,
        startTime: selectedSlot,
        consultationMode: 'VIDEO',
        meetingProvider: 'GOOGLE_MEET',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'HELD');
    assert.ok(res.body.data.id > 0);
    assert.ok(res.body.data.appointment_number);
    assert.ok(res.body.data.hold_expires_at);

    appointmentId = res.body.data.id;
  });

  test('Step 7: Concurrency verification - Slot cannot be double-booked while held', async () => {
    const conflictRes = await request(app)
      .post('/api/v1/patient/appointments')
      .set('x-test-user-id', '3') // Different patient
      .send({
        doctorId: testDoctorId,
        appointmentDate,
        startTime: selectedSlot,
        consultationMode: 'VIDEO',
      });

    assert.equal(conflictRes.status, 409);
    assert.equal(conflictRes.body.success, false);
    assert.match(conflictRes.body.message, /busy|selected or booked/i);
  });

  test('Step 8: Patient initiates payment order (POST /payments/create-order)', async () => {
    const res = await request(app)
      .post('/api/v1/payments/create-order')
      .set('x-test-user-id', String(patientUserId))
      .send({
        appointmentId,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.orderId);
    assert.ok(res.body.data.amount > 0);

    razorpayOrderId = res.body.data.orderId;
  });

  test('Step 9: Patient completes payment verification & confirms appointment', async () => {
    const res = await request(app)
      .post('/api/v1/payments/verify')
      .set('x-test-user-id', String(patientUserId))
      .send({
        appointmentId,
        razorpayOrderId,
        razorpayPaymentId: 'pay_test_' + Date.now(),
        razorpaySignature: 'mock_signature',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.match(res.body.message, /confirmed|success/i);

    // Verify appointment status updated to CONFIRMED in DB
    const [rows] = await db.query('SELECT status, payment_id FROM appointments WHERE id = ?', [appointmentId]);
    assert.equal(rows[0].status, 'CONFIRMED');
    assert.ok(rows[0].payment_id > 0);
  });

  test('Step 10: Patient views confirmed appointment in appointment history', async () => {
    const res = await request(app)
      .get('/api/v1/patient/appointments')
      .set('x-test-user-id', String(patientUserId));

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const appointmentList = Array.isArray(res.body.data) ? res.body.data : res.body.data.items || [];
    assert.ok(Array.isArray(appointmentList));

    const booked = appointmentList.find(a => a.id === appointmentId);
    assert.ok(booked, 'Booked appointment must appear in patient history');
    assert.equal(booked.status, 'CONFIRMED');
    assert.equal(booked.doctor_id, testDoctorId);
    assert.equal(booked.start_time.slice(0, 5), selectedSlot.slice(0, 5));
  });
});
