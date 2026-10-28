#!/usr/bin/env bash
# Validates a commit message: Conventional Commits header, a body, English/ASCII only.
# Usage: check-commit-msg.sh <file|->                full commit message (header + body)
#        check-commit-msg.sh --header-only <file|->  first line only (pull request titles)
set -euo pipefail

header_only=0
if [ "${1:-}" = "--header-only" ]; then header_only=1; shift; fi
src="${1:--}"
if [ "$src" = "-" ]; then msg="$(cat)"; else msg="$(cat "$src")"; fi
# drop git comment lines
msg="$(printf '%s\n' "$msg" | grep -v '^#' || true)"
header="$(printf '%s\n' "$msg" | head -n1)"

fail() { echo "commit-msg: $1" >&2; echo "  header: $header" >&2; exit 1; }

# allow git-generated merge/revert headers
case "$header" in
  "Merge "*|"Revert \""*) exit 0 ;;
esac

types='feat|fix|docs|chore|refactor|test|ci|perf|build|style|revert'
if ! grep -Eq "^(${types})(\([a-z0-9][a-z0-9-]*\))?!?: [a-z].{2,}$" <<<"$header"; then
  fail "header must match '<type>(<scope>)?: <lowercase summary>' (types: ${types//|/, })"
fi
[ "${#header}" -le 72 ] || fail "header longer than 72 characters"
case "$header" in *.) fail "header must not end with a period" ;; esac

# English only: reject any non-ASCII character anywhere in the message
if LC_ALL=C grep -q '[^[:print:][:space:]]' <<<"$msg"; then
  fail "non-ASCII characters found; commit messages must be English"
fi

if [ "$header_only" -eq 0 ]; then
  line2="$(printf '%s\n' "$msg" | sed -n '2p')"
  [ -z "${line2//[[:space:]]/}" ] || fail "line 2 must be blank, followed by a body"
  body="$(printf '%s\n' "$msg" | sed -n '3,$p')"
  grep -q '[^[:space:]]' <<<"$body" || fail "a commit message needs a body after the header"
fi

# no co-author / generated-by / sign-off lines
if grep -Eiq '^[[:space:]]*(co-authored-by|generated (with|by)|signed-off-by)' <<<"$msg"; then
  fail "co-author, generated-by and sign-off lines are not allowed"
fi
exit 0
