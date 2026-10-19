/**
 * Проверка заявок. Один и тот же код работает в браузере (подсказки до отправки)
 * и на сервере (окончательная проверка) — правила не расходятся.
 */
import { site } from '../config/site.ts';
import { addDays, bookingSlots, isValidIsoDate, type ZonedNow } from './hours.ts';

export type FieldErrors = Record<string, string>;

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

export interface BookingRequest {
  date: string;
  time: string;
  guests: number;
  name: string;
  phone: string;
  comment: string;
}

export interface BanquetRequest {
  date: string;
  guests: number;
  occasion: string;
  name: string;
  phone: string;
  comment: string;
}

type Input = Record<string, unknown>;

const NAME_RE = /^[\p{L}][\p{L}\s.'’-]*$/u;
export const COMMENT_MAX = 1000;
export const BANQUET_GUESTS_MAX = 1000;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Приводит телефон к виду +7XXXXXXXXXX. null — номер не распознан. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) return `+7${digits.slice(1)}`;
  if (digits.length === 10) return `+7${digits}`;
  return null;
}

export function formatPhone(normalized: string): string {
  const d = normalized.replace(/\D/g, '').slice(1);
  return `+7 ${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
}

function checkName(value: string, errors: FieldErrors) {
  if (!value) errors.name = 'Укажите имя, чтобы администратор знал, как к вам обращаться.';
  else if (value.length < 2 || value.length > 60 || !NAME_RE.test(value))
    errors.name = 'Имя должно содержать от 2 до 60 букв.';
}

function checkPhone(value: string, errors: FieldErrors): string {
  const phone = normalizePhone(value);
  if (!value) errors.phone = 'Укажите телефон — по нему администратор подтвердит заявку.';
  else if (!phone) errors.phone = 'Проверьте номер: нужно 10 цифр после +7, например +7 900 000-00-00.';
  return phone ?? '';
}

function checkComment(value: string, errors: FieldErrors) {
  if (value.length > COMMENT_MAX) errors.comment = `Комментарий слишком длинный — не больше ${COMMENT_MAX} символов.`;
}

function checkConsent(value: unknown, errors: FieldErrors) {
  const accepted = value === true || value === 'on' || value === 'true';
  if (!accepted) errors.consent = 'Нужно согласие на обработку персональных данных — без него мы не можем принять заявку.';
}

function toInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(str(value));
  return Number.isInteger(n) ? n : NaN;
}

export function validateBooking(input: Input, now: ZonedNow): ValidationResult<BookingRequest> {
  const errors: FieldErrors = {};
  const date = str(input.date);
  const time = str(input.time);
  const guests = toInt(input.guests);
  const name = str(input.name);
  const comment = str(input.comment);

  if (!date) errors.date = 'Выберите дату визита.';
  else if (!isValidIsoDate(date)) errors.date = 'Дата указана в неверном формате.';
  else if (date < now.date) errors.date = 'Эта дата уже прошла.';
  else if (date > addDays(now.date, site.booking.horizonDays))
    errors.date = `Онлайн-заявки принимаются не более чем на ${site.booking.horizonDays} дней вперёд.`;

  if (!errors.date) {
    const slots = bookingSlots(date, now);
    if (slots.length === 0) errors.time = 'На эту дату онлайн-заявки уже не принимаются. Выберите другой день или позвоните нам.';
    else if (!time) errors.time = 'Выберите время.';
    else if (!slots.includes(time)) errors.time = 'На это время заявку оставить нельзя — выберите другое.';
  } else if (!time) {
    errors.time = 'Выберите время.';
  }

  if (!Number.isFinite(guests) || guests < 1) errors.guests = 'Укажите количество гостей.';
  else if (guests > site.booking.maxGuests)
    errors.guests = `Для компании больше ${site.booking.maxGuests} гостей оформите заявку на банкет.`;

  checkName(name, errors);
  const phone = checkPhone(str(input.phone), errors);
  checkComment(comment, errors);
  checkConsent(input.consent, errors);

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, data: { date, time, guests, name, phone, comment } };
}

export function validateBanquet(input: Input, now: ZonedNow): ValidationResult<BanquetRequest> {
  const errors: FieldErrors = {};
  const date = str(input.date);
  const guests = toInt(input.guests);
  const name = str(input.name);
  const comment = str(input.comment);
  const occasion = str(input.occasion).slice(0, 80);

  if (!date) errors.date = 'Укажите предполагаемую дату.';
  else if (!isValidIsoDate(date)) errors.date = 'Дата указана в неверном формате.';
  else if (date < now.date) errors.date = 'Эта дата уже прошла.';

  if (!Number.isFinite(guests) || guests < 1) errors.guests = 'Укажите примерное количество гостей.';
  else if (guests > BANQUET_GUESTS_MAX) errors.guests = 'Проверьте количество гостей.';

  checkName(name, errors);
  const phone = checkPhone(str(input.phone), errors);
  checkComment(comment, errors);
  checkConsent(input.consent, errors);

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, data: { date, guests, occasion, name, phone, comment } };
}
