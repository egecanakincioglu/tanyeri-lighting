# Tanyeri Lighting

Tanyeri Lighting is an open-source website and admin panel for Tanyeri, a fictional lighting brand. The site is bilingual (Turkish and English) and is planned to have a product catalog, projects, references and a contact form. An admin panel manages all content. The project is written with Next.js 16, TypeScript, PostgreSQL and Prisma, and it is built to run on Vercel without depending on it.

## Status

- **Version:** v0.1.0. The project is a rewrite from scratch, developed in phases.
- **Phase:** the skeleton and quality gates (phase 3) are done. The server foundation (phase 4) is in progress.
- **What works today:** a localized placeholder page at `/tr` and `/en`, validated environment variables, security headers with a nonce-based Content Security Policy, the Better Auth core (sign-in routes, sessions in the database, rate limits in Postgres), and an upload pipeline for files. The CI checks and the release pipeline are complete.
- **What does not exist yet:** the content (products, projects, references, pages), the public pages, the admin panel, the demo mode and the contact form. See the [roadmap](docs/roadmap.md).

This project started in 2023 as "Afra Lighting", a website built for a client. The rewrite closes the known security problems of that version from the ground up and publishes the new version as open source. The old code and its history are not part of this repository.

## Live demo

https://tanyeri-lighting.vercel.app

The demo shows the placeholder page only. It is kept out of search indexes (`noindex`) until 1.0.0. Demo sign-in details will be listed here when the admin panel exists.

## Features

Done:

- Two languages, Turkish and English, with a language prefix on every address (`/tr`, `/en`). The root address redirects by the browser language and falls back to Turkish.
- Environment validation with zod; error messages name the variable and never print its value.
- Nonce-based Content Security Policy and security headers (HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`).
- Authentication with Better Auth: email and password, no public sign-up, sessions stored in the database, rate limits stored in Postgres.
- Optional email through SMTP: the password reset link is sent by email (see the SMTP variables in the [development setup](docs/guides/development-setup.md)).
- File storage on Vercel Blob with an upload pipeline: 4 MB limit, file type detected from the first bytes (JPEG, PNG, WebP, PDF), images re-encoded to WebP with sharp.
- A switch that keeps the site out of search indexes (`SITE_INDEXING`).
- Automated quality gates and tag-based releases (see below).

Planned:

- Public pages: home, products with categories and product pages, catalogs, services, projects with a before and after comparison, references, about, contact, privacy and terms.
- Admin panel: content and product management, contact messages, visit statistics.
- Demo mode: a read-only demo in which all content writes are refused.
- An optional Google Ads module.
- SEO and structured data, and an accessibility and performance review.

## Tech stack

| Area | Technology |
|---|---|
| Framework | Next.js 16.4.3 (App Router), React 19.3.1 |
| Language | TypeScript 6.0.3 (strict) on Node 24 |
| Database | PostgreSQL 18 (Neon in production), Prisma 7.10.1 with `@prisma/adapter-pg` |
| Authentication | Better Auth 1.7.14 |
| Styling | Tailwind CSS 4.3.3 |
| Internationalization | next-intl 4.14.9 |
| Validation | zod 4.6.7 |
| File storage | Vercel Blob (`@vercel/blob` 2.8.2), sharp 0.35.5 |
| Tests | Vitest 5.0.5, Testing Library |
| Quality tools | ESLint 10.13.0, Prettier 3.9.10, Semgrep, knip, Lighthouse 13.5.0, axe-core 4.14.0 |
| Package manager | pnpm 12.15.0 (through Corepack) |

The reasons for each choice are recorded in the [architecture decision records](docs/adr/README.md).

## Architecture

The application is one Next.js app. Public pages live under `src/app/[locale]/(site)`, the admin panel will live under `src/app/[locale]/(admin)/dashboard`, and route handlers under `src/app/api`. Server code is in `src/server`. Authorization is checked in every page, action and handler; the proxy is not trusted for it. See [docs/architecture.md](docs/architecture.md) for the full overview.

## Getting started

### Prerequisites

- Node 24 (see `.node-version`).
- pnpm 12.15.0, provided by Corepack (`corepack enable`).
- Docker, for the local PostgreSQL database.
- gitleaks 8.30.1, or a running Docker (or Podman) daemon, if you want to commit. The pre-commit hook scans staged changes for secrets and rejects the commit when no scanner is available.

The commands work in Git Bash on Windows and in a shell on Linux.

### Steps

```bash
git clone <repository-url> tanyeri-lighting
cd tanyeri-lighting
corepack enable
pnpm install --frozen-lockfile
bash tooling/scripts/setup-git-hooks.sh
node tooling/scripts/doctor.ts
cp .env.example .env
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Then open http://localhost:3000.

- `setup-git-hooks.sh` installs the Git hooks and the commit signing setup. You need it only if you plan to commit. `doctor.ts` checks the machine and prints a fix for each problem.
- Edit `.env` if you need to. The defaults match the database from `pnpm db:up`. `BETTER_AUTH_SECRET` must have at least 32 characters; generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. `BLOB_READ_WRITE_TOKEN` is optional; without it, uploads are off.
- `pnpm db:migrate` runs `prisma migrate dev`. The Prisma CLI loads `.env` itself; real environment variables take precedence over `.env`. Run Prisma commands from the repository root.
- Before `pnpm db:seed`, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 12 characters) in `.env`. The seed creates the first admin from them. It is safe to run again: an existing email is left untouched, and the password is never printed.

