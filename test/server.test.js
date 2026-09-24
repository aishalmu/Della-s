const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/db');
const { createApp } = require('../src/server');
const config = require('../config.json');

// Wednesday 1 Oct 2026, 09:00 in London.
const clock = () => new Date('2026-10-01T08:00:00Z');

async function withServer(fn) {
  const db = openDatabase(':memory:');
  const app = createApp({ db, config, adminPassword: 'secret', clock });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { method = 'GET', body, cookie } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body && JSON.stringify(body),
    });
    return { status: res.status, body: await res.json(), headers: res.headers };
  };
  try {
    await fn(call);
  } finally {
    server.close();
  }
}

const booking = (serviceId, extra = {}) => ({
  serviceId, date: '2026-10-06', time: '08:00', name: 'Amy', phone: '07700 900123', ...extra,
});

test('price list includes add-ons, which cannot be booked alone', () =>
  withServer(async (call) => {
    const { body } = await call('/api/services');
    assert.equal(body.length, 13);
    const addOn = body.find((s) => s.price_note === 'per nail');
    assert.equal(addOn.bookable, 0);
    const res = await call('/api/availability?serviceId=' + addOn.id + '&date=2026-10-06');
    assert.equal(res.status, 400);
  }));

test('booking removes the slot and prevents double booking', () =>
  withServer(async (call) => {
    const services = (await call('/api/services')).body;
    const biab = services.find((s) => s.name === 'Plain BIAB');
    let slots = (await call(`/api/availability?serviceId=${biab.id}&date=2026-10-06`)).body;
    assert.equal(slots[0], '08:00');

    const first = await call('/api/bookings', { method: 'POST', body: booking(biab.id) });
    assert.equal(first.status, 201);
    assert.match(first.body.ref, /^[0-9A-F]{6}$/);

    const again = await call('/api/bookings', { method: 'POST', body: booking(biab.id, { time: '08:30' }) });
    assert.equal(again.status, 409);

    slots = (await call(`/api/availability?serviceId=${biab.id}&date=2026-10-06`)).body;
    assert.equal(slots[0], '09:00');
  }));

test('closed days and validation', () =>
  withServer(async (call) => {
    const id = (await call('/api/services')).body[0].id;
    const days = (await call(`/api/availability/days?serviceId=${id}&from=2026-10-04&to=2026-10-07`)).body;
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
    const slots = (await call(`/api/availability?serviceId=${id}&date=2026-10-06`)).body;
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
