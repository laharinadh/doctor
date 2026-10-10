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

    const patient = rows[0];
    return {
      ...patient,
      height: patient.height_cm,
      weight: patient.weight_kg,
    };
  }

  async updateProfile(patientId, updateData) {
    await this.getProfile(patientId);

    const data = { ...updateData };
    if (data.height !== undefined && data.height_cm === undefined) {
      data.height_cm = data.height === '' || data.height === null ? null : Number(data.height);
    }
    if (data.weight !== undefined && data.weight_kg === undefined) {
      data.weight_kg = data.weight === '' || data.weight === null ? null : Number(data.weight);
    }

    const allowedFields = ['name', 'email', 'height_cm', 'weight_kg'];
    const updates = [];
    const params = [];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(data[field]);
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

  async getPayments(patientId, query = {}) {
    const { page, limit, offset } = getPaginationParams(query);
    const [countRows] = await db.query('SELECT COUNT(*) AS total FROM payments WHERE patient_id = ?', [patientId]);
    const [rows] = await db.query(`
      SELECT p.id, p.gateway, p.gateway_order_id AS ref, p.gateway_payment_id,
             p.amount, p.currency, p.status, p.created_at,
             a.id AS appointment_id, a.appointment_number,
             a.appointment_date AS date, d.name AS doctor
      FROM payments p
      LEFT JOIN appointments a ON a.id = p.appointment_id
      LEFT JOIN doctors d ON d.id = a.doctor_id
      WHERE p.patient_id = ?
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, [patientId, limit, offset]);
    return { items: rows, total: countRows[0].total, page, limit };
  }
}

module.exports = new PatientService();
