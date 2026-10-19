import type { APIRoute } from 'astro';
import { handleRequest } from '../../lib/server/handle-request.ts';
import { validateBooking } from '../../lib/validation.ts';

export const prerender = false;

export const POST: APIRoute = (ctx) => handleRequest(ctx, 'booking', validateBooking);
