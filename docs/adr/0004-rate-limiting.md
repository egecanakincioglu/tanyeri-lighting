# ADR 0004: Rate limiting - on Postgres, no extra service

Status: Accepted
Date: 2026-10-28

## Context

In the old code, the rate limit existed only in the Express server and only in memory; the password reset code had no attempt limit. On Vercel every request can land on a different function instance, so an in-memory counter is not shared in a serverless environment. The project decision is: **rate limiting runs on Postgres, with no extra service.** For the sign-in and password reset endpoints, the database-backed limiter of the authentication library is used. For other public write endpoints, such as the contact form, a small counter table is kept in the same database.

Facts checked before the decision:

- In Better Auth the rate limit is on by default in production and off in development. The storage default is memory. With `storage: "database"` it moves to the `rateLimit` table; `customRules` can be set per path.
- **Server-side `auth.api` calls are not limited**; only requests that come from the client are limited.
- Better Auth reads the IP from `x-forwarded-for` by default and groups IPv6 addresses by their /64 subnet. Vercel writes `x-forwarded-for` itself and does not forward a value that comes from outside.
- A race condition was reported in the database-backed limiter on Postgres (GHSA-44jh-23m7-hpcf, low severity). The advisory is for the Drizzle and Kysely adapters; it was fixed in 1.7.7 and the Prisma adapter is not mentioned. The Prisma adapter code of 1.7.14 was read: the counter is incremented with one conditional `UPDATE` inside a transaction. Because the documentation does not state this, it will be verified with a test.
- On Postgres, Prisma translates `upsert` into the database's `INSERT ... ON CONFLICT` command only under certain conditions; if the conditions are not met, concurrent calls can raise a P2002 error.

## Options

| Option | Pros | Cons |
|---|---|---|
| Postgres: the DB limiter of the authentication library + a project counter table | No extra service; all instances see the same counter; tested with a real Postgres | Every limited request is a DB write; the first request is slow if Neon is suspended |
| In-memory limiter | Simple, fast | Not shared between instances in a serverless environment; effectively no limit |
| External KV/Redis service | Fast, atomic counters | Extra service, account and secret; conflicts with the decision |
| Vercel WAF rate limit rules | Cuts before the application | Vercel-specific (lock-in); at most 3 custom rules on Hobby; cannot be tested locally or in CI |

## Decision

**Rate limiting runs on Postgres; there is no in-memory limiter and no extra service.**

Rules:

1. **Sign-in and password reset:** the limiter of the authentication library (Better Auth, [ADR 0003](0003-authentication.md)) is used. The setting is `rateLimit: { enabled: true, storage: "database", customRules: { ... } }`. `enabled: true` is written explicitly so that it also runs in development and tests. Narrow-window, low-limit rules are set for the sign-in and reset endpoints. The values are decided and fixed by tests, per client address: `/sign-in/email` 3 requests per 10 seconds, `/request-password-reset` 3 per 60 seconds and `/reset-password` 5 per 60 seconds.
2. **Sign-in and reset forms go from the browser directly to the `/api/auth/*` handler.** Sign-in is not done with the server API (`auth.api.*`); if it were, the limiter would be bypassed ([ADR 0003](0003-authentication.md), rule 3).
3. For **other public write endpoints** (the contact form and similar), the `src/server/rate-limit` module and a counter table in the same database are used (`RateLimitCounter`: key, window start, counter).
   - The increment is one atomic statement: either an `upsert` that meets Prisma's database upsert conditions, or a parameterized `$executeRaw` with `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`. Two-step code that reads first and then writes is forbidden.
   - Expired rows are deleted from time to time.
4. **Key:** the endpoint name and the client IP. The IP is read only from a header that the server itself writes. On Vercel this is `x-forwarded-for`; outside Vercel the header is not trusted unless a trusted proxy (`trustedProxies`) is configured. For the library's limiter this is `advanced.ipAddress.trustedProxies`. Without it on another host, an unset header puts every request in one bucket, and a forged header lets a client evade the limit.
5. When the limit is exceeded, the response is 429 with `Retry-After`.
6. If the authentication library changes, the endpoints in rule 1 also move to the counter table in rule 3. The rule stays the same: Postgres, no extra service.

## Consequences

- Positive: The missing attempt limit on the reset code is closed. Limits are shared by all function instances and are tested with a real Postgres.
- Positive: The project does not depend on a Vercel-specific rate limit service; the same behavior is seen locally and in CI.
- Negative: Every limited request makes a database write. The monthly 100 CU-hours of Neon Free look sufficient for a low-traffic demo; this is measured in phase 9.
- Risk: Bypass types such as IPv6 address rotation and path normalization were reported in the library before and were patched. The library version is kept up to date. In the project's own counter, path normalization is left to Next.js; the key is built from the endpoint name, not from the raw path.
- Required tests:
  - The limit starts to apply exactly at the threshold.
  - The counter resets when the window ends.
  - N concurrent requests do not exceed the limit (both for the library's Prisma adapter and for the project counter).
  - When the `x-forwarded-for` header is sent with fake values, it is not trusted in a configuration outside Vercel.
- Decided (2026-11-01): the key in the project counter table is an HMAC-SHA256 of `<scope>:<address>`, under a key derived from `BETTER_AUTH_SECRET` with the label `rate-limit`. The `rateLimitCounter` table stores no plain IP address, consistent with the principle that IP addresses are stored anonymized. The library's `rateLimit.key` and `session.ipAddress` hold plain addresses. IPv6 addresses are grouped by /64, so a client cannot get a fresh counter by rotating addresses inside its own prefix. The key format of the library's own `rateLimit` table belongs to the library.

## Sources

- https://www.better-auth.com/docs/concepts/rate-limit
- https://www.better-auth.com/docs/reference/options
- https://github.com/better-auth/better-auth/security/advisories/GHSA-44jh-23m7-hpcf
- https://github.com/better-auth/better-auth/releases/tag/v1.7.7
- https://www.prisma.io/docs/orm/reference/prisma-client-reference
- https://vercel.com/docs/headers/request-headers
- https://vercel.com/docs/plans/hobby
