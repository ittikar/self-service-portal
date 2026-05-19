"""Queue screen — lists all open portal:request issues across 12 repos."""
from __future__ import annotations

from datetime import datetime, timezone

from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Vertical
from textual.screen import Screen
from textual.widgets import DataTable, Footer, Header, Static

from ..services.github import Request, list_open_requests


class QueueScreen(Screen):
    BINDINGS = [
        Binding("r", "refresh", "Refresh"),
        Binding("enter", "open", "Open"),
        Binding("q", "quit", "Quit"),
    ]

    def __init__(self) -> None:
        super().__init__()
        self.requests: list[Request] = []

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Vertical(id="body"):
            yield Static("[b]ittikar self-service — pending request queue[/b]", id="title-line")
            yield Static("Loading…", id="hint")
            yield DataTable(id="table", zebra_stripes=True, cursor_type="row")
        yield Footer()

    def on_mount(self) -> None:
        table: DataTable = self.query_one("#table", DataTable)
        table.add_columns("Repo", "#", "Title", "Requester", "Age")
        self.run_worker(self._load(), exclusive=True, thread=True)

    def action_refresh(self) -> None:
        self.query_one("#hint", Static).update("Refreshing…")
        self.run_worker(self._load(), exclusive=True, thread=True)

    def _load(self) -> None:
        """Fetch in a worker thread, then dispatch UI update back to the main thread."""
        try:
            requests = list_open_requests()
            self.app.call_from_thread(self._render_results, requests, None)
        except Exception as e:  # noqa: BLE001
            self.app.call_from_thread(self._render_results, [], str(e))

    def _render_results(self, requests: list[Request], error: str | None) -> None:
        self.requests = requests
        table: DataTable = self.query_one("#table", DataTable)
        table.clear()
        hint = self.query_one("#hint", Static)
        if error:
            hint.update(f"[red]Error:[/red] {error}\n[dim]Check GITHUB_TOKEN or `gh auth login`[/dim]")
            return
        if not requests:
            hint.update("No pending requests.  [dim]r[/dim] to refresh, [dim]q[/dim] to quit.")
            return
        hint.update(
            f"Pending: [b]{len(requests)}[/b].  "
            "[dim]Enter[/dim] process · [dim]r[/dim] refresh · [dim]q[/dim] quit."
        )
        now = datetime.now(timezone.utc)
        for r in requests:
            age = now - r.created_at
            age_str = f"{age.days}d" if age.days else f"{age.seconds // 3600}h"
            table.add_row(r.repo_name, str(r.issue_number), r.title, r.requester or "—", age_str)
        if requests:
            table.move_cursor(row=0)

    def action_open(self) -> None:
        table: DataTable = self.query_one("#table", DataTable)
        if not self.requests:
            return
        row = table.cursor_row
        if row is None or row < 0 or row >= len(self.requests):
            return
        from .detail import DetailScreen

        self.app.push_screen(DetailScreen(self.requests[row]))
