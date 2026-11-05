import { createHmac } from 'node:crypto';
import { getDb } from '../db.ts';
import { getEnv } from '../env.ts';
import { getClientAddress } from './client-address.ts';

// For public endpoints such as the contact form.
// Sign-in keeps the auth library's limiter; this module never touches its table.

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export type RateLimitOptions = {
  // Names the endpoint; part of the key, so endpoints never share a counter.
  scope: string;
  limit: number;
  windowSeconds: number;
  // Source of the client address; ignored when a subject is given.
  headers?: Headers;
  // Counts a named subject, such as an account, instead of the client address.
  subject?: string;
};

const MAX_WINDOW_SECONDS = 24 * 60 * 60;
// A row older than the longest allowed window has surely expired, whatever window its scope uses.
const RETENTION_MS = MAX_WINDOW_SECONDS * 1000;
// At most this many expired rows go per cleanup, so one request never pays for a long backlog.
export const CLEANUP_BATCH = 100;

// The address is never stored. The key is an HMAC-SHA256 of "<scope>:<address>"
// under a key derived from BETTER_AUTH_SECRET,
// so a leaked table cannot be reversed by trying every IPv4 address.
function bucketKey(scope: string, address: string): string {
  const derived = createHmac('sha256', getEnv().BETTER_AUTH_SECRET).update('rate-limit').digest();
  return createHmac('sha256', derived).update(`${scope}:${address}`).digest('hex');
}

// Fixed windows aligned to the epoch, one row per key.
// One atomic statement starts a new window or increments, so concurrent
// requests cannot read the same count. A refused request still counts.
export async function checkRateLimit({
  scope,
  limit,
  windowSeconds,
  headers,
  subject,
}: RateLimitOptions): Promise<RateLimitResult> {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit must be a positive integer');
  if (!Number.isInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > MAX_WINDOW_SECONDS) {
    throw new RangeError(`windowSeconds must be an integer from 1 to ${MAX_WINDOW_SECONDS}`);
  }

  const key = bucketKey(scope, subject ?? getClientAddress(headers ?? new Headers()));
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);

  const db = getDb();
  const [row] = await db.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "rateLimitCounter" ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rateLimitCounter"."windowStart" < EXCLUDED."windowStart" THEN 1
        ELSE "rateLimitCounter"."count" + 1
      END,
      "windowStart" = GREATEST("rateLimitCounter"."windowStart", EXCLUDED."windowStart")
    RETURNING "count", "windowStart"`;
  if (!row) throw new Error('The rate limit counter returned no row');

  // A key that just opened a window is the cheap moment to sweep: traffic itself drives the cleanup.
  if (row.count === 1) {
    const cutoff = new Date(now - RETENTION_MS);
    // MATERIALIZED evaluates the limited, locking subquery once;
    // a plain IN subquery may run again and delete more rows than allowed.
    await db.$executeRaw`
      WITH doomed AS MATERIALIZED (
        SELECT "key" FROM "rateLimitCounter"
        WHERE "windowStart" < ${cutoff}
        ORDER BY "windowStart"
        LIMIT ${CLEANUP_BATCH}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "rateLimitCounter" t USING doomed WHERE t."key" = doomed."key"`;
  }

  if (row.count <= limit) return { ok: true };
  const windowEnd = row.windowStart.getTime() + windowMs;
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now) / 1000)) };
}

// For route handlers; Server Actions use the result object.
export function tooManyRequests(retryAfterSeconds: number): Response {
  return Response.json(
    { error: 'Too many requests' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
}
