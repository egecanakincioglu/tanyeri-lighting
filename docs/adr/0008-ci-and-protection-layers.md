# ADR 0008: CI and protection layers — GitHub-hosted runners, required checks, branch protection, CodeQL, Semgrep, gitleaks, Dependabot

Status: Accepted; partly changed by [ADR 0009](0009-quality-targets.md) (the "no Lighthouse gates" statement and the list of required checks)
Update 2026-10-28: details that became clear during setup the same day (the list of required checks, CodeQL being required, gitleaks running from a digest-pinned image, the Dependabot ecosystems) were recorded before implementation; the decision did not change.
Date: 2026-10-28

## Context

The old repository was public, and its history contained a database password and customer data. The new repository started with a clean first commit; the old history was not carried over. A preliminary scan showed that the default gitleaks rules did not catch the real password. The dependencies of the old code had 51 known vulnerabilities.

Decisions:

- CI runs on GitHub-hosted runners. There is no self-hosted CI machine, no Lighthouse gates and no heavy job locks.
- PRs are queued with `--auto`. GitHub merges them when the required checks are green.

Rules and layers:

- 5 required checks: `policy`, `pr-text`, `quality`, `test`, `build`.
- Branch protection: PR required, strict, signed commits, force push and deletion disabled, administrators included.
- Merge commits only; the branch is deleted automatically.
- Only actions from GitHub and verified publishers; every action is pinned to a full commit SHA.
- Secret scanning + push protection.
- CodeQL.
- Semgrep.
- `.gitleaks.toml` with custom rules.
- Dependabot: npm and GitHub Actions; weekly, minor/patch grouped.

Verified facts:

- Runners: standard GitHub runners are free and unlimited in public repositories (`ubuntu-latest`: 4 CPU, 16 GB RAM). Larger runners always cost money. Ubuntu runners can run a Postgres service container.
- CodeQL:
  - Code scanning and secret scanning (including push protection) do not need a paid product in a public repository.
  - The CodeQL license allows CI use on code that is hosted on GitHub.com and published under an OSI-approved license.
  - CodeQL scans JavaScript/TypeScript (including React) and GitHub Actions workflows.
  - The default setup and a workflow in the repository (advanced setup) do not work together.
  - The latest `github/codeql-action` release is v4.39.1.
- Semgrep:
  - The Semgrep CE engine is LGPL-2.1, the latest release is v1.182.0, and it runs without an account.
  - The ready-made registry rules come with the "Semgrep Rules License v1.0": use is limited to "your own internal business purposes" and distribution is forbidden. The CI of a public project is not covered explicitly.
  - CE coverage is thin: with a client that has no account, `p/react` has 4 rules and `p/nextjs` is empty (0 rules).
- gitleaks:
  - gitleaks v8.30.1, MIT.
  - gitleaks-action has not been MIT since v2 (Gitleaks LLC end-user agreement) and is not a verified publisher on the Marketplace. pnpm/action-setup is not a verified publisher either.
- Package manager: Corepack ships with Node 24 (experimental) and is no longer distributed from Node 25. The pnpm `latest` release is 12.15.0.
- Dependabot: security updates exist for all repositories; alerts are on by default in public repositories; updates can be grouped per ecosystem.

## Options

| Area | Option | Pros | Cons |
|---|---|---|---|
| Runner | Standard GitHub-hosted runner | Free and unlimited in a public repository; no maintenance; service containers available | Fixed resources; queues are possible |
| Runner | Self-hosted CI machine | Fast, persistent cache | Maintenance and security load; risk of running code from fork PRs in a public repository; conflicts with the decision to use hosted runners |
| SAST | CodeQL (`security-extended`) as the main scanner + Semgrep only with project-specific rules | Clean license (CodeQL allows open-source code; custom rules are MIT and owned by the project); CodeQL data-flow analysis; project rules always run | Ready-made registry patterns are not used |
| SAST | CodeQL + Semgrep registry sets + custom rules | More ready-made patterns | The rule license is unclear for public CI; thin CE coverage (`p/nextjs` empty, `p/react` 4 rules); extra step to sort out new findings |
| SAST | CodeQL default setup only | No maintenance | No trace in the repository; outside the SHA pinning rule; no project-specific rules |
| Secret scanning | gitleaks binary (MIT), with a checksum | Clean license; pinned version; same command locally and in CI | The download and verification step is written by the project |
| Secret scanning | gitleaks-action | Ready-made | Not MIT; not a verified publisher; breaks the action restriction |
| pnpm setup | Corepack (`packageManager` field, with hash) | No third-party action; version and integrity live in `package.json` | Experimental in Node 24; must be installed separately from Node 25 |
| pnpm setup | pnpm/action-setup | Ready-made | Not a verified publisher; breaks the action restriction |

