const Joi = require('joi');

const rejectDoctorSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

const updatePlatformSettingsSchema = Joi.object({
  platformFee: Joi.number().min(0).max(10000).precision(2).required(),
});

module.exports = {
  rejectDoctorSchema,
  updatePlatformSettingsSchema,
};
