# ADR 0002: Data and storage - Postgres (Neon), Prisma, Vercel Blob

Status: Accepted; partly amended by [ADR 0011](0011-versioning-and-releases.md)
Date: 2026-10-28

## Context

In the old code, data lived in three places. The first was MySQL, where tables were created from a raw SQL script with `$queryRawUnsafe`. The second was a set of JSON file databases: `metadata`, `products`, `seo`, `firstLogin`, `pendingEmails` and `sql`. One of them held a plain-text password and one held integration secrets. The third was the local `server/uploads/` folder, which does not work in a serverless environment. The project uses **Postgres (Neon) with Prisma; files go to Vercel Blob.**

Facts checked before the decision:

- **The latest stable Prisma 7 version is 7.10.1.** The npm `latest` tag of the `prisma` package points to a release candidate of Prisma 8 (`8.0.0-rc.28`). Prisma 8 is being rewritten: its CLI does not read `schema.prisma` and there is no `migrate dev`. Its general release is expected in October 2026. After that date Prisma 7 will receive fixes for 18 months.
- The peer range of Better Auth covers only Prisma 5-7 ([ADR 0003](0003-authentication.md)).
- In Prisma 7 every client needs a driver adapter. The package is ESM; there is a `prisma.config.ts`; environment variables are not loaded automatically; seed and generate no longer run on their own.
- With Neon, the pooled `DATABASE_URL` is used at runtime and the unpooled `DATABASE_URL_UNPOOLED` is used for the CLI and migrations. The Neon integration managed by Vercel adds these variables itself.
- Neon Free: 100 CU-hours per month per project, 1 GB storage, 10 branches; compute suspends after 5 minutes of inactivity; 5 GB egress per month. When a limit is exceeded, compute is suspended or writes stop; data is not deleted.
- The Neon integration for Vercel can create a branch for every preview deployment. Branches are deleted when the Vercel deployment is deleted, and the default retention is 6 months; the limit of 10 branches on Free can fill up.
- Vercel Blob Hobby: 1 GB storage, 10,000 simple and 2,000 advanced operations, 10 GB transfer. When a limit is exceeded, the store is unavailable for 30 days; no charge is made.
- The request body limit in Vercel Functions is 4.5 MB.
- Postgres 18 has been generally available on Neon since 2026-05-01 and the default for new projects since June 2026.

## Options

| Area | Option | Pros | Cons |
|---|---|---|---|
| Database | Postgres (Neon, Vercel Marketplace) | Standard Postgres, no lock-in; free plan; Vercel adds the variables itself | Wake-up latency after suspend; 10 branches and 100 CU-hours on Free |
| Database | Stay on MySQL | Existing schema | Not in the Vercel Marketplace (not researched); the raw SQL script and `$queryRawUnsafe` stay |
| ORM | Prisma 7 | Existing dependency (5.22); migrations; official Better Auth adapter | ESM and driver adapter migration; the npm `latest` tag trap |
| ORM | Prisma 8 (release candidate) | Main line in the long term | Still a candidate; the API may change; Better Auth does not support it; no `migrate dev` |
| ORM | Drizzle or Kysely | Lightweight | Out of scope; not researched |
| Driver adapter | `@prisma/adapter-pg` | The same adapter works locally, in CI and on Neon (pooled TCP) | No cold-start advantage of the Neon-specific driver |
| Driver adapter | `@prisma/adapter-neon` | Neon's serverless driver | Neon-specific; needs a different path locally and in CI |
| Preview database | One shared Neon database for all PR previews | No branch limit; separate from production; simple | Migrations of different PRs meet in the same database |
| Preview database | One Neon branch per preview deployment | Full isolation | The 10-branch limit on Free can fill up; cleanup depends on Vercel's retention period |
| Files | Vercel Blob | Integrated with Vercel; free quota; CDN | Vercel-specific API; 30 days of downtime if the Hobby quota is exceeded |
| Files | S3-compatible external storage | Portable | Extra service and account; out of scope |
| Upload path | From the server (route handler / Server Action), 4 MB limit | Validation, re-encoding and metadata stripping happen in one server request | No large files because of the 4.5 MB body limit |
| Upload path | Directly from the client to Blob | Large files | The file enters the store before it is validated; later processing needs an extra step |

## Decision

The project uses **Postgres (Neon), Prisma migrations, and files in Vercel Blob.** The implementation constraints found during research were decided on 2026-10-28 and are part of the rules below.

Rules:

1. **Pin Prisma 7 exactly.** `prisma`, `@prisma/client` and `@prisma/adapter-pg` are pinned to the same exact version (7.10.1 today), with no range (`^`, `~`) on any of them.
   - Because the npm `latest` tag is an 8.x release candidate, `prisma@latest` and `npx prisma` are not used without a version in any script; the CLI runs only from the project dependency.
   - In Dependabot, major version upgrades are ignored for `prisma` and `@prisma/*`.
   - Moving to Prisma 8 needs a separate ADR. The preconditions are the general release of Prisma 8 and Better Auth support.
