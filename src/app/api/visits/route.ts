import { after } from 'next/server';
import { checkRateLimit, tooManyRequests } from '../../../server/rate-limit/index.ts';
import { anonymizedClientAddress } from '../../../server/visits/anonymize.ts';
import { readVisitorPlace } from '../../../server/visits/geo.ts';
import { isVisitPath } from '../../../server/visits/path.ts';
import { recordVisit } from '../../../server/visits/service.ts';

// Real visitors stay far below this; a script does not. This protects the rate limit table and the database.
const RATE_LIMIT = { scope: 'visit', limit: 120, windowSeconds: 60 } as const;
const MAX_BODY_BYTES = 256;

// Public on purpose (allowlisted in the admin guard check). Accepts only a same-origin request for a known public page,
// answers at once and writes after the response.
// The path is checked, not stored; no referrer or browser header is read.
export async function POST(request: Request): Promise<Response> {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return Response.json({ error: 'Cross-origin request' }, { status: 403 });
  }
  const length = Number(request.headers.get('content-length'));
  if (!Number.isInteger(length) || length < 1) return Response.json({ error: 'Missing body' }, { status: 411 });
  if (length > MAX_BODY_BYTES) return Response.json({ error: 'Body too large' }, { status: 413 });
  if (!isVisitPath((await request.text()).trim())) return Response.json({ error: 'Unknown page' }, { status: 400 });

  const limit = await checkRateLimit({ ...RATE_LIMIT, headers: request.headers });
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const visit = { ...readVisitorPlace(request.headers), address: anonymizedClientAddress(request.headers) };
  after(() => recordVisit(visit));
  return new Response(null, { status: 204 });
}
