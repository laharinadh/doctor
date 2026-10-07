const Joi = require('joi');

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

const upsertScheduleSchema = Joi.object({
  dayOfWeek: Joi.number().integer().min(0).max(6).required()
    .messages({ 'number.base': 'dayOfWeek must be an integer between 0 (Sunday) and 6 (Saturday)' }),
  startTime: Joi.string().pattern(timePattern).required()
    .messages({ 'string.pattern.base': 'startTime must be in HH:MM or HH:MM:SS format' }),
  endTime: Joi.string().pattern(timePattern).required()
    .messages({ 'string.pattern.base': 'endTime must be in HH:MM or HH:MM:SS format' }),
  slotDurationMinutes: Joi.number().integer().valid(15, 20, 30, 45, 60).default(30),
  status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE'),
});

const createLeaveSchema = Joi.object({
  startDatetime: Joi.date().iso().required(),
  endDatetime: Joi.date().iso().greater(Joi.ref('startDatetime')).required()
    .messages({ 'date.greater': 'endDatetime must be after startDatetime' }),
  reason: Joi.string().trim().max(500).allow(null, '').optional(),
});

module.exports = {
  upsertScheduleSchema,
  createLeaveSchema,
};
