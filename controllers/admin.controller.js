const adminService = require('../services/admin.service');
const doctorVerificationService = require('../services/doctor-verification.service');
const platformSettingsService = require('../services/platform-settings.service');
const auditService = require('../services/audit.service');
const { success, created, paginated } = require('../utils/response');

class AdminController {
  async getDashboard(req, res, next) {
    try {
      const metrics = await adminService.getDashboardMetrics();
      return success(res, metrics, 'Admin dashboard metrics retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // DOCTORS
  // ==========================================

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

  async createDoctor(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const doctor = await adminService.createDoctor(req.body, req.user.id, ip, userAgent);
      return created(res, doctor, 'Doctor profile created successfully');
    } catch (err) {
      next(err);
    }
  }

  async bulkCreateDoctors(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const payload = req.body.doctors || req.body;
      const result = await adminService.bulkCreateDoctors(payload, req.user.id, ip, userAgent);
      return created(res, result, `Bulk import finished: ${result.createdCount} doctors added, ${result.skippedCount} skipped`);
    } catch (err) {
      next(err);
    }
  }

  async updateDoctor(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const doctor = await adminService.updateDoctor(req.params.id, req.body, req.user.id, ip, userAgent);
      return success(res, doctor, 'Doctor profile updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deleteDoctor(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await adminService.deleteDoctor(req.params.id, req.user.id, ip, userAgent);
      return success(res, result, result.message);
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

  // ==========================================
  // PATIENTS
  // ==========================================

  async listPatients(req, res, next) {
    try {
      const result = await adminService.listPatients(req.query);
      return paginated(res, result.items, result.total, result.page, result.limit);
    } catch (err) {
      next(err);
    }
  }

  async getPatientDetail(req, res, next) {
    try {
      const patient = await adminService.getPatientDetail(req.params.id);
      return success(res, patient, 'Patient details retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async createPatient(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const patient = await adminService.createPatient(req.body, req.user.id, ip, userAgent);
      return created(res, patient, 'Patient profile created successfully');
    } catch (err) {
      next(err);
    }
  }

  async bulkCreatePatients(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const payload = req.body.patients || req.body;
      const result = await adminService.bulkCreatePatients(payload, req.user.id, ip, userAgent);
      return created(res, result, `Bulk import finished: ${result.createdCount} patients added, ${result.skippedCount} skipped`);
    } catch (err) {
      next(err);
    }
  }

  async updatePatient(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const patient = await adminService.updatePatient(req.params.id, req.body, req.user.id, ip, userAgent);
      return success(res, patient, 'Patient profile updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deletePatient(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await adminService.deletePatient(req.params.id, req.user.id, ip, userAgent);
      return success(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // APPOINTMENTS
  // ==========================================

  async listAppointments(req, res, next) {
    try {
      const result = await adminService.listAppointments(req.query);
      return paginated(res, result.items, result.total, result.page, result.limit);
    } catch (err) {
      next(err);
    }
  }

  async getAppointmentDetail(req, res, next) {
    try {
      const appointment = await adminService.getAppointmentDetail(req.params.id);
      return success(res, appointment, 'Appointment details retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async createAppointment(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const appointment = await adminService.createAppointment(req.body, req.user.id, ip, userAgent);
      return created(res, appointment, 'Appointment scheduled successfully');
    } catch (err) {
      next(err);
    }
  }

  async updateAppointment(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const appointment = await adminService.updateAppointment(req.params.id, req.body, req.user.id, ip, userAgent);
      return success(res, appointment, 'Appointment updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deleteAppointment(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await adminService.deleteAppointment(req.params.id, req.user.id, ip, userAgent);
      return success(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // PAYMENTS
  // ==========================================

  async listPayments(req, res, next) {
    try {
      const result = await adminService.listPayments(req.query);
      return paginated(res, result.items, result.total, result.page, result.limit);
    } catch (err) {
      next(err);
    }
  }

  async updatePayment(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const updated = await adminService.updatePayment(req.params.id, req.body, req.user.id, ip, userAgent);
      return success(res, updated, 'Payment status updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deletePayment(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await adminService.deletePayment(req.params.id, req.user.id, ip, userAgent);
      return success(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // SETTINGS & LOGS
  // ==========================================

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

