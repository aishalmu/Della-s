// Two-way calendar link:
//  - bookingsToIcs() publishes bookings as a feed Della subscribes to in her
//    phone's calendar app (Apple, Google or Outlook).
//  - createBusyCalendar() reads her own calendar's private iCal address so
//    anything in it blocks that time on the website.

const ical = require('node-ical');
const { addDays, nowInTimeZone, toHHMM } = require('./availability');

const FEED_UID_DOMAIN = 'dellas-bookings';

// ---------- reading her calendar ----------

function localDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function pushBlock(map, date, block) {
  if (!map.has(date)) map.set(date, []);
  map.get(date).push(block);
}

/**
 * Turn an iCal file into busy blocks per local date.
 * @returns {Map<string, {start: string|null, end: string|null}[]>}
 */
function busyFromIcs(icsText, { timeZone, from, to }) {
  const busy = new Map();
  const data = ical.sync.parseICS(icsText);
  // Pad the range by a day either side so time zone edges aren't missed.
  const rangeStart = new Date(`${addDays(from, -1)}T00:00:00Z`);
  const rangeEnd = new Date(`${addDays(to, 2)}T00:00:00Z`);

  for (const event of Object.values(data)) {
    if (event.type !== 'VEVENT' || !event.start) continue;
    if (event.transparency === 'TRANSPARENT') continue; // marked "free"
    if (event.status === 'CANCELLED') continue;
    if (String(event.uid || '').endsWith(`@${FEED_UID_DOMAIN}`)) continue; // our own bookings

    let instances;
    try {
      instances = ical.expandRecurringEvent(event, {
        from: rangeStart,
        to: rangeEnd,
        expandOngoing: true,
      });
    } catch (err) {
      console.warn(`Skipping calendar event "${event.summary}": ${err.message}`);
      continue;
    }

    for (const inst of instances) {
      const start = inst.start;
      const end = inst.end && inst.end > start ? inst.end : null;

      if (inst.isFullDay) {
        // All-day events are parsed at local midnight; DTEND is exclusive.
        const first = localDay(start);
        const last = end ? addDays(localDay(end), -1) : first;
        for (let d = first; d <= last; d = addDays(d, 1)) {
          if (d >= from && d <= to) pushBlock(busy, d, { start: null, end: null });
        }
        continue;
      }

      if (!end) continue;
      const s = nowInTimeZone(timeZone, start);
      const e = nowInTimeZone(timeZone, end);
      for (let d = s.date; d <= e.date; d = addDays(d, 1)) {
        const startMin = d === s.date ? s.minutes : 0;
        const endMin = d === e.date ? e.minutes : 1440;
        if (endMin > startMin && d >= from && d <= to) {
          pushBlock(busy, d, { start: toHHMM(startMin), end: toHHMM(endMin) });
        }
      }
    }
  }
  return busy;
}

/**
 * Keeps a cached copy of her calendar's busy times, refreshed every few minutes.
 */
function createBusyCalendar({ getUrl, timeZone, windowDays, maxAgeMs = 5 * 60 * 1000, fetchImpl = fetch }) {
  let cache = { url: null, busy: new Map(), fetchedAt: 0, error: null, lastSuccess: null };
  let inFlight = null;

  async function refresh() {
    const url = getUrl();
    if (!url) {
      cache = { url: null, busy: new Map(), fetchedAt: Date.now(), error: null, lastSuccess: null };
      return;
    }
    const today = nowInTimeZone(timeZone).date;
    try {
      const res = await fetchImpl(url.replace(/^webcals?:\/\//i, 'https://'), {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'DellasNailsBooking/1.0' },
      });
      if (!res.ok) throw new Error(`Calendar address returned ${res.status}`);
      const text = await res.text();
      if (!text.includes('BEGIN:VCALENDAR')) throw new Error("That address isn't an iCal calendar");
      const busy = busyFromIcs(text, { timeZone, from: today, to: addDays(today, windowDays + 1) });
      cache = { url, busy, fetchedAt: Date.now(), error: null, lastSuccess: Date.now() };
    } catch (err) {
      console.warn(`Could not read Della's calendar: ${err.message}`);
      // Keep the last good copy if the address hasn't changed.
      const keep = cache.url === url ? cache.busy : new Map();
      cache = {
        url,
        busy: keep,
        fetchedAt: Date.now(),
        error: err.message,
        lastSuccess: cache.url === url ? cache.lastSuccess : null,
      };
    }
  }

  function ensureFresh() {
    const stale = cache.url !== (getUrl() || null) || Date.now() - cache.fetchedAt > maxAgeMs;
    if (stale && !inFlight) inFlight = refresh().finally(() => { inFlight = null; });
    return inFlight || Promise.resolve();
  }

  return {
    ensureFresh,
    refreshNow: () => { cache.fetchedAt = 0; return ensureFresh(); },
    blocksFor: (date) => cache.busy.get(date) || [],
    status: () => ({ connected: !!cache.url, error: cache.error, lastSuccess: cache.lastSuccess }),
  };
}

// ---------- publishing bookings ----------

// Convert a local date + time in `timeZone` to a UTC Date.
function localToUtc(date, time, timeZone) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let result = guess;
  for (let i = 0; i < 2; i++) {
    const local = nowInTimeZone(timeZone, new Date(result));
    const localMs = Date.UTC(...local.date.split('-').map((n, j) => (j === 1 ? n - 1 : Number(n))),
      0, local.minutes);
    result += guess - localMs;
  }
  return new Date(result);
}

function icsDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Fold lines longer than 75 bytes, as the iCal spec requires.
function fold(line) {
  const bytes = Buffer.from(line);
  if (bytes.length <= 75) return line;
  const parts = [];
  let current = '';
  for (const ch of line) {
    const limit = parts.length ? 74 : 75;
    if (Buffer.byteLength(current + ch) > limit) {
      parts.push(current);
      current = '';
    }
    current += ch;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function bookingsToIcs(bookings, { timeZone, calendarName, currencySymbol }) {
  const stamp = icsDate(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dellas Nails//Bookings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(calendarName)}`,
    `X-WR-TIMEZONE:${timeZone}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
  ];
  for (const b of bookings) {
    const start = localToUtc(b.date, b.time, timeZone);
    const end = new Date(start.getTime() + b.duration * 60000);
    const description = [
      b.service_name,
      `${currencySymbol}${b.price}`,
      `Phone: ${b.phone}`,
      b.email && `Email: ${b.email}`,
      b.notes && `Notes: ${b.notes}`,
      `Ref: ${b.ref}`,
    ].filter(Boolean).join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${b.ref}@${FEED_UID_DOMAIN}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsText(`💅 ${b.name}: ${b.service_name}`)}`,
      `DESCRIPTION:${icsText(description)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

module.exports = { busyFromIcs, createBusyCalendar, bookingsToIcs, localToUtc, FEED_UID_DOMAIN };
