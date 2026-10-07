const db = require('../config/database');
const { NotFoundError } = require('../utils/errors');
const { getPaginationParams } = require('../utils/pagination');

class AdminService {
  async getDashboardMetrics() {
    const [[doctorStats]] = await db.query(`
      SELECT 
        COUNT(*) as total_doctors,
        SUM(CASE WHEN verification_status = 'APPROVED' THEN 1 ELSE 0 END) as approved_doctors,
        SUM(CASE WHEN verification_status IN ('PENDING', 'UNDER_REVIEW') THEN 1 ELSE 0 END) as pending_verifications
      FROM doctors
    `);

    const [[patientStats]] = await db.query('SELECT COUNT(*) as total_patients FROM patients');

    const [[appointmentStats]] = await db.query(`
      SELECT 
        COUNT(*) as total_appointments,
        SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed_appointments,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_appointments
      FROM appointments
    `);

    const [[revenueStats]] = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as total_platform_revenue 
      FROM payments 
      WHERE status = 'SUCCESS'
    `);

    const [recentAppointments] = await db.query(`
      SELECT a.id, a.appointment_number, a.appointment_date, a.start_time, a.status, a.platform_fee,
             p.name as patient_name, d.name as doctor_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      ORDER BY a.created_at DESC
      LIMIT 5
    `);

    return {
      doctors: {
        total: doctorStats.total_doctors || 0,
        approved: doctorStats.approved_doctors || 0,
        pendingVerification: doctorStats.pending_verifications || 0,
      },
      patients: {
        total: patientStats.total_patients || 0,
      },
      appointments: {
        total: appointmentStats.total_appointments || 0,
        confirmed: appointmentStats.confirmed_appointments || 0,
        completed: appointmentStats.completed_appointments || 0,
      },
      revenue: {
        totalPlatformFee: parseFloat(revenueStats.total_platform_revenue || 0),
        currency: 'INR',
      },
      recentAppointments,
    };
  }

  async listDoctors(query) {
    const { page, limit, offset } = getPaginationParams(query);
    const conditions = [];
    const params = [];

    if (query.verificationStatus) {
      conditions.push('d.verification_status = ?');
      params.push(query.verificationStatus);
    }
    if (query.status) {
      conditions.push('d.status = ?');
      params.push(query.status);
    }
    if (query.departmentId) {
      conditions.push('d.department_id = ?');
      params.push(query.departmentId);
    }
    if (query.search) {
      conditions.push('(d.name LIKE ? OR d.phone LIKE ? OR d.registration_number LIKE ?)');
      const term = `%${query.search}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM doctors d ${whereClause}`;
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0].total;

    const dataSql = `
      SELECT d.*, dept.name as department_name, u.status as user_status
      FROM doctors d
      LEFT JOIN departments dept ON d.department_id = dept.id
      JOIN users u ON d.user_id = u.id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(dataSql, [...params, limit, offset]);

    return { items: rows, total, page, limit };
  }

  async getDoctorDetail(id) {
    const [rows] = await db.query(`
      SELECT d.*, dept.name as department_name, u.status as user_status
      FROM doctors d
      LEFT JOIN departments dept ON d.department_id = dept.id
      JOIN users u ON d.user_id = u.id
      WHERE d.id = ?
    `, [id]);

    if (!rows.length) {
      throw new NotFoundError('Doctor not found');
    }

    return rows[0];
  }

  async listPatients(query) {
    const { page, limit, offset } = getPaginationParams(query);
    const conditions = [];
    const params = [];

    if (query.search) {
      conditions.push('(p.name LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)');
      const term = `%${query.search}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM patients p ${whereClause}`;
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0].total;

    const dataSql = `
      SELECT p.*, u.status as user_status
      FROM patients p
      JOIN users u ON p.user_id = u.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(dataSql, [...params, limit, offset]);

    return { items: rows, total, page, limit };
  }

  async listAppointments(query) {
    const { page, limit, offset } = getPaginationParams(query);
    const conditions = [];
    const params = [];

    if (query.status) {
      conditions.push('a.status = ?');
      params.push(query.status);
    }
    if (query.date) {
      conditions.push('a.appointment_date = ?');
      params.push(query.date);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM appointments a ${whereClause}`;
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0].total;

    const dataSql = `
      SELECT a.*, p.name as patient_name, p.phone as patient_phone,
             d.name as doctor_name, d.phone as doctor_phone,
             dept.name as department_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN departments dept ON a.department_id = dept.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(dataSql, [...params, limit, offset]);

    return { items: rows, total, page, limit };
  }

  async listPayments(query) {
    const { page, limit, offset } = getPaginationParams(query);
    const conditions = [];
    const params = [];

    if (query.status) {
      conditions.push('p.status = ?');
      params.push(query.status);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM payments p ${whereClause}`;
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0].total;

    const dataSql = `
      SELECT p.*, a.appointment_number, pat.name as patient_name
      FROM payments p
      JOIN appointments a ON p.appointment_id = a.id
      JOIN patients pat ON p.patient_id = pat.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(dataSql, [...params, limit, offset]);

    return { items: rows, total, page, limit };
  }
}

module.exports = new AdminService();
