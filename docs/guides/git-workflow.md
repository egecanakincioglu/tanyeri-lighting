# Git workflow

This guide describes how a change travels from a branch to `main`, and which protection enforces each step. The protection layers are explained further in [ADR 0008](../adr/0008-ci-and-protection-layers.md). Commands for running the checks locally are in the [development setup guide](development-setup.md).

## Flow

1. Each piece of work gets its own branch: `git switch -c <type>/<kebab-case>` (for example `feat/product-list`). Direct commits to `main` are blocked; the pre-commit hook and CI check the branch name.
2. Split the change into atomic commits: one logical change per commit.
3. Run the checks locally: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`.
4. Push the branch: `git push -u origin <branch>`.
5. Open a pull request and fill in `.github/pull_request_template.md`.
6. Queue the merge: `gh pr merge <N> --auto --merge --delete-branch`.
7. GitHub merges and deletes the branch when all required checks are green.
8. Update the local `main`: `git switch main && git pull --ff-only`.

Pull requests are merged with a merge commit only; squash and rebase merges are disabled. To update a branch with `main`, use `git merge origin/main`, not a rebase: pushed history is never rewritten.

## Commit messages

- Header: `<type>(<scope>)?: <lowercase summary>`, at most 72 characters, no trailing period, ASCII only.
- Types: `feat` `fix` `docs` `chore` `refactor` `test` `ci` `perf` `build` `style` `revert`.
- After the header, one blank line and at least one line of English body. Merge commits are exempt.
- No trailers. Lines such as `Signed-off-by` and any other `...-by:` line are rejected.
- Commits are signed. A commit without a verified signature cannot be merged.

Example:

```text
feat(core): add file access policy

