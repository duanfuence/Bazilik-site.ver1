/**
 * Меню ресторана. Данные отделены от вёрстки: страница /menu строится из этого файла.
 *
 * ВНИМАНИЕ: сейчас здесь ДЕМОНСТРАЦИОННЫЕ позиции — реальное меню и цены
 * ресторан ещё не передал. Позиции с `demo: true` на сайте помечены как временные.
 * Чтобы опубликовать настоящее меню, замените items и уберите флаг demo.
 *
 * layout:
 *   'gallery' — горизонтальная лента-коллаж с фотографиями (для «фотогеничных» разделов);
 *   'list'    — типографский список с ценами (напитки, гарниры, соусы и т. п.).
 */
import type { ImageMetadata } from 'astro';
import type { Tone } from './photos.ts';

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  /** Цена в рублях; null — «цена уточняется» */
  price: number | null;
  /** Выход, например «250 г» или «0,5 л» */
  portion?: string;
  photo?: ImageMetadata;
  /** Тон заглушки, пока нет фото */
  tone?: Tone;
  tags?: string[];
  demo?: boolean;
}

export interface MenuCategory {
  id: string;
  title: string;
  note?: string;
  layout: 'gallery' | 'list';
  items: MenuItem[];
}

const tones: Tone[] = ['clay', 'olive', 'paper', 'tomato', 'ink'];

/** Генератор демо-позиций: явно временные названия, без выдуманных блюд и цен. */
function demo(prefix: string, label: string, count: number, withPortion = true): MenuItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i + 1}`,
    name: `${label} № ${i + 1}`,
    description: 'Описание блюда: основные ингредиенты и подача. Появится вместе с актуальным меню ресторана.',
    price: null,
    portion: withPortion ? 'выход уточняется' : undefined,
    tone: tones[i % tones.length],
    demo: true,
  }));
}

export const menu: MenuCategory[] = [
  {
    id: 'zakuski',
    title: 'Закуски',
    note: 'Чтобы начать вечер',
    layout: 'gallery',
    items: demo('zakuski', 'Закуска', 6),
  },
  {
    id: 'salaty',
    title: 'Салаты',
    layout: 'list',
    items: demo('salaty', 'Салат', 5),
  },
  {
    id: 'supy',
    title: 'Супы',
    layout: 'list',
    items: demo('supy', 'Суп', 3),
  },
  {
    id: 'goryachee',
    title: 'Горячее',
    note: 'Мясо, рыба, птица',
    layout: 'gallery',
    items: demo('goryachee', 'Горячее блюдо', 8),
  },
  {
    id: 'deserty',
    title: 'Десерты',
    note: 'От шефа-кондитера',
    layout: 'gallery',
    items: demo('deserty', 'Десерт', 6),
  },
  {
    id: 'napitki',
    title: 'Напитки',
    layout: 'list',
    items: demo('napitki', 'Напиток', 6, false),
  },
];

export const menuIsDemo = menu.some((c) => c.items.some((i) => i.demo));

export function formatPrice(price: number | null): string {
  if (price === null) return 'цена уточняется';
  return `${new Intl.NumberFormat('ru-RU').format(price)} ₽`;
}
