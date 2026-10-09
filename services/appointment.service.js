const db = require('../config/database');
const config = require('../config');
const {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} = require('../utils/errors');
const {
  APPOINTMENT_STATUS,
  DOCTOR_VERIFICATION_STATUS,
  USER_STATUS,
  AUDIT_ACTIONS,
} = require('../utils/constants');
const {
  generateAppointmentNumber,
  addMinutesToTime,
  timeToMinutes,
  minutesToTime,
} = require('../utils/helpers');
const platformSettingsService = require('./platform-settings.service');
const auditService = require('./audit.service');

class AppointmentService {
  async holdAppointment({
    patientId,
    doctorId,
    appointmentDate,
    startTime,
    consultationMode,
    meetingProvider = null,
    changedByUserId = null,
    ip = null,
    userAgent = null,
  }) {
    // 1. Verify doctor status
    const [doctors] = await db.query(
      `SELECT d.*, dept.id as dept_id 
       FROM doctors d
       LEFT JOIN departments dept ON d.department_id = dept.id
       WHERE d.id = ? AND d.verification_status = ? AND d.status = ?`,
      [doctorId, DOCTOR_VERIFICATION_STATUS.APPROVED, USER_STATUS.ACTIVE]
    );

    if (!doctors.length) {
      throw new BadRequestError('Doctor is not available for appointments');
    }
    const doctor = doctors[0];

    // 2. Validate the requested slot against the doctor's active schedule.
    const reqDate = new Date(`${appointmentDate}T00:00:00Z`);
    const dayOfWeek = reqDate.getUTCDay();

    // 3. Fetch platform fee securely from database
    const platformSettings = await platformSettingsService.getSettings();
    const platformFee = platformSettings.platform_fee;

    // 4. Concurrency-safe slot lock with MySQL transaction.
    //
    // A plain SELECT ... FOR UPDATE is not sufficient here because a vacant
    // slot has no row to lock. Concurrent gap locks can deadlock while all
    // requests subsequently try to INSERT the same slot. A MySQL advisory
    // lock serializes acquisition of this logical slot across all app
    // instances sharing the database, including the vacant-slot case.
    const lockName = `appointment-slot:${doctorId}:${appointmentDate}:${startTime}`;
    const conn = await db.getConnection();
    let transactionStarted = false;
    let lockAcquired = false;
    let createdAppointment;
    let appointmentNumber;
    let appointmentId;

    try {
      // Acquire the advisory lock before beginning the transaction. Waiting
      // requests may occupy pooled connections, but the winner never needs a
      // second pooled connection while its transaction is open.
      const [lockRows] = await conn.query('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
      if (!lockRows[0] || Number(lockRows[0].acquired) !== 1) {
        throw new ConflictError('This appointment slot is busy. Please choose another slot.');
      }
      lockAcquired = true;

      await conn.beginTransaction();
      transactionStarted = true;

      const [schedules] = await conn.query(
        `SELECT start_time, end_time, slot_duration_minutes
         FROM doctor_schedules
         WHERE doctor_id = ? AND day_of_week = ? AND status = 'ACTIVE'
         FOR UPDATE`,
        [doctorId, dayOfWeek]
      );
      if (!schedules.length) {
        throw new BadRequestError('Doctor is not available on the selected date');
      }

      const schedule = schedules[0];
      const requestedStart = timeToMinutes(startTime);
      const scheduleStart = timeToMinutes(schedule.start_time);
      const scheduleEnd = timeToMinutes(schedule.end_time);
      const slotDuration = Number(schedule.slot_duration_minutes) || 30;
      if (!Number.isFinite(requestedStart) || requestedStart < scheduleStart || requestedStart + slotDuration > scheduleEnd || (requestedStart - scheduleStart) % slotDuration !== 0) {
        throw new BadRequestError('Selected time is not an available appointment slot');
      }
      const normalizedStartTime = minutesToTime(requestedStart);
      const endTime = addMinutesToTime(normalizedStartTime, slotDuration);

      const [leaves] = await conn.query(
        `SELECT id FROM doctor_leaves
         WHERE doctor_id = ? AND status = 'ACTIVE'
           AND start_datetime < CONCAT(?, ' ', ?)
           AND end_datetime > CONCAT(?, ' ', ?)
         FOR UPDATE`,
        [doctorId, appointmentDate, endTime, appointmentDate, normalizedStartTime]
      );
      if (leaves.length) {
        throw new BadRequestError('Doctor is on leave during the selected slot');
      }

      // Row lock query to check if slot is taken. The advisory lock above
      // ensures this check and the following insert are serialized even
      // when the slot does not yet have an appointment row.
      const [existing] = await conn.query(
        `SELECT id, status, hold_expires_at
         FROM appointments
         WHERE doctor_id = ? AND appointment_date = ?
           AND start_time < ? AND end_time > ?
           AND status NOT IN ('CANCELLED', 'RESCHEDULED')
           AND (
             status NOT IN ('HELD', 'PAYMENT_PENDING')
             OR (hold_expires_at IS NOT NULL AND hold_expires_at > CURRENT_TIMESTAMP)
           )
         FOR UPDATE`,
        [doctorId, appointmentDate, endTime, normalizedStartTime]
      );

      if (existing.length > 0) {
        throw new ConflictError('This appointment slot has just been selected or booked by another patient. Please choose another slot.');
      }

        // Compute hold expiration timestamp (10 minutes)
        const holdMinutes = config.platform.appointmentHoldMinutes || 10;
        appointmentNumber = generateAppointmentNumber();

        const [insertResult] = await conn.query(
          `INSERT INTO appointments
            (appointment_number, patient_id, doctor_id, department_id, appointment_date, start_time, end_time,
             consultation_mode, status, platform_fee, hold_expires_at, meeting_provider)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE), ?)`,
          [
            appointmentNumber,
            patientId,
            doctorId,
            doctor.dept_id,
            appointmentDate,
            normalizedStartTime,
            endTime,
            consultationMode,
            APPOINTMENT_STATUS.HELD,
            platformFee,
            holdMinutes,
            consultationMode === 'VIDEO' ? (meetingProvider || 'GOOGLE_MEET') : null,
          ]
        );

        appointmentId = insertResult.insertId;

        // State machine event log
        await conn.query(
          `INSERT INTO appointment_events (appointment_id, to_status, changed_by, reason)
           VALUES (?, ?, ?, ?)`,
          [appointmentId, APPOINTMENT_STATUS.HELD, changedByUserId, 'Slot held pending platform fee payment']
        );

        const [createdRows] = await conn.query('SELECT * FROM appointments WHERE id = ?', [appointmentId]);
        createdAppointment = createdRows[0];
      await conn.commit();
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) {
        await conn.rollback();
      }
      throw error;
    } finally {
      // Advisory locks are connection-scoped, so release explicitly before
      // the pooled connection is returned to another request.
      if (lockAcquired) {
        await conn.query('SELECT RELEASE_LOCK(?)', [lockName]);
      }
      conn.release();
    }

    // Audit logging is deliberately after commit. It is non-critical and
    // writes through the pool, so it must not hold up the slot transaction.
    await auditService.log({
      userId: changedByUserId,
      role: 'PATIENT',
      action: AUDIT_ACTIONS.APPOINTMENT_HELD,
      resourceType: 'appointments',
      resourceId: appointmentId,
      metadata: { appointmentNumber, platformFee },
      ip,
      userAgent,
    });

    return createdAppointment;
  }

