/**
 * Часы работы и слоты для заявок. Чистые функции без DOM —
 * используются и в браузере, и на сервере, и в тестах.
 * Всё время считается по Москве (часовой пояс Тамбова).
 */
import { site, type DayHours, type Weekday } from '../config/site.ts';

export interface ZonedNow {
  /** «YYYY-MM-DD» по местному времени ресторана */
  date: string;
  weekday: Weekday;
  /** Минуты от начала суток */
  minutes: number;
}

const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const;
const WEEKDAY_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'] as const;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Текущие дата и время в часовом поясе ресторана. */
export function zonedNow(at: Date = new Date(), timeZone: string = site.timeZone): ZonedNow {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  return { date, weekday: weekdayOf(date), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** День недели для даты «YYYY-MM-DD» (календарный, без часового пояса). */
export function weekdayOf(isoDate: string): Weekday {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() as Weekday;
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function hoursFor(weekday: Weekday): DayHours {
  return site.hours[weekday];
}

/** «00:00» вместо «24:00» для отображения. */
export function displayTime(hhmm: string): string {
  return hhmm === '24:00' ? '00:00' : hhmm;
}

export type OpenStatus =
  | { open: true; closesAt: string }
  | { open: false; opensAt: string; opensToday: boolean; opensWeekday: Weekday };

export function openStatus(now: ZonedNow): OpenStatus {
  const today = hoursFor(now.weekday);
  const openMin = toMinutes(today.open);
  const closeMin = toMinutes(today.close);
  if (now.minutes >= openMin && now.minutes < closeMin) {
    return { open: true, closesAt: displayTime(today.close) };
  }
  if (now.minutes < openMin) {
    return { open: false, opensAt: today.open, opensToday: true, opensWeekday: now.weekday };
  }
  const next = ((now.weekday + 1) % 7) as Weekday;
  return { open: false, opensAt: hoursFor(next).open, opensToday: false, opensWeekday: next };
}

export function describeStatus(status: OpenStatus): string {
  if (status.open) return `Открыто до ${status.closesAt}`;
  if (status.opensToday) return `Закрыто · откроемся в ${status.opensAt}`;
  return `Закрыто · откроемся завтра в ${status.opensAt}`;
}

interface SlotOptions {
  step?: number;
  lead?: number;
  lastBeforeClose?: number;
}

/**
 * Время, на которое можно оставить заявку в указанный день.
 * Для сегодняшней даты отбрасываются слоты ближе, чем `lead` минут.
 * Пустой массив — заявки на эту дату онлайн не принимаются.
 */
export function bookingSlots(isoDate: string, now: ZonedNow, opts: SlotOptions = {}): string[] {
  const step = opts.step ?? site.booking.slotStepMinutes;
  const lead = opts.lead ?? site.booking.leadMinutes;
  const lastBeforeClose = opts.lastBeforeClose ?? site.booking.lastSlotBeforeCloseMinutes;

  if (!isValidIsoDate(isoDate) || isoDate < now.date) return [];
  if (isoDate > addDays(now.date, site.booking.horizonDays)) return [];

  const day = hoursFor(weekdayOf(isoDate));
  const first = toMinutes(day.open);
  const last = toMinutes(day.close) - lastBeforeClose;
  const earliest = isoDate === now.date ? now.minutes + lead : 0;

  const slots: string[] = [];
  for (let t = first; t <= last; t += step) {
    if (t >= earliest) slots.push(fromMinutes(t));
  }
  return slots;
}

/** Компактные группы для отображения: «Вс–Чт 11:00–23:00». */
export function hoursGroups(): { days: string; daysFull: string; time: string; weekdays: Weekday[] }[] {
  // Порядок с воскресенья, как в исходном расписании ресторана.
  const order: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
  const groups: { weekdays: Weekday[]; time: string }[] = [];
  for (const wd of order) {
    const h = hoursFor(wd);
    const time = `${h.open}–${displayTime(h.close)}`;
    const last = groups.at(-1);
    if (last && last.time === time) last.weekdays.push(wd);
    else groups.push({ weekdays: [wd], time });
  }
  return groups.map((g) => {
    const first = g.weekdays[0];
    const lastDay = g.weekdays[g.weekdays.length - 1];
    const single = g.weekdays.length === 1;
    return {
      weekdays: g.weekdays,
      time: g.time,
      days: single ? WEEKDAY_SHORT[first] : `${WEEKDAY_SHORT[first]}–${WEEKDAY_SHORT[lastDay]}`,
      daysFull: single ? WEEKDAY_FULL[first] : `${WEEKDAY_FULL[first]} — ${WEEKDAY_FULL[lastDay]}`,
    };
  });
}

export { WEEKDAY_SHORT, WEEKDAY_FULL };
