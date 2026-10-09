// Live check against the real sites using the installed Brave.
// Usage: BRAVE=/snap/bin/brave node scripts/smoke.mjs   (run `npm run build` first)
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const exe = process.env.BRAVE ?? '/snap/bin/brave';
const shots = process.env.SHOTS ?? '/mnt/data/Tools/_dom-probe';
const bundle = readFileSync(new URL('../dist/content.js', import.meta.url), 'utf8');
const targets = [
  { name: 'amazon', url: 'https://www.amazon.in/s?k=sunscreen', card: '[data-component-type="s-search-result"]' },
  { name: 'flipkart', url: 'https://www.flipkart.com/search?q=shampoo', card: 'div[data-id]' },
];

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
let failed = false;
for (const t of targets) {
  const page = await (await browser.newContext({ locale: 'en-IN', viewport: { width: 1400, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector(t.card, { timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.evaluate(bundle); // same code the browser injects as the content script
  await page.waitForSelector('price-scout-toolbar', { timeout: 10000 });
  await page.waitForTimeout(500);
  const badges = await page.locator('price-scout-badge').count();

  const read = (sel) =>
    page.evaluate((s) => {
      const cards = [...document.querySelectorAll(s)];
      const val = (c) => {
        const text = c.querySelector('price-scout-badge')?.shadowRoot?.textContent ?? '';
        const m = text.match(/₹([\d,.]+) \/ 100/);
        return m ? parseFloat(m[1].replace(/,/g, '')) : null;
      };
      const usesCss = cards.some((c) => c.style.order !== '');
      const shown = usesCss ? [...cards].sort((a, b) => Number(a.style.order) - Number(b.style.order)) : cards;
      return shown.map(val).filter((v) => v !== null);
    }, sel);
  const press = (dir) =>
    page.evaluate(
      (d) => document.querySelector('price-scout-toolbar').shadowRoot.querySelector(`[data-dir="${d}"]`).click(),
      dir,
    );

  const original = await read(t.card);
  await press('asc');
  await page.waitForTimeout(500);
  const asc = await read(t.card);
  await press('desc');
  await page.waitForTimeout(500);
  const desc = await read(t.card);
  await page.screenshot({ path: `${shots}/smoke-${t.name}-desc.png` });
  await press('asc');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shots}/smoke-${t.name}-asc.png` });
  await press('reset');
  await page.waitForTimeout(500);
  const reset = await read(t.card);

  // badges round to 2 decimals (<100) or whole rupees (>=100), so allow 0.5 slack
  const nonDecreasing = asc.every((v, i) => i === 0 || asc[i - 1] <= v + 0.5);
  const nonIncreasing = desc.every((v, i) => i === 0 || desc[i - 1] >= v - 0.5);
  const restored = JSON.stringify(reset) === JSON.stringify(original);
  console.log(
    `${t.name}: ${badges} badges, ${asc.length} ranked, asc=${nonDecreasing} (${asc[0]}..${asc.at(-1)}), ` +
      `desc=${nonIncreasing}, reset=${restored}, pageerrors=${errors.length}`,
  );
  if (errors.length) console.log(errors.slice(0, 3));
  if (!badges || asc.length < 10 || !nonDecreasing || !nonIncreasing || !restored || errors.length) failed = true;
}
await browser.close();
process.exit(failed ? 1 : 0);
