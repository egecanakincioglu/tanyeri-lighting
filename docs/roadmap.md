# Roadmap

The project is developed in phases. The architecture is described in [architecture.md](architecture.md), and the decisions behind it are in the [ADRs](adr/README.md).

## Status

- **Current phase:** phase 4, server foundation.
- **Released:** v0.1.0 (application skeleton, quality gates and release pipeline).
- **Live demo:** https://tanyeri-lighting.vercel.app. It stays out of search indexes until 1.0.0.

## Phases

| Phase | Scope | Status |
|---|---|---|
| 0-2 | Repository setup and governance | Done |
| 3 | Application skeleton and quality gates | Done (v0.1.0) |
| 4 | Server foundation | In progress |
| 5 | Brand and design system | Planned |
| 6 | Public site (bilingual) | Planned |
| 7 | Admin panel | Planned |
| 8 | Hardening | Planned |
| 9 | Launch (1.0.0) | Planned |

## Phase 4: server foundation

Done:

- Environment validation per module.
- Security headers and a nonce-based Content Security Policy.
- Better Auth core: email and password, sessions in the database, rate limits in Postgres.
- File storage with an upload pipeline on Vercel Blob (4 MB limit, file type check, image re-encoding).
- Authorization guard on every admin page, action and route handler, enforced by a static check.
- Seed and first admin user (`pnpm db:seed`), and password recovery without email (`pnpm admin:reset-password`).

Next:

- Demo mode guard (all content writes refused).
- Rate limiting for public forms.
- Optional SMTP email.
- Content schemas: site settings, categories, products, catalogs, home page blocks, services, projects, references and contact messages.
- Runbook for rotating secrets.

## Later phases

- **Phase 5:** logo, colors and typography; design tokens; base components; demo banner; favicon, manifest and Open Graph image.
- **Phase 6:** all public pages in both languages, demo content, SEO, structured data and visit tracking.
- **Phase 7:** sign-in and account pages, content management screens, messages, visit statistics and the Google Ads screen.
- **Phase 8:** security review, accessibility review, performance work and a pixel-perfect pass on all widths.
- **Phase 9:** production environment, the 1.0.0 release with indexing turned on, and a release and rollback runbook.

## Manual steps

- Set the production environment variables and create the production Blob store at launch.
- Register the site in Search Console and Bing Webmaster Tools at launch.
- Set the repository topics, description and website link at launch.
- Create the logo (phase 5).
