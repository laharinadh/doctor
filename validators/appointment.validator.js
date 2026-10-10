const Joi = require('joi');
const { CONSULTATION_MODES } = require('../utils/constants');

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const bookAppointmentSchema = Joi.object({
  doctorId: Joi.number().integer().positive().optional(),
  doctor_id: Joi.number().integer().positive().optional(),
  appointmentDate: Joi.string().pattern(datePattern).optional(),
  date: Joi.string().pattern(datePattern).optional(),
  startTime: Joi.string().pattern(timePattern).optional(),
  start_time: Joi.string().pattern(timePattern).optional(),
  consultationMode: Joi.string().valid(...Object.values(CONSULTATION_MODES), 'IN_PERSON').optional(),
  mode: Joi.string().valid(...Object.values(CONSULTATION_MODES), 'IN_PERSON').optional(),
  meetingProvider: Joi.string().valid('GOOGLE_MEET', 'ZOOM').allow(null).optional(),
})
  .or('doctorId', 'doctor_id')
  .or('appointmentDate', 'date')
  .or('startTime', 'start_time')
  .or('consultationMode', 'mode')
  .unknown(true);

const cancelAppointmentSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

const createPaymentOrderSchema = Joi.object({
  appointmentId: Joi.number().integer().positive().optional(),
  appointment_id: Joi.number().integer().positive().optional(),
  gateway: Joi.string().valid('RAZORPAY', 'PHONEPE', 'razorpay', 'phonepe').default('RAZORPAY'),
})
  .or('appointmentId', 'appointment_id')
  .unknown(true);

const verifyPaymentSchema = Joi.object({
  appointmentId: Joi.number().integer().positive().optional(),
  appointment_id: Joi.number().integer().positive().optional(),
  razorpayOrderId: Joi.string().trim().optional(),
  razorpay_order_id: Joi.string().trim().optional(),
  razorpayPaymentId: Joi.string().trim().optional(),
  razorpay_payment_id: Joi.string().trim().optional(),
  razorpaySignature: Joi.string().trim().optional(),
  razorpay_signature: Joi.string().trim().optional(),
  gateway: Joi.string().valid('RAZORPAY', 'PHONEPE', 'razorpay', 'phonepe').optional(),
  merchantTransactionId: Joi.string().trim().optional(),
  merchant_transaction_id: Joi.string().trim().optional(),
})
  .or('appointmentId', 'appointment_id')
  .or('razorpayOrderId', 'razorpay_order_id', 'merchantTransactionId', 'merchant_transaction_id')
  .unknown(true);

module.exports = {
  bookAppointmentSchema,
  cancelAppointmentSchema,
  createPaymentOrderSchema,
  verifyPaymentSchema,
};
