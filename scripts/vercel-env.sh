#!/usr/bin/env bash
# Push env vars from .env.local to Vercel (production).
# Reads .env.local, prompts for confirmation, pushes each non-comment line.
#
# Usage:
#   ./scripts/vercel-env.sh

set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

echo "Will push these vars to Vercel (production):"
grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$' | sed 's/=.*/=***/' | sed 's/^/  /'
echo
read -rp "Continue? [y/N] " confirm
[[ "$confirm" == "y" || "$confirm" == "Y" ]] || { echo "Aborted."; exit 0; }

while IFS='=' read -r key value; do
  # skip comments and blank lines
  [[ "$key" =~ ^#.*$ ]] && continue
  [[ -z "$key" ]] && continue

  # strip surrounding quotes from value if present
  value="${value%\"}"
  value="${value#\"}"

  # NEXTAUTH_URL needs the production URL, not localhost
  if [[ "$key" == "NEXTAUTH_URL" ]]; then
    echo "Skipping $key (set this to your production URL on Vercel separately)"
    continue
  fi

  echo "Setting $key…"
  printf '%s' "$value" | vercel env add "$key" production --force >/dev/null 2>&1 || \
    printf '%s' "$value" | vercel env add "$key" production
done < "$ENV_FILE"

echo
echo "Done. Don't forget to also set NEXTAUTH_URL (and AUTH_GITHUB_ID/SECRET for the prod OAuth App)."
