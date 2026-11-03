# ADR 0001: Architecture - Next.js 16 App Router; runs on Vercel but is not locked to it

Status: Accepted
Date: 2026-10-28

## Context

The site was written in 2023 with Next.js 15.0.2 Pages Router, React 18, a separate Express server (run by PM2), MySQL and JSON file databases. The goal is a public, bilingual, open source project with an admin panel and a demo that runs on the Vercel Hobby plan. One of the project principles is "runs on Vercel but is not locked to Vercel". See [the architecture overview](../architecture.md).

An early scan found that the admin pages were protected only by middleware, and that the Next.js version in use was affected by CVE-2025-29927. That flaw was fixed in 15.2.3; 16.x is not affected at all. The lesson still stands: authorization is not left to the network layer.

Facts checked before the decision:

- The latest stable Next.js version is 16.4.3. 16.x is Active LTS and 15.x is Maintenance LTS.
- The latest stable React version is 19.3.1. Next.js 16.4 ships with React 19.3.
- `proxy.ts` replaced `middleware.ts`. `proxy` runs only in the Node.js runtime; Edge is not supported.
- The request APIs (`cookies`, `headers`, `params`, `searchParams`) can only be used with `await`.
- Turbopack is the default for `next dev` and `next build`. `next lint` was removed.
- Cache Components are optional. Next.js 16.4 recommends them for every app, and they will be the default in Next.js 17.
- With a nonce-based CSP, all pages must be rendered dynamically. Static optimization and ISR stop working, the HTML cannot be cached on the CDN, and Partial Prerendering is not compatible with nonces. In the development server, React's debugging needs `'unsafe-eval'`; production does not.
- Vercel Hobby is for non-commercial personal use only; "advertising the sale of a product or service" counts as commercial. It includes 4 CPU-hours of Active CPU per month and 1,000,000 function invocations.
- Since 2025-12, four critical vulnerabilities were fixed in 16.x (RSC, `next/og`, `use cache`, Image Optimization). A planned security release for seven medium-severity issues is due on 2026-11-03.
- Since Next.js 16.2 there is a stable Adapter API for deployments outside Vercel.
- Node 24.x is the default on Vercel. Node 24 moved to maintenance LTS on 2026-10-20 and is supported until 2028-04-30.

## Options

| Option | Pros | Cons |
|---|---|---|
| Next.js 16 App Router, React 19; standard web APIs | Active LTS; Server Components, Server Actions, Metadata API, `sitemap.ts`/`robots.ts`; no configuration on Vercel; runs in any Node environment with `next start`; Adapter API for non-Vercel targets | Many breaking changes (async request APIs, `proxy.ts`, `next/image` defaults); frequent security releases must be followed closely |
| Stay on Next.js 15 Pages Router and upgrade | Fewest code changes | 15.x only gets critical fixes; the Express server and PM2 do not run on Vercel; the bilingual setup and Server Components do not fit the Pages Router |
| Move to another React framework | - | Full rewrite of all code; not researched and out of scope |

For the CSP:

| Option | Pros | Cons |
|---|---|---|
| Nonce-based CSP on all pages (`'strict-dynamic'`) | No `'unsafe-inline'` for scripts; one strict policy on all pages; Next.js adds the nonce to its own scripts automatically | All pages are dynamic; no CDN cache for HTML; Cache Components and Partial Prerendering cannot be used; more function CPU |
| Experimental SRI (hash-based CSP) | Pages can stay static | Experimental; may change or be removed; does not cover dynamically generated scripts |
| Static CSP with `'unsafe-inline'` (`next.config` headers) | Simple, stays static | The old site's CSP allowed `'unsafe-inline'` for scripts, and a static CSP cannot remove it |

## Decision

The project uses **Next.js 16 App Router and React 19.** The runtime is Node 24, the package manager is pnpm (one lock file) and TypeScript runs in strict mode. All code, including repository tooling, is TypeScript; there is no plain JavaScript. Node 24 runs tooling scripts without a build step, so only erasable TypeScript syntax is used there.

Rules:

