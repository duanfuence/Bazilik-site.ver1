import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nDisallow: /api/\n\nSitemap: ${new URL('/sitemap.xml', site!).href}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
