# portal-tui

Textual TUI for processing self-service portal requests. Reads open `portal:request`
issues across the 12 infra repos, runs `claude -p` + `tofu plan` against the dev
branch, lets you approve and apply (either via CI on push or by running `tofu apply`
locally with `[skip ci]`).

## Requirements

- Python 3.11+
- `claude` CLI installed and logged in (your Claude Max subscription)
- `tofu` CLI installed
- `git` CLI
- A GitHub token with `repo` scope (or fine-grained PAT with Issues + Contents
  + Workflows R/W on the 12 infra repos)

## Install (uv tool — recommended)

```bash
cd tui
uv tool install --editable .
cp .env.example .env.local
# edit .env.local → set GITHUB_TOKEN at minimum
```

This installs `portal-tui` globally with its own isolated venv but symlinks
the code back to this directory, so edits take effect immediately.

To upgrade after `git pull`:

```bash
uv tool upgrade portal-tui
```

To uninstall:

```bash
uv tool uninstall portal-tui
```

## Run

```bash
portal-tui
```

Or without installing at all (one-shot):

```bash
cd tui
uvx --from . portal-tui
```

## Flow

1. **Queue screen** — lists all open issues labeled `portal:request` across
   ittikar + mondevo infra repos. Sort: oldest first.
2. Enter to open one → **Detail screen**.
3. `p` (Process) — clones the repo's `dev` branch to `/tmp/portal-tui/<slug>`,
   spawns `claude -p` with the issue manifest, then runs `tofu init` + `tofu plan`.
4. Review the generated diff + plan output.
5. `a` (Push → CI) — commits & pushes the new `.tf` files to `dev`. The repo's
   existing `tofu-apply.yml` triggers and applies.
6. OR `m` (Manual apply) — runs `tofu apply` locally first using your AWS creds,
   then commits & pushes with `[skip ci]` in the message (so CI doesn't re-apply).
7. Either path: closes the GitHub issue with a summary comment and writes a
   JSON audit log to `~/.portal-tui/audit/YYYY-MM-DD/<slug>-<issue>-<ts>.json`.

## Manual-apply path needs `[skip ci]` support in each repo's `tofu-apply.yml`

For path **m** to work without re-triggering CI, each repo's apply workflow
needs a guard. See the patch in the parent repo's
`scripts/add-skip-ci-guard.sh` (or open a one-line PR per repo to add
`if: !contains(github.event.head_commit.message, '[skip ci]')` to the apply
jobs).

## What runs where

- `claude -p` is spawned as a subprocess in the cloned repo's working dir.
  Your local Claude Code authentication is used (Max sub OAuth or
  `ANTHROPIC_API_KEY` env var, depending on how you've logged in).
- `tofu plan/apply` runs in `layers/compute/` (or `envs/`, or `infra/` —
  auto-detected) using whatever AWS credentials are in your shell environment.

## Audit log

Each processed request writes one JSON file containing:
- The original manifest
- Claude's summary + tail of stdout
- Plan output tail
- Apply output tail (manual path only)
- Commit SHA, target branch
- Mode (ci or manual)

Files live at `~/.portal-tui/audit/YYYY-MM-DD/<slug>-<issue>-<HHMMSS>.json`.
