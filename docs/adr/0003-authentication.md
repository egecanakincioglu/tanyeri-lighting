# ADR 0003: Authentication - Better Auth (email/password, database sessions)

Status: Accepted
Date: 2026-10-28

## Context

The admin sign-in in the old code was custom code: tokens with `jose`, hashes with `bcrypt`, and an in-memory rate limit. The session token was accepted in the address bar (`?state=`). The password reset code had no attempt limit. The project decision is: **use a maintained, ready-made library; no custom session or crypto code.** The criteria are: a Prisma adapter, sessions in the database, email/password sign-in, a password reset flow, built-in CSRF/origin protection, an `HttpOnly` + `Secure` + `SameSite=Lax` cookie, and all sessions ending when the password changes. The library choice was verified in this ADR and decided on 2026-10-28.

The need is narrow: one role (admin), no public sign-up, no OAuth/SSO/2FA, and a read-only demo admin.

Facts checked before the decision:

- Better Auth 1.7.14 (2026-10-26) is the latest stable version. Its peers are `next ^16`, `react ^19` and Prisma 5-7. Its documentation says it is "fully compatible with Next.js 16".
- Vercel acquired Better Auth on 2026-07-07. The MIT license, the name and the open contribution model continue.
- Auth.js has been maintained by the Better Auth team since 2025-09, only for security and urgent issues. Better Auth is recommended for new projects. v5 is still in beta.
- Lucia was discontinued in March 2025. Today it is a learning resource; using it means the project writes the session code itself.
- In Better Auth, the rate limit is in memory by default and off in development. Other sessions are not revoked on password reset by default. Server-side `auth.api` calls are not subject to the rate limit.

## Options

| Criterion | Better Auth 1.7.x | Auth.js (next-auth) | Lucia approach |
|---|---|---|---|
| Maintenance | Active: six patch releases in October 2026; 30.5k stars; part of Vercel since 2026-07, MIT | Maintained by the Better Auth team, only security and urgent issues; `latest` is 4.24.15, v5 is `5.0.0-beta.32` | Library discontinued in March 2025; maintenance falls to the project |
| Next.js 16 / React 19 | Documented as "fully compatible"; peers `next ^16`, `react ^19` | Not verified | Falls to the project |
| DB sessions with Prisma + Postgres | Official Prisma adapter; the CLI creates the schema and Prisma applies the migration | `@auth/prisma-adapter` 2.11.3; DB sessions with Credentials not verified | Written by the project |
| Email/password and hashing | Built in; scrypt; 8-128 characters; `disableSignUp` | Credentials: hashing and rate limiting are left to the application, password sign-in is discouraged | Written by the project |
| Password reset | Built in; token valid for 1 hour; `revokeSessionsOnPasswordReset` | Not built in | Written by the project |
| Session revocation | `revokeSession`, `revokeOtherSessions`, `revokeSessions`; `changePassword({ revokeOtherSessions })` | Not verified | Written by the project |
| Rate limit in the database | Built in (`storage: "database"`) | None | Written by the project |
| CSRF/origin | Origin check, sign-in CSRF protection with Fetch Metadata, `SameSite=Lax`, redirect URL validation | Not verified | Written by the project |
| Security history | 37 advisories; most in plugins the project will not use; in the core: origin bypass, open redirect and rate limit bypass types; all patched | Not scanned | - |
| Fit with the decision | Fits | Partly: the password flow and rate limit become project code | Does not fit: custom session code |

## Decision

**The project uses Better Auth (1.7.x, at least 1.7.14): only the core email/password feature, the official Prisma adapter, no plugins.**

Reasons: it is the only option that meets all the criteria with built-in features: a Prisma adapter, database sessions, email/password, a reset flow, session revocation, a rate limit in the database, origin/CSRF protection and secure cookie defaults. Next.js 16 and React 19 support is explicit in its peer dependencies and documentation. Auth.js maintenance has already moved to the same team, and that team recommends Better Auth for new projects. The Credentials path leaves the hash and rate limit code to the project. The Lucia path conflicts with the decision not to write custom session code. The number of advisories is high, but they are patched quickly and most are in plugins the project does not use. Using no plugins keeps the attack surface small.

Required settings (written explicitly, not left to defaults):