1. **Version floor:** `next` is at least 16.4.5, `react` and `react-dom` are at least 19.3.1. The app skeleton PR in phase 3 waits for the 2026-11-03 security release or takes it right after. Versions are pinned exactly in the lock file; Dependabot proposes upgrades.
2. **Routes:** `src/app/[locale]/(site)/...` for public pages, `src/app/[locale]/(admin)/dashboard/...` for the admin, `src/app/api/...` for route handlers.
3. **`proxy.ts` does only two things:** locale routing ([ADR 0006](0006-internationalization-next-intl.md)) and security headers (including the CSP nonce). **Authorization is checked separately in every page, every Server Action and every route handler**; the proxy is not trusted for it. The proxy may do an optimistic redirect based on a session cookie, but this is never assumed to provide security.
4. **Async request APIs:** `params`, `searchParams`, `cookies()` and `headers()` are always used with `await`. Types are written with `PageProps`/`LayoutProps`/`RouteContext`, produced by `next typegen`.
5. **Turbopack:** it is the default bundler. No custom `webpack` configuration is added.
6. **Lint:** there is no `next lint`. The ESLint CLI with a flat config is used ([ADR 0008](0008-ci-and-protection-layers.md)).
7. **Anti-lock-in rules:**
   - `@vercel/*` packages are used only in small adapters under `src/server` (storage, geolocation headers). Application code depends on these interfaces.
   - The Edge runtime is not used; everything runs on Node.js.
   - `pnpm build && pnpm start` must work locally with Postgres in Docker, without Vercel.
   - Vercel-specific request headers (`x-vercel-ip-*`) are read in a single module. If a header is missing, the value stays empty and no error is thrown.
   - Environment variables use standard names (`DATABASE_URL` and so on) and are validated with zod at startup.
8. **Images:** remote sources for `next/image` are narrowed with `images.remotePatterns` to the Blob domain only. `sharp` is at least 0.35.5.
9. **CSP: nonce-based on all pages from the start.**
   - `proxy.ts` generates a new nonce on every request.
   - The script rule is `script-src 'self' 'nonce-...' 'strict-dynamic'`. There is no `'unsafe-inline'` for scripts and no SRI (hash-based CSP) experiment.
   - `'unsafe-eval'` is added only when `NODE_ENV=development`, because the Next.js documentation says React's development debugging needs it. It is not present in production.
   - The other headers are HSTS, `frame-ancestors 'none'`, `Referrer-Policy` and `Permissions-Policy`.
   - Cache Components are not enabled, because Partial Prerendering is not compatible with nonces.

## Consequences

- Positive: Express, PM2, `pages/` and `geoip-lite` never enter the new code. There is one Next.js app. Security patches arrive on the LTS line.
- Positive: Authorization does not depend on the proxy, so middleware/proxy bypass flaws like CVE-2025-29927 cannot grant unauthorized access on their own.
- Negative: The old Pages Router code is not migrated; the app is rewritten from scratch in the new repository (phases 3-7).
- **Accepted cost - nonce-based CSP.**
  - All pages are rendered dynamically; there is no static generation or ISR, and no CDN cache for HTML.
  - Every page request runs a function.
  - The Cache Components model that Next.js recommends is not used. The question is revisited when it becomes the default in Next.js 17.
  - CPU use is watched in the Vercel dashboard against the Hobby quota of 4 CPU-hours of Active CPU and 1,000,000 invocations per month.

  In return, all pages get the same strict policy without `'unsafe-inline'` for scripts.
- **Risk - Hobby terms.** Hobby allows only non-commercial personal use and counts advertising the sale of a product as commercial. The demo site is the catalog of a fictional brand. The demo banner states that the brand is fictional and that nothing is for sale.
- Negative: Next.js ships a security release about once a month. Dependabot security updates and the `pnpm audit` gate are required for this.
- Follow-up: When Node 26 becomes the default on Vercel, `.node-version` and CI are upgraded. This is not urgent because Node 24 is supported until 2028-04-30.
- Tests: for every protected page and handler, the cases "no session", "session without permission" and "write in demo mode" are tested in integration tests ([ADR 0007](0007-testing-strategy.md)).

## Sources

- https://nextjs.org/blog/next-16
- https://nextjs.org/docs/app/guides/upgrading/version-16
- https://nextjs.org/blog/next-16-4
- https://nextjs.org/support-policy
- https://github.com/vercel/next.js/releases
- https://github.com/vercel/next.js/security/advisories/GHSA-f82v-jwr5-mffw
- https://nextjs.org/blog/nextjs-security-update-october-14-2026
- https://nextjs.org/blog/upcoming-nextjs-security-release-november-2026
- https://nextjs.org/docs/app/guides/content-security-policy
- https://github.com/facebook/react/releases
- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/limits/fair-use-guidelines
- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- https://nodejs.org/docs/latest-v24.x/api/typescript.html
