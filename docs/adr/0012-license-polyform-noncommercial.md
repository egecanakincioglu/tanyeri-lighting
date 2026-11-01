# ADR 0012: License — PolyForm Noncommercial 1.0.0 instead of MIT; CodeQL replaced by Semgrep registry rules and zizmor

Status: Accepted
Date: 2026-11-01

## Context

The project was published under the MIT license. The aim is that anyone may read, study, modify and use the code, or parts of it, for any noncommercial purpose (personal use, education, research, nonprofit work), and that commercial use is not allowed. MIT does not limit commercial use, so it does not meet this aim.

Verified facts:

- A license that forbids commercial use is not approved by the Open Source Initiative (OSI). A project under such a license is source-available, not open source.
- The CodeQL terms allow use only on codebases under an OSI-approved license, or with a paid GitHub Advanced Security plan. With a non-OSI license, the CodeQL workflow from [ADR 0008](0008-ci-and-protection-layers.md) cannot stay.
- Semgrep CE runs without an account, and the registry rule sets can be fetched at run time. `p/nextjs` has no CE rules, and `p/nodejsscan` produces false positives on this code.
- zizmor audits GitHub Actions workflows. Version 1.31.1 is published as a container image that can be pinned by digest.
- Only one version has been published so far (v0.1.0, under MIT).

## Options

| Option | Pros | Cons |
|---|---|---|
| MIT (unchanged) | OSI-approved; CodeQL stays; simple | Allows commercial use, which is against the aim |
| AGPL-3.0 | OSI-approved; strong copyleft; CodeQL stays | Still allows commercial use, including paid services, as long as the source is shared; many companies avoid it; does not meet the aim |
| CC BY-NC-SA 4.0 | Noncommercial; well known | Written for content, not for software; no patent grant; Creative Commons advises against using it for software |
| PolyForm Noncommercial 1.0.0 | Written for software; clear list of noncommercial purposes (personal, research, education, nonprofit); patent grant; plain language; SPDX identifier | Not OSI-approved; CodeQL cannot be used; fewer people know it |

## Decision

The project uses **PolyForm Noncommercial 1.0.0**. It is the only option that forbids commercial use and is written for software. The `LICENSE` file holds the official text and the line `Required Notice: Copyright (c) 2026 Egecan Akıncıoğlu`. `package.json` uses the SPDX identifier `PolyForm-Noncommercial-1.0.0`.

Rules:

1. The project calls itself "source-available", never "open source".
2. Versions published before this change (v0.1.0) stay under MIT. Anyone who has them may keep using them under those terms.
3. Contributions are accepted under the same license (stated in `CONTRIBUTING.md`).
4. The CodeQL workflow is removed. Two jobs in `ci.yml` replace it:
   - `semgrep-registry`: Semgrep CE with `p/typescript`, `p/react`, `p/nodejs`, `p/owasp-top-ten` and `p/security-audit`, run with `--error`. `p/nodejsscan` is left out (false positives). The Semgrep image is pinned by digest; the rules are not.
   - `zizmor`: version 1.31.1, pinned by digest in `tooling/ci-images/Dockerfile`. It audits `.github` at medium severity or higher, with the online audits on through `GITHUB_TOKEN`.
5. The audit of the workflows found two things that are now fixed and guarded by tests: every `actions/checkout` step sets `persist-credentials: false`, and the release job turns the setup-node cache off.
6. The required checks are 12: `policy`, `pr-text`, `tooling (linux)`, `tooling (windows)`, `quality`, `semgrep-registry`, `zizmor`, `test`, `build`, `site-audit (pages)`, `site-audit (mobile)` and `site-audit (desktop)`. The three CodeQL checks (`analyze (javascript-typescript)`, `analyze (actions)` and `CodeQL`) are removed from branch protection.
7. The production license policy (`check-licenses`) stays as it is: only permissive dependency licenses are allowed. MIT licenses of third-party tools are not affected by this change.

## Consequences

- Positive: the license matches the aim; commercial use needs a separate agreement with the author.
- Positive: zizmor checks the workflows, which CodeQL's `actions` scan did before, and its findings led to the two workflow fixes above.
- Negative: the project is not open source. Some package registries, companies and lists only accept OSI-approved licenses, so adoption and contributions may be fewer.
- Negative: CodeQL's data-flow analysis is gone. The registry sets are pattern-based, so they find fewer problems than CodeQL's `security-extended` suite.
- Negative: the registry rules are not pinned. A new upstream rule can turn `semgrep-registry` red without any change in the repository. The job is kept apart from `quality` so that this kind of failure is easy to recognize. The rule license described in [ADR 0008](0008-ci-and-protection-layers.md) still applies to the registry rules; they are only used to scan this repository.
- Negative: `p/nextjs` has no CE rules, so Next.js-specific patterns are covered only by the project's own Semgrep rules and the other sets.
- Required follow-up (manual): branch protection on `main` must be updated to the 12 checks above. Until then, a pull request cannot merge, because the three CodeQL checks never report again.
- Docs changed with this decision: `README.md`, `docs/vision.md`, `CONTRIBUTING.md`, `docs/architecture.md`, `docs/guides/git-workflow.md`, ADR 0008 and ADR 0011. `CHANGELOG.md` and `releases/v0.1.0.md` describe the past and are not changed.

## Sources

- https://polyformproject.org/licenses/noncommercial/1.0.0/
- https://spdx.org/licenses/PolyForm-Noncommercial-1.0.0.html
- https://opensource.org/licenses
- https://github.com/github/codeql-cli-binaries/blob/main/LICENSE.md
- https://docs.semgrep.dev/licensing
- https://github.com/zizmorcore/zizmor/releases
- https://creativecommons.org/faq/#can-i-apply-a-creative-commons-license-to-software
