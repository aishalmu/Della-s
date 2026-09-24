const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const { openDatabase } = require('./db');
const { weekday, addDays, nowInTimeZone, getSlots, toMinutes } = require('./availability');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const SESSION_HOURS = 12;

function createApp({ db, config, adminPassword, clock = () => new Date() }) {
  const app = express();
  app.use(express.json({ limit: '20kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  const sessionSecret = crypto.randomBytes(32);

  // ---------- helpers ----------

  const getHours = () =>
    JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'hours'").get().value);

  const now = () => nowInTimeZone(config.timezone, clock());
  const lastBookableDate = () => addDays(now().date, config.bookingWindowDays);

  function slotsFor(date, duration, { excludeBookingId } = {}) {
    if (date > lastBookableDate()) return [];
    const bookings = db
      .prepare(
        "SELECT id, time, duration FROM bookings WHERE date = ? AND status = 'confirmed'",
      )
      .all(date)
      .filter((b) => b.id !== excludeBookingId);
    const blocks = db.prepare('SELECT start, end FROM blocks WHERE date = ?').all(date);
    return getSlots({
      date,
      duration,
      hours: getHours()[weekday(date)],
      bookings,
      blocks,
      interval: config.slotIntervalMinutes,
      now: now(),
      minNoticeMinutes: config.minNoticeHours * 60,
    });
  }

  const activeService = (id) =>
    db
      .prepare('SELECT * FROM services WHERE id = ? AND active = 1 AND bookable = 1')
      .get(Number(id));

  function badRequest(res, message) {
    res.status(400).json({ error: message });
  }

  function cleanText(value, max) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
  }

  // ---------- public API ----------

  app.get('/api/info', (req, res) => {
    res.json({ ...config, hours: getHours(), today: now().date, lastDate: lastBookableDate() });
  });

  app.get('/api/services', (req, res) => {
    res.json(
      db
        .prepare(
          'SELECT id, category, name, description, price, price_note, duration, bookable FROM services WHERE active = 1 ORDER BY sort, id',
        )
        .all(),
    );
  });

  // Which days between `from` and `to` have at least one free slot.
  app.get('/api/availability/days', (req, res) => {
    const { serviceId, from, to } = req.query;
    const service = activeService(serviceId);
    if (!service) return badRequest(res, 'Unknown service');
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) return badRequest(res, 'Invalid date range');
    const days = {};
    for (let d = from, i = 0; d <= to && i < 62; d = addDays(d, 1), i++) {
      days[d] = slotsFor(d, service.duration).length > 0;
    }
    res.json(days);
  });

  app.get('/api/availability', (req, res) => {
    const { serviceId, date } = req.query;
    const service = activeService(serviceId);
    if (!service) return badRequest(res, 'Unknown service');
    if (!DATE_RE.test(date)) return badRequest(res, 'Invalid date');
    res.json(slotsFor(date, service.duration));
  });

  app.post('/api/bookings', (req, res) => {
    const body = req.body || {};
    const service = activeService(body.serviceId);
    const name = cleanText(body.name, 100);
    const phone = cleanText(body.phone, 30);
    const email = cleanText(body.email, 150);
    const notes = cleanText(body.notes, 500);

    if (!service) return badRequest(res, 'Please choose a treatment.');
    if (!DATE_RE.test(body.date) || !TIME_RE.test(body.time)) {
      return badRequest(res, 'Please choose a date and time.');
    }
    if (!name) return badRequest(res, 'Please enter your name.');
    if (!/^[+\d][\d\s()-]{6,}$/.test(phone)) return badRequest(res, 'Please enter a valid phone number.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return badRequest(res, 'Please enter a valid email address.');
    }

    // Re-check and insert atomically so two people can't grab the same slot.
    db.exec('BEGIN IMMEDIATE');
    try {
      if (!slotsFor(body.date, service.duration).includes(body.time)) {
        db.exec('ROLLBACK');
        return res
          .status(409)
          .json({ error: 'Sorry, that time has just been taken. Please pick another.' });
      }
      const ref = crypto.randomBytes(3).toString('hex').toUpperCase();
      db.prepare(
        `INSERT INTO bookings (ref, service_id, service_name, price, date, time, duration, name, phone, email, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(ref, service.id, service.name, service.price, body.date, body.time,
        service.duration, name, phone, email, notes);
      db.exec('COMMIT');
      res.status(201).json({
        ref,
        service: service.name,
        price: service.price,
        date: body.date,
        time: body.time,
        duration: service.duration,
      });
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  });

  // ---------- admin ----------

  function sign(expires) {
    return crypto.createHmac('sha256', sessionSecret).update(String(expires)).digest('hex');
  }

  function isLoggedIn(req) {
    const cookie = (req.headers.cookie || '')
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('admin='));
    if (!cookie) return false;
    const [expires, sig] = cookie.slice(6).split('.');
    if (!expires || !sig || Number(expires) < Date.now()) return false;
    const expected = sign(expires);
    return (
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    );
  }

  function passwordMatches(given) {
    const a = crypto.createHash('sha256').update(String(given || '')).digest();
    const b = crypto.createHash('sha256').update(adminPassword).digest();
    return crypto.timingSafeEqual(a, b);
  }

  let failedLogins = [];
  app.post('/api/admin/login', (req, res) => {
    const cutoff = Date.now() - 15 * 60 * 1000;
    failedLogins = failedLogins.filter((t) => t > cutoff);
    if (failedLogins.length >= 10) {
      return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    }
    if (!passwordMatches(req.body?.password)) {
      failedLogins.push(Date.now());
      return res.status(401).json({ error: 'Wrong password.' });
    }
    const expires = Date.now() + SESSION_HOURS * 3600 * 1000;
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `admin=${expires}.${sign(expires)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}${secure}`,
    );
    res.json({ ok: true });
  });

  app.post('/api/admin/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    res.json({ ok: true });
  });

  app.use('/api/admin', (req, res, next) => {
    if (!isLoggedIn(req)) return res.status(401).json({ error: 'Please log in.' });
    next();
  });

  app.get('/api/admin/me', (req, res) => res.json({ ok: true }));

  app.get('/api/admin/bookings', (req, res) => {
    const from = DATE_RE.test(req.query.from) ? req.query.from : now().date;
    res.json(
      db
        .prepare('SELECT * FROM bookings WHERE date >= ? ORDER BY date, time')
        .all(from),
    );
  });

  app.post('/api/admin/bookings/:id/cancel', (req, res) => {
    db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post('/api/admin/bookings/:id/restore', (req, res) => {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(Number(req.params.id));
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    // Simple overlap check against other confirmed bookings.
    const others = db
      .prepare("SELECT time, duration FROM bookings WHERE date = ? AND status = 'confirmed' AND id != ?")
      .all(booking.date, booking.id);
    const start = toMinutes(booking.time);
    const end = start + booking.duration;
    if (others.some((o) => start < toMinutes(o.time) + o.duration && toMinutes(o.time) < end)) {
      return res.status(409).json({ error: 'That time now overlaps another booking.' });
    }
    db.prepare("UPDATE bookings SET status = 'confirmed' WHERE id = ?").run(booking.id);
    res.json({ ok: true });
  });

  app.get('/api/admin/services', (req, res) => {
    res.json(db.prepare('SELECT * FROM services ORDER BY sort, id').all());
  });

  function readService(body) {
    const service = {
      category: cleanText(body.category, 50),
      name: cleanText(body.name, 100),
      description: cleanText(body.description, 300),
      price: Number(body.price),
      price_note: cleanText(body.price_note, 30),
      duration: Number(body.duration),
      bookable: body.bookable === false || body.bookable === 0 ? 0 : 1,
      active: body.active === false || body.active === 0 ? 0 : 1,
    };
    if (!service.name) return { error: 'Name is required.' };
    if (!Number.isFinite(service.price) || service.price < 0) return { error: 'Price must be a number.' };
    if (!Number.isInteger(service.duration) || service.duration < 5 || service.duration > 480) {
      return { error: 'Duration must be between 5 and 480 minutes.' };
    }
    return { service };
  }

  app.post('/api/admin/services', (req, res) => {
    const { service, error } = readService(req.body || {});
    if (error) return badRequest(res, error);
    const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM services').get().n;
    const result = db
      .prepare(
        `INSERT INTO services (category, name, description, price, price_note, duration, bookable, active, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(service.category, service.name, service.description, service.price, service.price_note,
        service.duration, service.bookable, service.active, sort);
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });

  app.put('/api/admin/services/:id', (req, res) => {
    const { service, error } = readService(req.body || {});
    if (error) return badRequest(res, error);
    db.prepare(
      `UPDATE services SET category = ?, name = ?, description = ?, price = ?, price_note = ?,
         duration = ?, bookable = ?, active = ? WHERE id = ?`,
    ).run(service.category, service.name, service.description, service.price, service.price_note,
      service.duration, service.bookable, service.active, Number(req.params.id));
    res.json({ ok: true });
  });

  app.delete('/api/admin/services/:id', (req, res) => {
    const id = Number(req.params.id);
    const used = db.prepare('SELECT 1 FROM bookings WHERE service_id = ? LIMIT 1').get(id);
    if (used) {
      // Keep it for booking history; just hide it from the site.
      db.prepare('UPDATE services SET active = 0 WHERE id = ?').run(id);
    } else {
      db.prepare('DELETE FROM services WHERE id = ?').run(id);
    }
    res.json({ ok: true });
  });

  app.put('/api/admin/hours', (req, res) => {
    const input = req.body || {};
    const hours = {};
    for (let day = 0; day < 7; day++) {
      const h = input[day];
      if (!h) {
        hours[day] = null;
        continue;
      }
      if (!TIME_RE.test(h.open) || !TIME_RE.test(h.close) || h.open >= h.close) {
        return badRequest(res, 'Each open day needs an opening time before its closing time.');
      }
      hours[day] = { open: h.open, close: h.close };
    }
    db.prepare("UPDATE settings SET value = ? WHERE key = 'hours'").run(JSON.stringify(hours));
    res.json({ ok: true });
  });

  app.get('/api/admin/blocks', (req, res) => {
    res.json(
      db.prepare('SELECT * FROM blocks WHERE date >= ? ORDER BY date, start').all(now().date),
    );
  });

  app.post('/api/admin/blocks', (req, res) => {
    const { date, endDate, start, end } = req.body || {};
    const reason = cleanText(req.body?.reason, 100);
    if (!DATE_RE.test(date)) return badRequest(res, 'Please choose a date.');
    const last = endDate && DATE_RE.test(endDate) ? endDate : date;
    if (last < date) return badRequest(res, 'The end date is before the start date.');
    const partDay = start || end;
    if (partDay && (!TIME_RE.test(start) || !TIME_RE.test(end) || start >= end)) {
      return badRequest(res, 'Start time must be before end time.');
    }
    const insert = db.prepare('INSERT INTO blocks (date, start, end, reason) VALUES (?, ?, ?, ?)');
    for (let d = date, i = 0; d <= last && i < 366; d = addDays(d, 1), i++) {
      insert.run(d, partDay ? start : null, partDay ? end : null, reason);
    }
    res.status(201).json({ ok: true });
  });

  app.delete('/api/admin/blocks/:id', (req, res) => {
    db.prepare('DELETE FROM blocks WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}

if (require.main === module) {
  const config = require('../config.json');
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('Set the ADMIN_PASSWORD environment variable before starting the site.');
    process.exit(1);
  }
  const dbFile = process.env.DATABASE_FILE || path.join(__dirname, '..', 'data', 'bookings.db');
  const db = openDatabase(dbFile);
  const app = createApp({ db, config, adminPassword });
  if (process.env.TRUST_PROXY) app.set('trust proxy', 1);
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`${config.businessName} running at http://localhost:${port}`));
}

module.exports = { createApp };
