// Renders public/icons/icon-{16,32,48,128}.png from an inline SVG using the installed Brave.
// Usage: BRAVE=/snap/bin/brave node scripts/make-icons.mjs
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const exe = process.env.BRAVE ?? '/snap/bin/brave';
const out = new URL('../public/icons/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="26" fill="#0b5d1e"/>
  <text x="64" y="86" text-anchor="middle" font-family="DejaVu Sans, Noto Sans, Arial, sans-serif"
        font-weight="700" font-size="84" fill="#ffffff">₹</text>
  <rect x="26" y="102" width="76" height="8" rx="4" fill="#9be7a9"/>
</svg>`;

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
for (const size of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:transparent">${svg(size)}</body>`);
  await page.screenshot({ path: `${out}icon-${size}.png`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
  console.log('icon-' + size + '.png');
}
await browser.close();
