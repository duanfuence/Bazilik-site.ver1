/**
 * Страница «О ресторане». Тексты разделены на главы.
 * text: null — глава пока без текста; на сайте вместо неё видна пометка,
 * что нужно прислать (история, факты). Ничего не выдумываем.
 */
import type { PhotoKey } from './photos.ts';

export interface Chapter {
  id: string;
  kicker: string;
  title: string;
  accent: string;
  text: string | null;
  /** Что нужно от ресторана, чтобы заполнить главу */
  needs: string;
  photos: PhotoKey[];
}

export const chapters: Chapter[] = [
  {
    id: 'mesto',
    kicker: 'Место',
    title: 'Улица Селезнёвская,',
    accent: '2А',
    text: 'Ресторан «Базилик» открыт каждый день с 11:00. Сюда можно прийти пообедать, поужинать с близкими, отметить праздник или собрать большую компанию.',
    needs: '',
    photos: ['interiorWide', 'interiorTable'],
  },
  {
    id: 'istoriya',
    kicker: 'История',
    title: 'Как появился',
    accent: '«Базилик»',
    text: null,
    needs: 'Год открытия, кто основал ресторан и почему он называется «Базилик».',
    photos: ['interiorDetail'],
  },
  {
    id: 'kuhnya',
    kicker: 'Кухня',
    title: 'Кухня',
    accent: 'шефа Боярского',
    text: 'Шеф-повар Александр Боярский — победитель номинации «Лучший кондитер России», судья кулинарных чемпионатов и участник открытия ресторанов и баров.',
    needs: '',
    photos: ['kitchen', 'chefDetail'],
  },
  {
    id: 'zal',
    kicker: 'Зал',
    title: 'Пространство',
    accent: 'и свет',
    text: null,
    needs: 'Описание залов: сколько их, для каких поводов подходят, есть ли летняя веранда или отдельный кабинет.',
    photos: ['interiorEvening', 'interiorBar'],
  },
];
