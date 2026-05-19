"""Local git operations via subprocess."""
from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from ..config import GH_ORG, GIT_BIN, GITHUB_TOKEN, WORK_DIR


@dataclass
class CloneResult:
    path: Path
    branch: str


def run(args: list[str], cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True, check=check)


def clone_repo(repo_slug: str, branch: str) -> CloneResult:
    """Clone the repo's dev/main branch into WORK_DIR/<slug>. Replaces any existing checkout."""
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    target = WORK_DIR / repo_slug
    if target.exists():
        shutil.rmtree(target)
    url = f"https://x-access-token:{GITHUB_TOKEN()}@github.com/{GH_ORG}/{repo_slug}.git"
    run([GIT_BIN, "clone", "--depth", "1", "--branch", branch, url, str(target)])
    return CloneResult(path=target, branch=branch)


def stage_and_diff(path: Path) -> str:
    """Stage all changes and return the diff (as it would appear in a PR)."""
    run([GIT_BIN, "add", "-A"], cwd=path)
    return run([GIT_BIN, "diff", "--cached", "--unified=3"], cwd=path).stdout


def commit_and_push(path: Path, message: str, branch: str) -> str:
    """Commit staged changes with the given message and push to origin/<branch>.
    Returns the commit SHA.
    """
    run([GIT_BIN, "-c", "user.email=portal-tui@ittikar.local", "-c", "user.name=portal-tui",
         "commit", "-m", message], cwd=path)
    run([GIT_BIN, "push", "origin", f"HEAD:{branch}"], cwd=path)
    return run([GIT_BIN, "rev-parse", "HEAD"], cwd=path).stdout.strip()


def has_changes(path: Path) -> bool:
    res = run([GIT_BIN, "status", "--porcelain"], cwd=path)
    return bool(res.stdout.strip())
