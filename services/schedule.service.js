const db = require('../config/database');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/errors');
const { timeToMinutes, minutesToTime, addMinutesToTime } = require('../utils/helpers');

class ScheduleService {
  async getDoctorSchedules(doctorId) {
    const [rows] = await db.query(
      'SELECT * FROM doctor_schedules WHERE doctor_id = ? ORDER BY day_of_week ASC',
      [doctorId]
    );
    return rows;
  }

  async upsertSchedule(doctorId, { dayOfWeek, startTime, endTime, slotDurationMinutes = 30, status = 'ACTIVE' }) {
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      throw new BadRequestError('Start time must be before end time');
    }

    const [existing] = await db.query(
      'SELECT id FROM doctor_schedules WHERE doctor_id = ? AND day_of_week = ?',
      [doctorId, dayOfWeek]
    );

    if (existing.length) {
      const scheduleId = existing[0].id;
      await db.query(
        `UPDATE doctor_schedules 
         SET start_time = ?, end_time = ?, slot_duration_minutes = ?, status = ?
         WHERE id = ?`,
        [startTime, endTime, slotDurationMinutes, status, scheduleId]
      );
      const [updated] = await db.query('SELECT * FROM doctor_schedules WHERE id = ?', [scheduleId]);
      return updated[0];
    } else {
      const [insert] = await db.query(
        `INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [doctorId, dayOfWeek, startTime, endTime, slotDurationMinutes, status]
      );
      const [created] = await db.query('SELECT * FROM doctor_schedules WHERE id = ?', [insert.insertId]);
      return created[0];
    }
  }

  async deleteSchedule(doctorId, scheduleId) {
    const [rows] = await db.query(
      'SELECT id FROM doctor_schedules WHERE id = ? AND doctor_id = ?',
      [scheduleId, doctorId]
    );
    if (!rows.length) {
      throw new NotFoundError('Schedule not found');
    }

    await db.query('DELETE FROM doctor_schedules WHERE id = ?', [scheduleId]);
    return { success: true, message: 'Schedule removed successfully' };
  }

  async getDoctorLeaves(doctorId) {
    const [rows] = await db.query(
      'SELECT * FROM doctor_leaves WHERE doctor_id = ? AND status = "ACTIVE" ORDER BY start_datetime ASC',
      [doctorId]
    );
    return rows;
  }

  async createLeave(doctorId, { startDatetime, endDatetime, reason = null }) {
    const start = new Date(startDatetime);
    const end = new Date(endDatetime);

    if (start >= end) {
      throw new BadRequestError('Leave start time must be before end time');
    }

    // Check for overlapping active leaves
    const [overlap] = await db.query(
      `SELECT id FROM doctor_leaves
       WHERE doctor_id = ? AND status = 'ACTIVE'
         AND start_datetime < ? AND end_datetime > ?`,
      [doctorId, endDatetime, startDatetime]
    );

    if (overlap.length) {
      throw new ConflictError('A leave already exists that overlaps with this time range');
    }

    const [res] = await db.query(
      'INSERT INTO doctor_leaves (doctor_id, start_datetime, end_datetime, reason, status) VALUES (?, ?, ?, ?, ?)',
      [doctorId, startDatetime, endDatetime, reason, 'ACTIVE']
    );

    const [created] = await db.query('SELECT * FROM doctor_leaves WHERE id = ?', [res.insertId]);
    return created[0];
  }

  async cancelLeave(doctorId, leaveId) {
    const [rows] = await db.query(
      'SELECT id FROM doctor_leaves WHERE id = ? AND doctor_id = ?',
      [leaveId, doctorId]
    );
    if (!rows.length) {
      throw new NotFoundError('Leave record not found');
    }

    await db.query('UPDATE doctor_leaves SET status = "CANCELLED" WHERE id = ?', [leaveId]);
    return { success: true, message: 'Leave cancelled successfully' };
  }

  async computeAvailableSlots(doctorId, dateString) {
    // 1. Verify date format
    const requestedDate = new Date(`${dateString}T00:00:00Z`);
    if (isNaN(requestedDate.getTime())) {
      throw new BadRequestError('Invalid date format. Expected YYYY-MM-DD');
    }

    const dayOfWeek = requestedDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

    // 2. Fetch doctor's schedule for this day
    const [schedules] = await db.query(
      `SELECT * FROM doctor_schedules 
       WHERE doctor_id = ? AND day_of_week = ? AND status = 'ACTIVE'`,
      [doctorId, dayOfWeek]
    );

    if (!schedules.length) {
      return []; // Doctor does not work on this day
    }

    const schedule = schedules[0];
    const duration = schedule.slot_duration_minutes || 30;
    const startMins = timeToMinutes(schedule.start_time);
    const endMins = timeToMinutes(schedule.end_time);

    // 3. Generate raw potential slots
    const potentialSlots = [];
    for (let m = startMins; m + duration <= endMins; m += duration) {
      potentialSlots.push({
        startTime: minutesToTime(m),
        endTime: minutesToTime(m + duration),
      });
    }

    // 4. Check for leaves overlapping on this date
    const dayStart = `${dateString} 00:00:00`;
    const dayEnd = `${dateString} 23:59:59`;
    const [leaves] = await db.query(
      `SELECT start_datetime, end_datetime FROM doctor_leaves
       WHERE doctor_id = ? AND status = 'ACTIVE'
         AND start_datetime <= ? AND end_datetime >= ?`,
      [doctorId, dayEnd, dayStart]
    );

    // 5. Fetch existing appointments that occupy slots
    // An appointment blocks the slot IF it's:
    // - CONFIRMED, WAITING, IN_PROGRESS, COMPLETED
    // - OR HELD / PAYMENT_PENDING where hold_expires_at > NOW()
    const [bookedAppointments] = await db.query(
      `SELECT start_time, end_time, status, hold_expires_at 
       FROM appointments
       WHERE doctor_id = ? AND appointment_date = ?
         AND status NOT IN ('CANCELLED', 'RESCHEDULED')
         AND (
           status NOT IN ('HELD', 'PAYMENT_PENDING')
           OR (hold_expires_at IS NOT NULL AND hold_expires_at > CURRENT_TIMESTAMP)
         )`,
      [doctorId, dateString]
    );

    const bookedStartTimes = new Set(bookedAppointments.map((a) => a.start_time));

    // Check if requested date is today to filter out past slots
    const now = new Date();
    const todayString = now.toISOString().slice(0, 10);
    const isToday = dateString === todayString;
    const currentMins = now.getHours() * 60 + now.getMinutes();

    // 6. Filter and build slot objects
    const resultSlots = potentialSlots.map((slot) => {
      const slotStartMins = timeToMinutes(slot.startTime);
      const slotEndMins = timeToMinutes(slot.endTime);

      let isAvailable = true;
      let reason = null;

      // Check if slot has passed
      if (isToday && slotStartMins <= currentMins) {
        isAvailable = false;
        reason = 'Past time';
      }

      // Check if booked
      if (isAvailable && bookedStartTimes.has(slot.startTime)) {
        isAvailable = false;
        reason = 'Booked';
      }

      // Check if slot overlaps any doctor leave
      if (isAvailable && leaves.length > 0) {
        const slotStartDT = new Date(`${dateString}T${slot.startTime}Z`).getTime();
        const slotEndDT = new Date(`${dateString}T${slot.endTime}Z`).getTime();

        for (const leave of leaves) {
          const leaveStart = new Date(leave.start_datetime).getTime();
          const leaveEnd = new Date(leave.end_datetime).getTime();
          if (slotStartDT < leaveEnd && slotEndDT > leaveStart) {
            isAvailable = false;
            reason = 'Doctor on leave';
            break;
          }
        }
      }

      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        isAvailable,
        ...(reason && { unavailableReason: reason }),
      };
    });

    return resultSlots;
  }
}

module.exports = new ScheduleService();
