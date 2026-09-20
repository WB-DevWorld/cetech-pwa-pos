"""Trusted exact-SHA Vercel Preview from Git source.

Runs only from protected main. Candidate application code is never checked out
and never built in this process. The Vercel token is used only for HTTPS calls
to Vercel. Candidate source is executed remotely by Vercel Preview, so exact-head
independent approvals are required before any deployment request. No
production/staging-alias promotion.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

EXPECTED_REPO = "WB-DevWorld/cetech-pwa-pos"
CI_WORKFLOW_PATH = ".github/workflows/ci.yml"
CI_WORKFLOW_NAME = "CI"
REQUIRED_JOBS = ("control-plane", "control-plane-windows")
GITHUB_ACTIONS_APP_SLUG = "github-actions"
REPOSITORY_REVIEWERS = ("Ben-001-sys", "Emmanuel-coder-prog", "wbdevworld")
REQUIRED_INDEPENDENT_APPROVAL_COUNT = 1
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
PR_RE = re.compile(r"^[1-9][0-9]*$")
POLL_SECONDS = 10
POLL_ATTEMPTS = 90
READY_STATES = {"READY"}
FAIL_STATES = {"ERROR", "CANCELED", "CANCELLED"}


class PreviewError(Exception):
    def __init__(self, message: str, summary: str | None = None) -> None:
        super().__init__(message)
        self.summary = summary or "BLOCKED"


def fail(message: str, summary: str | None = None) -> None:
    raise PreviewError(message, summary)


def write_summary(lines: list[str]) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")


def write_output(key: str, value: str) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(f"{key}={value}\n")


def request_json(url: str, token: str, method: str = "GET", body: dict | None = None, user_agent: str = "cetech-exact-sha-preview"):
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
            "User-Agent": user_agent,
            **({"Content-Type": "application/json"} if data is not None else {}),
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}, response.status
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        code = None
        message = f"HTTP {error.code}"
        try:
            parsed = json.loads(detail)
            err = parsed.get("error") if isinstance(parsed, dict) else None
            if isinstance(err, dict):
                code = err.get("code")
                message = str(err.get("message") or message)
            elif isinstance(parsed, dict) and parsed.get("message"):
                message = str(parsed["message"])
        except json.JSONDecodeError:
            message = f"HTTP {error.code}"
        suffix = f" ({code})" if code else ""
        fail(f"{url.split('?', 1)[0]} failed: {message}{suffix}")


def github_json(path: str, token: str, api: str, repo: str, accept: str = "application/vnd.github+json"):
    url = f"{api}/repos/{repo}{path}"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": accept,
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "cetech-exact-sha-preview",
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        fail(f"GitHub API {path} failed with HTTP {error.code}.")


def normalize_sha(value: str) -> str:
    sha = (value or "").strip().lower()
    if not SHA_RE.fullmatch(sha):
        fail("candidate_sha must be a full 40-character hex SHA.")
    return sha


def require_main(github_ref: str, github_repository: str) -> None:
    if github_ref != "refs/heads/main":
        fail("Exact SHA Preview may only run from protected main.")
    if github_repository != EXPECTED_REPO:
        fail(f"Exact SHA Preview may only run in {EXPECTED_REPO}.")


def review_login(review: dict) -> str:
    return str((review.get("user") or {}).get("login") or "")


def review_sha(review: dict) -> str:
    return str(review.get("commit_id") or "").strip().lower()


def review_sort_key(review: dict):
    return (str(review.get("submitted_at") or ""), int(review.get("id") or 0))


def is_authorized_independent_reviewer(login: str, author_login: str | None = None) -> bool:
    name = login.lower()
    if not name or name not in {item.lower() for item in REPOSITORY_REVIEWERS}:
        return False
    if author_login and name == author_login.lower():
        return False
    return True


def latest_effective_exact_head_state(reviews: list[dict], login: str, sha: str) -> str | None:
    state = None
    wanted = login.lower()
    for review in sorted(reviews, key=review_sort_key):
        if review_login(review).lower() != wanted:
            continue
        current = str(review.get("state") or "").upper()
        if current not in {"APPROVED", "CHANGES_REQUESTED"}:
            continue
        if review_sha(review) != sha:
            continue
        state = current
    return state


def independent_exact_head_approvers(
    reviews: list[dict],
    sha: str,
    author_login: str | None = None,
) -> list[str]:
    approvers: list[str] = []
    for login in REPOSITORY_REVIEWERS:
        if not is_authorized_independent_reviewer(login, author_login):
            continue
        if latest_effective_exact_head_state(reviews, login, sha) == "APPROVED":
            approvers.append(login)
    return approvers


def fetch_pr_reviews(pr_number: str, token: str, api: str, repo: str) -> list[dict]:
    reviews: list[dict] = []
    for page in range(1, 11):
        chunk = github_json(f"/pulls/{pr_number}/reviews?per_page=100&page={page}", token, api, repo)
        if not isinstance(chunk, list):
            fail("GitHub PR reviews response was not a list.")
        reviews.extend(chunk)
        if len(chunk) < 100:
            return reviews
    return reviews


def verify_review_authorization(
    reviews: list[dict],
    sha: str,
    author_login: str | None = None,
    required_count: int = REQUIRED_INDEPENDENT_APPROVAL_COUNT,
) -> list[str]:
    approvers = independent_exact_head_approvers(reviews, sha, author_login)
    if len(approvers) < required_count:
        fail(
            "REVIEW_AUTHORIZATION_REQUIRED: need "
            f"{required_count} independent exact-head APPROVED review from an "
            "authorized repository reviewer who is not the PR author.",
            "REVIEW_AUTHORIZATION_REQUIRED",
        )
    return approvers


def build_id_report(sha: str, request_supplied: bool, runtime_observed: str | None = None) -> list[str]:
    request = (
        f"- BUILD_ID request: VERIFIED that the trusted deployment request supplied `{sha}`."
        if request_supplied
        else "- BUILD_ID request: NOT VERIFIED."
    )
    if runtime_observed == sha:
        runtime = f"- Running application BUILD_ID: VERIFIED (`{sha}`)."
    else:
        runtime = "- Running application BUILD_ID: PENDING RUNTIME VERIFICATION."
    return [
        f"- Git source SHA: VERIFIED (`{sha}`) from Vercel deployment metadata.",
        request,
        runtime,
    ]


def verify_pull_request(pull: dict, sha: str, pr_number: str) -> str:
    if pull.get("state") != "open":
        fail(f"PR #{pr_number} must be open.")
    head_repo = ((pull.get("head") or {}).get("repo") or {}).get("full_name")
    base_repo = ((pull.get("base") or {}).get("repo") or {}).get("full_name")
    if head_repo != EXPECTED_REPO or base_repo != EXPECTED_REPO:
        fail(f"PR #{pr_number} must belong to {EXPECTED_REPO} (forks are rejected).")
    head_sha = str((pull.get("head") or {}).get("sha") or "").lower()
    if head_sha != sha:
        fail(f"PR #{pr_number} current head {head_sha} does not equal candidate_sha {sha}.")
    head_ref = str((pull.get("head") or {}).get("ref") or "").strip()
    if not head_ref:
        fail(f"PR #{pr_number} has no head ref.")
    return head_ref


def select_ci_run(runs: list[dict]) -> dict:
    matching = []
    for run in runs:
        if run.get("path") != CI_WORKFLOW_PATH or run.get("name") != CI_WORKFLOW_NAME:
            continue
        status = run.get("status")
        if status not in {"completed", "success"} and status in {
            "queued", "in_progress", "waiting", "pending", "requested",
        }:
            fail(f"Required CI workflow {CI_WORKFLOW_NAME} is still {status}.")
        matching.append(run)
    if not matching:
        fail("No GitHub Actions CI workflow runs were found for the candidate SHA.")
    successful = [run for run in matching if run.get("status") == "completed" and run.get("conclusion") == "success"]
    if not successful:
        fail("GitHub Actions CI workflow did not succeed for the candidate SHA.")
    return successful[0]


def jobs_succeeded(jobs: list[dict]) -> None:
    latest: dict[str, dict] = {}
    for job in jobs:
        name = job.get("name")
        if name not in REQUIRED_JOBS:
            continue
        if job.get("status") in {"queued", "in_progress", "waiting", "pending", "requested"}:
            fail(f"Required CI job {name} is still {job.get('status')}.")
        completed_at = str(job.get("completed_at") or "")
        previous = latest.get(name)
        if previous is None or completed_at >= str(previous.get("completed_at") or ""):
            latest[name] = job
    missing = [name for name in REQUIRED_JOBS if name not in latest]
    if missing:
        fail("Missing required GitHub Actions CI jobs: " + ", ".join(missing))
    failed = [
        f"{name}={job.get('conclusion')}"
        for name, job in latest.items()
        if job.get("conclusion") != "success"
    ]
    if failed:
        fail("Required GitHub Actions CI jobs have not succeeded: " + ", ".join(failed))


def github_actions_checks_succeeded(check_runs: list[dict]) -> None:
    latest: dict[str, dict] = {}
    for run in check_runs:
        if (run.get("app") or {}).get("slug") != GITHUB_ACTIONS_APP_SLUG:
            continue
        name = run.get("name")
        if name not in REQUIRED_JOBS:
            continue
        if run.get("status") in {"queued", "in_progress", "waiting", "pending", "requested"}:
            fail(f"Required GitHub Actions check {name} is still {run.get('status')}.")
        completed_at = str(run.get("completed_at") or "")
        previous = latest.get(name)
        if previous is None or completed_at >= str(previous.get("completed_at") or ""):
            latest[name] = run
    missing = [name for name in REQUIRED_JOBS if name not in latest]
    if missing:
        fail("Missing GitHub Actions CI checks for candidate SHA: " + ", ".join(missing))
    failed = [
        f"{name}={run.get('conclusion')}"
        for name, run in latest.items()
        if run.get("conclusion") != "success"
    ]
    if failed:
        fail("GitHub Actions CI checks have not succeeded: " + ", ".join(failed))


def parse_env_map(value) -> dict[str, str | None]:
    result: dict[str, str | None] = {}
    if isinstance(value, dict):
        env = value.get("env", value)
        if isinstance(env, dict):
            for key, item in env.items():
                result[str(key)] = None if item is None else str(item)
            return result
        value = env
    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict):
                key = item.get("key") or item.get("id") or item.get("name")
                if key:
                    raw = item.get("value")
                    result[str(key)] = None if raw is None else str(raw)
            elif isinstance(item, str):
                if "=" in item:
                    key, _, raw = item.partition("=")
                    result[key] = raw
                else:
                    result[item] = None
    return result


def git_source_sha(deployment: dict) -> str:
    source = deployment.get("gitSource") or {}
    meta = deployment.get("meta") or {}
    for candidate in (
        source.get("sha"),
        meta.get("githubCommitSha"),
        meta.get("gitCommitSha"),
        source.get("ref"),
    ):
        if isinstance(candidate, str) and SHA_RE.fullmatch(candidate.lower()):
            return candidate.lower()
    return ""


def alias_hosts(payload) -> list[str]:
    hosts: list[str] = []
    if isinstance(payload, dict):
        payload = payload.get("aliases") or payload.get("alias") or []
    if not isinstance(payload, list):
        return hosts
    for item in payload:
        if isinstance(item, str):
            hosts.append(item)
        elif isinstance(item, dict):
            alias = item.get("alias") or item.get("domain") or item.get("url")
            if alias:
                hosts.append(str(alias))
    return hosts


def normalize_host(value: str) -> str:
    host = value.strip().lower()
    for prefix in ("https://", "http://"):
        if host.startswith(prefix):
            host = host[len(prefix):]
    return host.split("/", 1)[0]


def production_hosts(project: dict) -> set[str]:
    hosts: set[str] = set()
    targets = project.get("targets") if isinstance(project.get("targets"), dict) else {}
    production = targets.get("production") if isinstance(targets, dict) else {}
    for host in alias_hosts(production) + alias_hosts(project.get("alias")):
        hosts.add(normalize_host(host))
    return {host for host in hosts if host}


def verify_preview_identity(deployment: dict, sha: str, alias_payload=None, protected_hosts: set[str] | None = None) -> None:
    target = deployment.get("target")
    if target in {"production", "staging"}:
        fail(f"Deployment target {target} is not an immutable Preview.")
    actual = git_source_sha(deployment)
    if actual != sha:
        fail(
            f"Deployment Git source SHA {actual or '<missing>'} does not equal candidate {sha}.",
            "IDENTITY_MISMATCH",
        )
    env_map = parse_env_map(deployment.get("env"))
    env_map.update(parse_env_map(deployment.get("build")))
    if "BUILD_ID" in env_map and env_map["BUILD_ID"] not in (None, sha):
        fail("Deployment BUILD_ID does not equal the candidate SHA.", "IDENTITY_MISMATCH")
    assigned = {normalize_host(host) for host in alias_hosts(deployment) + alias_hosts(alias_payload)}
    blocked = (protected_hosts or set()) & assigned
    if blocked:
        fail("Deployment assigned a protected production/shared-staging alias.", "ALIAS_MOVED")


def project_git_link(project: dict) -> dict:
    link = project.get("link")
    if not isinstance(link, dict) or link.get("type") != "github":
        fail(
            "GIT_SOURCE_UNAVAILABLE: Vercel project is not linked to a GitHub repository; "
            "cannot address an exact SHA without a local candidate build. "
            "No local candidate build fallback was attempted.",
            "GIT_SOURCE_UNAVAILABLE",
        )
    org = str(link.get("org") or "")
    repo = str(link.get("repo") or "")
    if f"{org}/{repo}" != EXPECTED_REPO:
        fail(
            f"GIT_SOURCE_UNAVAILABLE: Vercel project Git link is {org}/{repo}, not {EXPECTED_REPO}. "
            "No local candidate build fallback was attempted.",
            "GIT_SOURCE_UNAVAILABLE",
        )
    return link


def create_payload(project_name: str, project_id: str, sha: str, head_ref: str, repo_id) -> dict:
    git_source = {
        "type": "github",
        "org": "WB-DevWorld",
        "repo": "cetech-pwa-pos",
        "ref": head_ref,
        "sha": sha,
    }
    if repo_id is not None:
        git_source["repoId"] = repo_id
    return {
        "name": project_name,
        "project": project_id,
        "gitSource": git_source,
        "gitMetadata": {
            "remoteUrl": f"https://github.com/{EXPECTED_REPO}.git",
            "commitRef": head_ref,
            "commitSha": sha,
            "dirty": False,
            "ci": True,
            "ciType": "github-actions",
        },
        "env": {"BUILD_ID": sha},
        "build": {"env": {"BUILD_ID": sha}},
    }


def verify_github(env: dict[str, str]) -> dict[str, str]:
    require_main(env.get("GITHUB_REF", ""), env.get("GITHUB_REPOSITORY", ""))
    sha = normalize_sha(env.get("CANDIDATE_SHA", ""))
    pr_number = (env.get("PR_NUMBER") or "").strip()
    if not PR_RE.fullmatch(pr_number):
        fail("pr_number is required for unmerged PR candidate deployment.")
    token = env.get("GH_TOKEN") or env.get("GITHUB_TOKEN") or ""
    api = (env.get("GITHUB_API_URL") or "https://api.github.com").rstrip("/")
    repo = env["GITHUB_REPOSITORY"]
    commit = github_json(f"/commits/{sha}", token, api, repo)
    if str(commit.get("sha") or "").lower() != sha:
        fail("candidate_sha is not a commit in this repository.")
    pull = github_json(f"/pulls/{pr_number}", token, api, repo)
    head_ref = verify_pull_request(pull, sha, pr_number)
    runs = github_json(f"/actions/runs?head_sha={sha}&per_page=20", token, api, repo).get("workflow_runs") or []
    selected = select_ci_run(runs)
    jobs = github_json(f"/actions/runs/{selected['id']}/jobs?per_page=100", token, api, repo).get("jobs") or []
    jobs_succeeded(jobs)
    checks = github_json(f"/commits/{sha}/check-runs?per_page=100", token, api, repo).get("check_runs") or []
    github_actions_checks_succeeded(checks)
    author_login = str((pull.get("user") or {}).get("login") or "")
    reviews = fetch_pr_reviews(pr_number, token, api, repo)
    approvers = verify_review_authorization(reviews, sha, author_login=author_login)
    return {
        "sha": sha,
        "pr_number": pr_number,
        "head_ref": head_ref,
        "review_authorization": "granted",
        "independent_approvers": ",".join(approvers),
    }


def deploy_and_verify(env: dict[str, str], verified: dict[str, str], sleeper=time.sleep) -> dict:
    if verified.get("review_authorization") != "granted":
        fail(
            "REVIEW_AUTHORIZATION_REQUIRED: exact-head independent approvals are required before any Vercel deployment request.",
            "REVIEW_AUTHORIZATION_REQUIRED",
        )
    token = env.get("VERCEL_TOKEN") or ""
    team_id = env.get("VERCEL_ORG_ID") or ""
    project_id = env.get("VERCEL_PROJECT_ID") or ""
    missing = [name for name, value in (
        ("VERCEL_TOKEN", token),
        ("VERCEL_ORG_ID", team_id),
        ("VERCEL_PROJECT_ID", project_id),
    ) if not value]
    if missing:
        write_summary([
            "### CETECH POS exact SHA Preview",
            "",
            "**BLOCKED_CONFIGURATION**",
            "",
            "Required staging deployment configuration is missing:",
            *[f"- `{name}`" for name in missing],
            "",
            "No Preview, staging-alias, or production change was attempted.",
        ])
        fail("Required Vercel configuration is missing.", "BLOCKED_CONFIGURATION")
    sha = verified["sha"]
    head_ref = verified["head_ref"]
    query = urllib.parse.urlencode({
        "teamId": team_id,
        "forceNew": "1",
        "skipAutoDetectionConfirmation": "1",
    })
    project, _ = request_json(
        f"https://api.vercel.com/v9/projects/{urllib.parse.quote(project_id, safe='')}?teamId={urllib.parse.quote(team_id, safe='')}",
        token,
    )
    link = project_git_link(project)
    project_name = str(project.get("name") or "cetech-pos-staging")
    body = create_payload(project_name, project_id, sha, head_ref, link.get("repoId"))
    try:
        created, _ = request_json(
            f"https://api.vercel.com/v13/deployments?{query}",
            token,
            method="POST",
            body=body,
        )
    except PreviewError as error:
        fail(
            "GIT_SOURCE_UNAVAILABLE: Vercel could not create a Git-source Preview for the exact SHA. "
            f"{error} No local candidate build fallback was attempted.",
            "GIT_SOURCE_UNAVAILABLE",
        )
    deployment_id = str(created.get("id") or created.get("uid") or "")
    if not deployment_id:
        fail("Vercel create-deployment response did not include an id.", "GIT_SOURCE_UNAVAILABLE")
    deployment = created
    for _ in range(POLL_ATTEMPTS):
        state = str(deployment.get("readyState") or deployment.get("status") or "")
        if state in READY_STATES:
            break
        if state in FAIL_STATES:
            fail(
                f"Vercel Git-source deployment reached {state}. "
                "No local candidate build fallback was attempted.",
                "DEPLOYMENT_ERROR",
            )
        sleeper(POLL_SECONDS)
        deployment, _ = request_json(
            f"https://api.vercel.com/v13/deployments/{urllib.parse.quote(deployment_id, safe='')}?"
            + urllib.parse.urlencode({"teamId": team_id, "withGitRepoInfo": "true"}),
            token,
        )
    else:
        fail("Timed out waiting for Vercel Git-source deployment READY.", "DEPLOYMENT_ERROR")
    try:
        aliases, _ = request_json(
            f"https://api.vercel.com/v2/deployments/{urllib.parse.quote(deployment_id, safe='')}/aliases?teamId={urllib.parse.quote(team_id, safe='')}",
            token,
        )
    except PreviewError:
        aliases = {}
    verify_preview_identity(deployment, sha, aliases, production_hosts(project))
    url = str(deployment.get("url") or "")
    if not url:
        fail("Vercel deployment READY without a URL.", "IDENTITY_MISMATCH")
    if not url.startswith("https://"):
        url = "https://" + url
    env_map = parse_env_map(deployment.get("env"))
    env_map.update(parse_env_map(deployment.get("build")))
    if "BUILD_ID" in env_map and env_map["BUILD_ID"] not in (None, sha):
        fail("Deployment BUILD_ID does not equal the candidate SHA.", "IDENTITY_MISMATCH")
    return {
        "deployment_id": deployment_id,
        "url": url,
        "sha": sha,
        "target": str(deployment.get("target") or "preview"),
        "build_id_request_supplied": True,
        "runtime_build_id": None,
    }


def main(argv: list[str] | None = None, env: dict[str, str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    env = env if env is not None else dict(os.environ)
    command = argv[0] if argv else "run"
    try:
        if command not in {"run", "verify", "deploy"}:
            fail(f"Unknown command {command}")
        verified = verify_github(env)
        if command == "verify":
            print(f"Verified in-repository SHA {verified['sha']} for open PR #{verified['pr_number']}")
            return 0
        result = deploy_and_verify(env, verified)
        write_output("url", result["url"])
        write_output("deployment_id", result["deployment_id"])
        write_summary([
            "### CETECH POS exact SHA Preview",
            "",
            "**PREVIEW_CREATED**",
            "",
            f"- Candidate SHA: `{result['sha']}`",
            f"- Verified open PR: #{verified['pr_number']}",
            f"- Exact-head independent review: granted (`{verified.get('independent_approvers') or 'authorized reviewer'}`)",
            f"- Vercel Preview: {result['url']}",
            f"- Deployment id: `{result['deployment_id']}`",
            f"- Target: `{result['target']}`",
            *build_id_report(
                result["sha"],
                request_supplied=bool(result.get("build_id_request_supplied")),
                runtime_observed=result.get("runtime_build_id"),
            ),
            "- Shared staging alias: not moved",
            "- Production promotion: refused",
            "",
            "Candidate application code was not checked out and was not built in GitHub Actions. "
            "Vercel built the Git source remotely after exact-head independent approval. "
            "This is permission only to enter controlled Preview acceptance. It is not merge "
            "authorization, production promotion, shared-staging alias movement, "
            "electronic-payment execution, refund/restock effects, or VitePOS cutover.",
        ])
        print(f"PREVIEW_CREATED {result['url']}")
        return 0
    except PreviewError as error:
        print(str(error), file=sys.stderr)
        if error.summary == "BLOCKED_CONFIGURATION":
            return 1
        write_summary([
            "### CETECH POS exact SHA Preview",
            "",
            f"**{error.summary}**",
            "",
            str(error),
            "",
            "No production promotion, shared-staging alias movement, or local candidate build with the Vercel token was attempted.",
        ])
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
