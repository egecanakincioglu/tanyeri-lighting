# Roadmap

The project is developed in phases. The architecture is described in [architecture.md](architecture.md), and the decisions behind it are in the [ADRs](adr/README.md).

## Status

- **Current phase:** phase 8, hardening, plus the remaining page copy, categories and blog work.
- **Released:** see the [changelog](../CHANGELOG.md) and the [releases page](https://github.com/egecanakincioglu/tanyeri-lighting/releases).
- **Live demo:** https://tanyeri-lighting.vercel.app. It stays out of search indexes until 1.0.0.

## Phases

| Phase | Scope | Status |
|---|---|---|
| 0-2 | Repository setup and governance | Done |
| 3 | Application skeleton and quality gates | Done (v0.1.0) |
| 4 | Server foundation | Done |
| 5 | Brand and design system | Done (v0.3.0) |
| 6 | Public site (bilingual) | Done, except page copy, categories and blog |
| 7 | Admin panel | Done |
| 8 | Hardening | In progress |
| 9 | Launch (1.0.0) | Planned |

## Phase 4: server foundation

Done:

- Environment validation per module.
- Security headers and a nonce-based Content Security Policy.
- Better Auth core: email and password, sessions in the database, rate limits in Postgres.
- File storage with an upload pipeline on Vercel Blob (4 MB limit, file type check, image re-encoding).
- Authorization guard on every admin page, action and route handler, enforced by a static check.
- Seed and first admin user (`pnpm db:seed`), and password recovery without email (`pnpm admin:reset-password`).
- Optional SMTP email: the `sendEmail` module and the password reset link by email.
- Rate limiting for public forms: the `checkRateLimit` module on a Postgres counter table.
- Demo mode guard: content writes and state-changing account endpoints are refused.
- Contact messages, server side: the `contactMessage` table, the public contact Server Action with honeypot, validation, rate limit and demo summary, and the list, read and delete services. The contact page, the form and the message screen are done.
- Content schema 1: site settings, social links, page metadata and legal pages, with bilingual fields and a limited Markdown renderer.
- Content schema 4: projects (with before/after images) and references, with bilingual fields and ordering.
- Content schema 2: categories (at most 8), products with slug redirects, and catalogs, with bilingual fields and ordering.
- Content schema 3: home banner, featured products, promo boards, application areas, service cards and the about page, with bilingual fields and ordering.

## Phase 5: brand and design system

- Done: design tokens, local fonts, logo, base components, demo notice band, site icons, web app manifest and default share image.

## Phase 6: public site (bilingual)

- Done: fictional demo content and the `pnpm db:seed:demo` command, with demo photos and a catalog under `public/demo`.
- Done: header and footer, home, about, vision, services, products with tabs and pagination, product page, projects with a before and after slider, references, catalogs with a page-flip viewer, contact form, privacy, terms and a not-found page, in both languages.
- Done: visit tracking (anonymous page views).
- Done: SEO foundation (localized titles and descriptions, canonical addresses with language alternates, sitemap, `robots.txt`, plain-text site guide, structured data).
- Remaining: final page copy, product categories and a blog.

## Phase 7: admin panel

- Done: sign-in page, sign-out and a protected panel page.
- Done: the statistics screen (visits, page views and countries).
- Done: content management screens for every content type, contact messages, legal pages, page information for search, the account screen and password reset by email or by command.

## Later phases

- **Phase 8:** security review, accessibility review, performance work, a pixel-perfect pass on all widths and a final review of the whole site.
- **Blog and categories:** a blog and the product category landing pages come in their own pull requests.
- **Phase 9:** production environment, the 1.0.0 release with indexing turned on, and a release and rollback runbook.

## Manual steps

- Set the production environment variables and create the production Blob store at launch.
- Register the site in Search Console and Bing Webmaster Tools at launch.
- Set the repository topics, description and website link at launch.
- Write the runbook for rotating secrets before launch.
