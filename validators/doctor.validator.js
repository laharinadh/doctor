const Joi = require('joi');
const { APPOINTMENT_STATUS } = require('../utils/constants');

const updateDoctorProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  email: Joi.string().email().trim().allow(null, '').optional(),
  department_id: Joi.number().integer().positive().allow(null).optional(),
  qualification: Joi.string().trim().max(500).allow(null, '').optional(),
  specialty: Joi.string().trim().max(255).allow(null, '').optional(),
  experience_years: Joi.number().integer().min(0).max(70).allow(null).optional(),
  experience: Joi.number().integer().min(0).max(70).allow(null, '').optional(),
  bio: Joi.string().trim().max(2000).allow(null, '').optional(),
  about: Joi.string().trim().max(2000).allow(null, '').optional(),
  case_studies: Joi.array().items(Joi.string().allow('')).optional(),
  cases: Joi.array().items(Joi.string().allow('')).optional(),
  consultation_fee: Joi.number().min(0).max(50000).precision(2).allow(null).optional(),
  profile_photo_url: Joi.string().uri().allow(null, '').optional(),
  profile_video_url: Joi.string().uri().allow(null, '').optional(),
}).unknown(true);

const submitVerificationSchema = Joi.object({
  registrationNumber: Joi.string().trim().min(3).max(100).required(),
  qualification: Joi.string().trim().min(2).max(500).required(),
  specialty: Joi.string().trim().max(255).allow(null, '').optional(),
  experienceYears: Joi.number().integer().min(0).max(70).required(),
  profileVideoUrl: Joi.string().trim().min(5).max(500).required(),
  profilePhotoUrl: Joi.string().trim().max(500).allow(null, '').optional(),
});

const updateAppointmentStatusSchema = Joi.object({
  status: Joi.string()
    .valid(
      APPOINTMENT_STATUS.CONFIRMED,
      APPOINTMENT_STATUS.WAITING,
      APPOINTMENT_STATUS.IN_PROGRESS,
      APPOINTMENT_STATUS.COMPLETED,
      APPOINTMENT_STATUS.NO_SHOW,
      APPOINTMENT_STATUS.CANCELLED
    )
    .required(),
  reason: Joi.string().trim().max(500).allow(null, '').optional(),
});

module.exports = {
  updateDoctorProfileSchema,
  submitVerificationSchema,
  updateAppointmentStatusSchema,
};
