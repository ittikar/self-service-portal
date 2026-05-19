"""Run `tofu init`, `tofu plan`, `tofu apply` in a checked-out infra repo."""
from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

from ..config import TOFU_BIN


@dataclass
class TofuResult:
    stdout: str
    stderr: str
    returncode: int

    @property
    def ok(self) -> bool:
        return self.returncode == 0


def _detect_layer_dir(repo_path: Path) -> Path:
    """Pick the tofu working dir. Most repos: layers/compute. Some: envs. Some: infra."""
    for candidate in ("layers/compute", "envs", "infra"):
        p = repo_path / candidate
        if p.exists() and any(p.glob("*.tf")):
            return p
    # fallback: repo root if it has .tf files
    if any(repo_path.glob("*.tf")):
        return repo_path
    raise RuntimeError(f"Could not detect a tofu working dir in {repo_path}")


def _find_backend_config(work_dir: Path) -> Path | None:
    for name in ("backend.tfbackend", "backends/dev.tfbackend", "backends/nonprod.tfbackend"):
        p = work_dir / name
        if p.exists():
            return p
    # any *.tfbackend
    for p in work_dir.glob("*.tfbackend"):
        return p
    return None


def _find_var_file(work_dir: Path) -> Path | None:
    # Prefer terraform.tfvars or envs/config/<env>.tfvars
    candidates = [
        work_dir / "terraform.tfvars",
        *(work_dir.parent / "envs" / "config").glob("*nonprod*.tfvars"),
        *work_dir.glob("*.tfvars"),
    ]
    for c in candidates:
        if c.is_file():
            return c
    return None


def run_tofu(repo_path: Path, command: list[str]) -> TofuResult:
    work = _detect_layer_dir(repo_path)
    args = [TOFU_BIN, *command]
    proc = subprocess.run(args, cwd=work, capture_output=True, text=True)
    return TofuResult(stdout=proc.stdout, stderr=proc.stderr, returncode=proc.returncode)


def tofu_init(repo_path: Path) -> TofuResult:
    work = _detect_layer_dir(repo_path)
    backend = _find_backend_config(work)
    cmd = [TOFU_BIN, "init", "-input=false"]
    if backend:
        cmd.append(f"-backend-config={backend.relative_to(work)}")
    proc = subprocess.run(cmd, cwd=work, capture_output=True, text=True)
    return TofuResult(stdout=proc.stdout, stderr=proc.stderr, returncode=proc.returncode)


def tofu_plan(repo_path: Path) -> TofuResult:
    work = _detect_layer_dir(repo_path)
    var_file = _find_var_file(work)
    cmd = [TOFU_BIN, "plan", "-input=false", "-no-color"]
    if var_file:
        cmd.append(f"-var-file={var_file.relative_to(work)}")
    proc = subprocess.run(cmd, cwd=work, capture_output=True, text=True)
    return TofuResult(stdout=proc.stdout, stderr=proc.stderr, returncode=proc.returncode)


def tofu_apply(repo_path: Path) -> TofuResult:
    work = _detect_layer_dir(repo_path)
    var_file = _find_var_file(work)
    cmd = [TOFU_BIN, "apply", "-input=false", "-no-color", "-auto-approve"]
    if var_file:
        cmd.append(f"-var-file={var_file.relative_to(work)}")
    proc = subprocess.run(cmd, cwd=work, capture_output=True, text=True)
    return TofuResult(stdout=proc.stdout, stderr=proc.stderr, returncode=proc.returncode)