## Decision

The project uses **GitHub-hosted runners; required checks; branch protection; CodeQL; Semgrep; gitleaks; Dependabot.** The form of SAST, gitleaks and the pnpm setup were decided on 2026-10-28. Semgrep does not use the ready-made rule sets. This replaces the earlier wording about "ready-made security rule sets".

Rules:

1. Workflows: `.github/workflows/ci.yml` (`policy`, `tooling (linux)`, `tooling (windows)`; in phase 3 `quality`, `test`, `build`), `.github/workflows/pr-text.yml` (`pr-text`) and `.github/workflows/codeql.yml` (`analyze (javascript-typescript)` and `analyze (actions)`). Job names match the required check names exactly. All jobs except `tooling (windows)` run on the standard `ubuntu-latest` runner; larger runners are not used.
2. What the jobs do:
   - `policy`: branch name; every commit in the PR (title, body, forbidden term, signature); the untested-code gate and the rule that the coverage threshold is not lowered ([ADR 0007](0007-testing-strategy.md)); secret scan over the whole history; forbidden paths.
   - `pr-text`: PR title and forbidden terms.
   - `quality`: Prettier, ESLint CLI (flat config; no `next lint`), `tsc --noEmit` (application and `tooling/` together), dead code and unused dependency scan, `pnpm audit` (high/critical fail, with a time-limited exception list), Semgrep, license policy (permissive licenses only, such as MIT, MIT-0, ISC, BSD and Apache-2.0).
   - `test`: Vitest, with the Postgres service container and the coverage threshold.
   - `build`: `next build`.
3. Branch protection (`main`): PR required (0 approvals); required checks `policy`, `pr-text`, `tooling (linux)`, `tooling (windows)`, `analyze (javascript-typescript)` and `CodeQL`, and after phase 3 `quality`, `test`, `build` and `analyze (actions)`; strict (the branch must be up to date); signed commits required; force push and branch deletion disabled; administrators included. Repository settings: merge commits only, automatic branch deletion, auto-merge enabled, suggestion to update the branch enabled.
4. Actions: only actions from GitHub (`actions/*`, `github/*`) and verified publishers; each one pinned to a full commit SHA with a version comment next to it. Tools from unverified publishers do not run as actions. They run as a binary or package with a pinned version and integrity.
5. CodeQL is the main SAST scanner: a workflow in the repository (advanced setup).
   - Query suite `security-extended`; languages `javascript-typescript` and `actions`.
   - It runs on pushes to `main`, on PRs to `main` and weekly. Findings show in the security tab.
   - The `analyze (javascript-typescript)` job of CodeQL and the `CodeQL` result check are required checks.
   - The CodeQL license requires an OSI-approved license, so the `LICENSE` file (MIT) is in the repository together with, or before, the CodeQL workflow.
6. Semgrep runs only with project-specific rules; no rule set is pulled from the registry. The rules live in the repository (MIT) and run on all code in every PR; a finding fails the `quality` job.
   - Use of `$queryRawUnsafe` / `$executeRawUnsafe`.
   - `dangerouslySetInnerHTML`.
   - `eval` and `new Function`.
   - `process.env` access outside the environment module (`src/server/env`).
   - Hard-coded secrets in source code (a string assigned to a key, token or password variable).

   Each rule has its own positive and negative example test (`semgrep --test`). The engine is CE with a pinned version (the digest-pinned version in the CI image list), the official container image is pinned by digest, and no Semgrep account or token is used.

   Why no ready-made sets: (1) the rule license limits use to "your own internal business purposes" and does not cover the CI of a public project explicitly; (2) CE coverage is thin for this stack (`p/nextjs` empty, `p/react` 4 rules). The `security-extended` suite of CodeQL covers general security patterns.
