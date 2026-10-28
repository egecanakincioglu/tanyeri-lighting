#!/usr/bin/env bash
# Blocks AI tool brand names and attribution from ever reaching the repository.
# Modes:
#   --staged        staged file paths and added lines (pre-commit)
#   --all           every tracked file path and file content (CI)
#   --text <file|-> free text such as a commit message or PR title/body
# --staged and --all also reject a .mcp.json path (assistant tool config stays local).
# The pattern is written with character classes so this file does not match itself.
set -euo pipefail

terms='c[l]aude|a[n]thropic|o[p]enai|c[h]atgpt|g[p]t-?[0-9]|g[e]mini|c[o]pilot|i[m]peccable|p[o]nytail'
mcp_config='(^|/)\.mcp\.json$'
attribution='co-authored-by|generated (with|by)|🤖'

fail=0
report() { echo "forbidden-terms: $1" >&2; fail=1; }

mode="${1:?mode required: --staged | --all | --text <file|->}"
case "$mode" in
  --staged)
    while IFS= read -r path; do
      grep -Eiq "$terms" <<<"$path" && report "forbidden term in path: $path"
      grep -Eq "$mcp_config" <<<"$path" && report "assistant tool config must stay local: $path"
    done < <(git diff --cached --name-only --diff-filter=ACMR)
    # collect matches instead of piping into grep -q / head: an early exit would SIGPIPE the producer,
    # and under pipefail a large diff could then hide a match
    matches="$(git diff --cached --diff-filter=ACMR -U0 | grep -E '^\+[^+]' | grep -Ei "$terms" || true)"
    if [ -n "$matches" ]; then
      printf '%s\n' "$matches" | sed -n '1,5p' >&2
      report "forbidden term in staged content"
    fi
    ;;
  --all)
    while IFS= read -r path; do
      grep -Eiq "$terms" <<<"$path" && report "forbidden term in path: $path"
      grep -Eq "$mcp_config" <<<"$path" && report "assistant tool config must stay local: $path"
    done < <(git ls-files)
    if git grep -n -I -i -E "$terms" -- . >/dev/null; then
      git grep -n -I -i -E "$terms" -- . | sed -n '1,20p' >&2
      report "forbidden term in tracked content"
    fi
    ;;
  --text)
    src="${2:--}"
    if [ "$src" = "-" ]; then text="$(cat)"; else text="$(cat "$src")"; fi
    text="$(printf '%s\n' "$text" | grep -v '^#' || true)"
    grep -Eiq "$terms" <<<"$text" && report "forbidden term in text"
    grep -Eiq "$attribution" <<<"$text" && report "attribution line in text"
    ;;
  *) echo "unknown mode: $mode" >&2; exit 2 ;;
esac
exit $fail
