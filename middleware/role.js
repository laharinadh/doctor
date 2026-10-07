const { ForbiddenError, UnauthorizedError } = require('../utils/errors');

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`Access denied. Allowed roles: ${roles.join(', ')}`));
    }

    next();
  };
}

module.exports = authorize;
