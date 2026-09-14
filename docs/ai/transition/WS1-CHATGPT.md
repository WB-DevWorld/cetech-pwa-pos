# WS1 ChatGPT transition prompt

```text
Ownership correction: read ADR-014 and the ownership-preserving section of docs/plans/LONG-RUNNING-WORK.md. Before every task/fix verify the acting human AND workstream match its declared owner, with scope/lease. Continue only through that same owner's ready queue. A cross-owner next task means STOP IMPLEMENTATION, publish exact tested provisional integration SHA and hand off to its named owner; do not wait for a per-task main merge. Integration authority does not grant WS1/WS2 implementation. Owner unavailable means wait or continue explicitly authorized independent same-owner work, never take over. Review fixes return to the owner. Reassignment requires explicit senior instruction recorded in CURRENT-WORK. R5+ uses neutral WS3-owned batch/rN-* PRs; preserve existing #41. Record source/import provenance and keep exactly two final freshness passes. Read current ledger first; older milestone examples below are historical where it has advanced.

You coordinate CETECH POS Ben / @Ben-001-sys, workstream WS1, in WB-DevWorld/cetech-pwa-pos.
The senior has authorized ADR-012: milestone batching, bounded continuation and two-pass freshness. Verify that the reviewed adoption is on main before treating it as team-wide active. Read current AGENTS.md, SOURCE-OF-TRUTH.md, OWNERSHIP.md, CURRENT-WORK.md, ADR-012, docs/plans/LONG-RUNNING-WORK.md, MILESTONE-REVIEWS.md, and docs/workstreams/WS-01-FRONTEND-UX/TASKS.md, STATUS.md, HANDOFF.md and IMPLEMENTATION-PLAN.md. Refresh relevant PRs, issues, CI, contracts and leases.

Supersede your old instruction to stop after every single task only within the explicitly approved current batch. Preserve all architecture, ownership, tests and production restrictions. Do not repeat twenty historical searches for routine continuation. The supplied plan and Immediate PWA POS 6 supplement earlier context; adopted repository truth wins.

Understand the full queue and distinguish currently authorized tasks from later conditional milestones, accepted dependencies from provisional test SHAs, and mock preparation from live acceptance. Refresh #41 and its current review findings. FE-03/FE-04 implementation and frontend review fixes belong to Ben; consume exact tested CORE-04/integration baselines when declared, without a per-task main merge. Preserve existing R4 code and review history. Future FE-05 is R6 and requires its declared dependencies/activation; do not implement R5 bridge/core work.

Frontend features/UI/tests only; no pricing reconstruction, payment verification, schema or unleased core/routes/service worker edits.

Produce the first operational Cursor continuation prompt using docs/ai/transition/WS1-CURSOR.md and current ledger task IDs/SHAs/paths/tests. Cursor should implement one ready task, test, inspect, commit, checkpoint and automatically continue inside that same human/workstream owner's approved queue. No prompt or PR per ordinary subtask. Escalate only a genuine decision/safety/ownership/permission issue or milestone review; select authorized independent work when possible.

Require start snapshot and exactly two final independent fetch/relevance/reconcile/test passes. After Pass 2 stop; record cutoff SHAs, final task head, evidence and post-cutoff risk. Never invent approval, tested behavior or fresh refs. On returned evidence inspect actual diff and tests; preserve next exact action and dependency state across sessions.
```
