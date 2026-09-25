// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, sessionToken } from './app.js';

let dist;
let server;
let base;
let clock = 0;

beforeAll(async () => {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-dist-'));
  fs.mkdirSync(path.join(dist, 'assets'));
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>planner</title>PLANNER');
  fs.writeFileSync(path.join(dist, 'assets', 'index-abc.js'), 'console.log(1)');
  fs.writeFileSync(path.join(dist, 'assets', 'jost-latin-400-normal-x.woff2'), 'font');
  fs.writeFileSync(path.join(dist, 'apple-touch-icon.png'), 'png');
  const app = createApp({ password: 'correct horse', distDir: dist, now: () => clock });
  await new Promise((r) => (server = app.listen(0, r)));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => {
  server.close();
  fs.rmSync(dist, { recursive: true, force: true });
});

const get = (p, headers = {}) => fetch(base + p, { redirect: 'manual', headers });
const login = (password) =>
  fetch(base + '/login', {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password }),
  });

describe('password gate', () => {
  it('sends visitors to the sign-in page', async () => {
    const r = await get('/', { accept: 'text/html' });
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('/login');
    const deep = await get('/some/deep/path', { accept: 'text/html' });
    expect(deep.headers.get('location')).toBe('/login');
    const page = await get('/login');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('Open my planner');
  });

  it('blocks app files without signing in', async () => {
    expect((await get('/assets/index-abc.js')).status).toBe(401);
    expect((await get('/index.html')).status).toBe(401);
  });

  it('keeps icons and fonts public for the sign-in page and home screen', async () => {
    expect((await get('/apple-touch-icon.png')).status).toBe(200);
    expect((await get('/assets/jost-latin-400-normal-x.woff2')).status).toBe(200);
    expect(await (await get('/robots.txt')).text()).toContain('Disallow: /');
  });

  it('rejects a wrong password', async () => {
    const r = await login('nope');
    expect(r.status).toBe(401);
    expect(r.headers.get('set-cookie')).toBeNull();
    expect(await r.text()).toContain('isn’t right');
  });

  it('signs in with the right password and serves the planner', async () => {
    const r = await login('correct horse');
    expect(r.status).toBe(303);
    const cookie = r.headers.get('set-cookie');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const jar = cookie.split(';')[0];
    const page = await get('/', { cookie: jar, accept: 'text/html' });
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('PLANNER');
    const asset = await get('/assets/index-abc.js', { cookie: jar });
    expect(asset.headers.get('cache-control')).toContain('immutable');
  });

  it('refuses a forged cookie', async () => {
    const r = await get('/', { cookie: 'ab_session=' + sessionToken('guess'), accept: 'text/html' });
    expect(r.status).toBe(303);
  });

  it('slows down repeated guessing', async () => {
    clock = 10_000_000;
    for (let i = 0; i < 10; i++) await login('wrong ' + i);
    expect((await login('correct horse')).status).toBe(429);
    clock += 16 * 60 * 1000;
    expect((await login('correct horse')).status).toBe(303);
  });
});
