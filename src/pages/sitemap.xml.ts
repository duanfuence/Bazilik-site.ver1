import type { APIRoute } from 'astro';
import { nav } from '../config/site';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const origin = site!;
  const paths = ['/', ...nav.map((n) => n.href)];
  const urls = paths.map((p) => `  <url><loc>${new URL(p, origin).href}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
