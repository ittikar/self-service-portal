#!/usr/bin/env bash
# Open a one-line PR in each of the 8 infra repos that adds a `[skip ci]` guard
# to the tofu-apply.yml workflow. This is what lets portal-tui's manual-apply
# path push to dev without re-triggering the CI apply.
#
# Requires: gh CLI authenticated.

set -euo pipefail

REPOS=(
  itti-bank-ai-infra
  itti-bank-core-infra
  itti-customer-core-infra
  itti-docs-infra
  itti-finance-infra
  itti-siav-infra
  itti-network-infra
  itti-ui-infra
)

GUARD='if: ${{ !contains(github.event.head_commit.message, ''[skip ci]'') }}'

WORK=/tmp/portal-skip-ci-guard
rm -rf "$WORK"
mkdir -p "$WORK"

for slug in "${REPOS[@]}"; do
  echo "=== $slug ==="
  cd "$WORK"
  gh repo clone "ittikar/$slug" "$slug" -- --depth 1 || continue
  cd "$slug"

  WF=".github/workflows/tofu-apply.yml"
  if [[ ! -f "$WF" ]]; then
    echo "  no $WF — skipping"
    continue
  fi

  if grep -q 'skip ci' "$WF"; then
    echo "  already has skip-ci guard — skipping"
    continue
  fi

  # Inject the guard before the first `runs-on:` line of the apply job.
  # Conservative: do NOT mass-rewrite. Print a diff suggestion instead.
  echo "  --- suggested patch (apply manually) ---"
  echo "  Add this line to the apply job (just above 'runs-on:'):"
  echo "    $GUARD"
  echo
done

echo "Done. Review each repo's workflow and open a PR with the guard."