More detail is in the [development setup guide](docs/guides/development-setup.md).

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Starts the development server (`next dev`). |
| `pnpm build` | Creates the production build (`next build`). |
| `pnpm start` | Runs the production build (`next start`). |
| `pnpm test` | Runs all tests with coverage (`vitest run --coverage`). |
| `pnpm lint` | Runs ESLint with zero warnings allowed. |
| `pnpm typecheck` | Runs `next typegen` and the TypeScript check for the app and the tooling. |
| `pnpm format` | Formats files with Prettier. |
| `pnpm format:check` | Checks formatting without writing. |
| `pnpm knip` | Finds dead code and unused dependencies. |
| `pnpm db:up` | Starts the local PostgreSQL container in Docker. |
| `pnpm db:down` | Stops the container. The data volume is kept. |
| `pnpm db:migrate` | Runs `prisma migrate dev` (reads `.env`). |
| `pnpm db:seed` | Creates the first admin from `ADMIN_EMAIL` and `ADMIN_PASSWORD`; safe to repeat. |
| `pnpm admin:reset-password --email <address>` | Sets a new admin password read from stdin and ends all sessions of that user. |
| `pnpm site-audit --leg <pages\|mobile\|desktop>` | Audits the built site in Chrome; run `pnpm build` first. |
| `pnpm release:prepare` | Prepares a release: version, changelog and release note draft. |

`postinstall` generates the Prisma client into `src/generated/prisma`.

## Testing

`pnpm test` runs two Vitest projects:

- **Unit tests** (`src/**/*.test.ts` and `.test.tsx`) run in jsdom. Components are tested with Testing Library.
- **Integration tests** (`src/**/*.int.test.ts`) run against a real PostgreSQL. Each run drops and recreates the local `tanyeri_test` database and applies all migrations. The test files share that database, so they run one after another. Start the database with `pnpm db:up` first.

Coverage is measured for `src/server` and `src/lib`. The line coverage gate is 80% and the value can only go up (`tooling/coverage-thresholds.json`). A pull request that changes TypeScript under `src/` must change tests too. The repository tools in `tooling/` have their own tests (`node --test "tooling/**/*.test.ts"`), which CI runs on Linux and on Windows.

## Quality gates

Branch protection requires 13 checks on every pull request:

- `policy`: branch name, commit messages, signed commits, tests with source changes, thresholds that only go up, documentation links and language, forbidden terms and paths, secret scan of the full history.
- `pr-text`: pull request title and text.
- `quality`: type check, formatting, ESLint, Semgrep project rules, dependency audit, production licenses, dead code.
- `test`: unit and integration tests with the coverage gate.
- `build`: the production build.
- `site-audit (pages)`, `site-audit (mobile)`, `site-audit (desktop)`: the page audit in real Chrome.
- `tooling (linux)` and `tooling (windows)`: tests of the repository tools.
- `analyze (javascript-typescript)`, `analyze (actions)` and `CodeQL`: CodeQL scans.

The page audit checks horizontal overflow on ten device views and on a 320 to 2560 px width sweep, accessibility with axe (WCAG 2.2 AA), and console and CSP errors. Lighthouse runs on mobile and on desktop. Each of its four categories (performance, accessibility, best practices, SEO) must score at least 90; the target is 95 or more. Transfer budgets limit mobile JavaScript to 180 KB, CSS to 30 KB and the total to 500 KB. The thresholds are in `tooling/site-audit/thresholds.json` and can only be tightened. See [ADR 0009](docs/adr/0009-quality-targets.md) and [ADR 0010](docs/adr/0010-quality-thresholds.md).

The [Git workflow guide](docs/guides/git-workflow.md) lists what each hook and job checks.

## Releases

Releases follow Semantic Versioning. Only a version tag deploys to production; merging into `main` publishes nothing by itself. A release is prepared on a `chore/release-vX-Y-Z` branch with `pnpm release:prepare`, rehearsed once in a preview environment, merged, and then tagged. The `release` workflow deploys the tagged commit through the Vercel REST API and creates the GitHub release. See the [release steps](docs/guides/git-workflow.md#releases), [ADR 0011](docs/adr/0011-versioning-and-releases.md), the [changelog](CHANGELOG.md) and the [release notes](releases/v0.1.0.md).

## Project structure

```text
.github/       CI workflows, pull request template, Dependabot
docs/          vision, architecture, roadmap, decision records, guides
messages/      interface texts: tr.json and en.json
prisma/        schema.prisma and migrations
releases/      release notes (vX.Y.Z.md)
src/
  app/         App Router: [locale]/(site), api/auth
  i18n/        routing and request configuration
  server/      environment, database, auth, storage
  test/        helpers for integration tests
  proxy.ts     locale routing and security headers
tooling/
  ci-images/   pinned images for gitleaks, Semgrep and Postgres
  git-hooks/   pre-commit, commit-msg, pre-push
  scripts/     setup scripts, checks, doctor, release scripts (with tests)
  semgrep/     project-specific Semgrep rules
  site-audit/  page audit and its thresholds
```

## Documentation

- [docs/README.md](docs/README.md): index of the documentation
- [docs/vision.md](docs/vision.md): purpose, principles and scope
- [docs/architecture.md](docs/architecture.md): architecture overview
- [docs/roadmap.md](docs/roadmap.md): phases and current status
- [docs/adr/](docs/adr/README.md): architecture decision records
- [docs/guides/development-setup.md](docs/guides/development-setup.md): local setup and daily commands
- [docs/guides/git-workflow.md](docs/guides/git-workflow.md): branches, commits, checks and releases
- [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md)

## License

[MIT](LICENSE)
