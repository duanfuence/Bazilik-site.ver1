/**
 * Общий обработчик для /api/booking и /api/banquet.
 * Принимает JSON (отправка из скрипта) и обычную форму (если JavaScript отключён).
 */
import type { APIContext } from 'astro';
import { zonedNow } from '../hours.ts';
import type { ValidationResult } from '../validation.ts';
import { formatPhone } from '../validation.ts';
import { deliver, requestId, type RequestKind } from './delivery.ts';

type Validator = (input: Record<string, unknown>, now: ReturnType<typeof zonedNow>) => ValidationResult<object>;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

/** Простое ограничение частоты в памяти процесса: 5 заявок за 10 минут с одного адреса. */
function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export async function handleRequest(ctx: APIContext, kind: RequestKind, validate: Validator): Promise<Response> {
  const { request } = ctx;
  const type = request.headers.get('content-type') ?? '';
  const isForm = type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data');

  // Без JavaScript отвечаем переходом на страницу результата.
  const respond = (status: number, body: Record<string, unknown>) => {
    if (!isForm) return json(status, body);
    const target = status === 200 ? `/zayavka-prinyata?n=${encodeURIComponent(String(body.id))}` : '/zayavka-ne-otpravlena';
    return ctx.redirect(target, 303);
  };

  let input: Record<string, unknown>;
  try {
    input = isForm ? Object.fromEntries((await request.formData()).entries()) : await request.json();
    if (!input || typeof input !== 'object') throw new Error('empty');
  } catch {
    return respond(400, { error: 'bad_request', message: 'Не удалось прочитать заявку.' });
  }

  // Ловушка для ботов: это поле скрыто от людей.
  if (typeof input.website === 'string' && input.website.trim() !== '') {
    return respond(200, { ok: true, id: requestId(kind) });
  }

  let ip = 'unknown';
  try {
    ip = ctx.clientAddress;
  } catch {
    /* адрес недоступен — лимит общий */
  }
  if (rateLimited(`${kind}:${ip}`)) {
    return respond(429, { error: 'rate_limited', message: 'Слишком много заявок подряд. Попробуйте через несколько минут или позвоните нам.' });
  }

  const result = validate(input, zonedNow());
  if (!result.ok) return respond(422, { error: 'validation', errors: result.errors });

  const data = { ...(result.data as Record<string, string | number>) };
  if (typeof data.phone === 'string') data.phone = formatPhone(data.phone);

  const id = requestId(kind);
  const delivery = await deliver({ id, kind, receivedAt: new Date().toISOString(), data });

  if (!delivery.ok) {
    return respond(503, {
      error: delivery.reason,
      message:
        delivery.reason === 'not_configured'
          ? 'Онлайн-приём заявок сейчас недоступен.'
          : 'Не получилось передать заявку администратору.',
    });
  }
  return respond(200, { ok: true, id });
}
