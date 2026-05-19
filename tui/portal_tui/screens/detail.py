"""Detail screen — shows the issue manifest, runs claude -p + tofu plan, lets you act."""
from __future__ import annotations

from pathlib import Path

from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.screen import Screen
from textual.widgets import Button, Footer, Header, RichLog, Static

from ..services import audit, claude_runner, git_local, tofu
from ..services.github import (
    Request,
    close_issue,
    comment_on_issue,
    parse_manifest_from_body,
)
from ..config import repo_by_slug


class DetailScreen(Screen):
    BINDINGS = [
        Binding("escape", "back", "Back"),
        Binding("p", "process", "Process with Claude"),
        Binding("a", "apply_ci", "Push to dev (CI applies)"),
        Binding("m", "apply_manual", "Manual tofu apply"),
        Binding("c", "cancel", "Cancel"),
    ]

    def __init__(self, request: Request) -> None:
        super().__init__()
        self.request = request
        self.manifest_yaml: str | None = parse_manifest_from_body(request.body)
        self.repo_path: Path | None = None
        self.claude_result: claude_runner.ClaudeResult | None = None
        self.plan_result: tofu.TofuResult | None = None

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Vertical(id="header-pane"):
            yield Static(
                f"[b]{self.request.repo_name}[/b]  ·  Issue [b]#{self.request.issue_number}[/b]  ·  by @{self.request.requester or '?'}",
                id="title",
            )
            yield Static(self.request.title, id="subtitle")
            yield Static(f"[dim]{self.request.url}[/dim]", id="url")
        with Horizontal(id="bottom"):
            with Vertical(id="left"):
                yield Static("[b]Manifest[/b]", classes="section-title")
                yield RichLog(id="manifest", wrap=True, markup=False, highlight=False)
            with Vertical(id="right"):
                yield Static("[b]Log[/b]", classes="section-title")
                yield RichLog(id="log", wrap=True, markup=True, highlight=False)
        with Horizontal(id="actions"):
            yield Button("Process [p]", id="btn-process", variant="primary")
            yield Button("Push → CI [a]", id="btn-apply-ci", disabled=True)
            yield Button("Manual apply [m]", id="btn-apply-manual", disabled=True)
            yield Button("Cancel [c]", id="btn-cancel", variant="error")
        yield Footer()

    def on_mount(self) -> None:
        mlog: RichLog = self.query_one("#manifest", RichLog)
        if self.manifest_yaml:
            for line in self.manifest_yaml.splitlines():
                mlog.write(line)
        else:
            mlog.write("(no YAML manifest found in issue body)")

    def _log(self, msg: str) -> None:
        self.query_one("#log", RichLog).write(msg)

    def action_back(self) -> None:
        self.app.pop_screen()

    def action_process(self) -> None:
        self.run_worker(self._process(), exclusive=True)

    async def _process(self) -> None:
        if not self.manifest_yaml:
            self._log("[red]No manifest in issue body; cannot process.[/red]")
            return
        repo = repo_by_slug(self.request.repo_slug)
        if not repo:
            self._log(f"[red]Unknown repo: {self.request.repo_slug}[/red]")
            return

        self._log(f"Cloning {self.request.repo_slug}@{repo.default_branch}…")
        try:
            clone = git_local.clone_repo(self.request.repo_slug, repo.default_branch)
        except Exception as e:  # noqa: BLE001
            self._log(f"[red]Clone failed: {e}[/red]")
            return
        self.repo_path = clone.path
        self._log(f"Cloned to {clone.path}")

        self._log("Running [b]claude -p[/b] to generate tofu code…")
        cres = await self._run_blocking(
            lambda: claude_runner.run_claude(
                clone.path, self.request.repo_slug, self.manifest_yaml or ""
            )
        )
        self.claude_result = cres
        if cres.returncode != 0:
            self._log(f"[red]claude exited with code {cres.returncode}[/red]")
            self._log(f"[dim]{(cres.stderr or '').splitlines()[-3:]}[/dim]")
            return
        if cres.summary_line:
            self._log(f"[green]✓ Claude finished:[/green] {cres.summary_line}")
        else:
            self._log("[yellow]Claude finished without a PORTAL_DONE summary.[/yellow]")

        if not git_local.has_changes(clone.path):
            self._log("[yellow]No file changes after claude — aborting.[/yellow]")
            return

        diff = git_local.stage_and_diff(clone.path)
        self._log(f"[b]Generated diff:[/b]\n{diff[:4000]}")

        self._log("Running [b]tofu init[/b]…")
        init = await self._run_blocking(lambda: tofu.tofu_init(clone.path))
        if not init.ok:
            self._log(f"[red]tofu init failed:[/red] {init.stderr[:1000]}")
            return

        self._log("Running [b]tofu plan[/b]…")
        plan = await self._run_blocking(lambda: tofu.tofu_plan(clone.path))
        self.plan_result = plan
        self._log(f"[b]Plan output:[/b]\n{plan.stdout[-4000:]}")
        if not plan.ok:
            self._log(f"[red]tofu plan failed:[/red] {plan.stderr[:1000]}")
            return

        self._log(
            "[green]Ready.[/green] Press [b]a[/b] to push to dev (CI applies), "
            "[b]m[/b] for manual apply, [b]c[/b] to cancel."
        )
        self.query_one("#btn-apply-ci", Button).disabled = False
        self.query_one("#btn-apply-manual", Button).disabled = False

    async def _run_blocking(self, fn):
        import asyncio

        return await asyncio.to_thread(fn)

    def action_apply_ci(self) -> None:
        self.run_worker(self._apply_path("ci"), exclusive=True)

    def action_apply_manual(self) -> None:
        self.run_worker(self._apply_path("manual"), exclusive=True)

    def action_cancel(self) -> None:
        self._log("[yellow]Cancelled. No changes pushed.[/yellow]")
        self.query_one("#btn-apply-ci", Button).disabled = True
        self.query_one("#btn-apply-manual", Button).disabled = True

    async def _apply_path(self, mode: str) -> None:
        if not self.repo_path:
            self._log("[red]Nothing to apply.[/red]")
            return
        repo = repo_by_slug(self.request.repo_slug)
        assert repo

        apply_result: tofu.TofuResult | None = None
        if mode == "manual":
            self._log("Running [b]tofu apply[/b] locally…")
            apply_result = await self._run_blocking(lambda: tofu.tofu_apply(self.repo_path))  # type: ignore[arg-type]
            self._log(f"[b]Apply output:[/b]\n{apply_result.stdout[-3000:]}")
            if not apply_result.ok:
                self._log(f"[red]tofu apply failed:[/red] {apply_result.stderr[:1000]}")
                return

        skip_ci = " [skip ci]" if mode == "manual" else ""
        msg = f"portal: process request #{self.request.issue_number}{skip_ci}"
        try:
            sha = git_local.commit_and_push(self.repo_path, msg, repo.default_branch)
        except Exception as e:  # noqa: BLE001
            self._log(f"[red]Commit/push failed: {e}[/red]")
            return
        self._log(f"[green]Pushed {sha[:8]} to {repo.default_branch}[/green]")

        if mode == "ci":
            issue_comment = (
                f"Generated tofu code applied via portal-tui CI path.\n"
                f"Commit: `{sha}` on `{repo.default_branch}`.\n"
                f"Existing `tofu-apply.yml` workflow will apply on push."
            )
        else:
            issue_comment = (
                f"Generated tofu code applied via portal-tui manual path.\n"
                f"Commit: `{sha}` on `{repo.default_branch}` (with `[skip ci]`).\n"
                f"`tofu apply` ran locally and succeeded."
            )
        try:
            close_issue(self.request.repo_slug, self.request.issue_number, issue_comment)
        except Exception as e:  # noqa: BLE001
            self._log(f"[yellow]Issue close failed (manual close required): {e}[/yellow]")

        audit_path = audit.write_audit(
            repo_slug=self.request.repo_slug,
            issue_number=self.request.issue_number,
            payload={
                "mode": mode,
                "requester": self.request.requester,
                "issue_url": self.request.url,
                "title": self.request.title,
                "manifest_yaml": self.manifest_yaml,
                "claude_summary": self.claude_result.summary_line if self.claude_result else None,
                "claude_stdout_tail": (self.claude_result.stdout[-2000:] if self.claude_result else None),
                "plan_stdout_tail": (self.plan_result.stdout[-2000:] if self.plan_result else None),
                "apply_stdout_tail": (apply_result.stdout[-2000:] if apply_result else None),
                "commit_sha": sha,
                "branch": repo.default_branch,
            },
        )
        self._log(f"[green]Audit saved:[/green] {audit_path}")
        self._log("[b green]Done.[/b green] Press Esc to return to the queue.")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-process":
            self.action_process()
        elif event.button.id == "btn-apply-ci":
            self.action_apply_ci()
        elif event.button.id == "btn-apply-manual":
            self.action_apply_manual()
        elif event.button.id == "btn-cancel":
            self.action_cancel()
