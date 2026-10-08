const appointmentService = require('../services/appointment.service');
const { created, success } = require('../utils/response');

class AppointmentController {
  async bookAppointment(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const raw = req.body || {};
      const doctorId = raw.doctorId || raw.doctor_id;
      const appointmentDate = raw.appointmentDate || raw.date;
      let startTime = raw.startTime || raw.start_time;
      if (startTime && startTime.length === 5) startTime += ':00';
      let consultationMode = raw.consultationMode || raw.mode || 'VIDEO';
      if (consultationMode === 'IN_PERSON') consultationMode = 'FACE_TO_FACE';

      const appointment = await appointmentService.holdAppointment({
        patientId: req.user.patientId,
        changedByUserId: req.user.id,
        doctorId,
        appointmentDate,
        startTime,
        consultationMode,
        meetingProvider: raw.meetingProvider,
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
