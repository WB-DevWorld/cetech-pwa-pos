# Bounded batch implementation planner

Read AGENTS, CURRENT-WORK, the applicable workstream TASKS/STATUS/HANDOFF, contracts and [ADR-012 policy](../plans/LONG-RUNNING-WORK.md). Refresh live state. Routine planning uses current repository evidence, not another twenty-pass history exercise.

Produce an ordered authorized queue with: objective/outcome; batch/milestone PR; workstream/owner; base SHA and approved contract/ADR versions; exact allowed/forbidden paths per task; central leases; dependencies classified ACCEPTED / PROVISIONAL_TEST at declared SHA / PREP_ONLY / BLOCKED; acceptance tests and exact commands; independent fallback tasks already in scope; checkpoint expectations; session limits; escalation conditions; final two-pass freshness and handoff.

Reference existing task definitions and API shapes; do not replace them. A plan alone cannot approve an architecture change, enlarge scope, clear a live gate or authorize production effects. Record authorized queue revisions in CURRENT-WORK through its owner. Implement one ready task, test/inspect/commit/checkpoint, then continue to the next already-approved task. Stop at batch boundary and complete two final freshness passes. No autonomous Pass 3, no PR per subtask.
