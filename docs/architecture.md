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
- All content edited in the panel, including the legal pages and page metadata, is stored in the database in bilingual fields. Both languages are required (see Content).

## Data

- PostgreSQL 18 with Prisma 7 migrations and the `@prisma/adapter-pg` driver adapter. Production uses Neon; local development and CI use the Postgres image pinned in `tooling/ci-images/Dockerfile` ([ADR 0002](adr/0002-data-and-storage.md)).
- The app connects with the pooled address (`DATABASE_URL`). Migrations and the Prisma CLI use the direct address (`DATABASE_URL_UNPOOLED`).
- Tables today: `user`, `session`, `account`, `verification` and `rateLimit`, all from the Better Auth core, and `rateLimitCounter` for public forms (see Rate limiting). The `contactMessage` table stores name, email, subject, message, locale and read time. It stores no IP address and no browser identification string (see Contact form). Content tables: `siteSettings`, `socialLink`, `pageMetadata`, `legalPage`, `project`, `reference`, `category`, `product`, `productSlugRedirect`, `catalog`, `homeBanner`, `featuredProduct`, `promoBoard`, `applicationArea`, `service` and `aboutPage` (see Content). Planned: visits.
- There is no raw SQL in application code; a Semgrep rule enforces this.
- Environment variables are validated with zod in one module (`src/server/env.ts`). Each module adds its own variables. Validation runs on first use, not on import, so `next build` works without the variables. Reading `process.env` anywhere else is blocked by a Semgrep rule.

## Content

- Bilingual fields are stored as one required column per language: `<field>Tr` and `<field>En`, both `NOT NULL`. Services take and return `{ tr, en }`. Both languages are required, and a page never falls back to the other language.
- A missing row reads as `null`. For site settings it reads as an empty default, which is not stored.
- Tables:
  - `siteSettings` has one row with the id `site`. Bilingual fields: site name, address, working hours, service area and languages served. Phone and email are single values.
  - `socialLink` holds the social links.
  - `pageMetadata` holds the title and description of a page, per key: home, products, catalogs, services, projects, references, about, contact, privacy and terms.
  - `legalPage` holds the legal pages, per key: privacy and terms.
  - `project` holds the projects. A project has a bilingual title (150 characters) and a bilingual limited-Markdown description (5000 characters). It has two `https` image URLs, "before" and "after". The public page will show them in a before/after slider that works with the keyboard.
  - `reference` holds the references. A reference has an untranslated name (a proper name, 100 characters), an `https` image URL, a bilingual title (100 characters) and a bilingual description (500 characters).
  - `category` holds the product categories. A category has a bilingual name (60 characters) and a language-independent kebab-case `key` (1 to 60 characters) that the product list uses as a URL filter. There are at most 8 categories (`CategoryLimitError`). A category with products cannot be deleted (`CategoryNotEmptyError`); the foreign key is `Restrict`.
  - `product` holds the products. A product has a bilingual name (120 characters), color (60) and material (100), a unique `code` (60 characters), `power` (40) and `dimensions` (60) as single texts, one `https` image URL and an order within its category. Products have no price. The input schema is strict, so unknown fields such as `price` are rejected.
  - `productSlugRedirect` holds the old slugs of products. The product slug is language-independent kebab-case (1 to 80 characters) and is the address of the product page in both languages.
  - `catalog` holds the catalogs. A catalog has a bilingual name (120 characters), an `https` `pdfUrl` and `sizeBytes`. The upload itself goes through the storage module (4 MB limit).
  - `homeBanner` has one row with the id `home`. It has an `https` image URL, a bilingual title (120 characters) and description (400), and two actions. Each action has a bilingual label (40) and a target taken from the page keys. Before the first save the banner reads as an empty default, which is not stored; its actions point at products and contact.
  - `featuredProduct` holds the ordered list of featured products. `setFeaturedProducts` replaces the whole list in one transaction. Duplicate ids are rejected, and an unknown id keeps the old list. A deleted product drops out of the list (cascade). There is no count limit. Products are returned with their current slug and category key.
  - `promoBoard` holds the promo boards. A board has an `https` image URL, a bilingual title (100 characters) and a linked catalog. `listPromoBoards` returns the catalog name and PDF URL. While a board links a catalog, `deleteCatalog` throws `CatalogInUseError`. The foreign key is `Restrict`, and the check is safe under concurrent writes.
  - `applicationArea` holds the application areas. An area has an `https` image URL, a bilingual title (100 characters) and a bilingual short description (300).
  - `service` holds the service cards. A card has an `https` image URL, a bilingual title (100 characters), a bilingual limited-Markdown description (5000) and an optional bilingual note (500). For the note, both languages are filled or both are empty; empty notes are stored as empty strings.
  - `aboutPage` has one row with the id `about`. It has two bilingual limited-Markdown bodies of 50000 characters each: the about text and the vision text. The vision is a section of the about page.