2. **The driver adapter is `@prisma/adapter-pg`.** It connects to Neon over a pooled TCP connection (`DATABASE_URL`). The same adapter is used with the Postgres in Docker locally and the service container in CI. Migration and CLI work uses the unpooled `DATABASE_URL_UNPOOLED` through `prisma.config.ts`.
3. The equivalents of the old JSON file databases are designed from scratch as Postgres tables; old data is not migrated. The raw SQL script and `$queryRawUnsafe` do not enter the new code. If a raw query is needed, only parameterized `$queryRaw`/`$executeRaw` is used. A project-specific Semgrep rule forbids `$queryRawUnsafe` ([ADR 0008](0008-ci-and-protection-layers.md)).
4. Schema changes are made only with migrations under `prisma/migrations/`. `db push` is not used on shared databases.
5. The first admin is created with `pnpm db:seed` and environment variables; there is no setup wizard.
6. Secret integration credentials stay in environment variables. A refresh token obtained after OAuth is stored in the database encrypted with AES-GCM.
7. **Preview database:** all PR previews use one shared Neon preview database, separate from production.
   - No Neon branch is created per preview; the preview-branch feature of the integration stays off.
   - The `DATABASE_URL` of the preview environment is defined only for the Preview environment. Preview deployments never connect to the production database and never apply migrations to it.
8. **File upload: from the server only, at most 4 MB.**
   - The upload arrives through a route handler or Server Action; the endpoint is written in phase 7 with authorization. The size limit is applied first.
   - The content type is determined from magic bytes, not from the file name or `Content-Type`. The allow list is JPEG, PNG, WebP and PDF; there is no SVG. A type that is not on the list is rejected.
   - Images are re-encoded to WebP (quality 82): the long edge is at most 2048 px and the input is at most 50 megapixels (protection against images that blow up memory when decoded). EXIF, GPS and ICC data are stripped; the orientation is applied to the pixels. These steps happen before writing to Blob.
   - PDFs are not re-encoded; they only pass the size and magic byte checks.
   - The file name is generated (`<uuid>.<extension>`); the name given by the visitor is never used.
   - The Blob access type is `public`. All files on the site are public anyway; `private` would route every file through a server function and use up the Hobby quota.
   - If `BLOB_READ_WRITE_TOKEN` is missing, storage is disabled; `isStorageEnabled()` reports this and uploads stay off.
   - There is no direct upload from the client to Blob.
   - Blob access sits behind the `src/server/storage` interface ([ADR 0001](0001-architecture-nextjs-16-app-router.md), anti-lock-in rule). Demo images are uploaded from the seed folder.
   - In tests, the real SDK is pointed at a local fake HTTP server with `VERCEL_BLOB_API_URL`; tests never send requests to the real Blob.
9. Tests run on a real Postgres: Docker Compose locally and a service container in CI. The database is not mocked ([ADR 0007](0007-testing-strategy.md)).

## Consequences

- Positive: There is one Postgres database and versioned migrations. Plain-text secret and password files disappear.
- Positive: Neon is standard Postgres. With Prisma and `adapter-pg`, moving to another Postgres only means changing the connection URL.
- Positive: All files are validated and re-encoded on the server before they are written to the store, so malicious content and metadata such as EXIF do not reach the store.
- Negative: Vercel Blob is Vercel-specific. Because of the `src/server/storage` interface, moving to another storage means writing one adapter.
- Negative: Because of the 4 MB limit, large catalog PDFs cannot be uploaded. The demo catalog is kept short and small.
- Note: Prisma 7 requires ESM, so `package.json` is set up with `"type": "module"` from the start and `tsconfig` with `moduleResolution: "bundler"` (phase 3).
- Risk: In the shared preview database, migrations of different PRs can conflict. If they do, the preview database is reset and seeded again; production is not affected.
- Risk: If the Hobby quota is exceeded, Blob stops for 30 days and Neon compute stops until the end of the period. The demo can tolerate this, but it is noted in the README. Seed images are kept small (WebP, reasonable resolution).
- Risk: Neon suspends after 5 minutes. The first request has a connection delay; `connect_timeout` is added to the connection URL. The cold-start time of `adapter-pg` is measured in phase 9.
- Postgres 18 is used in production (Neon), in CI and locally. The CI image and the Neon project stay on the same major version; a major version upgrade is a deliberate PR.
- Open items (not decided in this ADR):
  - The step at which migrations are applied in production: the Vercel build or a separate job? The preliminary proposal is `prisma migrate deploy` in the build with `DATABASE_URL_UNPOOLED`. Preview deployments start in phase 3, so this is decided in phase 3, in the PR that sets up previews. Production deployment opens in phase 9.
  - How migrations are applied to the preview database is handled in the same decision.
  - Closed (2026-11-01): the access type of the Blob store is `public`. Details are in rule 8.
- Follow-up: When Prisma 8 reaches general release, it is evaluated in a separate ADR.

## Sources

- https://registry.npmjs.org/-/package/prisma/dist-tags
- https://github.com/prisma/prisma/releases
- https://www.prisma.io/docs/orm/release-status
- https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
- https://www.prisma.io/docs/orm/prisma-client/deployment/serverless/deploy-to-vercel
- https://neon.com/docs/guides/prisma
- https://neon.com/docs/introduction/plans
- https://neon.com/docs/guides/vercel-managed-integration
- https://vercel.com/docs/vercel-blob/usage-and-pricing
- https://vercel.com/docs/vercel-blob/server-upload
- https://neon.com/docs/changelog/2026-05-01
- https://neon.com/docs/changelog/2026-06-05
