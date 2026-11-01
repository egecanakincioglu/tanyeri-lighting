# Architecture

This page gives an overview of how Tanyeri Lighting is built. Each section says what exists today and what is planned. The reasons behind the choices are in the [architecture decision records](adr/README.md); the [roadmap](roadmap.md) shows the order of the work.

## Runtime and framework

- Next.js 16 (App Router) and React 19 on Node 24. Everything is TypeScript in strict mode, including the repository tools. There is no plain JavaScript.
- Pages are Server Components by default. The project uses standard web APIs and keeps the Vercel-specific parts small, so `pnpm build && pnpm start` also works on any Node host with a local Postgres ([ADR 0001](adr/0001-architecture-nextjs-16-app-router.md)).
- Anti-lock-in rules: `@vercel/*` packages are used only in small adapters under `src/server`; the Edge runtime is not used; Vercel-specific request headers are read in one module.
- The nonce-based Content Security Policy makes every page dynamic. There is no static generation and no CDN cache for HTML.

## Routes

| Location | Purpose | Status |
|---|---|---|
| `src/app/[locale]/(site)` | Public pages | Placeholder home page; other pages planned |
| `src/app/[locale]/(admin)/dashboard` | Admin panel | Planned |
| `src/app/api` | Route handlers; `api/auth/[...all]` serves Better Auth | Auth handler exists |
| `src/proxy.ts` | Locale routing and security headers | Exists |

The proxy does only two things: locale routing and security headers. It is not trusted for authorization (see below).

## Internationalization

- next-intl with two locales, `tr` and `en`. The default locale is `tr`, and every address carries its prefix (`/tr`, `/en`). The root address redirects by the browser language. An unknown locale returns 404 ([ADR 0006](adr/0006-internationalization-next-intl.md)).
- `messages/tr.json` and `messages/en.json` hold interface texts only. Both files must contain the same keys; a test checks this.
- Planned: all content edited in the panel, including the legal pages and page metadata, is stored in the database in bilingual fields. Both languages are required.

## Data

- PostgreSQL 18 with Prisma 7 migrations and the `@prisma/adapter-pg` driver adapter. Production uses Neon; local development and CI use the Postgres image pinned in `tooling/ci-images/Dockerfile` ([ADR 0002](adr/0002-data-and-storage.md)).
- The app connects with the pooled address (`DATABASE_URL`). Migrations and the Prisma CLI use the direct address (`DATABASE_URL_UNPOOLED`).
- Tables today: `user`, `session`, `account`, `verification` and `rateLimit`, all from the Better Auth core. Planned: site settings, categories, products, catalogs, home page blocks, services, projects, references, messages and visits.
- There is no raw SQL in application code; a Semgrep rule enforces this.
- Environment variables are validated with zod in one module (`src/server/env.ts`). Each module adds its own variables. Validation runs on first use, not on import, so `next build` works without the variables. Reading `process.env` anywhere else is blocked by a Semgrep rule.

## Authentication

- Better Auth with email and password. There is no public sign-up. Sessions are stored in the database, and the session cookie is not trusted without a database check (`session.cookieCache` is off), so a revoked session stops working at once ([ADR 0003](adr/0003-authentication.md)).
- Cookies are `HttpOnly` and `SameSite=Lax`, and `Secure` in production. The origin and CSRF checks stay on in every environment. `BETTER_AUTH_URL` is the only trusted origin.
- Resetting a password revokes all sessions of the user (`revokeSessionsOnPasswordReset`).
- Sign-in and password reset requests go from the browser directly to `/api/auth/*`. They are not made through server-side `auth.api` calls, because server-side calls are not rate limited.
- The first admin comes from `pnpm db:seed`. The seed is idempotent and never prints the password. It needs `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, the `BETTER_AUTH_*` variables, `ADMIN_EMAIL` and an `ADMIN_PASSWORD` of at least 12 characters.
- Planned: the sign-in pages.

## Authorization

- Every admin page, Server Action and route handler checks the session itself. The proxy never decides access; at most it makes an optimistic redirect.
- The shared guard is `src/server/auth/guard.ts`. Every signed-in user is an admin, so a session is all it takes.
  - `guardPage(locale)` is for pages and layouts. Without a session it redirects to `/<locale>/dashboard/sign-in`; an unknown locale falls back to `tr`.
  - `guardAction()` is for Server Actions. Without a session it throws `UnauthorizedError`.
  - `guardHandler()` is for route handlers. It returns the session, or a 401 JSON response that the handler returns as it is.
- A static check, `tooling/scripts/check-admin-guard.ts`, runs in the `policy` job and fails the build when a guard is missing:
  - The default export of every page and layout under `src/app/[locale]/(admin)` calls `guardPage`.
  - Every exported method in `src/app/api/**/route.ts` calls `guardHandler`.
  - Every export of a top-level `'use server'` file calls `guardAction`.
- Public entry points are allowlisted in the check, each with a reason: the sign-in page and `api/auth/[...all]`. The sign-in page must stay outside any guarded layout, or visitors could never reach it.
- The check is shallow by design: it looks for the call inside the exported function and does not follow helper calls. Review covers the rest.

## Rate limiting

- Sign-in and password routes use the rate limiter of Better Auth, with storage in the `rateLimit` table in Postgres. This exists today ([ADR 0004](adr/0004-rate-limiting.md)).
- Planned: a counter table and a small `src/server/rate-limit` module for public forms such as the contact form. The increment is a single atomic statement. A request over the limit gets 429 with `Retry-After`.
- There is no in-memory limiter and no extra service, because instances on Vercel do not share memory.

## File storage

- Files go to Vercel Blob through the interface in `src/server/storage`. Uploads happen on the server only.
- The upload pipeline rejects files over 4 MB, detects the type from the first bytes (JPEG, PNG, WebP or PDF) and ignores the file name and the declared type. Images are re-encoded to WebP with sharp, limited to 2048 px on the longer side, which also removes metadata. PDFs are stored as they are. The stored name is generated.
- The Blob store access type is `public`, because every file on the site is public.
- Without `BLOB_READ_WRITE_TOKEN`, storage is off and the admin panel will say so. Local development uses a separate development Blob store; there is no adapter that writes to disk.

## Email

- Planned: SMTP is optional. Without SMTP variables, email is off.
- With SMTP, password reset and email change verification are sent by email. Without it, the "forgot password" link is hidden and password recovery is a command run on the server (`pnpm admin:reset-password`). This exists today:
  - `printf '%s\n' '<new password>' | pnpm admin:reset-password --email <address>`
  - The password comes only from standard input, never from the arguments.
  - The command stores a new hash and ends all sessions of the user. It exits with code 1 for an unknown email or a password shorter than 12 characters.

## Demo mode

- `DEMO_MODE` is read in `src/server/env.ts`. It is `true` or `false`, the default is `false`, and any other value is an error. The guard that uses it is still planned.
- Planned: with `DEMO_MODE=true`, every content write is refused on the server by a single guard. Changing or resetting a password and updating a user are refused too.
- A banner on the site says that the brand is fictional and that nothing is for sale. The contact form does not store messages in demo mode. It shows a summary to the sender with a note that the message was not saved.
- The public demo is read-only and uses a demo admin account.

## Security headers and CSP

- `src/proxy.ts` creates a new nonce for every request and sets the Content Security Policy: `script-src 'self' 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. There is no `'unsafe-inline'` for scripts. `'unsafe-eval'` is added only in development.
- `style-src` allows `'unsafe-inline'`, because a nonce cannot be applied to inline `style` attributes ([ADR 0001](adr/0001-architecture-nextjs-16-app-router.md)).
- `next.config.ts` adds `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy` to every response.
- Status: all of the above exists. The `site-audit` console check tests the CSP in a real browser.

