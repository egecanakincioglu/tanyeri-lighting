# ADR 0007: Testing strategy — Vitest + Testing Library, real Postgres, 80% coverage, untested-code gate

Status: Accepted; partly changed by [ADR 0009](0009-quality-targets.md) (page audits run in a real browser, one functional scenario)
Date: 2026-10-28

## Context

The old code had no tests. One goal of the rewrite is that untested code never reaches `main`. The decisions:

- Vitest + Testing Library.
- Integration tests run against a real Postgres: Docker Compose locally, a service container in CI. The database is not mocked. Only outside HTTP calls (for example Google) are mocked.
- There is no browser test tool. UI changes are checked visually in a browser at desktop (1440) and mobile (390) widths, and the "visual check" section of the PR description is filled in.
- Coverage threshold: 80% of lines in the server layer (`src/server`, `src/lib`). The threshold only goes up. Components are not part of the threshold, but their tests are still written.
- Untested-code gate: every PR that adds or changes TypeScript under `src/` adds or changes a test in the same PR. PRs that only delete code, and changes that only touch style, content or documentation, are exempt. The gate looks at the commit type: every commit except `style` (formatting only) is in scope. A commit of type `chore`, `ci` or `build` that changes TypeScript under `src/` still needs a test.

Verified facts:

- The latest Vitest version is 5.0.5. It needs Node >= 22.12 and Vite >= 6.4. In Vitest 5, `clearMocks` defaults to `true`, and async assertions that are not awaited fail the test.
- `@testing-library/react` 16.3.3 supports React 19 and needs `@testing-library/dom` 10 as a peer dependency.
- Next.js documentation: Vitest does not support async Server Components. Synchronous server components and client components can be unit tested. End-to-end tests are recommended for async components.
- Coverage thresholds can be set per glob. Globs do not inherit the global thresholds, so `perFile` must be set on each glob.
- The default of `coverage.include` is only the files imported during tests. A file that no test imports never enters the coverage report, so it does not lower the threshold.
- GitHub's Ubuntu runners can run a Postgres service container.

## Options

| Option | Pros | Cons |
|---|---|---|
| Vitest + Testing Library, real Postgres; no browser test tool, visual check | Fast; ESM and TypeScript work without configuration; official Next.js guide exists; a real database catches query and migration errors | Async Server Components and full user flows are not tested automatically |
| Jest + Testing Library | Widely used | Extra configuration for ESM and TypeScript; not part of the decision |
| The option above plus browser-based end-to-end tests | Tests async pages and flows in a real browser | CI time and maintenance cost; deliberately left out |
| Mock the database | Fast | Misses query, constraint and migration errors; conflicts with the architecture decision to use a real database |

## Decision

The project uses **Vitest + Testing Library; a real Postgres; 80% line coverage in the server layer (only goes up); the untested-code gate; no browser test tool; UI changes verified by a visual check.**

Rules:

1. Two Vitest projects: `unit` (the `jsdom` environment and Testing Library, for components) and `integration` (the `node` environment, a real Postgres). Integration tests apply migrations to a clean schema on every run and clean the data between tests.
2. Async Server Component rule: pages and async server components stay thin. Data reads, authorization checks, validation and writes live in functions under `src/server` (pure helpers in `src/lib`) and are tested there with integration or unit tests. A page only calls these functions and passes the result to synchronous components. Synchronous components are tested with Testing Library.
3. Coverage:
   - Provider: v8.
   - `coverage.include` is written explicitly as `src/server/` and `src/lib/`, so a file without a test counts as 0%.
   - Thresholds are set per glob, for example `thresholds: { 'src/server/': { lines: 80 }, 'src/lib/': { lines: 80 } }`.
   - A change that lowers a threshold is rejected by the CI `policy` job ("only goes up"). `autoUpdate` is not used. A threshold is raised by hand in a separate commit.
4. No transition period: the coverage threshold applies to `src/server/` and `src/lib/` from day one.
5. Untested-code gate: the CI `policy` job looks at the commits in the PR and the changed paths. Every commit that adds or changes TypeScript under `src/`, whatever its type, requires the PR to add or change at least one test file. Commits of type `style` (formatting only) and changes that only delete code are exempt. Test files, `*.d.ts` files and files under `__tests__/` are outside the gate. Merge commits do not count. The rule itself is tested with `node --test`.
6. Mocking boundary: the database and Prisma are not mocked. Only outside HTTP services (SMTP) are mocked.
7. Visual check: every PR that touches the UI gets a browser check at desktop (1440) and mobile (390) widths, and the visual check section of the PR template is filled in.
8. `pnpm test` locally and the `test` job in CI run the same commands: the same Postgres major version and the same migrations.

## Consequences

- Positive: the server layer (authorization, demo protection, rate limiting, upload validation, encryption) is tested against a real database. The code with the highest risk passes the strictest gate.
- Positive: `coverage.include` is explicit, so a new server file without tests lowers the coverage and breaks CI.
- Accepted gap: Next.js recommends end-to-end tests for async Server Components. Because the project uses no browser test tool, page-level rendering, redirects and the full sign-in flow are not tested automatically. The project accepts this gap on purpose and narrows it with this design rule:
  - Async Server Components stay thin. All logic lives in testable server modules (`src/server`, `src/lib`) and is tested there (rule 2).
  - The visual check covers rendering (rule 7).

  Remaining risk: a page calls the wrong function or forgets an authorization call. Code review and the visual check look for this risk.
- Negative: integration tests need Postgres, so Docker is required locally. The development setup guide explains this.
- Follow-up: the Vitest 5 default changes (`clearMocks`, awaited assertions) cause no extra work because the tests are written with these defaults from the start.

## Sources

- https://nextjs.org/docs/app/guides/testing/vitest
- https://vitest.dev/blog/vitest-5
- https://vitest.dev/config/coverage
- https://registry.npmjs.org/-/package/vitest/dist-tags
- https://registry.npmjs.org/@testing-library/react/16.3.3
- https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers
