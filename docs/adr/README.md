# Architecture decisions (ADR)

This folder holds the architecture decisions of the project. Each one is numbered, dated and has a status. When a decision changes, the old ADR is not deleted or rewritten. A new ADR is opened, and the status line of the old one becomes "Superseded: ADR NNNN". For the overall picture, see [architecture.md](../architecture.md).

| No | Decision | Status | Date |
|---|---|---|---|
| [0001](0001-architecture-nextjs-16-app-router.md) | Architecture: Next.js 16 App Router; runs on Vercel but is not locked to it; nonce-based CSP on all pages | Accepted | 2026-10-28 |
| [0002](0002-data-and-storage.md) | Data and storage: Postgres (Neon), Prisma 7, Vercel Blob; shared preview database; upload through the server | Accepted; partly changed by [0011](0011-versioning-and-releases.md) | 2026-10-28 |
| [0003](0003-authentication.md) | Authentication: Better Auth (email/password, session in the database) | Accepted | 2026-10-28 |
| [0004](0004-rate-limiting.md) | Rate limiting: on Postgres, no extra service | Accepted | 2026-10-28 |
| [0005](0005-styling-tailwind-css-4.md) | Styling: Tailwind CSS 4, no SCSS | Accepted | 2026-10-28 |
| [0006](0006-internationalization-next-intl.md) | Internationalization: next-intl, always-prefixed `/tr` and `/en`, `proxy.ts` | Accepted | 2026-10-28 |
| [0007](0007-testing-strategy.md) | Testing strategy: Vitest + Testing Library, real Postgres, 80% coverage, untested-code gate | Accepted | 2026-10-28 |
| [0008](0008-ci-and-protection-layers.md) | CI and protection layers: GitHub-hosted runners, required checks, branch protection, Semgrep, zizmor, gitleaks, Dependabot | Accepted; partly changed by [0012](0012-license-polyform-noncommercial.md) | 2026-10-28 |
| [0009](0009-quality-targets.md) | Quality targets: measurable full score in SEO, AI search visibility, accessibility, performance, agent access and responsive design; `site-audit` gates | Accepted; partly changed by [0010](0010-quality-thresholds.md) and [0011](0011-versioning-and-releases.md) | 2026-10-28 |
| [0010](0010-quality-thresholds.md) | Quality thresholds: Lighthouse gate at 90, expected 95+; pass/fail audits unchanged; no text-LCP requirement on mobile | Accepted | 2026-10-28 |
| [0011](0011-versioning-and-releases.md) | Versioning and releases: SemVer, only a release tag goes live, rehearsal in preview before each release, noindex until 1.0.0 | Accepted | 2026-10-28 |
| [0012](0012-license-polyform-noncommercial.md) | License: PolyForm Noncommercial 1.0.0 instead of MIT; CodeQL replaced by Semgrep registry rules and zizmor | Accepted | 2026-11-01 |

Some ADRs have "Open items" in their Consequences section. These are implementation details that depend on the main decision but are not decided yet; the phase in which each will be decided is written next to it.

## Statuses

- Proposed: the decision is written and waits for approval.
- Accepted: the decision is made and is being applied.
- Rejected: the option was considered and is not applied.
- Superseded: ADR NNNN: a new decision replaced this one.
- Accepted; partly changed by ADR NNNN: a new ADR replaced part of the decision; the changed part is in the new ADR, and the old text is not changed.

## New ADR

1. Copy [template.md](template.md) to `NNNN-kebab-case.md` with the next number (ASCII only).
2. Fill in the sections: Context, Options (comparison table), Decision, Consequences, Sources. Add a source link for every fact.
3. Add a row to the table above. PRs that implement the ADR link to it.
