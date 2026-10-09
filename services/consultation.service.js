const db = require('../config/database');
const { NotFoundError, ForbiddenError, BadRequestError, ConflictError } = require('../utils/errors');
const { getPaginationParams } = require('../utils/pagination');
const { AUDIT_ACTIONS, CONSULTATION_STATUS, APPOINTMENT_STATUS } = require('../utils/constants');
const auditService = require('./audit.service');

class ConsultationService {
  async getDoctorConsultations(doctorId, query) {
    const { page, limit, offset } = getPaginationParams(query);
    const conditions = ['c.doctor_id = ?'];
    const params = [doctorId];

    if (query.status) {
      conditions.push('c.status = ?');
      params.push(query.status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `SELECT COUNT(*) as total FROM consultations c ${whereClause}`;
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0].total;

    const dataSql = `
      SELECT c.*, a.appointment_number, a.appointment_date, a.start_time, a.consultation_mode, a.meeting_url,
             p.name as patient_name, p.phone as patient_phone
      FROM consultations c
      JOIN appointments a ON c.appointment_id = a.id
      JOIN patients p ON c.patient_id = p.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(dataSql, [...params, limit, offset]);

    return { items: rows, total, page, limit };
  }

  async getPatientConsultations(patientId, query) {
    const { page, limit, offset } = getPaginationParams(query);
    const conditions = ['c.patient_id = ?'];
    const params = [patientId];

    if (query.status) {
      conditions.push('c.status = ?');
      params.push(query.status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `SELECT COUNT(*) as total FROM consultations c ${whereClause}`;
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0].total;

    const dataSql = `
      SELECT c.*, a.appointment_number, a.appointment_date, a.start_time, a.consultation_mode, a.meeting_url,
             d.name as doctor_name, d.qualification as doctor_qualification
      FROM consultations c
      JOIN appointments a ON c.appointment_id = a.id
      JOIN doctors d ON c.doctor_id = d.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(dataSql, [...params, limit, offset]);

    return { items: rows, total, page, limit };
  }

  async updateNotesAndComplete({ consultationId, doctorId, notes = null, status = null, ip = null, userAgent = null }) {
    const [rows] = await db.query(
      'SELECT * FROM consultations WHERE id = ? AND doctor_id = ?',
      [consultationId, doctorId]
    );

    if (!rows.length) {
      throw new NotFoundError('Consultation not found or not assigned to you');
    }

    const consultation = rows[0];

    const updates = [];
    const params = [];

    if (notes !== null && notes !== undefined) {
      updates.push('doctor_notes = ?');
      params.push(notes);
    }

    if (status) {
      updates.push('status = ?');
      params.push(status);

      if (status === CONSULTATION_STATUS.COMPLETED && !consultation.ended_at) {
        updates.push('ended_at = CURRENT_TIMESTAMP');
      }
    }

    if (!updates.length) {
      return consultation;
    }

    return await db.withTransaction(async (conn) => {
      params.push(consultationId);
      await conn.query(`UPDATE consultations SET ${updates.join(', ')} WHERE id = ?`, params);

      // If marked as completed, sync the appointment status
      if (status === CONSULTATION_STATUS.COMPLETED) {
        await conn.query(
          'UPDATE appointments SET status = ? WHERE id = ?',
          [APPOINTMENT_STATUS.COMPLETED, consultation.appointment_id]
        );

        await conn.query(
          `INSERT INTO appointment_events (appointment_id, from_status, to_status, reason)
           VALUES (?, 'IN_PROGRESS', 'COMPLETED', 'Consultation finished by doctor')`,
          [consultation.appointment_id]
        );

        await auditService.log({
          role: 'DOCTOR',
          action: AUDIT_ACTIONS.CONSULTATION_COMPLETED,
          resourceType: 'consultations',
          resourceId: consultationId,
          ip,
          userAgent,
        });
      }

      const [updatedRows] = await conn.query('SELECT * FROM consultations WHERE id = ?', [consultationId]);
      return updatedRows[0];
    });
  }

  async submitCaseStudy({ consultationId, doctorId, input = {} }) {
    const [rows] = await db.query(`SELECT id, patient_id, doctor_id, status FROM consultations WHERE id=? AND doctor_id=?`, [consultationId, doctorId]);
    if (!rows.length) throw new NotFoundError('Consultation not found or not assigned to you');
    if (rows[0].status !== 'COMPLETED') throw new ConflictError('Complete the consultation before submitting a case study');
    const title = String(input.title || '').trim();
    const clinicalSummary = String(input.clinicalSummary || input.clinical_summary || '').trim();
    if (title.length < 3 || title.length > 255) throw new BadRequestError('Case study title must be between 3 and 255 characters');
    if (clinicalSummary.length < 10) throw new BadRequestError('Clinical summary must be at least 10 characters');
    await db.query(`INSERT INTO consultation_case_studies (consultation_id, doctor_id, patient_id, title, clinical_summary, diagnosis, treatment_plan, follow_up) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), clinical_summary=VALUES(clinical_summary), diagnosis=VALUES(diagnosis), treatment_plan=VALUES(treatment_plan), follow_up=VALUES(follow_up)`, [consultationId, doctorId, rows[0].patient_id, title, clinicalSummary, input.diagnosis || null, input.treatmentPlan || input.treatment_plan || null, input.followUp || input.follow_up || null]);
    const [saved] = await db.query(`SELECT * FROM consultation_case_studies WHERE consultation_id=?`, [consultationId]);
    return saved[0];
  }

  async getCaseStudyForDoctor(consultationId, doctorId) {
    const [rows] = await db.query(`SELECT c.* FROM consultation_case_studies c WHERE c.consultation_id=? AND c.doctor_id=?`, [consultationId, doctorId]);
    if (!rows.length) throw new NotFoundError('Case study not found');
    return rows[0];
  }

  async getCaseStudyForPatient(consultationId, patientId) {
    const [rows] = await db.query(`SELECT c.* FROM consultation_case_studies c WHERE c.consultation_id=? AND c.patient_id=?`, [consultationId, patientId]);
    if (!rows.length) throw new NotFoundError('Case study not found');
    return rows[0];
  }
}

module.exports = new ConsultationService();
