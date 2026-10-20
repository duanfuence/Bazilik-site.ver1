/**
 * Единый источник фактов о ресторане.
 * Всё, что видит гость (адрес, телефон, часы), берётся отсюда —
 * меняйте данные только в этом файле.
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 — воскресенье, как в Date#getDay

export type SocialId = 'instagram' | 'telegram' | 'vk';

export interface SocialLink {
  id: SocialId;
  label: string;
  /** Полная ссылка https://…; пустая строка — сеть скрыта */
  href: string;
}

export interface DayHours {
  /** «HH:MM» */
  open: string;
  /** «HH:MM»; «24:00» означает закрытие в полночь */
  close: string;
}

export const site = {
  name: 'Базилик',
  legalName: null as string | null, // TODO: юрлицо/ИП — нужно для политики конфиденциальности
  city: 'Тамбов',
  timeZone: 'Europe/Moscow',
  locale: 'ru-RU',

  address: {
    street: 'улица Селезнёвская, 2А',
    short: 'Селезнёвская, 2А',
    locality: 'Тамбов',
    region: 'Тамбовская область',
    country: 'RU',
    postalCode: null as string | null, // TODO: уточнить индекс
  },

  phone: {
    /** Как номер дан рестораном */
    local: '55-82-53',
    /** Код Тамбова 4752 добавлен для набора с мобильного — подтвердите */
    international: '+7 (4752) 55-82-53',
    tel: '+74752558253',
  },

  /**
   * Часы работы по дням недели.
   * Вс–Чт 11:00–23:00, Пт–Сб 11:00–00:00.
   */
  hours: {
    0: { open: '11:00', close: '23:00' },
    1: { open: '11:00', close: '23:00' },
    2: { open: '11:00', close: '23:00' },
    3: { open: '11:00', close: '23:00' },
    4: { open: '11:00', close: '23:00' },
    5: { open: '11:00', close: '24:00' },
    6: { open: '11:00', close: '24:00' },
  } satisfies Record<Weekday, DayHours>,

  /**
   * Правила онлайн-заявок. Это рабочие допущения, а не правила ресторана:
   * согласуйте с администратором и поправьте при необходимости.
   */
  booking: {
    slotStepMinutes: 30,
    /** Минимальный запас времени до визита для заявки на сегодня */
    leadMinutes: 60,
    /** Последний слот — за столько минут до закрытия */
    lastSlotBeforeCloseMinutes: 60,
    /** На сколько дней вперёд принимаются заявки */
    horizonDays: 60,
    /** Больше гостей — предлагаем банкетную заявку */
    maxGuests: 12,
  },

  /**
   * Соцсети ресторана — единственное место, где задаются адреса.
   * Заполните href полной ссылкой (https://…) — иконка появится в подвале,
   * в мобильном меню и на странице контактов. Пустой href — сеть не показывается.
   */
  social: [
    { id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/bazilikrest/' },
    { id: 'telegram', label: 'Telegram', href: 'https://t.me/bazilikrest' },
    { id: 'vk', label: 'ВКонтакте', href: 'https://vk.com/bazilikrest' },
  ] as SocialLink[],

  /**
   * Встраиваемая карта (например, конструктор Яндекс Карт).
   * null — показываем только ссылки на маршрут.
   */
  mapEmbedUrl: null as string | null,
} as const;

/** Домены, на которые должна вести ссылка каждой сети (защита от опечаток при заполнении). */
export const socialHosts: Record<SocialId, string[]> = {
  instagram: ['instagram.com', 'www.instagram.com'],
  telegram: ['t.me', 'telegram.me'],
  vk: ['vk.com', 'www.vk.com', 'vk.ru', 'www.vk.ru'],
};

export function isValidSocialHref(id: SocialId, href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && socialHosts[id].includes(url.hostname) && url.pathname.length > 1;
  } catch {
    return false;
  }
}

/** Заполненные соцсети — только они выводятся на сайте. */
export const socialLinks: SocialLink[] = site.social.filter((s) => s.href.trim() !== '');

const addressQuery = encodeURIComponent(`${site.address.locality}, ${site.address.street}`);

export const routeLinks = [
  { label: 'Яндекс Карты', href: `https://yandex.ru/maps/?text=${addressQuery}` },
  { label: '2ГИС', href: `https://2gis.ru/search/${addressQuery}` },
  { label: 'Google Maps', href: `https://www.google.com/maps/search/?api=1&query=${addressQuery}` },
];

export interface NavItem {
  href: string;
  label: string;
}

export const nav: NavItem[] = [
  { href: '/menu', label: 'Меню' },
  { href: '/bron', label: 'Бронирование' },
  { href: '/bankety', label: 'Банкеты' },
  { href: '/shef', label: 'Шеф' },
  { href: '/o-restorane', label: 'О ресторане' },
  { href: '/kontakty', label: 'Контакты' },
];
