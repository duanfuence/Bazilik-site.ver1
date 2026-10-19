import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, formatPhone, validateBooking, validateBanquet } from '../src/lib/validation.ts';
import { weekdayOf } from '../src/lib/hours.ts';

const now = { date: '2026-10-22', weekday: weekdayOf('2026-10-22'), minutes: 12 * 60 };
const good = { date: '2026-10-24', time: '19:00', guests: '4', name: 'Анна', phone: '8 (910) 123-45-67', comment: '', consent: 'on' };

test('нормализация телефона', () => {
  assert.equal(normalizePhone('8 (910) 123-45-67'), '+79101234567');
  assert.equal(normalizePhone('+7 910 123 45 67'), '+79101234567');
  assert.equal(normalizePhone('9101234567'), '+79101234567');
  assert.equal(normalizePhone('55-82-53'), null);
  assert.equal(formatPhone('+79101234567'), '+7 910 123-45-67');
});

test('корректная заявка на бронь проходит', () => {
  const r = validateBooking(good, now);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.data, { date: '2026-10-24', time: '19:00', guests: 4, name: 'Анна', phone: '+79101234567', comment: '' });
});

test('ошибки по каждому полю', () => {
  const r = validateBooking({ date: '2026-10-01', time: '', guests: '0', name: 'A', phone: '123', comment: 'x'.repeat(1001) }, now);
  assert.ok(!r.ok);
  if (!r.ok) assert.deepEqual(Object.keys(r.errors).sort(), ['comment', 'consent', 'date', 'guests', 'name', 'phone', 'time']);
});

test('время вне слотов и большая компания', () => {
  const r = validateBooking({ ...good, time: '23:30', guests: '20' }, now);
  assert.ok(!r.ok);
  if (!r.ok) {
    assert.match(r.errors.time, /нельзя/);
    assert.match(r.errors.guests, /банкет/);
  }
});

test('банкет: дата и гости обязательны, повод — нет', () => {
  assert.ok(validateBanquet({ date: '2026-12-20', guests: '30', name: 'Иван Петров', phone: '+79101234567', consent: 'true' }, now).ok);
  const r = validateBanquet({ date: '', guests: '', name: '', phone: '', consent: false }, now);
  assert.ok(!r.ok);
  if (!r.ok) assert.deepEqual(Object.keys(r.errors).sort(), ['consent', 'date', 'guests', 'name', 'phone']);
});
