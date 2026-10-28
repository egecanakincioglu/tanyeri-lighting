#!/usr/bin/env bash
# Blocks the old client brand name from ever reaching the repository.
# Modes:
#   --staged        staged file paths and added lines (pre-commit)
#   --all           every tracked file path and file content (CI)
#   --text <file|-> free text such as a commit message or PR title/body
# The old brand is matched as a whole word (or as the compound with "lighting"), so ordinary words that merely
# contain it, such as the English "afraid" or the Turkish "safra", do not match. The only exception is the origin
# note in README.md content: never its path, never --text (commit messages and PR text may not name it).
# The pattern is written with a character class so this file does not match itself.
set -euo pipefail

old_brand='(^|[^[:alpha:]])a[f]ra([^[:alpha:]]|$)|a[f]ralighting'
brand_exempt=':(top,exclude)README.md' # git pathspec, so only the root README's content is skipped

fail=0
report() { echo "forbidden-terms: $1" >&2; fail=1; }

check_path() {
  grep -Eiq "$old_brand" <<<"$1" && report "old brand name in path: $1"
  return 0
}

mode="${1:?mode required: --staged | --all | --text <file|->}"
case "$mode" in
  --staged)
    while IFS= read -r path; do
      check_path "$path"
    done < <(git diff --cached --name-only --diff-filter=ACMR)
    # collect matches instead of piping into grep -q / head: an early exit would SIGPIPE the producer,
    # and under pipefail a large diff could then hide a match
    matches="$(git diff --cached --diff-filter=ACMR -U0 -- . "$brand_exempt" | grep -E '^\+[^+]' | grep -Ei "$old_brand" || true)"
    if [ -n "$matches" ]; then
      printf '%s\n' "$matches" | sed -n '1,5p' >&2
      report "old brand name in staged content"
    fi
    ;;
  --all)
    while IFS= read -r path; do
      check_path "$path"
    done < <(git ls-files)
    if git grep -n -I -i -E "$old_brand" -- . "$brand_exempt" >/dev/null; then
      git grep -n -I -i -E "$old_brand" -- . "$brand_exempt" | sed -n '1,20p' >&2
      report "old brand name in tracked content"
    fi
    ;;
  --text)
    src="${2:--}"
    if [ "$src" = "-" ]; then text="$(cat)"; else text="$(cat "$src")"; fi
    # Every line is scanned, # lines included: -m/-F messages keep them and PR bodies use # headings. Only git's
    # scissors line is honoured, because git discards everything after it (verbose diff, status) from the message.
    text="$(printf '%s\n' "$text" | sed '/^# -\{24\} >8 -\{24\}$/,$d')"
    grep -Eiq "$old_brand" <<<"$text" && report "old brand name in text"
    ;;
  *) echo "unknown mode: $mode" >&2; exit 2 ;;
esac
exit $fail
