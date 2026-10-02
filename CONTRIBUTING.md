# Contributing

Read AGENTS.md, OWNERSHIP.md, CURRENT-WORK.md and your workstream's TASKS/STATUS/HANDOFF. [ADR-012](docs/decisions/ADR/012.md) and the [long-running policy](docs/plans/LONG-RUNNING-WORK.md) control assignment/review cadence after R1 adoption.

Work in short-lived ws1/**, ws2/**, ws3/** or fix/** contributor branches and isolated worktrees. A task remains small; the approved batch queue is the assignment boundary. Implement/test/inspect/commit/checkpoint one ready task only for its declared human/workstream owner, then continue through that same owner's approved queue without another prompt or PR per task. At a cross-owner boundary publish the exact tested dependency and hand off; integration responsibility does not authorize the other owner's implementation or review fixes (ADR-014). Preserve unrelated work and serialize central files. Isolate runtime ports, browser origins, local databases and mutable remote fixtures as well as Git checkouts.

At start inspect status and fetch origin; record main SHA and only the declared integration baseline. Follow the policy's two final freshness passes before task/batch delivery. Do not blindly pull/rebase, force-push a peer or discard work. A failed fetch cannot produce a fresh result. The second recorded snapshot ends autonomous reconciliation, even if upstream changes later.

For a new clean checkout, an example is:

```text
git fetch origin --prune
git worktree add ../pos-ws1-r4 -b ws1/r4-sell origin/main
```

Existing contributors preserve their current branches and follow declared-commit integration; do not recreate #40 or #41. Push tested checkpoints. For a shared milestone, the named editor imports declared commits into temporary batch/rN-<scope>, records provenance, runs combined checks, and maintains one draft PR to main. No permanent develop/qa/uat branches. From R5 onward always use a neutral WS3-owned batch/rN-* branch/PR; contributors retain their own branches. Existing #41 is an explicit R4 exception, not a pattern to repeat. Scope a contributor worktree from a declared tested integration SHA when consuming a same-milestone predecessor; no intermediate main merge is required.

Human review occurs at milestone readiness and covers the final tested head. Senior-authored work requires another competent human; only the senior integrates main. Required checks and protections remain. Narrow/split an unreviewable milestone and record the budget change; ten is not a safety cap. No direct main/force pushes or deletion. Full live protection details may be UNVERIFIED when administration reads are denied; a checked-in settings file is not verification.

Keep scoped tests and handoff evidence with the related implementation commit. Final handoff follows [HANDOFF-TEMPLATE](docs/ai/HANDOFF-TEMPLATE.md). After squash merge start subsequent work from updated main and preserve/transfer only commits not already included. Never edit a merged migration; use reviewed forward migrations.

Secrets stay in excluded local/runtime configuration. Synthetic/local tests may proceed under ADR-011; affected training/production writes retain operation-specific permissions. Audit requests authorize findings first. Git rollback does not reverse external commerce effects. CI and review do not approve production deployment.

Owner unavailable is WAITING_FOR_OWNER, not takeover permission. Review fixes return to the task owner; only explicit senior reassignment recorded in CURRENT-WORK changes that. Record human owner, implementing human, source branch/SHA, imported SHA and tested combined SHA using [the handoff template](docs/ai/HANDOFF-TEMPLATE.md). Per-contribution independent review remains necessary even with a neutral PR author.


## Staff documentation impact

Staff-facing documentation is part of Definition of Done. Read [the staff documentation maintenance policy](docs/staff/DOCUMENTATION-MAINTENANCE.md).

Every PR must select exactly one Staff documentation impact declaration in the PR template:

- **Staff documentation updated** — when confirmed behavior affects what staff see, do, are permitted to do, are warned about, or must test. Update the relevant `docs/staff/*.md` file in the same PR.
- **No staff documentation impact** — only when behavior described by the staff guides/workbook is genuinely unchanged. Explain why.

The Linux required CI gate validates this declaration. Reviewers must reject an incorrect no-impact declaration. Build-specific URLs/SHAs belong in a dated Test Brief, not in the permanent Training Guide.
