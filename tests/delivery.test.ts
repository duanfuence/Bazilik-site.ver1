import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { deliver, formatMessage, requestId, type Envelope } from '../src/lib/server/delivery.ts';

const envelope: Envelope = {
  id: 'Б-TEST1',
  kind: 'booking',
  receivedAt: '2026-10-19T10:00:00.000Z',
  data: { date: '2026-10-24', time: '19:00', guests: 2, name: 'Анна <script>', phone: '+7 910 000-00-00', comment: '' },
};

const clearEnv = () => {
  for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'REQUESTS_WEBHOOK_URL', 'REQUESTS_WEBHOOK_SECRET', 'REQUESTS_LOG_FILE']) delete process.env[k];
};

test('сообщение администратору: заголовок, поля, экранирование HTML, пустые поля скрыты', () => {
  const text = formatMessage(envelope);
  assert.match(text, /Заявка на бронирование № Б-TEST1/);
  assert.match(text, /Анна &lt;script&gt;/);
  assert.doesNotMatch(text, /Комментарий/);
  assert.match(text, /Требует подтверждения/);
});

test('номер заявки: префикс по типу, без похожих символов', () => {
  assert.match(requestId('booking'), /^Б-[2-9A-HJ-NP-Z]{5}$/);
  assert.match(requestId('banquet'), /^М-[2-9A-HJ-NP-Z]{5}$/);
});

test('без настроенных каналов — not_configured, а не фиктивный успех', async () => {
  clearEnv();
  assert.deepEqual(await deliver(envelope), { ok: false, reason: 'not_configured' });
});

test('вебхук получает JSON заявки и секрет в заголовке', async () => {
  clearEnv();
  let received: { body: string; secret?: string } | undefined;
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      received = { body, secret: req.headers['x-webhook-secret'] as string };
      res.end('ok');
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  process.env.REQUESTS_WEBHOOK_URL = `http://127.0.0.1:${port}/hook`;
  process.env.REQUESTS_WEBHOOK_SECRET = 's3cret';
  try {
    assert.deepEqual(await deliver(envelope), { ok: true });
    assert.equal(received?.secret, 's3cret');
    assert.equal(JSON.parse(received!.body).id, 'Б-TEST1');
  } finally {
    server.close();
    clearEnv();
  }
});

test('если единственный канал недоступен — failed', async () => {
  clearEnv();
  process.env.REQUESTS_WEBHOOK_URL = 'http://127.0.0.1:9/unreachable';
  const orig = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await deliver(envelope), { ok: false, reason: 'failed' });
  } finally {
    console.error = orig;
    clearEnv();
  }
});
