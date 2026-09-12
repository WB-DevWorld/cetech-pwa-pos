# External behavior and CETECH decisions

Verified 2026-09-12 using current official sources. External behavior informs implementation; the ten-milestone budget and exactly-two-final-pass termination are explicit CETECH decisions in ADR-012, not vendor guarantees.

| Official source | Relevant documented behavior | CETECH implementation consequence |
| --- | --- | --- |
| [Git fetch](https://git-scm.com/docs/git-fetch) | Fetch retrieves remote objects/refs. | Record fresh refs, then inspect deliberate deltas; do not treat fetch as a merge or cached refs as a new observation. |
| [GitHub PRs](https://docs.github.com/en/pull-requests/reference/pull-requests) | Draft PRs cannot merge; automatic code-owner review requests wait until ready. | One accumulating milestone PR, no PR per subtask. |
| [GitHub workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) | PR open/synchronize/reopen trigger by default; GITHUB_TOKEN-generated events have special behavior; pull_request_target has elevated-context risks. | Keep ordinary PR checks and contributor push filters. Accept simple duplicate runs; do not switch to privileged triggers for convenience. |
| [Required checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks) | Skipped workflows and skipped jobs have different status effects; dependent required gates need careful failure handling. | Keep existing unconditional required jobs and all current checks. No path/draft filter that hides mandatory checks. |
| [Required reviews](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews) | With stale review dismissal enabled, later code-modifying commits invalidate approval. | Final combined head gets independent human review; ten closures does not promise ten approval submissions. |
| [Cursor rules](https://cursor.com/docs/rules) | Rules provide persistent prompt context with file/manual/always scopes. | Short rules reference canonical policy; instructions are not a file ACL or test evidence. |
| [Cursor worktrees](https://cursor.com/docs/configuration/worktrees) | Separate Git checkouts isolate agent file changes and support configured setup. | Retain isolated worktrees; additionally isolate DBs, ports and browser state. |
| [Anthropic long-running harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | Incremental work, progress artifacts and verification address cross-session failure modes. | Durable queue/checkpoint/handoff rather than one giant task or endless history recovery. No unattended correctness guarantee. |
| [DORA small batches](https://dora.dev/capabilities/working-in-small-batches/) | Large AI-generated changes and delayed downstream feedback increase review/integration difficulty. | Preserve small commits, frequent combined testing and a review-size circuit breaker despite milestone batching. |

A speculative GitHub update-branch documentation URL was unavailable during lookup and is not used as evidence. Branch freshness procedures above rely on the retrieved Git and GitHub behavior. No account subscription, full administration settings or production runtime was newly verified.
