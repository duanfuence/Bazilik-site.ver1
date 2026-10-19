import type { APIRoute } from 'astro';
import { handleRequest } from '../../lib/server/handle-request.ts';
import { validateBanquet } from '../../lib/validation.ts';

export const prerender = false;

export const POST: APIRoute = (ctx) => handleRequest(ctx, 'banquet', validateBanquet);
