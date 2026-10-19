/**
 * Доставка заявок администратору. Только сервер: секреты читаются из окружения
 * и никогда не попадают в клиентский код.
 *
 * Каналы включаются переменными окружения (см. .env.example).
 * Если не настроен ни один — возвращаем `not_configured`, и сайт честно
 * сообщает гостю, что онлайн-приём недоступен, вместо фиктивного «успеха».
 */
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export type RequestKind = 'booking' | 'banquet';

export interface Envelope {
  id: string;
  kind: RequestKind;
  receivedAt: string;
  data: Record<string, string | number>;
}

export type DeliveryResult = { ok: true } | { ok: false; reason: 'not_configured' | 'failed' };

interface Channel {
  name: string;
  send(envelope: Envelope): Promise<void>;
}

const env = (key: string) => process.env[key]?.trim() || '';

const LABELS: Record<string, string> = {
  date: 'Дата',
  time: 'Время',
  guests: 'Гостей',
  occasion: 'Повод',
  name: 'Имя',
  phone: 'Телефон',
  comment: 'Комментарий',
};

const TITLES: Record<RequestKind, string> = {
  booking: 'Заявка на бронирование',
  banquet: 'Заявка на банкет',
};

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function formatMessage(e: Envelope): string {
  const lines = Object.entries(e.data)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `<b>${LABELS[k] ?? k}:</b> ${escapeHtml(String(v))}`);
  return [`<b>${TITLES[e.kind]} № ${e.id}</b>`, ...lines, '', 'Требует подтверждения по телефону.'].join('\n');
}

function configuredChannels(): Channel[] {
  const channels: Channel[] = [];

  const token = env('TELEGRAM_BOT_TOKEN');
  const chatId = env('TELEGRAM_CHAT_ID');
  if (token && chatId) {
    channels.push({
      name: 'telegram',
      async send(e) {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: formatMessage(e), parse_mode: 'HTML' }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`telegram ${res.status}`);
      },
    });
  }

  const webhook = env('REQUESTS_WEBHOOK_URL');
  if (webhook) {
    channels.push({
      name: 'webhook',
      async send(e) {
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        const secret = env('REQUESTS_WEBHOOK_SECRET');
        if (secret) headers['x-webhook-secret'] = secret;
        const res = await fetch(webhook, {
          method: 'POST',
          headers,
          body: JSON.stringify(e),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`webhook ${res.status}`);
      },
    });
  }

  const file = env('REQUESTS_LOG_FILE');
  if (file) {
    channels.push({
      name: 'file',
      async send(e) {
        await mkdir(dirname(file), { recursive: true });
        await appendFile(file, JSON.stringify(e) + '\n', 'utf8');
      },
    });
  }

  return channels;
}

/** Заявка считается принятой, если её получил хотя бы один канал. */
export async function deliver(envelope: Envelope): Promise<DeliveryResult> {
  const channels = configuredChannels();
  if (channels.length === 0) return { ok: false, reason: 'not_configured' };

  const results = await Promise.allSettled(channels.map((c) => c.send(envelope)));
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`[requests] канал ${channels[i].name} не принял заявку ${envelope.id}:`, r.reason);
  });
  return results.some((r) => r.status === 'fulfilled') ? { ok: true } : { ok: false, reason: 'failed' };
}

const ID_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Короткий номер заявки, который удобно продиктовать по телефону. */
export function requestId(kind: RequestKind): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const code = Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
  return `${kind === 'booking' ? 'Б' : 'М'}-${code}`;
}
