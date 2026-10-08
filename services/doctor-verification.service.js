const db = require('../config/database');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { DOCTOR_VERIFICATION_STATUS, USER_STATUS, AUDIT_ACTIONS } = require('../utils/constants');
const auditService = require('./audit.service');

class DoctorVerificationService {
  async submitVerification({
    doctorId,
    registrationNumber,
    qualification,
    specialty = null,
    experienceYears,
    profileVideoUrl,
    profilePhotoUrl = null,
    ip = null,
    userAgent = null,
  }) {
    const [doctors] = await db.query('SELECT * FROM doctors WHERE id = ?', [doctorId]);
    if (!doctors.length) {
      throw new NotFoundError('Doctor not found');
    }

    const doctor = doctors[0];

    return await db.withTransaction(async (conn) => {
      // 1. Insert into doctor_verifications history
      const [vResult] = await conn.query(
        `INSERT INTO doctor_verifications 
          (doctor_id, registration_number, qualification, specialty, experience_years, profile_video_url, profile_photo_url, verification_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          doctorId,
          registrationNumber,
          qualification,
          specialty,
          experienceYears,
          profileVideoUrl,
          profilePhotoUrl,
          DOCTOR_VERIFICATION_STATUS.PENDING,
        ]
      );

      // 2. Update doctor record with submitted profile info and status
      await conn.query(
        `UPDATE doctors 
         SET registration_number = ?, qualification = ?, specialty = ?, experience_years = ?,
             profile_video_url = ?, profile_photo_url = COALESCE(?, profile_photo_url),
             verification_status = ?
         WHERE id = ?`,
        [
          registrationNumber,
          qualification,
          specialty,
          experienceYears,
          profileVideoUrl,
          profilePhotoUrl,
          DOCTOR_VERIFICATION_STATUS.UNDER_REVIEW,
          doctorId,
        ]
      );

      await auditService.log({
        userId: doctor.user_id,
        role: 'DOCTOR',
        action: AUDIT_ACTIONS.DOCTOR_VERIFICATION_SUBMITTED,
        resourceType: 'doctor_verifications',
        resourceId: vResult.insertId,
        ip,
        userAgent,
      });

      return {
        verificationId: vResult.insertId,
        status: DOCTOR_VERIFICATION_STATUS.UNDER_REVIEW,
        message: 'Doctor verification submitted successfully and is now under review',
      };
    });
  }

  async approveDoctor(doctorId, adminUserId, ip = null, userAgent = null) {
    const [doctors] = await db.query('SELECT * FROM doctors WHERE id = ?', [doctorId]);
    if (!doctors.length) {
      throw new NotFoundError('Doctor not found');
    }

    return await db.withTransaction(async (conn) => {
      await conn.query(
        'UPDATE doctors SET verification_status = ?, status = ? WHERE id = ?',
        [DOCTOR_VERIFICATION_STATUS.APPROVED, USER_STATUS.ACTIVE, doctorId]
      );

      await conn.query(
        `UPDATE doctor_verifications 
         SET verification_status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
         WHERE doctor_id = ? AND verification_status IN (?, ?)`,
        [
          DOCTOR_VERIFICATION_STATUS.APPROVED,
          adminUserId,
          doctorId,
          DOCTOR_VERIFICATION_STATUS.PENDING,
          DOCTOR_VERIFICATION_STATUS.UNDER_REVIEW,
        ]
      );

      await auditService.log({
        userId: adminUserId,
        role: 'ADMIN',
        action: AUDIT_ACTIONS.DOCTOR_APPROVED,
        resourceType: 'doctors',
        resourceId: doctorId,
        ip,
        userAgent,
      });

      return { success: true, message: 'Doctor approved successfully' };
    });
  }

  async rejectDoctor(doctorId, adminUserId, rejectionReason, ip = null, userAgent = null) {
    if (!rejectionReason) {
      throw new BadRequestError('Rejection reason is required');
    }

    const [doctors] = await db.query('SELECT * FROM doctors WHERE id = ?', [doctorId]);
    if (!doctors.length) {
      throw new NotFoundError('Doctor not found');
    }

    return await db.withTransaction(async (conn) => {
      await conn.query(
        'UPDATE doctors SET verification_status = ? WHERE id = ?',
        [DOCTOR_VERIFICATION_STATUS.REJECTED, doctorId]
      );

      await conn.query(
        `UPDATE doctor_verifications 
         SET verification_status = ?, rejection_reason = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
         WHERE doctor_id = ? AND verification_status IN (?, ?)`,
        [
          DOCTOR_VERIFICATION_STATUS.REJECTED,
          rejectionReason,
          adminUserId,
          doctorId,
          DOCTOR_VERIFICATION_STATUS.PENDING,
          DOCTOR_VERIFICATION_STATUS.UNDER_REVIEW,
        ]
      );

      await auditService.log({
        userId: adminUserId,
        role: 'ADMIN',
        action: AUDIT_ACTIONS.DOCTOR_REJECTED,
        resourceType: 'doctors',
        resourceId: doctorId,
        metadata: { reason: rejectionReason },
        ip,
        userAgent,
      });

      return { success: true, message: 'Doctor verification rejected' };
    });
  }

  async suspendDoctor(doctorId, adminUserId, ip = null, userAgent = null) {
    const [doctors] = await db.query('SELECT * FROM doctors WHERE id = ?', [doctorId]);
    if (!doctors.length) {
      throw new NotFoundError('Doctor not found');
    }

    const doctor = doctors[0];

    return await db.withTransaction(async (conn) => {
      await conn.query(
        'UPDATE doctors SET verification_status = ?, status = ? WHERE id = ?',
        [DOCTOR_VERIFICATION_STATUS.SUSPENDED, USER_STATUS.SUSPENDED, doctorId]
      );

      await conn.query(
        'UPDATE users SET status = ? WHERE id = ?',
        [USER_STATUS.SUSPENDED, doctor.user_id]
      );

      await auditService.log({
        userId: adminUserId,
        role: 'ADMIN',
        action: AUDIT_ACTIONS.DOCTOR_SUSPENDED,
        resourceType: 'doctors',
        resourceId: doctorId,
        ip,
        userAgent,
      });

      return { success: true, message: 'Doctor suspended successfully' };
    });
  }

  async getDoctorVerificationHistory(doctorId) {
    const [rows] = await db.query(
      `SELECT dv.*, u.phone as reviewer_phone, u.email as reviewer_email
       FROM doctor_verifications dv
       LEFT JOIN users u ON dv.reviewed_by = u.id
       WHERE dv.doctor_id = ?
       ORDER BY dv.created_at DESC`,
      [doctorId]
    );
    return rows;
  }
}

module.exports = new DoctorVerificationService();
