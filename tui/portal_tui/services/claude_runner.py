"""Spawn `claude -p` against a repo working directory."""
from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

from ..config import CLAUDE_BIN, CLAUDE_MAX_TURNS


PROMPT_TEMPLATE = """\
You are generating OpenTofu code for the {repo_slug} infra repo at $PWD.

A self-service portal user submitted a request as a GitHub issue. The issue body
contains a YAML manifest under a ```yaml fenced block. Your job:

1. Read the manifest below to understand the resource the user wants.
2. Read the repo's conventions:
   - List the modules/ directory.
   - Read variables.tf and 2–3 example .tf files in the layer where this resource
     belongs (most resources go in layers/compute/, infra-level things go in
     envs/ or layers/shared/, networking in layers/network/ or modules/network/).
   - If a matching module exists in modules/, prefer calling it. Otherwise write
     an inline `resource "aws_*"` block.
3. Write EXACTLY two new files in the chosen layer directory:
   - portal_<resource>_<safe_name>.tf  — the module call or resource block
   - portal_<resource>_<safe_name>.auto.tfvars  — any var defaults this needs
4. Do NOT modify any existing files.
5. Use the same naming/tagging conventions as existing code (project, environment,
   tags = local.common_tags, etc).
6. When done, print a single-line summary to stdout in this exact format:
   PORTAL_DONE path1=<.tf file path> path2=<.auto.tfvars file path>

Manifest:
```yaml
{manifest_yaml}
```
"""


@dataclass
class ClaudeResult:
    stdout: str
    stderr: str
    summary_line: str | None
    returncode: int


def run_claude(repo_path: Path, repo_slug: str, manifest_yaml: str) -> ClaudeResult:
    prompt = PROMPT_TEMPLATE.format(repo_slug=repo_slug, manifest_yaml=manifest_yaml)
    proc = subprocess.run(
        [CLAUDE_BIN, "-p", prompt, "--max-turns", str(CLAUDE_MAX_TURNS)],
        cwd=repo_path,
        capture_output=True,
        text=True,
    )
    summary = None
    for line in (proc.stdout or "").splitlines():
        if line.startswith("PORTAL_DONE"):
            summary = line.strip()
            break
    return ClaudeResult(
        stdout=proc.stdout or "",
        stderr=proc.stderr or "",
        summary_line=summary,
        returncode=proc.returncode,
    )
