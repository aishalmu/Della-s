// Pure scheduling helpers. Times are "HH:MM" strings in the business's local
// time and dates are "YYYY-MM-DD", so nothing here depends on the server's clock
// or time zone.

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function weekday(date) {
  // Parse as UTC so the weekday never shifts with the server's time zone.
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Current date and minutes-past-midnight in the given IANA time zone.
function nowInTimeZone(timeZone, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/**
 * Work out the start times a service of `duration` minutes can be booked at.
 *
 * @param {object} opts
 * @param {string} opts.date            YYYY-MM-DD
 * @param {number} opts.duration        length of the service in minutes
 * @param {{open:string,close:string}|null} opts.hours  opening hours that day
 * @param {{time:string,duration:number}[]} opts.bookings  existing bookings that day
 * @param {{start:string|null,end:string|null}[]} opts.blocks  time off (null start = whole day)
 * @param {number} opts.interval        minutes between offered start times
 * @param {{date:string,minutes:number}} opts.now  current local date/time
 * @param {number} opts.minNoticeMinutes  earliest a booking can start from now
 * @returns {string[]} available start times
 */
function getSlots({ date, duration, hours, bookings, blocks, interval, now, minNoticeMinutes }) {
  if (!hours || !duration) return [];
  if (blocks.some((b) => !b.start)) return [];

  const busy = [
    ...bookings.map((b) => [toMinutes(b.time), toMinutes(b.time) + b.duration]),
    ...blocks.map((b) => [toMinutes(b.start), toMinutes(b.end)]),
  ];

  // Earliest start allowed by the notice period, relative to this date.
  if (date < now.date) return [];
  const daysAhead = Math.round(
    (new Date(`${date}T00:00:00Z`) - new Date(`${now.date}T00:00:00Z`)) / 86400000,
  );
  const earliest = now.minutes + minNoticeMinutes - daysAhead * 1440;

  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  const slots = [];
  for (let start = open; start + duration <= close; start += interval) {
    if (start < earliest) continue;
    const end = start + duration;
    if (busy.some(([s, e]) => start < e && s < end)) continue;
    slots.push(toHHMM(start));
  }
  return slots;
}

module.exports = { toMinutes, toHHMM, weekday, addDays, nowInTimeZone, getSlots };
