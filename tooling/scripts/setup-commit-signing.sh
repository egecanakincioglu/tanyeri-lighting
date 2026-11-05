#!/usr/bin/env bash
# Sets up SSH signing of commits and tags for this device and clone; safe to run again.
# Usage: bash tooling/scripts/setup-commit-signing.sh
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

email="$(git config user.email || true)"
if [ -z "$email" ]; then
  echo "setup-commit-signing: git user.email is not set; set the identity first (git config user.email ...)" >&2
  exit 1
fi

# git wants a path it can open natively: on Windows (Git Bash) that is the C:/... form
native() { cygpath -m "$1" 2>/dev/null || printf '%s' "$1"; }

# Set a local key only when the effective value differs, so a correct global setup stays untouched.
ensure() {
  if [ "$(git config --get "$1" || true)" != "$2" ]; then
    git config --local "$1" "$2"
    echo "set $1=$2"
  fi
}

configured="$(git config --get user.signingkey || true)"
case "$configured" in
  "~/"*) configured="$HOME/${configured#"~/"}" ;;
esac
pub=""
if [ -n "$configured" ] && [ -f "$configured" ] && [ "${configured%.pub}" != "$configured" ]; then
  pub="$configured"
  echo "keeping the existing signing key $pub"
fi

generated=""
if [ -z "$pub" ]; then
  if ! command -v ssh-keygen >/dev/null 2>&1; then
    echo "setup-commit-signing: ssh-keygen not found. Linux: sudo apt install openssh-client; Windows: it ships with Git for Windows (Git Bash)." >&2
    exit 1
  fi
  host="$(hostname 2>/dev/null || uname -n)"
  host="${host%%.*}"
  ssh_dir="$HOME/.ssh"
  key="$ssh_dir/tanyeri_signing_ed25519"
  pub="$key.pub"
  mkdir -p "$ssh_dir"
  chmod 700 "$ssh_dir" 2>/dev/null || true
  if [ ! -f "$key" ]; then
    ssh-keygen -q -t ed25519 -N "" -C "$email tanyeri-signing $host" -f "$key"
    echo "created signing key $key"
  elif [ ! -f "$pub" ]; then
    ssh-keygen -y -f "$key" > "$pub"
    echo "rebuilt $pub from the existing private key"
  fi
  chmod 600 "$key" 2>/dev/null || true
  generated="yes"
  ensure user.signingkey "$(native "$pub")"
fi

ensure gpg.format ssh
ensure commit.gpgsign true
ensure tag.gpgsign true

signers="$(git config --get gpg.ssh.allowedSignersFile || true)"
case "$signers" in
  "~/"*) signers="$HOME/${signers#"~/"}" ;;
esac
if [ -z "$signers" ]; then
  signers="$HOME/.ssh/tanyeri_allowed_signers"
  mkdir -p "$HOME/.ssh"
  git config --local gpg.ssh.allowedSignersFile "$(native "$signers")"
  echo "set gpg.ssh.allowedSignersFile=$(native "$signers")"
fi

read -r key_type key_data _comment < "$pub"
touch "$signers"
if ! grep -qF -- "$key_data" "$signers"; then
  printf '%s %s %s\n' "$email" "$key_type" "$key_data" >> "$signers"
  echo "added the signing key to $signers"
fi
echo "commit signing is configured for this clone (key: $pub)"

if [ -n "$generated" ]; then
  cat >&2 <<MSG

ACTION REQUIRED: register the new public key on GitHub as a signing key, or GitHub will not mark the commits
as verified. Run:

  gh ssh-key add "$pub" --type signing --title "tanyeri-signing $host"

(if gh lacks the scope, run first: gh auth refresh -h github.com -s admin:ssh_signing_key)
MSG
fi
