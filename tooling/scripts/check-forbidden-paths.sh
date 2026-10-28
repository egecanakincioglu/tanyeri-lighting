#!/usr/bin/env bash
# Blocks files that must never be tracked: env files, private keys, uploads, database dumps and local-only
# design/assistant files, and JavaScript source (all code is TypeScript).
# Modes:
#   --staged   staged paths (pre-commit)
#   --all      every tracked path (CI)
set -euo pipefail

# Exception for a tool that can not read TypeScript config: add its exact path to js_allowed (an extended regex)
# with a comment saying why. Empty today (matches nothing).
js_allowed='^$'
forbidden='(^|/)\.env($|\.)|^database/|^server/uploads/|\.(pem|key|p12|pfx)$|(^|/)id_(rsa|ed25519)|(^|/)\.mcp\.json$|^PRODUCT\.md$|^DESIGN\.md$|^design-system/|^docs/brand-guidelines\.md$|^docs/old-source-code/|\.(js|mjs|cjs|jsx)$'

mode="${1:?mode required: --staged | --all}"
case "$mode" in
  --staged) paths="$(git diff --cached --name-only --diff-filter=ACMR)" ;;
  --all) paths="$(git ls-files)" ;;
  *) echo "unknown mode: $mode" >&2; exit 2 ;;
esac

# .env.example is the one allowed env file
bad="$(grep -E "$forbidden" <<<"$paths" | grep -Ev '(^|/)\.env\.example$' | grep -Ev "^($js_allowed)\$" || true)"
if [ -n "$bad" ]; then
  while IFS= read -r p; do echo "forbidden-paths: $p" >&2; done <<<"$bad"
  exit 1
fi
