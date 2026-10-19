/**
 * Визуальная и техническая проверка в Chromium (Playwright).
 * Использование: node scripts/qa.mjs [base-url] [paths через запятую] [ширины через запятую]
 * Для каждой страницы и ширины: скриншот в qa/, ошибки консоли, горизонтальное переполнение.
 */
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}

const base = process.argv[2] ?? 'http://localhost:4321';
const paths = (process.argv[3] ?? '/').split(',');
const widths = (process.argv[4] ?? '375,1440').split(',').map(Number);
const full = process.env.FULL !== '0';

await mkdir('qa', { recursive: true });
const browser = await playwright.chromium.launch();
let problems = 0;

for (const width of widths) {
  const context = await browser.newContext({ viewport: { width, height: width < 768 ? 812 : 900 }, deviceScaleFactor: 1 });
  for (const path of paths) {
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
    const res = await page.goto(base + path, { waitUntil: 'networkidle' });
    // Прокрутка вниз, чтобы сработали появления, затем наверх
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo({ top: y, behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 40));
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const offenders = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > docW + 1 || r.left < -1)) {
          // элементы внутри горизонтальных лент прокручиваются намеренно
          if (el.closest('[data-strip-track], .catnav__list, dialog:not([open]), .hp, .skip-link, .visually-hidden')) continue;
          offenders.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} → ${Math.round(r.left)}..${Math.round(r.right)}`);
        }
      }
      return { scrollW: document.documentElement.scrollWidth, docW, offenders: offenders.slice(0, 8) };
    });
    const name = `qa/${path === '/' ? 'home' : path.replace(/\//g, '_').replace(/^_/, '')}-${width}.png`;
    await page.screenshot({ path: name, fullPage: full });
    const status = res?.status();
    const bad = status !== 200 || errors.length || overflow.offenders.length || overflow.scrollW > overflow.docW;
    if (bad) problems++;
    console.log(`${bad ? '✗' : '✓'} ${path} @${width}: HTTP ${status}, ошибок консоли ${errors.length}, scrollWidth ${overflow.scrollW}/${overflow.docW}`);
    errors.forEach((e) => console.log('   console:', e));
    overflow.offenders.forEach((o) => console.log('   overflow:', o));
    await page.close();
  }
  await context.close();
}
await browser.close();
process.exitCode = problems ? 1 : 0;
