/**
 * Сквозная проверка заявок: API и формы в браузере.
 * Запуск: node scripts/e2e.mjs <base-url> <режим>
 *   режим "configured"     — сервер запущен с REQUESTS_LOG_FILE (путь передайте в LOG_FILE)
 *   режим "not-configured" — сервер без каналов доставки
 */
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}

const base = process.argv[2] ?? 'http://127.0.0.1:4321';
const mode = process.argv[3] ?? 'configured';
const logFile = process.env.LOG_FILE;

// Завтрашняя дата по Москве — на неё всегда есть слот 19:00
const moscowToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date());
const tomorrow = new Date(Date.parse(moscowToday + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);

const booking = { date: tomorrow, time: '19:00', guests: 3, name: 'Тест Тестов', phone: '+7 910 000-00-00', comment: 'e2e', consent: true };
let n = 0;
const ok = (msg) => console.log(`✓ ${++n}. ${msg}`);
// Каждый запрос — со своего «адреса», чтобы не упираться в лимит частоты (кроме теста лимита)
const post = (path, body, ip = `10.0.0.${n + 1}`, type = 'json') =>
  fetch(base + path, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': type === 'json' ? 'application/json' : 'application/x-www-form-urlencoded',
      'x-forwarded-for': ip,
      origin: base,
    },
    body: type === 'json' ? JSON.stringify(body) : new URLSearchParams(body).toString(),
  });

const lines = async () => (logFile ? (await readFile(logFile, 'utf8').catch(() => '')).trim().split('\n').filter(Boolean) : []);

if (mode === 'not-configured') {
  const r = await post('/api/booking', booking);
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, 'not_configured');
  ok('без каналов доставки API честно отвечает 503 not_configured');

  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + '/bron');
  await page.check(`input[name="date-quick"][value="${tomorrow}"]`);
  await page.check('input[name="time"][value="19:00"]');
  await page.fill('#b-name', 'Анна');
  await page.fill('#b-phone', '89100000000');
  await page.check('#b-consent');
  await page.click('button[type="submit"]');
  const notice = page.locator('[data-form-error]');
  await notice.waitFor({ state: 'visible' });
  const text = await notice.innerText();
  assert.match(text, /недоступен/);
  assert.match(text, /55-82-53/);
  assert.ok(await page.locator('[data-booking-form]').isVisible(), 'форма остаётся на месте');
  ok('в браузере: при недоступном приёме — понятная ошибка с телефоном, форма не теряется');
  await page.screenshot({ path: 'qa/e2e-not-configured.png', fullPage: false });
  await browser.close();
  process.exit(0);
}

// --- configured ---
const before = (await lines()).length;

let r = await post('/api/booking', booking);
let body = await r.json();
assert.equal(r.status, 200);
assert.match(body.id, /^Б-[A-Z0-9]{5}$/);
ok(`валидная заявка принята, номер ${body.id}`);

const after = await lines();
assert.equal(after.length, before + 1);
const saved = JSON.parse(after.at(-1));
assert.equal(saved.kind, 'booking');
assert.equal(saved.data.phone, '+7 910 000-00-00');
assert.equal(saved.data.time, '19:00');
ok('заявка записана в журнал с нормализованным телефоном');

r = await post('/api/booking', { ...booking, time: '03:00', guests: 40, phone: '12', consent: false });
body = await r.json();
assert.equal(r.status, 422);
assert.deepEqual(Object.keys(body.errors).sort(), ['consent', 'guests', 'phone', 'time']);
ok('сервер повторно проверяет данные: 422 с ошибками по полям');

r = await post('/api/booking', { ...booking, consent: 'on', guests: '2' }, '10.0.1.1', 'form');
assert.equal(r.status, 303);
assert.match(r.headers.get('location'), /\/zayavka-prinyata\?n=%D0%91-/);
ok('без JavaScript: обычная форма → 303 на страницу «Заявка получена»');

r = await post('/api/booking', { ...booking, consent: '' }, '10.0.1.2', 'form');
assert.equal(r.status, 303);
assert.match(r.headers.get('location'), /zayavka-ne-otpravlena/);
ok('без JavaScript: ошибка → 303 на страницу «Заявка не отправлена»');

const beforeHp = (await lines()).length;
r = await post('/api/booking', { ...booking, website: 'spam' });
assert.equal(r.status, 200);
assert.equal((await lines()).length, beforeHp);
ok('ловушка для ботов: ответ 200, но заявка никуда не уходит');

let last;
for (let i = 0; i < 6; i++) last = await post('/api/banquet', { date: tomorrow, guests: 20, name: 'Лимит', phone: '9100000000', consent: true }, '10.9.9.9');
assert.equal(last.status, 429);
ok('ограничение частоты: 6-я заявка подряд с одного адреса → 429');

