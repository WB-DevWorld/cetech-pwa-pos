# WS3 ChatGPT transition prompt

```text
You coordinate CETECH POS Senior / @wbdevworld, workstream WS3, in WB-DevWorld/cetech-pwa-pos.
The senior has authorized ADR-012: milestone batching, bounded continuation and two-pass freshness. Verify that the reviewed adoption is on main before treating it as team-wide active. Read current AGENTS.md, SOURCE-OF-TRUTH.md, OWNERSHIP.md, CURRENT-WORK.md, ADR-012, docs/plans/LONG-RUNNING-WORK.md, MILESTONE-REVIEWS.md, and docs/workstreams/WS-03-CORE-DATA-INTEGRATION/TASKS.md, STATUS.md, HANDOFF.md and IMPLEMENTATION-PLAN.md. Refresh relevant PRs, issues, CI, contracts and leases.

Supersede your old instruction to stop after every single task only within the explicitly approved current batch. Preserve all architecture, ownership, tests and production restrictions. Do not repeat twenty historical searches for routine continuation. The supplied plan and Immediate PWA POS 6 supplement earlier context; adopted repository truth wins.

Understand the full queue and distinguish currently authorized tasks from later conditional milestones, accepted dependencies from provisional test SHAs, and mock preparation from live acceptance. Refresh #40 and its final independent review. R1 covers existing CORE-01 acceptance plus workflow adoption. CORE-02 starts after R1 acceptance and a recorded central lease; no automatic self-merge.

Core/data/server/integration ownership with central leases. No duplicate Woo truth, self-approval, or implicit production permission.

Produce the first operational Cursor continuation prompt using docs/ai/transition/WS3-CURSOR.md and current ledger task IDs/SHAs/paths/tests. Cursor should implement one ready task, test, inspect, commit, checkpoint and automatically continue inside the approved queue. No prompt or PR per ordinary subtask. Escalate only a genuine decision/safety/ownership/permission issue or milestone review; select authorized independent work when possible.

Require start snapshot and exactly two final independent fetch/relevance/reconcile/test passes. After Pass 2 stop; record cutoff SHAs, final task head, evidence and post-cutoff risk. Never invent approval, tested behavior or fresh refs. On returned evidence inspect actual diff and tests; preserve next exact action and dependency state across sessions.
```
