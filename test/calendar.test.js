const test = require('node:test');
const assert = require('node:assert/strict');
const { busyFromIcs, createBusyCalendar, localToUtc } = require('../src/calendar');

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:holiday
SUMMARY:Holiday
DTSTART;VALUE=DATE:20261006
DTEND;VALUE=DATE:20261008
END:VEVENT
BEGIN:VEVENT
UID:dentist
SUMMARY:Dentist
DTSTART;TZID=Europe/London:20261009T100000
DTEND;TZID=Europe/London:20261009T113000
END:VEVENT
BEGIN:VEVENT
UID:school
SUMMARY:School run
DTSTART;TZID=Europe/London:20261001T151500
DTEND;TZID=Europe/London:20261001T160000
RRULE:FREQ=WEEKLY;BYDAY=TH;COUNT=4
EXDATE;TZID=Europe/London:20261008T151500
END:VEVENT
BEGIN:VEVENT
UID:free
SUMMARY:Reminder
TRANSP:TRANSPARENT
DTSTART:20261010T090000Z
DTEND:20261010T100000Z
END:VEVENT
BEGIN:VEVENT
UID:overnight
SUMMARY:Night out
DTSTART;TZID=Europe/London:20261016T220000
DTEND;TZID=Europe/London:20261017T090000
END:VEVENT
BEGIN:VEVENT
UID:ABC123@dellas-bookings
SUMMARY:Our own booking
DTSTART:20261013T090000Z
DTEND:20261013T100000Z
END:VEVENT
END:VCALENDAR`;

test('reads busy times from an iCal calendar', () => {
  const busy = busyFromIcs(ICS, { timeZone: 'Europe/London', from: '2026-10-01', to: '2026-10-31' });
  const on = (d) => busy.get(d) || [];

  assert.deepEqual(on('2026-10-06'), [{ start: null, end: null }]); // all-day, 2 days
  assert.deepEqual(on('2026-10-07'), [{ start: null, end: null }]);
  assert.deepEqual(on('2026-10-08'), []); // DTEND is exclusive, and school run skipped that week
  assert.deepEqual(on('2026-10-09'), [{ start: '10:00', end: '11:30' }]);
  assert.deepEqual(on('2026-10-01'), [{ start: '15:15', end: '16:00' }]);
  assert.deepEqual(on('2026-10-15'), [{ start: '15:15', end: '16:00' }]);
  assert.deepEqual(on('2026-10-10'), []); // marked free
  assert.deepEqual(on('2026-10-13'), []); // bookings feed events are ignored
  assert.deepEqual(on('2026-10-16'), [{ start: '22:00', end: '24:00' }]);
  assert.deepEqual(on('2026-10-17'), [{ start: '00:00', end: '09:00' }]);
});

test('keeps the last good copy when the calendar cannot be reached', async () => {
  let fail = false;
  const cal = createBusyCalendar({
    getUrl: () => 'webcal://example.com/cal.ics',
    timeZone: 'Europe/London',
    windowDays: 400,
    fetchImpl: async (url) => {
      assert.equal(url, 'https://example.com/cal.ics');
      if (fail) throw new Error('offline');
      return new Response(ICS);
    },
  });
  await cal.ensureFresh();
  assert.equal(cal.status().error, null);
  fail = true;
  await cal.refreshNow();
  assert.equal(cal.status().error, 'offline');
  assert.ok(cal.status().connected);
});

test('converts London local time to UTC across daylight saving', () => {
  assert.equal(localToUtc('2026-07-01', '09:00', 'Europe/London').toISOString(), '2026-07-01T08:00:00.000Z');
  assert.equal(localToUtc('2026-12-01', '09:00', 'Europe/London').toISOString(), '2026-12-01T09:00:00.000Z');
});