- Rules for values:
  - Email must be valid and at most 254 characters.
  - Phone allows digits, spaces and `+ ( ) -`, with 7 to 20 digits. `phoneToTel` derives the `tel:` link.
  - Social links accept `https` addresses only. The platform name is free text, and the label is bilingual. Reordering needs the full list of ids.
- Every write service calls `assertWritable()` first, then validates with zod. The services are in `src/server/content`.
- Project and reference services:
  - Projects: `listProjects`, `getProject` (null when missing), `createProject`, `updateProject`, `deleteProject` and `reorderProjects`.
  - References: `listReferences`, `createReference`, `updateReference`, `deleteReference` and `reorderReferences`.
  - New items go to the end of the list. A reorder needs the full id list, otherwise it throws `InvalidOrderError`. Updating or deleting a missing row throws `ContentNotFoundError`.
- Category, product and catalog services:
  - Categories and catalogs have ordered CRUD and reorder. New items go to the end of the list.
  - Products have CRUD and a reorder per category. Moving a product to another category puts it at the end of that category. A reorder needs the full id list.
  - When a product slug changes, the old slug is kept in `productSlugRedirect` and points at the product. `getProductBySlug` returns `{ product }`, `{ redirectTo }` (the public page answers 308) or `null`.
  - A slug that another product has or used to have is refused with `ValueTakenError`, so an old address never shows a different product. A product may take back its own old slug.
  - `ValueTakenError` has the field `key`, `code`, `slug`, or `value` when the database does not name the column. It comes from the check inside the transaction or from the unique constraint under concurrent writes.
- Home page, service and about services:
  - Banner and about page: `getHomeBanner`, `updateHomeBanner`, `getAboutPage` and `updateAboutPage`. A save replaces all fields.
  - Featured products: `listFeaturedProducts` and `setFeaturedProducts`.
  - Promo boards, application areas and service cards have ordered CRUD and reorder. New items go to the end of the list.
  - Image URLs accept `https` only. A reorder needs the full id list. Every write calls `assertWritable()` first.
- Long texts are limited Markdown. `MarkdownContent` (`src/components/markdown-content.tsx`) renders them with `react-markdown`.
  - Allowed: paragraphs, h2 and h3 headings, bold, italic, links, lists and line breaks. A level 1 heading becomes h2, and levels 4 to 6 become h3, so the page keeps a single h1.
  - Raw HTML and images are dropped.
  - Unsafe link targets such as `javascript:` and `data:` lose their `href`. External links get `rel="noopener noreferrer"`.
  - `dangerouslySetInnerHTML` is not used.
- Status: the tables, services and renderer exist. No page uses them yet.

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
- Public entry points are allowlisted in the check, each with a reason: the sign-in page, `api/auth/[...all]` and the contact Server Action, `src/server/contact/actions.ts`. The sign-in page must stay outside any guarded layout, or visitors could never reach it.
- The check is shallow by design: it looks for the call inside the exported function and does not follow helper calls. Review covers the rest.

## Rate limiting

