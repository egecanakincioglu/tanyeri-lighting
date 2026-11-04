# Development setup

This guide explains how to set up and run the project on your machine. The Git rules are in the [Git workflow guide](git-workflow.md). The reasoning behind the technology choices is in the [architecture decision records](../adr/README.md).

## Supported environments

- **Windows:** Git Bash and PowerShell 5.1. The setup scripts (`.sh`) run in Git Bash. The Node tools (`node tooling/scripts/...ts`) run in both shells.
- **Linux:** the same commands. CI runs on Linux (`ubuntu-latest`). The `tooling (windows)` job also tests the repository tools on Windows.
- **Node:** 24 (`.node-version`). The `engines` field in `package.json` asks for `>=24.12.0 <25`. Node 24 runs `.ts` files without a build step. All code in the project is TypeScript; there is no plain JavaScript.
- **Package manager:** pnpm 12.15.0, pinned in the `packageManager` field of `package.json`. Corepack provides it, so you do not install pnpm yourself.

## First setup

Once per clone, to run the site. Docker must be running.

1. Clone the repository: `git clone https://github.com/egecanakincioglu/tanyeri-lighting.git`, then enter the folder.
2. Enable Corepack: `corepack enable`. On Windows this can fail with `EPERM` when it writes to `C:\Program Files\nodejs`. Run it once in an administrator terminal, or install pnpm with `npm install -g pnpm@12.15.0`.
3. Install the dependencies from the lock file: `pnpm install --frozen-lockfile`. The `postinstall` script generates the Prisma client.
4. Copy the environment file: `cp .env.example .env`.
5. Start the database and prepare it: `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:seed:demo`. Without the demo seed the site is empty.
6. Start the site with `pnpm dev` and open http://localhost:3000. The admin panel is at `/tr/yonetim/giris`; sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.

Only if you plan to commit:

7. Install the Git hooks: `bash tooling/scripts/setup-git-hooks.sh`. The script sets `core.hooksPath` to `tooling/git-hooks`, turns off `core.autocrlf` and runs the commit signing setup.
8. Check the environment: `node tooling/scripts/doctor.ts`.

Commit signing is set up by the script in step 7 (`tooling/scripts/setup-commit-signing.sh`). Commits are signed with an SSH key. Your Git identity (`user.email`) must be set; if it is not, the script stops. An existing `user.signingkey` is kept. Without one, the script generates the key `~/.ssh/tanyeri_signing_ed25519`.

`doctor` lists every check and shows a fix command for each failed check. It exits with code 1 when a check fails; a warning (`warn`) does not change the exit code. Add `--json` for machine-readable output. The checks are: Node version, Git identity, Git hooks, commit signing, allowed signers, line endings, gitleaks, the GitHub CLI (`gh`) and pnpm.

## Docker

Docker is needed for the local database and for two tools. The images of the tools come from the list in `tooling/ci-images/Dockerfile`, the single source of truth. `node tooling/scripts/ci-image.ts <stage>` prints an image name with its pinned digest.

- **gitleaks:** the pre-commit hook scans staged changes for secrets. A local gitleaks binary is used when its version equals the version in the Dockerfile. Otherwise the hook runs the pinned image, which needs a running Docker (or Podman) daemon. Without a scanner the commit is rejected; the secret scan is never skipped.
- **Semgrep:** tests and runs the project rules. To run the same commands as CI locally:

```bash
image="$(node tooling/scripts/ci-image.ts semgrep)"
docker run --rm -v "$PWD:/src" -w /src "$image" semgrep --test --metrics=off tooling/semgrep
```

## Environment variables

Copy `.env.example` to `.env` and adjust it. Never commit `.env`. The application validates its variables with zod; each module owns the variables it needs.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Pooled connection used by the running app. |
| `DATABASE_URL_UNPOOLED` | yes | Direct connection used by migrations and the CLI. |
| `BETTER_AUTH_SECRET` | yes | Signs and encrypts authentication data; at least 32 characters. |
| `BETTER_AUTH_URL` | yes | The site's own address (scheme and host); the only origin the auth routes trust. |
| `SITE_INDEXING` | no | `off` (default) sends `noindex`; `on` lets crawlers index the site. The default stays `off`, so local runs and fresh installs stay closed. Production sets it to `on`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | no, all or none | Email through SMTP. With all five set, the password reset link is sent by email. With none set, email is off and recovery is `pnpm admin:reset-password`. A partly set group is an error. Port 465 uses TLS from the start. `SMTP_FROM` is an address or `Name <address>`. |
| `SITE_URL` | no | Public address (scheme and host) for canonical links, the sitemap and structured data. On Vercel the production host is used when it is empty; a local run uses `http://localhost:3000`. |
| `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD` | no, both or neither | A read-only demo account, created by `pnpm db:seed:demo` and shown on the sign-in page while `DEMO_MODE` is `true`. The password has at least 12 characters and is public by design. |
| `BLOB_READ_WRITE_TOKEN` | no | Vercel Blob token. Without it, uploads are off. Use a separate development store, never the production one. |
| `DEMO_MODE` | no | `true` or `false` (default `false`); any other value is an error. `true` makes the site a read-only demo: writes are refused and contact messages are not stored. |
| `ADMIN_EMAIL` | for the seed | Email address of the first admin. Only `pnpm db:seed` reads it; the running site does not. |
| `ADMIN_PASSWORD` | for the seed | Password of the first admin, at least 12 characters. It is stored only as a hash and is never printed. |

