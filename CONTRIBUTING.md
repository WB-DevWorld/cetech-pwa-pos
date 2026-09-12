# Contributing

Read AGENTS.md, OWNERSHIP.md, CURRENT-WORK.md and your workstream's TASKS/STATUS/HANDOFF. [ADR-012](docs/decisions/ADR/012.md) and the [long-running policy](docs/plans/LONG-RUNNING-WORK.md) control assignment/review cadence after R1 adoption.

Work in short-lived ws1/**, ws2/**, ws3/** or fix/** contributor branches and isolated worktrees. A task remains small; the approved batch queue is the assignment boundary. Implement/test/inspect/commit/checkpoint one ready task, then continue through the already-approved queue without another prompt or PR per task. Preserve unrelated work and serialize central files. Isolate runtime ports, browser origins, local databases and mutable remote fixtures as well as Git checkouts.

At start inspect status and fetch origin; record main SHA and only the declared integration baseline. Follow the policy's two final freshness passes before task/batch delivery. Do not blindly pull/rebase, force-push a peer or discard work. A failed fetch cannot produce a fresh result. The second recorded snapshot ends autonomous reconciliation, even if upstream changes later.

For a new clean checkout, an example is:

```text
git fetch origin --prune
git worktree add ../pos-ws1-r4 -b ws1/r4-sell origin/main
```

Existing contributors preserve their current branches and follow declared-commit integration; do not recreate #40 or #41. Push tested checkpoints. For a shared milestone, the named editor imports declared commits into temporary batch/rN-<scope>, records provenance, runs combined checks, and maintains one draft PR to main. No permanent develop/qa/uat branches. Reuse the existing milestone branch where declared.

Human review occurs at milestone readiness and covers the final tested head. Senior-authored work requires another competent human; only the senior integrates main. Required checks and protections remain. Narrow/split an unreviewable milestone and record the budget change; ten is not a safety cap. No direct main/force pushes or deletion. Full live protection details may be UNVERIFIED when administration reads are denied; a checked-in settings file is not verification.

Keep scoped tests and handoff evidence with the related implementation commit. Final handoff follows [HANDOFF-TEMPLATE](docs/ai/HANDOFF-TEMPLATE.md). After squash merge start subsequent work from updated main and preserve/transfer only commits not already included. Never edit a merged migration; use reviewed forward migrations.

Secrets stay in excluded local/runtime configuration. Synthetic/local tests may proceed under ADR-011; affected training/production writes retain operation-specific permissions. Audit requests authorize findings first. Git rollback does not reverse external commerce effects. CI and review do not approve production deployment.
