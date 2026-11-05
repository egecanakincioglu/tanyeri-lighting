#!/usr/bin/env bash
# Blocks files that must never be tracked: env files, keys, uploads, database dumps, JavaScript source.
# Usage: check-forbidden-paths.sh --staged | --all
set -euo pipefail

# Add a path to js_allowed (an extended regex) only for a tool that can not read TypeScript config.
js_allowed='^$'
forbidden='(^|/)\.env($|\.)|^database/|^server/uploads/|\.(pem|key|p12|pfx)$|(^|/)id_(rsa|ed25519)|^docs/old-source-code/|\.(js|mjs|cjs|jsx)$'

mode="${1:?mode required: --staged | --all}"
case "$mode" in
  --staged) paths="$(git diff --cached --name-only --diff-filter=ACMR)" ;;
  --all) paths="$(git ls-files)" ;;
  *) echo "unknown mode: $mode" >&2; exit 2 ;;
esac

bad="$(grep -E "$forbidden" <<<"$paths" | grep -Ev '(^|/)\.env\.example$' | grep -Ev "^($js_allowed)\$" || true)"
if [ -n "$bad" ]; then
  while IFS= read -r p; do echo "forbidden-paths: $p" >&2; done <<<"$bad"
  exit 1
fi
