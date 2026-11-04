# Release and rollback

How a release reaches production, and how to undo a bad one. The full release steps are in the [git workflow](../guides/git-workflow.md#releases) and the decision is in [ADR 0011](../adr/0011-versioning-and-releases.md). This runbook adds the checks and the recovery steps.

## When to use it

- To ship the work merged into `main`. Merging alone publishes nothing; only a `vX.Y.Z` tag deploys to production.
- To recover when a release is live and something is wrong.

## Before a release

1. Check that the checks on `main` are green and that no pull request that belongs in the release is still open.
2. Check that the Vercel variables are set for Production and Preview, and that `VERCEL_TOKEN` (secret), `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (variables) exist in the repository. If a secret is old, rotate it first ([secret rotation](secret-rotation.md)).
3. Read the new migrations in `prisma/migrations/` that are not yet live. A migration is applied by the production build and only moves forward (see "A release with a migration" below).
4. Keep `SITE_INDEXING=on` for Production only. Do not change it as part of a release.

## Release steps

1. Branch `chore/release-vX-Y-Z` and run `pnpm release:prepare` (`--dry-run` only prints the result, `--version X.Y.Z` sets another version).
2. Fill in every `<!-- fill in` comment in `releases/vX.Y.Z.md`, commit as `chore(release): vX.Y.Z` and open the pull request. Do not enable auto-merge yet.
3. Rehearse: `gh workflow run release-rehearsal.yml -f ref=chore/release-vX-Y-Z`. The workflow deploys the branch to a Vercel preview. Open the preview address and read the Vercel build log for the Prisma client, `prisma migrate deploy` and `next build`.
4. Merge the pull request with `gh pr merge <N> --auto --merge --delete-branch`.
5. On `main`, tag the merge commit and push exactly that tag: `git tag -s vX.Y.Z -m "vX.Y.Z"` and `git push origin vX.Y.Z`.
6. The `release` workflow checks that the tag is on `main` and equals the `package.json` version, deploys the tagged commit to production through `tooling/scripts/vercel-deploy.ts`, and creates the GitHub release. Watch it with `gh run list --workflow release.yml` and `gh run view <id>`.

The deploy script exits with 1 if the deployment ends as `ERROR` or `CANCELED`, or is not ready after 15 minutes. A failed deployment does not replace the current production deployment in Vercel. A failed workflow after the deploy step (the GitHub release) leaves production live; the release can be created again by the project.

## Checks after a release

- The `release` workflow run is green and the GitHub release page shows the new version.
- The Vercel build log of the production deployment shows `prisma migrate deploy` finishing without an error.
- Open the live site in both languages (`/tr`, `/en`): the home page, a product page, the contact page and the admin sign-in page.
- `/robots.txt` and `/sitemap.xml` answer, and the live site is open to search engines (no `noindex`).
- The demo notice band and the demo sign-in still behave as described in the [README](../../README.md) while demo mode is on.

## Roll back the application

Pick one.

- **Promote the previous deployment (fast).** In Vercel, open the project Deployments list, pick the last good production deployment and promote it to production. No tag, workflow or code change is involved.
- **Ship a new patch release (the fix).** Fix the problem on a branch, merge it, and release `vX.Y.(Z+1)` with the steps above. A promoted old deployment is a stop-gap; the repository still has the bad version as the latest tag until the patch release is out.

Do not delete or move a tag, and do not create or edit a GitHub release by hand.


## A release with a migration

Migrations only move forward. The project has no down migrations and no command to undo one. Promoting the previous deployment restores the old application code, but the production database keeps the schema change.

- Before the release, make sure the migration works with the old code as well, so a promotion stays safe. A migration that deletes or renames data ships in its own release and is checked in the rehearsal ([ADR 0011](../adr/0011-versioning-and-releases.md), rule 7).
- If the new schema causes a problem, the fix is a new migration in a patch release. Do not edit or remove a migration that already ran in production.
- The rehearsal applies migrations to the shared preview database only. It tests the migration, but it cannot show how it behaves on production data.
- Restoring a database from a backup is not described in the project documents. The data host (Neon) offers its own restore tools; check them before a risky migration.

## Not verified in the documents

- The exact Vercel menu names and what happens to a promoted deployment when the next tag deploys are not documented here. Follow the Vercel dashboard.
