const crypto = require('crypto');

function generateAppointmentNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomChars = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `APT-${dateStr}-${randomChars}`;
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const value = String(timeStr).trim().toUpperCase();
  const meridiem = value.match(/\s*(AM|PM)$/)?.[1];
  const normalized = value.replace(/\s*(AM|PM)$/, '');
  const parts = normalized.split(':');
  let hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) return NaN;
  if (meridiem) {
    if (hours < 1 || hours > 12) return NaN;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    if (meridiem === 'PM' && hours !== 12) hours += 12;
  }
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function addMinutesToTime(timeStr, minutesToAdd) {
  const total = timeToMinutes(timeStr) + minutesToAdd;
  return minutesToTime(total);
}

function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  generateAppointmentNumber,
  timeToMinutes,
  minutesToTime,
  addMinutesToTime,
  timingSafeCompare,
};