  async cancelAppointment(patientId, appointmentId, reason, changedByUserId = null, ip = null, userAgent = null) {
    const [appointments] = await db.query(
      'SELECT * FROM appointments WHERE id = ? AND patient_id = ?',
      [appointmentId, patientId]
    );

    if (!appointments.length) {
      throw new NotFoundError('Appointment not found');
    }

    const appointment = appointments[0];
    if (['COMPLETED', 'CANCELLED'].includes(appointment.status)) {
      throw new BadRequestError(`Cannot cancel appointment with status ${appointment.status}`);
    }

    const oldStatus = appointment.status;

    return await db.withTransaction(async (conn) => {
      await conn.query(
        'UPDATE appointments SET status = ?, cancellation_reason = ? WHERE id = ?',
        [APPOINTMENT_STATUS.CANCELLED, reason, appointmentId]
      );

      await conn.query(
        `INSERT INTO appointment_events (appointment_id, from_status, to_status, changed_by, reason)
         VALUES (?, ?, ?, ?, ?)`,
        [appointmentId, oldStatus, APPOINTMENT_STATUS.CANCELLED, changedByUserId, reason]
      );

      await auditService.log({
        userId: changedByUserId,
        role: 'PATIENT',
        action: AUDIT_ACTIONS.APPOINTMENT_CANCELLED,
        resourceType: 'appointments',
        resourceId: appointmentId,
        metadata: { reason },
        ip,
        userAgent,
        conn,
      });

      return {
        appointmentId,
        status: APPOINTMENT_STATUS.CANCELLED,
        message: 'Appointment cancelled successfully',
      };
    });
  }

  async expireStaleHolds() {
    const [result] = await db.query(
      `UPDATE appointments
       SET status = 'CANCELLED', cancellation_reason = 'Hold expired without payment'
       WHERE status IN ('HELD', 'PAYMENT_PENDING')
         AND hold_expires_at IS NOT NULL
         AND hold_expires_at < CURRENT_TIMESTAMP`
    );
    return result.affectedRows;
  }
}

module.exports = new AppointmentService();