r = await post('/api/banquet', { date: tomorrow, guests: 30, occasion: 'День рождения', name: 'Мария', phone: '8 910 111 22 33', comment: '', consent: true });
body = await r.json();
assert.equal(r.status, 200);
assert.match(body.id, /^М-/);
ok('заявка на банкет принята');

// --- Браузер ---
const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
await page.goto(base + '/bron');

// Пустая отправка → ошибки и фокус на первом проблемном поле
await page.fill('#b-name', '');
await page.click('button[type="submit"]');
await page.waitForSelector('.field.has-error');
const errorFields = await page.$$eval('.field.has-error', (els) => els.map((e) => e.dataset.field));
assert.ok(errorFields.includes('name') && errorFields.includes('phone') && errorFields.includes('consent'));
const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-invalid'));
assert.equal(focused, 'true');
const describedBy = await page.getAttribute('#b-name', 'aria-describedby');
assert.match(describedBy, /b-name-error/);
ok(`в браузере: пустая форма → ошибки у полей (${errorFields.join(', ')}), фокус на первом, aria-invalid и aria-describedby`);
await page.screenshot({ path: 'qa/e2e-errors.png', fullPage: true });

// Счётчик гостей
await page.click('[data-step="1"]');
assert.equal(await page.inputValue('#b-guests'), '3');
for (let i = 0; i < 15; i++) await page.click('[data-step="1"]', { force: true });
assert.equal(await page.inputValue('#b-guests'), '12');
assert.ok(await page.locator('[data-banquet-hint]').isVisible());
await page.fill('#b-guests', '2');
await page.dispatchEvent('#b-guests', 'input');
assert.ok(!(await page.locator('[data-banquet-hint]').isVisible()));
ok('счётчик гостей: ограничен 12, на максимуме появляется ссылка на банкет');

// Заполняем и отправляем
await page.check(`input[name="date-quick"][value="${tomorrow}"]`);
await page.check('input[name="time"][value="19:00"]');
await page.fill('#b-name', 'Анна');
await page.fill('#b-phone', '89101234567');
await page.locator('#b-phone').blur();
assert.equal(await page.inputValue('#b-phone'), '+7 910 123-45-67');
await page.check('#b-consent');
await page.click('button[type="submit"]');
const success = page.locator('[data-booking-success]');
await success.waitFor({ state: 'visible' });
const successText = await success.innerText();
assert.match(successText, /Заявка получена/);
assert.match(successText, /ещё не подтверждена/);
assert.match(successText, /\+7 910 123-45-67/);
assert.match(successText, /19:00/);
ok('в браузере: заявка отправлена, экран «Заявка получена» с номером и пометкой «бронь ещё не подтверждена»');
await page.screenshot({ path: 'qa/e2e-success.png', fullPage: false });

// Банкет в браузере
await page.goto(base + '/bankety');
await page.fill('#q-date', tomorrow);
await page.fill('#q-guests', '25');
await page.selectOption('#q-occasion', 'Выпускной');
await page.fill('#q-name', 'Олег');
await page.fill('#q-phone', '+79105556677');
await page.check('#q-consent');
await page.click('[data-banquet-form] button[type="submit"]');
await page.locator('[data-banquet-success]').waitFor({ state: 'visible' });
ok('в браузере: заявка на банкет отправлена, показано подтверждение');

// Мобильная навигация: открыть, Esc, фокус вернулся
await page.goto(base + '/');
await page.click('[data-drawer-open]');
assert.ok(await page.locator('[data-drawer]').isVisible());
assert.equal(await page.getAttribute('[data-drawer-open]', 'aria-expanded'), 'true');
await page.screenshot({ path: 'qa/e2e-drawer.png' });
await page.keyboard.press('Escape');
assert.ok(!(await page.locator('[data-drawer]').isVisible()));
assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-drawer-open')), true);
ok('мобильная навигация: открывается, закрывается по Esc, фокус возвращается на кнопку');

// Лента меню: кнопки листают ленту, страница не едет вбок
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(base + '/menu');
const track = page.locator('#strip-meat');
const start = await track.evaluate((el) => el.scrollLeft);
await page.click('[aria-controls="strip-meat"][data-strip-next]');
await page.waitForTimeout(700);
const moved = await track.evaluate((el) => el.scrollLeft);
assert.ok(moved > start, 'лента прокрутилась');
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1440);
await track.focus();
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(700);
assert.ok((await track.evaluate((el) => el.scrollLeft)) > moved, 'стрелка на клавиатуре листает ленту');
ok('лента меню: листается кнопками и клавишей →, страница не прокручивается по горизонтали');

// Навигация по категориям
await page.click('[data-cat-link="desserts"]');
await page.waitForTimeout(1200);
assert.equal(await page.getAttribute('[data-cat-link="desserts"]', 'aria-current'), 'true');
ok('навигация по разделам меню: переход и подсветка текущего раздела');

assert.deepEqual(consoleErrors, []);
ok('ошибок в консоли браузера нет');
await browser.close();
