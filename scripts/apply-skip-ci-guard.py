#!/usr/bin/env python3
"""Open one PR per infra repo that adds `[skip ci]` guards to tofu-apply.yml jobs.

The guard lets portal-tui's manual-apply path push to dev without re-triggering
the existing CI apply.

Adds:    if: ${{ !contains(github.event.head_commit.message, '[skip ci]') }}
…after the `name: "..."` line of every top-level job in tofu-apply.yml.

Requires: gh CLI authenticated with repo scope.
"""
from __future__ import annotations

import re
import subprocess
import sys
import tempfile
from pathlib import Path

REPOS = [
    "itti-bank-ai-infra",
    "itti-bank-core-infra",
    "itti-customer-core-infra",
    "itti-docs-infra",
    "itti-finance-infra",
    "itti-siav-infra",
]

ORG = "ittikar"
WORKFLOW = ".github/workflows/tofu-apply.yml"
BRANCH = "portal/skip-ci-guard"
GUARD_LINE = "    if: ${{ !contains(github.event.head_commit.message, '[skip ci]') }}"

# Match a `name: "..."` line at exactly 4 spaces indent (= top-level job name).
NAME_LINE = re.compile(r'^( {4}name: ".*")$', re.MULTILINE)


def run(args: list[str], cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess:
    res = subprocess.run(args, cwd=cwd, capture_output=True, text=True, check=check)
    return res


def patch_workflow(text: str) -> tuple[str, int]:
    """Insert the GUARD_LINE after every `    name: "..."` line that doesn't
    already have an `if:` immediately after it. Returns (new_text, num_patched)."""
    lines = text.splitlines(keepends=False)
    out: list[str] = []
    patched = 0
    i = 0
    while i < len(lines):
        line = lines[i]
        out.append(line)
        if NAME_LINE.match(line):
            next_line = lines[i + 1] if i + 1 < len(lines) else ""
            if "if:" not in next_line:
                out.append(GUARD_LINE)
                patched += 1
        i += 1
    return "\n".join(out) + ("\n" if text.endswith("\n") else ""), patched


def process_repo(slug: str, work: Path) -> None:
    print(f"\n=== {slug} ===")
    target = work / slug
    if target.exists():
        run(["rm", "-rf", str(target)])

    print(f"  cloning…")
    run(["gh", "repo", "clone", f"{ORG}/{slug}", str(target), "--", "--depth", "1"])

    wf = target / WORKFLOW
    if not wf.exists():
        print(f"  no {WORKFLOW} — skipping")
        return

    original = wf.read_text()
    if "[skip ci]" in original:
        print("  already has [skip ci] guard — skipping")
        return

    patched, count = patch_workflow(original)
    if count == 0:
        print("  no top-level jobs detected — skipping")
        return

    wf.write_text(patched)
    print(f"  patched {count} job(s)")

    # Get default branch
    head = run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=target).stdout.strip()
    print(f"  default branch: {head}")

    run(["git", "checkout", "-b", BRANCH], cwd=target)
    run(["git", "-c", "user.email=portal-tui@ittikar.local",
         "-c", "user.name=portal-tui",
         "add", WORKFLOW], cwd=target)
    run(["git", "-c", "user.email=portal-tui@ittikar.local",
         "-c", "user.name=portal-tui",
         "commit", "-m", "ci: add [skip ci] guard to tofu-apply jobs"],
        cwd=target)
    run(["git", "push", "-u", "origin", BRANCH], cwd=target)

    pr = run(
        [
            "gh", "pr", "create",
            "--base", head,
            "--head", BRANCH,
            "--title", "ci: add [skip ci] guard to tofu-apply jobs",
            "--body",
            "Add `if: ${{ !contains(github.event.head_commit.message, '[skip ci]') }}` "
            "to each top-level job in `tofu-apply.yml`.\n\n"
            "This lets the self-service portal's TUI manual-apply path push to "
            "`dev` without re-triggering CI when `tofu apply` has already run "
            "locally.\n\n"
            "Opened by portal-tui setup script.",
        ],
        cwd=target,
    )
    print(f"  PR: {pr.stdout.strip()}")


def main() -> int:
    if subprocess.run(["gh", "auth", "status"], capture_output=True).returncode != 0:
        print("gh CLI not authenticated — run `gh auth login` first")
        return 1

    with tempfile.TemporaryDirectory(prefix="portal-skip-ci-") as tmp:
        work = Path(tmp)
        for slug in REPOS:
            try:
                process_repo(slug, work)
            except subprocess.CalledProcessError as e:
                print(f"  ✗ failed: {e.stderr or e.stdout}")
            except Exception as e:  # noqa: BLE001
                print(f"  ✗ failed: {e}")

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
