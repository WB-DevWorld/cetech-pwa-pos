## Milestone / problem / resulting behavior
R1–R10 or documented budget exception; why needed and acceptance outcome.

## Included tasks, owners and contributor commits
Task IDs; workstream/path owner; source branch + declared source SHAs; imported SHAs; integration editor. No blanket import of peer branches.

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
Name; final head to review; approval pending/recorded. Senior cannot self-approve. Split if the milestone is too large to understand safely.

## Release limitations and handoff
Assumptions/remaining risks/next action; external effects and recovery references; capability flags/rollback. Code implemented != CI green != reviewed != staging accepted != production approved.
