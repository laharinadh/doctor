const test = require('node:test');
const assert = require('node:assert/strict');
const { timeToMinutes, minutesToTime } = require('../../utils/helpers');

function computeRawSlots(startTime, endTime, durationMinutes) {
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  const slots = [];
  for (let m = startMins; m + durationMinutes <= endMins; m += durationMinutes) {
    slots.push({
      startTime: minutesToTime(m),
      endTime: minutesToTime(m + durationMinutes),
    });
  }
  return slots;
}

function intervalsOverlap(start1, end1, start2, end2) {
  // Overlap condition: start1 < end2 && start2 < end1
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

test.describe('White Box Tests: Schedule Calculation & Interval Algorithms', () => {
  test('Exact integer slot division yields exact expected count', () => {
    // 09:00:00 (540m) to 13:00:00 (780m) = 240m. 240 / 30 = 8 slots.
    const slots = computeRawSlots('09:00:00', '13:00:00', 30);
    assert.equal(slots.length, 8);
    assert.equal(slots[0].startTime, '09:00:00');
    assert.equal(slots[0].endTime, '09:30:00');
    assert.equal(slots[7].startTime, '12:30:00');
    assert.equal(slots[7].endTime, '13:00:00');
  });

  test('Uneven slot division drops partial trailing duration window', () => {
    // 09:00:00 to 10:15:00 = 75m. 30m slots -> 2 complete slots (60m), 15m remaining is dropped
    const slots = computeRawSlots('09:00:00', '10:15:00', 30);
    assert.equal(slots.length, 2);
    assert.equal(slots[1].endTime, '10:00:00');
  });

  test('Duration greater than total window yields 0 slots', () => {
    const slots = computeRawSlots('09:00:00', '09:15:00', 30);
    assert.equal(slots.length, 0);
  });

  test('Consecutive adjacent slots do NOT trigger overlap (touching boundary)', () => {
    // Slot 1: 09:00 to 09:30; Slot 2: 09:30 to 10:00
    const overlaps = intervalsOverlap('09:00:00', '09:30:00', '09:30:00', '10:00:00');
    assert.equal(overlaps, false);
  });

  test('Identical slot interval triggers collision overlap', () => {
    const overlaps = intervalsOverlap('09:30:00', '10:00:00', '09:30:00', '10:00:00');
    assert.equal(overlaps, true);
  });

  test('Partial left and right interval overlap detected correctly', () => {
    // Left overlap: 09:15-09:45 with 09:30-10:00
    assert.equal(intervalsOverlap('09:15:00', '09:45:00', '09:30:00', '10:00:00'), true);
    // Right overlap: 09:45-10:15 with 09:30-10:00
    assert.equal(intervalsOverlap('09:45:00', '10:15:00', '09:30:00', '10:00:00'), true);
  });

  test('Day of week mapping calculation handles Sunday (0) to Saturday (6)', () => {
    // 2026-10-11 is Sunday (0), 2026-10-12 is Monday (1)
    const sunday = new Date('2026-10-11T00:00:00Z').getUTCDay();
    const monday = new Date('2026-10-12T00:00:00Z').getUTCDay();
    const saturday = new Date('2026-10-17T00:00:00Z').getUTCDay();

    assert.equal(sunday, 0);
    assert.equal(monday, 1);
    assert.equal(saturday, 6);
  });
});
