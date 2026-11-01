# Contributing

Thank you for looking at Tanyeri Lighting. The rules below are short on purpose. The [Git workflow guide](docs/guides/git-workflow.md) has the details and shows which check enforces each rule.

## Issues

Issues are welcome: bug reports, questions about the architecture and ideas for the roadmap. Use the issue tracker for anything that is not a security problem. For security problems, follow [SECURITY.md](SECURITY.md) instead.

## Language

Code, documentation, commit messages, pull request titles and bodies, and issues are written in English. The only Turkish text is the Turkish content of the site itself (`messages/tr.json` and Turkish demo content).

## Setup

See the [development setup guide](docs/guides/development-setup.md) for Node 24, pnpm, Docker, Git hooks, commit signing and the daily commands. The [README](README.md) has a short version of the steps.

## Pull request rules

- One branch per piece of work, named `<type>/<kebab-case>` (for example `feat/product-list`). Work is never done on `main`.
- Commits are atomic and follow Conventional Commits in English. The header is at most 72 characters, lowercase, without a trailing period, and the body contains at least one English line.
- Commits are signed. Commit trailers and co-author lines are not allowed.
- Any change under `src/` comes with tests in the same pull request. Line coverage of `src/server` and `src/lib` must not drop below its threshold.
- A pull request does one thing. If it changes the user interface, the "Visual check" section of the template is filled in.
- Documentation changes go in the same pull request as the change they describe. Documentation under `docs/` is in English.
- All required CI checks must be green before a pull request is merged. Merges use a merge commit only; squash and rebase merges are disabled, and branches are deleted after the merge.
- Do not use `--no-verify`, force pushes, or history rewrites on pushed branches.

Fill in the pull request template (`.github/pull_request_template.md`).

## Local checks

Before opening a pull request, run:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

`pnpm test` needs the local database: start it with `pnpm db:up` first. The other scripts are listed in the development setup guide.
