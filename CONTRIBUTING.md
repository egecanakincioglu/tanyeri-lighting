# Contributing

Thank you for looking at Tanyeri Lighting. I rewrote this project from scratch as a personal open source project, so the rules below are the ones I hold myself to. They are short on purpose.

## Issues

Issues are welcome: bug reports, questions about the architecture, and ideas for the roadmap. Please use the issue tracker for anything that is not a security problem. For security problems, follow [SECURITY.md](SECURITY.md) instead.

## Language

The project documentation in `docs/` is written in Turkish, because it is my own working journal and plan. Code, commit messages, pull request titles and bodies, and this file are written in English. Please use English for anything you contribute to the code or to the GitHub text.

## Setup

The setup guides are written in Turkish. They describe how I set up the project on my own machine:

- [Git workflow](docs/guides/git-workflow.md) (`docs/guides/git-workflow.md`): branches, commits, pull requests, and which check enforces each rule.
- [Development environment](docs/guides/gelistirme-ortami.md) (`docs/guides/gelistirme-ortami.md`): Node 24, pnpm, git hooks, commit signing and the daily commands.

## Pull request rules

- One branch per piece of work, named `<type>/<kebab-case>` (for example `feat/product-list`). Work is never done on `main`.
- Commits are atomic and follow Conventional Commits in English. The header is at most 72 characters, lowercase, without a trailing period, and the body contains at least one English line.
- Commits are signed. Commit trailers, co-author lines and tool signatures are not allowed.
- Every commit adds its line to the journal for the day (`docs/journal/YYYY-MM-DD.md`).
- Any change under `src/` comes with tests in the same pull request. Coverage for `src/server` and `src/lib` must not drop below the threshold.
- A pull request does one thing. If it touches the user interface, the visual check section of the template is filled in.
- All CI checks must be green before a pull request is merged. Merges use a merge commit only; squash and rebase merges are disabled, and branches are deleted after merge.
- Do not use `--no-verify`, force pushes, or history rewrites on pushed branches.

Please fill in the pull request template (`.github/pull_request_template.md`), including the roadmap line.

## Local checks

Before opening a pull request, I run these commands. Please run the same ones:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

The full list is in the development environment guide.
