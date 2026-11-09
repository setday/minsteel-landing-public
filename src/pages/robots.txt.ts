import type { APIRoute } from 'astro';
import { withBase } from '../lib/url';
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL(withBase('sitemap.xml'), site)}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
