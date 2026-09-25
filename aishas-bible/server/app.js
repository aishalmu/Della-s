// Serves the built planner (dist/) behind a password.
//
// The password lives in the APP_PASSWORD environment variable, never in the
// repo. Signing in sets a long-lived, signed, HttpOnly cookie. Changing
// APP_PASSWORD signs everyone out, because the cookie is derived from it.
//
// The planner's data never reaches this server: it stays on the device.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

const COOKIE = 'ab_session';
const COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60; // browsers cap cookies at 400 days
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

// Reachable without signing in: the login page, what it needs, and the icons
// iPad Safari fetches for "Add to Home Screen".
const PUBLIC_FILES = new Set(['/favicon.svg', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/manifest.webmanifest', '/robots.txt']);
const isPublicFont = (p) => /^\/assets\/[\w.-]+\.woff2$/.test(p);

const sha256 = (s) => crypto.createHash('sha256').update(s).digest();

export function sessionToken(password) {
  return crypto.createHmac('sha256', password).update('aishas-bible-session-v1').digest('base64url');
}

function safeEqual(a, b) {
  const x = sha256(String(a));
  const y = sha256(String(b));
  return crypto.timingSafeEqual(x, y);
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function fontFaces(distDir) {
  let files = [];
  try {
    files = fs.readdirSync(path.join(distDir, 'assets'));
  } catch {
    return '';
  }
  const find = (prefix) => files.find((f) => f.startsWith(prefix) && f.endsWith('.woff2'));
  const faces = [
    ['Cormorant Garamond', 'italic', 500, find('cormorant-garamond-latin-500-italic-')],
    ['Jost', 'normal', 400, find('jost-latin-400-normal-')],
  ];
  return faces
    .filter(([, , , f]) => f)
    .map(([family, style, weight, f]) => `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url(/assets/${f}) format('woff2')}`)
    .join('');
}

function loginPage({ error = '', fonts = '' }) {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#F4EEE3">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Aisha’s Bible">
<link rel="apple-touch-icon" href="./apple-touch-icon.png">
<link rel="icon" href="./favicon.svg" type="image/svg+xml">
<link rel="manifest" href="./manifest.webmanifest">
<title>Aisha’s Bible</title>
<style>
${fonts}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;height:100%}
body{display:flex;align-items:center;justify-content:center;padding:24px 16px;
background-color:#F4EEE3;background-image:repeating-linear-gradient(0deg,rgba(110,100,70,.045) 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,rgba(110,100,70,.04) 0 1px,transparent 1px 4px);
color:#2E3020;font-family:'Jost','Avenir Next','Helvetica Neue',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.card{width:min(380px,100%);background:#FFFBF4;border:1px solid #E3D9C2;border-radius:16px;box-shadow:0 14px 34px -22px rgba(59,63,39,.45);padding:32px 28px;display:flex;flex-direction:column;align-items:center;gap:20px;text-align:center}
.stamp{width:132px;height:132px;border-radius:50%;border:1.5px solid #B08582;box-shadow:inset 0 0 0 5px #FFFBF4,inset 0 0 0 6px #D8A7A4;display:flex;align-items:center;justify-content:center;transform:rotate(-7deg);font-family:'Cormorant Garamond','Iowan Old Style',Georgia,serif;font-style:italic;font-weight:500;font-size:26px;line-height:1;color:#3B3F27}
h1{margin:0;font-family:'Cormorant Garamond','Iowan Old Style',Georgia,serif;font-style:italic;font-weight:500;font-size:30px;color:#3B3F27}
form{width:100%;display:flex;flex-direction:column;gap:14px}
label{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#9C8F4E;text-align:left}
input{width:100%;margin-top:6px;font:inherit;font-size:17px;border:none;border-bottom:1px solid #E3D9C2;background:transparent;padding:10px 2px;outline:none;color:#2E3020;border-radius:0}
input:focus{border-bottom-color:#6B7045}
button{font:inherit;font-size:16px;padding:12px 20px;border-radius:999px;border:1px solid #6B7045;background:#6B7045;color:#FFFBF4;cursor:pointer}
button:focus-visible{outline:2px solid #9C8F4E;outline-offset:2px}
.err{font-size:14px;line-height:1.45;border-radius:10px;padding:10px 12px;background:#F3DEDC;color:#7A3B37;text-align:left}
</style>
</head>
<body>
<main class="card">
<div class="stamp">Aisha’s<br>Bible</div>
<h1>Welcome back</h1>
${error ? `<div class="err" role="alert">${escapeHtml(error)}</div>` : ''}
<form method="post" action="/login">
<label for="password">Password<input id="password" name="password" type="password" autocomplete="current-password" required autofocus></label>
<button type="submit">Open my planner</button>
</form>
</main>
</body>
</html>`;
}

/**
 * @param {{ password: string, distDir: string, trustProxy?: boolean, now?: () => number }} opts
 */
export function createApp({ password, distDir, trustProxy = false, now = Date.now }) {
  if (!password) throw new Error('APP_PASSWORD is not set');
  const token = sessionToken(password);
  const fonts = fontFaces(distDir);
  const attempts = new Map(); // ip -> { count, since }

  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    });
    next();
  });

  app.get('/healthz', (req, res) => res.type('text').send('ok'));
  app.get('/robots.txt', (req, res) => res.type('text').send('User-agent: *\nDisallow: /\n'));

  const signedIn = (req) => safeEqual(readCookie(req, COOKIE), token);

  app.get('/login', (req, res) => {
    if (signedIn(req)) return res.redirect(303, '/');
    res.set('Cache-Control', 'no-store').type('html').send(loginPage({ fonts }));
  });

  app.post('/login', express.urlencoded({ extended: false, limit: '2kb' }), (req, res) => {
    const ip = req.ip || 'unknown';
    const t = now();
    const a = attempts.get(ip);
    const recent = a && t - a.since < ATTEMPT_WINDOW_MS ? a : { count: 0, since: t };
    res.set('Cache-Control', 'no-store');
    if (recent.count >= MAX_ATTEMPTS) {
      return res.status(429).type('html').send(loginPage({ fonts, error: 'Too many tries. Wait 15 minutes, then try again.' }));
    }
    if (!safeEqual(req.body?.password ?? '', password)) {
      attempts.set(ip, { count: recent.count + 1, since: recent.since });
      return res.status(401).type('html').send(loginPage({ fonts, error: 'That password isn’t right. Try again.' }));
    }
    attempts.delete(ip);
    res.cookie(COOKIE, token, {
      httpOnly: true,
      secure: req.secure,
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE_S * 1000,
      path: '/',
    });
    res.redirect(303, '/');
  });

  // Everything else needs the cookie, apart from the few public files.
  app.use((req, res, next) => {
    if (PUBLIC_FILES.has(req.path) || isPublicFont(req.path) || signedIn(req)) return next();
    const wantsPage = req.method === 'GET' && (req.headers.accept || '').includes('text/html');
    if (wantsPage) return res.redirect(303, '/login');
    res.status(401).type('text').send('Sign in required');
  });

  app.use(
    express.static(distDir, {
      index: 'index.html',
      setHeaders(res, file) {
        if (file.includes(`${path.sep}assets${path.sep}`)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
        else res.set('Cache-Control', 'no-cache');
      },
    }),
  );

  // Unknown paths inside the app fall back to the planner itself.
  app.use((req, res) => {
    if (req.method !== 'GET') return res.status(404).end();
    res.set('Cache-Control', 'no-cache').sendFile(path.join(distDir, 'index.html'));
  });

  return app;
}
