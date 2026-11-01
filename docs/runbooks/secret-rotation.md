# Secret rotation

How to replace each secret of the project without losing access to the site or to the release pipeline.

## When to rotate

- Suspected leak: the value appeared in a log, a screenshot, a chat, a commit or a shared machine. Rotate at once.
- A person with access leaves. Rotate every secret that person could read.
- Schedule: rotate the long-lived secrets at least once a year, and the deploy token when it expires.

## Where values live

| Place                                   | What it holds                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| Vercel project environment variables    | The runtime variables, set separately for Production and Preview                            |
| GitHub repository secrets and variables | `VERCEL_TOKEN` (secret), `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (variables)                |
| Local `.env`                            | Development values only. Never copy a production or preview value into it                  |

Production and preview use separate Neon databases ([architecture](../architecture.md)) and separate values. `BETTER_AUTH_SECRET` must differ per environment (see `.env.example`).

## Rules for every rotation

1. Create the new value first, and keep the old one valid until the new one works.
2. Change Production and Preview separately, one at a time. Do not paste a secret into a command line, an issue, a pull request or a chat.
3. Vercel applies a changed environment variable only to new deployments. Deployments come only from the release workflows (see the [git workflow](../guides/git-workflow.md)), so after changing a value:
   - Preview: run `gh workflow run release-rehearsal.yml -f ref=main`.
   - Production: redeploy the current production deployment in Vercel, or ship the next release tag.
4. Revoke the old value only after the check at the end of the section passes.
5. Update your local `.env` only if the value is used locally, and only with a development value.

## 1. Database (Neon)

Variables: `DATABASE_URL` (pooled, used by the running app) and `DATABASE_URL_UNPOOLED` (direct, used by migrations and the Prisma CLI). Both contain the role password, so both change together.

Do this once for the production database and once for the preview database.

1. In the Neon console, open the right project and database, and reset the password of the role the app uses.
2. Copy the new pooled and direct connection strings from the console.
3. In the Vercel project environment variables, replace `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for the matching environment: Production for the production database, Preview for the preview database.
4. Redeploy that environment (rule 3 above). The build runs `prisma migrate deploy` with `DATABASE_URL_UNPOOLED`, so a wrong direct string fails the build.

Verify:

- The Vercel build log shows `prisma migrate deploy` finishing without a connection error.
- The site loads, and an admin sign-in works (it reads and writes the `session` table).

What breaks: from the moment the role password changes until the redeploy finishes, the running deployment cannot connect, so pages that read the database and admin sign-in fail. Do the Neon reset and the Vercel update back to back, and redeploy at once.

## 2. `BETTER_AUTH_SECRET`

Where: Vercel Production and Preview. Never reuse a value between them.

1. Generate a value of at least 32 characters (the app refuses shorter ones):

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

2. Replace `BETTER_AUTH_SECRET` in the Vercel environment variables for the environment you are rotating.
3. Redeploy that environment.

Verify: sign in to the admin panel with a correct password. The sign-in succeeds and creates a new session.

What breaks:

- Every existing session and every pending password reset token stops working. All admins must sign in again.
- The rate-limit key is also derived from the secret, so open rate-limit windows reset.

## 3. `BLOB_READ_WRITE_TOKEN` (Vercel Blob)

Where: Vercel Production and Preview. The local `.env` holds the token of a separate development store, never the production one. Without a token, uploads are off and the admin panel says so.

1. In Vercel, open the Blob store and create a new read-write token for it.
2. Replace `BLOB_READ_WRITE_TOKEN` in the Vercel environment variables for the matching environment.
3. Redeploy that environment.
4. After the check below passes, revoke the old token in the same store.

Verify: upload a small image in the admin panel and open the stored file.

What breaks: nothing, as long as the old token stays valid until the new deployment is live. If you revoke it first, uploads fail until the redeploy finishes. Files already stored stay available, because they are public.

## 4. SMTP

Variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`. `.env.example` describes each of them.

The group is all or none. With none set, email is off. With only some set, validation fails.

1. At the mail provider, create a new password (or credential) for the SMTP user.
2. In the Vercel environment variables, replace `SMTP_PASSWORD`. If the provider also changed the host, port, user or sender, replace all five together in the same edit.
3. Redeploy the environment.
4. Revoke the old credential at the provider.

Verify: request a password reset for an admin address on the sign-in page and check that the message arrives.

What breaks: while the old credential is invalid and the new one is not deployed, reset and verification emails fail to send. Sign-in is not affected.

## 5. Deploy token and IDs (GitHub)

`VERCEL_TOKEN` is a repository secret read by `release.yml` and `release-rehearsal.yml`. `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are repository variables, not secrets. They are identifiers and rarely change.

1. In Vercel, create a new token scoped to the team that owns the project, with an expiry date.
2. In the GitHub repository settings, update the `VERCEL_TOKEN` secret with the new value.
3. Run the rehearsal: `gh workflow run release-rehearsal.yml -f ref=main`. A green run means the new token can create a deployment.
4. Delete the old token in Vercel.

If the team or the project is replaced, update `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` in the repository variables and run the same rehearsal.

What breaks: a release tag pushed while the secret is wrong fails at the deploy step. Rotate between releases, not during one.

## 6. Admin password

Use this when an admin password leaks, or when it is forgotten and email is off.

1. On a machine with the project and the right `DATABASE_URL`, run `pnpm admin:reset-password --email <address>` and give the new password on stdin, not as an argument, so it stays out of the shell history.
2. The command sets the new password and ends all sessions of that user.

Verify: sign in with the new password. The old password and the old sessions no longer work.

What breaks: that user is signed out everywhere. Other admins are not affected.

## Added with the admin panel

These secrets do not exist yet. When the admin panel adds them, this runbook gets a section for each:

- The encryption key for stored credentials.
- The Google credentials.
