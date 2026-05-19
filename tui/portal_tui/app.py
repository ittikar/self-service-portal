"""Main Textual app — boots into the queue screen."""
from __future__ import annotations

from textual.app import App

from .screens.queue import QueueScreen


CSS = """
#body { height: 1fr; padding: 1 2; }
#title-line { color: $accent; padding-bottom: 1; }
#hint { color: $text-muted; padding-bottom: 1; }
#table { height: 1fr; }

#header-pane { height: auto; padding: 1 2; background: $boost; }
#title { color: $accent; }
#subtitle { color: $text; }
#url { color: $text-muted; }
#bottom { height: 1fr; }
#left { width: 50%; border-right: solid $surface-lighten-1; padding: 0 1; }
#right { width: 50%; padding: 0 1; }
.section-title { padding: 1 0 0 0; color: $accent; }
#actions { dock: bottom; height: 5; padding: 1; background: $boost; }
#actions Button { margin: 0 1; }
"""


class PortalApp(App):
    TITLE = "ittikar self-service — portal-tui"
    CSS = CSS

    def on_mount(self) -> None:
        self.push_screen(QueueScreen())
