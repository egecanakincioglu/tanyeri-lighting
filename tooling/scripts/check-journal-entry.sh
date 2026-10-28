#!/usr/bin/env bash
# Every commit must add a line to the development journal of its day (docs/journal/YYYY-MM-DD.md)
# that contains its commit header in backticks, e.g.:
#   - `docs(adr): add status header` - first-person description
# Modes:
#   --staged <header>   check the staged journal diff (commit-msg hook); the day is today
#   --commit <sha>      check an existing commit (CI); the day is the commit's author date
set -euo pipefail

mode="${1:?mode required}"
case "$mode" in
  --staged)
    header="${2:?header required}"
    day="$(date +%F)"
    diff="$(git diff --cached -U0 -- "docs/journal/$day.md")"
    ;;
  --commit)
    sha="${2:?sha required}"
    header="$(git log -1 --format=%s "$sha")"
    day="$(git log -1 --format=%ad --date=format:%F "$sha")"
    diff="$(git show --format= -U0 "$sha" -- "docs/journal/$day.md")"
    ;;
  *) echo "unknown mode: $mode" >&2; exit 2 ;;
esac

case "$header" in "Merge "*) exit 0 ;; esac

# no pipe into grep -q: an early exit would SIGPIPE the producer and fail the pipeline under pipefail
added="$(grep -E '^\+' <<<"$diff" || true)"
if ! grep -Fq -- "\`$header\`" <<<"$added"; then
  echo "journal: commit must add a journal line containing \`$header\` to docs/journal/$day.md" >&2
  exit 1
fi