Restrict uploads to an allowlist of extensions and sizes.
```

## Tests for source changes

- A pull request that adds or changes TypeScript under `src/` also adds or changes tests. Exempt are pull requests that only delete code and pull requests that only change styles, content or documentation.
- Line coverage of `src/server` and `src/lib` cannot drop below 80%. The thresholds are in `tooling/coverage-thresholds.json` and only go up; CI rejects a lower value.

## User interface changes

- A pull request that touches the user interface is checked in a browser at phone (390), tablet portrait (768), tablet landscape (1024) and desktop (1440) widths. If it touches the fixed header, the menu or a dialog, it is also checked at phone landscape (844x390).
- The "Visual check" section of the pull request template is filled in.
- Overflow, touch target size, accessibility, image sizes and console errors are checked automatically by the `site-audit` jobs ([ADR 0009](../adr/0009-quality-targets.md)).

## Documentation

- Everything under `docs/` is written in English. File and folder names are ASCII kebab-case (`README.md` is the only uppercase name).
- The docs check in the `policy` job requires English text and these names. `node tooling/scripts/check-docs-language.ts` runs it locally.
- `node tooling/scripts/check-doc-links.ts` fails on a relative Markdown link that points to a missing file.
- A change and the documentation that describes it go in the same pull request.

## Not allowed

- Skipping hooks with `--no-verify`.
- Changing `core.hooksPath` outside the setup script.
- Merging with `--admin`, or changing repository settings from the workflow.
- Committing, merging or pushing directly to `main`.
- Force pushes and rewriting pushed history.
- Forbidden terms and forbidden paths: `.env*` (except `.env.example`), keys and certificates, database dumps and local design files.

## Protection layers

Local hooks (`core.hooksPath=tooling/git-hooks`, installed by `setup-git-hooks.sh`):

| Hook | What it checks |
|---|---|
| `pre-commit` | The `main` branch, the branch name, forbidden terms and paths in staged files, and a secret scan of the staged changes (gitleaks; the commit is rejected when no scanner is available) |
| `commit-msg` | Conventional Commits header, required body, ASCII only, forbidden terms, no trailer lines |
| `pre-push` | A push to `main` |

CI jobs (`.github/workflows/`):

| Job | What it checks |
|---|---|
| `policy` | Branch name; the message of every commit in the pull request; signed commits; source changes come with tests; coverage and site-audit thresholds only go up; a version bump comes with a changelog entry; documentation links and language; every admin page, route handler and Server Action calls the session guard; forbidden terms and paths; secret scan of the full history; the `packageManager` pin |
| `pr-text` | Pull request title (Conventional Commits) and forbidden terms in title and body |
| `quality` | Type check, Prettier, ESLint, Semgrep rule tests and scan, `pnpm audit`, production licenses, dead code and unused dependencies |
| `semgrep-registry` | The community rule sets of the Semgrep registry (`p/typescript`, `p/react`, `p/nodejs`, `p/owasp-top-ten`, `p/security-audit`). The rules are fetched at run time and are not pinned, so a new upstream rule can fail this job without a change in the repository |
| `zizmor` | Security audit of the workflow files at medium severity or higher, including the online audits |
| `test` | Vitest unit and integration tests with the coverage gate |
| `build` | `pnpm build` |
| `site-audit (pages)`, `site-audit (mobile)`, `site-audit (desktop)` | The page audit: overflow, axe, console and CSP errors, and Lighthouse on mobile and desktop |
| `tooling (linux)` and `tooling (windows)` | Tests of the repository tools and syntax of the shell scripts, on both operating systems |

Branch protection on `main` requires a pull request and these 12 checks: `policy`, `pr-text`, `tooling (linux)`, `tooling (windows)`, `quality`, `semgrep-registry`, `zizmor`, `test`, `build`, `site-audit (pages)`, `site-audit (mobile)` and `site-audit (desktop)`. The checks are strict, commits must be signed, force pushes and branch deletion are off, and administrators are included. Merges are merge commits only, and the branch is deleted after the merge.

## Infrastructure failures

- For a failure of the infrastructure (a lost runner, a network timeout or a GitHub outage), run `gh run rerun <id> --failed` at most once per pull request.
- A real test, lint or build failure is not rerun; fix the code instead.

## Releases

The project decides when to release; merging into `main` does not deploy by itself. The details are in [ADR 0011](../adr/0011-versioning-and-releases.md). The steps are:

1. Open the release branch as `chore/release-vX-Y-Z`. Dashes replace the dots because dots do not fit the branch name rule.
2. Run `pnpm release:prepare`. It suggests the next version; `--version X.Y.Z` sets another one and `--dry-run` only prints the result. The command writes `package.json` and `CHANGELOG.md` and creates a draft of the release notes as `releases/vX.Y.Z.md`; an existing note is never touched. Fill in the note in English: the first line is `# vX.Y.Z — <theme>`, followed by a summary (commit count since the previous release, migrations), topic sections and a `## Technical notes` section. Fill in every `<!-- fill in` comment of the draft; the `policy` check and the `release` workflow reject a note that still has one. Commit with the header `chore(release): vX.Y.Z` and open the pull request. Do not enable auto-merge for this pull request yet.
3. Rehearse: `gh workflow run release-rehearsal.yml -f ref=chore/release-vX-Y-Z`. Check the preview address and the Vercel build log (Prisma client, `prisma migrate deploy`, `next build`). Before the first production launch that is not a demo, delete the demo user: the `user` row with `isDemo = true`.
4. Merge the pull request with `--auto`. Then create a signed tag on the merge commit on `main` and push it: `git tag -s vX.Y.Z -m "vX.Y.Z"` and `git push origin vX.Y.Z`. Push exactly one full `vX.Y.Z` tag to `origin`. Do not delete or force tags, do not push tags in bulk, and do not create the GitHub release by hand: the workflow creates it.
5. The `release` workflow checks that the tag is on `main` and equals the `package.json` version. It then deploys the tagged commit to production through the Vercel REST API (the Vercel CLI is not used) and creates the GitHub release. The release title comes from the first line of the note. The body is the note, followed by a collapsed "Commit list" taken from `CHANGELOG.md`.
6. Check the live site. If something is wrong, roll back to the previous production deployment in Vercel. The fix ships as a new PATCH release.
7. The live site stays `noindex` until 1.0.0. With 1.0.0, set `SITE_INDEXING=on` in production.

## Parallel pull requests

- If a branch falls behind (the checks are strict), update it with `git merge origin/main`.
- If a conflict appears in a code or content file, abort the merge and resolve the conflict deliberately; it is not resolved automatically.
