const Joi = require('joi');
const { CONSULTATION_MODES } = require('../utils/constants');

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const bookAppointmentSchema = Joi.object({
  doctorId: Joi.number().integer().positive().required(),
  appointmentDate: Joi.string().pattern(datePattern).required()
    .messages({ 'string.pattern.base': 'appointmentDate must be in YYYY-MM-DD format' }),
  startTime: Joi.string().pattern(timePattern).required()
    .messages({ 'string.pattern.base': 'startTime must be in HH:MM or HH:MM:SS format' }),
  consultationMode: Joi.string()
    .valid(CONSULTATION_MODES.FACE_TO_FACE, CONSULTATION_MODES.AUDIO, CONSULTATION_MODES.VIDEO)
    .required(),
  meetingProvider: Joi.string().valid('GOOGLE_MEET', 'ZOOM').allow(null).optional(),
});

const cancelAppointmentSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

const createPaymentOrderSchema = Joi.object({
  appointmentId: Joi.number().integer().positive().required(),
});

const verifyPaymentSchema = Joi.object({
  appointmentId: Joi.number().integer().positive().required(),
  razorpayOrderId: Joi.string().trim().required(),
  razorpayPaymentId: Joi.string().trim().required(),
  razorpaySignature: Joi.string().trim().required(),
});

module.exports = {
  bookAppointmentSchema,
  cancelAppointmentSchema,
  createPaymentOrderSchema,
  verifyPaymentSchema,
};
