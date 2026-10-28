# CI image manifest: the single source of truth for the container images used by the workflows and git hooks.
# This file is NEVER built. It is only a list that Dependabot (docker ecosystem) keeps up to date and that
# tooling/scripts/ci-image.mjs and the pre-commit hook read. Every stage is `FROM <name>:<tag>@sha256:<digest> AS <stage>`.
FROM ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f AS gitleaks
FROM semgrep/semgrep:1.181.0@sha256:81474464c1f07483ba0682a44787fd93c91397419762a04abe2bafaae396304b AS semgrep
FROM postgres:17.11@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3 AS postgres