The defaults in `.env.example` match the local database from `pnpm db:up`. Generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

## Database

The local database is PostgreSQL 18. `pnpm db:up` starts the container and `pnpm db:down` stops it. The container is named `tanyeri-postgres`, listens only on `127.0.0.1:5432` and has no password. `db:down` does not delete the data volume. You never type the image version: the script reads it from `tooling/ci-images/Dockerfile`, and CI uses the same Postgres.

`pnpm db:migrate` runs `prisma migrate dev`. The Prisma CLI loads `.env` itself; real environment variables take precedence over `.env`. Run Prisma commands from the repository root.

After the first migration, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` and run `pnpm db:seed`. It creates the first admin. Running it again is safe: if the email already exists, nothing changes. It needs `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and the `BETTER_AUTH_*` variables as well.

`pnpm db:seed:demo` fills the site with fictional demo content. It refuses if content exists, unless run with `--replace` or `DEMO_MODE=true`.

If an admin forgets the password and email is not configured, set a new one on the server with `printf '%s\n' '<new password>' | pnpm admin:reset-password --email <address>`. The password is read from standard input only. The command ends all sessions of that user and exits with code 1 for an unknown email or a password shorter than 12 characters.

The command works the same in Git Bash and PowerShell. When the schema changes, `migrate dev` creates a new migration; add the generated files to the same pull request.

Integration tests are named `*.int.test.ts` and connect to a real PostgreSQL. Each checkout has its own local database, `tanyeri_test_<8 hex characters>`, where the 8 characters are a hash of the repository root. A run recreates that database, applies all migrations from scratch, and drops it at the end. Two checkouts, for example git worktrees, can run integration tests at the same time; the test files within one run still run one after another. `pnpm db:up` must be running before these tests.

The Prisma client is generated into `src/generated/prisma` during installation (`postinstall`). The folder is not committed and is excluded from coverage and Semgrep scans.

## Daily commands

All of these are scripts in `package.json`, run with `pnpm <name>`:

- `pnpm dev`: starts the development server (`next dev`).
- `pnpm build`: creates the production build (`next build`).
- `pnpm start`: runs the built app (`next start`); run `build` first.
- `pnpm test`: runs Vitest with coverage (`vitest run --coverage`).
- `pnpm db:seed`: creates the first admin from `ADMIN_EMAIL` and `ADMIN_PASSWORD`; safe to repeat.
- `pnpm admin:reset-password --email <address>`: sets a new admin password read from standard input.
- `pnpm lint`: runs ESLint on `src`, `tooling`, `prisma` and the root `.ts` files with zero tolerance for warnings.
- `pnpm typecheck`: runs `next typegen` and the TypeScript check for the app and for the tooling configuration.
- `pnpm format`: formats files with Prettier (writes).
- `pnpm format:check`: checks formatting without writing. CI runs this.
- `pnpm knip`: scans for dead code and unused dependencies.
- `pnpm site-audit --leg <pages|mobile|desktop>`: audits the built site in a real Chrome; run `pnpm build` first. If Chrome is not found, set `CHROME_PATH` to the Chrome executable (`tooling/site-audit/chrome.ts` reads it first, then known install locations).
- `pnpm release:prepare`: prepares a release (see the [Git workflow guide](git-workflow.md)).

Tooling scripts (`node tooling/scripts/<name>.ts`) are run directly. For example, `node tooling/scripts/check-docs-language.ts` and `node tooling/scripts/check-doc-links.ts` check the documentation.

## Gitleaks notes

- The secret scan configuration is `.gitleaks.toml` in the repository root; gitleaks reads it from the root of the scanned repository. The default rules are on. Three custom rules are added: passwords in JSON/YAML-like fields, credentials in connection URLs and Turkish mobile phone numbers. They were added after the default rules missed a real database password.
- The phone rule also matches fictional demo phone numbers. If content contains a fictional number, add `gitleaks:allow` to the line with a short note on the same line saying that the number is fictional. A real number is never written.
- If a test needs a secret-like value, use the same marker (`// gitleaks:allow`). The tests in the repository do this.
