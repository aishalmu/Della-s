// Renders the home-screen icons from HTML using the machine's Playwright + Chromium.
// Run with: NODE_PATH="$(npm root -g)" npm run icons
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const font = readFileSync(new URL('../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2', import.meta.url)).toString('base64');

// scale: how much of the canvas the stamp fills (maskable icons need a safe zone).
const page = (size, scale) => `<!doctype html><html><head><style>
@font-face{font-family:C;src:url(data:font/woff2;base64,${font}) format('woff2');font-style:italic;font-weight:500}
html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden}
body{display:flex;align-items:center;justify-content:center;background-color:#F4EEE3;
background-image:repeating-linear-gradient(0deg,rgba(110,100,70,.05) 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,rgba(110,100,70,.045) 0 1px,transparent 1px 4px)}
.s{--d:${Math.round(size * scale)}px;width:var(--d);height:var(--d);border-radius:50%;box-sizing:border-box;
border:calc(var(--d)*.018) solid #B08582;box-shadow:inset 0 0 0 calc(var(--d)*.04) #F4EEE3,inset 0 0 0 calc(var(--d)*.05) #D8A7A4;
display:flex;align-items:center;justify-content:center;transform:rotate(-7deg);text-align:center;
font-family:C,serif;font-style:italic;font-weight:500;color:#3B3F27;font-size:calc(var(--d)*.25);line-height:.95}
</style></head><body><div class="s">Aisha’s<br>Bible</div></body></html>`;

const out = [
  ['public/icon-192.png', 192, 0.86],
  ['public/icon-512.png', 512, 0.86],
  ['public/apple-touch-icon.png', 180, 0.86],
  ['public/icon-maskable-512.png', 512, 0.72],
];

const browser = await chromium.launch();
for (const [file, size, scale] of out) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(page(size, scale));
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: file });
  await p.close();
  console.log('wrote', file);
}
await browser.close();
