const db = require('../config/database');
const { NotFoundError, BadRequestError, ConflictError } = require('../utils/errors');
const { getPaginationParams } = require('../utils/pagination');
const { ROLES, USER_STATUS, DOCTOR_VERIFICATION_STATUS, APPOINTMENT_STATUS, CONSULTATION_MODES, AUDIT_ACTIONS } = require('../utils/constants');
const { generateAppointmentNumber, addMinutesToTime } = require('../utils/helpers');
const auditService = require('./audit.service');

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

  // ==========================================
  // DOCTOR MANAGEMENT (Create, Bulk, Edit, Delete)
  // ==========================================

  async createDoctor(data, adminUserId, ip = null, userAgent = null) {
    const name = data.name?.trim();
    const phone = data.phone?.trim();
    const email = data.email?.trim() || null;
    const departmentId = data.department_id ?? data.departmentId ?? null;
    const registrationNumber = (data.registration_number ?? data.registrationNumber ?? '').trim() || null;
    const qualification = (data.qualification ?? '').trim() || null;
    const experienceYears = data.experience_years ?? data.experienceYears ?? 0;
    const bio = (data.bio ?? '').trim() || null;
    const consultationFee = data.consultation_fee ?? data.consultationFee ?? 0;
    const profilePhotoUrl = data.profile_photo_url ?? data.profilePhotoUrl ?? null;
    const profileVideoUrl = data.profile_video_url ?? data.profileVideoUrl ?? null;
    const verificationStatus = data.verification_status ?? data.verificationStatus ?? DOCTOR_VERIFICATION_STATUS.APPROVED;
    const status = data.status ?? USER_STATUS.ACTIVE;

    if (!name || !phone) {
      throw new BadRequestError('Doctor name and phone number are required');
    }

    const doctorId = await db.withTransaction(async (conn) => {
      // 1. Check if user already exists with this phone
      const [existingUsers] = await conn.query('SELECT * FROM users WHERE phone = ?', [phone]);
      let userId;

      if (existingUsers.length > 0) {
        const user = existingUsers[0];
        // Check if doctor profile already exists
        const [existingDoctor] = await conn.query('SELECT id FROM doctors WHERE user_id = ?', [user.id]);
        if (existingDoctor.length > 0) {
          throw new ConflictError(`A doctor profile already exists with phone number ${phone}`);
        }
        userId = user.id;
        // Ensure user status and role are aligned
        await conn.query('UPDATE users SET role = ?, status = ?, email = COALESCE(?, email) WHERE id = ?', [
          ROLES.DOCTOR,
          status,
          email,
          userId,
        ]);
      } else {
        // Create new user account for doctor
        const cleanPhone = phone.replace(/[^a-zA-Z0-9]/g, '');
        const firebaseUid = `admin_doc_${cleanPhone}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        const [insertUser] = await conn.query(
          'INSERT INTO users (firebase_uid, phone, email, role, status) VALUES (?, ?, ?, ?, ?)',
          [firebaseUid, phone, email, ROLES.DOCTOR, status]
        );
        userId = insertUser.insertId;
      }

      // 2. Insert doctor record
      const [insertDoctor] = await conn.query(
        `INSERT INTO doctors 
          (user_id, name, phone, email, department_id, registration_number, qualification, experience_years,
           profile_video_url, profile_photo_url, bio, consultation_fee, verification_status, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          name,
          phone,
          email,
          departmentId,
          registrationNumber,
          qualification,
          experienceYears,
          profileVideoUrl,
          profilePhotoUrl,
          bio,
          consultationFee,
          verificationStatus,
          status,
        ]
      );
      const doctorId = insertDoctor.insertId;

      // 3. Create initial verification audit trail record
      if (registrationNumber || qualification) {
        await conn.query(
          `INSERT INTO doctor_verifications 
            (doctor_id, registration_number, qualification, experience_years, profile_video_url, profile_photo_url,
             verification_status, reviewed_by, reviewed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            doctorId,
            registrationNumber || 'N/A',
            qualification || 'N/A',
            experienceYears || 0,
            profileVideoUrl || 'N/A',
            profilePhotoUrl,
            verificationStatus,
            adminUserId,
          ]
        );
      }

      // 4. Audit log
      await auditService.log({
        userId: adminUserId,
        role: ROLES.ADMIN,
        action: AUDIT_ACTIONS.ADMIN_DOCTOR_CREATED,
        resourceType: 'doctors',
        resourceId: doctorId,
        metadata: { name, phone, email, departmentId, verificationStatus },
        ip,
        userAgent,
      });

      return doctorId;
    });

    return await this.getDoctorDetail(doctorId);
  }

  async bulkCreateDoctors(doctorsList, adminUserId, ip = null, userAgent = null) {
    const list = Array.isArray(doctorsList) ? doctorsList : (doctorsList?.doctors || []);
    if (!list.length) {
      throw new BadRequestError('Doctor list must contain at least one doctor');
    }

    const created = [];
    const skipped = [];

    for (const item of list) {
      try {
        const doctor = await this.createDoctor(item, adminUserId, ip, userAgent);
        created.push({
          id: doctor.id,
          name: doctor.name,
          phone: doctor.phone,
          department_id: doctor.department_id,
          verification_status: doctor.verification_status,
        });
      } catch (err) {
        skipped.push({
          name: item.name || 'Unknown',
          phone: item.phone || 'Unknown',
          reason: err.message,
        });
      }
    }

    await auditService.log({
      userId: adminUserId,
      role: ROLES.ADMIN,
      action: AUDIT_ACTIONS.ADMIN_BULK_DOCTORS_CREATED,
      resourceType: 'doctors',
      metadata: { total: list.length, createdCount: created.length, skippedCount: skipped.length },
      ip,
      userAgent,
    });

    return {
      total: list.length,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    };
  }

  async updateDoctor(doctorId, updateData, adminUserId, ip = null, userAgent = null) {
    const doctor = await this.getDoctorDetail(doctorId);

    const docUpdates = [];
    const docParams = [];
    const userUpdates = [];
    const userParams = [];

    // Map fields
    const name = updateData.name?.trim();
    if (name !== undefined) {
      docUpdates.push('name = ?');
      docParams.push(name);
    }

    const phone = updateData.phone?.trim();
    if (phone !== undefined) {
      // Check phone uniqueness if modified
      if (phone !== doctor.phone) {
        const [conflict] = await db.query('SELECT id FROM users WHERE phone = ? AND id != ?', [phone, doctor.user_id]);
        if (conflict.length > 0) {
          throw new ConflictError(`Phone number ${phone} is already registered to another user`);
        }
      }
      docUpdates.push('phone = ?');
      docParams.push(phone);
      userUpdates.push('phone = ?');
      userParams.push(phone);
    }

    const email = updateData.email !== undefined ? (updateData.email?.trim() || null) : undefined;
    if (email !== undefined) {
      docUpdates.push('email = ?');
      docParams.push(email);
      userUpdates.push('email = ?');
      userParams.push(email);
    }

    const deptId = updateData.department_id ?? updateData.departmentId;
    if (deptId !== undefined) {
      docUpdates.push('department_id = ?');
      docParams.push(deptId || null);
    }

    const regNo = updateData.registration_number ?? updateData.registrationNumber;
    if (regNo !== undefined) {
      docUpdates.push('registration_number = ?');
      docParams.push(regNo ? regNo.trim() : null);
    }

    const qual = updateData.qualification;
    if (qual !== undefined) {
      docUpdates.push('qualification = ?');
      docParams.push(qual ? qual.trim() : null);
    }

    const exp = updateData.experience_years ?? updateData.experienceYears;
    if (exp !== undefined) {
      docUpdates.push('experience_years = ?');
      docParams.push(exp);
    }

    const bio = updateData.bio;
    if (bio !== undefined) {
      docUpdates.push('bio = ?');
      docParams.push(bio ? bio.trim() : null);
    }

    const fee = updateData.consultation_fee ?? updateData.consultationFee;
    if (fee !== undefined) {
      docUpdates.push('consultation_fee = ?');
      docParams.push(fee);
    }

    const photo = updateData.profile_photo_url ?? updateData.profilePhotoUrl;
    if (photo !== undefined) {
      docUpdates.push('profile_photo_url = ?');
      docParams.push(photo || null);
    }

    const video = updateData.profile_video_url ?? updateData.profileVideoUrl;
    if (video !== undefined) {
      docUpdates.push('profile_video_url = ?');
      docParams.push(video || null);
    }

    const vStatus = updateData.verification_status ?? updateData.verificationStatus;
    if (vStatus !== undefined) {
      docUpdates.push('verification_status = ?');
      docParams.push(vStatus);
    }

    const status = updateData.status;
    if (status !== undefined) {
      docUpdates.push('status = ?');
      docParams.push(status);
      userUpdates.push('status = ?');
      userParams.push(status);
    }

    await db.withTransaction(async (conn) => {
      if (docUpdates.length > 0) {
        docParams.push(doctorId);
        await conn.query(`UPDATE doctors SET ${docUpdates.join(', ')} WHERE id = ?`, docParams);
      }

      if (userUpdates.length > 0) {
        userParams.push(doctor.user_id);
        await conn.query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userParams);
      }

      if (vStatus !== undefined && vStatus !== doctor.verification_status) {
        await conn.query(
          `INSERT INTO doctor_verifications 
            (doctor_id, registration_number, qualification, experience_years, profile_video_url, profile_photo_url,
             verification_status, reviewed_by, reviewed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            doctorId,
            doctor.registration_number || 'N/A',
            doctor.qualification || 'N/A',
            doctor.experience_years || 0,
            doctor.profile_video_url || 'N/A',
            doctor.profile_photo_url,
            vStatus,
            adminUserId,
          ]
        );
      }

      await auditService.log({
        userId: adminUserId,
        role: ROLES.ADMIN,
        action: AUDIT_ACTIONS.ADMIN_DOCTOR_UPDATED,
        resourceType: 'doctors',
        resourceId: doctorId,
        metadata: updateData,
        ip,
        userAgent,
      });
    });

    return await this.getDoctorDetail(doctorId);
  }

  async deleteDoctor(doctorId, adminUserId, ip = null, userAgent = null) {
    const doctor = await this.getDoctorDetail(doctorId);

    await db.withTransaction(async (conn) => {
      await conn.query('DELETE FROM doctors WHERE id = ?', [doctorId]);
      // Also delete or mark associated user
      await conn.query('UPDATE users SET status = ? WHERE id = ?', [USER_STATUS.INACTIVE, doctor.user_id]);

      await auditService.log({
        userId: adminUserId,
        role: ROLES.ADMIN,
        action: AUDIT_ACTIONS.ADMIN_DOCTOR_DELETED,
        resourceType: 'doctors',
        resourceId: doctorId,
        metadata: { name: doctor.name, phone: doctor.phone },
        ip,
        userAgent,
      });
    });

    return { success: true, message: `Doctor ${doctor.name} deleted successfully` };
  }

  // ==========================================
  // PATIENT MANAGEMENT (Create, Bulk, Edit, Delete)
  // ==========================================

  async getPatientDetail(patientId) {
    const [rows] = await db.query(`
      SELECT p.*, u.status as user_status, u.firebase_uid, u.created_at as account_created_at
      FROM patients p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [patientId]);

    if (!rows.length) {
      throw new NotFoundError('Patient not found');
    }

    const [recentAppointments] = await db.query(`
      SELECT a.id, a.appointment_number, a.appointment_date, a.start_time, a.status, a.platform_fee,
             d.name as doctor_name, d.phone as doctor_phone
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.patient_id = ?
      ORDER BY a.appointment_date DESC, a.start_time DESC
      LIMIT 10
    `, [patientId]);

    return { ...rows[0], recentAppointments };
  }

  async createPatient(data, adminUserId, ip = null, userAgent = null) {
    const name = data.name?.trim();
    const phone = data.phone?.trim();
    const email = data.email?.trim() || null;
    const heightCm = data.height_cm ?? data.heightCm ?? null;
    const weightKg = data.weight_kg ?? data.weightKg ?? null;
    const status = data.status ?? USER_STATUS.ACTIVE;

    if (!name || !phone) {
      throw new BadRequestError('Patient name and phone number are required');
    }

    const patientId = await db.withTransaction(async (conn) => {
      // 1. Check if user already exists
      const [existingUsers] = await conn.query('SELECT * FROM users WHERE phone = ?', [phone]);
      let userId;

      if (existingUsers.length > 0) {
        const user = existingUsers[0];
        const [existingPatient] = await conn.query('SELECT id FROM patients WHERE user_id = ?', [user.id]);
        if (existingPatient.length > 0) {
          throw new ConflictError(`A patient profile already exists with phone number ${phone}`);
        }
        userId = user.id;
        await conn.query('UPDATE users SET role = ?, status = ?, email = COALESCE(?, email) WHERE id = ?', [
          ROLES.PATIENT,
          status,
          email,
          userId,
        ]);
      } else {
        const cleanPhone = phone.replace(/[^a-zA-Z0-9]/g, '');
        const firebaseUid = `admin_pat_${cleanPhone}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        const [insertUser] = await conn.query(
          'INSERT INTO users (firebase_uid, phone, email, role, status) VALUES (?, ?, ?, ?, ?)',
          [firebaseUid, phone, email, ROLES.PATIENT, status]
        );
        userId = insertUser.insertId;
      }

      // 2. Insert patient record
      const [insertPatient] = await conn.query(
        'INSERT INTO patients (user_id, name, phone, email, height_cm, weight_kg) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, name, phone, email, heightCm, weightKg]
      );
      const patientId = insertPatient.insertId;

      // 3. Audit log
      await auditService.log({
        userId: adminUserId,
        role: ROLES.ADMIN,
        action: AUDIT_ACTIONS.ADMIN_PATIENT_CREATED,
        resourceType: 'patients',
        resourceId: patientId,
        metadata: { name, phone, email },
        ip,
        userAgent,
      });

      return patientId;
    });

    return await this.getPatientDetail(patientId);
  }

  async bulkCreatePatients(patientsList, adminUserId, ip = null, userAgent = null) {
    const list = Array.isArray(patientsList) ? patientsList : (patientsList?.patients || []);
    if (!list.length) {
      throw new BadRequestError('Patient list must contain at least one patient');
    }

    const created = [];
    const skipped = [];

    for (const item of list) {
      try {
        const patient = await this.createPatient(item, adminUserId, ip, userAgent);
        created.push({
          id: patient.id,
          name: patient.name,
          phone: patient.phone,
          email: patient.email,
        });
      } catch (err) {
        skipped.push({
          name: item.name || 'Unknown',
          phone: item.phone || 'Unknown',
          reason: err.message,
        });
      }
    }

    await auditService.log({
      userId: adminUserId,
      role: ROLES.ADMIN,
      action: AUDIT_ACTIONS.ADMIN_BULK_PATIENTS_CREATED,
      resourceType: 'patients',
      metadata: { total: list.length, createdCount: created.length, skippedCount: skipped.length },
      ip,
      userAgent,
    });

    return {
      total: list.length,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    };
  }

  async updatePatient(patientId, updateData, adminUserId, ip = null, userAgent = null) {
    const patient = await this.getPatientDetail(patientId);

    const patUpdates = [];
    const patParams = [];
    const userUpdates = [];
    const userParams = [];

    const name = updateData.name?.trim();
    if (name !== undefined) {
      patUpdates.push('name = ?');
      patParams.push(name);
    }

    const phone = updateData.phone?.trim();
    if (phone !== undefined) {
      if (phone !== patient.phone) {
        const [conflict] = await db.query('SELECT id FROM users WHERE phone = ? AND id != ?', [phone, patient.user_id]);
        if (conflict.length > 0) {
          throw new ConflictError(`Phone number ${phone} is already registered to another user`);
        }
      }
      patUpdates.push('phone = ?');
      patParams.push(phone);
      userUpdates.push('phone = ?');
      userParams.push(phone);
    }

    const email = updateData.email !== undefined ? (updateData.email?.trim() || null) : undefined;
    if (email !== undefined) {
      patUpdates.push('email = ?');
      patParams.push(email);
      userUpdates.push('email = ?');
      userParams.push(email);
    }

    const height = updateData.height_cm ?? updateData.heightCm;
    if (height !== undefined) {
      patUpdates.push('height_cm = ?');
      patParams.push(height || null);
    }

    const weight = updateData.weight_kg ?? updateData.weightKg;
    if (weight !== undefined) {
      patUpdates.push('weight_kg = ?');
      patParams.push(weight || null);
    }

    const status = updateData.status;
    if (status !== undefined) {
      userUpdates.push('status = ?');
      userParams.push(status);
    }

    await db.withTransaction(async (conn) => {
      if (patUpdates.length > 0) {
        patParams.push(patientId);
        await conn.query(`UPDATE patients SET ${patUpdates.join(', ')} WHERE id = ?`, patParams);
      }

      if (userUpdates.length > 0) {
        userParams.push(patient.user_id);
        await conn.query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userParams);
      }

      await auditService.log({
        userId: adminUserId,
        role: ROLES.ADMIN,
        action: AUDIT_ACTIONS.ADMIN_PATIENT_UPDATED,
        resourceType: 'patients',
        resourceId: patientId,
        metadata: updateData,
        ip,
        userAgent,
      });
    });

    return await this.getPatientDetail(patientId);
  }

  async deletePatient(patientId, adminUserId, ip = null, userAgent = null) {
    const patient = await this.getPatientDetail(patientId);

    await db.withTransaction(async (conn) => {
      await conn.query('DELETE FROM patients WHERE id = ?', [patientId]);
      await conn.query('UPDATE users SET status = ? WHERE id = ?', [USER_STATUS.INACTIVE, patient.user_id]);

      await auditService.log({
        userId: adminUserId,
        role: ROLES.ADMIN,
        action: AUDIT_ACTIONS.ADMIN_PATIENT_DELETED,
        resourceType: 'patients',
        resourceId: patientId,
        metadata: { name: patient.name, phone: patient.phone },
        ip,
        userAgent,
      });
    });

    return { success: true, message: `Patient ${patient.name} deleted successfully` };
  }

  // ==========================================
  // APPOINTMENT & FULL PLATFORM OVERRIDE
  // ==========================================

  async getAppointmentDetail(appointmentId) {
    const [rows] = await db.query(`
      SELECT a.*,
             p.name as patient_name, p.phone as patient_phone, p.email as patient_email,
             d.name as doctor_name, d.phone as doctor_phone, d.qualification as doctor_qualification,
             d.consultation_fee as doctor_fee,
             dept.name as department_name,
             pay.status as payment_status, pay.amount as payment_amount, pay.gateway as payment_gateway
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN departments dept ON a.department_id = dept.id
      LEFT JOIN payments pay ON a.id = pay.appointment_id
      WHERE a.id = ?
    `, [appointmentId]);

    if (!rows.length) {
      throw new NotFoundError('Appointment not found');
    }

    const [events] = await db.query(`
      SELECT ae.*, u.role as changed_by_role, u.phone as changed_by_phone
      FROM appointment_events ae
      LEFT JOIN users u ON ae.changed_by = u.id
      WHERE ae.appointment_id = ?
      ORDER BY ae.created_at ASC
    `, [appointmentId]);

    return { ...rows[0], events };
  }

  async createAppointment(data, adminUserId, ip = null, userAgent = null) {
    const patientId = data.patient_id ?? data.patientId;
    const doctorId = data.doctor_id ?? data.doctorId;
    const rawDate = data.appointment_date ?? data.appointmentDate;
    const appointmentDate = rawDate ? String(rawDate).slice(0, 10) : null;
    const startTime = data.start_time ?? data.startTime;

    if (!patientId || !doctorId || !appointmentDate || !startTime) {
      throw new BadRequestError('patientId, doctorId, appointmentDate, and startTime are required');
    }

    // Verify patient and doctor exist
    const [patients] = await db.query('SELECT id, name FROM patients WHERE id = ?', [patientId]);
    if (!patients.length) throw new NotFoundError('Patient not found');

    const [doctors] = await db.query('SELECT id, name, department_id, consultation_fee FROM doctors WHERE id = ?', [doctorId]);
    if (!doctors.length) throw new NotFoundError('Doctor not found');

    const doctor = doctors[0];
    const departmentId = data.department_id ?? data.departmentId ?? doctor.department_id ?? null;
    const endTime = data.end_time ?? data.endTime ?? addMinutesToTime(startTime, 30);
    const consultationMode = data.consultation_mode ?? data.consultationMode ?? CONSULTATION_MODES.VIDEO;
    const status = data.status ?? APPOINTMENT_STATUS.CONFIRMED;
    const platformFee = data.platform_fee ?? data.platformFee ?? 99.00;
    const meetingProvider = data.meeting_provider ?? data.meetingProvider ?? (consultationMode === CONSULTATION_MODES.VIDEO ? 'GOOGLE_MEET' : null);
    const meetingUrl = data.meeting_url ?? data.meetingUrl ?? (consultationMode === CONSULTATION_MODES.VIDEO ? `https://meet.google.com/med-${Date.now().toString(36)}` : null);
    const cancellationReason = data.cancellation_reason ?? data.cancellationReason ?? null;

    const appointmentNumber = generateAppointmentNumber();

    const newAptId = await db.withTransaction(async (conn) => {
      const [insert] = await conn.query(
        `INSERT INTO appointments 
          (appointment_number, patient_id, doctor_id, department_id, appointment_date, start_time, end_time,
           consultation_mode, status, platform_fee, meeting_provider, meeting_url, cancellation_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          appointmentNumber,
          patientId,
          doctorId,
          departmentId,
          appointmentDate,
          startTime,
          endTime,
          consultationMode,
          status,
          platformFee,
          meetingProvider,
          meetingUrl,
          cancellationReason,
        ]
      );
      const newAptId = insert.insertId;

      await conn.query(
        'INSERT INTO appointment_events (appointment_id, from_status, to_status, changed_by, reason) VALUES (?, ?, ?, ?, ?)',
        [newAptId, null, status, adminUserId, 'Created by Admin']
      );

      await auditService.log({
        userId: adminUserId,
        role: ROLES.ADMIN,
        action: AUDIT_ACTIONS.ADMIN_APPOINTMENT_CREATED,
        resourceType: 'appointments',
        resourceId: newAptId,
        metadata: { appointmentNumber, patientId, doctorId, status },
        ip,
        userAgent,
      });

      return newAptId;
    });

    return await this.getAppointmentDetail(newAptId);
  }

  async updateAppointment(appointmentId, data, adminUserId, ip = null, userAgent = null) {
    const apt = await this.getAppointmentDetail(appointmentId);

    const updates = [];
    const params = [];

    const patientId = data.patient_id ?? data.patientId;
    if (patientId !== undefined) {
      updates.push('patient_id = ?');
      params.push(patientId);
    }

    const doctorId = data.doctor_id ?? data.doctorId;
    if (doctorId !== undefined) {
      updates.push('doctor_id = ?');
      params.push(doctorId);
    }

    const deptId = data.department_id ?? data.departmentId;
    if (deptId !== undefined) {
      updates.push('department_id = ?');
      params.push(deptId || null);
    }

    const date = data.appointment_date ?? data.appointmentDate;
    if (date !== undefined) {
      updates.push('appointment_date = ?');
      params.push(date ? String(date).slice(0, 10) : null);
    }

    const start = data.start_time ?? data.startTime;
    if (start !== undefined) {
      updates.push('start_time = ?');
      params.push(start);
    }

    const end = data.end_time ?? data.endTime;
    if (end !== undefined) {
      updates.push('end_time = ?');
      params.push(end);
    }

    const mode = data.consultation_mode ?? data.consultationMode;
    if (mode !== undefined) {
      updates.push('consultation_mode = ?');
      params.push(mode);
    }

    const status = data.status;
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    const fee = data.platform_fee ?? data.platformFee;
    if (fee !== undefined) {
      updates.push('platform_fee = ?');
      params.push(fee);
    }

    const provider = data.meeting_provider ?? data.meetingProvider;
    if (provider !== undefined) {
      updates.push('meeting_provider = ?');
      params.push(provider || null);
    }

    const url = data.meeting_url ?? data.meetingUrl;
    if (url !== undefined) {
      updates.push('meeting_url = ?');
      params.push(url || null);
    }

    const reason = data.cancellation_reason ?? data.cancellationReason;
    if (reason !== undefined) {
      updates.push('cancellation_reason = ?');
      params.push(reason || null);
    }

    if (!updates.length) {
      return apt;
    }

    await db.withTransaction(async (conn) => {
      params.push(appointmentId);
      await conn.query(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`, params);

      if (status !== undefined && status !== apt.status) {
        await conn.query(
          'INSERT INTO appointment_events (appointment_id, from_status, to_status, changed_by, reason) VALUES (?, ?, ?, ?, ?)',
          [appointmentId, apt.status, status, adminUserId, reason || 'Updated by Admin']
        );
      }

      await auditService.log({
        userId: adminUserId,
        role: ROLES.ADMIN,
        action: AUDIT_ACTIONS.ADMIN_APPOINTMENT_MODIFIED,
        resourceType: 'appointments',
        resourceId: appointmentId,
        metadata: data,
        ip,
        userAgent,
      });
    });

    return await this.getAppointmentDetail(appointmentId);
  }

  async deleteAppointment(appointmentId, adminUserId, ip = null, userAgent = null) {
    const apt = await this.getAppointmentDetail(appointmentId);

    await db.withTransaction(async (conn) => {
      await conn.query('DELETE FROM appointments WHERE id = ?', [appointmentId]);

      await auditService.log({
        userId: adminUserId,
        role: ROLES.ADMIN,
        action: AUDIT_ACTIONS.ADMIN_APPOINTMENT_DELETED,
        resourceType: 'appointments',
        resourceId: appointmentId,
        metadata: { appointmentNumber: apt.appointment_number },
        ip,
        userAgent,
      });
    });

    return { success: true, message: `Appointment ${apt.appointment_number} deleted successfully` };
  }

  async updatePayment(paymentId, data, adminUserId, ip = null, userAgent = null) {
    const [payments] = await db.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
    if (!payments.length) {
      throw new NotFoundError('Payment record not found');
    }

    const updates = [];
    const params = [];

    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.amount !== undefined) {
      updates.push('amount = ?');
      params.push(data.amount);
    }
    const gatewayId = data.gateway_payment_id ?? data.gatewayPaymentId;
    if (gatewayId !== undefined) {
      updates.push('gateway_payment_id = ?');
      params.push(gatewayId);
    }

    if (updates.length > 0) {
      params.push(paymentId);
      await db.query(`UPDATE payments SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    await auditService.log({
      userId: adminUserId,
      role: ROLES.ADMIN,
      action: AUDIT_ACTIONS.ADMIN_PAYMENT_MODIFIED,
      resourceType: 'payments',
      resourceId: paymentId,
      metadata: data,
      ip,
      userAgent,
    });

    const [updated] = await db.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
    return updated[0];
  }

  async deletePayment(paymentId, adminUserId, ip = null, userAgent = null) {
    const [payments] = await db.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
    if (!payments.length) {
      throw new NotFoundError('Payment record not found');
    }

    await db.query('DELETE FROM payments WHERE id = ?', [paymentId]);
    return { success: true, message: 'Payment record deleted successfully' };
  }
}

module.exports = new AdminService();

