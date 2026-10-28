#!/usr/bin/env bash
# Validates a branch name: <type>/<kebab-case>.
set -euo pipefail
name="${1:?branch name required}"
types='feat|fix|docs|chore|refactor|test|ci|perf|build|style|revert'
if ! printf '%s' "$name" | grep -Eq "^(${types})/[a-z0-9]+(-[a-z0-9]+)*$"; then
  echo "branch-name: '$name' must match '<type>/<kebab-case>' (types: ${types//|/, })" >&2
  exit 1
fi
