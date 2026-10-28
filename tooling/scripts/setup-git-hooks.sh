#!/usr/bin/env bash
# One-time per clone: point git at the versioned hooks in tooling/git-hooks and set up commit signing.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"
# git wants a path it can open natively: on Windows (Git Bash) that is the C:/... form
hooks="$(cygpath -m "$root/tooling/git-hooks" 2>/dev/null || printf '%s' "$root/tooling/git-hooks")"
git config core.hooksPath "$hooks"
# LF is enforced by .gitattributes; autocrlf would only rewrite files behind its back.
git config --local core.autocrlf false
chmod +x tooling/git-hooks/* tooling/scripts/*.sh 2>/dev/null || true
echo "git hooks enabled (core.hooksPath=$hooks)"
bash tooling/scripts/setup-commit-signing.sh
# Show immediately what else this machine is missing (never fails the setup).
if command -v node >/dev/null 2>&1; then
  node tooling/scripts/doctor.mjs || true
else
  echo "node not found: install Node (see .node-version), then run: node tooling/scripts/doctor.mjs"
fi
