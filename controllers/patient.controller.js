const patientService = require('../services/patient.service');
const doctorService = require('../services/doctor.service');
const scheduleService = require('../services/schedule.service');
const departmentService = require('../services/department.service');
const { success, paginated } = require('../utils/response');

class PatientController {
  async getProfile(req, res, next) {
    try {
      const profile = await patientService.getProfile(req.user.patientId);
      return success(res, profile, 'Patient profile retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const updated = await patientService.updateProfile(req.user.patientId, req.body);
      return success(res, updated, 'Patient profile updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async getMyAppointments(req, res, next) {
    try {
      const result = await patientService.getMyAppointments(req.user.patientId, req.query);
      return paginated(res, result.items, result.total, result.page, result.limit);
    } catch (err) {
      next(err);
    }
  }

  async getAppointmentDetail(req, res, next) {
    try {
      const appointment = await patientService.getAppointmentDetail(req.user.patientId, req.params.id);
      return success(res, appointment, 'Appointment details retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async browseDoctors(req, res, next) {
    try {
      const result = await doctorService.listPublicApprovedDoctors(req.query);
      return paginated(res, result.items, result.total, result.page, result.limit);
    } catch (err) {
      next(err);
    }
  }

  async getDoctorDetail(req, res, next) {
    try {
      const doctor = await doctorService.getPublicDoctorDetail(req.params.id);
      return success(res, doctor, 'Doctor details retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getDoctorSlots(req, res, next) {
    try {
      const doctorId = parseInt(req.params.id, 10);
      const { date } = req.query;
      const slots = await scheduleService.computeAvailableSlots(doctorId, date);
      return success(res, slots, 'Available slots calculated successfully');
    } catch (err) {
      next(err);
    }
  }

  async browseDepartments(req, res, next) {
    try {
      const departments = await departmentService.getAll({ status: 'ACTIVE' });
      return success(res, departments, 'Departments fetched successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PatientController();
