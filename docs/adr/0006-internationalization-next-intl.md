# ADR 0006: Internationalization - next-intl, `[locale]` segment, `proxy.ts`

Status: Accepted
Date: 2026-10-28

## Context

The old site was Turkish only. The project decision is: **the site is bilingual, Turkish and English.** The method is also set: next-intl; `messages/tr.json` and `messages/en.json`; bilingual fields in the content data; locale routing with `proxy.ts`; routes under `src/app/[locale]/...`. Setup is part of the app skeleton in phase 3; pages come in phases 6-7.

Facts checked before the decision:

- The latest next-intl version is 4.14.9. Its peer range covers `next ^16` and `react ^19`.
- App Router setup:
  - `src/i18n/routing.ts` (`defineRouting`), `src/i18n/navigation.ts` (`createNavigation`) and `src/i18n/request.ts`.
  - `export default createMiddleware(routing)` in `src/proxy.ts`.
  - The default matcher leaves out `api`, `trpc`, `_next`, `_vercel` and paths that contain a dot.
- The recommended way for static rendering is `next/root-params`, which has been on by default since Next.js 16.3. `setRequestLocale` is supported as the older way.
- Full compatibility of next-intl with Cache Components enabled is not covered in the documentation.

## Options

| Option | Pros | Cons |
|---|---|---|
| next-intl 4 | Peer support for Next.js 16; `proxy.ts` integration; typed messages; locale-aware `Link`/`redirect`; `next/root-params` support | Extra dependency; shares the proxy with the CSP code |
| Manual setup from the Next.js i18n guide (dictionary files + proxy) | No dependency | Locale-aware navigation, formatting and plural rules are written by hand; out of scope |
| Another i18n library | - | Not researched; out of scope |

## Decision

**The project uses next-intl for the bilingual structure.**

Rules:

1. The locales are `tr` and `en`. `messages/tr.json` and `messages/en.json` carry only interface texts; all content edited from the panel, including legal pages, lives in bilingual fields in the database. The two files must have the same set of keys. A test catches a missing or extra key.
2. All pages are under `src/app/[locale]/...`. The root layout validates the locale with `hasLocale` and calls `notFound()` if it is invalid. `<html lang>` shows the active locale.
3. On the server, the locale is read with `next/root-params` (the way next-intl recommends); the valid locales come from `routing.locales`. Because pages are already rendered dynamically because of the nonce-based CSP ([ADR 0001](0001-architecture-nextjs-16-app-router.md), rule 9), `setRequestLocale` is not used.
4. Navigation uses only `Link`, `redirect`, `useRouter` and `usePathname` from `src/i18n/navigation.ts`. `next/link` is not used for locale-aware paths.
5. `proxy.ts` is a single file: the next-intl proxy and the CSP/security headers are combined in the same function. The proxy does no authorization ([ADR 0001](0001-architecture-nextjs-16-app-router.md), rule 3). The matcher leaves out `api` paths and static files.
6. The format of the bilingual fields in the content data is set in the schema PR in phase 4.
  - Decided (2026-11-01): one required column per language, `<field>Tr` and `<field>En`, both `NOT NULL`. Services take and return `{ tr, en }`.
7. Metadata (`generateMetadata`), `sitemap.ts` and `alternates.languages` include both languages.
8. **Default locale and prefix:** the default locale is `tr`; `localePrefix: "always"`.
   - Every address starts with `/tr/...` or `/en/...`; the address structure of the two languages stays symmetric.
   - A request to the root `/` is redirected to `/tr` or `/en` based on the `Accept-Language` header; if nothing matches, it goes to `/tr`.
   - The redirect uses the locale detection of next-intl. This behavior, including the priority of the cookie over the header, is verified with a test in phase 3.
9. **Addresses:** each language uses addresses in its own language (next-intl `pathnames`, for example `/tr/urunler` and `/en/products`); dynamic parts (such as a product key) do not depend on the language. The address structure of the two languages stays symmetric as in rule 8. Decision date: 2026-10-28.

## Consequences

- Positive: All routes are locale-aware. `hreflang` alternatives for search engines are generated naturally.
- Negative: `proxy.ts` runs on every page request. Together with the nonce-based CSP, all pages are rendered dynamically; this is the cost accepted in [ADR 0001](0001-architecture-nextjs-16-app-router.md).
- Note: Full compatibility of next-intl with Cache Components has not been verified. Cache Components are not used anyway because of the nonce-based CSP; if this decision is reopened, it is tested separately.
- Required tests:
  - Key equality in the message files.
  - 404 for an invalid locale.
  - A request to the root `/` is redirected to `/tr` or `/en` based on `Accept-Language`, and to `/tr` if nothing matches.
  - The proxy produces the locale redirect and the CSP header together.
- Open items (not decided in this ADR; both are preliminary proposals):
  - Behavior of the language switcher: it goes to the equivalent of the same page in the other language, and the choice is remembered with the next-intl cookie. Decided in the header PR in phase 6.
  - Missing translations: both fields of bilingual content are required, and a page does not silently fall back to the other language. Decided in the schema PR in phase 4.
    - Decided (2026-11-01): both languages are required in the database and in the services, and a page never falls back to the other language.

  These are written with Vitest at the unit and integration level; the appearance is checked visually at desktop and mobile widths ([ADR 0007](0007-testing-strategy.md)).

## Sources

- https://github.com/amannn/next-intl/releases
- https://registry.npmjs.org/next-intl/4.14.9
- https://next-intl.dev/docs/routing/setup
- https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing
- https://nextjs.org/docs/app/guides/upgrading/version-16
