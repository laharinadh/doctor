const scheduleService = require('../services/schedule.service');
const { success, created } = require('../utils/response');

class ScheduleController {
  async getSchedules(req, res, next) {
    try {
      const schedules = await scheduleService.getDoctorSchedules(req.user.doctorId);
      return success(res, schedules, 'Schedules fetched successfully');
    } catch (err) {
      next(err);
    }
  }

  async upsertSchedule(req, res, next) {
    try {
      const schedule = await scheduleService.upsertSchedule(req.user.doctorId, req.body);
      return success(res, schedule, 'Schedule saved successfully');
    } catch (err) {
      next(err);
    }
  }

  async deleteSchedule(req, res, next) {
    try {
      const result = await scheduleService.deleteSchedule(req.user.doctorId, req.params.id);
      return success(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  async getLeaves(req, res, next) {
    try {
      const leaves = await scheduleService.getDoctorLeaves(req.user.doctorId);
      return success(res, leaves, 'Leaves fetched successfully');
    } catch (err) {
      next(err);
    }
  }

  async createLeave(req, res, next) {
    try {
      const leave = await scheduleService.createLeave(req.user.doctorId, req.body);
      return created(res, leave, 'Leave requested/created successfully');
    } catch (err) {
      next(err);
    }
  }

  async cancelLeave(req, res, next) {
    try {
      const result = await scheduleService.cancelLeave(req.user.doctorId, req.params.id);
      return success(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  async getSlotsForDate(req, res, next) {
    try {
      const doctorId = parseInt(req.params.id, 10);
      const { date } = req.query;
      const slots = await scheduleService.computeAvailableSlots(doctorId, date);
      return success(res, slots, 'Available slots computed successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ScheduleController();
