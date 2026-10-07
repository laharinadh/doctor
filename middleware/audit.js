const auditService = require('../services/audit.service');

function audit(action, resourceType = null, extractResourceId = null) {
  return (req, res, next) => {
    res.on('finish', () => {
      // Only log successful modifications or actions
      if (res.statusCode >= 200 && res.statusCode < 400) {
        let resourceId = null;
        if (typeof extractResourceId === 'function') {
          resourceId = extractResourceId(req, res);
        } else if (extractResourceId && req.params[extractResourceId]) {
          resourceId = req.params[extractResourceId];
        }

        auditService.log({
          userId: req.user ? req.user.id : null,
          role: req.user ? req.user.role : null,
          action,
          resourceType,
          resourceId,
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
        });
      }
    });
    next();
  };
}

module.exports = audit;
