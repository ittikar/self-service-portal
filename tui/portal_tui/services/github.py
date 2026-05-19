"""GitHub interactions via PyGithub."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from github import Github

from ..config import GH_ORG, GITHUB_TOKEN, REPOS, REQUEST_LABEL


@dataclass
class Request:
    repo_slug: str
    repo_name: str
    issue_number: int
    title: str
    body: str
    url: str
    state: str
    requester: str
    created_at: datetime
    assignees: list[str]


def gh() -> Github:
    return Github(GITHUB_TOKEN())


def list_open_requests() -> list[Request]:
    """List open issues labeled portal:request across all 12 repos."""
    g = gh()
    out: list[Request] = []
    for r in REPOS:
        try:
            repo = g.get_repo(f"{GH_ORG}/{r.slug}")
            for issue in repo.get_issues(state="open", labels=[REQUEST_LABEL]):
                if issue.pull_request:
                    continue  # safety: skip if a PR ever inherited the label
                requester = ""
                if issue.body:
                    # body opens with "Requested by @<login>"
                    first = issue.body.splitlines()[0].strip()
                    if first.startswith("Requested by @"):
                        requester = first.removeprefix("Requested by @").split()[0]
                out.append(
                    Request(
                        repo_slug=r.slug,
                        repo_name=r.name,
                        issue_number=issue.number,
                        title=issue.title,
                        body=issue.body or "",
                        url=issue.html_url,
                        state=issue.state,
                        requester=requester,
                        created_at=issue.created_at,
                        assignees=[a.login for a in issue.assignees],
                    )
                )
        except Exception as e:  # noqa: BLE001
            # repo doesn't exist or no access — skip
            print(f"[warn] {r.slug}: {e}")
    out.sort(key=lambda x: x.created_at)
    return out


def comment_on_issue(repo_slug: str, issue_number: int, body: str) -> None:
    g = gh()
    repo = g.get_repo(f"{GH_ORG}/{repo_slug}")
    issue = repo.get_issue(issue_number)
    issue.create_comment(body)


def close_issue(repo_slug: str, issue_number: int, final_comment: str | None = None) -> None:
    g = gh()
    repo = g.get_repo(f"{GH_ORG}/{repo_slug}")
    issue = repo.get_issue(issue_number)
    if final_comment:
        issue.create_comment(final_comment)
    issue.edit(state="closed", state_reason="completed")


def parse_manifest_from_body(body: str) -> str | None:
    """Extract the YAML manifest from the issue body. Format set by the portal:
    a fenced ```yaml ... ``` block.
    """
    lines = body.splitlines()
    in_yaml = False
    out: list[str] = []
    for line in lines:
        if line.strip().startswith("```yaml"):
            in_yaml = True
            continue
        if in_yaml and line.strip().startswith("```"):
            break
        if in_yaml:
            out.append(line)
    if not out:
        return None
    return "\n".join(out).strip()
