const db = require('../config/database');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../utils/errors');
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
}

module.exports = new ConsultationService();
