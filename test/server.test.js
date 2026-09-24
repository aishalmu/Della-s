const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/db');
const { createApp } = require('../src/server');
const config = require('../config.json');

// Wednesday 1 Oct 2026, 09:00 in London.
const clock = () => new Date('2026-10-01T08:00:00Z');

// Stand-in for Della's own calendar: busy 13:00-14:00 on Tue 6 Oct.
const fakeCalendar = {
  ensureFresh: async () => {},
  refreshNow: async () => {},
  blocksFor: (date) => (date === '2026-10-06' ? [{ start: '13:00', end: '14:00' }] : []),
  status: () => ({ connected: true, error: null, lastSuccess: Date.now() }),
};

async function withServer(fn) {
  const db = openDatabase(':memory:');
  const app = createApp({ db, config, adminPassword: 'secret', clock, busyCalendar: fakeCalendar });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { method = 'GET', body, cookie } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body && JSON.stringify(body),
    });
    const text = await res.text();
    const isJson = (res.headers.get('content-type') || '').includes('json');
    return { status: res.status, body: isJson ? JSON.parse(text) : text, headers: res.headers };
  };
  try {
    await fn(call);
  } finally {
    server.close();
  }
}

const booking = (serviceId, extra = {}) => ({
  items: [{ serviceId }], date: '2026-10-06', time: '08:00', name: 'Amy', phone: '07700 900123', ...extra,
});

test('price list includes add-ons, which cannot be booked alone', () =>
  withServer(async (call) => {
    const { body } = await call('/api/services');
    assert.equal(body.length, 13);
    const addOn = body.find((s) => s.price_note === 'per nail');
    assert.equal(addOn.bookable, 0);
    const res = await call(`/api/availability?items=${addOn.id}&date=2026-10-06`);
    assert.equal(res.status, 400);
    const alone = await call('/api/bookings', { method: 'POST', body: booking(addOn.id) });
    assert.equal(alone.status, 400);
  }));

test('booking removes the slot and prevents double booking', () =>
  withServer(async (call) => {
    const services = (await call('/api/services')).body;
    const biab = services.find((s) => s.name === 'Plain BIAB');
    let slots = (await call(`/api/availability?items=${biab.id}&date=2026-10-06`)).body;
    assert.equal(slots[0], '08:00');

    const first = await call('/api/bookings', { method: 'POST', body: booking(biab.id) });
    assert.equal(first.status, 201);
    assert.match(first.body.ref, /^[0-9A-F]{6}$/);

    const again = await call('/api/bookings', { method: 'POST', body: booking(biab.id, { time: '08:30' }) });
    assert.equal(again.status, 409);

    slots = (await call(`/api/availability?items=${biab.id}&date=2026-10-06`)).body;
    assert.equal(slots[0], '09:00');
  }));

test('closed days and validation', () =>
  withServer(async (call) => {
    const id = (await call('/api/services')).body[0].id;
    const days = (await call(`/api/availability/days?items=${id}&from=2026-10-04&to=2026-10-07`)).body;
    assert.deepEqual(days, { '2026-10-04': false, '2026-10-05': false, '2026-10-06': true, '2026-10-07': true });
    const bad = await call('/api/bookings', { method: 'POST', body: booking(id, { phone: 'abc' }) });
    assert.equal(bad.status, 400);
  }));

test('admin requires login and can block time and edit prices', () =>
  withServer(async (call) => {
    assert.equal((await call('/api/admin/bookings')).status, 401);
    assert.equal((await call('/api/admin/login', { method: 'POST', body: { password: 'nope' } })).status, 401);
    const login = await call('/api/admin/login', { method: 'POST', body: { password: 'secret' } });
    const cookie = login.headers.get('set-cookie').split(';')[0];

    const id = (await call('/api/services')).body[0].id;
    await call('/api/admin/blocks', { method: 'POST', cookie, body: { date: '2026-10-06' } });
    const slots = (await call(`/api/availability?items=${id}&date=2026-10-06`)).body;
    assert.deepEqual(slots, []);

    const upd = await call(`/api/admin/services/${id}`, {
      method: 'PUT', cookie,
      body: { category: 'BIAB Treatments', name: 'Gel Polish', price: 16, duration: 45 },
    });
    assert.equal(upd.status, 200);
    assert.equal((await call('/api/services')).body[0].price, 16);

    const hours = await call('/api/admin/hours', { method: 'PUT', cookie, body: { 2: { open: '10:00', close: '09:00' } } });
    assert.equal(hours.status, 400);
  }));

test('several treatments in one booking add up time and price', () =>
  withServer(async (call) => {
    const services = (await call('/api/services')).body;
    const biab = services.find((s) => s.name === 'Plain BIAB'); // 60 min, £18
    const toes = services.find((s) => s.name === 'Plain BIAB Toes'); // 45 min, £18
    const repair = services.find((s) => s.price_note === 'per nail'); // 5 min, £2 per nail

    const items = `${biab.id},${toes.id},${repair.id}x3`;
    const slots = (await call(`/api/availability?items=${items}&date=2026-10-06`)).body;
    // 120 minutes long: must finish by the 13:00 calendar event or start after it, and by 15:00 close.
    assert.ok(slots.includes('11:00'));
    assert.ok(!slots.includes('11:15'));
    assert.ok(!slots.includes('13:15'));

    const res = await call('/api/bookings', {
      method: 'POST',
      body: {
        items: [{ serviceId: biab.id }, { serviceId: toes.id }, { serviceId: repair.id, qty: 3 }],
        date: '2026-10-06', time: '08:00', name: 'Amy', phone: '07700 900123',
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.price, 42);
    assert.equal(res.body.duration, 120);
    assert.equal(res.body.service, 'Plain BIAB + Plain BIAB Toes + Nail Repair / Extension ×3');
  }));

test('bookings feed is private and lists confirmed bookings', () =>
  withServer(async (call) => {
    const id = (await call('/api/services')).body[0].id;
    await call('/api/bookings', { method: 'POST', body: booking(id, { notes: 'Pink, please; thanks' }) });

    const login = await call('/api/admin/login', { method: 'POST', body: { password: 'secret' } });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const { feedPath } = (await call('/api/admin/calendar', { cookie })).body;

    assert.equal((await call('/calendar/not-the-token.ics')).status, 404);
    const feed = await call(feedPath);
    assert.equal(feed.status, 200);
    assert.match(feed.headers.get('content-type'), /text\/calendar/);
    assert.match(feed.body, /DTSTART:20261006T070000Z/); // 08:00 London summer time
    assert.match(feed.body, /Amy: Gel Polish/);
    const unfolded = feed.body.replace(/\r\n /g, '');
    assert.match(unfolded, /Notes: Pink\\, please\\; thanks/);

    // A new link stops the old one working.
    const reset = await call('/api/admin/calendar/reset-feed', { method: 'POST', cookie });
    assert.notEqual(reset.body.feedPath, feedPath);
    assert.equal((await call(feedPath)).status, 404);

    const bad = await call('/api/admin/calendar', { method: 'PUT', cookie, body: { busyUrl: 'not a link' } });
    assert.equal(bad.status, 400);
  }));
