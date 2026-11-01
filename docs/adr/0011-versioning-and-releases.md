# ADR 0011: Versioning and releases — SemVer, deploy to production by tag, release rehearsal

Status: Accepted
Date: 2026-10-28

## Context

An earlier decision had Vercel build a preview for every PR, and `main` was not to deploy to production until phase 9; in phase 9, every merge to `main` would go live. Two problems appeared:

- Not every merge to `main` should go live. The project should decide what is published and when, and what is published should have a version number.
- Every push to every PR means a Vercel build. For documentation, CI and tooling PRs these builds are wasted, and the Hobby build quota is shared with another project on the same Vercel account.

If previews are removed completely, migrations and Vercel-specific problems (environment variables, region, serverless limits, `sharp`, headers) are seen for the first time in production. A migration that corrupts data cannot be undone.

## Options

| Option | Pros | Cons | Result |
|---|---|---|---|
| `main` → production, PR previews | No setup | Every merge goes live; no versions; most builds | Rejected |
| Release tag → GitHub Actions → Vercel REST API | Only releases go live; fewest builds; not tied to Vercel's Git integration | Needs a Vercel token as a repository secret | Chosen |
| A separate `release` branch is the Vercel production branch | No token needed | A second protected branch to manage; version and branch move separately | Rejected |
| PR previews only for UI PRs | See the UI in a real environment | Still a build per PR | Rejected |
| No previews at all | Fewest builds | Migration and platform problems are seen for the first time in production | Rejected |
| Release rehearsal only | One rehearsal build per release; migration and platform are tested before production | The UI cannot be seen in a real environment during the PR (it is checked locally and in `site-audit`) | Chosen |

## Decision

**The project uses Semantic Versioning 2.0.0. Only a release tag deploys to production; before each release, one rehearsal runs in the preview environment.**

Rules:

1. The version number is `MAJOR.MINOR.PATCH`. The version is the `version` field in `package.json`; the tag is `vX.Y.Z`.
   - `fix` → PATCH (bug fix, urgent fix).
   - `feat` → MINOR (new feature, even a small one).
   - A backward-incompatible change (`BREAKING CHANGE`) → MAJOR. Before 1.0.0, MINOR is increased.
   - `docs`, `chore`, `ci`, `test`, `build`, `refactor`, `style`, `perf` alone do not require a release; they appear in the change list of that release.
2. The 0.x period. 1.0.0 is phase 9 (launch). Every meaningful stage before it is a 0.x release. The first release is v0.1.0: the end of phase 3.
3. Release flow.
   1. The project decides when to release; work merged to `main` is not published by itself.
   2. Release PR (`chore(release): vX.Y.Z`): the `package.json` version and the new section of `CHANGELOG.md`. The section is compiled by type from the commits merged since the last tag; a tooling script suggests the next number and a draft.
   3. Release rehearsal: the branch of the release PR is deployed to Vercel's preview environment by a manually triggered workflow. The preview build applies the migrations to the preview database. The pages and the migration are checked.
   4. The release PR is merged; a signed tag (`git tag -s vX.Y.Z`) is created on the merge commit and pushed.
   5. Tag workflow: it checks that the tag points to a commit on `main` and matches the `package.json` version; deploys to production with the Vercel REST API; opens a GitHub Release with the section from `CHANGELOG.md`.
4. Vercel's Git integration does not deploy. `git.deploymentEnabled: false` in `vercel.json`; all deployments are made from GitHub Actions with the Vercel REST API. The build runs on Vercel with the environment's own variables.
5. Migrations. The build script (`tooling/scripts/vercel-build.ts`) runs `prisma migrate deploy` in preview and production, then `next build`. Production builds now come only from a release tag, so the production migration is applied with the release, and it has been rehearsed on the preview database. The shared preview database from ADR 0002, rule 7, is used only for the release rehearsal.
6. Indexing. The live site is closed to search engines (`noindex`) until 1.0.0. It is turned on and off with a single environment variable and is turned on in the 1.0.0 release. The rule "production is indexed" in ADR 0009 applies from 1.0.0.
7. Rollback. If a problem appears in production, the project goes back to the previous production deployment in Vercel; the fix comes in a new PATCH release. Migrations only go forward; a migration that deletes data ships in its own release and is verified in the rehearsal.
8. Checks.
   - `policy`: a PR that changes `version` also changes `CHANGELOG.md`, and the version only increases.
   - Tag workflow: tag–version equality and presence on `main`.
   - Release workflows pass the CodeQL `actions` scan and actionlint; actions are pinned by SHA.
9. Manual steps. Create a team-scoped token in Vercel and add it as the `VERCEL_TOKEN` repository secret; add the team and project IDs as repository variables (`VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`). Renewing the token when it expires belongs to the secret rotation runbook (planned).

## Consequences

- Positive: what is live is always known by a version number; the change list and the GitHub Release are automatic.
- Positive: two Vercel builds per release (rehearsal and production); PRs do not use Vercel quota.
- Positive: migrations and platform-specific problems show up in the preview environment before production.
- Negative: UI PRs cannot be seen in a real Vercel environment before merge; they are checked locally and in `site-audit`, and the real environment is seen in the rehearsal.
- Negative: the Vercel token is a new secret; it lives as a repository secret and is renewed when it expires.
- Changed places: the status lines of ADR 0002 (rule 7, use of the preview database) and ADR 0009 (indexing from 1.0.0); the roadmap deployment item and the phase 9 items; `vercel.json`.

## Sources

- [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
- [ADR 0002: Data and storage](0002-data-and-storage.md)
- [ADR 0009: Quality targets](0009-quality-targets.md)
