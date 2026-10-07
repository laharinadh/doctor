const Joi = require('joi');
const { ROLES } = require('../utils/constants');

const sendOtpSchema = Joi.object({
  phone: Joi.string()
    .trim()
    .pattern(/^\+[1-9]\d{7,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be in E.164 international format (e.g. +919876543210)',
    }),
});

const verifyOtpSchema = Joi.object({
  idToken: Joi.string().trim().optional(),
  phone: Joi.string().trim().pattern(/^\+[1-9]\d{7,14}$/).optional(),
  role: Joi.string().valid(ROLES.PATIENT, ROLES.DOCTOR).default(ROLES.PATIENT),
  name: Joi.string().trim().min(2).max(100).default('User'),
  email: Joi.string().email().trim().allow(null, '').optional(),
});

module.exports = {
  sendOtpSchema,
  verifyOtpSchema,
};
