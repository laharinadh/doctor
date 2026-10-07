const doctorService = require('../services/doctor.service');
const doctorVerificationService = require('../services/doctor-verification.service');
const medicalRecordService = require('../services/medical-record.service');
const { success, paginated, created } = require('../utils/response');
const { ForbiddenError } = require('../utils/errors');

class DoctorController {
  async getProfile(req, res, next) {
    try {
      const profile = await doctorService.getProfile(req.user.doctorId);
      return success(res, profile, 'Doctor profile retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const updated = await doctorService.updateProfile(req.user.doctorId, req.body);
      return success(res, updated, 'Doctor profile updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async submitVerification(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await doctorVerificationService.submitVerification({
        doctorId: req.user.doctorId,
        ...req.body,
        ip,
        userAgent,
      });
      return created(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  async getVerificationStatus(req, res, next) {
    try {
      const history = await doctorVerificationService.getDoctorVerificationHistory(req.user.doctorId);
      const currentDoctor = await doctorService.getProfile(req.user.doctorId);
      return success(res, {
        currentStatus: currentDoctor.verification_status,
        history,
      }, 'Verification history retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getAppointments(req, res, next) {
    try {
      const result = await doctorService.getDoctorAppointments(req.user.doctorId, req.query);
      return paginated(res, result.items, result.total, result.page, result.limit);
    } catch (err) {
      next(err);
    }
  }

  async updateAppointmentStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;
      const result = await doctorService.updateAppointmentStatus(
        req.user.doctorId,
        id,
        status,
        reason,
        req.user.id
      );
      return success(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  async getAuthorizedPatients(req, res, next) {
    try {
      const patients = await doctorService.getAuthorizedPatients(req.user.doctorId);
      return success(res, patients, 'Patients retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getPatientMedicalRecords(req, res, next) {
    try {
      const patientId = parseInt(req.params.patientId, 10);
      const canAccess = await doctorService.canAccessPatient(req.user.doctorId, patientId);
      if (!canAccess) {
        throw new ForbiddenError('You do not have an active consultation relationship with this patient');
      }

      const records = await medicalRecordService.getPatientRecords(patientId);
      return success(res, records, 'Patient medical records retrieved successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DoctorController();
