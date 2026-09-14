# WS1 Cursor continuation prompt

```text
Ownership correction: read ADR-014 and the ownership-preserving section of docs/plans/LONG-RUNNING-WORK.md. Before every task/fix verify the acting human AND workstream match its declared owner, with scope/lease. Continue only through that same owner's ready queue. A cross-owner next task means STOP IMPLEMENTATION, publish exact tested provisional integration SHA and hand off to its named owner; do not wait for a per-task main merge. Integration authority does not grant WS1/WS2 implementation. Owner unavailable means wait or continue explicitly authorized independent same-owner work, never take over. Review fixes return to the owner. Reassignment requires explicit senior instruction recorded in CURRENT-WORK. R5+ uses neutral WS3-owned batch/rN-* PRs; preserve existing #41. Record source/import provenance and keep exactly two final freshness passes. Read current ledger first; older milestone examples below are historical where it has advanced.

Execute the currently approved dependency-ready tasks for WS1 in CURRENT-WORK.md, WB-DevWorld/cetech-pwa-pos. Read AGENTS.md, ADR-012, docs/plans/LONG-RUNNING-WORK.md, ownership/contracts and docs/workstreams/WS-01-FRONTEND-UX/TASKS.md, STATUS.md and HANDOFF.md. Verify adoption/main, branch, dirty work and central leases; record START_FRESHNESS_SNAPSHOT and the declared upstream SHAs.

Refresh #41 and its current review findings. FE-03/FE-04 implementation and frontend review fixes belong to Ben; consume exact tested CORE-04/integration baselines when declared, without a per-task main merge. Preserve existing R4 code and review history. Future FE-05 is R6 and requires its declared dependencies/activation; do not implement R5 bridge/core work.
Frontend features/UI/tests only; no pricing reconstruction, payment verification, schema or unleased core/routes/service worker edits.

Work one bounded authorized task at a time: implement, test, inspect the diff, commit and push an authorized checkpoint; then continue only to the next ready task for the same human/workstream in this batch. No new prompt or PR per ordinary subtask. Use approved mocks only where permitted; never label them live acceptance. If blocked choose another explicitly authorized independent item for the same owner; do not invent work or scope.

Checkpoint every 30–60 minutes or coherent subtask, with exact commands/results, heads, dependencies, remote effects and next action. Pause affected work only for real decision/unsafe operation/permission/contract/ownership conflict. Preserve session handover before limits.

Before final task/batch handoff perform the canonical two-pass bounded freshness protocol: fresh fetch, classify/reconcile/test Pass 1; independent fresh fetch, classify/reconcile/test Pass 2; then STOP. No Pass 3. Report both cutoffs, final head, freshness/delivery status and known post-cutoff risk using docs/ai/HANDOFF-TEMPLATE.md. Missing verification is UNVERIFIED. Do not merge main or promote production.
```
