const notificationService = require('../services/notification.service');
const { success, paginated } = require('../utils/response');

class NotificationController {
  async getMyNotifications(req, res, next) {
    try {
      const result = await notificationService.getUserNotifications(req.user.id, req.query);
      return paginated(res, result.items, result.total, result.page, result.limit);
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const result = await notificationService.markAsRead(req.params.id, req.user.id);
      return success(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const result = await notificationService.markAllAsRead(req.user.id);
      return success(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NotificationController();
