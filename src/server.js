const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const { openDatabase } = require('./db');
const { weekday, addDays, nowInTimeZone, getSlots, toMinutes } = require('./availability');
const { createBusyCalendar, bookingsToIcs } = require('./calendar');
const { createStripe } = require('./payments');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const SESSION_HOURS = 12;
const MAX_ITEMS = 8;
const MAX_QTY = 10;
// A slot is held while the client pays. Stripe's shortest checkout lifetime is 30 minutes.
const CHECKOUT_MINUTES = 31;
const HOLD_GRACE_MS = 5 * 60 * 1000;

function createApp({ db, config, adminPassword, clock = () => new Date(), busyCalendar, stripe, publicUrl }) {
  const app = express();
  app.use(express.json({ limit: '20kb' }));
  // extensions: lets /prices serve prices.html
  app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

  const sessionSecret = crypto.randomBytes(32);

  // ---------- helpers ----------

  const getSetting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
  const setSetting = (key, value) =>
    db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ).run(key, value);

  const getHours = () => JSON.parse(getSetting('hours'));

  if (!getSetting('feed_token')) setSetting('feed_token', crypto.randomBytes(18).toString('base64url'));

  const now = () => nowInTimeZone(config.timezone, clock());
  const lastBookableDate = () => addDays(now().date, config.bookingWindowDays);

  const calendar =
    busyCalendar ||
    createBusyCalendar({
      getUrl: () => getSetting('busy_calendar_url') || '',
      timeZone: config.timezone,
      windowDays: config.bookingWindowDays,
    });

  // Deposits are taken only when Stripe is set up and a deposit amount is configured.
  const depositAmount = stripe ? Number(config.depositAmount) || 0 : 0;

  // Confirmed bookings, plus ones still waiting for their deposit to be paid.
  const takenSql = `SELECT id, time, duration FROM bookings WHERE date = ?
    AND (status = 'confirmed' OR (status = 'pending' AND expires_at > ?))`;

  function slotsFor(date, duration) {
    if (date > lastBookableDate()) return [];
    const bookings = db.prepare(takenSql).all(date, clock().getTime() - HOLD_GRACE_MS);
    const blocks = [
      ...db.prepare('SELECT start, end FROM blocks WHERE date = ?').all(date),
      ...calendar.blocksFor(date),
    ];
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

  const perNail = (service) => /\bper\b/i.test(service.price_note);

  // Validate a basket of treatments: [{ serviceId, qty }].
  // Returns { items, duration, price, label } or { error }.
  function resolveItems(input) {
    if (!Array.isArray(input) || input.length === 0) return { error: 'Please choose a treatment.' };
    if (input.length > MAX_ITEMS) return { error: `Please choose up to ${MAX_ITEMS} treatments.` };
    const seen = new Set();
    const items = [];
    for (const raw of input) {
      const service = db
        .prepare('SELECT * FROM services WHERE id = ? AND active = 1')
        .get(Number(raw?.serviceId));
      if (!service || seen.has(service.id)) return { error: 'Please choose your treatments again.' };
      seen.add(service.id);
      // Only "per nail" style prices take a quantity; everything else is one each.
      const qty = perNail(service) ? Math.min(Math.max(parseInt(raw.qty, 10) || 1, 1), MAX_QTY) : 1;
      items.push({ service, qty });
    }
    if (!items.some((i) => i.service.bookable)) {
      return { error: 'Extras need to go with a main treatment. Please add one.' };
    }
    const duration = items.reduce((t, i) => t + i.service.duration * (perNail(i.service) ? i.qty : 1), 0);
    const price = items.reduce((t, i) => t + i.service.price * i.qty, 0);
    const label = items
      .map((i) => (i.qty > 1 ? `${i.service.name} ×${i.qty}` : i.service.name))
      .join(' + ');
    return { items, duration, price: Math.round(price * 100) / 100, label };
  }

  // Query-string form of a basket: "3,5,12x2".
  function parseItemsQuery(value) {
    return String(value || '')
      .split(',')
      .filter(Boolean)
      .map((part) => {
        const [serviceId, qty] = part.split('x');
        return { serviceId, qty };
      });
  }

  function badRequest(res, message) {
    res.status(400).json({ error: message });
  }

  function cleanText(value, max) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
  }

  // ---------- public API ----------

  app.get('/api/info', (req, res) => {
    res.json({
      ...config,
      depositAmount,
      hours: getHours(),
      today: now().date,
      lastDate: lastBookableDate(),
    });
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
  app.get('/api/availability/days', async (req, res) => {
    const { from, to } = req.query;
    const basket = resolveItems(parseItemsQuery(req.query.items));
    if (basket.error) return badRequest(res, basket.error);
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) return badRequest(res, 'Invalid date range');
    await calendar.ensureFresh();
    const days = {};
    for (let d = from, i = 0; d <= to && i < 62; d = addDays(d, 1), i++) {
      days[d] = slotsFor(d, basket.duration).length > 0;
    }
    res.json(days);
  });

  app.get('/api/availability', async (req, res) => {
    const { date } = req.query;
    const basket = resolveItems(parseItemsQuery(req.query.items));
    if (basket.error) return badRequest(res, basket.error);
    if (!DATE_RE.test(date)) return badRequest(res, 'Invalid date');
    await calendar.ensureFresh();
    res.json(slotsFor(date, basket.duration));
  });

  app.post('/api/bookings', async (req, res) => {
    const body = req.body || {};
    const basket = resolveItems(body.items);
    const name = cleanText(body.name, 100);
    const phone = cleanText(body.phone, 30);
    const email = cleanText(body.email, 150);
    const notes = cleanText(body.notes, 500);

    if (basket.error) return badRequest(res, basket.error);
    if (!DATE_RE.test(body.date) || !TIME_RE.test(body.time)) {
      return badRequest(res, 'Please choose a date and time.');
    }
    if (!name) return badRequest(res, 'Please enter your name.');
    if (!/^[+\d][\d\s()-]{6,}$/.test(phone)) return badRequest(res, 'Please enter a valid phone number.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return badRequest(res, 'Please enter a valid email address.');
    }

    await calendar.ensureFresh();

    // Re-check and insert atomically so two people can't grab the same slot.
    let bookingId;
    db.exec('BEGIN IMMEDIATE');
    try {
      if (!slotsFor(body.date, basket.duration).includes(body.time)) {
        db.exec('ROLLBACK');
        return res
          .status(409)
          .json({ error: 'Sorry, that time has just been taken. Please pick another.' });
      }
      const ref = crypto.randomBytes(3).toString('hex').toUpperCase();
      const main = basket.items.find((i) => i.service.bookable).service;
      const deposit = Math.min(depositAmount, basket.price);
      const { lastInsertRowid } = db.prepare(
        `INSERT INTO bookings (ref, service_id, service_name, price, date, time, duration, name, phone, email, notes,
           status, deposit, cancel_token, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(ref, main.id, basket.label, basket.price, body.date, body.time,
        basket.duration, name, phone, email, notes,
        deposit > 0 ? 'pending' : 'confirmed', deposit,
        crypto.randomBytes(12).toString('base64url'),
        clock().getTime() + CHECKOUT_MINUTES * 60 * 1000);
      const addItem = db.prepare(
        'INSERT INTO booking_items (booking_id, service_id, name, price, qty) VALUES (?, ?, ?, ?, ?)',
      );
      for (const { service, qty } of basket.items) {
        addItem.run(lastInsertRowid, service.id, service.name, service.price, qty);
      }
      bookingId = lastInsertRowid;
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
    if (booking.status === 'confirmed') return res.status(201).json(summary(booking));

    // Send the client to Stripe to pay the deposit; the slot is held meanwhile.
    try {
      const session = await createCheckout(booking, baseUrl(req));
      db.prepare('UPDATE bookings SET stripe_session = ? WHERE id = ?').run(session.id, booking.id);
      res.status(201).json({ ref: booking.ref, checkoutUrl: session.url });
    } catch (err) {
      console.error(`Stripe checkout failed: ${err.message}`);
      db.prepare("UPDATE bookings SET status = 'expired' WHERE id = ?").run(booking.id);
      res.status(502).json({
        error: "Sorry, card payments aren't working right now. Please message Della on WhatsApp to book.",
      });
    }
  });

  // ---------- deposits ----------

  function summary(b) {
    return {
      ref: b.ref,
      status: b.status,
      service: b.service_name,
      price: b.price,
      deposit: b.deposit_paid,
      date: b.date,
      time: b.time,
      duration: b.duration,
    };
  }

  function baseUrl(req) {
    return (publicUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  }

  const fmtDate = (iso) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
    });

  function createCheckout(b, base) {
    return stripe.createCheckoutSession({
      mode: 'payment',
      client_reference_id: b.ref,
      customer_email: b.email || undefined,
      line_items: {
        0: {
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: Math.round(b.deposit * 100),
            product_data: {
              name: `Deposit for ${config.businessName} ${config.businessSubtitle}`.trim(),
              description: `${b.service_name} on ${fmtDate(b.date)} at ${b.time}. ` +
                `${config.currencySymbol}${b.price - b.deposit} left to pay on the day.`,
            },
          },
        },
      },
      payment_intent_data: { description: `Booking ${b.ref}: ${b.name}, ${b.date} ${b.time}` },
      metadata: { booking_ref: b.ref },
      expires_at: Math.floor(b.expires_at / 1000),
      success_url: `${base}/book?paid=${b.ref}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/book?cancelled=${b.ref}&t=${b.cancel_token}`,
    });
  }

  // Bring a pending booking up to date with its Stripe checkout.
  async function syncPayment(b) {
    if (b.status !== 'pending' || !b.stripe_session) return b;
    const session = await stripe.retrieveCheckoutSession(b.stripe_session);
    if (session.payment_status === 'paid') {
      db.prepare(
        "UPDATE bookings SET status = 'confirmed', deposit_paid = ? WHERE id = ? AND status = 'pending'",
      ).run((session.amount_total ?? b.deposit * 100) / 100, b.id);
    } else if (session.status === 'expired') {
      db.prepare("UPDATE bookings SET status = 'expired' WHERE id = ? AND status = 'pending'").run(b.id);
    }
    return db.prepare('SELECT * FROM bookings WHERE id = ?').get(b.id);
  }

  // Catch payments where the client closed the page before coming back,
  // and release holds that were never paid.
  async function sweepPayments() {
    if (!stripe) return;
    const stale = db
      .prepare("SELECT * FROM bookings WHERE status = 'pending' AND expires_at < ?")
      .all(clock().getTime());
    for (const b of stale) {
      if (!b.stripe_session) {
        db.prepare("UPDATE bookings SET status = 'expired' WHERE id = ?").run(b.id);
        continue;
      }
      try {
        await syncPayment(b);
      } catch (err) {
        console.warn(`Could not check payment for ${b.ref}: ${err.message}`);
      }
    }
  }
  app.locals.sweepPayments = sweepPayments;

  // The client lands here after paying on Stripe.
  app.get('/api/bookings/:ref/payment', async (req, res) => {
    const b = db.prepare('SELECT * FROM bookings WHERE ref = ?').get(String(req.params.ref));
    if (!b || !b.stripe_session || b.stripe_session !== String(req.query.session_id || '')) {
      return res.status(404).json({ error: "We couldn't find that booking." });
    }
    try {
      res.json(summary(await syncPayment(b)));
    } catch (err) {
      console.error(`Stripe check failed: ${err.message}`);
      res.json(summary(b));
    }
  });

  // The client pressed "back" on the Stripe page: release the slot straight away.
  app.post('/api/bookings/:ref/abandon', async (req, res) => {
    const b = db.prepare('SELECT * FROM bookings WHERE ref = ?').get(String(req.params.ref));
    const token = String(req.body?.token || '');
    if (!b || !b.cancel_token || b.cancel_token !== token || b.status !== 'pending') {
      return res.json({ ok: true });
    }
    try {
      await stripe.expireCheckoutSession(b.stripe_session);
      db.prepare("UPDATE bookings SET status = 'expired' WHERE id = ? AND status = 'pending'").run(b.id);
    } catch {
      // Already completed or expired: let Stripe's answer decide.
      await syncPayment(b).catch(() => {});
    }
    res.json({ ok: true });
  });

  // Bookings feed for Della's phone calendar. The token in the address is the only key.
  app.get('/calendar/:token.ics', (req, res) => {
    const expected = Buffer.from(getSetting('feed_token'));
    const given = Buffer.from(String(req.params.token));
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
      return res.status(404).send('Not found');
    }
    const bookings = db
      .prepare("SELECT * FROM bookings WHERE status = 'confirmed' AND date >= ? ORDER BY date, time")
      .all(addDays(now().date, -60));
    res.type('text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(bookingsToIcs(bookings, {
      timeZone: config.timezone,
      calendarName: `${config.businessName} bookings`,
      currencySymbol: config.currencySymbol,
    }));
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
      .prepare(takenSql)
      .all(booking.date, clock().getTime() - HOLD_GRACE_MS)
      .filter((o) => o.id !== booking.id);
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

  app.get('/api/admin/calendar', async (req, res) => {
    await calendar.ensureFresh();
    res.json({
      feedPath: `/calendar/${getSetting('feed_token')}.ics`,
      busyUrl: getSetting('busy_calendar_url') || '',
      status: calendar.status(),
    });
  });

  app.put('/api/admin/calendar', async (req, res) => {
    const url = cleanText(req.body?.busyUrl, 2000);
    if (url && !/^(https|webcals?):\/\/\S+$/i.test(url)) {
      return badRequest(res, 'That should be a web address starting with https:// or webcal://');
    }
    setSetting('busy_calendar_url', url);
    await calendar.refreshNow();
    res.json({ status: calendar.status() });
  });

  // Makes a new feed address, so anyone with the old one loses access.
  app.post('/api/admin/calendar/reset-feed', (req, res) => {
    setSetting('feed_token', crypto.randomBytes(18).toString('base64url'));
    res.json({ feedPath: `/calendar/${getSetting('feed_token')}.ics` });
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
  const stripe = process.env.STRIPE_SECRET_KEY ? createStripe(process.env.STRIPE_SECRET_KEY) : null;
  const app = createApp({ db, config, adminPassword, stripe, publicUrl: process.env.PUBLIC_URL });
  if (process.env.TRUST_PROXY) app.set('trust proxy', 1);
  if (stripe) {
    console.log(`Card deposits are on (${config.currencySymbol}${config.depositAmount}).`);
    setInterval(() => app.locals.sweepPayments().catch(console.error), 60 * 1000).unref();
  }
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`${config.businessName} running at http://localhost:${port}`));
}

module.exports = { createApp };
