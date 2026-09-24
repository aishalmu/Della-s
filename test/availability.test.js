const test = require('node:test');
const assert = require('node:assert/strict');
const { getSlots, nowInTimeZone, weekday, addDays } = require('../src/availability');

const base = {
  date: '2026-10-06',
  duration: 60,
  hours: { open: '08:00', close: '11:00' },
  bookings: [],
  blocks: [],
  interval: 30,
  now: { date: '2026-10-01', minutes: 600 },
  minNoticeMinutes: 0,
};

test('offers every start time that finishes by closing', () => {
  assert.deepEqual(getSlots(base), ['08:00', '08:30', '09:00', '09:30', '10:00']);
});

test('closed days have no slots', () => {
  assert.deepEqual(getSlots({ ...base, hours: null }), []);
});

test('skips times that overlap an existing booking', () => {
  const slots = getSlots({ ...base, bookings: [{ time: '09:00', duration: 45 }] });
  assert.deepEqual(slots, ['08:00', '10:00']);
});

test('whole-day and part-day blocks', () => {
  assert.deepEqual(getSlots({ ...base, blocks: [{ start: null, end: null }] }), []);
  assert.deepEqual(getSlots({ ...base, blocks: [{ start: '08:00', end: '09:00' }] }), ['09:00', '09:30', '10:00']);
});

test('respects notice period and past dates', () => {
  const today = { ...base, date: '2026-10-01', now: { date: '2026-10-01', minutes: 8 * 60 + 10 } };
  assert.deepEqual(getSlots({ ...today, minNoticeMinutes: 60 }), ['09:30', '10:00']);
  assert.deepEqual(getSlots({ ...base, date: '2026-09-30' }), []);
  // Notice period that spills into the next morning.
  const tomorrow = { ...base, date: '2026-10-02', now: { date: '2026-10-01', minutes: 23 * 60 } };
  assert.deepEqual(getSlots({ ...tomorrow, minNoticeMinutes: 10 * 60 }), ['09:00', '09:30', '10:00']);
});

test('date helpers', () => {
  assert.equal(weekday('2026-10-06'), 2); // Tuesday
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.deepEqual(nowInTimeZone('Europe/London', new Date('2026-07-01T23:30:00Z')), {
    date: '2026-07-02',
    minutes: 30,
  });
});