7. gitleaks: v8.30.1, official container image pinned by digest (`tooling/ci-images/Dockerfile`; Dependabot updates it). Locally, a `gitleaks` installed in PATH is used if there is one. It runs with the default rules and the custom rules in `.gitleaks.toml`: password fields in JSON/YAML, credentials in connection URLs, Turkish phone numbers. It runs on staged changes (local hook) and on the whole history (CI `policy`). Known false positives stay in the exception list by fingerprint. The local hook uses the `gitleaks` in PATH only if it has the pinned version; otherwise it runs the pinned image with Docker or Podman; if neither exists, it rejects the commit (the scan is never skipped). The doctor script does the same check.
8. pnpm is installed with Corepack. The `packageManager` field in `package.json` holds the full pnpm version and the integrity hash; CI uses this version after `corepack enable`. `policy` checks that the field has a hash and a full version.
9. Dependabot: `npm`, `github-actions` and `docker` (the CI image list) ecosystems; weekly; minor and patch updates grouped per ecosystem; new releases wait 7 days, security updates do not wait; major versions of `prisma` and `@prisma/*` and of the Postgres image are ignored (a major upgrade is a deliberate PR); security updates and alerts are on. Dependabot PRs pass the same required checks.
10. Repository security settings: secret scanning and push protection on; private vulnerability reporting on. Actions: SHA pinning required, the workflow token is read-only, Actions cannot approve PRs.

## Consequences

- Positive: runners, code scanning, secret scanning and Dependabot are free for this repository. No extra service or account is needed.
- Positive: all protection tools (gitleaks, Semgrep CE, the CodeQL workflow) have pinned versions and are visible in the repository. The same commands run locally.
- Positive: no license uncertainty remains in SAST. The Semgrep rules belong to the project, and the CodeQL license is explicit about open-source use.
- Negative: because of the action restriction, the gitleaks and pnpm setup steps are written by the project. Their verification (checksum, version and hash match) happens in tested scripts.
- Negative: the ready-made Semgrep patterns in the registry are not used. Next.js-specific security patterns are searched only with the project's own rules and CodeQL.
- Risk: Corepack is experimental in Node 24 and does not ship with Node from Node 25. When the project moves to Node 26, Corepack is installed separately as an npm package with a pinned version.
- Risk: strict branch protection requires the branch to be up to date before every merge. With several PRs in the queue at once, auto-merge may need re-runs in sequence; this is acceptable for a one-person project.
- Follow-up: the protections were turned on on 2026-10-28, and the next PR passed the required checks and merged with auto-merge. `quality`, `test` and `build` are set up in phase 3 and added to the required checks.

## Sources

- https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers
- https://docs.github.com/en/get-started/learning-about-github/about-github-advanced-security
- https://docs.github.com/en/code-security/concepts/code-scanning/setup-types
- https://github.com/github/codeql-cli-binaries/blob/main/LICENSE.md
- https://codeql.github.com/docs/codeql-overview/supported-languages-and-frameworks/
- https://github.com/github/codeql-action/releases
- https://docs.semgrep.dev/licensing
- https://semgrep.dev/legal/rules-license
- https://docs.semgrep.dev/cli-reference
- https://github.com/semgrep/semgrep/releases
- https://github.com/gitleaks/gitleaks/releases
- https://github.com/gitleaks/gitleaks-action/blob/master/LICENSE.txt
- https://github.com/marketplace/actions/gitleaks
- https://github.com/marketplace/actions/setup-pnpm
- https://nodejs.org/docs/latest-v24.x/api/corepack.html
- https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-security-updates
