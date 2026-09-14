## Milestone / problem / resulting behavior
R1–R10 or documented budget exception; why needed and acceptance outcome. R5+ uses neutral WS3-owned batch/rN-* integration branches; existing R4/#41 is exempt. Milestone assembly is not implementation authority over every included task.

## Included tasks, owners and contributor commits
Task IDs; declared human/workstream owner; actual implementing human; source branch + full source SHAs; imported SHAs; tested combined SHA; integration editor. Explicit reassignment authority/scope/expiry or NONE. No blanket import or implicit cross-owner implementation.

## Scope and dependencies
Allowed/forbidden paths checked; central files/leases; accepted prerequisites; declared provisional integration SHA; prep-only/blocked actions. Unexpected changes: none/list.

## Architecture and contracts
Guardian PASS/WARNING/FAIL; canonical owners/provider leakage; ADRs/contracts changed or none; version compatibility and consumer review. Scope changes require independent authority.

## Migrations and dependencies
None/list; migration owner; fresh/upgrade/RLS evidence; lockfile/package changes and reason.

## Acceptance evidence index
Exact commands/results/artifacts; task evidence; combined-system tests; staging/configuration/commit; required CI. Missing evidence is UNVERIFIED/BLOCKED, never PASS.

## Correctness and security
Concurrency/idempotency/unknown outcomes; auth/RLS; price/stock/payment boundaries; PWA retention. Independent reviewer evaluates invariants and actual diff.

## Bounded two-pass freshness
Link completed docs/ai/HANDOFF-TEMPLATE.md evidence: start main/batch SHAs; Pass 1 and Pass 2 fetched SHAs/timestamps; relevant paths/classifications/fixes/tests; final head; freshness and delivery status; post-cutoff risk. No third autonomous pass. Integration editor checks later arrivals before merge.

## Requested different human reviewer
Name; final head to review; approval pending/recorded; independent review coverage per task/implementer. PR author and contributor cannot self-approve their own work. Review findings return to the owning human; link fix source/import SHAs. Senior cannot self-approve. Split if the milestone is too large to understand safely.

## Release limitations and handoff
Assumptions/remaining risks/next action; external effects and recovery references; capability flags/rollback. Code implemented != CI green != reviewed != staging accepted != production approved.
