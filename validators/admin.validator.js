const Joi = require('joi');

const rejectDoctorSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

const updatePlatformSettingsSchema = Joi.object({
  platformFee: Joi.number().min(0).max(10000).precision(2).required(),
});

const createDoctorSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).required(),
  phone: Joi.string().trim().pattern(/^\+?[1-9]\d{7,14}$/).required(),
  email: Joi.string().trim().email().allow(null, '').optional(),
  departmentId: Joi.number().integer().positive().allow(null).optional(),
  department_id: Joi.number().integer().positive().allow(null).optional(),
  registrationNumber: Joi.string().trim().max(100).allow(null, '').optional(),
  registration_number: Joi.string().trim().max(100).allow(null, '').optional(),
  qualification: Joi.string().trim().max(500).allow(null, '').optional(),
  experienceYears: Joi.number().integer().min(0).max(80).allow(null).optional(),
  experience_years: Joi.number().integer().min(0).max(80).allow(null).optional(),
  bio: Joi.string().trim().max(5000).allow(null, '').optional(),
  consultationFee: Joi.number().min(0).precision(2).allow(null).optional(),
  consultation_fee: Joi.number().min(0).precision(2).allow(null).optional(),
  profilePhotoUrl: Joi.string().uri().allow(null, '').optional(),
  profile_photo_url: Joi.string().uri().allow(null, '').optional(),
  profileVideoUrl: Joi.string().uri().allow(null, '').optional(),
  profile_video_url: Joi.string().uri().allow(null, '').optional(),
  verificationStatus: Joi.string().valid('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED').optional(),
  verification_status: Joi.string().valid('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED').optional(),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED').optional(),
}).unknown(true);

const updateDoctorSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).optional(),
  phone: Joi.string().trim().pattern(/^\+?[1-9]\d{7,14}$/).optional(),
  email: Joi.string().trim().email().allow(null, '').optional(),
  departmentId: Joi.number().integer().positive().allow(null).optional(),
  department_id: Joi.number().integer().positive().allow(null).optional(),
  registrationNumber: Joi.string().trim().max(100).allow(null, '').optional(),
  registration_number: Joi.string().trim().max(100).allow(null, '').optional(),
  qualification: Joi.string().trim().max(500).allow(null, '').optional(),
  experienceYears: Joi.number().integer().min(0).max(80).allow(null).optional(),
  experience_years: Joi.number().integer().min(0).max(80).allow(null).optional(),
  bio: Joi.string().trim().max(5000).allow(null, '').optional(),
  consultationFee: Joi.number().min(0).precision(2).allow(null).optional(),
  consultation_fee: Joi.number().min(0).precision(2).allow(null).optional(),
  profilePhotoUrl: Joi.string().uri().allow(null, '').optional(),
  profile_photo_url: Joi.string().uri().allow(null, '').optional(),
  profileVideoUrl: Joi.string().uri().allow(null, '').optional(),
  profile_video_url: Joi.string().uri().allow(null, '').optional(),
  verificationStatus: Joi.string().valid('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED').optional(),
  verification_status: Joi.string().valid('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED').optional(),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED').optional(),
}).unknown(true);

const bulkCreateDoctorsSchema = Joi.alternatives().try(
  Joi.array().items(createDoctorSchema).min(1).max(2000),
  Joi.object({
    doctors: Joi.array().items(createDoctorSchema).min(1).max(2000).required(),
  }).unknown(true)
);

const createPatientSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).required(),
  phone: Joi.string().trim().pattern(/^\+?[1-9]\d{7,14}$/).required(),
  email: Joi.string().trim().email().allow(null, '').optional(),
  heightCm: Joi.number().min(30).max(300).precision(1).allow(null).optional(),
  height_cm: Joi.number().min(30).max(300).precision(1).allow(null).optional(),
  weightKg: Joi.number().min(1).max(500).precision(1).allow(null).optional(),
  weight_kg: Joi.number().min(1).max(500).precision(1).allow(null).optional(),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED').optional(),
}).unknown(true);

const updatePatientSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).optional(),
  phone: Joi.string().trim().pattern(/^\+?[1-9]\d{7,14}$/).optional(),
  email: Joi.string().trim().email().allow(null, '').optional(),
  heightCm: Joi.number().min(30).max(300).precision(1).allow(null).optional(),
  height_cm: Joi.number().min(30).max(300).precision(1).allow(null).optional(),
  weightKg: Joi.number().min(1).max(500).precision(1).allow(null).optional(),
  weight_kg: Joi.number().min(1).max(500).precision(1).allow(null).optional(),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED').optional(),
}).unknown(true);

