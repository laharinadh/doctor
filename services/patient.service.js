const db = require('../config/database');
const { NotFoundError } = require('../utils/errors');
const { getPaginationParams } = require('../utils/pagination');

class PatientService {
  async getProfile(patientId) {
    const [rows] = await db.query(`
      SELECT p.*, u.phone, u.email as user_email
      FROM patients p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [patientId]);

    if (!rows.length) {
      throw new NotFoundError('Patient profile not found');
    }

    return rows[0];
  }

  async updateProfile(patientId, updateData) {
    await this.getProfile(patientId);

    const allowedFields = ['name', 'email', 'height_cm', 'weight_kg'];
    const updates = [];
    const params = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(updateData[field]);
      }
    }

    if (updates.length > 0) {
      params.push(patientId);
      await db.query(`UPDATE patients SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    return this.getProfile(patientId);
  }

  async getMyAppointments(patientId, query) {
    const { page, limit, offset } = getPaginationParams(query);
    const conditions = ['a.patient_id = ?'];
    const params = [patientId];

    if (query.status) {
      conditions.push('a.status = ?');
      params.push(query.status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `SELECT COUNT(*) as total FROM appointments a ${whereClause}`;
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0].total;

    const dataSql = `
      SELECT a.*, d.name as doctor_name, d.qualification as doctor_qualification,
             d.profile_photo_url as doctor_photo, dept.name as department_name,
             p.status as payment_status, p.gateway_payment_id
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN departments dept ON a.department_id = dept.id
      LEFT JOIN payments p ON a.payment_id = p.id
      ${whereClause}
      ORDER BY a.appointment_date DESC, a.start_time DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(dataSql, [...params, limit, offset]);

    return { items: rows, total, page, limit };
  }

  async getAppointmentDetail(patientId, appointmentId) {
    const [rows] = await db.query(`
      SELECT a.*, d.name as doctor_name, d.qualification as doctor_qualification,
             d.bio as doctor_bio, d.profile_photo_url as doctor_photo,
             dept.name as department_name,
             p.status as payment_status, p.gateway_payment_id, p.amount as paid_amount,
             c.status as consultation_status, c.started_at, c.ended_at
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN departments dept ON a.department_id = dept.id
      LEFT JOIN payments p ON a.payment_id = p.id
      LEFT JOIN consultations c ON a.id = c.appointment_id
      WHERE a.id = ? AND a.patient_id = ?
    `, [appointmentId, patientId]);

    if (!rows.length) {
      throw new NotFoundError('Appointment not found');
    }

    return rows[0];
  }
}

module.exports = new PatientService();
