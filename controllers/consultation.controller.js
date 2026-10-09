const consultationService = require('../services/consultation.service');
const { success, paginated } = require('../utils/response');

class ConsultationController {
  async getDoctorConsultations(req, res, next) {
    try {
      const result = await consultationService.getDoctorConsultations(req.user.doctorId, req.query);
      return paginated(res, result.items, result.total, result.page, result.limit);
    } catch (err) {
      next(err);
    }
  }

  async getPatientConsultations(req, res, next) {
    try {
      const result = await consultationService.getPatientConsultations(req.user.patientId, req.query);
      return paginated(res, result.items, result.total, result.page, result.limit);
    } catch (err) {
      next(err);
    }
  }

  async updateNotesAndComplete(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { id } = req.params;
      const { notes, status } = req.body;

      const updated = await consultationService.updateNotesAndComplete({
        consultationId: id,
        doctorId: req.user.doctorId,
        notes,
        status,
        ip,
        userAgent,
      });

      return success(res, updated, 'Consultation updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async submitCaseStudy(req, res, next) {
    try { return success(res, await consultationService.submitCaseStudy({ consultationId: req.params.id, doctorId: req.user.doctorId, input: req.body }), 'Case study submitted'); }
    catch (err) { next(err); }
  }

  async getDoctorCaseStudy(req, res, next) {
    try { return success(res, await consultationService.getCaseStudyForDoctor(req.params.id, req.user.doctorId), 'Case study retrieved'); }
    catch (err) { next(err); }
  }

  async getPatientCaseStudy(req, res, next) {
    try { return success(res, await consultationService.getCaseStudyForPatient(req.params.id, req.user.patientId), 'Case study retrieved'); }
    catch (err) { next(err); }
  }
}

module.exports = new ConsultationController();
