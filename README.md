# Tanyeri Lighting

Tanyeri Lighting is a bilingual (Turkish and English) website and admin panel for Tanyeri, a fictional lighting brand. The code is source-available under a noncommercial license. The project uses Next.js 16, TypeScript, PostgreSQL and Prisma. It is built to run on Vercel without depending on it.

This is a from-scratch rewrite of an older client site. The old code and its history are not part of this repository.

## Status

The latest version is the newest [GitHub release](https://github.com/egecanakincioglu/tanyeri-lighting/releases/latest). The [changelog](CHANGELOG.md) lists what each release changed, and the [roadmap](docs/roadmap.md) lists what is left before 1.0.0.

## Live demo

- Site: https://tanyeri-lighting.vercel.app (kept out of search indexes until 1.0.0)
- Admin panel: https://tanyeri-lighting.vercel.app/tr/yonetim/giris

Demo sign-in:

| Field | Value |
|---|---|
| Email | `demo@tanyeri.example` |
| Password | `TanyeriDemo2026` |

The account is read-only and public on purpose. It works only while demo mode is on. In demo mode, saves are refused and contact messages are not stored.

## Features

- **Public pages** in Turkish and English, with a language prefix on every address (`/tr`, `/en`): home, about, vision, services, products (categories, tabs, pagination, product page), catalogs with a page-flip viewer, projects with a before and after slider, references, blog, contact form, privacy, terms and a not-found page.
- **Admin panel** at `/tr/yonetim` (`/en/admin`): home banner, featured products, promo boards, work areas, company settings and social links, about and vision, references, services, projects, blog articles, products, categories, catalogs, contact messages, legal pages, page information for search (SEO), account and visit statistics. All texts are stored in both languages.
- **Password reset** by email when SMTP is set, or by a command on the server (`pnpm admin:reset-password`).
- **Visit statistics:** one row per day and shortened address (IPv4 cut to /24, IPv6 to /48), with country, city and a view count. The table stores no path, referrer or browser string. Rows older than 13 months are deleted.
- **Contact messages** are stored with name, email, subject, message and language. They contain no IP address. A honeypot field and a rate limit protect the form.
- **Optional email** through SMTP and **optional file storage** on Vercel Blob (images up to 20 MB and PDFs up to 50 MB, sent directly from the browser to the store; the file type is detected from the first bytes; images are re-encoded to WebP).
- **Demo mode:** a read-only demo account, refused writes, a notice band on every public page, and no stored contact messages.
- **SEO foundation:** localized titles and descriptions edited in the panel, canonical addresses with language alternates, a sitemap, `robots.txt`, a plain-text site guide, JSON-LD (`WebSite`, `Organization`, `ContactPage`, `BreadcrumbList`) and a switch (`SITE_INDEXING`) that keeps the site out of search indexes.
- **Security:** a nonce-based Content Security Policy and security headers, no public sign-up, sessions stored in the database, rate limits stored in Postgres, and an authorization check in every admin page, action and handler, enforced by a static check in CI.

## Tech stack

| Area | Technology |
|---|---|
| Framework | Next.js 16.4.5 (App Router), React 19.3.1 |
| Language | TypeScript 6.0.3 (strict) on Node 24 |
| Database | PostgreSQL 18 (Neon in production), Prisma 7.10.1 with `@prisma/adapter-pg` |
| Authentication | Better Auth 1.7.14 |
| Styling | Tailwind CSS 4.3.3 |
| Fonts | Figtree (self-hosted) |
| Internationalization | next-intl 4.14.9 |
| Validation | zod 4.6.7 |
| File storage | Vercel Blob (`@vercel/blob` 2.8.2), sharp 0.35.5 |
| Tests | Vitest 5.0.5, Testing Library |
| Quality tools | ESLint 10.13.0, Prettier 3.9.10, Semgrep, knip, Lighthouse 13.5.0, axe-core 4.14.0 |
| Package manager | pnpm 12.15.0 (through Corepack) |

The reasons for each choice are in the [architecture decision records](docs/adr/README.md). The [architecture overview](docs/architecture.md) explains how the parts fit together.

## Run it locally

You do not need Git hooks or commit signing to run the site.

### Prerequisites

- Node 24 (see `.node-version`).
- Docker, running, for the local PostgreSQL database.
- Git.

### Steps

```bash
git clone https://github.com/egecanakincioglu/tanyeri-lighting.git
cd tanyeri-lighting
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm db:seed:demo
pnpm dev
```

Then open http://localhost:3000.

- `pnpm db:seed` creates the first admin. `pnpm db:seed:demo` fills the site with fictional demo content. Without `pnpm db:seed:demo` the site is empty.
- The commands work in Git Bash on Windows and in a shell on Linux. On Windows, `corepack enable` can fail with `EPERM` when it writes to `C:\Program Files\nodejs`. Run it once in an administrator terminal, or install pnpm instead with `npm install -g pnpm@12.15.0`.

### Sign in to the panel

Open http://localhost:3000/tr/yonetim/giris. Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env`. The defaults in `.env.example` are `admin@example.com` and `replace-me-with-a-long-password`. The password needs at least 12 characters.

A local demo account exists only when `DEMO_MODE=true` and both `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD` are set before `pnpm db:seed:demo` runs.

### If something fails

- **Docker is not running:** `pnpm db:up` fails. Start Docker and run it again.
- **Port 5432 or 3000 is in use:** stop the other program. The database container listens on `127.0.0.1:5432`, and the dev server uses port 3000.
- **`BETTER_AUTH_SECRET` is shorter than 32 characters:** the app stops with an error that names the variable. The default value in `.env.example` is long enough but is for local use only. Generate your own for any other use:

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```

More detail is in the [development setup guide](docs/guides/development-setup.md).

## Optional features

The required variables are `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`. The seed also reads `ADMIN_EMAIL` and `ADMIN_PASSWORD`. All other variables are optional:

| Variable | What it turns on | Without it |
|---|---|---|
| `SITE_INDEXING` | `on` lets search engines index the site. | `off` (default): pages send `noindex`, and `robots.txt` closes the site. |
| `SITE_URL` | The public address used by canonical links, the sitemap and structured data. | On Vercel the production host is used; a local run uses `http://localhost:3000`. |
| `BLOB_READ_WRITE_TOKEN` | File uploads (images and catalog PDFs) to Vercel Blob. | Uploads are off, and the panel says so. |
| `DEMO_MODE` | `true` makes the site a public demo: writes are refused, the demo notice shows and contact messages are not stored. | `false` (default): the normal site. |
| `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD` | A read-only demo account, created by `pnpm db:seed:demo` and shown on the sign-in page in demo mode. Set both or neither. The password needs at least 12 characters and is public by design. | No demo account. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Email: the password reset link is sent by mail. Set all five or none. A partly set group is an error. | Email is off. The reset request is refused, and recovery is `pnpm admin:reset-password`. |

## Deploy your own copy

The project runs on Vercel with a Neon Postgres database. `pnpm build && pnpm start` also works on any Node host with a Postgres database.

1. Create a Neon database. Copy the pooled address into `DATABASE_URL` and the direct address into `DATABASE_URL_UNPOOLED`.
2. Create a Vercel project from the repository and set the variables: the four required ones, `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the seed, and any optional ones. `BETTER_AUTH_URL` is the public `https` address. Set `DEMO_MODE=true` for a public read-only demo.
3. The build command (`tooling/scripts/vercel-build.ts`, set in `vercel.json`) generates the Prisma client, applies migrations with `prisma migrate deploy` in preview and production, and then runs `next build`. It needs `DATABASE_URL_UNPOOLED`.
4. Run the seeds once against the new database, with its variables in your environment: `pnpm db:seed`, and `pnpm db:seed:demo` if you want demo content.

The repository turns off Vercel's automatic Git deployments (`git.deploymentEnabled: false` in `vercel.json`). Deployments start from the GitHub release workflows, which read a Vercel token and project values from the repository settings. For your own copy, remove that setting or adapt the workflows. See the [Git workflow guide](docs/guides/git-workflow.md#releases) and [ADR 0011](docs/adr/0011-versioning-and-releases.md).

The [license](#license) does not allow commercial use of the code.

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Git workflow guide](docs/guides/git-workflow.md) first. In short:

- Work on a branch named `<type>/<kebab-case>`, never on `main`. Commits are atomic, follow Conventional Commits in English and are signed.
- Install the Git hooks and the signing setup once per clone: `bash tooling/scripts/setup-git-hooks.sh`. The pre-commit hook scans staged changes for secrets with gitleaks 8.30.1, or with a pinned image when Docker (or Podman) runs. Without a scanner the commit is rejected.
- Check the machine with `node tooling/scripts/doctor.ts`. It prints a fix for each problem.
- Before a pull request, run `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm test`. Changes under `src/` need tests in the same pull request.

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
| `pnpm db:seed:demo` | Fills the site with fictional demo content. Refuses if content exists, unless run with `--replace` or `DEMO_MODE=true`. |
| `pnpm admin:reset-password --email <address>` | Sets a new admin password read from stdin and ends all sessions of that user. |
| `pnpm site-audit --leg <pages\|mobile\|desktop>` | Audits the built site in Chrome; run `pnpm build` first. Set `CHROME_PATH` if Chrome is not found. |
| `pnpm release:prepare` | Prepares a release: version, changelog and release note draft. |

`postinstall` generates the Prisma client into `src/generated/prisma`.

## Testing

`pnpm test` runs two Vitest projects:

- **Unit tests** (`src/**/*.test.ts` and `.test.tsx`) run in jsdom. Components are tested with Testing Library.
- **Integration tests** (`src/**/*.int.test.ts`) run against a real PostgreSQL. Each checkout has its own database, `tanyeri_test_<8 hex characters>`, where the 8 characters are a hash of the repository root. A run recreates that database and applies all migrations at its start, and drops it at its end. Start the database with `pnpm db:up` first.

Coverage is measured for `src/server` and `src/lib`. The line coverage gate is 80% and the value can only go up (`tooling/coverage-thresholds.json`). The repository tools in `tooling/` have their own tests (`node --test "tooling/**/*.test.ts"`), which CI runs on Linux and on Windows.

## Quality gates

Branch protection requires 12 checks on every pull request:

- `policy`: branch name, commit messages, signed commits, tests with source changes, thresholds that only go up, documentation links and language, forbidden terms and paths, secret scan of the full history.
- `pr-text`: pull request title and text.
- `quality`: type check, formatting, ESLint, Semgrep project rules, dependency audit, production licenses, dead code.
- `semgrep-registry`: the community rule sets of the Semgrep registry. The rules are fetched at run time and are not pinned.
- `zizmor`: security audit of the GitHub Actions workflows.
- `test`: unit and integration tests with the coverage gate.
- `build`: the production build.
- `site-audit (pages)`, `site-audit (mobile)`, `site-audit (desktop)`: the page audit in real Chrome.
- `tooling (linux)` and `tooling (windows)`: tests of the repository tools.

The page audit checks horizontal overflow on ten device views and on a 320 to 2560 px width sweep, accessibility with axe (WCAG 2.2 AA), and console and CSP errors. Lighthouse runs on mobile and on desktop. Each of its four categories (performance, accessibility, best practices, SEO) must score at least 90; the target is 95 or more. Transfer budgets limit mobile JavaScript to 180 KB, CSS to 30 KB and the total to 500 KB. The thresholds are in `tooling/site-audit/thresholds.json` and can only be tightened. See [ADR 0009](docs/adr/0009-quality-targets.md) and [ADR 0010](docs/adr/0010-quality-thresholds.md).

## Releases

Releases follow Semantic Versioning. Only a version tag deploys to production; merging into `main` publishes nothing by itself. A release is prepared on a `chore/release-vX-Y-Z` branch with `pnpm release:prepare`, rehearsed once in a preview environment, merged, and then tagged. The `release` workflow deploys the tagged commit through the Vercel REST API and creates the GitHub release. See the [release steps](docs/guides/git-workflow.md#releases), [ADR 0011](docs/adr/0011-versioning-and-releases.md), the [changelog](CHANGELOG.md) and the notes in [`releases/`](releases/).

## Project structure

```text
.github/       CI workflows, pull request template, Dependabot
docs/          vision, architecture, roadmap, decision records, guides, runbooks
messages/      interface texts: tr.json and en.json
prisma/        schema, migrations, first-admin seed and demo seed
public/        brand files, icons, demo photos and catalogs
releases/      release notes (vX.Y.Z.md)
src/
  app/         App Router
    [locale]/(site)    public pages
    [locale]/(admin)   admin panel: sign-in, reset pages and screens
    api/               auth and visit routes
  components/  shared components; admin/ for the panel, site/ for header and footer
  i18n/        routing and request configuration
  lib/         shared helpers: SEO, structured data, slugs, page metadata
  server/      environment, database, auth, content services, admin actions,
               contact, visits, rate limit, storage, email, demo guard
  test/        helpers for integration tests
  proxy.ts     locale routing and security headers
tooling/
  ci-images/   pinned images for gitleaks, Semgrep, zizmor and Postgres
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
- [docs/runbooks/](docs/runbooks/README.md): operating procedures
- [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md)

## License

The project is under the [PolyForm Noncommercial License 1.0.0](LICENSE). Anyone may read, study, modify and use the code, or parts of it, for any noncommercial purpose, such as personal use, education, research or work for a nonprofit. Commercial use is not allowed. Versions published before this change (up to and including v0.1.0) stay under the MIT license.

The license is not approved by the Open Source Initiative, so the project is source-available, not open source.
