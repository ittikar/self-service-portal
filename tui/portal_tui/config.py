"""Static config: env vars + repo list (kept in sync with web portal's lib/repos.ts)."""
from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Look for .env.local first (mirrors web portal), then .env
HERE = Path(__file__).resolve().parent.parent
for candidate in (HERE / ".env.local", HERE / ".env"):
    if candidate.exists():
        load_dotenv(candidate, override=False)
        break

GH_ORG = "ittikar"
REQUEST_LABEL = "portal:request"


def env(name: str, default: str | None = None, required: bool = False) -> str:
    v = os.environ.get(name, default)
    if required and not v:
        raise RuntimeError(f"Missing required env var: {name}")
    return v or ""


def _gh_auth_token() -> str | None:
    """Fall back to `gh auth token` if GITHUB_TOKEN env var isn't set."""
    try:
        res = subprocess.run(
            ["gh", "auth", "token"], capture_output=True, text=True, check=True
        )
        token = res.stdout.strip()
        return token or None
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def GITHUB_TOKEN() -> str:
    v = os.environ.get("GITHUB_TOKEN")
    if v:
        return v
    fallback = _gh_auth_token()
    if fallback:
        return fallback
    raise RuntimeError(
        "No GitHub token available. Set GITHUB_TOKEN in tui/.env.local, "
        "or sign into the gh CLI (`gh auth login`)."
    )
WORK_DIR = Path(env("PORTAL_WORK_DIR", "/tmp/portal-tui")).expanduser()
AUDIT_DIR = Path(env("PORTAL_AUDIT_DIR", str(Path.home() / ".portal-tui" / "audit"))).expanduser()
CLAUDE_BIN = env("CLAUDE_BIN", "claude")
TOFU_BIN = env("TOFU_BIN", "tofu")
GIT_BIN = env("GIT_BIN", "git")
CLAUDE_MAX_TURNS = int(env("CLAUDE_MAX_TURNS", "20"))


@dataclass(frozen=True)
class Repo:
    slug: str
    name: str
    description: str
    default_branch: str
    has_workflows: bool
    group: str  # "itti" | "mondevo"


REPOS: list[Repo] = [
    Repo("itti-bank-ai-infra", "Bank AI", "ECS + ALB for bank-ai agents", "dev", True, "itti"),
    Repo("itti-bank-core-infra", "Bank Core", "Banking core APIs — ECS, ALB", "dev", True, "itti"),
    Repo("itti-customer-core-infra", "Customer Core", "Customer platform — VPC, compute", "dev", True, "itti"),
    Repo("itti-docs-infra", "Docs", "Static docs site — S3 + CloudFront", "main", True, "itti"),
    Repo("itti-finance-infra", "Finance", "Finance services — ECS, ALB", "dev", True, "itti"),
    Repo("itti-siav-infra", "SIAV", "SIAV workload — shared + compute", "dev", True, "itti"),
    Repo("itti-network-infra", "Network", "Hub VPC, Transit Gateway", "dev", False, "itti"),
    Repo("itti-ui-infra", "UI", "Merchant + customer UIs", "main", False, "itti"),
    Repo("mondevo-org-infra", "Mondevo Org", "Org-level — accounts, SCPs", "main", False, "mondevo"),
    Repo("mondevo-customer-core-infra", "Mondevo Customer Core", "Compute + networking", "main", False, "mondevo"),
    Repo("mondevo-network-infra", "Mondevo Network", "Network hub — VPC, TGW", "main", False, "mondevo"),
    Repo("mondevo-shared-intelligence-infra", "Mondevo Shared Intelligence", "ECS + network", "main", False, "mondevo"),
]


def repo_by_slug(slug: str) -> Repo | None:
    return next((r for r in REPOS if r.slug == slug), None)
