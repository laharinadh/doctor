const appointmentService = require('../services/appointment.service');
const { created, success } = require('../utils/response');

class AppointmentController {
  async bookAppointment(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const appointment = await appointmentService.holdAppointment({
        patientId: req.user.patientId,
        changedByUserId: req.user.id,
        ...req.body,
        ip,
        userAgent,
      });

      return created(
        res,
        appointment,
        'Appointment slot held for 10 minutes. Please complete the platform fee payment to confirm booking.'
      );
    } catch (err) {
      next(err);
    }
  }

  async cancelAppointment(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { id } = req.params;
      const { reason } = req.body;

      const result = await appointmentService.cancelAppointment(
        req.user.patientId,
        id,
        reason,
        req.user.id,
        ip,
        userAgent
      );

      return success(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AppointmentController();