const bulkCreatePatientsSchema = Joi.alternatives().try(
  Joi.array().items(createPatientSchema).min(1).max(2000),
  Joi.object({
    patients: Joi.array().items(createPatientSchema).min(1).max(2000).required(),
  }).unknown(true)
);

const createAppointmentSchema = Joi.object({
  patientId: Joi.number().integer().positive().optional(),
  patient_id: Joi.number().integer().positive().optional(),
  doctorId: Joi.number().integer().positive().optional(),
  doctor_id: Joi.number().integer().positive().optional(),
  departmentId: Joi.number().integer().positive().allow(null).optional(),
  department_id: Joi.number().integer().positive().allow(null).optional(),
  appointmentDate: Joi.string().isoDate().optional(),
  appointment_date: Joi.string().isoDate().optional(),
  startTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).optional(),
  start_time: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).optional(),
  endTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).allow(null).optional(),
  end_time: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).allow(null).optional(),
  consultationMode: Joi.string().valid('FACE_TO_FACE', 'AUDIO', 'VIDEO').optional(),
  consultation_mode: Joi.string().valid('FACE_TO_FACE', 'AUDIO', 'VIDEO').optional(),
  status: Joi.string().valid('HELD', 'PAYMENT_PENDING', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'WAITING', 'IN_PROGRESS', 'COMPLETED', 'RESCHEDULED').optional(),
  platformFee: Joi.number().min(0).precision(2).optional(),
  platform_fee: Joi.number().min(0).precision(2).optional(),
  meetingProvider: Joi.string().valid('GOOGLE_MEET', 'ZOOM').allow(null).optional(),
  meeting_provider: Joi.string().valid('GOOGLE_MEET', 'ZOOM').allow(null).optional(),
  meetingUrl: Joi.string().uri().allow(null, '').optional(),
  meeting_url: Joi.string().uri().allow(null, '').optional(),
  cancellationReason: Joi.string().max(500).allow(null, '').optional(),
  cancellation_reason: Joi.string().max(500).allow(null, '').optional(),
}).unknown(true);

const updateAppointmentSchema = Joi.object({
  patientId: Joi.number().integer().positive().optional(),
  patient_id: Joi.number().integer().positive().optional(),
  doctorId: Joi.number().integer().positive().optional(),
  doctor_id: Joi.number().integer().positive().optional(),
  departmentId: Joi.number().integer().positive().allow(null).optional(),
  department_id: Joi.number().integer().positive().allow(null).optional(),
  appointmentDate: Joi.string().optional(),
  appointment_date: Joi.string().optional(),
  startTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).optional(),
  start_time: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).optional(),
  endTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).allow(null).optional(),
  end_time: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).allow(null).optional(),
  consultationMode: Joi.string().valid('FACE_TO_FACE', 'AUDIO', 'VIDEO').optional(),
  consultation_mode: Joi.string().valid('FACE_TO_FACE', 'AUDIO', 'VIDEO').optional(),
  status: Joi.string().valid('HELD', 'PAYMENT_PENDING', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'WAITING', 'IN_PROGRESS', 'COMPLETED', 'RESCHEDULED').optional(),
  platformFee: Joi.number().min(0).precision(2).optional(),
  platform_fee: Joi.number().min(0).precision(2).optional(),
  meetingProvider: Joi.string().valid('GOOGLE_MEET', 'ZOOM').allow(null).optional(),
  meeting_provider: Joi.string().valid('GOOGLE_MEET', 'ZOOM').allow(null).optional(),
  meetingUrl: Joi.string().allow(null, '').optional(),
  meeting_url: Joi.string().allow(null, '').optional(),
  cancellationReason: Joi.string().max(500).allow(null, '').optional(),
  cancellation_reason: Joi.string().max(500).allow(null, '').optional(),
}).unknown(true);

const updatePaymentSchema = Joi.object({
  status: Joi.string().valid('CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'REFUND_PENDING', 'REFUNDED').optional(),
  amount: Joi.number().min(0).precision(2).optional(),
  gatewayPaymentId: Joi.string().allow(null, '').optional(),
  gateway_payment_id: Joi.string().allow(null, '').optional(),
}).unknown(true);

module.exports = {
  rejectDoctorSchema,
  updatePlatformSettingsSchema,
  createDoctorSchema,
  updateDoctorSchema,
  bulkCreateDoctorsSchema,
  createPatientSchema,
  updatePatientSchema,
  bulkCreatePatientsSchema,
  createAppointmentSchema,
  updateAppointmentSchema,
  updatePaymentSchema,
};
