const Joi = require('joi');
const { ROLES } = require('../utils/constants');

const phonePattern = /^\+[1-9]\d{6,14}$/;

const sendOtpSchema = Joi.object({
  phone: Joi.string().trim().pattern(phonePattern).optional(),
  phoneNumber: Joi.string().trim().pattern(phonePattern).optional(),
  phone_number: Joi.string().trim().pattern(phonePattern).optional(),
}).or('phone', 'phoneNumber', 'phone_number').unknown(true);

const verifyOtpSchema = Joi.object({
  idToken: Joi.string().trim().optional(),
  phone: Joi.string().trim().pattern(phonePattern).optional(),
  phoneNumber: Joi.string().trim().pattern(phonePattern).optional(),
  phone_number: Joi.string().trim().pattern(phonePattern).optional(),
  otp: Joi.string().trim().optional(),
  role: Joi.string().valid(ROLES.PATIENT, ROLES.DOCTOR).default(ROLES.PATIENT),
  name: Joi.string().trim().min(2).max(100).default('User'),
  email: Joi.string().email().trim().allow(null, '').optional(),
}).unknown(true);

module.exports = {
  sendOtpSchema,
  verifyOtpSchema,
};
