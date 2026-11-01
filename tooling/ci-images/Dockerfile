# CI image manifest: the single source of truth for the container images used by the workflows and git hooks.
# This file is NEVER built. It is only a list that Dependabot (docker ecosystem) keeps up to date and that
# tooling/scripts/ci-image.ts and the pre-commit hook read. Every stage is `FROM <name>:<tag>@sha256:<digest> AS <stage>`.
FROM ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f AS gitleaks
FROM semgrep/semgrep:1.182.1@sha256:451b3d875c00dac7ed5db5293e584a07de11449a409c10b3c2d2652f429630b6 AS semgrep
FROM postgres:18.4@sha256:a02db8cac496f15b094798a38254f14d6e00741f709360e5e00bb6668ea31636 AS postgres
FROM ghcr.io/zizmorcore/zizmor:1.31.1@sha256:42d409dbb851d4c5d35a058cf042b828bea1e3f2884378c526eb0974780e18d9 AS zizmor
