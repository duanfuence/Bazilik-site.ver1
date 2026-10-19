import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookingSlots, describeStatus, hoursGroups, openStatus, weekdayOf, zonedNow, addDays, isValidIsoDate } from '../src/lib/hours.ts';

// 2026-10-22 — четверг, 2026-10-23 — пятница, 2026-10-25 — воскресенье
const at = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return { date, weekday: weekdayOf(date), minutes: h * 60 + m };
};

test('weekdayOf считает календарный день недели', () => {
  assert.equal(weekdayOf('2026-10-22'), 4);
  assert.equal(weekdayOf('2026-10-23'), 5);
  assert.equal(weekdayOf('2026-10-25'), 0);
});

test('zonedNow переводит время в московский пояс', () => {
  // 21:30 UTC = 00:30 по Москве следующего дня
  const z = zonedNow(new Date('2026-10-23T21:30:00Z'));
  assert.equal(z.date, '2026-10-24');
  assert.equal(z.minutes, 30);
  assert.equal(z.weekday, 6);
});

test('статус: открыто, закрыто до открытия, закрыто после закрытия', () => {
  assert.deepEqual(openStatus(at('2026-10-22', '12:00')), { open: true, closesAt: '23:00' });
  assert.deepEqual(openStatus(at('2026-10-23', '23:30')), { open: true, closesAt: '00:00' });
  const morning = openStatus(at('2026-10-22', '09:15'));
  assert.equal(describeStatus(morning), 'Закрыто · откроемся в 11:00');
  const night = openStatus(at('2026-10-22', '23:00'));
  assert.equal(describeStatus(night), 'Закрыто · откроемся завтра в 11:00');
});

test('слоты: обычный день с 11:00 до 22:00 (за час до закрытия)', () => {
  const s = bookingSlots('2026-10-26', at('2026-10-22', '12:00'));
  assert.equal(s[0], '11:00');
  assert.equal(s.at(-1), '22:00');
  assert.equal(s.length, 23);
});

test('слоты: в пятницу последний слот 23:00', () => {
  const s = bookingSlots('2026-10-23', at('2026-10-22', '12:00'));
  assert.equal(s.at(-1), '23:00');
});

test('слоты на сегодня учитывают запас в час', () => {
  const s = bookingSlots('2026-10-22', at('2026-10-22', '18:10'));
  assert.equal(s[0], '19:30');
});

test('слоты: поздно вечером на сегодня ничего нет, прошлые даты и дальний горизонт пусты', () => {
  assert.deepEqual(bookingSlots('2026-10-22', at('2026-10-22', '21:30')), []);
  assert.deepEqual(bookingSlots('2026-10-21', at('2026-10-22', '10:00')), []);
  assert.deepEqual(bookingSlots(addDays('2026-10-22', 61), at('2026-10-22', '10:00')), []);
  assert.deepEqual(bookingSlots('2026-02-30', at('2026-10-22', '10:00')), []);
});

test('группы часов работы', () => {
  const g = hoursGroups();
  assert.deepEqual(g.map((x) => [x.days, x.time]), [['Вс–Чт', '11:00–23:00'], ['Пт–Сб', '11:00–00:00']]);
});

test('проверка ISO-даты', () => {
  assert.ok(isValidIsoDate('2026-12-31'));
  assert.ok(!isValidIsoDate('2026-13-01'));
  assert.ok(!isValidIsoDate('31.12.2026'));
});
