const adminService = require('../services/admin.service');
const doctorVerificationService = require('../services/doctor-verification.service');
const platformSettingsService = require('../services/platform-settings.service');
const auditService = require('../services/audit.service');
const { success, paginated } = require('../utils/response');

class AdminController {
  async getDashboard(req, res, next) {
    try {
      const metrics = await adminService.getDashboardMetrics();
      return success(res, metrics, 'Admin dashboard metrics retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async listDoctors(req, res, next) {
    try {
      const result = await adminService.listDoctors(req.query);
      return paginated(res, result.items, result.total, result.page, result.limit);
    } catch (err) {
      next(err);
    }
  }

  async getDoctorDetail(req, res, next) {
    try {
      const doctor = await adminService.getDoctorDetail(req.params.id);
      const history = await doctorVerificationService.getDoctorVerificationHistory(req.params.id);
      return success(res, { ...doctor, verificationHistory: history }, 'Doctor details retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async verifyDoctor(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await doctorVerificationService.approveDoctor(req.params.id, req.user.id, ip, userAgent);
      return success(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  async rejectDoctor(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { reason } = req.body;
      const result = await doctorVerificationService.rejectDoctor(req.params.id, req.user.id, reason, ip, userAgent);
      return success(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  async suspendDoctor(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await doctorVerificationService.suspendDoctor(req.params.id, req.user.id, ip, userAgent);
      return success(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  async listPatients(req, res, next) {
    try {
      const result = await adminService.listPatients(req.query);
      return paginated(res, result.items, result.total, result.page, result.limit);
    } catch (err) {
      next(err);
    }
  }

  async listAppointments(req, res, next) {
    try {
      const result = await adminService.listAppointments(req.query);
      return paginated(res, result.items, result.total, result.page, result.limit);
    } catch (err) {
      next(err);
    }
  }

  async listPayments(req, res, next) {
    try {
      const result = await adminService.listPayments(req.query);
      return paginated(res, result.items, result.total, result.page, result.limit);
    } catch (err) {
      next(err);
    }
  }

  async getPlatformSettings(req, res, next) {
    try {
      const settings = await platformSettingsService.getSettings();
      return success(res, settings, 'Platform settings retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async updatePlatformSettings(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { platformFee } = req.body;
      const updated = await platformSettingsService.updatePlatformFee(platformFee, req.user.id, ip, userAgent);
      return success(res, updated, 'Platform settings updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async getAuditLogs(req, res, next) {
    try {
      const { page, limit, action, userId } = req.query;
      const result = await auditService.getLogs({ page, limit, action, userId });
      return paginated(res, result.items, result.total, result.page, result.limit);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();
