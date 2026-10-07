const { BadRequestError } = require('../utils/errors');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const dataToValidate = req[source];
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true, // Whitelists only declared fields
      convert: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, ''),
      }));
      return next(new BadRequestError('Validation failed', details));
    }

    req[source] = value;
    next();
  };
}

module.exports = validate;
