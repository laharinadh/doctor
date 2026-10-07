const Joi = require('joi');

const createDepartmentSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().max(1000).allow(null, '').optional(),
});

const updateDepartmentSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  description: Joi.string().trim().max(1000).allow(null, '').optional(),
  status: Joi.string().valid('ACTIVE', 'INACTIVE').optional(),
});

module.exports = {
  createDepartmentSchema,
  updateDepartmentSchema,
};
