/** Структурированные данные schema.org — только подтверждённые факты, без рейтингов и отзывов. */
import { site, socialLinks } from '../config/site.ts';
import { displayTime } from './hours.ts';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function restaurantSchema(origin: URL) {
  const specs = new Map<string, string[]>();
  for (const [day, h] of Object.entries(site.hours)) {
    const key = `${h.open}|${displayTime(h.close)}`;
    specs.set(key, [...(specs.get(key) ?? []), DAY_NAMES[Number(day)]]);
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: `Ресторан «${site.name}»`,
    url: origin.href,
    telephone: site.phone.tel,
    image: new URL('/og.jpg', origin).href,
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.locality,
      addressRegion: site.address.region,
      addressCountry: site.address.country,
      ...(site.address.postalCode ? { postalCode: site.address.postalCode } : {}),
    },
    openingHoursSpecification: [...specs].map(([key, days]) => {
      const [opens, closes] = key.split('|');
      return { '@type': 'OpeningHoursSpecification', dayOfWeek: days, opens, closes };
    }),
    hasMenu: new URL('/menu', origin).href,
    acceptsReservations: true,
    ...(socialLinks.length ? { sameAs: socialLinks.map((s) => s.href) } : {}),
  };
}
