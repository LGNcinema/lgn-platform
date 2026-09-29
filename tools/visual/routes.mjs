// Which component each route actually reaches -- a wiring check that does not
// need anyone to look at a screenshot.
import { chromium } from 'playwright';
const BASE = process.env.VIS_BASE || 'http://localhost:5173/';
const routes = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
for (const q of routes) {
  await page.goto(new URL(q, BASE).href, { waitUntil: 'networkidle' });
  const stubs = await page.$$eval('[data-stub]', (els) => els.map((e) => e.getAttribute('data-stub')));
  const header = await page.$('header') ? 'header' : 'NO header';
  const footer = await page.$('footer') ? 'footer' : 'NO footer';
  console.log(`${q.padEnd(34)} ${header.padEnd(10)} ${footer.padEnd(10)} stubs: ${stubs.join(', ') || '(none)'}`);
}
await browser.close();
