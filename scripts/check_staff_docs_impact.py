#!/usr/bin/env python3
"""Enforce the PR's staff-documentation impact declaration.

This does not try to infer product semantics from a diff. It makes the author
choose one explicit declaration and proves that an "updated" declaration
actually changes a canonical docs/staff Markdown file. Human review remains
responsible for challenging an incorrect "no impact" declaration.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Iterable

UPDATED_LABEL = "Staff documentation updated"
NO_IMPACT_LABEL = "No staff documentation impact"


def _checked(body: str, label: str) -> bool:
    pattern = rf"(?im)^\s*-\s*\[[xX]\]\s*{re.escape(label)}(?:\s|$)"
    return re.search(pattern, body) is not None


def validate_declaration(body: str, changed_files: Iterable[str]) -> list[str]:
    changed = tuple(changed_files)
    updated = _checked(body, UPDATED_LABEL)
    no_impact = _checked(body, NO_IMPACT_LABEL)
    errors: list[str] = []

    if updated == no_impact:
        errors.append(
            "Select exactly one PR checkbox: "
            f"'{UPDATED_LABEL}' or '{NO_IMPACT_LABEL}'."
        )
        return errors

    if updated and not any(
        path.startswith("docs/staff/") and path.endswith(".md") for path in changed
    ):
        errors.append(
            "The PR declares staff documentation updated, but no canonical "
            "docs/staff/*.md file changed."
        )

    return errors


def changed_files_for_pr(base_sha: str) -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", f"{base_sha}...HEAD"],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "Unable to compute PR changed files. "
            f"git diff exited {result.returncode}: {result.stderr.strip()}"
        )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def main() -> int:
    if os.environ.get("GITHUB_EVENT_NAME") != "pull_request":
        print("Staff documentation impact: not a pull_request event; declaration check skipped.")
        return 0

    event_path = os.environ.get("GITHUB_EVENT_PATH")
    if not event_path:
        print("ERROR: GITHUB_EVENT_PATH is missing.", file=sys.stderr)
        return 2

    event = json.loads(Path(event_path).read_text(encoding="utf-8"))
    pull_request = event.get("pull_request") or {}
    body = pull_request.get("body") or ""
    base_sha = ((pull_request.get("base") or {}).get("sha") or "").strip()
    if not base_sha:
        print("ERROR: pull_request.base.sha is missing.", file=sys.stderr)
        return 2

    try:
        changed = changed_files_for_pr(base_sha)
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    errors = validate_declaration(body, changed)
    if errors:
        print("Staff documentation impact declaration FAILED:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        print(
            "See docs/staff/DOCUMENTATION-MAINTENANCE.md and the PR template.",
            file=sys.stderr,
        )
        return 1

    selection = UPDATED_LABEL if _checked(body, UPDATED_LABEL) else NO_IMPACT_LABEL
    print(f"Staff documentation impact declaration: PASS — {selection}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