- Sign-in and password routes use the rate limiter of Better Auth, with storage in the `rateLimit` table in Postgres. This exists today ([ADR 0004](adr/0004-rate-limiting.md)).
- The rules are explicit, per client address: `/sign-in/email` 3 requests per 10 seconds, `/request-password-reset` 3 per 60 seconds and `/reset-password` 5 per 60 seconds.
- Public forms such as the contact form use `checkRateLimit({ scope, limit, windowSeconds, headers })` from `src/server/rate-limit`, with the `rateLimitCounter` table in the same database. It uses a fixed window aligned to the epoch and one row per key. The increment is a single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` statement, so concurrent requests cannot read the same count. A refused request still counts. `windowSeconds` must be between 1 and 86400.
- The `tooManyRequests(retryAfterSeconds)` helper builds a 429 response with `Retry-After`.
- The key is the HMAC-SHA256 of `<scope>:<address>`, under a key derived from `BETTER_AUTH_SECRET` with the label `rate-limit`, so no plain IP address is stored.
- On Vercel (`VERCEL=1`) the client address is the first value of `x-forwarded-for`. Outside Vercel, or when the header is missing, every request shares one bucket. IPv6 addresses are grouped by /64, and an IPv4-mapped IPv6 address counts as IPv4.
- When a window opens, rows older than 24 hours are removed, in batches of 100.
- The contact form allows 5 submissions per 3600 seconds per client address (scope `contact`).
- There is no in-memory limiter and no extra service, because instances on Vercel do not share memory.

## File storage

- Files go to Vercel Blob through the interface in `src/server/storage`. Uploads happen on the server only.
- The upload pipeline rejects files over 4 MB, detects the type from the first bytes (JPEG, PNG, WebP or PDF) and ignores the file name and the declared type. Images are re-encoded to WebP with sharp, limited to 2048 px on the longer side, which also removes metadata. PDFs are stored as they are. The stored name is generated.
- The Blob store access type is `public`, because every file on the site is public.
- Without `BLOB_READ_WRITE_TOKEN`, storage is off and the admin panel will say so. Local development uses a separate development Blob store; there is no adapter that writes to disk.

## Email

- SMTP is optional and all or none: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM`. Without them, email is off. A partly set group is an error that names the missing variables.
- Port 465 uses TLS from the start. Other ports use STARTTLS when the server offers it.
- With SMTP, the password reset link is sent by email. The email is plain text, Turkish first and then English. The link is `/tr/dashboard/reset-password?token=...`; that page is planned.
- The token is valid for 1 hour and works once. A password reset ends every session of the user.
- The email is sent after the response with `after()`, so a known and an unknown address get the same answer. A send failure is logged as the error kind and code only.
- Without SMTP, the reset request is refused (`RESET_PASSWORD_DISABLED`), the "forgot password" link is hidden and recovery is a command run on the server (`pnpm admin:reset-password`). This exists today:
  - `printf '%s\n' '<new password>' | pnpm admin:reset-password --email <address>`
  - The password comes only from standard input, never from the arguments.
  - The command stores a new hash and ends all sessions of the user. It exits with code 1 for an unknown email or a password shorter than 12 characters.
- Planned: email change verification comes with the account screen.

## Demo mode

- `DEMO_MODE` is read in `src/server/env.ts`. It is `true` or `false`, the default is `false`, and any other value is an error. The mode is read on every request, not once at startup.
- `assertWritable()` in `src/server/demo/guard.ts` is called by every content write service right after the session guard. In demo mode it throws `DemoModeError`. Route handlers turn the error into a 403 JSON response with `demoModeResponse(error)`; Server Actions map it to a form result.
- A `hooks.before` deny list in `src/server/demo/auth-hooks.ts` refuses state-changing account endpoints with 403 ("This action is disabled in demo mode"): change password, change email, update user, update session, delete user, password reset request and reset, verification email, session revocation and provider linking.
- Sign-in, sign-out and get-session stay open, so the demo admin can still sign in and read everything.
- A test fails when a Better Auth upgrade adds an endpoint that is on neither the blocked list nor the open list.
- In demo mode the contact form does not store messages. It returns a summary for the sender with a note that the message was not saved. This is the server side; the form UI is planned.
- Planned: a banner on the site says that the brand is fictional and that nothing is for sale.
- The public demo is read-only and uses a demo admin account.

## Contact form

- The public Server Action is `submitContactMessage` in `src/server/contact/actions.ts`. It runs in this order:
  1. A filled honeypot field (`website`) returns ok and stores nothing.
  2. Validation runs before the rate limit, so a typo does not use up a submission.
  3. The rate limit applies (see Rate limiting).
  4. In demo mode the action returns the summary. Otherwise it stores the message.
- Field errors are codes (`required`, `too_long`, `invalid`) that the UI translates. Limits: name 100, email 254, subject 150, message 5000 characters.
- The services in `src/server/contact/service.ts` are `listMessages({ limit, cursor })` (newest first, limit 1 to 100, default 20), `markMessageRead` and `deleteMessage`. They are not guarded themselves. Admin entry points must call `guardAction` first. The write services refuse in demo mode.
- Planned: the contact page with the form, and the message screens in the admin panel.

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
- CI, branch protection and the Semgrep, zizmor and gitleaks scans are described in [ADR 0008](adr/0008-ci-and-protection-layers.md) and the [Git workflow guide](guides/git-workflow.md).

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
  server/      env, db, auth, storage, rate-limit, demo guard, contact, content
  components/  shared components (the Markdown renderer)
  proxy.ts     locale routing and security headers
tooling/       git hooks, scripts, Semgrep rules, site-audit, pinned CI images
```

Planned additions: `src/lib` (shared pure helpers), `public/`, `docs/runbooks/` and `docs/security/`.
