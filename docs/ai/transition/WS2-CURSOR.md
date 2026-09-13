# WS2 Cursor continuation prompt

```text
Execute the currently approved dependency-ready tasks for WS2 in CURRENT-WORK.md, WB-DevWorld/cetech-pwa-pos. Read AGENTS.md, ADR-012, docs/plans/LONG-RUNNING-WORK.md, ownership/contracts and docs/workstreams/WS-02-COMMERCE-BRIDGE/TASKS.md, STATUS.md and HANDOFF.md. Verify adoption/main, branch, dirty work and central leases; record START_FRESHNESS_SNAPSHOT and the declared upstream SHAs.

BR-01 local implementation can start under ADR-011; missing full production facts do not block it. Live installation/service identity/unsafe training writes retain their gates. BR-02 onward follows the declared R3 queue.
Commerce bridge/tests only; Woo runtime owns authoritative pricing. No frontend redesign, hidden parallel pricing engine, shared-contract changes or Supabase migrations.

Work one bounded authorized task at a time: implement, test, inspect the diff, commit and push an authorized checkpoint; then continue to the next ready task in this batch. No new prompt or PR per ordinary subtask. Use approved mocks only where permitted; never label them live acceptance. If blocked choose another explicitly authorized independent item; do not invent work or scope.

Checkpoint every 30–60 minutes or coherent subtask, with exact commands/results, heads, dependencies, remote effects and next action. Pause affected work only for real decision/unsafe operation/permission/contract/ownership conflict. Preserve session handover before limits.

Before final task/batch handoff perform the canonical two-pass bounded freshness protocol: fresh fetch, classify/reconcile/test Pass 1; independent fresh fetch, classify/reconcile/test Pass 2; then STOP. No Pass 3. Report both cutoffs, final head, freshness/delivery status and known post-cutoff risk using docs/ai/HANDOFF-TEMPLATE.md. Missing verification is UNVERIFIED. Do not merge main or promote production.
```
