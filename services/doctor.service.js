const db = require('../config/database');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
const { getPaginationParams } = require('../utils/pagination');
const { DOCTOR_VERIFICATION_STATUS, USER_STATUS, APPOINTMENT_STATUS } = require('../utils/constants');

class DoctorService {
  async getProfile(doctorId) {
    const [rows] = await db.query(`
      SELECT d.*, dept.name as department_name, u.phone, u.email as user_email
      FROM doctors d
      LEFT JOIN departments dept ON d.department_id = dept.id
      JOIN users u ON d.user_id = u.id
      WHERE d.id = ?
    `, [doctorId]);

    if (!rows.length) {
      throw new NotFoundError('Doctor profile not found');
    }

    return rows[0];
  }

  async updateProfile(doctorId, updateData) {
    await this.getProfile(doctorId);

    const allowedFields = [
      'name',
      'email',
      'department_id',
      'qualification',
      'experience_years',
      'bio',
      'consultation_fee',
      'profile_photo_url',
      'profile_video_url',
    ];

    const updates = [];
    const params = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(updateData[field]);
      }
    }

    if (updates.length > 0) {
      params.push(doctorId);
      await db.query(`UPDATE doctors SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    return this.getProfile(doctorId);
  }

  async listPublicApprovedDoctors(query) {
    const { page, limit, offset } = getPaginationParams(query);
    const conditions = [
      'd.verification_status = ?',
      'd.status = ?',
    ];
    const params = [DOCTOR_VERIFICATION_STATUS.APPROVED, USER_STATUS.ACTIVE];

    if (query.departmentId) {
      conditions.push('d.department_id = ?');
      params.push(query.departmentId);
    }

    if (query.search) {
      conditions.push('(d.name LIKE ? OR dept.name LIKE ? OR d.qualification LIKE ?)');
      const term = `%${query.search}%`;
      params.push(term, term, term);
    }

    if (query.minExperience) {
      conditions.push('d.experience_years >= ?');
      params.push(parseInt(query.minExperience, 10));
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `
      SELECT COUNT(*) as total 
      FROM doctors d
      LEFT JOIN departments dept ON d.department_id = dept.id
      ${whereClause}
    `;
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0].total;

    const dataSql = `
      SELECT d.id, d.name, d.qualification, d.experience_years, d.bio, d.consultation_fee,
             d.profile_photo_url, d.profile_video_url, d.department_id,
             dept.name as department_name
      FROM doctors d
      LEFT JOIN departments dept ON d.department_id = dept.id
      ${whereClause}
      ORDER BY d.experience_years DESC, d.name ASC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(dataSql, [...params, limit, offset]);

    return { items: rows, total, page, limit };
  }

  async getPublicDoctorDetail(doctorId) {
    const [rows] = await db.query(`
      SELECT d.id, d.name, d.qualification, d.experience_years, d.bio, d.consultation_fee,
             d.profile_photo_url, d.profile_video_url, d.department_id,
             dept.name as department_name, dept.description as department_description
      FROM doctors d
      LEFT JOIN departments dept ON d.department_id = dept.id
      WHERE d.id = ? AND d.verification_status = 'APPROVED' AND d.status = 'ACTIVE'
    `, [doctorId]);

    if (!rows.length) {
      throw new NotFoundError('Doctor not found or not currently active');
    }

    return rows[0];
  }

  async getDoctorAppointments(doctorId, query) {
    const { page, limit, offset } = getPaginationParams(query);
    const conditions = ['a.doctor_id = ?'];
    const params = [doctorId];

    if (query.status) {
      conditions.push('a.status = ?');
      params.push(query.status);
    }
    if (query.date) {
      conditions.push('a.appointment_date = ?');
      params.push(query.date);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `SELECT COUNT(*) as total FROM appointments a ${whereClause}`;
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0].total;

    const dataSql = `
      SELECT a.*, p.name as patient_name, p.phone as patient_phone,
             c.id as consultation_id, c.status as consultation_status, c.doctor_notes
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      LEFT JOIN consultations c ON a.id = c.appointment_id
      ${whereClause}
      ORDER BY a.appointment_date DESC, a.start_time ASC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(dataSql, [...params, limit, offset]);

    return { items: rows, total, page, limit };
  }

  async updateAppointmentStatus(doctorId, appointmentId, newStatus, reason = null, changedByUserId = null) {
    const [appointments] = await db.query(
      'SELECT * FROM appointments WHERE id = ? AND doctor_id = ?',
      [appointmentId, doctorId]
    );

    if (!appointments.length) {
      throw new NotFoundError('Appointment not found or not assigned to you');
    }

    const appointment = appointments[0];
    const oldStatus = appointment.status;

    return await db.withTransaction(async (conn) => {
      await conn.query(
        'UPDATE appointments SET status = ?, cancellation_reason = COALESCE(?, cancellation_reason) WHERE id = ?',
        [newStatus, reason, appointmentId]
      );

      await conn.query(
        `INSERT INTO appointment_events (appointment_id, from_status, to_status, changed_by, reason)
         VALUES (?, ?, ?, ?, ?)`,
        [appointmentId, oldStatus, newStatus, changedByUserId, reason]
      );

      // If status changed to IN_PROGRESS or COMPLETED, reflect in consultations table
      if (newStatus === APPOINTMENT_STATUS.IN_PROGRESS) {
        await conn.query(
          `INSERT INTO consultations (appointment_id, patient_id, doctor_id, started_at, status)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'ACTIVE')
           ON DUPLICATE KEY UPDATE status = 'ACTIVE', started_at = COALESCE(started_at, CURRENT_TIMESTAMP)`,
          [appointmentId, appointment.patient_id, doctorId]
        );
      } else if (newStatus === APPOINTMENT_STATUS.COMPLETED) {
        await conn.query(
          `UPDATE consultations SET status = 'COMPLETED', ended_at = CURRENT_TIMESTAMP
           WHERE appointment_id = ?`,
          [appointmentId]
        );
      }

      return {
        appointmentId,
        fromStatus: oldStatus,
        toStatus: newStatus,
        message: `Appointment status updated to ${newStatus}`,
      };
    });
  }

  async canAccessPatient(doctorId, patientId) {
    const [rows] = await db.query(`
      SELECT 1 FROM appointments
      WHERE doctor_id = ? AND patient_id = ?
        AND status IN ('CONFIRMED', 'WAITING', 'IN_PROGRESS', 'COMPLETED')
      LIMIT 1
    `, [doctorId, patientId]);

    return rows.length > 0;
  }

  async getAuthorizedPatients(doctorId) {
    const [rows] = await db.query(`
      SELECT DISTINCT p.id, p.name, p.phone, p.email, p.height_cm, p.weight_kg,
             MAX(a.appointment_date) as last_appointment_date
      FROM patients p
      JOIN appointments a ON p.id = a.patient_id
      WHERE a.doctor_id = ? AND a.status IN ('CONFIRMED', 'WAITING', 'IN_PROGRESS', 'COMPLETED')
      GROUP BY p.id
      ORDER BY last_appointment_date DESC
    `, [doctorId]);

    return rows;
  }
}

module.exports = new DoctorService();
