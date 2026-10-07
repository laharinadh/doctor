const Joi = require('joi');

const updatePatientProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  email: Joi.string().email().trim().allow(null, '').optional(),
  height_cm: Joi.number().min(30).max(250).precision(1).allow(null).optional(),
  weight_kg: Joi.number().min(1).max(300).precision(1).allow(null).optional(),
});

module.exports = {
  updatePatientProfileSchema,
};