## SEO and structured data

- Today: the site sends `noindex, nofollow` until 1.0.0. `SITE_INDEXING=on` turns indexing on. Every page has a localized document title.
- Planned: metadata from the database in both languages; canonical addresses; `hreflang` links for `tr`, `en` and `x-default`; a dynamic `sitemap.ts` and a `robots.ts` that gives the same rule to all crawlers; JSON-LD from one component (`WebSite`, `Organization`, `ContactPage`, `BreadcrumbList`). Production is indexable, previews are not ([ADR 0009](adr/0009-quality-targets.md)).
- The quality targets also cover visibility in AI search and usability for automated browsers, as properties of the site.

## Performance and responsive design

- Targets: Lighthouse scores of at least 90 in all four categories on mobile and on desktop, with 95 or more expected ([ADR 0010](adr/0010-quality-thresholds.md)). On mobile, JavaScript stays under 180 KB, CSS under 30 KB and the total under 500 KB.
- Tailwind CSS 4 with design tokens in one place in `@theme` ([ADR 0005](adr/0005-styling-tailwind-css-4.md)). Full-height layouts use `dvh` or `svh`; a Semgrep rule rejects `100vh`.
- The layout is designed for widths from 320 to 2560 px. Primary touch targets are at least 44 px.
- The `site-audit` job enforces overflow, accessibility, console and Lighthouse checks on ten device views and on a width sweep in CI. It exists today and audits the pages listed in `tooling/site-audit/pages.ts`.

## Testing

- Vitest for unit tests (jsdom, Testing Library) and integration tests on a real PostgreSQL. Integration tests are named `*.int.test.ts`; the files share one database, so they run one after another. HTTP calls to outside services, such as Blob, are replaced in tests; the database is not ([ADR 0007](adr/0007-testing-strategy.md)).
- The coverage gate is 80% of lines for `src/server` and `src/lib`. A pull request that changes TypeScript under `src/` must change tests.
- The repository tools have their own tests and run on Linux and Windows.
- CI, branch protection and the Semgrep, CodeQL and gitleaks scans are described in [ADR 0008](adr/0008-ci-and-protection-layers.md) and the [Git workflow guide](guides/git-workflow.md).

## Deployment

- Hosting: Vercel, with functions in Frankfurt (`fra1`, set in `vercel.json`). Database: Neon, in the Frankfurt region, next to the functions. Production and preview use separate Neon databases.
- Automatic Git deployments are turned off (`git.deploymentEnabled: false`). Deployments start only from the GitHub workflows, through the Vercel REST API.
- Releases are tag-based ([ADR 0011](adr/0011-versioning-and-releases.md)). A preview of the release branch is rehearsed with `release-rehearsal.yml`. Pushing a `vX.Y.Z` tag runs the `release` workflow, which deploys the tagged commit to production and creates the GitHub release.
- The Vercel build command (`tooling/scripts/vercel-build.ts`) generates the Prisma client, applies migrations with `prisma migrate deploy` in preview and production, and then runs `next build`.
- The live demo is v0.1.0 and stays `noindex` until 1.0.0.

## Repository layout

```text
.github/       CI workflows, pull request template, Dependabot
docs/          documentation
messages/      tr.json, en.json (interface texts)
prisma/        schema and migrations
releases/      release notes
src/
  app/         App Router
  i18n/        routing and request configuration
  server/      env, db, auth, storage (planned: rate-limit, demo guard, services)
  proxy.ts     locale routing and security headers
tooling/       git hooks, scripts, Semgrep rules, site-audit, pinned CI images
```

Planned additions: `src/components`, `src/lib` (shared pure helpers), `public/`, `docs/runbooks/` and `docs/security/`.
