const medicalRecordService = require('../services/medical-record.service');
const doctorService = require('../services/doctor.service');
const storageService = require('../services/storage.service');
const auditService = require('../services/audit.service');
const { success, created } = require('../utils/response');
const { ForbiddenError, NotFoundError } = require('../utils/errors');
const { AUDIT_ACTIONS } = require('../utils/constants');

class MedicalRecordController {
  async uploadRecord(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await medicalRecordService.uploadRecord({
        patientId: req.user.patientId,
        userId: req.user.id,
        file: req.file,
        recordType: req.body.recordType,
        ip,
        userAgent,
      });

      return created(res, result, 'Medical record uploaded successfully');
    } catch (err) {
      next(err);
    }
  }

  async listOwnRecords(req, res, next) {
    try {
      const records = await medicalRecordService.getPatientRecords(req.user.patientId);
      return success(res, records, 'Medical records retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async downloadRecord(req, res, next) {
    try {
      const recordId = req.params.id;
      const record = await medicalRecordService.getRecordById(recordId);

      // Verify access permission:
      // Either patient owns it, OR doctor has active relationship with this patient
      let authorized = false;

      if (req.user.role === 'PATIENT' && req.user.patientId === record.patient_id) {
        authorized = true;
      } else if (req.user.role === 'DOCTOR') {
        authorized = await doctorService.canAccessPatient(req.user.doctorId, record.patient_id);
      }

      if (!authorized) {
        throw new ForbiddenError('You are not authorized to download this medical record');
      }

      // Stream private file
      const stream = storageService.createReadStream(record.storage_key);

      await auditService.log({
        userId: req.user.id,
        role: req.user.role,
        action: AUDIT_ACTIONS.PATIENT_RECORD_DOWNLOADED,
        resourceType: 'medical_records',
        resourceId: recordId,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.setHeader('Content-Type', record.mime_type || 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(record.original_filename)}"`);
      res.setHeader('Content-Length', record.file_size);

      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  async deleteRecord(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await medicalRecordService.deleteRecord(
        req.user.patientId,
        req.params.id,
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

module.exports = new MedicalRecordController();
