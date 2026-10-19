// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// Публичный адрес сайта: нужен для canonical, Open Graph и sitemap.
// Задаётся переменной окружения SITE_URL при сборке.
const site = process.env.SITE_URL ?? 'https://bazilik.example';
const siteHost = new URL(site).hostname;

export default defineConfig({
  site,
  trailingSlash: 'never',
  build: { format: 'file' },
  // Страницы собираются статически; серверными остаются только API заявок.
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  security: {
    // Каким значениям заголовков Host / X-Forwarded-Host доверять: нужно для
    // защиты форм от межсайтовой отправки и для определения адреса гостя за прокси.
    allowedDomains: [{ hostname: siteHost }, { hostname: 'localhost' }, { hostname: '127.0.0.1' }],
  },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  devToolbar: { enabled: false },
  // Класс скоупа передаётся в дочерние компоненты через class — нужно для раскладки Photo в сетках страниц
  scopedStyleStrategy: 'class',
});
