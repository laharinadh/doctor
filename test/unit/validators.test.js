const test = require('node:test');
const assert = require('node:assert/strict');
const { sendOtpSchema, verifyOtpSchema } = require('../../validators/auth.validator');
const {
  updateDoctorProfileSchema,
  submitVerificationSchema,
  updateAppointmentStatusSchema,
} = require('../../validators/doctor.validator');
const {
  bookAppointmentSchema,
  cancelAppointmentSchema,
  createPaymentOrderSchema,
  verifyPaymentSchema,
} = require('../../validators/appointment.validator');
const { upsertScheduleSchema, createLeaveSchema } = require('../../validators/schedule.validator');
const { createDepartmentSchema, updateDepartmentSchema } = require('../../validators/department.validator');
const { rejectDoctorSchema, updatePlatformSettingsSchema } = require('../../validators/admin.validator');
const { updatePatientProfileSchema } = require('../../validators/patient.validator');

test.describe('Unit Tests: Request Validators (Joi Schemas)', () => {
  test.describe('Auth Validator', () => {
    test('sendOtpSchema accepts valid E.164 phone number', () => {
      const { error } = sendOtpSchema.validate({ phone: '+919876543210' });
      assert.equal(error, undefined);
    });

    test('sendOtpSchema rejects invalid phone format', () => {
      const { error } = sendOtpSchema.validate({ phone: '12345' });
      assert.notEqual(error, undefined);
    });

    test('verifyOtpSchema validates phone, role, name, and idToken', () => {
      const valid = verifyOtpSchema.validate({
        phone: '+919876543210',
        role: 'PATIENT',
        name: 'John Doe',
      });
      assert.equal(valid.error, undefined);

      const invalidPhone = verifyOtpSchema.validate({
        phone: '123',
        role: 'PATIENT',
      });
      assert.notEqual(invalidPhone.error, undefined);

      const invalidRole = verifyOtpSchema.validate({
        phone: '+919876543210',
        role: 'SUPERMAN',
      });
      assert.notEqual(invalidRole.error, undefined);
    });
  });

  test.describe('Doctor Validator', () => {
    test('updateDoctorProfileSchema accepts valid profile fields', () => {
      const { error } = updateDoctorProfileSchema.validate({
        name: 'Dr. Test Sharma',
        consultation_fee: 750,
        experience_years: 12,
        bio: 'Cardiology specialist',
      });
      assert.equal(error, undefined);
    });

    test('updateDoctorProfileSchema rejects negative consultation fee', () => {
      const { error } = updateDoctorProfileSchema.validate({
        consultation_fee: -100,
      });
      assert.notEqual(error, undefined);
    });

    test('submitVerificationSchema requires registrationNumber, qualification, experienceYears, profileVideoUrl', () => {
      const valid = submitVerificationSchema.validate({
        registrationNumber: 'MCI-12345',
        qualification: 'MBBS, MD',
        experienceYears: 5,
        profileVideoUrl: 'https://storage.googleapis.com/videos/sample.mp4',
      });
      assert.equal(valid.error, undefined);

      const missingVideo = submitVerificationSchema.validate({
        registrationNumber: 'MCI-12345',
        qualification: 'MBBS, MD',
        experienceYears: 5,
      });
      assert.notEqual(missingVideo.error, undefined);
    });

    test('updateAppointmentStatusSchema allows valid status transitions', () => {
      const valid = updateAppointmentStatusSchema.validate({ status: 'COMPLETED' });
      assert.equal(valid.error, undefined);

      const invalid = updateAppointmentStatusSchema.validate({ status: 'INVALID_STATUS' });
      assert.notEqual(invalid.error, undefined);
    });
  });

  test.describe('Appointment Validator', () => {
    test('bookAppointmentSchema validates required doctorId, appointmentDate, startTime, consultationMode', () => {
      const valid = bookAppointmentSchema.validate({
        doctorId: 1,
        appointmentDate: '2026-10-15',
        startTime: '10:00:00',
        consultationMode: 'VIDEO',
      });
      assert.equal(valid.error, undefined);

      const missingDate = bookAppointmentSchema.validate({
        doctorId: 1,
        startTime: '10:00:00',
        consultationMode: 'VIDEO',
      });
      assert.notEqual(missingDate.error, undefined);
    });

    test('cancelAppointmentSchema requires cancellation reason with minimum 3 chars', () => {
      const valid = cancelAppointmentSchema.validate({
        reason: 'Travel emergency, need to reschedule',
      });
      assert.equal(valid.error, undefined);

      const tooShort = cancelAppointmentSchema.validate({
        reason: 'no',
      });
      assert.notEqual(tooShort.error, undefined);
    });

    test('createPaymentOrderSchema validates appointmentId', () => {
      const valid = createPaymentOrderSchema.validate({
        appointmentId: 42,
      });
      assert.equal(valid.error, undefined);
    });

    test('verifyPaymentSchema requires appointmentId, razorpayOrderId, razorpayPaymentId, razorpaySignature', () => {
      const valid = verifyPaymentSchema.validate({
        appointmentId: 42,
        razorpayOrderId: 'order_test_123',
        razorpayPaymentId: 'pay_test_456',
        razorpaySignature: 'abc123def456',
      });
      assert.equal(valid.error, undefined);

      const missingSig = verifyPaymentSchema.validate({
        appointmentId: 42,
        razorpayOrderId: 'order_test_123',
        razorpayPaymentId: 'pay_test_456',
      });
      assert.notEqual(missingSig.error, undefined);
    });
  });

  test.describe('Schedule Validator', () => {
    test('upsertScheduleSchema accepts valid dayOfWeek (0-6) and times', () => {
      const valid = upsertScheduleSchema.validate({
        dayOfWeek: 2,
        startTime: '09:00:00',
        endTime: '13:00:00',
        slotDurationMinutes: 30,
      });
      assert.equal(valid.error, undefined);
    });

    test('upsertScheduleSchema rejects invalid dayOfWeek (e.g. 7 or negative)', () => {
      const invalid = upsertScheduleSchema.validate({
        dayOfWeek: 7,
        startTime: '09:00:00',
        endTime: '13:00:00',
        slotDurationMinutes: 30,
      });
      assert.notEqual(invalid.error, undefined);
    });

    test('createLeaveSchema validates startDatetime and endDatetime', () => {
      const valid = createLeaveSchema.validate({
        startDatetime: '2026-11-01T09:00:00Z',
        endDatetime: '2026-11-05T18:00:00Z',
        reason: 'Attending medical conference',
      });
      assert.equal(valid.error, undefined);

      const endBeforeStart = createLeaveSchema.validate({
        startDatetime: '2026-11-05T09:00:00Z',
        endDatetime: '2026-11-01T18:00:00Z',
      });
      assert.notEqual(endBeforeStart.error, undefined);
    });
  });

  test.describe('Patient, Department & Admin Validators', () => {
    test('updatePatientProfileSchema validates height and weight bounds', () => {
      const valid = updatePatientProfileSchema.validate({
        name: 'Rahul Verma',
        height_cm: 178.5,
        weight_kg: 72.0,
      });
      assert.equal(valid.error, undefined);

      const invalidHeight = updatePatientProfileSchema.validate({
        height_cm: 500, // exceeds max 250
      });
      assert.notEqual(invalidHeight.error, undefined);
    });

    test('createDepartmentSchema requires non-empty name', () => {
      const valid = createDepartmentSchema.validate({
        name: 'Oncology',
        description: 'Cancer care and research',
      });
      assert.equal(valid.error, undefined);

      const invalid = createDepartmentSchema.validate({
        name: '',
      });
      assert.notEqual(invalid.error, undefined);
    });

    test('rejectDoctorSchema requires reason min 3 chars', () => {
      const valid = rejectDoctorSchema.validate({
        reason: 'Invalid medical license document provided',
      });
      assert.equal(valid.error, undefined);

      const missing = rejectDoctorSchema.validate({});
      assert.notEqual(missing.error, undefined);
    });

    test('updatePlatformSettingsSchema validates platformFee', () => {
      const valid = updatePlatformSettingsSchema.validate({
        platformFee: 150.00,
      });
      assert.equal(valid.error, undefined);

      const negativeFee = updatePlatformSettingsSchema.validate({
        platformFee: -20,
      });
      assert.notEqual(negativeFee.error, undefined);
    });
  });
});
