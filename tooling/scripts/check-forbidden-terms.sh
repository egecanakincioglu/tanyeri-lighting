#!/usr/bin/env bash
# Blocks the old client brand name from the repository.
# Usage: check-forbidden-terms.sh --staged | --all | --text <file|->
set -euo pipefail

# The old brand matches as a whole word or as the compound with "lighting", so "afraid" or "safra" do not match;
# the character class keeps this file from matching itself.
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
    # Collect matches first: piping into grep -q or head exits early, and SIGPIPE under pipefail could hide a match.
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
    # Scan every line, # lines included (PR bodies use # headings); drop only what git discards after its scissors line.
    text="$(printf '%s\n' "$text" | sed '/^# -\{24\} >8 -\{24\}$/,$d')"
    grep -Eiq "$old_brand" <<<"$text" && report "old brand name in text"
    ;;
  *) echo "unknown mode: $mode" >&2; exit 2 ;;
esac
exit $fail
