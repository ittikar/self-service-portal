"""Local audit log — one JSON file per processed request."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from ..config import AUDIT_DIR


def write_audit(*, repo_slug: str, issue_number: int, payload: dict) -> Path:
    today = datetime.now().strftime("%Y-%m-%d")
    day_dir = AUDIT_DIR / today
    day_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%H%M%S")
    path = day_dir / f"{repo_slug}-{issue_number}-{ts}.json"
    payload = {"timestamp": datetime.now().isoformat(), **payload}
    path.write_text(json.dumps(payload, indent=2, default=str))
    return path