| Setting | Value | Reason |
|---|---|---|
| `emailAndPassword.enabled` | `true` | The only sign-in method |
| `emailAndPassword.disableSignUp` | `true` | No public sign-up; the first admin is created by the seed |
| `emailAndPassword.revokeSessionsOnPasswordReset` | `true` | The default is `false`; all sessions end on reset |
| `revokeOtherSessions` in the `changePassword` call | `true` | Other sessions end when the password changes; then the current session is also closed and a new sign-in is required |
| `rateLimit.enabled` | `true` | The default is on only in production; it must also run in development and tests |
| `rateLimit.storage` | `"database"` | The default is memory, which is not shared in a serverless environment ([ADR 0004](0004-rate-limiting.md)) |

Rules:

1. `better-auth` and `@better-auth/prisma-adapter` are pinned to the same exact version. Security advisories are followed through Dependabot alerts; high and critical advisories are patched within the same week.
2. No plugins are used.
3. **Sign-in and password reset requests go from the browser directly to the `/api/auth/*` handler.** These operations are not done from a Server Action or the server API (`auth.api.*`); server-side calls are not subject to the rate limit.
4. Sessions are kept in the database. `session.cookieCache` stays off; a revoked session becomes invalid immediately.
5. `BETTER_AUTH_SECRET` comes from an environment variable and is validated with zod at startup. `trustedOrigins` contains only the site's own addresses; there is no `localhost` in production.
6. Cookies are `HttpOnly`, `SameSite=Lax` and, over https, `Secure` by the library defaults. In production this is also enforced with `advanced.useSecureCookies: true`.
7. Authorization is checked in every page and every handler with `auth.api.getSession({ headers: await headers() })`. `getSessionCookie` in the proxy is only for redirects ([ADR 0001](0001-architecture-nextjs-16-app-router.md)). The shared guard is `src/server/auth/guard.ts`, and the static check `tooling/scripts/check-admin-guard.ts` fails CI when an entry point skips it.
8. In demo mode, endpoints for changing or resetting a password and updating a user are rejected by the single server-side demo guard.
9. The first admin is created by the seed script, using the library's own password hash function. Resolved: the seed uses `hashPassword` from `better-auth/crypto` and writes the `user` row and a `credential` account row (`accountId` is the user id) in one create.

## Consequences

- Positive: `jose`, `bcrypt`, `cookie` and custom session code do not enter the new code. The token in the address bar and the missing attempt limit on the reset code are not repeated, because the library handles sign-in and reset.
- Positive: The Better Auth CLI creates the schema and Prisma applies the migration. There is a single migration pipeline.
- Negative: Better Auth ships patches often. Updating the dependency becomes routine work.
- Risk: Better Auth supports only Prisma 5-7. Moving to Prisma 8 depends on Better Auth support ([ADR 0002](0002-data-and-storage.md)).
- **Risk: Better Auth has belonged to Vercel since 2026-07-07.** Governance sits with one company, which touches the "not locked to Vercel" principle. Mitigation:
  - The license is MIT and the library is framework-independent.
  - Because of the adapter model, user, account and session data stay in the Prisma schema, in the project's own Postgres tables.
  - Only the `src/server/auth` module touches the library.

  If needed, moving to another library with the same criteria table means rewriting this module, not migrating data.
- Required tests (on a real Postgres, [ADR 0007](0007-testing-strategy.md)):
  - The sign-up endpoint is closed.
  - A wrong password, and the rate limit threshold.
  - The threshold is not exceeded with concurrent sign-in attempts.
  - All sessions end on password reset and on password change.
  - A request from an untrusted origin is rejected.
  - Write requests without a session or in demo mode are rejected.

## Sources

- https://github.com/better-auth/better-auth/releases
- https://registry.npmjs.org/better-auth/1.7.14
- https://www.better-auth.com/docs/integrations/next
- https://www.better-auth.com/docs/adapters/prisma
- https://www.better-auth.com/docs/authentication/email-password
- https://www.better-auth.com/docs/reference/options
- https://www.better-auth.com/docs/concepts/session-management
- https://www.better-auth.com/docs/concepts/rate-limit
- https://www.better-auth.com/docs/reference/security
- https://github.com/better-auth/better-auth/security/advisories
- https://vercel.com/blog/vercel-acquires-better-auth
- https://github.com/nextauthjs/next-auth/discussions/13252
- https://authjs.dev/getting-started/authentication/credentials
- https://lucia-auth.com/
