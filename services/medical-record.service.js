const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const config = require('../config');
const storageService = require('./storage.service');
const auditService = require('./audit.service');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');
const { AUDIT_ACTIONS } = require('../utils/constants');

class MedicalRecordService {
  validatePdfMagicBytes(buffer) {
    if (!buffer || buffer.length < 5) return false;
    // PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
    const header = buffer.subarray(0, 5).toString('ascii');
    return header.startsWith('%PDF-');
  }

  async uploadRecord({ patientId, userId, file, recordType = 'Medical Report', ip = null, userAgent = null }) {
    if (!file) {
      throw new BadRequestError('No file uploaded');
    }

    // 1. Validate file size (<= 100 KB)
    const maxBytes = config.storage.maxRecordSizeBytes || 102400;
    if (file.size > maxBytes) {
      throw new BadRequestError(`Medical record file exceeds maximum size limit of ${Math.round(maxBytes / 1024)} KB`);
    }

    // 2. Validate MIME type
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestError('Only PDF documents are permitted for medical records');
    }

    // 3. Validate Magic Bytes (%PDF-)
    if (!this.validatePdfMagicBytes(file.buffer)) {
      throw new BadRequestError('Corrupted or invalid PDF file header (magic byte check failed)');
    }

    // 4. Generate private storage key
    const fileId = uuidv4();
    const storageKey = `medical-records/${patientId}/${fileId}.pdf`;

    // 5. Save to private filesystem storage
    await storageService.saveBuffer(storageKey, file.buffer);

    // 6. Record metadata in MySQL
    const [res] = await db.query(
      `INSERT INTO medical_records 
        (patient_id, uploaded_by, record_type, original_filename, mime_type, file_size, storage_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId,
        userId,
        recordType,
        file.originalname,
        file.mimetype,
        file.size,
        storageKey,
      ]
    );

    const recordId = res.insertId;

    await auditService.log({
      userId,
      role: 'PATIENT',
      action: AUDIT_ACTIONS.PATIENT_RECORD_UPLOADED,
      resourceType: 'medical_records',
      resourceId: recordId,
      metadata: { originalFilename: file.originalname, fileSize: file.size },
      ip,
      userAgent,
    });

    const [createdRows] = await db.query('SELECT * FROM medical_records WHERE id = ?', [recordId]);
    return createdRows[0];
  }

  async getPatientRecords(patientId) {
    const [rows] = await db.query(
      `SELECT id, patient_id, uploaded_by, record_type, original_filename, mime_type, file_size, created_at
       FROM medical_records
       WHERE patient_id = ?
       ORDER BY created_at DESC`,
      [patientId]
    );
    return rows;
  }

  async getRecordById(recordId) {
    const [rows] = await db.query('SELECT * FROM medical_records WHERE id = ?', [recordId]);
    if (!rows.length) {
      throw new NotFoundError('Medical record not found');
    }
    return rows[0];
  }

  maskPii(value, type = 'phone') {
    if (!value) return '';
    if (type === 'phone') {
      return value.replace(/(\+?\d{2,3})?(\d{2})\d{4,6}(\d{2})/, '$1$2******$3');
    }
    if (type === 'email') {
      const parts = value.split('@');
      if (parts.length !== 2) return '***';
      return `${parts[0].charAt(0)}***@${parts[1]}`;
    }
    return '***';
  }

  async validateAccessPermission({ recordId, user, ip = null, userAgent = null }) {
    const record = await this.getRecordById(recordId);

    if (user.role === 'PATIENT') {
      if (record.patient_id !== user.patientId) {
        throw new ForbiddenError('Access Denied: You do not own this medical record');
      }
    } else if (user.role === 'DOCTOR') {
      // Compliance check: Doctor must have an active or completed consultation/appointment relationship
      const [relationships] = await db.query(
        `SELECT id FROM appointments 
         WHERE patient_id = ? AND doctor_id = ? AND status IN ('CONFIRMED', 'COMPLETED')`,
        [record.patient_id, user.doctorId]
      );

      if (!relationships.length) {
        throw new ForbiddenError('Access Denied: No active patient-doctor consultation consent or appointment relationship found');
      }
    } else if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Access Denied: Unauthorized role for medical records');
    }

    // HIPAA/DISHA Auditable access event
    await auditService.log({
      userId: user.id,
      role: user.role,
      action: 'PATIENT_RECORD_ACCESSED',
      resourceType: 'medical_records',
      resourceId: record.id,
      metadata: { patientId: record.patient_id, accessedByRole: user.role },
      ip,
      userAgent,
    });

    return record;
  }

  async deleteRecord(patientId, recordId, userId, ip = null, userAgent = null) {
    const record = await this.getRecordById(recordId);

    if (record.patient_id !== patientId) {
      throw new ForbiddenError('You can only delete your own medical records');
    }

    await storageService.deleteFile(record.storage_key);
    await db.query('DELETE FROM medical_records WHERE id = ?', [recordId]);

    await auditService.log({
      userId,
      role: 'PATIENT',
      action: AUDIT_ACTIONS.PATIENT_RECORD_DELETED,
      resourceType: 'medical_records',
      resourceId: recordId,
      ip,
      userAgent,
    });

    return { success: true, message: 'Medical record deleted successfully' };
  }
}

module.exports = new MedicalRecordService();
