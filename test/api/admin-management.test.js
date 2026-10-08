const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../app');
const config = require('../../config');
const db = require('../../config/database');

test.describe('Admin Full Management API (Doctors, Patients, Appointments, Payments & Bulk Imports)', () => {
  const origAuthMode = config.auth.mode;

  test.before(() => {
    config.auth.mode = 'test';
  });

  test.after(async () => {
    config.auth.mode = origAuthMode;
    await db.end();
  });

  const adminHeaders = { 'x-test-user-id': '1' }; // User 1 is ADMIN

  test.describe('1. Doctor Profile Management & Bulk Import', () => {
    let createdDoctorId = null;

    test('POST /api/v1/admin/doctors creates a single doctor with full profile', async () => {
      const uniqueSuffix = Date.now().toString().slice(-6);
      const payload = {
        name: `Dr. Ramesh Patel ${uniqueSuffix}`,
        phone: `+919876${uniqueSuffix}`,
        email: `ramesh.${uniqueSuffix}@example.com`,
        qualification: 'MBBS, MD Cardiology',
        experienceYears: 12,
        consultationFee: 750,
        bio: 'Senior Interventional Cardiologist',
        registrationNumber: `MCI-${uniqueSuffix}`,
        verificationStatus: 'APPROVED',
        status: 'ACTIVE',
      };

      const res = await request(app)
        .post('/api/v1/admin/doctors')
        .set(adminHeaders)
        .send(payload);

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, payload.name);
      assert.equal(res.body.data.phone, payload.phone);
      assert.equal(res.body.data.verification_status, 'APPROVED');
      assert.equal(res.body.data.status, 'ACTIVE');
      createdDoctorId = res.body.data.id;
    });

    test('GET /api/v1/admin/doctors/:id returns full doctor detail including user info', async () => {
      assert.ok(createdDoctorId);
      const res = await request(app)
        .get(`/api/v1/admin/doctors/${createdDoctorId}`)
        .set(adminHeaders);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.id, createdDoctorId);
      assert.ok(Array.isArray(res.body.data.verificationHistory));
    });

    test('PATCH /api/v1/admin/doctors/:id updates any doctor fields (fee, bio, experience, qualification)', async () => {
      assert.ok(createdDoctorId);
      const res = await request(app)
        .patch(`/api/v1/admin/doctors/${createdDoctorId}`)
        .set(adminHeaders)
        .send({
          name: 'Dr. Ramesh Patel (Chief of Cardiology)',
          consultationFee: 1200,
          experienceYears: 15,
          bio: 'Chief cardiologist specializing in complex angioplasties',
          status: 'ACTIVE',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, 'Dr. Ramesh Patel (Chief of Cardiology)');
      assert.equal(Number(res.body.data.consultation_fee), 1200);
      assert.equal(res.body.data.experience_years, 15);
    });

    test('POST /api/v1/admin/doctors/bulk imports a large batch of doctors', async () => {
      const baseTime = Date.now().toString().slice(-5);
      const doctorsList = [
        {
          name: `Dr. Bulk One ${baseTime}`,
          phone: `+919101${baseTime}`,
          email: `bulk1.${baseTime}@example.com`,
          qualification: 'MBBS, MS General Surgery',
          experienceYears: 8,
          consultationFee: 500,
          verificationStatus: 'APPROVED',
        },
        {
          name: `Dr. Bulk Two ${baseTime}`,
          phone: `+919102${baseTime}`,
          email: `bulk2.${baseTime}@example.com`,
          qualification: 'MD Pediatrics',
          experienceYears: 5,
          consultationFee: 600,
          verificationStatus: 'APPROVED',
        },
        {
          name: `Dr. Bulk Three ${baseTime}`,
          phone: `+919103${baseTime}`,
          email: `bulk3.${baseTime}@example.com`,
          qualification: 'MD Dermatology',
          experienceYears: 10,
          consultationFee: 800,
          verificationStatus: 'APPROVED',
        },
      ];

      const res = await request(app)
        .post('/api/v1/admin/doctors/bulk')
        .set(adminHeaders)
        .send({ doctors: doctorsList });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.total, 3);
      assert.equal(res.body.data.createdCount, 3);
      assert.equal(res.body.data.skippedCount, 0);
      assert.equal(res.body.data.created.length, 3);
    });

    test('DELETE /api/v1/admin/doctors/:id removes the doctor record', async () => {
      assert.ok(createdDoctorId);
      const res = await request(app)
        .delete(`/api/v1/admin/doctors/${createdDoctorId}`)
        .set(adminHeaders);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      // Verify deletion
      const checkRes = await request(app)
        .get(`/api/v1/admin/doctors/${createdDoctorId}`)
        .set(adminHeaders);
      assert.equal(checkRes.status, 404);
    });
  });

  test.describe('2. Patient Profile Management & Bulk Import', () => {
    let createdPatientId = null;

    test('POST /api/v1/admin/patients creates a single patient', async () => {
      const uniqueSuffix = Date.now().toString().slice(-6);
      const payload = {
        name: `Sunita Deshmukh ${uniqueSuffix}`,
        phone: `+919701${uniqueSuffix}`,
        email: `sunita.${uniqueSuffix}@example.com`,
        heightCm: 162.5,
        weightKg: 58.0,
        status: 'ACTIVE',
      };

      const res = await request(app)
        .post('/api/v1/admin/patients')
        .set(adminHeaders)
        .send(payload);

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, payload.name);
      assert.equal(res.body.data.phone, payload.phone);
      createdPatientId = res.body.data.id;
    });

    test('GET /api/v1/admin/patients/:id returns patient detail', async () => {
      assert.ok(createdPatientId);
      const res = await request(app)
        .get(`/api/v1/admin/patients/${createdPatientId}`)
        .set(adminHeaders);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.id, createdPatientId);
      assert.ok(Array.isArray(res.body.data.recentAppointments));
    });

    test('PATCH /api/v1/admin/patients/:id updates patient profile details', async () => {
      assert.ok(createdPatientId);
      const res = await request(app)
        .patch(`/api/v1/admin/patients/${createdPatientId}`)
        .set(adminHeaders)
        .send({
          name: 'Sunita D. Sharma',
          weightKg: 56.5,
          heightCm: 163.0,
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, 'Sunita D. Sharma');
      assert.equal(Number(res.body.data.weight_kg), 56.5);
    });

    test('POST /api/v1/admin/patients/bulk imports a large batch of patients', async () => {
      const baseTime = Date.now().toString().slice(-5);
      const patientsList = [
        {
          name: `Bulk Patient One ${baseTime}`,
          phone: `+919201${baseTime}`,
          email: `p1.${baseTime}@example.com`,
          heightCm: 170.0,
          weightKg: 65.0,
        },
        {
          name: `Bulk Patient Two ${baseTime}`,
          phone: `+919202${baseTime}`,
          email: `p2.${baseTime}@example.com`,
          heightCm: 155.0,
          weightKg: 50.0,
        },
        {
          name: `Bulk Patient Three ${baseTime}`,
          phone: `+919203${baseTime}`,
          email: `p3.${baseTime}@example.com`,
          heightCm: 180.0,
          weightKg: 82.0,
        },
      ];

      const res = await request(app)
        .post('/api/v1/admin/patients/bulk')
        .set(adminHeaders)
        .send({ patients: patientsList });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.total, 3);
      assert.equal(res.body.data.createdCount, 3);
      assert.equal(res.body.data.skippedCount, 0);
    });

    test('DELETE /api/v1/admin/patients/:id removes patient record', async () => {
      assert.ok(createdPatientId);
      const res = await request(app)
        .delete(`/api/v1/admin/patients/${createdPatientId}`)
        .set(adminHeaders);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });
  });

  test.describe('3. Admin Direct Appointment Override & Modification', () => {
    let testAptId = null;

    test('POST /api/v1/admin/appointments directly books appointment on behalf of users', async () => {
      const res = await request(app)
        .post('/api/v1/admin/appointments')
        .set(adminHeaders)
        .send({
          patientId: 1,
          doctorId: 1,
          appointmentDate: '2026-11-20',
          startTime: '14:30:00',
          consultationMode: 'VIDEO',
          status: 'CONFIRMED',
          platformFee: 99.0,
          meetingUrl: 'https://meet.google.com/med-test-override',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.patient_id, 1);
      assert.equal(res.body.data.doctor_id, 1);
      assert.equal(res.body.data.status, 'CONFIRMED');
      testAptId = res.body.data.id;
    });

    test('GET /api/v1/admin/appointments/:id retrieves appointment details and event history', async () => {
      assert.ok(testAptId);
      const res = await request(app)
        .get(`/api/v1/admin/appointments/${testAptId}`)
        .set(adminHeaders);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.events));
    });

    test('PATCH /api/v1/admin/appointments/:id modifies appointment status, time, or link', async () => {
      assert.ok(testAptId);
      const res = await request(app)
        .patch(`/api/v1/admin/appointments/${testAptId}`)
        .set(adminHeaders)
        .send({
          status: 'COMPLETED',
          cancellationReason: null,
          meetingUrl: 'https://meet.google.com/med-completed-session',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'COMPLETED');
    });

    test('DELETE /api/v1/admin/appointments/:id deletes appointment record', async () => {
      assert.ok(testAptId);
      const res = await request(app)
        .delete(`/api/v1/admin/appointments/${testAptId}`)
        .set(adminHeaders);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });
  });
});
